/**
 * `ollama` — a thin, injectable client for Ollama's HTTP API.
 *
 * The only place in the agent that does I/O. A `Transport` is a small
 * `post(url, body)` / `get(url)` pair (JSON in, JSON out), so the node tests
 * can substitute a fake (no network, no fetch) and pin the exact request
 * shapes. The browser
 * passes `fetchTransport` (native `fetch`, CORS to the Ollama host).
 *
 * Non-streaming by design: one `POST /api/chat` per agent step (the loop in
 * loop.ts does the stepping), so the panel shows a single "thinking…" state
 * and a Stop button that aborts the in-flight request.
 *
 * Pure except for `fetchTransport`, which is the only function that touches
 * `fetch` — and it is only ever called from browser code.
 */

import type {
  ChatRequest,
  Message,
  OllamaChatResponse,
  OllamaTagResponse,
  ToolCall,
  ToolSpec,
} from './types';

/**
 * A transport issues JSON requests and resolves with the parsed JSON
 * response. `signal` (optional) aborts the request; reject with an
 * `AbortError`-like error when aborted so callers can detect it.
 *
 * `post` is for `/api/chat` (JSON body). `get` is for `/api/tags` — Ollama
 * answers that route GET-only (a POST gets a 405), and a plain GET is a
 * "simple" request, so it needs no CORS preflight either.
 */
export interface Transport {
  post(url: string, body: unknown, signal?: AbortSignal): Promise<unknown>;
  get(url: string, signal?: AbortSignal): Promise<unknown>;
}

/**
 * Parse a tool call's `arguments`, which Ollama sends as a JSON object but
 * which some frontends/proxies deliver as a JSON *string*. Always returns an
 * object (never throws): a bad payload becomes `{}` so the caller can report a
 * clean "bad arguments" tool result instead of crashing the loop.
 */
export function parseArgs(args: unknown): Record<string, unknown> {
  if (args === null || args === undefined) return {};
  if (typeof args === 'object' && !Array.isArray(args)) {
    return args as Record<string, unknown>;
  }
  if (typeof args === 'string') {
    const t = args.trim();
    if (t === '') return {};
    try {
      const v: unknown = JSON.parse(t);
      if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
      return {};
    } catch {
      return {};
    }
  }
  return {};
}

/** Normalize one raw Ollama tool call (handles both wire shapes). */
export function parseToolCalls(raw: OllamaChatResponse['message']): ToolCall[] {
  const calls = raw?.tool_calls;
  if (!Array.isArray(calls)) return [];
  const out: ToolCall[] = [];
  for (const c of calls) {
    if (!c) continue;
    const name = c.function?.name ?? c.name;
    if (typeof name !== 'string' || name === '') continue;
    const args = c.function?.arguments !== undefined ? c.function.arguments : c.arguments;
    out.push({ name, args: parseArgs(args) });
  }
  return out;
}

/** Strip the base to an absolute Ollama URL: accept `http://host[:port]` or `/api/...`-less paths. */
export function baseUrl(endpoint: string): string {
  const t = endpoint.trim().replace(/\/+$/, '');
  return t;
}

function join(endpoint: string, path: string): string {
  return `${baseUrl(endpoint)}${path}`;
}

/**
 * An `Error` carrying the HTTP status. The loop uses it to classify the
 * failure: a 4xx (except 408/429) is permanent — a bad model name or a
 * rejected request that retrying can never fix — while a 5xx is transient.
 */
export function httpError(status: number, message: string): Error {
  const e = new Error(message) as Error & { status?: number };
  e.status = status;
  return e;
}

/** Parse a response body as JSON; throw a status-carrying `Error` on non-2xx or non-JSON. */
async function parseJson(res: Response): Promise<unknown> {
  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = text === '' ? {} : JSON.parse(text);
  } catch {
    throw httpError(res.status, `Ollama returned non-JSON (HTTP ${res.status}): ${text.slice(0, 200)}`);
  }
  if (!res.ok) {
    const msg = (parsed as { error?: string })?.error ?? `HTTP ${res.status}`;
    throw httpError(res.status, String(msg));
  }
  return parsed;
}

/**
 * The default transport: native `fetch`, JSON in / JSON out. Throws a plain
 * `Error` (with the HTTP status) on a non-2xx response so the loop can surface
 * a useful message; honors `signal` for Stop.
 */
export const fetchTransport: Transport = {
  async post(url, body, signal) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
    return parseJson(res);
  },
  async get(url, signal) {
    // No custom headers → a "simple" request → no CORS preflight.
    const res = await fetch(url, { signal });
    return parseJson(res);
  },
};

/**
 * Link the user's abort signal with an optional per-request deadline. The
 * user's Stop always wins; the deadline only turns "Ollama went silent" (a
 * dead tunnel, a stuck first-token load) into a retryable error instead of an
 * infinite hang. `0`/no deadline → the user signal unchanged (or undefined).
 * Falls back to the user signal alone on runtimes without `AbortSignal.any`.
 */
export function linkedSignal(signal: AbortSignal | undefined, timeoutMs: number): AbortSignal | undefined {
  if (!timeoutMs) return signal;
  const A = AbortSignal as unknown as { any?: (s: AbortSignal[]) => AbortSignal };
  if (typeof A.any !== 'function') return signal;
  const deadline = AbortSignal.timeout(timeoutMs);
  // Node (and some browsers) want the signals as an ARRAY — the rest-argument
  // form throws "Value can not be converted to sequence" on Node 22.
  return signal ? A.any([signal, deadline]) : deadline;
}

/**
 * One non-streaming chat turn. Sends `messages` + `tools` to `/api/chat` and
 * returns the model's message (its `content` and any `tool_calls`). The
 * response is normalized to a `Message` (assistant role) plus the parsed tool
 * calls, so the loop never has to know Ollama's exact wire shape.
 *
 * `think` (optional) forwards Ollama's thinking toggle to models that
 * support it (e.g. Qwen3): `false` skips the reasoning phase — the biggest
 * per-step latency win; omitted leaves it to the model default.
 *
 * `timeoutMs` (default 30 s, `0` = off) bounds a single round trip: the
 * signal passed to the transport is the user's signal OR'd with the deadline,
 * so Stop still aborts instantly. A local model should answer in seconds —
 * a step past that is usually stuck, and a timeout is retryable.
 */
export async function chatOnce(
  endpoint: string,
  model: string,
  messages: Message[],
  tools: ToolSpec[],
  transport: Transport = fetchTransport,
  signal?: AbortSignal,
  think?: boolean,
  timeoutMs = 30_000,
): Promise<Message> {
  const body: ChatRequest = { model, messages, tools, stream: false };
  if (think !== undefined) body.think = think;
  const res = (await transport.post(join(endpoint, '/api/chat'), body, linkedSignal(signal, timeoutMs))) as OllamaChatResponse;
  const msg = res?.message;
  const content = typeof msg?.content === 'string' ? msg.content : '';
  const tool_calls = parseToolCalls(msg);
  const out: Message = { role: 'assistant', content };
  if (tool_calls.length) out.tool_calls = tool_calls;
  return out;
}

/** List installed models (`GET /api/tags` → `{ models: [{ name, … }] }`). */
export async function listModels(
  endpoint: string,
  transport: Transport = fetchTransport,
  signal?: AbortSignal,
): Promise<string[]> {
  const res = (await transport.get(join(endpoint, '/api/tags'), signal)) as OllamaTagResponse;
  const models = res?.models;
  if (!Array.isArray(models)) return [];
  return models.map((m) => m?.name).filter((n): n is string => typeof n === 'string' && n !== '');
}

/**
 * Health check for "test connection": resolves `true` when Ollama answers with
 * a model list (even an empty one), `false` on any transport error.
 */
export async function checkHealth(
  endpoint: string,
  transport: Transport = fetchTransport,
  signal?: AbortSignal,
): Promise<{ ok: boolean; models: string[]; error?: string }> {
  try {
    const models = await listModels(endpoint, transport, signal);
    return { ok: true, models };
  } catch (err) {
    return { ok: false, models: [], error: (err as Error).message };
  }
}
