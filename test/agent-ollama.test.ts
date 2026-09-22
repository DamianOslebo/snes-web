import { describe, expect, it } from 'vitest';
import {
  baseUrl,
  chatOnce,
  checkHealth,
  httpError,
  linkedSignal,
  listModels,
  parseArgs,
} from '../src/agent/ollama';
import type { StreamChunk, Transport } from '../src/agent/ollama';
import type { Message, ToolSpec } from '../src/agent/types';

/** A recording fake: answers via `responder`, records every request. */
function fake(
  responder: (url: string, body: unknown) => unknown,
): { t: Transport; calls: { method: string; url: string; body: unknown }[] } {
  const calls: { method: string; url: string; body: unknown }[] = [];
  const t: Transport = {
    post: async (url, body) => {
      calls.push({ method: 'POST', url, body });
      return responder(url, body);
    },
    get: async (url) => {
      calls.push({ method: 'GET', url, body: undefined });
      return responder(url, undefined);
    },
  };
  return { t, calls };
}

const TOOL: ToolSpec = {
  type: 'function',
  function: {
    name: 'noop',
    description: 'does nothing',
    parameters: { type: 'object', properties: { x: { type: 'number' } } },
  },
};

describe('URL handling', () => {
  it('strips whitespace and trailing slashes', () => {
    expect(baseUrl(' http://127.0.0.1:11434 ')).toBe('http://127.0.0.1:11434');
    expect(baseUrl('http://127.0.0.1:11434/')).toBe('http://127.0.0.1:11434');
    expect(baseUrl('http://127.0.0.1:11434///')).toBe('http://127.0.0.1:11434');
  });

  it('POSTs to <endpoint>/api/chat and GETs <endpoint>/api/tags', async () => {
    const { t, calls } = fake(() => ({ message: { role: 'assistant', content: '' } }));
    await chatOnce('http://h:1/', 'm', [], [TOOL], t);
    await listModels('http://h:1', t);
    expect(calls.map((c) => [c.method, c.url])).toEqual([
      ['POST', 'http://h:1/api/chat'],
      ['GET', 'http://h:1/api/tags'],
    ]);
  });
});

describe('chatOnce — request shape', () => {
  it('sends { model, messages, stream:true } and never a tools field', async () => {
    const { t, calls } = fake(() => ({ message: { role: 'assistant', content: 'ok' } }));
    const msgs: Message[] = [{ role: 'user', content: 'hi' }];
    // `tools` is still passed for signature stability, but it is NOT sent — the
    // tool catalog + JSON contract live in the system prompt (the text protocol
    // that sidesteps Ollama's fragile server-side tool templating).
    await chatOnce('http://h', 'my-model', msgs, [TOOL], t);
    const body = calls[0].body as {
      model: string;
      messages: Message[];
      stream: boolean;
      tools?: unknown;
    };
    expect(body.model).toBe('my-model');
    expect(body.messages).toBe(msgs);
    expect(body.stream).toBe(true);
    expect('tools' in body).toBe(false);
  });

  it('sends the `think` toggle when set, and omits it in auto mode', async () => {
    const { t, calls } = fake(() => ({ message: { role: 'assistant', content: 'ok' } }));
    await chatOnce('http://h', 'm', [], [], t, undefined, false);
    expect((calls[0].body as { think?: boolean }).think).toBe(false);
    await chatOnce('http://h', 'm', [], [], t, undefined, true);
    expect((calls[1].body as { think?: boolean }).think).toBe(true);
    // Auto: the field is absent entirely, so Ollama applies the model default.
    await chatOnce('http://h', 'm', [], [], t);
    expect('think' in (calls[2].body as Record<string, unknown>)).toBe(false);
  });

  it('returns the assistant message (content only when there are no calls)', async () => {
    const { t } = fake(() => ({ message: { role: 'assistant', content: 'hello' } }));
    const m = await chatOnce('http://h', 'm', [], [], t);
    expect(m).toEqual({ role: 'assistant', content: 'hello' });
  });

  it('normalizes a missing/odd response without throwing', async () => {
    const { t } = fake(() => ({}));
    const m = await chatOnce('http://h', 'm', [], [], t);
    expect(m).toEqual({ role: 'assistant', content: '' });
  });
});

describe('chatOnce — tool calls (both wire shapes)', () => {
  it('parses the canonical { function: { name, arguments } } shape', async () => {
    const { t } = fake(() => ({
      message: {
        role: 'assistant',
        content: '',
        tool_calls: [{ function: { name: 'asm_set_source', arguments: { source: 'RTI' } } }],
      },
    }));
    const m = await chatOnce('http://h', 'm', [], [], t);
    expect(m.tool_calls).toEqual([{ name: 'asm_set_source', args: { source: 'RTI' } }]);
  });

  it('tolerates top-level { name, arguments } calls', async () => {
    const { t } = fake(() => ({
      message: {
        role: 'assistant',
        tool_calls: [{ name: 'gfx_add_tile', arguments: {} }],
      },
    }));
    const m = await chatOnce('http://h', 'm', [], [], t);
    expect(m.tool_calls).toEqual([{ name: 'gfx_add_tile', args: {} }]);
  });

  it('tolerates `arguments` arriving as a JSON string', async () => {
    const { t } = fake(() => ({
      message: {
        role: 'assistant',
        tool_calls: [
          { function: { name: 'trk_set_cell', arguments: '{"pattern":1,"row":2}' } },
        ],
      },
    }));
    const m = await chatOnce('http://h', 'm', [], [], t);
    expect(m.tool_calls).toEqual([{ name: 'trk_set_cell', args: { pattern: 1, row: 2 } }]);
  });

  it('skips malformed calls (no name) instead of crashing', async () => {
    const { t } = fake(() => ({
      message: {
        tool_calls: [
          { function: { name: '', arguments: {} } },
          { arguments: {} },
          null,
          { function: { name: 'keep', arguments: { a: 1 } } },
        ],
      },
    }));
    const m = await chatOnce('http://h', 'm', [], [], t);
    expect(m.tool_calls).toEqual([{ name: 'keep', args: { a: 1 } }]);
  });
});

describe('parseArgs', () => {
  it('passes objects through; everything else becomes {}', () => {
    expect(parseArgs({ a: 1 })).toEqual({ a: 1 });
    expect(parseArgs(null)).toEqual({});
    expect(parseArgs(undefined)).toEqual({});
    expect(parseArgs(42)).toEqual({});
    expect(parseArgs('nope')).toEqual({});
    expect(parseArgs('  ')).toEqual({});
    expect(parseArgs('[1,2]')).toEqual({}); // arrays are not valid arg objects
  });
});

describe('listModels', () => {
  it('maps { models: [{name}] } to name strings', async () => {
    const { t } = fake(() => ({
      models: [{ name: 'llama3.1:8b' }, { name: '' }, { noName: true }, 'junk', null],
    }));
    await expect(listModels('http://h', t)).resolves.toEqual(['llama3.1:8b']);
  });

  it('returns [] when the response has no model list', async () => {
    const { t } = fake(() => ({ error: 'weird' }));
    await expect(listModels('http://h', t)).resolves.toEqual([]);
  });
});

describe('httpError', () => {
  it('is an Error carrying the HTTP status, so the loop can classify it', () => {
    const e = httpError(404, 'model "nope" not found');
    expect(e).toBeInstanceOf(Error);
    expect(e.message).toBe('model "nope" not found');
    expect((e as { status?: number }).status).toBe(404);
  });
});

describe('linkedSignal', () => {
  it('passes the user signal through when the deadline is off (fresh signal if none)', () => {
    // No user signal + no deadline: a live signal that never aborts on its own.
    expect(linkedSignal(undefined, 0)).toBeInstanceOf(AbortSignal);
    expect(linkedSignal(undefined, 0).aborted).toBe(false);
    // A deadline of 0 must NOT inject an immediate 0ms abort.
    const ac = new AbortController();
    expect(linkedSignal(ac.signal, 0)).toBe(ac.signal);
    expect(linkedSignal(ac.signal, 0).aborted).toBe(false);
  });

  it('links the user signal with a deadline when a timeout is set', () => {
    const ac = new AbortController();
    const s = linkedSignal(ac.signal, 30_000);
    expect(s).toBeDefined();
    const sig = s as AbortSignal;
    expect(sig).toBeInstanceOf(AbortSignal);
    expect(sig).not.toBe(ac.signal);
    expect(sig.aborted).toBe(false);
    // A user Stop still fires through the linked signal.
    ac.abort();
    expect(sig.aborted).toBe(true);
  });

  it('gives a bare deadline signal when there is no user signal', () => {
    const s = linkedSignal(undefined, 30_000);
    expect(s).toBeDefined();
    const sig = s as AbortSignal;
    expect(sig).toBeInstanceOf(AbortSignal);
    expect(sig.aborted).toBe(false);
  });
});

describe('chatOnce — streaming (postStream)', () => {
  /** A transport that STREAMS through `postStream` — the real browser path. */
  function streamFake(
    run: (emit: (c: unknown) => void, signal: AbortSignal | undefined) => void | Promise<void>,
  ): { t: Transport; sent: { url: string; body: unknown }[] } {
    const sent: { url: string; body: unknown }[] = [];
    const t: Transport = {
      post: async () => {
        throw new Error('streamFake: post should not be used (postStream present)');
      },
      get: async () => {
        throw new Error('streamFake: get not used here');
      },
      postStream: async (url, body, onChunk, signal) => {
        sent.push({ url, body });
        await run((c) => onChunk(c as StreamChunk), signal);
      },
    };
    return { t, sent };
  }

  it('accumulates streamed content into one assistant message (and prefers postStream)', async () => {
    const { t, sent } = streamFake(async (emit) => {
      emit({ content: 'Hel' });
      emit({ content: 'lo ' });
      emit({ content: 'world' });
      emit({ done: true });
    });
    const m = await chatOnce('http://h', 'm', [], [], t);
    expect(m).toEqual({ role: 'assistant', content: 'Hello world' });
    // The streaming body is exactly what Ollama expects: stream:true, no tools.
    expect((sent[0].body as { stream: boolean }).stream).toBe(true);
    expect('tools' in (sent[0].body as object)).toBe(false);
  });

  it('aborts a stalled stream after the idle window — as a RETRYABLE timeout', async () => {
    // The stream emits one token then goes silent. A flat wall-clock deadline
    // would kill slow-but-alive steps; the IDLE window only fires when no token
    // arrives for `timeoutMs`, and classifies as retryable so the loop backs off
    // and retries instead of failing fast.
    const { t } = streamFake(async (emit, signal) => {
      emit({ content: 'partial' });
      // `streamCollect` always supplies a live AbortSignal; the type just can't
      // see it (the transport param is optional).
      const sig = signal as AbortSignal;
      await new Promise<void>((_resolve, reject) => {
        const fail = (): void => {
          const e = new Error('aborted');
          e.name = 'AbortError';
          reject(e);
        };
        if (sig.aborted) return fail();
        sig.addEventListener('abort', fail, { once: true });
      });
    });
    const p = chatOnce('http://h', 'm', [], [], t, undefined, false, 40);
    await expect(p).rejects.toMatchObject({ name: 'TimeoutError' });
  });

  it('lets a SLOW stream finish as long as tokens keep arriving (no flat deadline)', async () => {
    // A token every 30 ms for ~120 ms total: a flat 30 s-style ceiling is
    // irrelevant, but the point is the stream is NOT cut just because it is
    // slow — only an IDLE gap past the window is.
    const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
    const { t } = streamFake(async (emit) => {
      for (const piece of ['a', 'b', 'c', 'd']) {
        await wait(30);
        emit({ content: piece });
      }
    });
    const m = await chatOnce('http://h', 'm', [], [], t, undefined, false, 4_000);
    expect(m).toEqual({ role: 'assistant', content: 'abcd' });
  });

  it('propagates a mid-stream `error` chunk (e.g. the model/worker died)', async () => {
    const { t } = streamFake(async (emit) => {
      emit({ content: 'halfway' });
      emit({ error: 'internal error: worker process no longer running' });
    });
    await expect(chatOnce('http://h', 'm', [], [], t)).rejects.toThrow(/no longer running/);
  });
});

describe('checkHealth', () => {
  it('reports ok + models when the endpoint answers', async () => {
    const { t } = fake(() => ({ models: [{ name: 'qwen2.5:7b' }] }));
    await expect(checkHealth('http://h', t)).resolves.toEqual({
      ok: true,
      models: ['qwen2.5:7b'],
    });
  });

  it('reports the transport error instead of throwing', async () => {
    const t: Transport = {
      post: async () => {
        throw new Error('fetch failed (CORS?)');
      },
      get: async () => {
        throw new Error('fetch failed (CORS?)');
      },
    };
    await expect(checkHealth('http://h', t)).resolves.toEqual({
      ok: false,
      models: [],
      error: 'fetch failed (CORS?)',
    });
  });
});
