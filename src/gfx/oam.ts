/**
 * OAM (Object Attribute Memory) — the SNES sprite table, plus the glue that
 * loads it. Mirrors the `vram.ts` "compact export + self-contained glue"
 * pattern: `encodeOam` produces the 512-byte OAM image (what a program
 * `.incbin`s as `oam.bin`), and `oamGlue` emits a pure-8-bit `oam_load`
 * routine that programs OBJSEL, points OAMADDR at slot 0, enables OBJ in TM,
 * and streams the table through OAMDATA ($2104). The program only has to
 * `JSR oam_load`. For a moving slot-0 sprite the program additionally calls
 * `JSR spr_init` ONCE — which parks the sprite at screen centre and arms the
 * once-per-vblank NMI that runs `spr_move` — and then just idles.
 *
 * **Sprite size is GLOBAL, not per-slot.** The SNES decides each sprite's
 * pixel size from OBJSEL's OBJSizeSelect bits (OBJSEL = $2101, bits 5-7);
 * there is no per-slot size field in OAM. So one ROM shows every sprite at
 * ONE size — `oamGlue` bakes the chosen OBJSEL in, and the author picks it
 * once via `oamGlue(name, size)`. Two sizes are supported:
 *   - `8x8`   → OBJSEL = $00 (OBJSizeSelect 0; objsize_array[0] = {8,8,16,16})
 *   - `16x16` → OBJSEL = $60 (OBJSizeSelect 3; objsize_array[3] = {16,16,32,32})
 * The OAM BYTE LAYOUT is identical for both (standard 4 bytes/slot) — only the
 * OBJSEL byte and the char-indexing rule differ (see OamEntry.tile).
 *
 * Grounded in `core/snes9x-2010/core/ppu.c` (this snes9x fork):
 *   - REGISTER_2104 normal path (ppu.c:3590-3644): a sprite slot is written as
 *     TWO 16-bit words through OAMDATA ($2104) in this byte order:
 *        byte0 HPos, byte1 VPos        (word 0 = position; committed on byte1)
 *        byte2 Name[7:0], byte3 attr   (word 1 = name+attr; committed on byte3)
 *     OAMADDR ($2102/$2103) auto-increments per word, so streaming all 512
 *     bytes fills all 128 slots in order.
 *   - attr decode (ppu.c:3616-3621): Name = reg & 0x1ff (9th char bit = attr
 *     bit 0), Palette = (attr>>1)&7, Priority = (attr>>4)&3,
 *     HFlip = (attr>>6)&1, VFlip = (attr>>7)&1.
 *   - OBJSEL ($2101) (ppu.c:3805-3809): OBJSizeSelect = (byte>>5)&7. The
 *     normal OAM path never sets OBJ[S].Size, so every sprite draws at the
 *     SMALL size of that row (ppu.c:366-371; objsize_array:350). Row 3 is
 *     16×16, so OBJSEL = 3<<5 = $60.
 *   - OBJ render gate (ppu.c:1799): main-screen OBJ is enabled by TM ($212c)
 *     bit 4 (0x10). StartPalette is hard-wired to 128 (ppu.c:1802), so OAM
 *     palette field P colours from CGRAM palette 8+P; field 0 → CGRAM palette
 *     8 (colours 128-143). v1 pins the field to 0, so every sprite colours
 *     from the single OBJ palette exported to CGRAM palette 8.
 *   - Hiding a slot: the per-line visibility loop skips any line with
 *     `Y >= SNES_HEIGHT_EXTENDED` (239) (ppu.c:434-452), so a slot at VPos=255
 *     renders nothing AND consumes none of the 32-sprites-per-line budget.
 *
 * Pure TS, no DOM — unit-testable in the node env like the rest of `src/gfx/`.
 */

/** 128 sprite slots (the SNES OAM size). */
export const OAM_ENTRIES = 128;
/** 128 slots × 4 bytes each. */
export const OAM_BYTES = OAM_ENTRIES * 4; // 512
/**
 * $2101 (OBJSEL) per size. OBJSizeSelect = bits 5-7; NameBase (bits 0-1) and
 * NameSelect (bits 3-4) are left 0. The normal OAM path never sets the per-slot
 * "x4" Size flag, so every sprite draws at the SMALL size of that row
 * (ppu.c:366-371; objsize_array:350):
 *   size 0 = {8,8,16,16}  → OBJSEL $00
 *   size 3 = {16,16,32,32} → OBJSEL $60
 */
export const OBJSEL_8X8 = 0x00;
export const OBJSEL_16X16 = 0x60;
/** The two supported sprite sizes. */
export type OamSize = '8x8' | '16x16';
/** Map a size to its OBJSEL byte. */
export function objselFor(size: OamSize): number {
  return size === '8x8' ? OBJSEL_8X8 : OBJSEL_16X16;
}
/** $212c (TM): BG0 (bit 0) + OBJ (bit 4). */
export const TM_OBJ_ON = 0x11;
/** A slot that renders nothing: VPos = 255 (below the 239-line extended screen). */
export const OAM_HIDDEN: readonly number[] = [0x00, 0xff, 0x00, 0x00];

/**
 * One sprite slot. Unset slots are written hidden (off-screen) so they render
 * nothing and consume none of the per-line sprite budget.
 */
export interface OamEntry {
  /**
   * 8×8 char index, 0-511 (9-bit).
   *   - 8×8 sprite: this is the whole sprite — any char you painted.
   *   - 16×16 sprite: this is the TOP-LEFT char of the 2×2 block. The SNES
   *     lays 8×8 chars out 16 per row, so the four chars are
   *     (tile, tile+1, tile+16, tile+17) — pick the top-left on an EVEN char
   *     column, i.e. `tile % 2 == 0` (valid top-lefts: 0, 2, 4, …, 510).
   *     Paint those four chars as one connected 16×16 picture.
   */
  tile: number;
  /** Screen column, 0-255. */
  x: number;
  /** Screen row, 0-255. */
  y: number;
  /** Mirror the sprite horizontally. */
  flipH?: boolean;
  /** Mirror the sprite vertically. */
  flipV?: boolean;
  /** Priority 0-3 (draw order / vs-background). Default 0. */
  priority?: number;
}

/**
 * Encode one slot into its four write-order bytes: `[HPos, VPos, Name, attr]`.
 * The palette field is pinned to 0 (CGRAM palette 8) — see the module doc.
 */
export function encodeOamEntry(e: OamEntry): Uint8Array {
  const priority = (e.priority ?? 0) & 3;
  const attr =
    ((e.tile >> 8) & 1) | // Name[8] — the 9th char bit
    (priority << 4) |
    ((e.flipH ? 1 : 0) << 6) |
    ((e.flipV ? 1 : 0) << 7);
  return new Uint8Array([
    e.x & 0xff,
    e.y & 0xff,
    e.tile & 0xff,
    attr,
  ]);
}

/**
 * Encode the full 512-byte OAM image. `slots` is indexed by slot number
 * (0-127); `null`/`undefined` slots are written hidden (off-screen) so they
 * render nothing and consume none of the per-line sprite budget.
 */
export function encodeOam(slots: Array<OamEntry | null | undefined>): Uint8Array {
  const out = new Uint8Array(OAM_BYTES);
  for (let i = 0; i < OAM_ENTRIES; i++) {
    const e = slots[i];
    out.set(e ? encodeOamEntry(e) : (OAM_HIDDEN as number[]), i * 4);
  }
  return out;
}

/**
 * The `oam_load` glue — a self-contained, pure-8-bit routine that programs
 * OBJSEL (to `size`), points OAMADDR at slot 0, enables OBJ in TM, and streams
 * the embedded 512-byte OAM table through OAMDATA ($2104). The program only has
 * to `JSR oam_load`.
 *
 * It ALSO emits the **d-pad sprite service** for moving sprites:
 *   - `spr_init` — parks the movable sprite (OAM slot 0) at the screen
 *     centre (X=$80=128, Y=$70=112) in zero-page $2b/$2c and arms NMITIMEN
 *     bit 7 ($4200). The NMI fires ONCE per frame, at vblank (cpuexec.c: the
 *     vblank-start event checks `$4200 & $80` and sets the NMI flag; the
 *     flag is cleared at frame wrap, so it fires exactly once per frame),
 *     and `nmi_move` runs `spr_move`. Call it ONCE, then let the program
 *     idle (`bra idle`) — never call `spr_move` from a tight loop, because
 *     the CPU runs the same loop thousands of times per frame.
 *     The NMI VECTOR is not written here: it lives in the ROM (read-only),
 *     and the build (`buildRom` in `src/asm/rom.ts`) bakes it pointing at
 *     `nmi_move` — at CPU $FFEA/$FFEB on this snes9x fork ($FFFE/$FFFF on a
 *     real SNES). Writing it to $FFFE at runtime, as the old glue did, hit
 *     the wrong slot for this fork, so the armed NMI jumped to $0000.
 *   - `nmi_move` — the per-vblank NMI handler: `jsr spr_move / rti`. The
 *     ROM build finds this label and bakes its address as the NMI vector.
 *   - `spr_move` — one d-pad tick: reads the $4219 d-pad byte (bit SET =
 *     pressed, same state `pad_read` returns in X), moves slot 0 by 2px in
 *     every held direction (8-bit wrap at the edges), and writes the new
 *     [HPos,VPos] word into slot 0 through OAMDATA ($2104).
 * The PPU's per-scanline render loop reads `PPU.OBJ[S].HPos/VPos` fresh EVERY
 * frame (ppu.c:410/424, 468/493, 661), and the OAM write commits a
 * position-only word — `HPos |= lowbyte; VPos = highbyte` (ppu.c:3052-3055) —
 * so the sprite moves on the very next frame while the Name/attr bytes
 * (tile, priority, flips) that `oam_load` wrote stay untouched. OAMADDR is
 * reset to slot 0 first, because after `oam_load` streamed all 128 slots it
 * has wrapped and its final value must not be assumed. The only register READ
 * in all of this is $4219 — a CPU I/O register the shim fills every frame,
 * never a PPU register (this fork returns OpenBus garbage on PPU reads).
 *
 * `size` (`'8x8' | '16x16'`, default `'16x16'`) sets OBJSEL's OBJSizeSelect,
 * so it is the ONE size every sprite in this ROM draws at (see the module doc).
 *
 * Call it AFTER `vram_load` (which sets up BG0 and writes the OBJ colour
 * palette into CGRAM palette 8) so the absolute TM byte it writes here
 * ($11 = BG0 + OBJ) is the final state. It never reads a PPU register — this
 * snes9x fork returns OpenBus garbage on PPU reads, so a read-modify-write of
 * TM would write a random value.
 *
 * Scratch is zero-page $30/$31 (the oam_load data pointer) and
 * $2b (sprite X) / $2c (sprite Y) / $2d (d-pad snapshot) for the sprite
 * service — deliberately clear of spcGlue's $10-$17, vramGlue's $20-$2a, and
 * the LZ decoder's $40-$4c, so all the routines coexist in one ROM.
 */
export function oamGlue(dataName = 'oam.bin', size: OamSize = '16x16'): string {
  const h = (n: number, w: number) => '$' + n.toString(16).padStart(w, '0');
  const objsel = objselFor(size);
  const sel = size === '8x8' ? 0 : 3;
  return `; --- OBJ/OAM sprite glue (generated) ---------------------------------
; Loads the 128-slot OAM table (sprites) from the embedded ${dataName}.
; Pure 8-bit mode. The program just calls:  JSR oam_load
oam_load:
  lda #${h(objsel, 2)}   ; OBJSEL: ${size} sprites (OBJSizeSelect=${sel}), bg-mode
  sta $2101
  lda #0                       ; OAMADDR = 0 -> normal 4-byte entry path, slot 0
  sta $2102
  sta $2103
  lda #${h(TM_OBJ_ON, 2)}      ; TM: BG0 (bit0) + OBJ (bit4) — absolute, no PPU read
  sta $212c
  pea oam_data
  pla
  sta $30                      ; data ptr lo
  pla
  sta $31                      ; data ptr hi
  ldy #0
  ldx #${h(OAM_ENTRIES, 2)}    ; 128 slots
oam_slot:
  lda ($30),Y                 ; byte0 HPos
  sta $2104
  inc $30
  bne oam_a
  inc $31
oam_a:
  lda ($30),Y                 ; byte1 VPos   (word 0 committed: position)
  sta $2104
  inc $30
  bne oam_b
  inc $31
oam_b:
  lda ($30),Y                 ; byte2 Name[7:0]
  sta $2104
  inc $30
  bne oam_c
  inc $31
oam_c:
  lda ($30),Y                 ; byte3 attr   (word 1 committed: name + attr)
  sta $2104
  inc $30
  bne oam_d
  inc $31
oam_d:
  dex
  bne oam_slot
  rts
; --- d-pad sprite service (generated) ----------------------------------------
; The MOVABLE sprite is OAM slot 0. The program calls (after oam_load):
;   JSR spr_init   once — it parks the sprite at the screen centre AND arms
;                  the movement tick: the NMI handler nmi_move runs once per
;                  frame, at vblank, doing one spr_move for you.
; The NMI vector itself is BAKED into the ROM by the build (rom.ts) pointing
; at nmi_move — at CPU $FFEA/$FFEB on this snes9x fork ($FFFE/$FFFF on a real
; SNES) — so spr_init only parks the sprite and arms NMITIMEN; it does NOT
; write the vector (the ROM region is read-only, and $FFFE is the WRONG slot
; on this fork anyway).
; After that the program just idles:   idle: bra idle
; (Never call spr_move from a tight loop — the CPU runs thousands of times
;  per frame, so the tick must be paced by the once-per-vblank NMI.)
; $2b = sprite X, $2c = sprite Y, $2d = this tick's d-pad byte.
spr_init:
  lda #$80                   ; X = 128 (screen centre column)
  sta $2b
  lda #$70                   ; Y = 112 (screen centre row)
  sta $2c
  lda #$80                   ; NMITIMEN bit7: fire the NMI once per vblank
  sta $4200                  ; (the vector -> nmi_move is baked by the build)
  rts
nmi_move:
  jsr spr_move               ; one d-pad tick per frame (UP/DOWN/LEFT/RIGHT,
  rti                        ; 2px per held direction, diagonals included)
spr_move:
  lda #0
  sta $2102                  ; OAMADDR -> slot 0 (oam_load left it after 128
  sta $2103                  ; slots — reset it, do not assume where it is)
  lda $4219                  ; d-pad byte, bit SET = pressed:
  and #$0f                   ; bit3=UP bit2=DOWN bit1=LEFT bit0=RIGHT
  sta $2d
  lda $2d
  and #$08
  beq sv_noup
  lda $2c                    ; UP: Y -= 2 (8-bit wrap)
  sec
  sbc #$02
  sta $2c
sv_noup:
  lda $2d
  and #$04
  beq sv_nodn
  lda $2c                    ; DOWN: Y += 2
  clc
  adc #$02
  sta $2c
sv_nodn:
  lda $2d
  and #$02
  beq sv_nolt
  lda $2b                    ; LEFT: X -= 2
  sec
  sbc #$02
  sta $2b
sv_nolt:
  lda $2d
  and #$01
  beq sv_nort
  lda $2b                    ; RIGHT: X += 2
  clc
  adc #$02
  sta $2b
sv_nort:
  lda $2b                    ; HPos (byte0)
  sta $2104
  lda $2c                    ; VPos (byte1) — word commits: slot 0 moved;
  sta $2104                  ; Name/attr (tile/priority/flips) stay as loaded
  rts
oam_data:
  .incbin "${dataName}"
`;
}
