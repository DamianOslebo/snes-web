import { describe, expect, it } from 'vitest';
import { runAgent, type AgentEvent } from '../src/agent/loop';
import type { Transport } from '../src/agent/ollama';
import type {
  AgentControllers,
  AsmController,
  GfxController,
  Message,
  TrackController,
} from '../src/agent/types';

/** Minimal controller mocks — enough surface for the loop's tool calls. */
function miniControllers() {
  const log: string[] = [];
  const asm: AsmController = {
    getSource: () => 'RTI\n',
    setSource: (s) => {
      log.push(`setSource:${s}`);
    },
    appendSource: (t) => {
      log.push(`appendSource:${t}`);
    },
    listDataFiles: () => [],
    addDataFile: (n, b) => {
      log.push(`addDataFile:${n}:${b.length}`);
    },
    removeDataFile: (n) => {
      log.push(`removeDataFile:${n}`);
    },
    assemble: () => ({ ok: true, byteCount: 12, errors: [] }),
    buildRom: () => ({ ok: true, bytes: 262144 }),
    run: () => ({ ok: true }),
  };
  const gfx: GfxController = {
    getState: () => ({ mode: 0, tiles: 1, palette: 16, mapEntries: 1024 }),
    setPaletteColor: () => {},
    setTilePixel: () => {},
    fillTileRect: () => {},
    addTile: () => 1,
    setMapEntry: () => {},
    fillMap: () => {},
    setMapFromGrid: () => {},
    buildVram: () => new Uint8Array(4),
  };
  const track: TrackController = {
    getSong: () => '{"v":1,"name":"S","tempo":8,"orders":[0],"patterns":[],"instruments":[]}',
    setCell: () => true,
    setPatternCells: (_p, cells) => cells.length,
    setTempo: () => {},
    setOrders: () => {},
    addPattern: () => 1,
    addInstrument: () => 1,
    preview: () => ({ ok: true }),
    stop: () => ({ ok: true }),
    buildSpc: () => new Uint8Array(2),
    spcGlue: () => ';glue',
    spcLayout: () => ({}),
  };
  return { controllers: { asm, gfx, track } as AgentControllers, log };
}

/** A transport that replays `responses` in order (last one repeats forever). */
function scripted(responses: unknown[]) {
  const calls: { url: string; body: unknown }[] = [];
  let i = 0;
  const t: Transport = {
    post: async (url, body) => {
      calls.push({ url, body });
      return responses[Math.min(i++, responses.length - 1)];
    },
  };
  return { t, calls };
}

const reply = (content: string) => ({ message: { role: 'assistant', content } });
const call = (name: string, args: unknown = {}) => ({
  message: { role: 'assistant', content: '', tool_calls: [{ function: { name, arguments: args } }] },
});

const base = {
  endpoint: 'http://ollama.test',
  model: 'test-model',
  system: 'You are the SNES authoring agent.',
  messages: [{ role: 'user' as const, content: 'make a block game' }],
};

describe('runAgent', () => {
  it('a plain text reply ends the loop on the first step', async () => {
    const { t, calls } = scripted([reply('done!')]);
    const events: AgentEvent[] = [];
    const r = await runAgent({ ...base, controllers: miniControllers().controllers, transport: t, onEvent: (e) => events.push(e) });
    expect(r.stopped).toBe('reply');
    expect(r.turns).toBe(0);
    expect(r.finalContent).toBe('done!');
    expect(r.messages.map((m) => m.role)).toEqual(['system', 'user', 'assistant']);
    expect(events.map((e) => e.type)).toEqual(['thinking', 'message']);
    // The request carries the system prompt, the tools, and no streaming.
    const body = calls[0].body as { system?: unknown; stream: boolean; tools: unknown[] };
    expect(body.stream).toBe(false);
    expect(Array.isArray(body.tools)).toBe(true);
    expect(calls[0].url).toBe('http://ollama.test/api/chat');
  });

  it('runs a multi-turn tool loop, feeding each result back as a tool message', async () => {
    const { controllers, log } = miniControllers();
    const { t, calls } = scripted([
      call('asm_set_source', { source: 'RTI\n  rts' }),
      call('asm_assemble', {}),
      reply('built it'),
    ]);
    const events: AgentEvent[] = [];
    const r = await runAgent({ ...base, controllers, transport: t, onEvent: (e) => events.push(e) });

    expect(r.stopped).toBe('reply');
    expect(r.turns).toBe(2);
    expect(log).toContain('setSource:RTI\n  rts');

    const roles = r.messages.map((m) => m.role);
    expect(roles).toEqual(['system', 'user', 'assistant', 'tool', 'assistant', 'tool', 'assistant']);
    const toolMsgs = r.messages.filter((m) => m.role === 'tool') as Message[];
    expect(toolMsgs.map((m) => m.tool_name)).toEqual(['asm_set_source', 'asm_assemble']);
    expect(toolMsgs[1].content).toContain('byteCount');

    // The second request must include the first tool result.
    const body2 = calls[1].body as { messages: Message[] };
    expect(body2.messages.some((m) => m.role === 'tool' && m.tool_name === 'asm_set_source')).toBe(true);

    expect(events.map((e) => e.type)).toEqual([
      'thinking', 'tool-call', 'tool-result',
      'thinking', 'tool-call', 'tool-result',
      'thinking', 'message',
    ]);
  });

  it('stops after maxTurns tool-calling steps', async () => {
    const { t, calls } = scripted([call('asm_get_source')]); // same tool call, forever
    const r = await runAgent({
      ...base,
      controllers: miniControllers().controllers,
      transport: t,
      maxTurns: 2,
    });
    expect(r.stopped).toBe('max-turns');
    expect(r.turns).toBe(2);
    expect(calls).toHaveLength(2); // stops before a third model call
    const roles = r.messages.map((m) => m.role);
    expect(roles.filter((x) => x === 'assistant')).toHaveLength(2);
    expect(roles.filter((x) => x === 'tool')).toHaveLength(2);
  });

  it('an aborted in-flight request becomes stopped:"aborted" (no throw)', async () => {
    const t: Transport = {
      post: async () => {
        const err = new Error('aborted');
        err.name = 'AbortError';
        throw err;
      },
    };
    const r = await runAgent({ ...base, controllers: miniControllers().controllers, transport: t });
    expect(r.stopped).toBe('aborted');
    expect(r.turns).toBe(0);
  });

  it('an already-aborted signal stops before any request', async () => {
    const ac = new AbortController();
    ac.abort();
    const { t, calls } = scripted([reply('never sent')]);
    const r = await runAgent({
      ...base,
      controllers: miniControllers().controllers,
      transport: t,
      signal: ac.signal,
    });
    expect(r.stopped).toBe('aborted');
    expect(calls).toHaveLength(0);
  });

  it('unknown tools and bad args become clean tool results; the loop continues', async () => {
    const { t } = scripted([call('bogus_tool'), call('asm_set_source'), reply('fixed')]);
    const r = await runAgent({ ...base, controllers: miniControllers().controllers, transport: t });
    expect(r.stopped).toBe('reply');
    const toolMsgs = r.messages.filter((m) => m.role === 'tool') as Message[];
    expect(toolMsgs[0].tool_name).toBe('bogus_tool');
    expect(JSON.parse(toolMsgs[0].content).error).toContain('unknown tool');
    expect(JSON.parse(toolMsgs[1].content).error).toContain('"source"');
  });

  it('transport errors propagate for the panel to surface', async () => {
    const t: Transport = {
      post: async () => {
        throw new Error('fetch failed (CORS?)');
      },
    };
    await expect(
      runAgent({ ...base, controllers: miniControllers().controllers, transport: t }),
    ).rejects.toThrow('fetch failed (CORS?)');
  });
});
