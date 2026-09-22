/**
 * `loop` — drives one agent conversation to completion.
 *
 * One loop = one streamed `POST /api/chat` per step (idle-timeout bounded, so
 * a slow-but-alive generation is never killed by a flat wall-clock deadline):
 *   model replies → if it requested tool calls, run each in order (dispatched
 *   against `AgentControllers`), append the results as `role:"tool"` messages,
 *   and send the whole conversation back → repeat until the model answers with
 *   a plain text reply, hits `maxTurns`, is aborted, or is detected spinning
 *   (the same step producing the same result again and again).
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
  /** Max tool-calling steps before the loop stops (default 14). */
  maxTurns?: number;
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
   * Why the loop stopped: a plain-text reply, the step budget, a user Stop,
   * or a detected spin (same step + same result, no progress).
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
    think,
    retries = 12,
    retryDelayMs = 400,
    retryCapMs = 8_000,
    timeoutMs = 30_000,
    signal,
    onEvent,
  } = opts;
  const ctx: ToolCtx = { controllers };
  let messages: Message[] = [{ role: 'system', content: system }, ...opts.messages];
  const startedAt = Date.now();
  let turns = 0;
  let stopped: RunAgentResult['stopped'] = 'max-turns';
  let finalContent = '';
  const perStep: StepMetrics[] = [];
  let trimRounds = 0; // context-trims tried for the current step (reset on success)
  let emptyStreak = 0; // consecutive empty replies (a nudge is allowed, not a loop)
  let malformedStreak = 0; // consecutive malformed tool-call replies (nudged, not failed)
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
      onEvent?.({ type: 'message', content: reply.content });
      stopped = 'reply';
      break;
    }
    emptyStreak = 0;

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
    }
    perStep.push({ index: stepIndex, modelMs, retries: outcome.retries, retryErrors: outcome.retryErrors, toolCalls: calls.length, toolMs });

    if (++turns >= maxTurns) {
      stopped = 'max-turns';
      break;
    }

    // Spin detection: the same calls producing the same results, three times
    // in a row, or an A-B-A-B cycle. Identical RESULTS are the key — a tool
    // legitimately called twice (add a tile, assemble…) usually changes
    // something, so its signature differs and it never trips this.
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
  }

  return { messages, finalContent, turns, stopped, totalMs: Date.now() - startedAt, perStep };
}
