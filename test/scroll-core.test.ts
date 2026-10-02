/**
 * BG0 scroll, end-to-end, on the REAL snes9x core.
 *
 * Proves a scrolling background actually SCROLLS: the PPU samples the tilemap
 * from a moving offset, so a fixed feature on the background drifts across the
 * screen once per frame, at the rate picked via gfx_set_scroll.
 *
 * The ROM is built EXACTLY as the agent ships it:
 *
 *   reset:
 *     jsr vram_load
 *     jsr bg_scroll_init
 *   idle:
 *     bra idle
 *
 * `bg_scroll_init` parks the offset at the origin and arms the once-per-vblank
 * NMI; the shared NMI dispatcher (nmiGlue) runs `bg_scroll` once per frame,
 * which advances the two 8-bit counters and writes the ABSOLUTE offsets to
 * $210D (HOffset) then $210E (VOffset). The program never touches the scroll
 * itself and never reads a PPU register.
 *
 * The background is a solid WHITE 16×16 block in the centre of an otherwise
 * BLACK field (BG palette index 2 = white, index 1 = black), so "the white
 * block" is unambiguous and its centroid is stable. We scroll by (dx=+2,
 * dy=+1) px/frame and verify the block DRIFTS by a sane amount, at ~the 2:1
 * H:V ratio the config demands — which only a working $210D/$210E scroll +
 * NMI tick can do. (The core-free glue/dispatcher contracts live in
 * test/scroll.test.ts; this file is the real-PPU proof, the way
 * test/spr-move.test.ts is for the sprite tick. Skipped when the wasm build
 * is absent.)
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
import type { Rgb15 } from '../src/gfx/palette';
import type { TilemapEntry } from '../src/gfx/tilemap';
import { bgScrollGlue, nmiGlue } from '../src/gfx/scroll';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const JS = resolve(root, 'public/core/build/snes9x.js');
const WASM = resolve(root, 'public/core/build/snes9x.wasm');
const haveBuild = existsSync(JS) && existsSync(WASM);

// --- the background: a white 16×16 block at the screen centre --------------
//
// A 16×16 block is a 2×2 tile block at the screen centre (tile rows 14-15,
// cols 16-17 → x 128..143, y 112..127). It is large enough for a stable
// centroid and central enough that a sane scroll never wraps it off-screen.

const DX = 2; // px/frame to the right
const DY = 1; // px/frame down

function stripeRom(): Uint8Array {
  const white = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => 2)); // colour 2
  const black = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => 1)); // colour 1
  const tiles = [white, black]; // tile 0 = white block, tile 1 = black field
  // BG palette (CGRAM 0): index 2 = white (the block), index 1 = black (field).
  const bg: Rgb15[] = Array.from({ length: 16 }, (_, i) =>
    i === 0 ? { r: 0, g: 0, b: 0, transparent: true }
    : i === 1 ? { r: 0, g: 0, b: 0, transparent: false }
    : i === 2 ? { r: 31, g: 31, b: 31, transparent: false }
    : { r: 0, g: 0, b: 0, transparent: false });
  // The white block occupies the 2×2 tile block at (rows 14-15, cols 16-17);
  // everything else is the black field.
  const tilemap: TilemapEntry[] = [];
  for (let r = 0; r < 32; r++) {
    for (let c = 0; c < 32; c++) {
      const isBlock = r >= 14 && r <= 15 && c >= 16 && c <= 17;
      tilemap.push({ tile: isBlock ? 0 : 1, palette: 0, flipX: false, flipY: false, priority: false });
    }
  }
  const compact = buildVramCompact({
    mode: 2, // 4bpp, 8×8
    tiles,
    palettes: [bg],
    tilemap,
    tileBase: 0,
    paletteBase: 0,
    mapBase: 0x8000,
  });

  // The EXACT program the system-prompt recipe prescribes for a scrolling
  // background: bring up the screen, arm the scroll once, then idle. The NMI
  // (armed by bg_scroll_init) is what scrolls it each frame.
  const program = ['reset:', '  jsr vram_load', '  jsr bg_scroll_init', 'idle:', '  bra idle'].join('\n');
  const glue =
    vramGlue(compact.mapBase, compact.bgmode, compact.blocks, 'vram.bin', compact.altMapBase) +
    '\n' +
    bgScrollGlue({ dx: DX, dy: DY });
  // The NMI handler (nmi_move) is the SHARED dispatcher the build bakes the NMI
  // vector at. A scroll-only ROM dispatches exactly bg_scroll. (In the real agent
  // flow this is the separate nmi glue block; a sprite-only or both-service ROM
  // folds spr_move in too — asserted in test/scroll.test.ts.)
  const nmi = nmiGlue(['bg_scroll']);
  const r = assemble(program + '\n' + glue + '\n' + nmi, 0x008000, { 'vram.bin': compact.blob });
  if (!r.ok) throw new Error('assemble failed: ' + r.errors.map((e) => `${e.line}: ${e.message}`).join('; '));
  return buildRomFromResult(r, { title: 'SCROLL' });
}

describe.skipIf(!haveBuild)('BG0 scroll on the REAL snes9x core', () => {
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
    await core.loadRom(stripeRom());
  }, 60_000);

  /**
   * Run `frames` more frames and report the white block: pixel count + centroid.
   * White = the block (BG palette 2); the field is black.
   */
  function block(frames: number): { n: number; cx: number; cy: number } {
    for (let i = 0; i < frames; i++) core.frame();
    const vf = core.lastVideo();
    let n = 0, sx = 0, sy = 0;
    for (let y = 0; y < vf.height; y++) {
      for (let x = 0; x < vf.width; x++) {
        const i = (y * vf.width + x) * 4;
        const r = vf.data[i], g = vf.data[i + 1], b = vf.data[i + 2];
        if (r > 180 && g > 180 && b > 180) { n++; sx += x; sy += y; }
      }
    }
    return n > 0 ? { n, cx: sx / n, cy: sy / n } : { n: 0, cx: NaN, cy: NaN };
  }

  const box = 16 * 16;

  it('1. the white block is present and in the screen centre (screen brought up)', () => {
    const a = block(6);
    // The whole 16×16 block is there (field is black, so white is unambiguous).
    expect(a.n).toBeGreaterThan(box * 0.8);
    // It sits in the centre of the screen (well clear of both edges), drifting a
    // little as the scroll runs — proving the bring-up placed it correctly.
    expect(a.cx).toBeGreaterThan(100);
    expect(a.cx).toBeLessThan(160);
    expect(a.cy).toBeGreaterThan(90);
    expect(a.cy).toBeLessThan(140);
  }, 90_000);

  it('2. it DRIFTS across the screen at the configured ~2:1 H:V rate', () => {
    const before = block(2);
    const after = block(8); // 8 more frames
    // Still the whole block, fully on-screen (a scroll, not a flicker/teleport).
    expect(after.n).toBeGreaterThan(box * 0.8);
    const dx = Math.abs(after.cx - before.cx);
    const dy = Math.abs(after.cy - before.cy);
    // 8 frames: H drifts ~16px (2px/frame), V drifts ~8px (1px/frame).
    expect(dx).toBeGreaterThan(10); // it definitely moved…
    expect(dx).toBeLessThan(24); // …at a sane rate, not runaway.
    expect(dy).toBeGreaterThan(4);
    expect(dy).toBeLessThan(12);
    // The H:V drift ratio matches the configured (dx, dy) = (2, 1) — the
    // signature of a real $210D/$210E scroll offset advancing per frame.
    expect(dx / dy).toBeGreaterThan(1.5);
    expect(dx / dy).toBeLessThan(2.5);
  }, 90_000);
});
