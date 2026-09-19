import { describe, expect, it } from 'vitest';
import {
  baseUrl,
  chatOnce,
  checkHealth,
  listModels,
  parseArgs,
} from '../src/agent/ollama';
import type { Transport } from '../src/agent/ollama';
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
  it('sends { model, messages, tools, stream:false } verbatim', async () => {
    const { t, calls } = fake(() => ({ message: { role: 'assistant', content: 'ok' } }));
    const msgs: Message[] = [{ role: 'user', content: 'hi' }];
    await chatOnce('http://h', 'my-model', msgs, [TOOL], t);
    const body = calls[0].body as {
      model: string;
      messages: Message[];
      tools: ToolSpec[];
      stream: boolean;
    };
    expect(body.model).toBe('my-model');
    expect(body.messages).toBe(msgs);
    expect(body.tools).toEqual([TOOL]);
    expect(body.stream).toBe(false);
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
