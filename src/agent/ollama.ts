/**
 * `ollama` — the Ollama transport + request layer. This is the ONLY file that
 * does I/O; everything above it (loop, conversation, tools) is pure and
 * node-testable.
 *
 * Wire protocol (deliberately NOT Ollama's `tools:` template):
 *   - We send `stream: true` and NO `tools` field. Ollama's server-side tool
 *     templater is the source of the "XML syntax error" failures, so we bypass
 *     it. The tool catalog + JSON contract live in the system prompt.
 *   - The model returns its tool calls as JSON inside `content`; the agent loop
 *     parses that (see `./tool-protocol`). A plain prose reply is a SUCCESS.
 *   - We STREAM, so a slow-but-alive generation is not killed by a flat
 *     wall-clock deadline. Instead an IDLE timeout aborts a step only when no
 *     token has arrived for `timeoutMs` (default 30s).
 *
 * `fetchTransport` is the browser path (native fetch + NDJSON reader). Tests
 * inject a fake `Transport` (a `post` method, and optionally `postStream`) and
 * never touch the network.
 */

import type {
  Message,
  OllamaChatResponse,
  ToolCall,
  ToolSpec,
} from './types';

// --- Transport ----------------------------------------------------------------
//
// The single seam between the agent and I/O. `post` + `get` are required
// (listModels/checkHealth use `get`). `postStream` is OPTIONAL: when present,
// `chatOnce` streams with an idle timeout; when absent it falls back to a
// single `post` (hard deadline). Fakes that only implement `post`/`get` keep
// working unchanged.

export interface StreamChunk {
  content?: unknown;
  message?: {
    role?: string;
    content?: unknown;
    tool_calls?: unknown;
  };
  done?: boolean;
  error?: unknown;
  [key: string]: unknown;
}

export interface Transport {
  post(url: string, body: unknown, signal?: AbortSignal): Promise<unknown>;
  get(url: string, signal?: AbortSignal): Promise<unknown>;
  /**
   * Optional streaming POST. `onChunk` fires once per parsed NDJSON line (an
   * Ollama chat chunk); resolve when the stream ends, reject on a non-2xx
   * status or a network abort. When present, `chatOnce` uses it.
   */
  postStream?(
    url: string,
    body: unknown,
    onChunk: (chunk: StreamChunk) => void,
    signal?: AbortSignal,
  ): Promise<void>;
}

// --- small utilities ------------------------------------------------------------

/**
 * Parse a tool call's `arguments`. Ollama may deliver them as an object or as
 * a JSON string. Never throws — an unparseable payload becomes `{}` so the
 * dispatcher can report the missing field rather than crash the whole step.
 */
export function parseArgs(args: unknown): Record<string, unknown> {
  if (args && typeof args === 'object' && !Array.isArray(args)) {
    return args as Record<string, unknown>;
  }
  if (typeof args === 'string' && args.trim() !== '') {
    try {
      const v: unknown = JSON.parse(args);
      if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
    } catch {
      /* fall through to {} */
    }
  }
  return {};
}

/**
 * Normalize an Ollama `tool_calls` array into `ToolCall[]`, tolerating both the
 * `{ function: { name, arguments } }` and flat `{ name, arguments }` shapes.
 * This is a BACK-COMPAT path (transports/models that still emit native
 * tool_calls); the primary path is the text protocol in `./tool-protocol`.
 */
export function parseToolCalls(raw: unknown): ToolCall[] {
  if (!Array.isArray(raw)) return [];
  const out: ToolCall[] = [];
  for (const c of raw) {
    if (!c || typeof c !== 'object') continue;
    const o = c as {
      function?: { name?: unknown; arguments?: unknown };
      name?: unknown;
      arguments?: unknown;
    };
    const name = (o.function?.name ?? o.name) as string | undefined;
    if (typeof name !== 'string' || name === '') continue;
    const args = parseArgs(o.function?.arguments ?? o.arguments);
    out.push({ name, args });
  }
  return out;
}

export function baseUrl(endpoint: string): string {
  return endpoint.trim().replace(/\/+$/, '');
}

export function join(endpoint: string, path: string): string {
  return `${baseUrl(endpoint)}${path}`;
}

export function httpError(status: number, message?: string): Error {
  const e = new Error(message ?? `HTTP ${status}`);
  (e as Error & { status?: number }).status = status;
  return e;
}

async function parseJson(res: { status: number; ok: boolean; text: () => Promise<string> }): Promise<unknown> {
  if (!res.ok) {
    let detail: string | undefined;
    try {
      const j: unknown = JSON.parse(await res.text());
      if (j && typeof j === 'object' && 'error' in j) detail = String((j as { error: unknown }).error);
    } catch {
      /* body was not JSON */
    }
    throw httpError(res.status, detail);
  }
  const text = await res.text();
  if (text.trim() === '') return {};
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// --- the browser transport (fetch + NDJSON streaming) ---------------------------

/**
 * Split a growing NDJSON buffer into complete lines, invoking `onChunk` per
 * parsed line. Returns the leftover (incomplete) tail. Tolerates keep-alives
 * and partial lines (a line that fails JSON.parse is skipped).
 */
function emitLines(buf: string, onChunk: (c: StreamChunk) => void): string {
  let out = buf;
  let idx: number;
  while ((idx = out.indexOf('\n')) >= 0) {
    const line = out.slice(0, idx).trim();
    out = out.slice(idx + 1);
    if (line === '') continue;
    try {
      onChunk(JSON.parse(line) as StreamChunk);
    } catch {
      /* not a chunk (keep-alive / partial) — skip */
    }
  }
  return out;
}

export const fetchTransport: Transport = {
  async post(url: string, body: unknown, signal?: AbortSignal): Promise<unknown> {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
    return parseJson(res);
  },
  async get(url: string, signal?: AbortSignal): Promise<unknown> {
    const res = await fetch(url, { method: 'GET', signal });
    return parseJson(res);
  },
  async postStream(
    url: string,
    body: unknown,
    onChunk: (c: StreamChunk) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
    if (!res.ok) {
      let detail: string | undefined;
      try {
        const j: unknown = JSON.parse(await res.text());
        if (j && typeof j === 'object' && 'error' in j) detail = String((j as { error: unknown }).error);
      } catch {
        /* not JSON */
      }
      throw httpError(res.status, detail ?? `HTTP ${res.status}`);
    }
    // No body stream (rare) — read the whole thing and emit line by line.
    if (!res.body) {
      const text = await res.text();
      emitLines(text, onChunk);
      return;
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder('utf-8');
    let buf = '';
    for (;;) {
      const r = await reader.read();
      if (r.done) break;
      buf += dec.decode(r.value, { stream: true });
      buf = emitLines(buf, onChunk);
    }
    const tail = buf.trim();
    if (tail !== '') {
      try {
        onChunk(JSON.parse(tail) as StreamChunk);
      } catch {
        /* ignore a trailing partial line */
      }
    }
  },
};

// --- chat ----------------------------------------------------------------------

function chunkText(c: StreamChunk): string {
  if (typeof c.content === 'string') return c.content;
  if (c.message && typeof c.message.content === 'string') return c.message.content;
  return '';
}

function finalize(content: string, nativeCalls: ToolCall[] | undefined): Message {
  const m: Message = { role: 'assistant', content };
  if (nativeCalls && nativeCalls.length > 0) m.tool_calls = nativeCalls;
  return m;
}

/**
 * Read a streamed response, accumulating the assistant text. The stream is cut
 * only if NO token arrives for `timeoutMs` (idle). A user abort (the caller's
 * signal) is rethrown as-is so the loop can treat it as an abort; an idle
 * expiry is rethrown as a retryable TimeoutError so the loop backs off and
 * retries patiently.
 */
async function streamCollect(
  transport: Transport,
  url: string,
  body: unknown,
  signal: AbortSignal | undefined,
  timeoutMs: number,
): Promise<{ content: string; nativeCalls: ToolCall[] | undefined }> {
  const parts: string[] = [];
  let nativeCalls: ToolCall[] | undefined;
  const ctrl = new AbortController();
  let idleFired = false;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;

  // A user abort (the caller's signal) cuts the stream the same way an idle
  // expiry does — both route through `ctrl`, so the read loop below stays blind
  // to which one fired (the catch distinguishes them via `idleFired`).
  if (signal) {
    if (signal.aborted) ctrl.abort();
    else signal.addEventListener('abort', () => ctrl.abort(), { once: true });
  }

  const clearIdle = (): void => {
    if (idleTimer !== undefined) {
      clearTimeout(idleTimer);
      idleTimer = undefined;
    }
  };
  const armIdle = (): void => {
    clearIdle();
    if (timeoutMs <= 0) return;
    idleTimer = setTimeout(() => {
      idleTimer = undefined;
      idleFired = true;
      ctrl.abort();
    }, timeoutMs);
  };

  armIdle();
  try {
    await transport.postStream!(url, body, (c) => {
      if (c && typeof c === 'object') {
        if (c.error) {
          throw new Error(typeof c.error === 'string' ? c.error : JSON.stringify(c.error));
        }
        const s = chunkText(c);
        if (s !== '') parts.push(s);
        if (c.message && c.message.tool_calls) nativeCalls = parseToolCalls(c.message.tool_calls);
      }
      armIdle();
    }, ctrl.signal);
    clearIdle();
    return { content: parts.join(''), nativeCalls };
  } catch (err) {
    clearIdle();
    if (idleFired) {
      const e = new Error(`idle: no model tokens for ${timeoutMs} ms`);
      e.name = 'TimeoutError';
      throw e;
    }
    throw err;
  }
}

/**
 * One model turn. Streams when the transport supports it (idle-timeout
 * bounded), otherwise falls back to a single non-streaming `post` (hard
 * deadline). Returns the assistant `Message`; tool-call interpretation is the
 * loop's job (`./tool-protocol`), with `tool_calls` preserved for transports
 * that still emit native calls.
 *
 * `tools` is accepted for signature compatibility but NOT sent: the tool
 * catalog + JSON contract are in the system prompt, and sending Ollama's
 * `tools:` is what triggered the fragile XML templating path.
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
  void tools;
  const body: Record<string, unknown> = { model, messages, stream: true };
  if (think !== undefined) body.think = think;
  const url = join(endpoint, '/api/chat');

  if (typeof transport.postStream === 'function') {
    const { content, nativeCalls } = await streamCollect(transport, url, body, signal, timeoutMs);
    return finalize(content, nativeCalls);
  }

  // Non-streaming fallback (fakes / older transports): one request, hard deadline.
  const res = (await transport.post(url, body, linkedSignal(signal, timeoutMs))) as OllamaChatResponse;
  const msg = res?.message;
  const content = typeof msg?.content === 'string' ? msg.content : '';
  const native = msg?.tool_calls ? parseToolCalls(msg.tool_calls) : undefined;
  return finalize(content, native);
}

/**
 * Link the caller's abort signal with a wall-clock deadline. Uses
 * `AbortSignal.any` when available; otherwise falls back to the caller's signal
 * alone (never to a bare `AbortSignal.timeout`, which would ignore an in-flight
 * user abort).
 */
export function linkedSignal(signal: AbortSignal | undefined, timeoutMs: number): AbortSignal {
  const parts: AbortSignal[] = [];
  if (signal) parts.push(signal);
  // `0`/negative means "no deadline" — do NOT add a 0ms abort (that fires
  // immediately and would kill an otherwise-fine request).
  if (timeoutMs > 0) parts.push(AbortSignal.timeout(timeoutMs));
  if (parts.length === 0) return new AbortController().signal;
  if (parts.length === 1) return parts[0];
  const any = (AbortSignal as { any?: (s: AbortSignal[]) => AbortSignal }).any;
  if (typeof any === 'function') return any(parts);
  // No AbortSignal.any: keep the user signal (so an in-flight Stop is honored);
  // the deadline component can't be represented without `any`.
  return parts[0];
}

export async function listModels(
  endpoint: string,
  transport: Transport = fetchTransport,
  timeoutMs = 10_000,
): Promise<string[]> {
  const res = (await transport.get(join(endpoint, '/api/tags'), linkedSignal(undefined, timeoutMs))) as {
    models?: unknown;
  };
  // Ollama's `/api/tags` is well-formed, but be tolerant of junk entries
  // (strings, nulls) and empty names rather than crashing the model picker.
  const arr = Array.isArray(res?.models) ? (res.models as unknown[]) : [];
  return arr
    .filter((m): m is { name?: unknown; model?: unknown } => m !== null && typeof m === 'object')
    .map((m) => (typeof m.name === 'string' ? m.name : typeof m.model === 'string' ? m.model : ''))
    .filter((s) => s !== '');
}

/** The shape the "Test" button and the panel render against. */
export interface HealthReport {
  ok: boolean;
  models: string[];
  error?: string;
}

export async function checkHealth(
  endpoint: string,
  transport: Transport = fetchTransport,
  timeoutMs = 10_000,
): Promise<HealthReport> {
  try {
    return { ok: true, models: await listModels(endpoint, transport, timeoutMs) };
  } catch (err) {
    return { ok: false, models: [], error: err instanceof Error ? err.message : String(err) };
  }
}
