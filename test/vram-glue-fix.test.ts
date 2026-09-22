/**
 * `vram-glue-fix` — verify the `vram_load` bring-up glue (src/gfx/vram.ts)
 * actually produces a VISIBLE screen on the REAL snes9x core, and prove the
 * two root causes of the "pure black screen" bug are fixed:
 *
 *   Bug #1 (immediate): `lda ${bgmode}` / `lda ${nba}` were BARE values → the
 *     65C816 reads them as ZERO-PAGE loads, loading ZP garbage ($55 on reset)
 *     into BGMODE ($2105) and BG12NBA ($210b). Fixed: `lda #…` (immediate).
 *
 *   Bug #2 (blanking order): the glue UNBLANKED
 *     (INIDISP=$0f → ForcedBlanking=FALSE) BEFORE the VRAM fill. snes9x ships
 *     with `Settings.BlockInvalidVRAMAccess=TRUE`, so with forced-blanking off
 *     and V_Counter in the visible range, `CHECK_INBLANK` is false and EVERY
 *     $2118/$2119 write is silently dropped → VRAM empty → pure black. Fixed:
 *     keep INIDISP=$80 (forced-blank ON) through the entire fill and unblank
 *     only at `vram_done`, after the last word is in.
 *
 *   Bug #3 (NameBase/SCBase swap) — the dominant cause of the residual black
 *     screen: the glue wrote the TILEMAP position into BG12NBA ($210b) and left
 *     BG0SC ($2107) at 0. But snes9x's BG12NBA selects the tile CHAR-DATA base
 *     (ppu.c: `NameBase=(Byte&7)<<12`, `TileAddress=NameBase<<1`), and BG0SC
 *     selects the TILEMAP base (`SCBase=(Byte&0x7c)<<8`, `SC0=&VRAM[SCBase<<1]`).
 *     So the PPU read char data from empty VRAM and the tilemap from the char
 *     data → black. Fixed: BG0SC=(mapBase>>9)&0x7c (tilemap), BG12NBA=0 (chars
 *     at byte $0000).
 *
 * Core-free section (always runs) asserts the generated text has the right
 * blanking order + immediates + both base registers. The real-core section
 * (skipped if the wasm build is absent) builds a small checkerboard ROM with
 * the fixed glue and asserts the rendered frame is non-black, then runs the
 * SAME ROM with the NameBase/SCBase swap reintroduced and asserts it IS black
 * — the differential that pins the dominant root cause to the base registers.
 * (The blanking-order differential does NOT reproduce black on this snes9x
 * build — the CHECK_INBLANK gate does not actually drop the ROM's writes here —
 * so it was retired in favour of the swap, which is the real cause.)
 */
import { describe, expect, it, beforeAll } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { WasmCore } from '../src/core/wasm-core';
import type { S9xModule } from '../src/core/wasm-core';
import { assemble } from '../src/asm/assembler';
import { buildRom } from '../src/asm/rom';
import { buildVramCompact, vramGlue, type VramBlock } from '../src/gfx/vram';
import type { Rgb15 } from '../src/gfx/palette';
import type { TilemapEntry } from '../src/gfx/tilemap';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const JS = resolve(root, 'public/core/build/snes9x.js');
const WASM = resolve(root, 'public/core/build/snes9x.wasm');
const haveBuild = existsSync(JS) && existsSync(WASM);

const hex = (n: number, w = 2): string => (n >>> 0).toString(16).padStart(w, '0').toUpperCase();

// ---------------------------------------------------------------------------
// Build a small but real ROM: a 2-tile checkerboard, one palette, full map.
// Uses the FIXED pure functions from src/gfx/vram.ts.
// ---------------------------------------------------------------------------

function sampleGraphics() {
  const size = 8;
  const solid = (idx: number): number[][] =>
    Array.from({ length: size }, () => Array.from({ length: size }, () => idx));
  // tile 0 = palette idx 1 (white), tile 1 = palette idx 2 (red). Both opaque.
  const tiles = [solid(1), solid(2)];
  const palette: Rgb15[] = Array.from({ length: 16 }, (_, i) => {
    if (i === 0) return { r: 0, g: 0, b: 0, transparent: true };
    if (i === 1) return { r: 31, g: 31, b: 31, transparent: false }; // white
    if (i === 2) return { r: 31, g: 0, b: 0, transparent: false }; // red
    return { r: 0, g: 0, b: 0, transparent: false }; // opaque black
  });
  // 32×32 checkerboard of the two opaque tiles → the whole screen is non-black.
  const map: TilemapEntry[] = [];
  for (let row = 0; row < 32; row++) {
    for (let col = 0; col < 32; col++) {
      map.push({ tile: (row + col) & 1, palette: 0, flipX: false, flipY: false, priority: false });
    }
  }
  return { tiles, palette, map };
}

/**
 * Compose program + glue, assemble with the compact VRAM blob as `.incbin`,
 * and build a 256 KB SFC. `glue` is the exact text to bake (fixed, or the
 * differential bug-reintroduced variant).
 */
function composeRom(glue: string): Uint8Array {
  const { tiles, palette, map } = sampleGraphics();
  const compact = buildVramCompact({
    mode: 0, // 4-bit 8×8
    tiles,
    palettes: [palette],
    tilemap: map,
    tileBase: 0,
    paletteBase: 0,
    mapBase: 0x8000, // authoring default; buildVramCompact re-homes the map
  });
  const program = ['JSR vram_load', 'idle:', 'BRA idle'].join('\n');
  const r = assemble(program + '\n' + glue, 0x008000, { 'vram.bin': compact.blob });
  if (!r.ok) throw new Error('assemble failed: ' + r.errors.map((e) => e.message).join('; '));
  return buildRom(r.bytes, { title: 'HELLOWORLD' });
}

// --- core-free: the generated glue TEXT must have the correct order --------

describe('vramGlue — blanking order + immediates (core-free)', () => {
  const blocks: VramBlock[] = [
    { dest: 0x0, len: 1 },
    { dest: 0x800, len: 1 },
  ];
  const g = vramGlue(0x1000, 0, blocks, 'vram.bin');

  it('forces blank ON before the fill and unblanks only after it', () => {
    const firstInidisp = g.indexOf('sta $2100');
    expect(firstInidisp).toBeGreaterThan(-1);
    // The write right before the FIRST $2100 write is forced-blank ON ($80).
    expect(g.slice(firstInidisp - 24, firstInidisp)).toContain('lda #$80');
    // The LAST $2100 write is the unblank ($0f), and it must sit AFTER
    // `vram_done:` (i.e. after the entire VRAM fill loop has run).
    const lastInidisp = g.lastIndexOf('sta $2100');
    expect(g.slice(lastInidisp - 24, lastInidisp)).toContain('lda #$0f');
    const vramDone = g.indexOf('vram_done:');
    expect(vramDone).toBeGreaterThan(-1);
    expect(lastInidisp).toBeGreaterThan(vramDone);
  });

  it('emits immediates for BGMODE / BG0SC / BG12NBA (bare values would be ZP reads)', () => {
    // The `lda` must sit on the line immediately ABOVE each PPU register write.
    // (A fixed-char window breaks when a comment sits between the lda and sta.)
    // Return the full line immediately ABOVE the marker's line.
    const lineBefore = (marker: string): string => {
      const idx = g.indexOf(marker);
      const curLineStart = g.lastIndexOf('\n', idx - 1);              // \n before marker's line
      const prevLineStart = g.lastIndexOf('\n', curLineStart - 1) + 1; // start of the line above
      return g.slice(prevLineStart, curLineStart).trim();
    };
    // BGMODE
    expect(g.indexOf('sta $2105')).toBeGreaterThan(-1);
    expect(lineBefore('sta $2105')).toMatch(/^lda #\$[0-9a-f]+/);
    // BG0SC — the SCBase tilemap window (this is the one that was missing)
    expect(g.indexOf('sta $2107')).toBeGreaterThan(-1);
    expect(lineBefore('sta $2107')).toMatch(/^lda #\$[0-9a-f]+/);
    // BG12NBA — the NameBase char-data window
    expect(g.indexOf('sta $210b')).toBeGreaterThan(-1);
    expect(lineBefore('sta $210b')).toMatch(/^lda #\$[0-9a-f]+/);
  });
});

// --- real core: fixed glue renders non-black; buggy glue renders black -----

describe.skipIf(!haveBuild)('vram glue on the REAL snes9x core', () => {
  let M: S9xModule;
  let core: WasmCore;

  beforeAll(async () => {
    const src = readFileSync(JS, 'utf8');
    const factory = new Function(`${src}\n;return snesWasm;`)() as unknown as (m: object) => Promise<S9xModule>;
    const wasmB64 = readFileSync(WASM, 'base64');
    M = await factory({
      locateFile: (f: string) => (f === 'snes9x.wasm' ? `data:application/wasm;base64,${wasmB64}` : f),
      print: () => {}, printErr: () => {}, out: () => {}, err: () => {},
    });
    core = new WasmCore(M, []);
  }, 60_000);

  /** Run a ROM and report observable screen/VRAM state. */
  async function runAndProbe(rom: Uint8Array, frames = 4) {
    await core.loadRom(rom);
    for (let i = 0; i < frames; i++) core.frame();
    const pc = M._core_reg_pc() & 0xffffff;

    const vram = core.readVram();
    const nonZero = (start: number, len: number): number => {
      let n = 0;
      for (let i = start; i < start + len; i++) if (vram[i] !== 0) n++;
      return n;
    };

    const vf = core.lastVideo();
    let nonBlack = 0;
    for (let i = 0; i < vf.data.length; i += 4) {
      if (vf.data[i] !== 0 || vf.data[i + 1] !== 0 || vf.data[i + 2] !== 0) nonBlack++;
    }
    const total = vf.data.length / 4;

    return {
      pc,
      vramTiles: nonZero(0x0, 0x40),
      vramMap: nonZero(0x1000, 0x1000),
      vramPal: nonZero(0xc000, 0x100),
      nonBlack,
      total,
    };
  }

  it('fixed glue → VRAM populated + a NON-black screen', async () => {
    const { tiles, palette, map } = sampleGraphics();
    const compact = buildVramCompact({
      mode: 0, tiles, palettes: [palette], tilemap: map,
      tileBase: 0, paletteBase: 0, mapBase: 0x8000,
    });
    const glue = vramGlue(compact.mapBase, compact.bgmode, compact.blocks, 'vram.bin');
    const rom = composeRom(glue);

    const p = await runAndProbe(rom);
    console.log(
      `[fixed] PC=$${hex(p.pc, 6)} VRAM tiles=${p.vramTiles} map=${p.vramMap} pal=${p.vramPal} ` +
        `screen non-black=${p.nonBlack}/${p.total}`,
    );
    // The fill must have landed: char region and map region non-zero in VRAM.
    // NOTE: `vramPal` is 0 BY DESIGN — snes9x's $2122 CGDATA write (REGISTER_2122)
    // populates PPU.CGDATA and IPPU.ScreenColors, and never touches Memory.VRAM,
    // so the CGRAM is not observable via readVram(). The rendered-screen check
    // below is the real proof the palette took effect.
    expect(p.vramTiles).toBeGreaterThan(0);
    expect(p.vramMap).toBeGreaterThan(0);
    // And the screen must actually render (the checkerboard covers it all).
    expect(p.nonBlack).toBeGreaterThan(p.total * 0.5);
  }, 90_000);

  it('differential: reintroducing the NameBase/SCBase swap → BLACK screen', async () => {
    const { tiles, palette, map } = sampleGraphics();
    const compact = buildVramCompact({
      mode: 0, tiles, palettes: [palette], tilemap: map,
      tileBase: 0, paletteBase: 0, mapBase: 0x8000,
    });
    const fixed = vramGlue(compact.mapBase, compact.bgmode, compact.blocks, 'vram.bin');

    // Reintroduce bug #3 (the true root cause of the black screen): the two
    // PPU base registers were conflated. The fixed glue emits
    //   `lda #$08 / sta $2107` (BG0SC — SCBase → tilemap) and
    //   `lda #$00 / sta $210b` (BG12NBA — NameBase → char data).
    // Swap them back: drop the tilemap base (BG0SC=$00 → the PPU reads the
    // "map" from byte $0000, where the char data actually lives) and move the
    // char base (BG12NBA=$01 → the PPU reads tiles from byte $2000, where
    // nothing is). The PPU then resolves every tile to empty VRAM → black.
    // NB: in a JS `replace` replacement string, `$` + digits is a capture-group
    // reference, so a literal hex immediate must be `$$xx` (or it collapses).
    const buggy = fixed
      .replace(/lda #\$08[^\n]*\n([ \t]*)sta \$2107/, 'lda #$$00          ; BG0SC (BUG: tilemap base lost)\n$1sta $$2107')
      .replace(/lda #\$00[^\n]*\n([ \t]*)sta \$210b/, 'lda #$$01          ; BG12NBA (BUG: char base → byte $$2000)\n$1sta $$210b');
    expect(buggy).not.toBe(fixed); // the transform took effect (not a no-op)

    const p = await runAndProbe(composeRom(buggy));
    console.log(
      `[buggy] PC=$${hex(p.pc, 6)} VRAM tiles=${p.vramTiles} map=${p.vramMap} pal=${p.vramPal} ` +
        `screen non-black=${p.nonBlack}/${p.total}`,
    );
    // The swap points the PPU at empty VRAM → the screen is (near-)black.
    // This is the differential: same ROM + same VRAM, only the two bases differ.
    expect(p.nonBlack).toBeLessThan(p.total * 0.5);
  }, 90_000);
});

describe('harness availability', () => {
  it('records whether the wasm build is present (so CI degrades, not breaks)', () => {
    expect(haveBuild).toBeTypeOf('boolean');
    if (!haveBuild) console.warn('[vram-glue-fix] snes9x.{js,wasm} absent — skipping real-core runs');
  });
});
