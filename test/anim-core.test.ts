/**
 * Sprite char-swap animation, end-to-end, on the REAL snes9x core.
 *
 * The program is written EXACTLY as the system-prompt recipe:
 *
 *   reset:
 *     jsr vram_load
 *     jsr oam_load
 *     jsr spr_init
 *     jsr anim_init
 *   idle:
 *     bra idle
 *
 * `spr_init` parks the d-pad position ($2b/$2c) AND arms the NMI; `anim_init`
 * parks the char phase and re-arms it (idempotent). Both are in the ROM because
 * the NMI dispatcher runs `spr_move` (holds the position) AND `anim_tick`
 * (swaps the char) — the two coexist in one NMI on the real PPU.
 *
 * i.e. the ROM NEVER touches the sprite's picture itself — `anim_init` arms the
 * once-per-vblank NMI and the shared NMI dispatcher (nmiGlue) runs `anim_tick`
 * once per frame, which steps a baked char table and writes the current Name+attr
 * into the slot's OAM **word1**. This proves on the real PPU, on-screen:
 *
 *   1. the sprite is present, parked at the centre, and HOLDS its position —
 *      because `oam_load` writes word0 (position) and `anim_tick` writes only
 *      word1 (Name+attr), the two words are independent and the sprite does not
 *      wander (this is the "walk without running away" contract — the char can
 *      change while the d-pad position from spr_move/oam_load stays put);
 *   2. the sprite's PICTURE CHANGES over time — the char cycles through the
 *      baked sequence, so the pixel colour at the sprite turns red→green→blue→
 *      yellow. A static sprite (no working char-swap) would stay one colour.
 *      Only a per-frame $2104 word1 write (Name then attr) driven by the NMI can
 *      do that — a ROM that never writes the char is a single fixed tile.
 *
 * The sprite is a solid 8×8 (OBJ palette index 1-4 = red/green/blue/yellow;
 * colour 0 transparent) over a solid BLACK background (BG palette index 1 =
 * black), 4bpp mode — so the sprite's pixel colour is exactly the current char,
 * unambiguous. (The core-free glue/dispatcher contracts live in test/anim.test.ts;
 * this file is the real-PPU proof, the way test/spr-move.test.ts is for the
 * d-pad tick. Skipped when the wasm build is absent.)
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
import { OAM_ENTRIES, encodeOam, oamGlue, type OamEntry } from '../src/gfx/oam';
import { nmiGlue, scrollStepsFromSource } from '../src/gfx/scroll';
import { spriteAnimGlue } from '../src/gfx/anim';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const JS = resolve(root, 'public/core/build/snes9x.js');
const WASM = resolve(root, 'public/core/build/snes9x.wasm');
const haveBuild = existsSync(JS) && existsSync(WASM);

/** A char that is a solid fill of palette index `idx` (8×8). */
const solid = (idx: number): number[][] =>
  Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => idx));

/** OBJ (sprite) palette: index 1-4 = red / green / blue / yellow, rest black. */
function objPalette(): Rgb15[] {
  const cols: Record<number, [number, number, number]> = {
    1: [31, 0, 0], // red
    2: [0, 31, 0], // green
    3: [0, 0, 31], // blue
    4: [31, 31, 0], // yellow
  };
  const out: Rgb15[] = [];
  for (let i = 0; i < 16; i++) {
    if (i === 0) out.push({ r: 0, g: 0, b: 0, transparent: true });
    else if (cols[i]) out.push({ r: cols[i][0], g: cols[i][1], b: cols[i][2], transparent: false });
    else out.push({ r: 0, g: 0, b: 0, transparent: false });
  }
  return out;
}
/** BG palette: every non-transparent index is black (so the field is black). */
function bgPalette(): Rgb15[] {
  const out: Rgb15[] = [];
  for (let i = 0; i < 16; i++) {
    out.push(i === 0 ? { r: 0, g: 0, b: 0, transparent: true } : { r: 0, g: 0, b: 0, transparent: false });
  }
  return out;
}
const fullMap = (tile: number): TilemapEntry[] =>
  new Array(1024).fill(0).map(() => ({ tile, palette: 0, flipX: false, flipY: false, priority: false }));

const SKIP = 2; // one char every 2 frames

/**
 * The animated-sprite ROM: an 8×8 sprite in slot 0 at (128,112) whose char
 * cycles through four solid colours, over a black background, with the EXACT
 * system-prompt program (init once, then idle).
 */
function animRom(): Uint8Array {
  // Chars 0-3: solid fills of OBJ-palette indices 1-4 (red/green/blue/yellow).
  // The same char sampled by the BG (palette 0, index→black) is black, so the
  // background is a black field while the sprite (palette 8) shows the colour.
  const tiles = [solid(1), solid(2), solid(3), solid(4)];
  const compact = buildVramCompact({
    mode: 2, // 4bpp, 8×8
    tiles,
    palettes: [bgPalette()], // BG palette: index 1 = black
    objPalette: objPalette(), // OBJ palette: index 1-4 = red/green/blue/yellow
    tilemap: fullMap(0), // the whole background is char 0 (→ black)
    tileBase: 0,
    paletteBase: 0,
    mapBase: 0x8000,
  });
  // Slot 0 = the animated sprite, parked at the centre, priority 2 (over the
  // black background). The tile here is just the starting char — anim_tick
  // overwrites the Name every frame anyway.
  const slots: Array<OamEntry | null> = new Array(OAM_ENTRIES).fill(null);
  slots[0] = { tile: 0, x: 128, y: 112, priority: 2 };
  const oam = encodeOam(slots);

  // `spr_init` parks the position ($2b/$2c) that the NMI's `spr_move` service
  // re-writes each frame; `anim_init` parks the char phase. Both arm the NMI.
  const program = ['reset:', '  jsr vram_load', '  jsr oam_load', '  jsr spr_init', '  jsr anim_init', 'idle:', '  bra idle'].join('\n');
  const glue =
    vramGlue(compact.mapBase, compact.bgmode, compact.blocks, 'vram.bin', compact.altMapBase) +
    '\n' +
    oamGlue('oam.bin', '8x8') +
    '\n' +
    spriteAnimGlue({ tiles: [0, 1, 2, 3], slot: 0, skip: SKIP, priority: 2 });
  // The NMI handler (nmi_move) is the SHARED dispatcher the build bakes the NMI
  // vector at. Here it runs BOTH spr_move (from oamGlue — holds the d-pad
  // position; a no-op with no input) AND anim_tick (the char cycle) — proving
  // the two coexist in one NMI on the real PPU.
  const nmi = nmiGlue(scrollStepsFromSource(glue));
  const r = assemble(program + '\n' + glue + (nmi ? '\n' + nmi : ''), 0x008000, { 'vram.bin': compact.blob, 'oam.bin': oam });
  if (!r.ok) throw new Error('assemble failed: ' + r.errors.map((e) => `${e.line}: ${e.message}`).join('; '));
  return buildRomFromResult(r, { title: 'SPRANIM' });
}

/** Classify a pixel into one of the four sprite colours (or 'bg' = black field). */
function classify(r: number, g: number, b: number): string {
  if (r > 150 && g > 150 && b < 90) return 'yellow';
  if (r > 150 && g < 90 && b < 90) return 'red';
  if (g > 150 && r < 90 && b < 90) return 'green';
  if (b > 150 && r < 90 && g < 90) return 'blue';
  return 'bg';
}

describe.skipIf(!haveBuild)('sprite char-swap animation on the REAL snes9x core', () => {
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
    await core.loadRom(animRom());
  }, 60_000);

  /**
   * Run `frames` more frames, scanning the sprite region each frame. Returns the
   * last frame's non-black pixel count + centroid, and the SET of distinct sprite
   * colours seen across the whole window (a static sprite shows one; a cycling
   * one shows the whole sequence).
   */
  function sample(frames: number): { n: number; cx: number; cy: number; colors: number } {
    const seen = new Set<string>();
    let n = 0, cx = NaN, cy = NaN;
    for (let i = 0; i < frames; i++) {
      core.frame();
      const vf = core.lastVideo();
      let px = 0, sx = 0, sy = 0;
      for (let y = 104; y < 128; y++) {
        for (let x = 120; x < 144; x++) {
          const idx = (y * vf.width + x) * 4;
          const c = classify(vf.data[idx], vf.data[idx + 1], vf.data[idx + 2]);
          if (c !== 'bg') { px++; sx += x; sy += y; seen.add(c); }
        }
      }
      n = px;
      if (px > 0) { cx = sx / px; cy = sy / px; }
    }
    return { n, cx, cy, colors: seen.size };
  }

  it('1. the sprite is present, parked at the centre, and HOLDS its position', () => {
    const a = sample(6);
    // The 8×8 sprite (64 px) is there — at least half of it in the window.
    expect(a.n).toBeGreaterThan(30);
    // Parked at (128,112): the 8×8 block's centroid ≈ (131.5, 115.5).
    expect(a.cx).toBeGreaterThan(126);
    expect(a.cx).toBeLessThan(138);
    expect(a.cy).toBeGreaterThan(108);
    expect(a.cy).toBeLessThan(122);
    // More frames: still there, same place — word0 (position) untouched while
    // word1 (Name) is being rewritten by anim_tick each frame.
    const b = sample(6);
    expect(b.n).toBeGreaterThan(30);
    expect(Math.abs(b.cx - a.cx)).toBeLessThan(3);
    expect(Math.abs(b.cy - a.cy)).toBeLessThan(3);
  }, 90_000);

  it('2. the PICTURE CHANGES — the char cycles through the baked sequence', () => {
    // One full cycle is K*SKIP = 4*2 = 8 frames; over 24 we see every colour.
    // A static (never-char-swapped) sprite would show exactly ONE colour.
    const c = sample(24);
    expect(c.colors).toBeGreaterThanOrEqual(3);
    // …and it is still the same sprite in the same place (we changed the
    // picture, not the sprite's position).
    expect(c.n).toBeGreaterThan(30);
    expect(c.cx).toBeGreaterThan(126);
    expect(c.cx).toBeLessThan(138);
  }, 90_000);
});
