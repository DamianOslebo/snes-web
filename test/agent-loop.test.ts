import { describe, expect, it } from 'vitest';
import { classifyError, runAgent, type AgentEvent } from '../src/agent/loop';
import type { StreamChunk, Transport } from '../src/agent/ollama';
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
    getState: () => ({ mode: 0, tiles: 1, palette: 16, objPalette: 16, mapEntries: 1024, altMapEntries: 0, oamEntries: 0 }),
    setPaletteColor: () => {},
    setTilePixel: () => {},
    fillTileRect: () => {},
    addTile: () => 1,
    setMapEntry: () => {},
    fillMap: () => {},
    setMapFromGrid: () => {},
    setAltMapEntry: () => {},
    fillAltMap: () => {},
    setAltMapFromGrid: () => {},
    setOamEntry: () => {},
    clearOam: () => {},
    buildOam: () => new Uint8Array(512),
    oamGlue: () => ';oam glue',
    buildVram: () => new Uint8Array(4),
    buildVramCompact: () => ({ blob: new Uint8Array(4), blocks: [{ dest: 0, len: 2 }], mapBase: 0x1000, bgmode: 0 }),
    vramGlue: () => ';vram glue',
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
    get: async () => {
      throw new Error('scripted transport: get() should not be used by the loop');
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
    // The request streams (idle-timeout bounded) and carries NO native tools —
    // the system prompt is the first message and the tool contract lives there.
    const body = calls[0].body as { messages: Message[]; stream: boolean; tools?: unknown };
    expect(body.stream).toBe(true);
    expect('tools' in body).toBe(false);
    expect(body.messages[0].role).toBe('system');
    expect(calls[0].url).toBe('http://ollama.test/api/chat');
  });

  it('passes the `think` toggle to the request body (or omits it in auto mode)', async () => {
    const off = scripted([reply('done!')]);
    await runAgent({
      ...base,
      controllers: miniControllers().controllers,
      transport: off.t,
      think: false,
    });
    expect((off.calls[0].body as { think?: boolean }).think).toBe(false);

    const auto = scripted([reply('done!')]);
    await runAgent({ ...base, controllers: miniControllers().controllers, transport: auto.t });
    expect('think' in (auto.calls[0].body as Record<string, unknown>)).toBe(false);
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

  it('stops when the total step budget equals the batch limit (the old hard stop)', async () => {
    const { t, calls } = scripted([call('asm_get_source')]); // same tool call, forever
    const r = await runAgent({
      ...base,
      controllers: miniControllers().controllers,
      transport: t,
      maxTurns: 2,
      totalTurns: 2,
    });
    expect(r.stopped).toBe('max-turns');
    expect(r.turns).toBe(2);
    expect(calls).toHaveLength(2); // stops before a third model call
    const roles = r.messages.map((m) => m.role);
    expect(roles.filter((x) => x === 'assistant')).toHaveLength(2);
    expect(roles.filter((x) => x === 'tool')).toHaveLength(2);
  });

  it('auto-continues past the per-batch limit and finishes when the model completes', async () => {
    // Six tool steps (crossing two 2-step batches) then a final reply. Under
    // the old hard stop at maxTurns this would have required a manual
    // "continue" after step 2; now it runs straight through to the reply.
    const { t, calls } = scripted([
      call('gfx_add_tile'),
      call('gfx_set_map_entry', { col: 0, row: 0, tile: 0 }),
      call('asm_set_source', { source: 'RTI\n' }),
      call('asm_assemble'),
      call('asm_build_rom'),
      call('asm_run'),
      reply('done'),
    ]);
    const r = await runAgent({
      ...base,
      controllers: miniControllers().controllers,
      transport: t,
      maxTurns: 2,
      totalTurns: 50,
    });
    expect(r.stopped).toBe('reply');
    expect(r.turns).toBe(6); // all six tool steps ran, not just the first 2
    expect(calls).toHaveLength(7); // six tool steps + the final reply
    // A checkpoint nudge (a user message that is not the original prompt) was
    // injected between the batches so the model kept going on its own.
    const nudges = r.messages.filter((m) => m.role === 'user' && m.content !== 'make a block game');
    expect(nudges.length).toBe(3); // batch boundaries after steps 2, 4, and 6
    expect(nudges.every((m) => typeof m.content === 'string' && m.content.includes('checkpoint'))).toBe(true);
  });

  it('stops at the total step budget when the model keeps acting (the safety valve)', async () => {
    // The model keeps acting (no final reply) and every step is DIFFERENT
    // (unique args → a distinct spin signature, so spin-detection never trips).
    // The ONLY thing that can end this run is the total step budget.
    let n = 0;
    const t: Transport = {
      post: async () => call('gfx_add_tile', { tile: n++ }),
      get: async () => {
        throw new Error('unexpected get()');
      },
    };
    const r = await runAgent({
      ...base,
      controllers: miniControllers().controllers,
      transport: t,
      maxTurns: 3,
      totalTurns: 6,
    });
    expect(r.stopped).toBe('max-turns');
    expect(r.turns).toBe(6); // 2 auto-continued batches of 3, then the total budget
  });

  it('still stops on a spin even at a checkpoint (never auto-continues a loop)', async () => {
    // The same call + result forever: with maxTurns:3 the spin fires on the
    // very step that is also a checkpoint boundary — spin must win, and the
    // run must NOT be auto-continued into more spinning.
    const { t, calls } = scripted([call('asm_get_source')]);
    const r = await runAgent({
      ...base,
      controllers: miniControllers().controllers,
      transport: t,
      maxTurns: 3,
      totalTurns: 100,
    });
    expect(r.stopped).toBe('loop');
    expect(r.turns).toBe(3); // 3 identical steps trip the spin check
    expect(calls).toHaveLength(3);
  });

  it('an aborted in-flight request becomes stopped:"aborted" (no throw)', async () => {
    const t: Transport = {
      post: async () => {
        const err = new Error('aborted');
        err.name = 'AbortError';
        throw err;
      },
      get: async () => {
        throw new Error('unexpected get()');
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
      get: async () => {
        throw new Error('unexpected get()');
      },
    };
    await expect(
      runAgent({ ...base, controllers: miniControllers().controllers, transport: t, retryDelayMs: 0 }),
    ).rejects.toThrow('fetch failed (CORS?)');
  });

  it('retries a failed model call and recovers on the next attempt', async () => {
    // First attempt throws (e.g. Ollama 500), second succeeds — the loop should
    // not surface the error, and should not have dispatched any tools for it.
    let attempts = 0;
    const t: Transport = {
      post: async () => {
        attempts += 1;
        if (attempts === 1) throw new Error('XML syntax error on line 3');
        return reply('recovered');
      },
      get: async () => {
        throw new Error('unexpected get()');
      },
    };
    const { controllers, log } = miniControllers();
    const r = await runAgent({ ...base, controllers, transport: t, retryDelayMs: 0 });
    expect(attempts).toBe(2);
    expect(r.stopped).toBe('reply');
    expect(r.finalContent).toBe('recovered');
    expect(log).toEqual([]); // no tools ran against the failed attempt
  });

  it('propagates after all retries are exhausted', async () => {
    let attempts = 0;
    const t: Transport = {
      post: async () => {
        attempts += 1;
        throw new Error('always fails');
      },
      get: async () => {
        throw new Error('unexpected get()');
      },
    };
    await expect(
      runAgent({ ...base, controllers: miniControllers().controllers, transport: t, retries: 2, retryDelayMs: 0 }),
    ).rejects.toThrow('always fails');
    expect(attempts).toBe(3); // 1 original + 2 retries
  });

  it('does not retry an aborted request', async () => {
    const ac = new AbortController();
    const abortErr = () => {
      const e = new Error('aborted');
      e.name = 'AbortError';
      return e;
    };
    let attempts = 0;
    const t: Transport = {
      post: async () => {
        attempts += 1;
        ac.abort();
        throw abortErr();
      },
      get: async () => {
        throw new Error('unexpected get()');
      },
    };
    const r = await runAgent({
      ...base,
      controllers: miniControllers().controllers,
      transport: t,
      signal: ac.signal,
      retryDelayMs: 0,
    });
    expect(attempts).toBe(1);
    expect(r.stopped).toBe('aborted');
  });

  it('reports total + per-step metrics (a plain reply is one model step)', async () => {
    const { t } = scripted([reply('done!')]);
    const r = await runAgent({ ...base, controllers: miniControllers().controllers, transport: t, retryDelayMs: 0 });
    expect(r.totalMs).toBeGreaterThanOrEqual(0);
    expect(r.perStep).toHaveLength(1);
    expect(r.perStep[0]).toMatchObject({ index: 0, toolCalls: 0, retries: 0, retryErrors: [] });
    expect(r.perStep[0].modelMs).toBeGreaterThanOrEqual(0);
  });

  it('records one per-step entry for every model step, tool-calling and final', async () => {
    const { t } = scripted([
      call('asm_set_source', { source: 'RTI\n  rts' }),
      call('asm_assemble', {}),
      reply('built it'),
    ]);
    const r = await runAgent({ ...base, controllers: miniControllers().controllers, transport: t, retryDelayMs: 0 });
    expect(r.turns).toBe(2);
    expect(r.perStep).toHaveLength(3);
    expect(r.perStep.map((s) => s.index)).toEqual([0, 1, 2]);
    expect(r.perStep.map((s) => s.toolCalls)).toEqual([1, 1, 0]);
  });

  it('captures the retry error(s) on a step that recovered', async () => {
    let attempts = 0;
    const t: Transport = {
      post: async () => {
        attempts += 1;
        if (attempts === 1) throw new Error('XML syntax error on line 3');
        return reply('recovered');
      },
      get: async () => {
        throw new Error('unexpected get()');
      },
    };
    const r = await runAgent({ ...base, controllers: miniControllers().controllers, transport: t, retryDelayMs: 0 });
    expect(r.stopped).toBe('reply');
    expect(r.perStep).toHaveLength(1);
    expect(r.perStep[0].retries).toBe(1);
    expect(r.perStep[0].retryErrors).toHaveLength(1);
    expect(r.perStep[0].retryErrors[0]).toContain('XML syntax error');
  });
});

/** An `Error` carrying an HTTP status, like `httpError` in ollama.ts. */
function withStatus(message: string, status: number): Error {
  const e = new Error(message) as Error & { status?: number };
  e.status = status;
  return e;
}

describe('classifyError', () => {
  it('context-overflow text wins, even on a 400', () => {
    expect(classifyError(new Error('context length exceeded'))).toBe('context');
    expect(classifyError(new Error('prompt is too long'))).toBe('context');
    expect(classifyError(withStatus('prompt length exceeds the limit', 400))).toBe('context');
  });

  it('4xx is permanent, except 408 and 429', () => {
    expect(classifyError(withStatus('model "nope" not found', 404))).toBe('permanent');
    expect(classifyError(withStatus('bad request body', 400))).toBe('permanent');
    expect(classifyError(withStatus('gateway timed out', 408))).toBe('retryable');
    expect(classifyError(withStatus('rate limited', 429))).toBe('retryable');
  });

  it('5xx, network failures and timeouts are retryable', () => {
    expect(classifyError(withStatus('internal error', 500))).toBe('retryable');
    expect(classifyError(new Error('fetch failed (CORS?)'))).toBe('retryable');
    const t = new Error('signal is aborted due to timeout') as Error & { name?: string };
    t.name = 'TimeoutError';
    expect(classifyError(t)).toBe('retryable');
  });
});

describe('failure classification in the loop', () => {
  it('a permanent 4xx fails fast — the retry budget is not burned', async () => {
    let attempts = 0;
    const t: Transport = {
      post: async () => {
        attempts += 1;
        throw withStatus('model "nope" not found', 404);
      },
      get: async () => {
        throw new Error('unexpected get()');
      },
    };
    await expect(
      runAgent({ ...base, controllers: miniControllers().controllers, transport: t, retries: 10, retryDelayMs: 0 }),
    ).rejects.toThrow(/ollama pull test-model/);
    expect(attempts).toBe(1);
  });

  it('still retries 5xx and 429 — the next sample often fixes them', async () => {
    let attempts = 0;
    const t: Transport = {
      post: async () => {
        attempts += 1;
        throw withStatus('server hiccup', attempts === 1 ? 500 : 429);
      },
      get: async () => {
        throw new Error('unexpected get()');
      },
    };
    await expect(
      runAgent({ ...base, controllers: miniControllers().controllers, transport: t, retries: 2, retryDelayMs: 0 }),
    ).rejects.toThrow('server hiccup');
    expect(attempts).toBe(3); // 1 + 2 retries — neither permanent
  });

  it('trims the conversation on a context rejection, then recovers', async () => {
    const history: Message[] = [];
    for (let i = 0; i < 30; i++) {
      history.push({ role: 'user', content: `old question ${i}` });
      history.push({ role: 'assistant', content: `old answer ${i}` });
    }
    let attempts = 0;
    const bodies: { messages: Message[] }[] = [];
    const t: Transport = {
      post: async (_url, body) => {
        attempts += 1;
        bodies.push(body as { messages: Message[] });
        if (attempts === 1) throw new Error('context length exceeded');
        return reply('fits now');
      },
      get: async () => {
        throw new Error('unexpected get()');
      },
    };
    const r = await runAgent({
      ...base,
      messages: history,
      controllers: miniControllers().controllers,
      transport: t,
      retryDelayMs: 0,
    });
    expect(r.stopped).toBe('reply');
    expect(r.finalContent).toBe('fits now');
    // The re-sent request is strictly shorter, still starts with the system
    // prompt, and does not begin with a dangling tool result.
    expect(bodies[1].messages.length).toBeLessThan(bodies[0].messages.length);
    expect(bodies[1].messages[0].role).toBe('system');
    expect(bodies[1].messages[1].role).not.toBe('tool');
  });

  it('gives up on a context failure after the trim rounds, with an actionable error', async () => {
    let attempts = 0;
    const t: Transport = {
      post: async () => {
        attempts += 1;
        throw new Error('context length exceeded');
      },
      get: async () => {
        throw new Error('unexpected get()');
      },
    };
    await expect(
      runAgent({ ...base, controllers: miniControllers().controllers, transport: t, retryDelayMs: 0 }),
    ).rejects.toThrow(/context window/i);
    expect(attempts).toBe(4); // original + one attempt per trim tail (8 → 4 → 2)
  });

  it('a request timeout is retryable, never a user abort', async () => {
    let attempts = 0;
    const t: Transport = {
      post: async () => {
        attempts += 1;
        if (attempts === 1) {
          const e = new Error('signal is aborted due to timeout') as Error & { name?: string };
          e.name = 'TimeoutError';
          throw e;
        }
        return reply('recovered');
      },
      get: async () => {
        throw new Error('unexpected get()');
      },
    };
    const r = await runAgent({ ...base, controllers: miniControllers().controllers, transport: t, retryDelayMs: 0 });
    expect(attempts).toBe(2);
    expect(r.stopped).toBe('reply');
    expect(r.finalContent).toBe('recovered');
  });

  it('an abort during the retry delay ends the run without waiting out the sleep', async () => {
    const ac = new AbortController();
    let attempts = 0;
    const t: Transport = {
      post: async (_url, _body, signal) => {
        attempts += 1;
        if (signal?.aborted) {
          const e = new Error('aborted') as Error & { name?: string };
          e.name = 'AbortError';
          throw e;
        }
        if (attempts === 1) {
          setTimeout(() => ac.abort(), 30);
          throw new Error('fail once');
        }
        return reply('late');
      },
      get: async () => {
        throw new Error('unexpected get()');
      },
    };
    const started = Date.now();
    const r = await runAgent({
      ...base,
      controllers: miniControllers().controllers,
      transport: t,
      signal: ac.signal,
      retries: 5,
      retryDelayMs: 2000, // long sleep — the abort must cut it short
    });
    expect(r.stopped).toBe('aborted');
    expect(attempts).toBe(2);
    expect(Date.now() - started).toBeLessThan(1500);
  });
});

describe('spin detection', () => {
  it('breaks three identical steps with stopped:"loop" and a visible note', async () => {
    const { t, calls } = scripted([call('asm_get_source')]); // same call + same result, forever
    const events: AgentEvent[] = [];
    const r = await runAgent({
      ...base,
      controllers: miniControllers().controllers,
      transport: t,
      retryDelayMs: 0,
      onEvent: (e) => events.push(e),
    });
    expect(r.stopped).toBe('loop');
    expect(r.turns).toBe(3); // the third identical step is taken, then it stops
    expect(calls).toHaveLength(3);
    expect(r.finalContent).toMatch(/not making progress/i);
    // The explanation was shown as a message, not just returned.
    const note = events.find((e) => e.type === 'message');
    expect(note).toMatchObject({ type: 'message' });
    expect((note as { content: string }).content).toMatch(/not making progress/i);
    // …and the wire history ends with a nudge so a "continue" carries the reason.
    const last = r.messages[r.messages.length - 1];
    expect(last.role).toBe('user');
    expect(last.content).toMatch(/do not repeat/i);
  });

  it('breaks an A-B-A-B cycle with identical results', async () => {
    const A = call('asm_set_source', { source: 'RTI\n  rts' });
    const B = call('asm_assemble', {});
    let i = 0;
    const t: Transport = {
      post: async () => [A, B, A, B][Math.min(i++, 3)], // a true alternating cycle
      get: async () => {
        throw new Error('unexpected get()');
      },
    };
    const r = await runAgent({ ...base, controllers: miniControllers().controllers, transport: t, retryDelayMs: 0 });
    expect(r.stopped).toBe('loop');
    expect(r.turns).toBe(4);
  });

  it('does NOT trip on repeated calls that change their result', async () => {
    // A model legitimately appending source twice: different args → different
    // signature → no spin, and it can finish with a normal reply.
    const { t } = scripted([
      call('asm_append_source', { text: '  LDA #$00' }),
      call('asm_append_source', { text: '  STA $20' }),
      reply('done'),
    ]);
    const r = await runAgent({ ...base, controllers: miniControllers().controllers, transport: t, retryDelayMs: 0 });
    expect(r.stopped).toBe('reply');
    expect(r.finalContent).toBe('done');
  });
});

describe('the structured tool protocol (JSON in the reply text)', () => {
  it('dispatches a tool call emitted as JSON in the reply text', async () => {
    const { controllers, log } = miniControllers();
    const { t } = scripted([
      reply('{"tool":"asm_set_source","args":{"source":"RTI"}}'),
      reply('{"tool":"asm_assemble","args":{}}'),
      reply('built it'),
    ]);
    const r = await runAgent({ ...base, controllers, transport: t, retryDelayMs: 0 });
    expect(r.stopped).toBe('reply');
    expect(r.turns).toBe(2);
    expect(log).toContain('setSource:RTI');
    const toolMsgs = r.messages.filter((m) => m.role === 'tool') as Message[];
    expect(toolMsgs.map((m) => m.tool_name)).toEqual(['asm_set_source', 'asm_assemble']);
    // The JSON-in-text reply is NOT the final answer — a real reply ends the run.
    expect(r.finalContent).toBe('built it');
  });

  it('dispatches a JSON ARRAY of calls in order (parallel tools in one step)', async () => {
    const { controllers } = miniControllers();
    const { t } = scripted([
      reply('[{"tool":"asm_get_source","args":{}},{"tool":"asm_assemble","args":{}}]'),
      reply('done'),
    ]);
    const r = await runAgent({ ...base, controllers, transport: t, retryDelayMs: 0 });
    expect(r.stopped).toBe('reply');
    expect(r.turns).toBe(1);
    const toolMsgs = r.messages.filter((m) => m.role === 'tool') as Message[];
    expect(toolMsgs.map((m) => m.tool_name)).toEqual(['asm_get_source', 'asm_assemble']);
  });

  it('tolerates a markdown-fenced tool call (models love to wrap JSON)', async () => {
    const { controllers } = miniControllers();
    const { t } = scripted([
      reply('```json\n{"tool":"asm_assemble","args":{}}\n```'),
      reply('assembled'),
    ]);
    const r = await runAgent({ ...base, controllers, transport: t, retryDelayMs: 0 });
    expect(r.stopped).toBe('reply');
    expect(r.finalContent).toBe('assembled');
    const toolMsgs = r.messages.filter((m) => m.role === 'tool') as Message[];
    expect(toolMsgs.map((m) => m.tool_name)).toEqual(['asm_assemble']);
  });
});

describe('malformed tool attempts (strong intent, nothing parsed)', () => {
  const MALFORMED = '{"tool":"asm_assemble","args":{'; // a "tool": …, but truncated JSON

  it('nudges a malformed attempt back to the exact contract, then recovers', async () => {
    const { controllers } = miniControllers();
    const { t } = scripted([
      reply(MALFORMED),
      reply('{"tool":"asm_assemble","args":{}}'),
      reply('recovered'),
    ]);
    const r = await runAgent({ ...base, controllers, transport: t, retryDelayMs: 0 });
    expect(r.stopped).toBe('reply');
    expect(r.finalContent).toBe('recovered');
    // The model got a nudge restating the exact JSON shape before it recovered.
    expect(r.messages.some((m) => m.role === 'user' && /did not parse/i.test(m.content))).toBe(true);
    // And it eventually dispatched the call it meant to make.
    const toolMsgs = r.messages.filter((m) => m.role === 'tool') as Message[];
    expect(toolMsgs.some((m) => m.tool_name === 'asm_assemble')).toBe(true);
  });

  it('stops after repeated malformed attempts — bounded, with a visible note', async () => {
    const { controllers } = miniControllers();
    const { t, calls } = scripted([reply(MALFORMED)]); // the same broken attempt, forever
    const events: AgentEvent[] = [];
    const r = await runAgent({
      ...base,
      controllers,
      transport: t,
      retryDelayMs: 0,
      onEvent: (e) => events.push(e),
    });
    expect(r.stopped).toBe('reply');
    expect(r.finalContent).toMatch(/did not parse/i);
    // Nudged a bounded number of times (not infinite), then stopped.
    expect(calls.length).toBeLessThanOrEqual(6);
    // The stop note was shown as a message, not just returned.
    expect(events.some((e) => e.type === 'message' && /did not parse/i.test((e as { content: string }).content))).toBe(true);
  });
});

describe('empty replies', () => {
  it('nudges an empty reply once, then stops with a visible note on a second', async () => {
    const { t } = scripted([reply(''), reply('')]);
    const r = await runAgent({ ...base, controllers: miniControllers().controllers, transport: t, retryDelayMs: 0 });
    expect(r.stopped).toBe('reply');
    expect(r.finalContent).toMatch(/empty/i);
    // The model got exactly one nudge before the run ended.
    const nudges = r.messages.filter((m) => m.role === 'user' && /empty/i.test(m.content));
    expect(nudges).toHaveLength(1);
  });

  it('recovers when the model answers after the nudge', async () => {
    const { t } = scripted([reply(''), reply('built it')]);
    const r = await runAgent({ ...base, controllers: miniControllers().controllers, transport: t, retryDelayMs: 0 });
    expect(r.stopped).toBe('reply');
    expect(r.finalContent).toBe('built it');
    expect(r.messages.some((m) => m.role === 'user' && /empty/i.test(m.content))).toBe(true);
  });
});

describe('narration stalls (intent text, no tool call)', () => {
  it('does not end the run on "I\'ll do X" — nudges once, the model then acts', async () => {
    // The field-log failure: the model says "Now I'll build the letter tiles"
    // with NO tool call, and the old loop treated that as a final reply
    // (turns:0), forcing the user to type "continue".
    const { t } = scripted([
      reply("Now I'll build the letter tiles. Let me start by creating the blank tile and the letter tiles."),
      call('gfx_add_tile', { tile: 0 }),
      call('gfx_set_map_entry', { x: 0, y: 0, tile: 1 }),
      reply('The ROM is built and running. Done!'),
    ]);
    const events: AgentEvent[] = [];
    const r = await runAgent({
      ...base,
      controllers: miniControllers().controllers,
      transport: t,
      retryDelayMs: 0,
      onEvent: (e) => events.push(e),
    });
    expect(r.stopped).toBe('reply');
    expect(r.turns).toBe(2); // it went on to ACT, instead of stopping at 0
    expect(r.finalContent).toBe('The ROM is built and running. Done!');
    // Exactly one "go do it" nudge was left in the wire history.
    const nudges = r.messages.filter((m) => m.role === 'user' && /nothing actually happened yet/i.test(m.content));
    expect(nudges).toHaveLength(1);
    // The model's narration was still shown to the user (not swallowed).
    expect(events.some((e) => e.type === 'message' && /Now I'll build the letter tiles/.test((e as { content: string }).content))).toBe(true);
  });

  it('stops after a second consecutive stall, with a visible note', async () => {
    const { t } = scripted([
      reply("I'll build the letter tiles now."),
      reply('Let me create them. I\'ll start with the H glyph.'),
    ]);
    const r = await runAgent({ ...base, controllers: miniControllers().controllers, transport: t, retryDelayMs: 0 });
    expect(r.stopped).toBe('reply');
    expect(r.finalContent).toMatch(/did not call a tool/i);
    // One nudge, then the stop — bounded, no infinite ping-pong.
    const nudges = r.messages.filter((m) => m.role === 'user' && /nothing actually happened yet/i.test(m.content));
    expect(nudges).toHaveLength(1);
    // A "continue" carries the reason, not just the word.
    expect(r.messages.some((m) => m.role === 'user' && /do not just describe it again/i.test(m.content))).toBe(true);
  });

  it('resets the stall streak after the model acts (each narration episode gets one nudge)', async () => {
    const { t } = scripted([
      reply("I'll build the letter tiles now."),
      call('gfx_add_tile', { tile: 1 }),
      reply('Tiles set. Now I\'ll place them on the tilemap.'),
      call('gfx_set_map_entry', { x: 0, y: 0, tile: 1 }),
      reply('The ROM is built and running. Done!'),
    ]);
    const r = await runAgent({ ...base, controllers: miniControllers().controllers, transport: t, retryDelayMs: 0 });
    expect(r.stopped).toBe('reply');
    expect(r.turns).toBe(2);
    expect(r.finalContent).toBe('The ROM is built and running. Done!');
    // BOTH narrations were nudged (not stopped), because a tool call ran in
    // between — the streak is per-consecutive-episode, not once per run.
    const nudges = r.messages.filter((m) => m.role === 'user' && /nothing actually happened yet/i.test(m.content));
    expect(nudges).toHaveLength(2);
  });
});

describe('truncated tool calls (a reply cut off mid-JSON)', () => {
  it('a fragment like `[{"` (no "tool": keyword yet) is NUDGED, not a terminal reply', async () => {
    // The field log: runs ended stopped:'reply' with the final assistant text
    // being `[{"` — a streamed tool call cut off before any keyword arrived.
    // The unbalanced opening bracket is now the "it tried to call a tool"
    // marker, so the loop asks for a valid call and KEEPS GOING instead of
    // stopping on the fragment (which forced the user to type "continue").
    const { t } = scripted([
      reply('[{"'),
      call('gfx_add_tile', { tile: 0 }),
      reply('The ROM is built. Done.'),
    ]);
    const r = await runAgent({
      ...base,
      controllers: miniControllers().controllers,
      transport: t,
      retryDelayMs: 0,
    });
    expect(r.stopped).toBe('reply');
    expect(r.turns).toBe(1); // it went on to ACT, instead of stopping on the fragment
    expect(r.finalContent).toBe('The ROM is built. Done.');
    // The malformed-call nudge ("did not parse") was left in the wire history.
    expect(r.messages.some((m) => m.role === 'user' && /did not parse/i.test(m.content))).toBe(true);
  });

  it('a stream that ends WITHOUT the done chunk is RETRIED, never a final reply', async () => {
    // The transport-level failure: the tunnel drops the tail of the response,
    // the body stream ends cleanly (no network error) but WITHOUT Ollama's
    // `done` chunk, leaving a half tool-call (`[{"tool":"gfx_add`). That is a
    // retryable step failure — the loop re-sends and the run completes — not
    // an accepted answer that ends the run.
    let attempt = 0;
    const t: Transport = {
      post: async () => {
        throw new Error('test: post should not be used (postStream present)');
      },
      get: async () => {
        throw new Error('test: get not used here');
      },
      postStream: async (_url, _body, onChunk) => {
        attempt += 1;
        if (attempt === 1) {
          onChunk({ content: '[{"tool":"gfx_add' } as StreamChunk); // tail dropped — no done
        } else if (attempt === 2) {
          onChunk({ content: '{"tool":"gfx_add_tile","args":{"tile":0}}' } as StreamChunk);
          onChunk({ done: true } as StreamChunk);
        } else {
          onChunk({ content: 'The ROM is built. Done.' } as StreamChunk);
          onChunk({ done: true } as StreamChunk);
        }
      },
    };
    const r = await runAgent({
      ...base,
      controllers: miniControllers().controllers,
      transport: t,
      retryDelayMs: 0,
    });
    expect(r.stopped).toBe('reply');
    expect(r.turns).toBe(1);
    expect(r.finalContent).toBe('The ROM is built. Done.');
    expect(attempt).toBe(3);
    // The truncated first attempt was RECOVERED as a retry on the same step.
    expect(r.perStep[0].retries).toBe(1);
    expect(r.perStep[0].retryErrors.join(' ')).toMatch(/done|cut short/i);
  });

  it('still stops cleanly on a second truncated fragment (bounded, not a loop)', async () => {
    // If the model genuinely keeps emitting broken JSON (a complete stream —
    // done chunk present — with unbalanced brackets), the malformed path
    // nudges a bounded number of times and then stops with a visible note,
    // exactly like any other malformed-call episode.
    const { t } = scripted([reply('[{"'), reply('[{"')]);
    const r = await runAgent({
      ...base,
      controllers: miniControllers().controllers,
      transport: t,
      retryDelayMs: 0,
    });
    expect(r.stopped).toBe('reply');
    expect(r.turns).toBe(0);
    expect(r.finalContent).toMatch(/did not parse/i);
  });
});
