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
  signal?: AbortSignal;
  onEvent?: (event: AgentEvent) => void;
}

export interface RunAgentResult {
  /** The full conversation, including the system message and every step. */
  messages: Message[];
  /** Content of the final assistant message ("" if it was cut off). */
  finalContent: string;
  /** Tool-calling steps actually taken. */
  turns: number;
  stopped: 'reply' | 'max-turns' | 'aborted';
}

function isAbort(err: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) return true;
  const e = err as { name?: string; message?: string };
  return e?.name === 'AbortError' || /abort/i.test(e?.message ?? '');
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
    signal,
    onEvent,
  } = opts;
  const ctx: ToolCtx = { controllers };
  const messages: Message[] = [{ role: 'system', content: system }, ...opts.messages];
  let turns = 0;
  let stopped: RunAgentResult['stopped'] = 'max-turns';
  let finalContent = '';

  for (;;) {
    if (signal?.aborted) {
      stopped = 'aborted';
      break;
    }
    onEvent?.({ type: 'thinking' });
    let reply: Message;
    try {
      reply = await chatOnce(endpoint, model, messages, TOOL_SPECS, transport, signal, think);
    } catch (err) {
      if (isAbort(err, signal)) {
        stopped = 'aborted';
        break;
      }
      throw err;
    }
    messages.push(reply);
    finalContent = reply.content;

    const calls = reply.tool_calls ?? [];
    if (calls.length === 0) {
      onEvent?.({ type: 'message', content: reply.content });
      stopped = 'reply';
      break;
    }

    for (const call of calls) {
      // `ToolCall.args` is `unknown` for tolerance; dispatch wants an object.
      const args: Record<string, unknown> =
        call.args && typeof call.args === 'object' && !Array.isArray(call.args)
          ? (call.args as Record<string, unknown>)
          : {};
      onEvent?.({ type: 'tool-call', name: call.name, args });
      const result = dispatchTool(call.name, args, ctx);
      onEvent?.({ type: 'tool-result', name: call.name, ok: result.ok, content: result.content });
      messages.push({ role: 'tool', content: result.content, tool_name: call.name });
    }

    if (++turns >= maxTurns) {
      stopped = 'max-turns';
      break;
    }
  }

  return { messages, finalContent, turns, stopped };
}
