/**
 * `buildVram` — compile authored tiles + palettes + a tilemap into a raw 64 KB
 * SNES VRAM image. The graphics analog of `buildRom` in `src/asm/rom.ts`:
 * the output is a flat `Uint8Array` you can dump to a `.bin` and load into your
 * own project. **No ROM, no 65C816** — just the compiled PPU graphics data.
 *
 * Layout within the 64 KB (matching a real SNES PPU):
 *   - tile graphics:  `tileBase` char slots onward (lower 32 KB)
 *   - CGRAM palettes: `$C000 + paletteBase*32` onward
 *   - tilemap (SC0):  `mapBase` byte offset onward (1024 × 16-bit entries)
 *
 * Pure TS, no DOM — unit-testable in the node env like the rest of `src/asm/`.
 */

import { charBytesForMode, encodeTileAt, tileCharStride } from './tile-encode';
import { encodePalette, cgramOffset, type Rgb15 } from './palette';
import { encodeTilemapAt, MAP_BYTES, type TilemapEntry } from './tilemap';

/** 64 KB PPU VRAM (matches `VRAM_SIZE` in `src/core/types.ts`). */
export const VRAM_SIZE = 0x10000;

export interface BuildVramOptions {
  /** Background mode 0-7 (selects tile depth/size — see `MODES` in tile-encode). */
  mode: number;
  /**
   * Tiles to encode, each a `size×size` grid of palette indices (`size` from
   * the mode). Tile `i` is placed at char slot `tileBase + i * stride`.
   */
  tiles: number[][][];
  /**
   * Palettes (each 16 colors) to write to CGRAM. Palette `i` at CGRAM index
   * `paletteBase + i`.
   */
  palettes: Rgb15[][];
  /** Optional tilemap entries (up to 1024) placed at `mapBase`. */
  tilemap?: TilemapEntry[];
  /** Base 8×8 char slot for tile 0. Default 0. */
  tileBase?: number;
  /** Base CGRAM palette index for palette 0. Default 0. */
  paletteBase?: number;
  /** Byte offset in VRAM where the tilemap starts. Default 0. */
  mapBase?: number;
}

/**
 * Build the 64 KB VRAM image. Zero-initialized, with tiles, palettes, and
 * tilemap written at their bases. Throws if any region would exceed VRAM.
 */
export function buildVram(opts: BuildVramOptions): Uint8Array {
  const {
    mode,
    tiles,
    palettes,
    tilemap,
    tileBase = 0,
    paletteBase = 0,
    mapBase = 0,
  } = opts;

  const vram = new Uint8Array(VRAM_SIZE);

  // 1) Tiles — place each at its char slot.
  const stride = tileCharStride(mode);
  for (let i = 0; i < tiles.length; i++) {
    const slot = tileBase + i * stride;
    encodeTileAt(vram, tiles[i], mode, slot);
  }

  // 2) Palettes — write each 16-color palette to CGRAM.
  for (let i = 0; i < palettes.length; i++) {
    const off = cgramOffset(paletteBase + i);
    const bytes = encodePalette(palettes[i]);
    if (off + bytes.length > VRAM_SIZE) {
      throw new Error(`buildVram: palette ${paletteBase + i} at $${off.toString(16)} exceeds VRAM`);
    }
    vram.set(bytes, off);
  }

  // 3) Tilemap — 1024 × 16-bit entries at `mapBase`.
  if (tilemap && tilemap.length) {
    encodeTilemapAt(vram, tilemap, mapBase);
  }

  return vram;
}

// ---------------------------------------------------------------------------
// Compact VRAM — stream only the used regions, not all 64 KB
// ---------------------------------------------------------------------------

/**
 * One contiguous VRAM region to transfer. `dest` is the VRAM **word address**
 * (`$2116`/`$2117` take a word, and byte offset = `dest * 2`); `len` is the
 * number of 16-bit words (1..255 — kept so the generated glue's 8-bit length
 * byte stays valid).
 */
export interface VramBlock {
  dest: number;
  len: number;
}

/**
 * The compact export: a small `blob` of only the used VRAM regions plus the
 * `blocks` table that tells the generated glue where each slice lands. This is
 * what a program `.incbin`s — a few KB, not the full 64 KB — so it fits under
 * `buildRom`'s 32 KB code cap and actually leaves room for the 65C816 program.
 */
export interface VramCompact {
  /** The transferred bytes: the used regions concatenated in `blocks` order. */
  blob: Uint8Array;
  /** Where each slice of `blob` lands in VRAM (each ≤ 255 words). */
  blocks: VramBlock[];
  /** Re-homed tilemap base — a displayable 4 KB NameBase (≤ $7000). */
  mapBase: number;
  /** Background mode (0-7) the glue should program into BGMODE. */
  bgmode: number;
}

/**
 * Build a compact VRAM export: only the char (tile) region, the tilemap, and
 * the CGRAM palettes are included — everything else of the 64 KB is dropped.
 *
 * Unlike `buildVram`, the tilemap is **re-homed** into a displayable NameBase:
 * the SNES can only point BG0-3 at one of 8 windows ($0000, $1000 … $7000), so
 * an authoring `mapBase` above $7000 (the editor default is $8000) would never
 * render. Here the tilemap is placed at the first 4 KB boundary at or past the
 * tile region and ≤ $7000, and the glue sets BG12NBA accordingly.
 */
export function buildVramCompact(opts: BuildVramOptions): VramCompact {
  const {
    mode,
    tiles,
    palettes,
    tilemap,
    tileBase = 0,
    paletteBase = 0,
    mapBase = 0,
  } = opts;

  // Full image — reuse the proven encoder just to source the region bytes.
  const full = buildVram(opts);

  const cb = charBytesForMode(mode);
  const stride = tileCharStride(mode);

  const regions: { dest: number; bytes: Uint8Array }[] = [];

  // 1) Char (tile) region — already in the lower half, so it displays as-is.
  const charStart = tileBase * cb;
  const charLen = tiles.length * stride * cb;
  if (charLen > 0) regions.push({ dest: charStart, bytes: full.slice(charStart, charStart + charLen) });

  // 2) Tilemap — re-homed into a displayable NameBase past the tiles.
  let mapDest = 0;
  if (tilemap && tilemap.length) {
    mapDest = Math.ceil((charStart + charLen) / 0x1000) * 0x1000;
    if (mapDest > 0x7000) {
      throw new Error('buildVramCompact: tilemap does not fit a displayable NameBase (≤ $7000)');
    }
    // The bytes are position-independent — source them from wherever buildVram placed them.
    regions.push({ dest: mapDest, bytes: full.slice(mapBase, mapBase + MAP_BYTES) });
  }

  // 3) CGRAM palettes — already at a valid $C000+ address.
  const palStart = 0xc000 + paletteBase * 32;
  const palLen = palettes.length * 32;
  if (palLen > 0) regions.push({ dest: palStart, bytes: full.slice(palStart, palStart + palLen) });

  // Concatenate the region bytes (blob order = block order) and split each
  // region into ≤255-word blocks. `r.dest` is a byte offset; the PPU wants a
  // word address, so shift right by one.
  const parts: Uint8Array[] = [];
  const blocks: VramBlock[] = [];
  let total = 0;
  for (const r of regions) {
    const words = Math.ceil(r.bytes.length / 2);
    const padded = r.bytes.length % 2 === 0 ? r.bytes : (() => { const p = new Uint8Array(words * 2); p.set(r.bytes); return p; })();
    const wordStart = r.dest >> 1;
    for (let off = 0; off < words; off += 255) {
      blocks.push({ dest: wordStart + off, len: Math.min(255, words - off) });
    }
    parts.push(padded);
    total += padded.length;
  }

  const blob = new Uint8Array(total);
  let o = 0;
  for (const p of parts) { blob.set(p, o); o += p.length; }

  return { blob, blocks, mapBase: mapDest, bgmode: mode & 7 };
}

/**
 * A 65C816 routine that brings up BG0 and fills VRAM from the compact export.
 * Mirrors `spcGlue`'s proven pure-8-bit idiom (PEA/PLA to load a 16-bit label
 * into zero-page, then indexed-indirect reads), so it assembles with the repo's
 * assembler with no bank-switching or native-mode tricks.
 *
 * The program only has to `JSR vram_load`. The routine:
 *   1. un-blanks + sets full brightness (INIDISP twice — the reset state is
 *      forced-blank with brightness 0, i.e. a fully black screen),
 *   2. programs BGMODE / BG0SC / BG12NBA, enables BG0 (TM), sets VMAIN so the
 *      $2118/$2119 word pair auto-advances,
 *   3. walks a block table `(dest_lo, dest_hi, len)` and streams each slice of
 *      the embedded data word-by-word, stopping at the `len == 0` terminator.
 *
 * Scratch is zero-page $20-$26 — deliberately clear of spcGlue's $10-$17, so the
 * two routines can coexist in one ROM.
 */
export function vramGlue(mapBase: number, bgmode: number, blocks: VramBlock[], dataName = 'vram.bin'): string {
  const nba = (mapBase >> 12) & 7;
  const h = (n: number, w: number) => '$' + n.toString(16).padStart(w, '0');
  const table = blocks
    .map((b) => `  .byte ${h(b.dest & 0xff, 2)}, ${h((b.dest >> 8) & 0xff, 2)}, ${h(b.len, 2)}`)
    .join('\n');

  return `; --- PPU/VRAM bring-up glue (generated) -------------------------------
; Brings up BG0 and loads the compact ${dataName} into VRAM. Pure 8-bit mode.
; The program just calls:  JSR vram_load
vram_load:
  ; un-blank + full brightness: INIDISP bit7 edge lifts forced-blanking, and the
  ; low nibble (brightness) must be non-zero or the PPU renders fully black.
  lda #$80
  sta $2100
  lda #$0f
  sta $2100
  lda ${h(bgmode & 7, 2)}     ; BGMODE
  sta $2105
  lda #$00                 ; BG0SC (8x8, char slots from $0000)
  sta $2107
  lda ${h(nba, 2)}           ; BG12NBA = tilemap 4 KB window
  sta $210b
  lda #$01                 ; TM: BG0 main screen on
  sta $212c
  lda #$80                 ; VMAIN: high + increment ($2118 no-inc, $2119 auto-inc)
  sta $2115
  ; load the two data pointers (PEA pushes high first, so low pops first)
  pea vram_data
  pla
  sta $20                  ; data ptr lo
  pla
  sta $21                  ; data ptr hi
  pea vram_blocks
  pla
  sta $22                  ; table ptr lo
  pla
  sta $23                  ; table ptr hi
  ldy #0                   ; (zp),Y with Y=0 reads the byte at the pointer
vram_blk:
  lda ($22),Y             ; dest_lo
  sta $2116                ; VMADDL
  inc $22
  bne vram_t1
  inc $23
vram_t1:
  lda ($22),Y             ; dest_hi
  sta $2117                ; VMADDH
  inc $22
  bne vram_t2
  inc $23
vram_t2:
  lda ($22),Y             ; len (words)
  sta $26
  beq vram_done            ; len == 0 -> terminator (flag is from the sta above)
  inc $22                 ; advance the table pointer past len (len != 0 here)
  bne vram_t3
  inc $23
vram_t3:
vram_w:
  lda ($20),Y             ; word low byte (data pointer at byte 0 of the word)
  sta $2118
  inc $20                 ; advance the data pointer by one byte (with carry)
  bne vram_a
  inc $21
vram_a:
  lda ($20),Y             ; word high byte (data pointer now at byte 1 of the word)
  sta $2119
  inc $20
  bne vram_b
  inc $21
vram_b:
  dec $26                 ; one word written
  bne vram_w
  jmp vram_blk
vram_done:
  rts
vram_blocks:
${table}
  .byte $00, $00, $00      ; terminator
vram_data:
  .incbin "${dataName}"
`;
}
