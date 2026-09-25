/**
 * OAM (sprite) toolchain — the byte encoder, the `oam_load` glue, and (when the
 * real snes9x build is present) that a sprite actually RENDERS at the chosen
 * GLOBAL size.
 *
 * The one fact that drives everything here: **sprite size is GLOBAL.** The SNES
 * picks it once, for the whole ROM, via OBJSEL — 8×8 (OBJSEL $00) or 16×16
 * (OBJSEL $60). It is NOT a per-slot field. So one ROM draws every sprite at
 * ONE size, and the glue must bake the right OBJSEL into the `oam_load` routine
 * for whichever size was picked at export.
 *
 * A char is the same 8×8 blob no matter the size — what changes is how many
 * chars one sprite is made of:
 *   * 8×8  sprite = ONE char (any index 0–511).
 *   * 16×16 sprite = a 2×2 block of 4 chars, its `tile` field being the
 *     TOP-LEFT char (even char column). The SNES lays 8×8 chars 16 per row,
 *     so the block is (tile, tile+1, tile+16, tile+17) — bottom pair 16 below.
 *
 * The OAM byte layout is identical for both sizes:
 *   [ HPos(X), VPos(Y), Name[7:0], attr ]
 *   attr = Name[8] | priority<<4 | flipH<<6 | flipV<<7
 * 128 slots × 4 = 512 bytes.
 *
 * Core-free section (always runs) pins the encoder bytes, the per-size OBJSEL,
 * and the generated glue TEXT for both sizes, and proves the `oam_load` glue
 * assembles with the real 65C816 assembler into a valid 256 KB LoROM SFC.
 * Real-core section (skipped when the wasm build is absent) proves the PPU
 * honours OBJSEL — a white sprite renders at 8×8 in one ROM and 16×16 in
 * another, same char, same OAM slot.
 */
import { describe, expect, it, beforeAll } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { WasmCore } from '../src/core/wasm-core';
import type { S9xModule } from '../src/core/wasm-core';
import { assemble } from '../src/asm/assembler';
import { buildRom, ROM_SIZE } from '../src/asm/rom';
import { looksLikeSnesRom } from '../src/core/rom-check';
import { buildVramCompact, vramGlue } from '../src/gfx/vram';
import type { Rgb15 } from '../src/gfx/palette';
import type { TilemapEntry } from '../src/gfx/tilemap';
import {
  OAM_ENTRIES,
  OAM_BYTES,
  OBJSEL_8X8,
  OBJSEL_16X16,
  TM_OBJ_ON,
  OAM_HIDDEN,
  objselFor,
  encodeOamEntry,
  encodeOam,
  oamGlue,
  type OamEntry,
  type OamSize,
} from '../src/gfx/oam';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const JS = resolve(root, 'public/core/build/snes9x.js');
const WASM = resolve(root, 'public/core/build/snes9x.wasm');
const haveBuild = existsSync(JS) && existsSync(WASM);

// --- a palette whose index 1 is a chosen colour (0 = transparent) ----------

function paletteWith(idx: number, r: number, g: number, b: number): Rgb15[] {
  const out: Rgb15[] = [];
  for (let i = 0; i < 16; i++) {
    if (i === 0) out.push({ r: 0, g: 0, b: 0, transparent: true });
    else if (i === idx) out.push({ r, g, b, transparent: false });
    else out.push({ r: 0, g: 0, b: 0, transparent: false });
  }
  return out;
}
const solid = (idx: number): number[][] =>
  Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => idx));
const fullMap = (tile: number): TilemapEntry[] =>
  new Array(1024).fill(0).map(() => ({ tile, palette: 0, flipX: false, flipY: false, priority: false }));

// --- the encoder: 4 bytes per slot, the SNES's exact OAM order --------------

describe('encodeOamEntry — the SNES 4-byte OAM slot order', () => {
  it('[HPos, VPos, Name, attr] in that order', () => {
    expect(Array.from(encodeOamEntry({ tile: 0, x: 5, y: 7 }))).toEqual([5, 7, 0, 0x00]);
    expect(Array.from(encodeOamEntry({ tile: 10, x: 0, y: 0 }))).toEqual([0, 0, 10, 0x00]);
  });

  it('packs Name[8], priority, flipH, flipV into the attr byte', () => {
    // priority 2 → bits 4-5 = 0b01 (<<4 → 0x20); flipH → bit 6 (0x40). attr = 0x60.
    expect(Array.from(encodeOamEntry({ tile: 0, x: 5, y: 7, flipH: true, priority: 2 }))).toEqual([5, 7, 0, 0x60]);
    // flipV → bit 7 (0x80); flipH → 0x40. attr = 0xC0.
    expect(encodeOamEntry({ tile: 0, x: 0, y: 0, flipH: true, flipV: true })[3]).toBe(0xc0);
    // priority 3 → bits 4-5 = 0b11 (0x30).
    expect(encodeOamEntry({ tile: 0, x: 0, y: 0, priority: 3 })[3]).toBe(0x30);
  });

  it('high tile indices (≥ 256) set Name[8] = attr bit 0 and the low Name byte', () => {
    const e = encodeOamEntry({ tile: 300, x: 0, y: 0 }); // 300 = 0x012c
    expect(e[2]).toBe(0x2c); // Name[7:0]
    expect(e[3] & 0x01).toBe(1); // Name[8] set (char 300 lives in the 2nd char bank)
    expect(e[3]).toBe(0x01); // nothing else set
  });

  it('wraps 16-bit coordinate fields into the low byte', () => {
    expect(encodeOamEntry({ tile: 0, x: 256 + 3, y: 256 + 4 })[0]).toBe(3);
    expect(encodeOamEntry({ tile: 0, x: 256 + 3, y: 256 + 4 })[1]).toBe(4);
  });
});

describe('encodeOam — the 512-byte table the program streams', () => {
  it('is exactly 128 slots × 4 bytes', () => {
    const out = encodeOam(new Array(OAM_ENTRIES).fill(null));
    expect(out).toBeInstanceOf(Uint8Array);
    expect(out.length).toBe(OAM_BYTES);
    expect(OAM_ENTRIES * 4).toBe(OAM_BYTES);
  });

  it('leaves unset slots OAM_HIDDEN (VPos = 255 = off-screen)', () => {
    const slots: Array<OamEntry | null> = new Array(OAM_ENTRIES).fill(null);
    const out = encodeOam(slots);
    for (let s = 0; s < OAM_ENTRIES; s++) {
      expect(Array.from(out.slice(s * 4, s * 4 + 4))).toEqual(Array.from(OAM_HIDDEN));
    }
  });

  it('writes the entry at its slot and hides the rest', () => {
    const slots: Array<OamEntry | null> = new Array(OAM_ENTRIES).fill(null);
    slots[42] = { tile: 7, x: 100, y: 50 };
    const out = encodeOam(slots);
    expect(Array.from(out.slice(42 * 4, 42 * 4 + 4))).toEqual([100, 50, 7, 0x00]);
    expect(Array.from(out.slice(41 * 4, 41 * 4 + 4))).toEqual(Array.from(OAM_HIDDEN));
    expect(Array.from(out.slice(43 * 4, 43 * 4 + 4))).toEqual(Array.from(OAM_HIDDEN));
  });
});

// --- the GLOBAL size: OBJSEL ------------------------------------------------

describe('objselFor — the two supported sprite sizes', () => {
  it('8×8 → OBJSEL $00 (OBJSizeSelect 0), 16×16 → OBJSEL $60 (OBJSizeSelect 3)', () => {
    expect(objselFor('8x8')).toBe(OBJSEL_8X8);
    expect(objselFor('16x16')).toBe(OBJSEL_16X16);
    expect(OBJSEL_8X8).toBe(0x00);
    expect(OBJSEL_16X16).toBe(0x60);
  });

  it('is the ONLY thing that differs between the two sizes — the OAM layout is size-agnostic', () => {
    // The same entry encodes identically for both sizes; only OBJSEL changes.
    const e = { tile: 0, x: 5, y: 7 };
    expect(Array.from(encodeOamEntry(e))).toEqual([5, 7, 0, 0x00]);
    expect(objselFor('8x8')).not.toBe(objselFor('16x16'));
  });
});

// --- the `oam_load` glue: per-size OBJSEL, no PPU reads ---------------------

describe('oamGlue — the generated oam_load routine', () => {
  for (const size of ['8x8', '16x16'] as const) {
    it(`bakes the ${size} OBJSEL and the shared OAM setup (${size})`, () => {
      const g = oamGlue('oam.bin', size);
      const expectedSel = size === '8x8' ? 0x00 : 0x60;
      const hre = (n: number) => '\\$' + n.toString(16).padStart(2, '0');
      // The chosen OBJSEL is written to $2101.
      expect(g).toMatch(new RegExp(`lda #${hre(expectedSel)}[\\s\\S]*?sta \\$2101`));
      // OAMADDR = 0 (both $2102 and $2103), then TM turns on BG0 + OBJ. The
      // zero is loaded with `lda #0` (the OBJSEL immediate is `#$00`/`#$60`).
      expect(g).toMatch(/lda #0[\s\S]*?sta \$2102/);
      expect(g).toMatch(/sta \$2103/);
      expect(g).toMatch(new RegExp(`lda #${hre(TM_OBJ_ON)}[\\s\\S]*?sta \\$212c`));
      // 128 slots, streamed one byte at a time through the OAM port $2104.
      expect(g).toMatch(new RegExp(`ldx #${hre(OAM_ENTRIES)}\\s*; 128 slots`));
      expect(g).toMatch(/sta \$2104/);
      // The data is the embedded oam.bin.
      expect(g).toContain('.incbin "oam.bin"');
      // The routine is self-contained: pure 8-bit, ends with rts.
      expect(g).toMatch(/oam_load:/);
      expect(g).toMatch(/rts/);
    });

    it(`NEVER reads a PPU register back (${size}) — this fork returns OpenBus garbage on reads`, () => {
      const g = oamGlue('oam.bin', size);
      // `lda $21xx` would be a PPU-register read. There must be none.
      expect(g).not.toMatch(/lda \$21[0-9a-f][0-9a-f]/);
    });
  }

  it('8×8 vs 16×16 glue differ ONLY in the OBJSEL byte (OBJSizeSelect bit)', () => {
    const g8 = oamGlue('oam.bin', '8x8');
    const g16 = oamGlue('oam.bin', '16x16');
    expect(g8).toMatch(/lda #\$00[\s\S]*?sta \$2101/);
    expect(g16).toMatch(/lda #\$60[\s\S]*?sta \$2101/);
    // Everything else is the same table stream — only the OBJSEL byte moves.
    // The size is ALSO spelled into a comment, so strip comments and the OBJSEL
    // immediate before comparing to isolate the machine-code.
    const norm = (g: string) =>
      g
        .split('\n')
        .map((l) => l.split(';')[0])
        .join('\n')
        .replace('lda #$00', 'OBJSEL')
        .replace('lda #$60', 'OBJSEL');
    expect(norm(g8)).toBe(norm(g16));
  });

  it('honours a custom data file name', () => {
    expect(oamGlue('sprites.bin', '16x16')).toContain('.incbin "sprites.bin"');
  });
});

// --- real assembler → a valid 256 KB LoROM SFC (core-free) ------------------

describe('oam_load assembles into a runnable 256 KB LoROM SFC (core-free)', () => {
  for (const size of ['8x8', '16x16'] as const) {
    it(`${size}: program + oam_load glue + oam.bin assembles and builds a valid cart`, () => {
      const slots: Array<OamEntry | null> = new Array(OAM_ENTRIES).fill(null);
      slots[0] = { tile: size === '8x8' ? 5 : 0, x: 124, y: 108 };
      const oam = encodeOam(slots);

      const program = ['reset:', '  jsr oam_load', 'idle:', '  bra idle'].join('\n');
      const r = assemble(program + '\n' + oamGlue('oam.bin', size), 0x008000, { 'oam.bin': oam });
      expect(r.errors).toEqual([]);
      expect(r.ok).toBe(true);
      // The OAM table is inlined at the end (`.incbin "oam.bin"`).
      expect(r.bytes.length).toBeGreaterThan(oam.length);

      const rom = buildRom(r.bytes, { title: 'SPRITE' });
      expect(rom.length).toBe(ROM_SIZE); // 256 KB
      expect(looksLikeSnesRom(rom)).toBe(true);
      // Reset vector at file $7FFC → CPU $8000 (bytes 00 80) = LoROM code-at-$0000.
      expect(rom[0x7ffc]).toBe(0x00);
      expect(rom[0x7ffd]).toBe(0x80);
      // ROMSize field inside the $7FB0 cart header marks 256 KB.
      expect(rom[0x7fd7]).toBe(0x08);
    });
  }
});

// --- real core: the PPU honours the GLOBAL sprite size ----------------------

describe.skipIf(!haveBuild)('sprite size on the REAL snes9x core', () => {
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

  /**
   * One char painted solid "colour index 1". As a BACKGROUND tile it samples
   * the BG palette (index 1 = black); as a SPRITE it samples the OBJ palette
   * (index 1 = white). Same char, two CGRAM palettes — exactly the OBJ-palette
   * mechanism. Composed into a 256 KB SFC at the given GLOBAL sprite size.
   *
   * Mode is **4bpp (mode 2, 8×8)**: in 4-bit mode the sprite's CGRAM palette
   * is `128 + OAM-palette*16` (ppu.c StartPalette=128 + Depth4 converter), so
   * OAM palette 0 → CGRAM palette 8 = exactly where the OBJ palette lands. In
   * the default 2bpp mode the SNES uses the colour-pair format, where that
   * clean 1-to-1 palette mapping does not hold — the test is about SIZE, so we
   * pick the mode where the documented OBJ-palette rule is unambiguous.
   */
  function spriteRom(size: OamSize, x: number, y: number): Uint8Array {
    // 18 solid chars: a 16×16 sprite's 2×2 block is (0,1,16,17), so chars 16 and
    // 17 MUST be painted too — the SNES lays 8×8 chars 16 per row, not 8.
    const tiles = Array.from({ length: 18 }, () => solid(1));
    const bg = paletteWith(1, 0, 0, 0); // BG palette:  index 1 = black
    const obj = paletteWith(1, 31, 31, 31); // OBJ palette: index 1 = white
    const compact = buildVramCompact({
      mode: 2,
      tiles,
      palettes: [bg],
      objPalette: obj,
      tilemap: fullMap(0),
      tileBase: 0,
      paletteBase: 0,
      mapBase: 0x8000,
    });
    const slots: Array<OamEntry | null> = new Array(OAM_ENTRIES).fill(null);
    // priority 2: a priority 0–1 sprite draws UNDER a non-priority background
    // (snes9x z-depths: sprite = 36 + 4·P, 4bpp BG0 = 39) — priority 2–3 draws
    // OVER it. Without this the full-screen background simply covers the sprite.
    slots[0] = { tile: 0, x, y, priority: 2 }; // top-left char 0 → (0,1,16,17) for a 16×16
    const oam = encodeOam(slots);

    const program = ['reset:', '  jsr vram_load', '  jsr oam_load', 'idle:', '  bra idle'].join('\n');
    const glue =
      vramGlue(compact.mapBase, compact.bgmode, compact.blocks, 'vram.bin', compact.altMapBase) +
      '\n' +
      oamGlue('oam.bin', size);
    const r = assemble(program + '\n' + glue, 0x008000, { 'vram.bin': compact.blob, 'oam.bin': oam });
    if (!r.ok) throw new Error('assemble failed: ' + r.errors.map((e) => `${e.line}: ${e.message}`).join('; '));
    return buildRom(r.bytes, { title: 'SPRITE' });
  }

  /** Render a ROM, then expose per-pixel box counters (white / black). */
  async function render(rom: Uint8Array, frames = 6) {
    await core.loadRom(rom);
    for (let i = 0; i < frames; i++) core.frame();
    const vf = core.lastVideo();
    const px = (x: number, y: number): [number, number, number] => {
      const i = (y * vf.width + x) * 4;
      return [vf.data[i], vf.data[i + 1], vf.data[i + 2]];
    };
    const count = (x0: number, y0: number, w: number, h: number, is: (r: number, g: number, b: number) => boolean): number => {
      let n = 0;
      for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
        const [r, g, b] = px(x, y);
        if (is(r, g, b)) n++;
      }
      return n;
    };
    const white = (x0: number, y0: number, w: number, h: number) => count(x0, y0, w, h, (r, g, b) => r > 200 && g > 200 && b > 200);
    const black = (x0: number, y0: number, w: number, h: number) => count(x0, y0, w, h, (r, g, b) => r < 30 && g < 30 && b < 30);
    return { white, black };
  }

  it('8×8: the white char renders as an 8×8 sprite at its OAM position', async () => {
    const rom = spriteRom('8x8', 124, 108);
    const { white, black } = await render(rom);
    const box = 8 * 8;
    // The 8×8 sprite box is (nearly) all white.
    expect(white(124, 108, 8, 8)).toBeGreaterThan(box * 0.8);
    // A far corner of the background is (nearly) all black.
    expect(black(0, 0, 8, 8)).toBeGreaterThan(box * 0.8);
    // A box JUST OUTSIDE the sprite is background (black) — proves the sprite is
    // bounded at 8×8, not bleeding into a 16×16.
    expect(black(124, 116, 8, 8)).toBeGreaterThan(box * 0.8);
  }, 90_000);

  it('16×16: the same char renders as a 16×16 sprite (double the 8×8 area)', async () => {
    const rom = spriteRom('16x16', 120, 104);
    const { white, black } = await render(rom);
    const box = 16 * 16;
    // The 16×16 sprite box is (nearly) all white.
    expect(white(120, 104, 16, 16)).toBeGreaterThan(box * 0.8);
    // A far corner of the background is (nearly) all black.
    expect(black(0, 0, 8, 8)).toBeGreaterThan(8 * 8 * 0.8);
    // A box OUTSIDE the 16×16 sprite is background (black) — proves the 2×2
    // chars formed ONE 16×16 sprite, not four separate 8×8 ones.
    expect(black(120, 120, 16, 16)).toBeGreaterThan(box * 0.8);
  }, 90_000);
});
