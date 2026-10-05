/**
 * `anim` — pure 65C816 glue that makes ONE sprite slot CYCLE a short sequence
 * of char images (a walk / a flap), paced by the once-per-vblank NMI.
 *
 * It is the char-swap sibling of `oam.ts`'s d-pad `spr_move`. `spr_move`
 * writes a slot's OAM **word0** (HPos/VPos) each frame in response to the
 * d-pad; `anim` writes the SAME slot's OAM **word1** (Name + attr) each
 * char-period, stepping through a baked K-frame table. The PPU commits word0
 * on byte1 (VPos) and word1 on byte3 (attr) INDEPENDENTLY — confirmed against
 * this core's `REGISTER_2104` (ppu.c:3590-3644) and the word-commit at
 * ppu.c:3052-3055 — so the two never clobber each other: a slot can be moved
 * by the d-pad (`spr_move`) AND swap its picture (`anim`) in the same NMI.
 * That is exactly the "walk": a sprite that moves while its picture changes.
 *
 * The one new fact over `oam.ts`: writing a slot's word1 (OAMADDR = slot*2+1)
 * changes ONLY the 9-bit Name + attr — word0 (position) is untouched, so the
 * parked position from `oam_load` and the d-pad motion from `spr_move` both
 * survive the char swap. The attr decode (Name[8] = attr bit0, Priority =
 * bits 4-5, HFlip bit6, VFlip bit7) is identical to `oam.ts` (see that
 * module's doc for the ppu.c line refs).
 *
 * Because a ROM has exactly ONE NMI vector, `anim_tick` is one of the
 * once-per-frame services the shared dispatcher (`nmiGlue` / `nmi_move`)
 * runs; the program arms the tick once (`JSR anim_init`) and then idles. It
 * never advances the char itself and never reads a PPU register (this core
 * returns OpenBus garbage on PPU reads, so every PPU write is ABSOLUTE).
 *
 * Zero-page: $32 = char index (0..K-1), $33 = frame divider. Deliberately in
 * the free band $32-$3f — clear of spcGlue's $10-$17, vramGlue's $20-$2a,
 * oamGlue's $2b-$31, and the LZ decoder's $40-$4c.
 *
 * Pure: no DOM, no core — unit-testable and importable by tools.ts, exactly
 * like `scroll.ts`.
 */

export interface SpriteAnimConfig {
  /** 2-8 char images to cycle, in order. Each is an 8×8 char index, 0-511. */
  tiles: readonly number[];
  /** OAM slot to animate (default 0 — the same slot the d-pad moves). */
  slot?: number;
  /** Frames (NMI ticks) between char changes. Default 4 (a char every 4th frame). */
  skip?: number;
  /** 0-3, priority — constant across frames (default 0). */
  priority?: number;
  /** Mirror horizontally — constant across frames (default false). */
  flipH?: boolean;
  /** Mirror vertically — constant across frames (default false). */
  flipV?: boolean;
}

/**
 * Bake the per-frame Name + attr bytes for a char cycle. `tiles` are the char
 * indices to cycle; priority and the flips are constant across frames. Returns
 * the two parallel tables the glue emits (both length K, indexed by the phase
 * counter). Splitting Name[7:0] into the Name byte and Name[8] into attr bit0
 * matches the OAM word1 commit exactly (see `encodeOamEntry` in `oam.ts`).
 */
export function spriteAnimTables(
  tiles: readonly number[],
  priority: number,
  flipH: boolean,
  flipV: boolean,
): { names: number[]; attrs: number[] } {
  const names: number[] = [];
  const attrs: number[] = [];
  for (const t of tiles) {
    names.push(t & 0xff); // Name[7:0]
    attrs.push(
      ((t >> 8) & 1) | // Name[8] — the 9th char bit
      ((priority & 3) << 4) |
      ((flipH ? 1 : 0) << 6) |
      ((flipV ? 1 : 0) << 7),
    );
  }
  return { names, attrs };
}

const hex = (n: number) => '$' + (n & 0xff).toString(16).padStart(2, '0');

/**
 * The sprite char-swap service. `anim_init` parks the phase at 0 and arms the
 * once-per-vblank NMI; `anim_tick` is the per-frame service the NMI dispatcher
 * (`nmiGlue`) runs — it counts NMI ticks, advances (and wraps) the char index
 * once every `skip` ticks, and writes the current frame's Name + attr into the
 * slot's OAM word1 (OAMADDR = slot*2+1). The program calls `JSR anim_init`
 * once (after `oam_load`) and then idles; it never touches the sprite itself.
 */
export function spriteAnimGlue(config: SpriteAnimConfig): string {
  const K = config.tiles.length;
  const slot = config.slot ?? 0;
  const skip = config.skip ?? 4;
  const { names, attrs } = spriteAnimTables(
    config.tiles,
    config.priority ?? 0,
    config.flipH ?? false,
    config.flipV ?? false,
  );
  const word1 = slot * 2 + 1; // OAMADDR of the slot's Name+attr word (word0 = slot*2)
  const namesLine = '  .byte ' + names.map((n) => hex(n)).join(', ');
  const attrsLine = '  .byte ' + attrs.map((a) => hex(a)).join(', ');
  return `; --- sprite char-swap animation glue (generated) ---------------------
; Makes OAM slot ${slot} CYCLE ${K} char images, one every ${skip} frame(s),
; paced by the once-per-vblank NMI — the same pacemaker the d-pad sprite and
; the BG0 scroll use. The program calls (after oam_load):
;   JSR anim_init          ... then:  idle: bra idle
; and never touches the sprite itself: the NMI handler (nmi_move) runs
; anim_tick once per frame, which writes the current char into the slot's OAM
; word1 (Name + attr) via OAMADDR = ${word1} and leaves word0 (position —
; written by oam_load / spr_move) untouched. Every PPU write is ABSOLUTE (this
; core returns OpenBus garbage on PPU reads).
; $32 = char index (0..${K - 1}), $33 = frame divider.
anim_name:
${namesLine}
anim_attr:
${attrsLine}
anim_init:
  lda #0
  sta $32                        ; char index = 0
  sta $33                        ; frame divider = 0
  lda #$80                       ; NMITIMEN bit7: fire the NMI once per vblank
  sta $4200                      ; (the vector -> nmi_move is baked by the build)
  rts
anim_tick:
  inc $33                        ; count NMI ticks
  lda $33
  cmp #${skip}                   ; one char every ${skip} ticks
  bne anim_write                 ; not yet — just (re)write the current char
  lda $32                        ; advance the char index...
  clc
  adc #1
  cmp #${K}                      ; ...and wrap at K
  bne anim_nowrap
  lda #0
anim_nowrap:
  sta $32
  lda #0
  sta $33
anim_write:
  lda $32
  tax                            ; X = char index
  lda #${word1}
  sta $2102                      ; OAMADDR low = word1 of slot ${slot} (Name+attr)
  lda #0
  sta $2103                      ; OAMADDR high = 0 (word0 position stays put)
  lda anim_name,X                ; Name[7:0] for this char
  sta $2104
  lda anim_attr,X                ; attr (Name[8]+priority+flips) — commits word1
  sta $2104
  rts
`;
}
