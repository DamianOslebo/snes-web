/**
 * `loop` — drives one agent conversation to completion.
 *
 * One loop = one streamed `POST /api/chat` per step (idle-timeout bounded, so
 * a slow-but-alive generation is never killed by a flat wall-clock deadline):
 *   model replies → if it requested tool calls, run each in order (dispatched
 *   against `AgentControllers`), append the results as `role:"tool"` messages,
 *   and send the whole conversation back → repeat until the model answers with
 *   a plain text reply, burns the total step budget, is aborted, or is detected
 *   spinning (the same step producing the same result again and again). The
 *   per-batch `maxTurns` is a "keep going" CHECKPOINT (auto-continued, with a
 *   nudge), not a stop — so a long build keeps working without the user
 *   typing "continue" after every 14 steps.
 *
 * Ship guardrail: the #1 field failure is a run that authors and authors
 * (hundreds of paint calls) and stops or spinning WITHOUT ever producing a ROM
 * — no export/assemble/build/run. So the loop tracks the furthest ship-pipeline
 * stage reached (a stage counts only once its tool call SUCCEEDED: export →
 * assemble → build_rom → run), steers the checkpoint nudge toward shipping
 * while no ROM is running, and — when the model tries to end the run with a
 * plain text reply while no ROM is built and running — gives it a bounded
 * chance (SHIP_NUDGE_MAX) to ship, or to say plainly what is unbuildable and
 * ship the rest, before accepting the stop. A run that ends below "ROM built"
 * gets an explicit "no ROM was produced" note, so the outcome is never
 * silently invisible. All bounded, so it can never loop.
 *
 * Tool calls come from TWO sources, tried in order (see `./tool-protocol`):
 *   - native `message.tool_calls` (back-compat for models/transports that
 *     still emit them);
 *   - a JSON object/array inside the reply TEXT (the primary path — Ollama's
 *     server-side `tools:` template is deliberately NOT used, because its
 *     text/XML templater is the source of the "XML syntax error" failures).
 * A reply that clearly TRIED to call a tool but nothing valid parsed
 * ("malformed") is NUDGED back to the exact JSON contract instead of failing.
 *
 * Failure handling is classified, because the right response differs:
 *   - transient (network blip, 5xx, 429, an idle timeout, a worker crash) →
 *     retried, with PATIENT exponential backoff and "retrying n/m" — never
 *     fail-fast on a step that a re-sample could clear;
 *   - context overflow → the conversation is trimmed (oldest first) and the
 *     step re-sent, a few rounds before giving up with an actionable error;
 *   - permanent (a 4xx — bad model name, rejected request) → fails fast on
 *     the first attempt with the reason; retrying can never fix it.
 *
 * Pure and node-testable: the I/O is injected (`Transport`) and the pages are
 * the `AgentControllers` interface — no DOM, no fetch, no AudioContext. The
 * browser panel supplies the default `fetchTransport` and its own controllers.
 */

import { chatOnce, fetchTransport } from './ollama';
import type { Transport } from './ollama';
import { CONTEXT_TRIM_TAILS, trimForContext } from './conversation';
import { dispatchTool, TOOL_SPECS } from './tools';
import type { ToolCtx } from './tools';
import { parseToolReply } from './tool-protocol';
import type { AgentControllers, Message } from './types';

/**
 * Consecutive malformed tool-call replies before we stop with an explanation.
 * Malformed is the ONE case where a nudge can loop (the model keeps mis-firing
 * the protocol), so it is bounded — but generously, since a re-sample often
 * clears it and the user's Stop button is the real escape hatch.
 */
const MALFORMED_MAX = 4;

/**
 * Nudge pushed into the wire history at each batch checkpoint (every
 * `maxTurns` tool steps) so the run KEEPS GOING instead of making the user
 * type "continue". Deliberately states the task is not over — the bare
 * "continue" the user used to type let the model wander into a text-only
 * reply (the `turns: 0` runs in the field logs); an explicit "not done, keep
 * working" keeps it on task across what used to be a forced stop.
 */
const AUTO_CONTINUE_NUDGE =
  'Step checkpoint reached — the task is NOT finished and you are NOT at a hard limit, so keep going. ' +
  'Call the tools you still need to complete the task. ' +
  'Only stop and give a short summary once the task is actually complete.';

/**
 * The deliverable pipeline — how far a run has gotten at PRODUCING a ROM. The
 * #1 field-log failure is the agent authoring and authoring (hundreds of paint
 * calls) and then stopping or spinning WITHOUT ever calling the
 * export→assemble→build→run tools that turn authored graphics into something
 * the user can actually see. So the loop tracks the furthest SHIP stage reached
 * (a stage counts only once its tool call SUCCEEDED) and steers the run toward
 * shipping instead of letting it wander:
 *   0 = nothing shipped (no export/assemble/build/run)
 *   1 = a data file exported (gfx_export_vram / gfx_export_oam / trk_export_spc)
 *   2 = assembled (asm_assemble)
 *   3 = ROM built (asm_build_rom) — a ROM file exists
 *   4 = ROM running (asm_run) — the user can see it  ← a "working ROM"
 * Ending a run below stage 3 means no ROM was produced; below stage 4 means no
 * WORKING (running) ROM. Both get a bounded nudge to ship before we accept it.
 */
const SHIP_STAGE: Record<string, number> = {
  gfx_export_vram: 1,
  gfx_export_oam: 1,
  trk_export_spc: 1,
  asm_assemble: 2,
  asm_build_rom: 3,
  asm_run: 4,
};

/** Consecutive clean-reply stops nudged to ship before we finally accept one. */
const SHIP_NUDGE_MAX = 2;

/**
 * Checkpoint nudge for a run that has done NO ship-pipeline work yet (stage 0)
 * — exactly the field-log pattern: long stretches of paint calls with zero
 * export/assemble/build/run. Steer hard toward shipping instead of the generic
 * "keep going," and give the model permission to ship a PARTIAL working ROM and
 * report the unbuildable gap, rather than dying trying to build it all.
 */
const SHIP_NUDGE =
  'Step checkpoint — but you have NOT yet produced a ROM: no export, no assemble, no build, no run. ' +
  'Authoring alone reaches the user as nothing. SHIP NOW: call the export tool(s) for what you have authored (gfx_export_vram / gfx_export_oam / trk_export_spc as needed), then asm_assemble, then asm_build_rom, then asm_run. ' +
  'A simple ROM that shows what works beats a perfect description of nothing. ' +
  'If part of the request genuinely cannot be built with the current tools, ship a working ROM with the parts that CAN be built and state clearly in your final summary exactly what you left out and why. ' +
  'Do not keep painting tiles or setting palette colors — that is not progress toward a ROM.';

/**
 * Checkpoint nudge for a run mid-pipeline (stage 1–3): data is on its way but
 * no ROM is running yet. Push it all the way to asm_run instead of stopping at
 * the middle of the pipeline.
 */
const SHIP_PUSH =
  'Step checkpoint — you have made some progress toward a ROM but have not built and run one yet. ' +
  'Drive it all the way: asm_assemble (fixing any per-line errors), then asm_build_rom, then asm_run. ' +
  'A ROM that is built and running is the goal — do not stop at the middle of the pipeline. ' +
  'If a part of the request cannot be built with the current tools, ship a working ROM with the parts that CAN be built and say in your summary exactly what you left out and why.';

/**
 * Forward-looking "intent" phrasing — the model announcing it is ABOUT TO do
 * something rather than reporting it is done. A text-only reply (no tool call)
 * that matches this is a "narration stall": the model said "now I'll build the
 * tiles" but emitted NO tool call, expecting to keep going. That used to end
 * the run (`stopped:reply`, turns:0), forcing the user to type "continue" to
 * make it actually do the work it described. We nudge it ONCE to call the
 * tools. A genuine completion ("the ROM is built", "done") does not match this,
 * so it stops immediately with no extra round-trip.
 */
const INTENT_NUDGE_RE =
  /\b(i'?ll|i will|let me|let'?s|about to|going to|i'?m about to|i'?m going to)\b/i;

/** Nudge pushed when the model narrates the next step but calls no tool. */
const INTENT_NUDGE =
  'You described the next step but did not call a tool, so nothing actually happened yet. ' +
  'Call the tools now to do the work you just described — for example build the tiles, set the tilemap, assemble, and build the ROM. ' +
  'Only stop and give a short summary once the task is actually complete.';

/** UI events, in order, as the loop progresses. */
export type AgentEvent =
  | { type: 'thinking' }
  | { type: 'tool-call'; name: string; args: Record<string, unknown> }
  | { type: 'tool-result'; name: string; ok: boolean; content: string }
  | { type: 'message'; content: string }
  | { type: 'retry'; attempt: number; max: number; error: string };

export interface RunAgentOptions {
  endpoint: string;
  model: string;
  /** The system prompt (usually from `buildSystemPrompt`). */
  system: string;
  /** Prior conversation (user/assistant/tool), in order. */
  messages: Message[];
  controllers: AgentControllers;
  transport?: Transport;
  /**
   * Steps per batch. Every `maxTurns` tool-calling steps is a CHECKPOINT, not a
   * stop: the loop re-anchors the model (a nudge) and keeps going. This is what
   * lets a long build run to completion without the user typing "continue"
   * after every 14 steps. Default 14.
   */
  maxTurns?: number;
  /**
   * Hard cap on TOTAL tool-calling steps across all auto-continued batches —
   * the real "I'm out of budget" stop (a clean reply, a spin, or an abort end
   * the run sooner). Generous by default so a normal multi-step ROM build
   * finishes in one run. Set equal to `maxTurns` to restore the old hard stop.
   * Default 150.
   */
  totalTurns?: number;
  /** Ollama `think` toggle for models that support it; `undefined` = model default. */
  think?: boolean;
  /**
   * Retries per model call for TRANSIENT errors (default 10). The loop
   * deliberately keeps retrying — Ollama's flaky tool-call parse ("XML syntax
   * error …") and tunnel hiccups clear on the next sample; the user's Stop
   * button (abort) is what ends a run, not a bad step. Aborts never retry,
   * and permanent 4xx responses don't count against this budget at all.
   */
  retries?: number;
  /** Base delay before the first retry, in ms (default 400; tests pass 0).
   * Retry delays grow exponentially from here (×2 each attempt) up to a cap. */
  retryDelayMs?: number;
  /** Cap on the backoff delay between retries, in ms (default 8000). Keeps a
   * long crash-and-recover sequence patient without any single wait going
   * absurdly long. */
  retryCapMs?: number;
  /**
   * Per-request deadline in ms (default 30 s, `0` = no deadline). Bounds a
   * single `/api/chat` round trip so a silent Ollama/dead tunnel fails as a
   * retryable error instead of hanging forever; the Stop button still wins.
   */
  timeoutMs?: number;
  signal?: AbortSignal;
  onEvent?: (event: AgentEvent) => void;
  /**
   * Enforce the "ship a ROM" guardrail (default `true`). When on, a run that
   * did authoring work but ends below the export→assemble→build→run pipeline
   * gets a bounded nudge to actually ship (plus an end-of-run note if it still
   * doesn't). Set `false` for pure Q&A assistant use, or in tests that exercise
   * the loop's mechanics (retry, malformed recovery, context trim, …) in
   * isolation — those tests aren't about shipping. The main authoring path
   * leaves it on, which is the field-log fix: the agent used to paint for
   * hundreds of steps and end with a summary, shipping nothing.
   */
  enforceShip?: boolean;
}

/**
 * Per-step metrics — the raw material for the perf/error log. `index` is the
 * 0-based model step; `modelMs` is the wall time for that step's `/api/chat`
 * round trip (including any retries); `retries`/`retryErrors` capture a flaky
 * step that recovered; `toolMs` is the time spent dispatching that step's
 * tool calls (usually small, but included so a slow controller shows up).
 */
export interface StepMetrics {
  index: number;
  modelMs: number;
  retries: number;
  retryErrors: string[];
  toolCalls: number;
  toolMs: number;
}

export interface RunAgentResult {
  /** The full conversation, including the system message and every step. */
  messages: Message[];
  /** Content of the final assistant message ("" if it was cut off). */
  finalContent: string;
  /** Tool-calling steps actually taken. */
  turns: number;
  /**
   * Why the loop stopped: a plain-text reply, the TOTAL step budget, a user
   * Stop, or a detected spin (same step + same result, no progress).
   * `'max-turns'` = the total budget was burned (the per-batch `maxTurns`
   * checkpoint auto-continues and does not stop on its own).
   */
  stopped: 'reply' | 'max-turns' | 'aborted' | 'loop';
  /** Wall time of the whole run (thinking → final answer), in ms. */
  totalMs: number;
  /** One entry per model step actually taken (empty if it never started). */
  perStep: StepMetrics[];
}

/**
 * A user Stop, not a deadline: `AbortSignal.timeout` rejects with a
 * `TimeoutError` (or a "timed out" message on some runtimes), and a timeout
 * must be RETRIED, never treated as the user's abort. An aborted user signal
 * always wins, whatever the error is.
 */
function isAbort(err: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) return true;
  const e = err as { name?: string; message?: string };
  if (e?.name === 'TimeoutError' || /timed?[\s_-]?out/i.test(e?.message ?? '')) return false;
  return e?.name === 'AbortError' || /abort/i.test(e?.message ?? '');
}

/** `sleep` that ends early when `signal` aborts (Stop during a retry delay). */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      resolve();
    }, { once: true });
  });
}

function errText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** What a failed model call means for the retry strategy (see file header). */
export type FailureKind = 'retryable' | 'permanent' | 'context';

/**
 * Classify a failed model call. Context-overflow text wins (it can happen as
 * a 400 too, and the fix is a trim, not a give-up). A 4xx is permanent
 * EXCEPT 408 (their gateway timed out — worth one more go) and 429 (rate
 * limit — the backoff delay is the fix). Everything else — network, 5xx,
 * timeouts — is retryable: re-sending is a fresh sample.
 */
export function classifyError(err: unknown): FailureKind {
  const text = errText(err);
  if (/context|exceed|too (long|large)/i.test(text)) return 'context';
  const status = (err as { status?: unknown })?.status;
  if (typeof status === 'number' && status >= 400 && status < 500 && status !== 408 && status !== 429) {
    return 'permanent';
  }
  return 'retryable';
}

/** A permanent 4xx with an actionable message (esp. the 404 bad-model case). */
function permanentMessage(err: unknown, model: string): string {
  const status = (err as { status?: unknown })?.status;
  let msg = `Ollama rejected the request${typeof status === 'number' ? ` (HTTP ${status})` : ''}: ${errText(err)}`;
  if (status === 404) {
    msg += ` — the model name is probably wrong: check it in the settings field, or run \`ollama pull ${model}\` to install it.`;
  }
  return msg;
}

/**
 * Stable-serialized step signature: the tool calls made AND the results they
 * produced. Identical signature twice in a row (or an A,B,A,B cycle) means the
 * model is doing exactly the same thing and getting exactly the same outcome
 * — provably no progress, whatever its (missing) commentary says.
 */
function stableJson(v: unknown): string {
  if (v === null || v === undefined) return 'null';
  if (Array.isArray(v)) return `[${v.map(stableJson).join(',')}]`;
  if (typeof v === 'object') {
    const obj = v as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableJson(obj[k])}`).join(',')}}`;
  }
  return JSON.stringify(v);
}

function stepSignature(calls: { name: string; args: unknown }[], results: { ok: boolean; content: string }[]): string {
  return stableJson(calls) + '|' + stableJson(results);
}

/** A tool call, args normalized to the object shape `dispatchTool` wants. */
interface StepCall {
  name: string;
  args: Record<string, unknown>;
}

function normalizeArgs(a: unknown): Record<string, unknown> {
  return a && typeof a === 'object' && !Array.isArray(a) ? (a as Record<string, unknown>) : {};
}

/**
 * Resolve a model reply into the tool calls to run, from either source:
 *   1. native `message.tool_calls` (back-compat; some models/transports emit it);
 *   2. the text protocol (primary) — a JSON object/array in the reply text.
 * `malformed` is true when the reply clearly TRIED to call a tool (a tool name /
 * XML / tool keyword is present) but nothing valid parsed — the loop nudges the
 * model back to the exact JSON contract instead of failing. A clean prose reply
 * is `calls: [], malformed: false`.
 */
function resolveCalls(reply: Message): { calls: StepCall[]; malformed: boolean } {
  if (reply.tool_calls && reply.tool_calls.length > 0) {
    return {
      calls: reply.tool_calls.map((c) => ({ name: c.name, args: normalizeArgs(c.args) })),
      malformed: false,
    };
  }
  const parsed = parseToolReply(reply.content);
  if (parsed.kind === 'call') return { calls: parsed.calls, malformed: false };
  if (parsed.kind === 'malformed') return { calls: [], malformed: true };
  return { calls: [], malformed: false };
}

/** A successful model call plus how many failed attempts preceded it. */
interface ChatOutcome {
  reply: Message;
  retries: number;
  /** The error message(s) from any failed attempts, in order (empty if clean). */
  retryErrors: string[];
}

/**
 * `chatOnce` with bounded retries for TRANSIENT errors only. Safe because a
 * failed step has no side effects yet (nothing is dispatched or appended until
 * the call succeeds), so a retry just re-sends the identical conversation and
 * the model re-samples its answer. Aborts rethrow immediately — a Stop is
 * never retried. Permanent 4xx and context-overflow rethrow on the FIRST
 * attempt (the loop handles them — a trim, or a fail-fast message). `onRetry`
 * is notified (but never blocks) on each failed attempt so the UI can show
 * "retrying n/m…" instead of looking frozen.
 *
 * Backoff is EXPOENTIAL (patient): the wait before retry *n* is
 * `min(retryDelayMs * 2^(n-1), retryCapMs)`. A worker-crash-and-recover
 * sequence (ROCm "illegal memory access" → Ollama respawns) needs a growing
 * pause so we let the backend settle, rather than hammering it back to a crash.
 */
async function chatWithRetry(
  endpoint: string,
  model: string,
  messages: Message[],
  transport: Transport,
  signal: AbortSignal | undefined,
  think: boolean | undefined,
  retries: number,
  retryDelayMs: number,
  retryCapMs: number,
  timeoutMs: number,
  onRetry?: (attempt: number, max: number, error: string) => void,
): Promise<ChatOutcome> {
  const retryErrors: string[] = [];
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0 && retryDelayMs > 0) {
      const delay = Math.min(retryDelayMs * 2 ** (attempt - 1), retryCapMs);
      await sleep(delay, signal);
    }
    try {
      const reply = await chatOnce(endpoint, model, messages, TOOL_SPECS, transport, signal, think, timeoutMs);
      return { reply, retries: attempt, retryErrors };
    } catch (err) {
      if (isAbort(err, signal)) throw err;
      if (classifyError(err) !== 'retryable') throw err; // permanent / context — retrying can't help
      lastErr = err;
      const text = errText(err);
      retryErrors.push(text);
      if (attempt < retries) onRetry?.(attempt + 1, retries, text);
    }
  }
  throw lastErr;
}

/**
 * Run the agent until it answers in plain text (or stops). Never throws for
 * aborts or tool errors — those become loop state / clean tool results.
 * Transport failures throw a SELF-CONTAINED, actionable message for the
 * panel: a permanent 4xx (bad model name) fails fast on the first attempt;
 * a context overflow is auto-trimmed a few rounds, then explained; a
 * transient endpoint burns the retry budget and says what to check.
 */
export async function runAgent(opts: RunAgentOptions): Promise<RunAgentResult> {
  const {
    endpoint,
    model,
    system,
    controllers,
    transport = fetchTransport,
    maxTurns = 14,
    totalTurns = 150,
    think,
    retries = 12,
    retryDelayMs = 400,
    retryCapMs = 8_000,
    timeoutMs = 30_000,
    signal,
    onEvent,
    enforceShip = true,
  } = opts;
  const ctx: ToolCtx = { controllers };
  let messages: Message[] = [{ role: 'system', content: system }, ...opts.messages];
  const startedAt = Date.now();
  let turns = 0;
  let batchTurns = 0; // tool-calling steps since the last (auto) checkpoint
  let stopped: RunAgentResult['stopped'] = 'max-turns';
  let finalContent = '';
  const perStep: StepMetrics[] = [];
  let trimRounds = 0; // context-trims tried for the current step (reset on success)
  let emptyStreak = 0; // consecutive empty replies (a nudge is allowed, not a loop)
  let malformedStreak = 0; // consecutive malformed tool-call replies (nudged, not failed)
  let intentStreak = 0; // consecutive "I'll do X" text replies with no tool call (nudged, then stopped)
  let shipStage = 0; // furthest ship-pipeline stage reached (see SHIP_STAGE)
  let shipNudge = 0; // consecutive clean-reply stops nudged to ship (bounded by SHIP_NUDGE_MAX)
  let authored = false; // has the model dispatched any tool call (done authoring work)?
  const sigs: string[] = []; // recent step signatures, for spin detection

  for (;;) {
    if (signal?.aborted) {
      stopped = 'aborted';
      break;
    }
    onEvent?.({ type: 'thinking' });
    const stepIndex = perStep.length;
    const modelStart = Date.now();
    let outcome: ChatOutcome;
    try {
      outcome = await chatWithRetry(
        endpoint,
        model,
        messages,
        transport,
        signal,
        think,
        retries,
        retryDelayMs,
        retryCapMs,
        timeoutMs,
        (attempt, max, error) => onEvent?.({ type: 'retry', attempt, max, error }),
      );
    } catch (err) {
      if (isAbort(err, signal)) {
        stopped = 'aborted';
        break;
      }
      const kind = classifyError(err);
      if (kind === 'context') {
        // The same context just failed on length — re-sending it unchanged
        // can never work. Trim the OLDEST messages away and re-ask, up to
        // one attempt per tail size.
        if (trimRounds >= CONTEXT_TRIM_TAILS.length) {
          throw new Error(
            `The conversation is longer than ${model}'s context window, and it still failed after trimming to the last ${CONTEXT_TRIM_TAILS[CONTEXT_TRIM_TAILS.length - 1]} messages (last error: ${errText(err)}). ` +
            'Start a new conversation (🆕) or switch to a model with a larger context window.',
          );
        }
        messages = trimForContext(messages, trimRounds);
        trimRounds += 1;
        continue;
      }
      if (kind === 'permanent') {
        throw new Error(permanentMessage(err, model));
      }
      throw new Error(
        `Ollama kept failing after ${retries + 1} attempts (last error: ${errText(err)}). ` +
        'Check that Ollama is running and reachable, then send "continue" to try again.',
      );
    }
    const modelMs = Date.now() - modelStart;
    const reply = outcome.reply;
    trimRounds = 0; // this context size fits — future trims start over
    messages.push(reply);
    finalContent = reply.content;

    const resolved = resolveCalls(reply);

    // Malformed: the model clearly TRIED to call a tool (a tool name / XML /
    // a tool keyword is present) but nothing valid parsed. This used to be a
    // hard failure (Ollama's "XML syntax error"); now it's a NUDGE — we show
    // the model what it sent and restate the exact JSON contract. Bounded by
    // MALFORMED_MAX so a model that can't follow the protocol eventually stops
    // with an explanation instead of looping forever.
    if (resolved.malformed) {
      perStep.push({ index: stepIndex, modelMs, retries: outcome.retries, retryErrors: outcome.retryErrors, toolCalls: 0, toolMs: 0 });
      if (malformedStreak >= MALFORMED_MAX) {
        const note = 'The model kept sending tool calls that did not parse, so I stopped. Send your request again — or switch models — and I\'ll pick up from here.';
        finalContent = note;
        onEvent?.({ type: 'message', content: note });
        stopped = 'reply';
        break;
      }
      malformedStreak += 1;
      onEvent?.({ type: 'message', content: reply.content });
      messages.push({
        role: 'user',
        content:
          'Your last reply looked like a tool call but did not parse. Reply with ONE valid JSON object on its own — exactly in this shape: {"tool": "asm_assemble", "args": {}} — using the real tool name and its args. No markdown fences, no XML, no angle-bracket tags. If the task is already done, reply with a short plain-English summary instead.',
      });
      continue;
    }
    malformedStreak = 0;

    const calls = resolved.calls;
    if (calls.length === 0) {
      // A content-less reply with no tool call is NOT an answer. Nudge once;
      // a second empty reply ends the run with a visible explanation rather
      // than a silent blank line.
      if (reply.content.trim() === '') {
        perStep.push({ index: stepIndex, modelMs, retries: outcome.retries, retryErrors: outcome.retryErrors, toolCalls: 0, toolMs: 0 });
        if (emptyStreak >= 1) {
          const note = 'The model kept replying with an empty message, so I stopped. Send your request again — or switch models — and I\'ll pick up from here.';
          finalContent = note;
          onEvent?.({ type: 'message', content: note });
          stopped = 'reply';
          break;
        }
        emptyStreak += 1;
        messages.push({ role: 'user', content: 'Your last reply was empty. Call a tool to continue the work, or reply with a short summary of what you did so far.' });
        continue;
      }
      emptyStreak = 0;
      perStep.push({ index: stepIndex, modelMs, retries: outcome.retries, retryErrors: outcome.retryErrors, toolCalls: 0, toolMs: 0 });

      // A NON-empty text reply is normally the model's final answer — but the
      // field logs showed it is often a "narration stall": the model said
      // "now I'll build the tiles" and called NO tool, so the run ended at
      // turns:0 and the user had to type "continue" to make it act. Forward
      // intent (INTENT_NUDGE_RE) gets ONE nudge to actually call the tools;
      // a second such stall with no tool call in between stops the run. A
      // genuine completion ("the ROM is built", "done") never matches, so it
      // stops immediately with no extra round-trip.
      if (INTENT_NUDGE_RE.test(reply.content)) {
        if (intentStreak >= 1) {
          const note = 'The model described the next step but did not call a tool to do it, so I stopped. Send "continue" to make it act from here, or tell me what to change.';
          finalContent = note;
          onEvent?.({ type: 'message', content: reply.content });
          onEvent?.({ type: 'message', content: note });
          // Leave a nudge in the wire history so a "continue" carries the reason.
          messages.push({ role: 'user', content: 'You described the next step but did not call a tool. Call the tool(s) now to do the work you described — do not just describe it again.' });
          stopped = 'reply';
          break;
        }
        intentStreak += 1;
        onEvent?.({ type: 'message', content: reply.content });
        messages.push({ role: 'user', content: INTENT_NUDGE });
        continue;
      }

      // A NON-empty text reply that is not an intent-stall is the model trying
      // to FINISH. But finishing without a WORKING ROM is exactly the field-log
      // failure: hundreds of paint calls, then a summary, with zero
      // export/assemble/build/run. If the run has not produced a ROM the user
      // can see (stage < 4), give it a BOUNDED chance to ship — or to say
      // plainly what is unbuildable and ship the rest — before accepting the
      // stop. shipNudge is bounded (SHIP_NUDGE_MAX) and reset whenever a tool
      // call runs, so this can never loop.
      //
      // Only when the guardrail is ON (enforceShip) AND the model actually did
      // authoring work (authored). A pure Q&A ("what can you do?" → an answer)
      // has nothing to ship and must not be nagged into building a ROM; a run
      // that only NARRATED a plan (no tool call) is caught earlier by the
      // INTENT_NUDGE above, not here.
      if (enforceShip && authored && shipStage < 4 && shipNudge < SHIP_NUDGE_MAX) {
        shipNudge += 1;
        onEvent?.({ type: 'message', content: reply.content });
        messages.push({
          role: 'user',
          content:
            'You are about to finish, but no ROM is built and RUNNING yet — the user sees nothing until one is running. ' +
            'Before you stop, make sure a ROM is actually built and run: if needed, call the export tool(s) for what you authored, then asm_assemble (fixing any per-line errors), then asm_build_rom, then asm_run. ' +
            'If part of the request genuinely cannot be built with the current tools, ship a working ROM with the parts that CAN be built and state clearly, in your final summary, exactly what you left out and why. ' +
            'Only stop now if this was a pure question with no ROM to produce — in that case say so in one line.',
        });
        continue;
      }

      onEvent?.({ type: 'message', content: reply.content });
      stopped = 'reply';
      break;
    }
    emptyStreak = 0;
    authored = true; // a tool call ran — the model did real authoring work
    shipNudge = 0; // a tool call ran — the model is acting, so re-arm the ship nudge
    intentStreak = 0; // a tool call ran — acting again, so the intent streak resets

    let toolMs = 0;
    const results: { ok: boolean; content: string }[] = [];
    for (const call of calls) {
      onEvent?.({ type: 'tool-call', name: call.name, args: call.args });
      const toolStart = Date.now();
      const result = dispatchTool(call.name, call.args, ctx);
      toolMs += Date.now() - toolStart;
      results.push(result);
      onEvent?.({ type: 'tool-result', name: call.name, ok: result.ok, content: result.content });
      messages.push({ role: 'tool', content: result.content, tool_name: call.name });
      // Track how far the run has gotten at PRODUCING a ROM — a stage counts
      // only once its tool call succeeded (an errored assemble is no ROM).
      if (result.ok) {
        const s = SHIP_STAGE[call.name];
        if (s && s > shipStage) shipStage = s;
      }
    }
    perStep.push({ index: stepIndex, modelMs, retries: outcome.retries, retryErrors: outcome.retryErrors, toolCalls: calls.length, toolMs });

    turns += 1;
    batchTurns += 1;

    // Spin detection FIRST: the same calls producing the same results, three
    // times in a row, or an A-B-A-B cycle. Identical RESULTS are the key — a
    // tool legitimately called twice (add a tile, assemble…) usually changes
    // something, so its signature differs and it never trips this. Checked
    // before the checkpoint so a spin right at a batch boundary is stopped,
    // not auto-continued into more spin.
    sigs.push(stepSignature(calls, results));
    if (sigs.length > 4) sigs.shift();
    const repeats = sigs.length >= 3 && sigs[0] === sigs[1] && sigs[1] === sigs[2];
    const cycles = sigs.length >= 4 && sigs[0] === sigs[2] && sigs[1] === sigs[3];
    if (repeats || cycles) {
      const note = 'I stopped: the same step kept producing the same result with nothing changing, so I am not making progress this way. Tell me what to change — a different approach, or what is failing — and I\'ll pick up from here.';
      finalContent = note;
      onEvent?.({ type: 'message', content: note });
      // Leave a user nudge in the wire history so a "continue" carries the
      // reason, not just the word.
      messages.push({ role: 'user', content: 'That step just repeated with the same result and made no progress. Do NOT repeat it — change your approach: fix the failing part, try a different tool, or re-plan the task.' });
      stopped = 'loop';
      break;
    }

    // Batch checkpoint — this is NOT a stop. The model is mid-task and still
    // acting, so re-anchor it and keep going instead of making the user type
    // "continue" after every 14 steps. Only the TOTAL budget (or a clean
    // reply, a spin, or an abort) ends the run. The nudge exists because a
    // bare "continue" let models stall into a text-only reply (the turns:0
    // runs in the field logs); saying "not done, keep going" keeps them on
    // task across what used to be a forced stop.
    if (batchTurns >= maxTurns) {
      if (turns >= totalTurns) {
        stopped = 'max-turns';
        break;
      }
      // Steer by how far the run is down the ship pipeline: not shipped at all
      // (stage 0) gets the hard SHIP_NUDGE; mid-pipeline (1–3) gets SHIP_PUSH;
      // already running a ROM (stage 4) just gets the plain "keep going".
      // With the guardrail off (enforceShip false) a checkpoint is a plain
      // "keep going" — the mechanism it exists for is disabled.
      const checkpoint = !enforceShip
        ? AUTO_CONTINUE_NUDGE
        : shipStage === 0 ? SHIP_NUDGE : shipStage < 4 ? SHIP_PUSH : AUTO_CONTINUE_NUDGE;
      messages.push({ role: 'user', content: checkpoint });
      batchTurns = 0;
      continue;
    }
  }

  // Make a no-ROM outcome EXPLICIT when the run ended below "ROM built" (stage
  // 3), so the user sees exactly what happened instead of reading a summary
  // and not realizing nothing was actually shipped. Only when the guardrail is
  // on AND the model actually did authoring work — a pure Q&A that ends below
  // stage 3 has nothing to ship and gets no "no ROM" note.
  if (enforceShip && authored && shipStage < 3) {
    const tail =
      shipStage === 0
        ? ' Note: no ROM was produced — the run ended with no export, assemble, build, or run. Re-send the request (or just say "ship it") and I will drive it through the export → assemble → build → run pipeline, or tell me which part is unbuildable and I will ship the rest.'
        : ' Note: a ROM was not built yet (some data was authored but it was never assembled/built). Re-send the request (or say "build and run it") and I will finish the pipeline: asm_assemble → asm_build_rom → asm_run.';
    if (!finalContent.includes('Note:')) finalContent = (finalContent ? finalContent + ' ' : '') + tail;
  }

  return { messages, finalContent, turns, stopped, totalMs: Date.now() - startedAt, perStep };
}
