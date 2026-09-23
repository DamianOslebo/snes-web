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
  /**
   * Optional SECOND tilemap — a distinct screen the PPU can be switched to at
   * runtime (e.g. "HELLO WORLD" ↔ "hello world"). When present it is placed in
   * the next displayable SCBase window past the primary tilemap, and the glue
   * gains a `vram_toggle` service routine that flips the display between them.
   */
  altTilemap?: TilemapEntry[];
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
  /**
   * Re-homed tilemap base — a byte offset selectable by SCBase (BG0SC): 2 KB
   * aligned and ≤ $7000 so BG0's 32×32 tilemap fits in the lower 32 KB VRAM.
   */
  mapBase: number;
  /**
   * Re-homed base of the SECOND tilemap (when one was supplied). One SCBase
   * window past `mapBase`. Present iff `altTilemap` was non-empty; its presence
   * is what makes the glue emit the `vram_toggle` service routine.
   */
  altMapBase?: number;
  /** Background mode (0-7) the glue should program into BGMODE. */
  bgmode: number;
}

/**
 * Build a compact VRAM export: only the char (tile) region, the tilemap, and
 * the CGRAM palettes are included — everything else of the 64 KB is dropped.
 *
 * Unlike `buildVram`, the tilemap is **re-homed** into a displayable SCBase
 * window: the SNES can only point BG0-3's tilemap at 2 KB-aligned bases
 * ($0000, $0800, $1000 … $7000), so an authoring `mapBase` above $7000 (the
 * editor default is $8000) would never render. Here the tilemap is placed at
 * the first 4 KB boundary at or past the tile region and ≤ $7000, and the glue
 * programs the two bases correctly — BG0SC (SCBase) for the tilemap, BG12NBA
 * (NameBase) for the tile char data — instead of conflating them.
 */
export function buildVramCompact(opts: BuildVramOptions): VramCompact {
  const {
    mode,
    tiles,
    palettes,
    tilemap,
    altTilemap,
    tileBase = 0,
    paletteBase = 0,
    mapBase = 0,
  } = opts;

  // Full image — reuse the proven encoder just to source the region bytes.
  // (The alt tilemap is encoded separately below; buildVram holds one map.)
  const full = buildVram(opts);

  const cb = charBytesForMode(mode);
  const stride = tileCharStride(mode);

  const regions: { dest: number; bytes: Uint8Array }[] = [];

  // 1) Char (tile) region — already in the lower half, so it displays as-is.
  const charStart = tileBase * cb;
  const charLen = tiles.length * stride * cb;
  if (charLen > 0) regions.push({ dest: charStart, bytes: full.slice(charStart, charStart + charLen) });

  // 2) Tilemap — re-homed into a displayable SCBase window past the tiles.
  let mapDest = 0;
  let altMapDest = 0;
  if (tilemap && tilemap.length) {
    mapDest = Math.ceil((charStart + charLen) / 0x1000) * 0x1000;
    if (mapDest > 0x7000) {
      throw new Error('buildVramCompact: tilemap does not fit a displayable SCBase (≤ $7000)');
    }
    // The bytes are position-independent — source them from wherever buildVram placed them.
    regions.push({ dest: mapDest, bytes: full.slice(mapBase, mapBase + MAP_BYTES) });

    // 2b) Second tilemap — the NEXT SCBase window past the primary one. The two
    //     maps must sit in DIFFERENT windows so `vram_toggle` can flip the
    //     display between them with a single $2107 (BG0SC) eor. Encoded into a
    //     throwaway buffer (buildVram holds only one map), then sliced out.
    if (altTilemap && altTilemap.length) {
      altMapDest = mapDest + 0x1000;
      if (altMapDest > 0x7000) {
        throw new Error('buildVramCompact: alt tilemap does not fit a displayable SCBase (≤ $7000)');
      }
      const altBuf = new Uint8Array(MAP_BYTES);
      encodeTilemapAt(altBuf, altTilemap, 0);
      regions.push({ dest: altMapDest, bytes: altBuf });
    }
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

  return {
    blob,
    blocks,
    mapBase: mapDest,
    // Present only when a second tilemap was supplied (non-empty altTilemap);
    // its presence is what makes the glue emit `vram_toggle`.
    altMapBase: altMapDest || undefined,
    bgmode: mode & 7,
  };
}

/**
 * A 65C816 routine that brings up BG0 and fills VRAM from the compact export.
 * Mirrors `spcGlue`'s proven pure-8-bit idiom (PEA/PLA to load a 16-bit label
 * into zero-page, then indexed-indirect reads), so it assembles with the repo's
 * assembler with no bank-switching or native-mode tricks.
 *
 * The program only has to `JSR vram_load`. The routine:
 *   1. keeps forced-blank ON through the whole fill (INIDISP=$80 — lifting it
 *      early would trip snes9x's BlockInvalidVRAMAccess and drop the writes),
 *   2. programs BGMODE / BG0SC / BG12NBA, enables BG0 (TM), sets VMAIN so the
 *      $2118/$2119 word pair auto-advances,
 *   3. walks a block table `(dest_lo, dest_hi, len)` and streams each slice of
 *      the embedded data, stopping at the `len == 0` terminator:
 *        - char / tilemap blocks (word addr ≤ $3FFF) go through the generic
 *          $2118/$2119 VRAM path;
 *        - CGRAM palette blocks (word addr ≥ $6000, i.e. dest_hi ≥ $60) go
 *          through the dedicated colour registers: $2121 sets the CGADD base,
 *          then each (low, high) pair is written to $2122, which populates
 *          PPU.CGDATA *and* IPPU.ScreenColors (the array the rasterizer actually
 *          reads). The generic $2118/$2119 path only touches Memory.VRAM, which
 *          the rasterizer never consults for colour — that was the black screen.
 *
 * Scratch is zero-page $20-$29 — deliberately clear of spcGlue's $10-$17, so the
 * two routines can coexist in one ROM. ($28/$29 hold the current block's
 * dest_hi/dest_lo for the CGRAM test.) $2a holds the toggle state.
 *
 * The glue ALSO always emits two OS service routines the program `JSR`s — the
 * "OS library" for input + screen switching, so the program never hand-rolls
 * PPU register writes:
 *   - `pad_read`    : A <- the raw pad byte ($4016); buttons active-LOW.
 *   - `vram_toggle` : (only when `altMapBase` is supplied) flip the display
 *                     between the two tilemaps by writing the ABSOLUTE BG0SC
 *                     SCBase byte for the target map (state tracked in $2a).
 *                     It never reads $2107 — this snes9x fork returns OpenBus
 *                     garbage on PPU register reads, so a read-modify-write
 *                     would write a random value.
 */
export function vramGlue(mapBase: number, bgmode: number, blocks: VramBlock[], dataName = 'vram.bin', altMapBase?: number): string {
  // The SNES PPU has TWO independent bases into the same 64 KB VRAM — and they
  // are NOT the same knob (this was the black screen):
  //
  //   * BG12NBA ($210b) → NameBase → tile (CHAR) DATA base.
  //       ppu.c:3329  PPU.BG[0].NameBase = (Byte & 7) << 12;
  //       ppu.c:738   BG.TileAddress     = NameBase << 1;
  //     So char data must live at a 0x2000-aligned byte offset. Our layout puts
  //     tiles at byte $0000 → NameBase = 0.
  //
  //   * BG0SC ($2107) → SCBase → TILEMAP base.
  //       ppu.c:3319  PPU.BG[bg].SCBase = (Byte & 0x7c) << 8;
  //       ppu.c:740   SC0               = &VRAM[SCBase << 1];
  //     So the tilemap byte offset = (Byte & 0x7c) << 9 → Byte = (mapBase>>9)&0x7c.
  const scByte = (mapBase >> 9) & 0x7c;   // BG0SC — SCBase window selecting the tilemap
  const nba = 0;                          // BG12NBA — NameBase=0, tile char data at byte $0000
  // `vram_toggle` (emitted only when a second tilemap exists) flips the display
  // between the two tilemaps. THIS snes9x fork returns OpenBus GARBAGE when a
  // PPU register is READ (S9xGetPPU's default case — there is no case for $2107),
  // so a read-modify-write (`lda $2107 / eor / sta $2107`) writes an UNPREDICTABLE
  // value and the flip silently fails (the screen just stays on the primary map).
  // Instead the toggle writes the ABSOLUTE SCBase byte for the target map (which
  // the real core provably accepts — an `lda #<byte> / sta $2107` lands it) and
  // tracks which map is up in a zero-page flag ($2a) that `vram_load` zeroes.
  const altScByte = altMapBase ? (altMapBase >> 9) & 0x7c : 0;
  const h = (n: number, w: number) => '$' + n.toString(16).padStart(w, '0');
  const table = blocks
    .map((b) => `  .byte ${h(b.dest & 0xff, 2)}, ${h((b.dest >> 8) & 0xff, 2)}, ${h(b.len, 2)}`)
    .join('\n');
  // The `vram_toggle` routine — emitted ONLY when a second tilemap was supplied.
  // It keeps state in zero-page $2a (0 = primary, 1 = alt) and writes the
  // ABSOLUTE BG0SC SCBase byte for the target map — it NEVER reads $2107,
  // because this snes9x fork returns OpenBus garbage on PPU register reads.
  // TM/C0/M0 are untouched, so the background stays on across the flip.
  const toggle = altMapBase
    ? `; vram_toggle: flip the display between the primary and the SECOND
; tilemap (e.g. "HELLO WORLD" <-> "hello world"). State is zero-page $2a
; (0 = primary, 1 = alt); vram_load sets it to 0 and $2107=scByte, so the
; first call flips to the alt map and the next flips back. We write the
; ABSOLUTE SCBase byte for the target map because this snes9x fork returns
; OpenBus garbage on PPU register READS — a read-modify-write of $2107 would
; write a random value and the flip would silently not happen.
vram_toggle:
  lda $2a                 ; 0 = primary, 1 = alt
  eor #$01
  sta $2a
  beq vt_pri              ; state now 0 -> show the primary tilemap
  lda #${h(altScByte, 2)}   ; BG0SC SCBase window for the ALT tilemap
  sta $2107
  rts
vt_pri:
  lda #${h(scByte, 2)}     ; BG0SC SCBase window for the PRIMARY tilemap
  sta $2107
  rts
`
    : '';
  // Zero-page $2a holds the toggle state (0 = primary, 1 = alt). `vram_load`
  // zeroes it right after programming $2107=scByte, so the first `vram_toggle`
  // call flips to the alt map. Emitted only when there IS an alt map — otherwise
  // $2a is unused and the single-screen build stays byte-identical to before.
  const flagInit = altMapBase
    ? `  lda #0                   ; toggle state: 0 = primary (matches the $2107 above)\n  sta $2a\n`
    : '';

  return `; --- PPU/VRAM bring-up glue (generated) -------------------------------
; Brings up BG0 and loads the compact ${dataName} into VRAM. Pure 8-bit mode.
; The program just calls:  JSR vram_load
vram_load:
  ; Forced-blank ON — and keep it ON through the ENTIRE VRAM fill. The wasm build
  ; ships with snes9x's BlockInvalidVRAMAccess, which drops every $2118/$2119
  ; write unless INIDISP bit7 (forced-blanking) is set. So we must NOT un-blank
  ; until the last word is in (see vram_done); brightness is set there too.
  lda #$80
  sta $2100
  lda #${h(bgmode & 7, 2)}  ; BGMODE (immediate — a bare value would be a zero-page read)
  sta $2105
  lda #${h(scByte, 2)}      ; BG0SC: SCBase window — selects the TILEMAP at mapBase
  sta $2107
  lda #${h(nba, 2)}         ; BG12NBA: NameBase=0 — tile CHAR DATA at byte $0000
  sta $210b
  lda #$01                 ; TM: BG0 main screen on
  sta $212c
  lda #$80                 ; VMAIN: high + increment ($2118 no-inc, $2119 auto-inc)
  sta $2115
${flagInit}  ; load the two data pointers (PEA pushes high first, so low pops first)
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
  sta $29                  ; keep dest_lo (CGRAM base colour index)
  inc $22
  bne vram_t1
  inc $23
vram_t1:
  lda ($22),Y             ; dest_hi
  sta $2117                ; VMADDH
  sta $28                  ; keep dest_hi for the CGRAM test
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
  lda $28                 ; CGRAM lives in the upper 32 KB (word addr >= $6000)
  cmp #$60
  bcc vram_w               ; char / tilemap -> generic $2118/$2119 word writes
  ; ---- CGRAM palette block: the dedicated colour registers ------------------
  ; $2118/$2119 only touch Memory.VRAM, which the rasterizer never reads for
  ; colour. $2121/$2122 populate PPU.CGDATA *and* IPPU.ScreenColors, and $2121
  ; resets CGFLIP to 0 so the first $2122 write is the low byte. CGADD then
  ; auto-increments after each high byte, so a contiguous palette streams with
  ; one $2121 setup.
  lda $29                 ; base CGRAM colour index for this block
  sta $2121
cgram_w:
  lda ($20),Y             ; colour low byte
  sta $2122                ; CGFLIP 0->1
  inc $20
  bne cgram_a
  inc $21
cgram_a:
  lda ($20),Y             ; colour high byte
  sta $2122                ; CGFLIP 1->0, CGADD++
  inc $20
  bne cgram_b
  inc $21
cgram_b:
  dec $26
  bne cgram_w
  jmp vram_blk             ; next block (table pointer already advanced)
; ---- generic char / tilemap block -------------------------------------------
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
  ; Un-blank + full brightness, NOW that every word has landed in VRAM. Lifting
  ; forced-blanking before the fill would trip snes9x's BlockInvalidVRAMAccess
  ; and silently drop the $2118/$2119 writes (the pure-black-screen bug).
  lda #$0f
  sta $2100
  rts
; --- OS service routines (the program JSRs these — no PPU/SPU setup needed) ----
; pad_read: A <- the raw pad byte ($4016). Buttons are active-LOW: a button is
;   PRESSED when its bit is CLEAR (0). A=01 B=02 X=04 Y=08. To test button A:
;   jsr pad_read / and #$01 / bne pressed.
pad_read:
  lda $4016
  rts
${toggle}vram_blocks:
${table}
  .byte $00, $00, $00      ; terminator
vram_data:
  .incbin "${dataName}"
`;
}
