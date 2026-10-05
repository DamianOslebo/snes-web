/**
 * BG tile water/fire colour animation, end-to-end, on the REAL snes9x core.
 *
 * The program is written EXACTLY as the system-prompt recipe:
 *
 *   reset:
 *     jsr vram_load
 *     jsr bgtile_init
 *   idle:
 *     bra idle
 *
 * `vram_load` brings up BG0 with a tilemap whose every cell points at ONE tile
 * whose hot pixels all carry sub-palette index 1 — so the whole screen reads
 * CGRAM slot 1. `bgtile_init` parks the colour index/divider and arms the
 * once-per-vblank NMI; the shared NMI dispatcher (`nmiGlue`/`nmi_move`) then
 * runs `bgtile_tick` once per frame, which steps the baked lo/hi colour table
 * and re-writes CGRAM slot 1 ($2121/$2122). So the ROM never touches the
 * tilemap or the tile bitmap — it only re-colours one CGRAM slot. This proves
 * on the real PPU, on-screen:
 *
 *   1. the screen is a COLOURED field (not black) — the animated tile and its
 *      palette slot reached VRAM and are being read by the rasterizer;
 *   2. the tile SHIMMERS — that one CGRAM slot's colour cycles through the
 *      baked sequence across frames, which only a per-frame $2121/$2122 write
 *      driven by the NMI can do. A static (never-recoloured) slot would show
 *      ONE colour forever.
 *
 * (The core-free glue/dispatcher contracts live in test/bgtile.test.ts; this
 * file is the real-PPU proof, the way test/anim-core.test.ts is for the char
 * swap and test/mode7-core.test.ts is for the affine field. Skipped when the
 * wasm build is absent.)
 */
import { describe, expect, it, beforeAll } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { WasmCore } from '../src/core/wasm-core';
import type { S9xModule } from '../src/core/wasm-core';
import { assemble } from '../src/asm/assembler';
import { buildRomFromResult } from '../src/asm/rom';
import { buildVramCompact, vramGlue } from '../src/gfx/vram';
import { encodeColor, type Rgb15 } from '../src/gfx/palette';
import type { TilemapEntry } from '../src/gfx/tilemap';
import { nmiGlue, scrollStepsFromSource } from '../src/gfx/scroll';
import { bgTileAnimGlue } from '../src/gfx/bgtile';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const JS = resolve(root, 'public/core/build/snes9x.js');
const WASM = resolve(root, 'public/core/build/snes9x.wasm');
const haveBuild = existsSync(JS) && existsSync(WASM);

/** An 8×8 char that is a solid fill of sub-palette index `idx`. */
const solid = (idx: number): number[][] =>
  Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => idx));

/**
 * Encode a 5-5-5 colour to the 15-bit word the bgtile tables want (no alpha
 * bit): (high<<8) | low — exactly how the glue's lo/hi pair reassembles.
 */
const c15 = (r: number, g: number, b: number): number => {
  const { low, high } = encodeColor({ r, g, b, transparent: false });
  return ((high & 0x7f) << 8) | (low & 0xff);
};

/**
 * The water/fire colour sequence, in order: red → green → blue → yellow.
 * These are the same four solids the sprite char-swap core test proves render
 * correctly, so the `classify` probe below (shared shape) is known to work.
 */
const FRAMES = [c15(31, 0, 0), c15(0, 31, 0), c15(0, 0, 31), c15(31, 31, 0)];
const SPEED = 2; // one colour every 2 frames → full cycle = 8 frames

/**
 * BG palette: the hot pixels all read CGRAM slot 1, so only slot 1 matters.
 * Seed it red (frame 0) so the first painted frame matches the sequence; the
 * NMI-ticked `bgtile_tick` overwrites it every frame anyway. Slot 0 is the
 * transparent colour (conventionally unused).
 */
function bgPalette(): Rgb15[] {
  const out: Rgb15[] = [];
  for (let i = 0; i < 16; i++) {
    if (i === 0) out.push({ r: 0, g: 0, b: 0, transparent: true });
    else if (i === 1) out.push({ r: 31, g: 0, b: 0, transparent: false }); // red (frame 0)
    else out.push({ r: 0, g: 0, b: 0, transparent: false });
  }
  return out;
}

/** A full 32×32 SC0 map, every cell = the animated tile (tile 0, palette 0). */
const fullMap = (tile: number): TilemapEntry[] =>
  new Array(1024).fill(0).map(() => ({ tile, palette: 0, flipX: false, flipY: false, priority: false }));

/**
 * The water/fire ROM: a BG0 tile whose hot pixels all point at CGRAM slot 1,
 * over the whole screen, with the EXACT system-prompt program (init once, then
 * idle). `bgtile_tick` (run by the shared NMI dispatcher) is what re-colours
 * slot 1 — the tilemap and the tile bitmap are never touched.
 */
function bgtileRom(): Uint8Array {
  const compact = buildVramCompact({
    mode: 2, // 4bpp, 8×8 — so each pixel's 4 bits IS the sub-palette index
    tiles: [solid(1)], // hot pixels = sub-palette index 1 → CGRAM slot 1
    palettes: [bgPalette()],
    tilemap: fullMap(0), // whole screen = the animated tile
    tileBase: 0,
    paletteBase: 0,
    mapBase: 0x8000,
  });
  const program = ['reset:', '  jsr vram_load', '  jsr bgtile_init', 'idle:', '  bra idle'].join('\n');
  const glue =
    vramGlue(compact.mapBase, compact.bgmode, compact.blocks, 'vram.bin') +
    '\n' +
    bgTileAnimGlue({ frames: FRAMES, cgramSlot: 1, speed: SPEED });
  // The NMI handler (nmi_move) is the SHARED dispatcher the build bakes the NMI
  // vector at. Here it runs the single bgtile_tick service — proving the
  // water/fire composes in the one handler, on the real PPU.
  const nmi = nmiGlue(scrollStepsFromSource(glue));
  const r = assemble(program + '\n' + glue + (nmi ? '\n' + nmi : ''), 0x008000, { 'vram.bin': compact.blob });
  if (!r.ok) throw new Error('assemble failed: ' + r.errors.map((e) => `${e.line}: ${e.message}`).join('; '));
  return buildRomFromResult(r, { title: 'BGTILE' });
}

/** Classify a rendered pixel into one of the four sequence colours (or 'bg'). */
function classify(r: number, g: number, b: number): string {
  if (r > 150 && g > 150 && b < 90) return 'yellow';
  if (r > 150 && g < 90 && b < 90) return 'red';
  if (g > 150 && r < 90 && b < 90) return 'green';
  if (b > 150 && r < 90 && g < 90) return 'blue';
  return 'bg';
}

describe.skipIf(!haveBuild)('BG tile water/fire colour animation on the REAL snes9x core', () => {
  let core: WasmCore;

  beforeAll(async () => {
    const src = readFileSync(JS, 'utf8');
    const factory = new Function(`${src}\n;return snesWasm;`)() as unknown as (m: object) => Promise<S9xModule>;
    const wasmB64 = readFileSync(WASM, 'base64');
    const M = await factory({
      locateFile: (f: string) => (f === 'snes9x.wasm' ? `data:application/wasm;base64,${wasmB64}` : f),
      print: () => {}, printErr: () => {}, out: () => {}, err: () => {},
    });
    core = new WasmCore(M, []);
    await core.loadRom(bgtileRom());
  }, 60_000);

  /**
   * The centre pixel's colour (the whole screen is the animated tile, so any
   * pixel is a valid probe).
   */
  function centerColor(): string {
    const vf = core.lastVideo();
    const idx = (112 * vf.width + 128) * 4;
    return classify(vf.data[idx], vf.data[idx + 1], vf.data[idx + 2]);
  }

  const isReal = (c: string) => c === 'red' || c === 'green' || c === 'blue' || c === 'yellow';

  /**
   * Advance frames until the screen turns from the black backdrop to a real
   * colour — i.e. `vram_load` has landed in VRAM and the slot-1 colour is
   * being read. Under snes9x's wall-clock throttle the boot-time VRAM fill
   * stretches across a few rendered frames, so a fixed "frame once" is too
   * early: the screen is still the black backdrop. Returns the first real
   * colour seen ('' if it never turned on within `maxFrames`).
   */
  function settle(maxFrames = 60): string {
    let seen = '';
    for (let i = 0; i < maxFrames; i++) {
      core.frame();
      const c = centerColor();
      if (isReal(c)) { seen = c; break; }
    }
    return seen;
  }

  it('1. the screen is a COLOURED field — the animated tile + slot reached VRAM', () => {
    // Let the boot-time VRAM fill land in VRAM before reading (see `settle`).
    const c = settle();
    // The screen turned from the black backdrop to one of the sequence colours:
    // the tile is in VRAM, the tilemap points at it, and CGRAM slot 1 (read by
    // the hot pixels) holds a real colour. A black screen (tile/palette never
    // loaded) would settle to '' and fail here.
    expect(c).not.toBe('');
    expect(isReal(c)).toBe(true);
  }, 90_000);

  it('2. the tile SHIMMERS — slot 1 cycles through the baked sequence over time', () => {
    // Make sure the fill has landed (idempotent — test 1 already settled it),
    // then sample across several full cycles (K*SPEED = 4*2 = 8 frames/cycle).
    settle();
    const seen = new Set<string>();
    for (let i = 0; i < 24; i++) {
      core.frame();
      const c = centerColor();
      if (isReal(c)) seen.add(c);
    }
    // A working water/fire: the slot sweeps through the sequence, so we see
    // several distinct colours. A static (never-recoloured) slot shows ONE.
    expect(seen.size).toBeGreaterThanOrEqual(3);
    // …and the pixels are still our sequence colours (not the black backdrop).
    for (const c of seen) expect(isReal(c)).toBe(true);
  }, 90_000);
});
