/**
 * The d-pad sprite service, end-to-end, on the REAL snes9x core.
 *
 * The program is written EXACTLY as the system-prompt recipe:
 *
 *   reset:
 *     jsr vram_load
 *     jsr oam_load
 *     jsr spr_init
 *   idle:
 *     bra idle
 *
 * i.e. the ROM NEVER calls `spr_move` itself — `spr_init` arms the
 * once-per-vblank NMI and the core's NMI dispatch runs the 2px d-pad tick.
 * This file proves the sprite actually moves on the real PPU:
 *
 *   1. it appears at the screen centre and HOLDS STILL while idle (no NMI
 *      runaway, no drift) — this is the exact failure mode of the old
 *      "jsr spr_move / bra mv" recipe, where the CPU re-ran the tick ~1700×
 *      per frame and the position randomised;
 *   2. holding RIGHT walks it ~2px/frame to the right;
 *   3. releasing the d-pad holds the position;
 *   4. holding UP walks it ~2px/frame up.
 *
 * The sprite is a solid RED 16×16 (OBJ palette index 1 = red; colour 0 is
 * transparent) over a solid BLACK background (BG palette index 1 = black),
 * 4bpp mode — so "the red box" is exactly the sprite, unambiguous.
 */
import { describe, expect, it, beforeAll } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { WasmCore } from '../src/core/wasm-core';
import type { S9xModule } from '../src/core/wasm-core';
import { BTN } from '../src/core/types';
import { assemble } from '../src/asm/assembler';
import { buildRomFromResult } from '../src/asm/rom';
import { buildVramCompact, vramGlue } from '../src/gfx/vram';
import type { Rgb15 } from '../src/gfx/palette';
import type { TilemapEntry } from '../src/gfx/tilemap';
import { OAM_ENTRIES, encodeOam, oamGlue, type OamEntry } from '../src/gfx/oam';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const JS = resolve(root, 'public/core/build/snes9x.js');
const WASM = resolve(root, 'public/core/build/snes9x.wasm');
const haveBuild = existsSync(JS) && existsSync(WASM);

/** A palette whose index 1 is the given colour (0 = transparent, rest black). */
function paletteWith(r: number, g: number, b: number): Rgb15[] {
  const out: Rgb15[] = [];
  for (let i = 0; i < 16; i++) {
    if (i === 0) out.push({ r: 0, g: 0, b: 0, transparent: true });
    else if (i === 1) out.push({ r, g, b, transparent: false });
    else out.push({ r: 0, g: 0, b: 0, transparent: false });
  }
  return out;
}
const solid = (idx: number): number[][] =>
  Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => idx));
const fullMap = (tile: number): TilemapEntry[] =>
  new Array(1024).fill(0).map(() => ({ tile, palette: 0, flipX: false, flipY: false, priority: false }));

/**
 * The sprite ROM: red 16×16 sprite in slot 0 at (128,112), priority 2 (over
 * the black background), mode 2 (4bpp — OBJ palette 0 maps cleanly to CGRAM
 * palette 8), and the EXACT system-prompt program (init once, then idle).
 */
function moveRom(): Uint8Array {
  const tiles = Array.from({ length: 18 }, () => solid(1)); // 16×16 block = chars 0,1,16,17
  const compact = buildVramCompact({
    mode: 2,
    tiles,
    palettes: [paletteWith(0, 0, 0)], // BG palette: index 1 = black
    objPalette: paletteWith(31, 0, 0), // OBJ palette: index 1 = red
    tilemap: fullMap(0),
    tileBase: 0,
    paletteBase: 0,
    mapBase: 0x8000,
  });
  const slots: Array<OamEntry | null> = new Array(OAM_ENTRIES).fill(null);
  slots[0] = { tile: 0, x: 128, y: 112, priority: 2 };
  const oam = encodeOam(slots);

  const program = ['reset:', '  jsr vram_load', '  jsr oam_load', '  jsr spr_init', 'idle:', '  bra idle'].join('\n');
  const glue =
    vramGlue(compact.mapBase, compact.bgmode, compact.blocks, 'vram.bin', compact.altMapBase) +
    '\n' +
    oamGlue('oam.bin', '16x16');
  const r = assemble(program + '\n' + glue, 0x008000, { 'vram.bin': compact.blob, 'oam.bin': oam });
  if (!r.ok) throw new Error('assemble failed: ' + r.errors.map((e) => `${e.line}: ${e.message}`).join('; '));
  return buildRomFromResult(r, { title: 'SPRMOVE' });
}

describe.skipIf(!haveBuild)('d-pad sprite movement on the REAL snes9x core', () => {
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
    await core.loadRom(moveRom());
  }, 60_000);

  /**
   * Run `frames` frames and report the red box: pixel count + centroid.
   * Red = the sprite (OBJ palette 1); the background is black.
   */
  function centroid(frames: number): { n: number; cx: number; cy: number } {
    for (let i = 0; i < frames; i++) core.frame();
    const vf = core.lastVideo();
    let n = 0, sx = 0, sy = 0;
    for (let y = 0; y < vf.height; y++) {
      for (let x = 0; x < vf.width; x++) {
        const i = (y * vf.width + x) * 4;
        const r = vf.data[i], g = vf.data[i + 1], b = vf.data[i + 2];
        if (r > 150 && g < 90 && b < 90) { n++; sx += x; sy += y; }
      }
    }
    return n > 0 ? { n, cx: sx / n, cy: sy / n } : { n: 0, cx: NaN, cy: NaN };
  }

  const box = 16 * 16;
  const still = (a: { n: number; cx: number; cy: number }, b: { n: number; cx: number; cy: number }) =>
    Math.abs(a.cx - b.cx) < 3 && Math.abs(a.cy - b.cy) < 3;

  it('1. the sprite appears at the screen centre and HOLDS STILL while idle', () => {
    const a = centroid(6);
    // The 16×16 red box: (nearly) all red, centred on (128+7.5, 112+7.5).
    expect(a.n).toBeGreaterThan(box * 0.8);
    expect(Math.abs(a.cx - 135.5)).toBeLessThan(3);
    expect(Math.abs(a.cy - 119.5)).toBeLessThan(3);
    // More idle frames: still there, no drift (the NMI tick must not wander
    // on its own — that was the loop-recipe failure).
    const b = centroid(6);
    expect(b.n).toBeGreaterThan(box * 0.8);
    expect(still(a, b)).toBe(true);
  }, 90_000);

  it('2. holding RIGHT walks the sprite ~2px/frame to the right', () => {
    const before = centroid(2);
    core.setController(1, BTN.RIGHT);
    const after = centroid(8);
    expect(after.n).toBeGreaterThan(box * 0.8);
    // 8 frames × 2px = 16px expected; allow 4–13 ticks of actual NMI firings.
    expect(after.cx - before.cx).toBeGreaterThan(8);
    expect(after.cx - before.cx).toBeLessThan(28);
    // X-only movement: Y stays put.
    expect(Math.abs(after.cy - before.cy)).toBeLessThan(3);
    core.setController(1, 0);
  }, 90_000);

  it('3. releasing the d-pad holds the position', () => {
    const a = centroid(3);
    const b = centroid(6);
    expect(b.n).toBeGreaterThan(box * 0.8);
    expect(still(a, b)).toBe(true);
  }, 90_000);

  it('4. holding UP walks the sprite ~2px/frame up (and no X drift)', () => {
    const before = centroid(2);
    core.setController(1, BTN.UP);
    const after = centroid(8);
    expect(after.n).toBeGreaterThan(box * 0.8);
    // 8 frames × 2px = 16px expected (upward = decreasing Y).
    expect(before.cy - after.cy).toBeGreaterThan(8);
    expect(before.cy - after.cy).toBeLessThan(28);
    expect(Math.abs(after.cx - before.cx)).toBeLessThan(3);
    core.setController(1, 0);
  }, 90_000);
});
