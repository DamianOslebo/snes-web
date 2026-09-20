/**
 * `loop` — drives one agent conversation to completion.
 *
 * One loop = one non-streaming `POST /api/chat` per step:
 *   model replies → if it requested tool calls, run each in order (dispatched
 *   against `AgentControllers`), append the results as `role:"tool"` messages,
 *   and send the whole conversation back → repeat until the model answers with
 *   a plain text reply, hits `maxTurns`, or the request is aborted.
 *
 * Pure and node-testable: the I/O is injected (`Transport`) and the pages are
 * the `AgentControllers` interface — no DOM, no fetch, no AudioContext. The
 * browser panel supplies the default `fetchTransport` and its own controllers.
 */

import { chatOnce, fetchTransport } from './ollama';
import type { Transport } from './ollama';
import { dispatchTool, TOOL_SPECS } from './tools';
import type { ToolCtx } from './tools';
import type { AgentControllers, Message } from './types';

/** UI events, in order, as the loop progresses. */
export type AgentEvent =
  | { type: 'thinking' }
  | { type: 'tool-call'; name: string; args: Record<string, unknown> }
  | { type: 'tool-result'; name: string; ok: boolean; content: string }
  | { type: 'message'; content: string };

export interface RunAgentOptions {
  endpoint: string;
  model: string;
  /** The system prompt (usually from `buildSystemPrompt`). */
  system: string;
  /** Prior conversation (user/assistant/tool), in order. */
  messages: Message[];
  controllers: AgentControllers;
  transport?: Transport;
  /** Max tool-calling steps before the loop stops (default 10). */
  maxTurns?: number;
  /** Ollama `think` toggle for models that support it; `undefined` = model default. */
  think?: boolean;
  /** Retries per model call for transient server errors (default 2). Aborts never retry. */
  retries?: number;
  /** Delay before retry *n*, in ms (default 400*n; tests pass 0). */
  retryDelayMs?: number;
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
  stopped: 'reply' | 'max-turns' | 'aborted';
  /** Wall time of the whole run (thinking → final answer), in ms. */
  totalMs: number;
  /** One entry per model step actually taken (empty if it never started). */
  perStep: StepMetrics[];
}

function isAbort(err: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) return true;
  const e = err as { name?: string; message?: string };
  return e?.name === 'AbortError' || /abort/i.test(e?.message ?? '');
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** A successful model call plus how many failed attempts preceded it. */
interface ChatOutcome {
  reply: Message;
  retries: number;
  /** The error message(s) from any failed attempts, in order (empty if clean). */
  retryErrors: string[];
}

function errText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * `chatOnce` with bounded retries for transient server errors. Safe because a
 * failed step has no side effects yet (nothing is dispatched or appended
 * until the call succeeds), so a retry just re-sends the identical
 * conversation. Aborts rethrow immediately — a Stop is never retried.
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
): Promise<ChatOutcome> {
  const retryErrors: string[] = [];
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0 && retryDelayMs > 0) await sleep(retryDelayMs * attempt);
    try {
      const reply = await chatOnce(endpoint, model, messages, TOOL_SPECS, transport, signal, think);
      return { reply, retries: attempt, retryErrors };
    } catch (err) {
      if (isAbort(err, signal)) throw err;
      lastErr = err;
      retryErrors.push(errText(err));
    }
  }
  throw lastErr;
}

/**
 * Run the agent until it answers in plain text (or stops). Never throws for
 * aborts or tool errors — those become loop state / clean tool results; other
 * transport errors (Ollama down, CORS, HTTP 5xx) propagate so the panel can
 * show the user a useful message.
 */
export async function runAgent(opts: RunAgentOptions): Promise<RunAgentResult> {
  const {
    endpoint,
    model,
    system,
    controllers,
    transport = fetchTransport,
    maxTurns = 10,
    think,
    retries = 2,
    retryDelayMs = 400,
    signal,
    onEvent,
  } = opts;
  const ctx: ToolCtx = { controllers };
  const messages: Message[] = [{ role: 'system', content: system }, ...opts.messages];
  const startedAt = Date.now();
  let turns = 0;
  let stopped: RunAgentResult['stopped'] = 'max-turns';
  let finalContent = '';
  const perStep: StepMetrics[] = [];

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
      outcome = await chatWithRetry(endpoint, model, messages, transport, signal, think, retries, retryDelayMs);
    } catch (err) {
      if (isAbort(err, signal)) {
        stopped = 'aborted';
        break;
      }
      throw err;
    }
    const modelMs = Date.now() - modelStart;
    const reply = outcome.reply;
    messages.push(reply);
    finalContent = reply.content;

    const calls = reply.tool_calls ?? [];
    if (calls.length === 0) {
      perStep.push({ index: stepIndex, modelMs, retries: outcome.retries, retryErrors: outcome.retryErrors, toolCalls: 0, toolMs: 0 });
      onEvent?.({ type: 'message', content: reply.content });
      stopped = 'reply';
      break;
    }

    let toolMs = 0;
    for (const call of calls) {
      // `ToolCall.args` is `unknown` for tolerance; dispatch wants an object.
      const args: Record<string, unknown> =
        call.args && typeof call.args === 'object' && !Array.isArray(call.args)
          ? (call.args as Record<string, unknown>)
          : {};
      onEvent?.({ type: 'tool-call', name: call.name, args });
      const toolStart = Date.now();
      const result = dispatchTool(call.name, args, ctx);
      toolMs += Date.now() - toolStart;
      onEvent?.({ type: 'tool-result', name: call.name, ok: result.ok, content: result.content });
      messages.push({ role: 'tool', content: result.content, tool_name: call.name });
    }
    perStep.push({ index: stepIndex, modelMs, retries: outcome.retries, retryErrors: outcome.retryErrors, toolCalls: calls.length, toolMs });

    if (++turns >= maxTurns) {
      stopped = 'max-turns';
      break;
    }
  }

  return { messages, finalContent, turns, stopped, totalMs: Date.now() - startedAt, perStep };
}
