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
  EmuProbeController,
  EmuProbeResult,
  GfxController,
  ToolResult,
  TrackController,
} from '../src/agent/types';
import type { FrameSummary } from '../src/agent/frame';

/** Recording mocks: canned values + a call log to assert controller usage. */
function mockControllers() {
  const rec: { fn: string; args: unknown[] }[] = [];
  const call = (fn: string, args: unknown[]) => rec.push({ fn, args });

  const sources = { src: 'RTI\n' };
  const files = new Map<string, Uint8Array>();
  const results = {
    assemble: { ok: true, byteCount: 12, errors: [] as { line: number; message: string }[] },
    buildRom: { ok: true, bytes: 262144 } as { ok: boolean; bytes?: number; error?: string },
    buildRomBytes: { ok: true, bytes: new Uint8Array(256) } as { ok: boolean; bytes?: Uint8Array; error?: string },
    run: { ok: true } as { ok: boolean; error?: string },
    setCell: true,
    preview: { ok: true } as { ok: boolean; error?: string },
    stop: { ok: true } as { ok: boolean; error?: string },
    // Overridable per-test probe outcome (see the emu_probe tests below).
    probe: {
      ok: true,
      core: 'test-core',
      isMock: false,
      frames: 3,
      screen: {
        width: 256, height: 224, background: [0, 0, 0, 0], backgroundCount: 55300,
        contentRatio: 0.0125, contentBbox: { x0: 100, y0: 100, x1: 155, y1: 123 },
        topColors: [{ color: [0, 0, 0, 0], count: 55300 }, { color: [255, 0, 0, 0], count: 700 }],
        isSolid: false, isSolidBlack: false, grid: [], gridCols: 32, gridRows: 28,
      },
    } as EmuProbeResult,
  };

  // Overridable per-test export blobs. Defaults are tiny, so the fallback rule
  // always takes the RAW path unless a test swaps in a large/compressible blob.
  const blobs = {
    vram: new Uint8Array([0, 1, 2, 3]),
    spc: new Uint8Array([9, 9]),
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
    setHighBank: (b) => {
      call('setHighBank', [b ? b.length : null]);
    },
    getHighBank: () => {
      call('getHighBank', []);
      return null;
    },
    assemble: () => results.assemble,
    buildRom: () => results.buildRom,
    buildRomBytes: () => results.buildRomBytes,
    run: () => results.run,
  };

  const gfx: GfxController = {
    getState: () => ({ mode: 0, tiles: 2, palette: 16, objPalette: 16, mapEntries: 1024, altMapEntries: 0, oamEntries: 1 }),
    setPaletteColor: (i, r, g, b, t) => call('setPaletteColor', [i, r, g, b, t]),
    setTilePixel: (...a) => call('setTilePixel', a),
    fillTileRect: (...a) => call('fillTileRect', a),
    addTile: () => 7,
    setMapEntry: (...a) => call('setMapEntry', a),
    fillMap: (...a) => call('fillMap', a),
    setMapFromGrid: (...a) => call('setMapFromGrid', a),
    setAltMapEntry: (...a) => call('setAltMapEntry', a),
    fillAltMap: (...a) => call('fillAltMap', a),
    setAltMapFromGrid: (...a) => call('setAltMapFromGrid', a),
    setOamEntry: (...a) => call('setOamEntry', a),
    clearOam: () => call('clearOam', []),
    buildOam: () => {
      const b = new Uint8Array(512);
      b.fill(0xab);
      return b;
    },
    oamGlue: (n, size) =>
      `; oam glue for ${n ?? 'oam.bin'} (${size ?? '16x16'})\noam_load:\n  rts\nspr_init:\n  rts\nspr_move:\n  rts`,
    buildVram: () => new Uint8Array([0, 1, 2, 3]),
    buildVramCompact: () => ({
      blob: blobs.vram,
      blocks: [{ dest: 0, len: 2 }],
      mapBase: 0x1000,
      bgmode: 0,
    }),
    vramGlue: (n) => `; vram glue for ${n ?? 'vram.bin'}`,
    vramGlueLz: (n) => `; vram glue lz for ${n ?? 'vram.bin'}`,
    setScroll: (dx, dy) => {
      call('setScroll', [dx, dy]);
    },
    getScroll: () => {
      call('getScroll', []);
      return null;
    },
    setSpriteAnim: (cfg) => {
      call('setSpriteAnim', [cfg]);
    },
    getSpriteAnim: () => {
      call('getSpriteAnim', []);
      return null;
    },
    setMode7: (cfg) => {
      call('setMode7', [cfg]);
    },
    getMode7: () => {
      call('getMode7', []);
      return null;
    },
    setBgTileAnim: (cfg) => {
      call('setBgTileAnim', [cfg]);
    },
    getBgTileAnim: () => {
      call('getBgTileAnim', []);
      return null;
    },
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
    buildSpc: () => blobs.spc,
    spcGlue: (n) => `; glue for ${n ?? 'spc.bin'}`,
    spcGlueLz: (n) => `; glue lz for ${n ?? 'spc.bin'}`,
    spcLayout: () => ({ start: 0x40 }),
  };

  const emu: EmuProbeController = {
    probe: (opts) => {
      call('probe', [opts]);
      return Promise.resolve(results.probe);
    },
  };

  const controllers: AgentControllers = { asm, gfx, track, emu };
  return { controllers, rec, files, sources, results, blobs };
}

function dispatch(m: ReturnType<typeof mockControllers>, name: string, args: Record<string, unknown> = {}): ToolResult {
  // `dispatchTool` returns `ToolResult | Promise<ToolResult>` (async tools);
  // the sync tools used through this helper always resolve immediately.
  return dispatchTool(name, args, { controllers: m.controllers }) as ToolResult;
}

async function dispatchAsync(m: ReturnType<typeof mockControllers>, name: string, args: Record<string, unknown> = {}): Promise<ToolResult> {
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
  it('has the 39 well-formed function specs', () => {
    expect(TOOL_SPECS).toHaveLength(39);
    for (const s of TOOL_SPECS) {
      expect(s.type).toBe('function');
      expect(s.function.name).toMatch(/^(asm|gfx|trk|emu)_[a-z0-9_]+$/);
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
      'gfx_add_tile', 'gfx_set_map_entry', 'gfx_fill_map', 'gfx_set_map_grid',
      'gfx_set_alt_map_entry', 'gfx_fill_alt_map', 'gfx_set_alt_map_grid',
      'gfx_set_oam_entry', 'gfx_clear_oam', 'gfx_export_vram', 'gfx_export_oam', 'gfx_set_scroll',
      'gfx_sprite_anim', 'gfx_bg_mode7', 'gfx_bg_tile_anim',
      'trk_get_song', 'trk_set_cell', 'trk_set_pattern', 'trk_set_tempo', 'trk_set_orders',
      'trk_add_pattern', 'trk_add_instrument', 'trk_preview', 'trk_stop', 'trk_export_spc',
      'emu_probe',
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
    expect(body.tools).toHaveLength(39);
    // The sprite (OAM) toolchain is present in the catalog.
    for (const t of ['gfx_set_oam_entry', 'gfx_clear_oam', 'gfx_export_oam']) {
      expect(body.tools).toContain(t);
    }
    // The per-frame animation toolchain (char-swap, Mode 7, water/fire) is present.
    for (const t of ['gfx_sprite_anim', 'gfx_bg_mode7', 'gfx_bg_tile_anim']) {
      expect(body.tools).toContain(t);
    }
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

describe('actionable failure hints (steer the model back to the recipe)', () => {
  function bodyOf(m: ReturnType<typeof mockControllers>, tool: string, args: Record<string, unknown> = {}): Record<string, unknown> {
    return JSON.parse(dispatch(m, tool, args).content) as Record<string, unknown>;
  }

  it('asm_assemble: undefined "vram_load" points at gfx_export_vram + vram.bin', () => {
    const m = mockControllers();
    m.results.assemble.ok = false;
    m.results.assemble.errors = [{ line: 2, message: 'undefined label "vram_load"' }];
    const body = bodyOf(m, 'asm_assemble');
    expect(body.hint).toContain('gfx_export_vram');
    expect(body.hint).toContain('vram.bin');
  });

  it('asm_assemble: undefined "spc_load" points at trk_export_spc', () => {
    const m = mockControllers();
    m.results.assemble.ok = false;
    m.results.assemble.errors = [{ line: 3, message: 'undefined label "spc_load"' }];
    expect(bodyOf(m, 'asm_assemble').hint).toContain('trk_export_spc');
  });

  it('asm_assemble: unknown instruction warns against hand-rolled PPU/DMA', () => {
    const m = mockControllers();
    m.results.assemble.ok = false;
    m.results.assemble.errors = [{ line: 5, message: 'unknown instruction "x=0"' }];
    expect(bodyOf(m, 'asm_assemble').hint).toContain('gfx_export_vram');
  });

  it('asm_assemble: label arithmetic (invalid number) says to use the exports', () => {
    const m = mockControllers();
    m.results.assemble.ok = false;
    m.results.assemble.errors = [{ line: 7, message: 'invalid number "vram_img+1" for immediate' }];
    expect(bodyOf(m, 'asm_assemble').hint).toContain('label arithmetic');
  });

  it('asm_assemble: an unrelated failure carries no hint', () => {
    const m = mockControllers();
    m.results.assemble.ok = false;
    m.results.assemble.errors = [{ line: 1, message: 'bad opcode' }];
    expect(bodyOf(m, 'asm_assemble').hint).toBeUndefined();
  });

  it('asm_build_rom: a 32 KB blowout blames a stale 64 KB vram.bin', () => {
    const m = mockControllers();
    m.results.buildRom.ok = false;
    m.results.buildRom.error =
      'buildRom: program is 65588 bytes but the entry region is $0000–$7fb0 (max 32688 bytes)';
    const hint = bodyOf(m, 'asm_build_rom').hint as string;
    expect(hint).toContain('asm_remove_data_file');
    expect(hint).toContain('gfx_export_vram');
  });

  it('asm_build_rom: an unrelated failure carries no hint', () => {
    const m = mockControllers();
    m.results.buildRom.ok = false;
    m.results.buildRom.error = 'no assemble yet';
    expect(bodyOf(m, 'asm_build_rom').hint).toBeUndefined();
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
  });

  it('gfx_set_palette_color accepts OBJ/sprite palette indices 16–31 (the sprite colors)', () => {
    const m = mockControllers();
    // The agent's sprite flow paints the OBJ palette this way — 16 was being
    // rejected by the old 0–15 validation even though the schema says 0–31.
    for (const index of [16, 20, 31]) {
      expect(dispatch(m, 'gfx_set_palette_color', { index, r: 31, g: 0, b: 0 }).ok).toBe(true);
      expect(callTo(m, 'setPaletteColor')).toEqual([index, 31, 0, 0, false]);
    }
    expect(dispatch(m, 'gfx_set_palette_color', { index: 32, r: 0, g: 0, b: 0 }).ok).toBe(false);
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
    const body = JSON.parse(r.content) as Record<string, unknown>;
    expect(body).toMatchObject({ bytes: 4, layout: { bytes: 4, mapBase: 0x1000 } });
    expect(typeof body.glue).toBe('string');
    expect(m.files.size).toBe(0);
    dispatch(m, 'gfx_export_vram', { destName: 'vram.bin' });
    expect(m.files.get('vram.bin')).toEqual(new Uint8Array([0, 1, 2, 3]));
    // glue appended into the source, wrapped in the (re-runnable) marker block
    expect(m.sources.src).toContain('vram glue for vram.bin');
    expect(m.sources.src).toContain('GFX_VRAM_GLUE');
    // re-exporting is idempotent — the marker block (and its label) is not duplicated
    const before = m.sources.src;
    dispatch(m, 'gfx_export_vram', { destName: 'vram.bin' });
    expect(m.sources.src).toBe(before);
    expect(m.sources.src.match(/GFX_VRAM_GLUE \(generated\)/g)!.length).toBe(1);
    expect(dispatch(m, 'gfx_export_vram', { destName: 5 }).ok).toBe(false);
  });

  it('gfx_export_vram compresses when LZ actually shrinks the ROM', () => {
    const m = mockControllers();
    m.blobs.vram = new Uint8Array(2000).fill(0); // a run of zeroes compresses hard
    const r = dispatch(m, 'gfx_export_vram', { destName: 'vram.bin' });
    const body = JSON.parse(r.content) as { bytes: number; rawBytes: number; compressed: boolean };
    expect(r.ok).toBe(true);
    expect(body.compressed).toBe(true);
    expect(body.rawBytes).toBe(2000);
    expect(body.bytes).toBeLessThan(2000); // the COMPRESSED blob was embedded, not the raw image
    expect(m.files.get('vram.bin')!.length).toBe(body.bytes);
    // The shared decompressor was appended exactly once, and the LZ glue (not raw).
    expect(m.sources.src.match(/LZSS_DECODE_GLUE \(generated\)/g)!.length).toBe(1);
    expect(m.sources.src).toContain('vram glue lz for vram.bin');
  });

  it('gfx_export_vram falls back to raw when LZ cannot beat the decompressor overhead', () => {
    const m = mockControllers();
    m.blobs.vram = new Uint8Array([0, 1, 2, 3]); // 4 bytes < ~206 B of glue overhead
    const r = dispatch(m, 'gfx_export_vram', { destName: 'vram.bin' });
    const body = JSON.parse(r.content) as { bytes: number; rawBytes: number; compressed: boolean };
    expect(r.ok).toBe(true);
    expect(body.compressed).toBe(false);
    expect(body.bytes).toBe(4);
    expect(body.rawBytes).toBe(4);
    // Raw image embedded, raw glue used, and NO shared decompressor appended.
    expect(m.files.get('vram.bin')!).toEqual(new Uint8Array([0, 1, 2, 3]));
    expect(m.sources.src).toContain('vram glue for vram.bin');
    expect(m.sources.src).not.toContain('LZSS_DECODE_GLUE');
  });

  it('gfx + spc LZ exports share ONE decompressor block (no duplicate lz_decode)', () => {
    const m = mockControllers();
    m.blobs.vram = new Uint8Array(2000).fill(0);
    m.blobs.spc = new Uint8Array(1500).fill(0x11);
    dispatch(m, 'gfx_export_vram', { destName: 'vram.bin' });
    dispatch(m, 'trk_export_spc', { destName: 'spc.bin' });
    expect(m.sources.src.match(/LZSS_DECODE_GLUE \(generated\)/g)!.length).toBe(1);
    expect(m.sources.src.match(/\/LZSS_DECODE_GLUE/g)!.length).toBe(1);
    expect(m.sources.src).toContain('vram glue lz for vram.bin');
    expect(m.sources.src).toContain('glue lz for spc.bin');
  });

  it('gfx_set_oam_entry places a sprite with flip/priority defaults filled in', () => {
    const m = mockControllers();
    const r = dispatch(m, 'gfx_set_oam_entry', { slot: 3, tile: 8, x: 100, y: 50 });
    expect(r.ok).toBe(true);
    expect(callTo(m, 'setOamEntry')).toEqual([3, { tile: 8, x: 100, y: 50, flipH: false, flipV: false, priority: 0 }]);
    expect(JSON.parse(r.content)).toEqual({ slot: 3, tile: 8 });
    // Rejections: out-of-range slot/tile/coords, and tile required unless hide.
    expect(dispatch(m, 'gfx_set_oam_entry', { slot: 128, tile: 0, x: 0, y: 0 }).ok).toBe(false);
    expect(dispatch(m, 'gfx_set_oam_entry', { slot: 0, tile: 512, x: 0, y: 0 }).ok).toBe(false);
    expect(dispatch(m, 'gfx_set_oam_entry', { slot: 0, tile: 0, x: 256, y: 0 }).ok).toBe(false);
    expect(dispatch(m, 'gfx_set_oam_entry', { slot: 0, x: 0, y: 0 }).ok).toBe(false);
  });

  it('gfx_set_oam_entry with hide:true clears the slot', () => {
    const m = mockControllers();
    const r = dispatch(m, 'gfx_set_oam_entry', { slot: 9, hide: true });
    expect(r.ok).toBe(true);
    expect(callTo(m, 'setOamEntry')).toEqual([9, null]);
    expect(JSON.parse(r.content)).toEqual({ slot: 9, hidden: true });
  });

  it('gfx_clear_oam hides every one of the 128 slots', () => {
    const m = mockControllers();
    const r = dispatch(m, 'gfx_clear_oam');
    expect(r.ok).toBe(true);
    expect(m.rec.some((c) => c.fn === 'clearOam')).toBe(true);
    expect(JSON.parse(r.content)).toEqual({ cleared: 128 });
  });

  it('gfx_export_oam compiles the 512-byte table; destName registers + appends size-specific glue', () => {
    const m = mockControllers();
    // No destName: returns the glue text for inspection, registers nothing.
    const r = dispatch(m, 'gfx_export_oam');
    const body = JSON.parse(r.content) as Record<string, unknown>;
    expect(body).toMatchObject({ bytes: 512, size: '16x16' });
    expect(typeof body.glue).toBe('string');
    expect(m.files.size).toBe(0);
    // The GLOBAL size is threaded into the glue and echoed back in the result.
    dispatch(m, 'gfx_export_oam', { destName: 'oam.bin', size: '8x8' });
    expect(m.files.get('oam.bin')!.length).toBe(512);
    expect(m.sources.src).toContain('oam glue for oam.bin (8x8)');
    expect(m.sources.src).toContain('GFX_OAM_GLUE');
    // Re-export is idempotent — the marker block (and its `oam_load` label) is replaced, not duplicated.
    const before = m.sources.src;
    dispatch(m, 'gfx_export_oam', { destName: 'oam.bin', size: '8x8' });
    expect(m.sources.src).toBe(before);
    expect(m.sources.src.match(/GFX_OAM_GLUE \(generated\)/g)!.length).toBe(1);
    // Switching size replaces the previous block with the new size's glue.
    dispatch(m, 'gfx_export_oam', { destName: 'oam.bin', size: '16x16' });
    expect(m.sources.src).toContain('oam glue for oam.bin (16x16)');
    expect(m.sources.src).not.toContain('oam glue for oam.bin (8x8)');
    expect(m.sources.src.match(/GFX_OAM_GLUE \(generated\)/g)!.length).toBe(1);
    expect(dispatch(m, 'gfx_export_oam', { destName: 5 }).ok).toBe(false);
  });

  it('gfx_set_scroll lands the scroll service + arms the shared NMI; idempotent on re-export', () => {
    const m = mockControllers();
    const r = dispatch(m, 'gfx_set_scroll', { dx: 2, dy: 1 });
    expect(r.ok).toBe(true);
    // The controller recorded the per-frame delta.
    expect(m.rec.some((c) => c.fn === 'setScroll' && c.args[0] === 2 && c.args[1] === 1)).toBe(true);
    // The scroll service (bg_scroll_init + bg_scroll) was appended under its marker.
    expect(m.sources.src).toContain('GFX_SCROLL_GLUE');
    expect(m.sources.src).toMatch(/bg_scroll_init:/);
    expect(m.sources.src).toMatch(/bg_scroll:/);
    // And the SHARED NMI handler now dispatches the scroll tick.
    expect(m.sources.src).toContain('NMI_DISPATCHER_GLUE');
    const body = JSON.parse(r.content) as Record<string, unknown>;
    expect(body).toMatchObject({ dx: 2, dy: 1, nmi: ['bg_scroll'] });

    // Re-export with the same delta is idempotent: the blocks are replaced, not duplicated.
    const before = m.sources.src;
    dispatch(m, 'gfx_set_scroll', { dx: 2, dy: 1 });
    expect(m.sources.src).toBe(before);
    expect(m.sources.src.match(/GFX_SCROLL_GLUE \(generated\)/g)!.length).toBe(1);
    expect(m.sources.src.match(/nmi_move:/g)!.length).toBe(1);

    // Changing the delta rewrites the block in place (still one block).
    dispatch(m, 'gfx_set_scroll', { dx: -3, dy: 2 });
    expect(m.sources.src.match(/GFX_SCROLL_GLUE \(generated\)/g)!.length).toBe(1);
    expect(m.sources.src).toMatch(/sbc #\$03/); // dx=-3 → H decrements (true immediate)
  });

  it('gfx_set_scroll validates dx/dy (integers, -128..127, both required)', () => {
    const m = mockControllers();
    expect(dispatch(m, 'gfx_set_scroll', { dx: 'x', dy: 1 }).ok).toBe(false); // not an integer
    expect(dispatch(m, 'gfx_set_scroll', { dx: 2, dy: 1.5 }).ok).toBe(false); // not an integer
    expect(dispatch(m, 'gfx_set_scroll', { dx: 500, dy: 1 }).ok).toBe(false); // out of range
    expect(dispatch(m, 'gfx_set_scroll', { dx: 2 }).ok).toBe(false); // dy missing
  });

  it('a scrolling background and a d-pad sprite share ONE NMI handler (both ticks dispatched)', () => {
    const m = mockControllers();
    // Sprite first: the NMI handler dispatches only spr_move.
    dispatch(m, 'gfx_export_oam', { destName: 'oam.bin', size: '16x16' });
    let handler = m.sources.src.slice(m.sources.src.indexOf('nmi_move:'));
    expect(handler).toMatch(/jsr spr_move/);
    expect(handler).not.toMatch(/jsr bg_scroll/);

    // Then the scroll: the SAME handler now dispatches BOTH, in order — no
    // second handler (a ROM has exactly one NMI vector).
    dispatch(m, 'gfx_set_scroll', { dx: 2, dy: 1 });
    handler = m.sources.src.slice(m.sources.src.indexOf('nmi_move:'));
    expect(handler).toMatch(/nmi_move:\s*jsr bg_scroll\s*\n\s*jsr spr_move\s*\n\s*rti/);
    expect(m.sources.src.match(/nmi_move:/g)!.length).toBe(1);
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

  it('trk_export_spc compresses when LZ actually shrinks the ROM', () => {
    const m = mockControllers();
    m.blobs.spc = new Uint8Array(1500).fill(0x11);
    const r = dispatch(m, 'trk_export_spc', { destName: 'spc.bin' });
    const body = JSON.parse(r.content) as { bytes: number; rawBytes: number; compressed: boolean };
    expect(r.ok).toBe(true);
    expect(body.compressed).toBe(true);
    expect(body.rawBytes).toBe(1500);
    expect(body.bytes).toBeLessThan(1500);
    expect(m.files.get('spc.bin')!.length).toBe(body.bytes);
    expect(m.sources.src).toContain('glue lz for spc.bin');
    expect(m.sources.src.match(/LZSS_DECODE_GLUE \(generated\)/g)!.length).toBe(1);
  });

  it('trk_export_spc falls back to raw when LZ cannot beat the decompressor overhead', () => {
    const m = mockControllers();
    m.blobs.spc = new Uint8Array([9, 9]); // 2 bytes < ~206 B of glue overhead
    const r = dispatch(m, 'trk_export_spc', { destName: 'spc.bin' });
    const body = JSON.parse(r.content) as { bytes: number; compressed: boolean };
    expect(r.ok).toBe(true);
    expect(body.compressed).toBe(false);
    expect(body.bytes).toBe(2);
    expect(m.files.get('spc.bin')!).toEqual(new Uint8Array([9, 9]));
    expect(m.sources.src).toContain('glue for spc.bin');
    expect(m.sources.src).not.toContain('LZSS_DECODE_GLUE');
  });
});

describe('emu_probe (the agent\'s eyes)', () => {
  // A measured all-black frame — the "regressed to a black screen" case.
  const solidBlack: FrameSummary = {
    width: 256, height: 224, background: [0, 0, 0, 0], backgroundCount: 57344,
    contentRatio: 0, contentBbox: null,
    topColors: [{ color: [0, 0, 0, 0], count: 57344 }],
    isSolid: true, isSolidBlack: true, grid: [], gridCols: 32, gridRows: 28,
  };

  it('reports a green (screen-up) result with an actionable note', async () => {
    const m = mockControllers();
    const r = await dispatchAsync(m, 'emu_probe');
    expect(r.ok).toBe(true);
    const body = JSON.parse(r.content) as {
      core: string; isMock: boolean; frames: number;
      screen: { contentBbox: { x0: number } | null }; note: string;
    };
    expect(body.core).toBe('test-core');
    expect(body.isMock).toBe(false);
    expect(body.frames).toBe(3);
    expect(body.screen.contentBbox).not.toBeNull();
    expect(body.note).toMatch(/Screen is up/);
    // No `frames` arg → the controller was called with the default (undefined).
    expect(callTo(m, 'probe')).toEqual([undefined]);
  });

  it('passes a numeric `frames` through to the core', async () => {
    const m = mockControllers();
    const r = await dispatchAsync(m, 'emu_probe', { frames: 7 });
    expect(r.ok).toBe(true);
    expect(callTo(m, 'probe')).toEqual([{ frames: 7 }]);
  });

  it('diagnoses a SOLID BLACK screen and steers AWAY from background-palette edits', async () => {
    const m = mockControllers();
    m.results.probe = { ok: true, core: 'test-core', isMock: false, frames: 3, screen: solidBlack };
    const r = await dispatchAsync(m, 'emu_probe');
    expect(r.ok).toBe(true);
    const body = JSON.parse(r.content) as { note: string };
    expect(body.note).toMatch(/SOLID BLACK/);
    // The exact trap an agent already fell into, called out by name:
    // a SPRITE samples the OBJ palette (16–31), not the background (0–15).
    expect(body.note).toMatch(/do NOT keep changing background palette colors/);
    expect(body.note).toMatch(/OBJ palette \(indices 16–31\)/);
    expect(body.note).toMatch(/gfx_export_oam/);
    expect(body.note).toMatch(/gfx_set_oam_entry/);
  });

  it('warns loudly when the frame came from the MOCK core', async () => {
    const m = mockControllers();
    m.results.probe = { ok: true, core: 'mock (test pattern)', isMock: true, frames: 3, screen: solidBlack };
    const r = await dispatchAsync(m, 'emu_probe');
    const body = JSON.parse(r.content) as { isMock: boolean; note: string };
    expect(body.isMock).toBe(true);
    expect(body.note).toMatch(/MOCK core/);
    expect(body.note).toMatch(/NOT your ROM/);
  });

  it('turns a failed probe (no clean assemble) into a clean, actionable result', async () => {
    const m = mockControllers();
    m.results.probe = { ok: false, error: 'assemble failed' };
    const r = await dispatchAsync(m, 'emu_probe');
    expect(r.ok).toBe(false);
    const body = JSON.parse(r.content) as { error: string; hint: string };
    expect(body.error).toContain('assemble failed');
    expect(body.hint).toMatch(/asm_assemble/);
  });

  it('a REJECTING probe never throws — it resolves to a clean failure', async () => {
    const m = mockControllers();
    m.controllers.emu.probe = () => Promise.reject(new Error('wasm died'));
    // The dispatchTool NEVER-THROWS contract: a rejection becomes an ok:false
    // tool result the model can read, not an unhandled rejection to the loop.
    const r = await dispatchAsync(m, 'emu_probe');
    expect(r.ok).toBe(false);
    expect(JSON.parse(r.content).error).toContain('wasm died');
  });
});
