import { describe, expect, it } from 'vitest';
import {
  MAX_MANUAL_DATA_BYTES,
  TOOL_SPECS,
  base64ToBytes,
  dispatchTool,
  hexToBytes,
} from '../src/agent/tools';
import type {
  AgentControllers,
  AsmController,
  GfxController,
  ToolResult,
  TrackController,
} from '../src/agent/types';

/** Recording mocks: canned values + a call log to assert controller usage. */
function mockControllers() {
  const rec: { fn: string; args: unknown[] }[] = [];
  const call = (fn: string, args: unknown[]) => rec.push({ fn, args });

  const sources = { src: 'RTI\n' };
  const files = new Map<string, Uint8Array>();
  const results = {
    assemble: { ok: true, byteCount: 12, errors: [] as { line: number; message: string }[] },
    buildRom: { ok: true, bytes: 262144 } as { ok: boolean; bytes?: number; error?: string },
    run: { ok: true } as { ok: boolean; error?: string },
    setCell: true,
    preview: { ok: true } as { ok: boolean; error?: string },
    stop: { ok: true } as { ok: boolean; error?: string },
  };

  const asm: AsmController = {
    getSource: () => sources.src,
    setSource: (s) => {
      sources.src = s;
      call('setSource', [s]);
    },
    appendSource: (t) => {
      sources.src += t;
      call('appendSource', [t]);
    },
    listDataFiles: () => [...files.entries()].map(([name, b]) => ({ name, bytes: b.length })),
    addDataFile: (n, b) => {
      files.set(n, b);
      call('addDataFile', [n, b.length]);
    },
    removeDataFile: (n) => {
      files.delete(n);
      call('removeDataFile', [n]);
    },
    assemble: () => results.assemble,
    buildRom: () => results.buildRom,
    run: () => results.run,
  };

  const gfx: GfxController = {
    getState: () => ({ mode: 0, tiles: 2, palette: 16, mapEntries: 1024 }),
    setPaletteColor: (i, r, g, b, t) => call('setPaletteColor', [i, r, g, b, t]),
    setTilePixel: (...a) => call('setTilePixel', a),
    fillTileRect: (...a) => call('fillTileRect', a),
    addTile: () => 7,
    setMapEntry: (...a) => call('setMapEntry', a),
    fillMap: (...a) => call('fillMap', a),
    setMapFromGrid: (...a) => call('setMapFromGrid', a),
    buildVram: () => new Uint8Array([0, 1, 2, 3]),
  };

  const track: TrackController = {
    getSong: () =>
      JSON.stringify({
        v: 1,
        name: 'Test Song',
        tempo: 8,
        orders: [0],
        patterns: [[[ [null, 0, 12], [81, 0, 12] ]]],
        instruments: [{ id: 0, name: 'Lead', baseFreq: 440, loop: false, sample: [] }],
      }),
    setCell: (...args: unknown[]) => {
      call('setCell', args);
      return results.setCell;
    },
    setPatternCells: (p, cells) => {
      call('setPatternCells', [p, cells.length]);
      return cells.length;
    },
    setTempo: (t) => call('setTempo', [t]),
    setOrders: (o) => call('setOrders', [o]),
    addPattern: () => 3,
    addInstrument: (k) => {
      call('addInstrument', [k]);
      return 1;
    },
    preview: () => results.preview,
    stop: () => results.stop,
    buildSpc: () => new Uint8Array([9, 9]),
    spcGlue: (n) => `; glue for ${n ?? 'spc.bin'}`,
    spcLayout: () => ({ start: 0x40 }),
  };

  const controllers: AgentControllers = { asm, gfx, track };
  return { controllers, rec, files, sources, results };
}

function dispatch(m: ReturnType<typeof mockControllers>, name: string, args: Record<string, unknown> = {}): ToolResult {
  return dispatchTool(name, args, { controllers: m.controllers });
}

function callTo(m: ReturnType<typeof mockControllers>, fn: string): unknown[] | undefined {
  return m.rec.filter((r) => r.fn === fn).at(-1)?.args;
}

// --- byte decoders -----------------------------------------------------------

describe('hexToBytes', () => {
  it('parses hex with separators and an 0x prefix', () => {
    expect(hexToBytes('00 01FF')).toEqual(new Uint8Array([0x00, 0x01, 0xff]));
    expect(hexToBytes('0x0102')).toEqual(new Uint8Array([0x01, 0x02]));
    expect(hexToBytes(':ab :cd')).toEqual(new Uint8Array([0xab, 0xcd]));
    expect(hexToBytes('ff.ff')).toEqual(new Uint8Array([0xff, 0xff]));
  });

  it('rejects odd-length and non-hex input', () => {
    expect(hexToBytes('abc')).toBeNull();
    expect(hexToBytes('zz')).toBeNull();
    expect(hexToBytes('')).toBeNull();
  });
});

describe('base64ToBytes', () => {
  it('decodes standard base64, with a data-URI prefix or whitespace', () => {
    expect(base64ToBytes('AAH/')).toEqual(new Uint8Array([0, 1, 0xff]));
    expect(base64ToBytes('data:application/octet-stream;base64,AAH/')).toEqual(new Uint8Array([0, 1, 0xff]));
    expect(base64ToBytes('AA\nH/ ')).toEqual(new Uint8Array([0, 1, 0xff]));
  });

  it('rejects invalid input', () => {
    expect(base64ToBytes('!!!')).toBeNull();
    expect(base64ToBytes('')).toBeNull();
    expect(base64ToBytes('AAA')).toBeNull(); // length % 4 !== 0
  });
});

// --- catalog shape -----------------------------------------------------------

describe('TOOL_SPECS', () => {
  it('has the 28 well-formed function specs', () => {
    expect(TOOL_SPECS).toHaveLength(28);
    for (const s of TOOL_SPECS) {
      expect(s.type).toBe('function');
      expect(s.function.name).toMatch(/^(asm|gfx|trk)_[a-z_]+$/);
      expect(s.function.description.length).toBeGreaterThan(10);
      expect(s.function.parameters).toMatchObject({ type: 'object' });
    }
  });

  it('covers the full catalog', () => {
    const names = TOOL_SPECS.map((s) => s.function.name);
    for (const expected of [
      'asm_get_source', 'asm_set_source', 'asm_append_source', 'asm_list_data_files',
      'asm_add_data_file', 'asm_remove_data_file', 'asm_assemble', 'asm_build_rom', 'asm_run',
      'gfx_get_state', 'gfx_set_palette_color', 'gfx_set_tile_pixel', 'gfx_fill_rect',
      'gfx_add_tile', 'gfx_set_map_entry', 'gfx_fill_map', 'gfx_set_map_grid', 'gfx_export_vram',
      'trk_get_song', 'trk_set_cell', 'trk_set_pattern', 'trk_set_tempo', 'trk_set_orders',
      'trk_add_pattern', 'trk_add_instrument', 'trk_preview', 'trk_stop', 'trk_export_spc',
    ]) {
      expect(names).toContain(expected);
    }
  });
});

// --- dispatch contract --------------------------------------------------------

describe('dispatch contract', () => {
  it('unknown tool → ok:false listing the available names', () => {
    const m = mockControllers();
    const r = dispatch(m, 'asm_fly');
    expect(r.ok).toBe(false);
    const body = JSON.parse(r.content) as { error: string; tools: string[] };
    expect(body.error).toContain('unknown tool');
    expect(body.tools).toHaveLength(28);
  });

  it('a throwing controller is caught and reported cleanly', () => {
    const m = mockControllers();
    m.controllers.gfx.getState = () => {
      throw new Error('boom');
    };
    const r = dispatch(m, 'gfx_get_state');
    expect(r.ok).toBe(false);
    expect(JSON.parse(r.content).error).toContain('boom');
  });

  it('never throws on empty args for a no-arg tool', () => {
    const m = mockControllers();
    expect(dispatch(m, 'asm_get_source').ok).toBe(true);
  });
});

// --- asm tools -----------------------------------------------------------------

describe('asm tools', () => {
  it('asm_get_source returns the current source', () => {
    const m = mockControllers();
    expect(dispatch(m, 'asm_get_source').content).toBe('RTI\n');
  });

  it('asm_set_source replaces the source; requires a string', () => {
    const m = mockControllers();
    const r = dispatch(m, 'asm_set_source', { source: 'RTI\n  rts' });
    expect(r.ok).toBe(true);
    expect(m.sources.src).toBe('RTI\n  rts');
    expect(dispatch(m, 'asm_set_source', { source: 42 }).ok).toBe(false);
    expect(dispatch(m, 'asm_set_source', {}).ok).toBe(false);
  });

  it('asm_append_source appends', () => {
    const m = mockControllers();
    expect(dispatch(m, 'asm_append_source', { text: 'nop' }).ok).toBe(true);
    expect(m.sources.src.endsWith('nop')).toBe(true);
    expect(dispatch(m, 'asm_append_source', { text: '' }).ok).toBe(false);
  });

  it('asm_list_data_files reflects the .incbin map', () => {
    const m = mockControllers();
    m.files.set('a.bin', new Uint8Array(3));
    expect(dispatch(m, 'asm_list_data_files').content).toContain('"name":"a.bin"');
  });

  it('asm_add_data_file stores hex or base64 bytes under the name', () => {
    const m = mockControllers();
    const r = dispatch(m, 'asm_add_data_file', { name: 'jump.bin', hex: '00 01 FF' });
    expect(r.ok).toBe(true);
    expect(m.files.get('jump.bin')).toEqual(new Uint8Array([0, 1, 0xff]));
    dispatch(m, 'asm_add_data_file', { name: 'b64.bin', base64: 'AAH/' });
    expect(m.files.get('b64.bin')).toEqual(new Uint8Array([0, 1, 0xff]));
  });

  it('asm_add_data_file rejects bad names, bad bytes, and oversized data', () => {
    const m = mockControllers();
    expect(dispatch(m, 'asm_add_data_file', { name: 'bad name', hex: '00' }).ok).toBe(false);
    expect(dispatch(m, 'asm_add_data_file', { name: 'x.bin' }).ok).toBe(false);
    expect(dispatch(m, 'asm_add_data_file', { name: 'x.bin', hex: 'zz' }).ok).toBe(false);
    const big = '00'.repeat(MAX_MANUAL_DATA_BYTES + 1);
    expect(dispatch(m, 'asm_add_data_file', { name: 'big.bin', hex: big }).ok).toBe(false);
    // Exactly the cap is allowed.
    expect(dispatch(m, 'asm_add_data_file', { name: 'cap.bin', hex: '00'.repeat(MAX_MANUAL_DATA_BYTES) }).ok).toBe(true);
  });

  it('asm_remove_data_file removes (and is harmless if absent)', () => {
    const m = mockControllers();
    m.files.set('a.bin', new Uint8Array(1));
    expect(dispatch(m, 'asm_remove_data_file', { name: 'a.bin' }).ok).toBe(true);
    expect(m.files.has('a.bin')).toBe(false);
    expect(dispatch(m, 'asm_remove_data_file', { name: 'ghost.bin' }).ok).toBe(true);
  });

  it('asm_assemble reports success with byteCount, or per-line errors', () => {
    const m = mockControllers();
    expect(JSON.parse(dispatch(m, 'asm_assemble').content)).toMatchObject({ ok: true, byteCount: 12 });
    m.results.assemble.ok = false;
    m.results.assemble.errors = [{ line: 3, message: 'bad opcode' }];
    const r = dispatch(m, 'asm_assemble');
    expect(r.ok).toBe(false);
    const body = JSON.parse(r.content) as { error: string; errors: unknown[] };
    expect(body.error).toContain('fix these diagnostics');
    expect(body.errors).toEqual([{ line: 3, message: 'bad opcode' }]);
  });

  it('asm_build_rom and asm_run surface controller failures', () => {
    const m = mockControllers();
    expect(dispatch(m, 'asm_build_rom').ok).toBe(true);
    m.results.buildRom.ok = false;
    m.results.buildRom.error = 'no assemble yet';
    expect(JSON.parse(dispatch(m, 'asm_build_rom').content).error).toContain('no assemble yet');
    m.results.run.ok = false;
    m.results.run.error = 'no rom';
    expect(dispatch(m, 'asm_run').ok).toBe(false);
  });
});

// --- gfx tools -----------------------------------------------------------------

describe('gfx tools', () => {
  it('gfx_get_state returns the snapshot', () => {
    const m = mockControllers();
    expect(JSON.parse(dispatch(m, 'gfx_get_state').content)).toMatchObject({ tiles: 2, mapEntries: 1024 });
  });

  it('gfx_set_palette_color passes 5-bit RGB through (transparent defaults false)', () => {
    const m = mockControllers();
    expect(dispatch(m, 'gfx_set_palette_color', { index: 1, r: 31, g: 0, b: 31 }).ok).toBe(true);
    expect(callTo(m, 'setPaletteColor')).toEqual([1, 31, 0, 31, false]);
    expect(dispatch(m, 'gfx_set_palette_color', { index: 0, r: 0, g: 0, b: 0, transparent: true }).ok).toBe(true);
    expect(callTo(m, 'setPaletteColor')).toEqual([0, 0, 0, 0, true]);
    expect(dispatch(m, 'gfx_set_palette_color', { index: 16, r: 0, g: 0, b: 0 }).ok).toBe(false);
  });

  it('gfx_set_tile_pixel validates the 16×16 tile bounds', () => {
    const m = mockControllers();
    expect(dispatch(m, 'gfx_set_tile_pixel', { tile: 3, row: 15, col: 15, color: 7 }).ok).toBe(true);
    expect(dispatch(m, 'gfx_set_tile_pixel', { tile: 3, row: 16, col: 0, color: 7 }).ok).toBe(false);
    expect(dispatch(m, 'gfx_set_tile_pixel', { tile: 3, row: 0, col: 0, color: 16 }).ok).toBe(false);
  });

  it('gfx_fill_rect normalizes inverted corners', () => {
    const m = mockControllers();
    expect(dispatch(m, 'gfx_fill_rect', { tile: 0, x0: 10, y0: 8, x1: 2, y1: 4, color: 3 }).ok).toBe(true);
    expect(callTo(m, 'fillTileRect')).toEqual([0, 2, 4, 10, 8, 3]);
  });

  it('gfx_add_tile returns the new index', () => {
    const m = mockControllers();
    expect(JSON.parse(dispatch(m, 'gfx_add_tile').content)).toEqual({ tile: 7 });
  });

  it('gfx_set_map_entry fills in palette/flag defaults', () => {
    const m = mockControllers();
    expect(dispatch(m, 'gfx_set_map_entry', { col: 5, row: 6, tile: 2 }).ok).toBe(true);
    expect(callTo(m, 'setMapEntry')).toEqual([
      5,
      6,
      { tile: 2, palette: 0, flipX: false, flipY: false, priority: false },
    ]);
    expect(dispatch(m, 'gfx_set_map_entry', { col: 32, row: 0, tile: 0 }).ok).toBe(false);
  });

  it('gfx_fill_map fills the whole SC0 map', () => {
    const m = mockControllers();
    expect(dispatch(m, 'gfx_fill_map', { tile: 1, palette: 2 }).ok).toBe(true);
    expect(callTo(m, 'fillMap')).toEqual([1, 2]);
  });

  it('gfx_set_map_grid validates a 32×32 tile grid', () => {
    const m = mockControllers();
    const r = dispatch(m, 'gfx_set_map_grid', { grid: [[1, 2, 3], [4, 5, 6]], palette: 1 });
    expect(r.ok).toBe(true);
    expect(callTo(m, 'setMapFromGrid')).toEqual([[[1, 2, 3], [4, 5, 6]], 1]);
    expect(JSON.parse(r.content)).toEqual({ rows: 2, cols: 3 });
    // Rejections.
    expect(dispatch(m, 'gfx_set_map_grid', { grid: [] }).ok).toBe(false);
    expect(dispatch(m, 'gfx_set_map_grid', { grid: [new Array(33).fill(0)] }).ok).toBe(false);
    expect(dispatch(m, 'gfx_set_map_grid', { grid: [[0, 5000]] }).ok).toBe(false);
    expect(dispatch(m, 'gfx_set_map_grid', { grid: Array.from({ length: 33 }, () => [0]) }).ok).toBe(false);
  });

  it('gfx_export_vram builds the image; with destName it registers on the asm page', () => {
    const m = mockControllers();
    const r = dispatch(m, 'gfx_export_vram');
    expect(JSON.parse(r.content)).toEqual({ bytes: 4 });
    expect(m.files.size).toBe(0);
    dispatch(m, 'gfx_export_vram', { destName: 'vram.bin' });
    expect(m.files.get('vram.bin')).toEqual(new Uint8Array([0, 1, 2, 3]));
    expect(dispatch(m, 'gfx_export_vram', { destName: 5 }).ok).toBe(false);
  });
});

// --- trk tools -----------------------------------------------------------------

describe('trk tools', () => {
  it('trk_get_song summarizes without the sample arrays', () => {
    const m = mockControllers();
    const body = JSON.parse(dispatch(m, 'trk_get_song').content) as Record<string, unknown>;
    expect(body).toMatchObject({
      name: 'Test Song',
      tempo: 8,
      orders: [0],
      patterns: 1,
      patternRows: [1],
      filledPerPattern: [1],
    });
    expect(body.instruments).toEqual([{ name: 'Lead', baseFreq: 440 }]);
  });

  it('trk_set_cell maps note names/numbers/rests and defaults inst/vol', () => {
    const m = mockControllers();
    dispatch(m, 'trk_set_cell', { pattern: 0, row: 1, channel: 2, note: 'A4' });
    expect(callTo(m, 'setCell')).toEqual([0, 1, 2, 81, 0, 12]);
    dispatch(m, 'trk_set_cell', { pattern: 0, row: 1, channel: 2, note: '--' });
    expect(callTo(m, 'setCell')).toEqual([0, 1, 2, null, 0, 12]);
    dispatch(m, 'trk_set_cell', { pattern: 0, row: 1, channel: 2, note: 85 });
    expect(callTo(m, 'setCell')).toEqual([0, 1, 2, 85, 0, 12]);
    // Rejections.
    expect(dispatch(m, 'trk_set_cell', { pattern: 0, row: 1, channel: 8 }).ok).toBe(false);
    expect(dispatch(m, 'trk_set_cell', { pattern: 0, row: 1, channel: 0, note: 'blue' }).ok).toBe(false);
    expect(dispatch(m, 'trk_set_cell', { pattern: 0, row: 1, channel: 0, vol: 16 }).ok).toBe(false);
    // Controller says "not applied" → ok:false.
    m.results.setCell = false;
    expect(dispatch(m, 'trk_set_cell', { pattern: 0, row: 1, channel: 0 }).ok).toBe(false);
  });

  it('trk_set_pattern validates every cell, with its index in the error', () => {
    const m = mockControllers();
    const cells = [
      { row: 0, channel: 0, note: 'A4' },
      { row: 2, channel: 1, note: 'C#5', vol: 15 },
      { row: 4, channel: 0 },
    ];
    const r = dispatch(m, 'trk_set_pattern', { pattern: 1, cells });
    expect(r.ok).toBe(true);
    expect(callTo(m, 'setPatternCells')).toEqual([1, 3]);
    expect(JSON.parse(r.content)).toEqual({ applied: 3, total: 3 });
    // A bad second cell → clean error naming cells[1].
    const bad = dispatch(m, 'trk_set_pattern', { pattern: 1, cells: [{ row: 0, channel: 0 }, { row: 0, channel: 9 }] });
    expect(bad.ok).toBe(false);
    expect(JSON.parse(bad.content).error).toContain('cells[1]');
    expect(dispatch(m, 'trk_set_pattern', { pattern: 1, cells: [] }).ok).toBe(false);
  });

  it('trk_set_tempo and trk_set_orders validate ranges', () => {
    const m = mockControllers();
    expect(dispatch(m, 'trk_set_tempo', { rowsPerSecond: 8 }).ok).toBe(true);
    expect(callTo(m, 'setTempo')).toEqual([8]);
    expect(dispatch(m, 'trk_set_tempo', { rowsPerSecond: 0 }).ok).toBe(false);
    expect(dispatch(m, 'trk_set_orders', { orders: [0, 2, 1] }).ok).toBe(true);
    expect(callTo(m, 'setOrders')).toEqual([[0, 2, 1]]);
    expect(dispatch(m, 'trk_set_orders', { orders: [] }).ok).toBe(false);
    expect(dispatch(m, 'trk_set_orders', { orders: ['x'] }).ok).toBe(false);
  });

  it('trk_add_pattern / trk_add_instrument', () => {
    const m = mockControllers();
    expect(JSON.parse(dispatch(m, 'trk_add_pattern').content)).toEqual({ pattern: 3 });
    expect(JSON.parse(dispatch(m, 'trk_add_instrument', { kind: 'bass' }).content)).toEqual({ inst: 1 });
    expect(dispatch(m, 'trk_add_instrument', { kind: 'sax' }).ok).toBe(false);
  });

  it('trk_preview / trk_stop', () => {
    const m = mockControllers();
    expect(dispatch(m, 'trk_preview').ok).toBe(true);
    m.results.preview = { ok: false, error: 'no AudioContext' };
    expect(JSON.parse(dispatch(m, 'trk_preview').content).error).toContain('no AudioContext');
    expect(dispatch(m, 'trk_stop').ok).toBe(true);
  });

  it('trk_export_spc registers the package AND appends the glue to the asm source', () => {
    const m = mockControllers();
    const before = m.sources.src.length;
    const r = dispatch(m, 'trk_export_spc', { destName: 'spc.bin' });
    const body = JSON.parse(r.content) as { bytes: number; dataFile: string; glueAppended: boolean; layout: unknown };
    expect(body).toMatchObject({ bytes: 2, dataFile: 'spc.bin', glueAppended: true, layout: { start: 0x40 } });
    expect(m.files.get('spc.bin')).toEqual(new Uint8Array([9, 9]));
    expect(m.sources.src.length).toBeGreaterThan(before);
    expect(m.sources.src).toContain('glue for spc.bin');
  });

  it('trk_export_spc without destName returns the glue as text', () => {
    const m = mockControllers();
    const r = dispatch(m, 'trk_export_spc');
    const body = JSON.parse(r.content) as { glue: string };
    expect(body.glue).toContain('glue for spc.bin');
    expect(m.files.size).toBe(0);
    expect(m.rec.filter((x) => x.fn === 'appendSource')).toHaveLength(0);
  });
});
