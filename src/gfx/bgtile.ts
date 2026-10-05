/**
 * `bgtile` — pure 65C816 glue that makes ONE CGRAM palette slot SHIMMER across
 * a short colour sequence, paced by the once-per-vblank NMI — the classic SNES
 * "water / fire" tile animation.
 *
 * The mechanism, verified against THIS core (not the manual): a background
 * tile pixel's sub-palette index `Pix` reads CGRAM slot `Pix` — the draw path
 * sets `GFX.RealScreenColors = &IPPU.ScreenColors[(palette bits) + StartPalette]`
 * (tile.c:1032) and then colours the pixel with `GFX.ScreenColors[Pix]`. And a
 * CGDATA write updates that very array: writing `$2121`/`$2122` sets both
 * `PPU.CGDATA[PPU.CGADD]` and `IPPU.ScreenColors[PPU.CGADD]` (ppu.c:2853-2902).
 * So a tile whose "hot" pixels all point at CGRAM slot P renders as whatever
 * colour slot P holds *right now*; rewriting slot P every frame animates the
 * tile — water shimmering, fire flickering, a lava lamp — without ever touching
 * the tilemap or the tile's own bitmap. This is the same proven CGRAM path the
 * Mode 7 white/black bring-up and the earlier black-screen fix already use.
 *
 * It is the background sibling of `anim.ts` (sprite char-swap) and
 * `scroll.ts` (BG0 offset). All three are independent once-per-frame services
 * that compose in the ONE shared NMI handler — `nmiGlue`/`nmi_move` — and a ROM
 * can run any combination (a scrolling BG0 *and* a walking sprite *and* an
 * animated water tile, all in the same frame).
 *
 * The locked split: all the per-frame work (the colour sequence) is baked in
 * TypeScript at export time as two short ROM byte tables (lo/hi of each 15-bit
 * colour); the 65C816 only steps an index and blits two bytes to `$2121`/
 * `$2122`. No palette math, no 16-bit multiply in asm.
 *
 * Because a ROM has exactly ONE NMI vector, `bgtile_tick` is one of the
 * once-per-frame services the shared dispatcher (`nmiGlue` / `nmi_move`) runs;
 * the program arms the tick once (`JSR bgtile_init`) and then idles. It never
 * reads a PPU register (this core returns OpenBus garbage on PPU reads, so
 * every PPU write is ABSOLUTE).
 *
 * Zero-page: $3a = colour index (0..K-1), $3b = frame divider. Deliberately in
 * the free band $32-$3f — clear of spcGlue's $10-$17, vramGlue's $20-$2a,
 * oamGlue's $2b-$31, scroll's $2e/$2f, anim's $32/$33, and mode7's $34/$38/$39.
 *
 * Pure: no DOM, no core — unit-testable and importable by tools.ts, exactly
 * like `scroll.ts` and `anim.ts`.
 */

export interface BgTileAnimConfig {
  /**
   * 2-16 15-bit colours (0x0000-0x7fff) to cycle, in order — one per
   * animation frame. The animated tile's hot pixels must all point at the same
   * CGRAM slot (see `cgramSlot`); this table is what that slot holds, frame by
   * frame. E.g. a water shimmer might be [deep blue, mid blue, light blue,
   * white-foam] cycled in order.
   */
  frames: readonly number[];
  /**
   * The CGRAM palette slot (1-31) the animated tile's hot pixels point at.
   * Default 1. Slot 0 is conventionally left black / unused, so 1 is the safe
   * default. The tile's sub-palette index that is animated MUST equal this.
   */
  cgramSlot?: number;
  /**
   * NMI ticks between colour changes. Default 4 (a new colour every 4th frame,
   * so at 60 fps a colour holds ~1/15 s — a visible but not strobing shimmer).
   * Higher = slower.
   */
  speed?: number;
}

/**
 * Bake the lo/hi byte split of each 15-bit colour in the cycle. The glue
 * writes them in this order to `$2122` (low byte then high byte) after setting
 * the slot in `$2121`. `hi` is masked to 7 bits because a 15-bit SNES colour
 * has no alpha bit (bit 15 of the stored word). Returns the two parallel tables
 * the glue emits (both length K, indexed by the colour index).
 */
export function bgTileAnimTables(frames: readonly number[]): { lo: number[]; hi: number[] } {
  const lo: number[] = [];
  const hi: number[] = [];
  for (const c of frames) {
    lo.push(c & 0xff); // low byte  (bits 0-7)
    hi.push((c >> 8) & 0x7f); // high byte (bits 8-14)
  }
  return { lo, hi };
}

const hex = (n: number) => '$' + (n & 0xff).toString(16).padStart(2, '0');

/**
 * The CGRAM colour-shimmer service. `bgtile_init` parks the colour index and
 * divider at 0 and arms the once-per-vblank NMI; `bgtile_tick` is the per-frame
 * service the NMI dispatcher (`nmiGlue`) runs — it counts NMI ticks, advances
 * (and wraps) the colour index once every `speed` ticks, and writes the current
 * frame's colour into CGRAM slot `cgramSlot` via `$2121`/`$2122`. The program
 * calls `JSR bgtile_init` once and then idles; it never touches the tilemap.
 */
export function bgTileAnimGlue(config: BgTileAnimConfig): string {
  const K = config.frames.length;
  const slot = config.cgramSlot ?? 1;
  const speed = config.speed ?? 4;
  const { lo, hi } = bgTileAnimTables(config.frames);
  const loLine = '  .byte ' + lo.map((n) => hex(n)).join(', ');
  const hiLine = '  .byte ' + hi.map((n) => hex(n)).join(', ');
  return `; --- BG tile water/fire colour animation glue (generated) ----------
; Makes CGRAM palette slot ${slot} CYCLE ${K} colours, one every ${speed} frame(s),
; paced by the once-per-vblank NMI — the same pacemaker the BG0 scroll, the
; d-pad sprite, and the Mode 7 field use. A background tile whose hot pixels
; all point at slot ${slot} shimmers as that slot's colour changes; the tilemap
; and the tile's own bitmap are never touched. The program calls (after the
; background is set up):
;   JSR bgtile_init          ... then:  idle: bra idle
; and never touches the tile itself: the NMI handler (nmi_move) runs
; bgtile_tick once per frame, which writes the current colour into slot ${slot}
; via CGADD=$2121 / CGDATA=$2122. Every PPU write is ABSOLUTE (this core
; returns OpenBus garbage on PPU reads).
; $3a = colour index (0..${K - 1}), $3b = frame divider.
bgtile_lo:
${loLine}
bgtile_hi:
${hiLine}
bgtile_init:
  lda #0
  sta $3a                        ; colour index = 0
  sta $3b                        ; frame divider = 0
  lda #$80                       ; NMITIMEN bit7: fire the NMI once per vblank
  sta $4200                      ; (the vector -> nmi_move is baked by the build)
  rts
bgtile_tick:
  inc $3b                        ; count NMI ticks
  lda $3b
  cmp #${speed}                  ; one colour every ${speed} ticks
  bne bt_write                   ; not yet — just (re)write the current colour
  lda $3a                        ; advance the colour index...
  clc
  adc #1
  cmp #${K}                      ; ...and wrap at K
  bne bt_nowrap
  lda #0
bt_nowrap:
  sta $3a
  lda #0
  sta $3b
bt_write:
  lda $3a
  tax                            ; X = colour index
  lda #${slot}
  sta $2121                      ; CGADD = palette slot ${slot} (the animated slot)
  lda bgtile_lo,X                ; colour low byte for this frame
  sta $2122                      ; CGDATA low
  lda bgtile_hi,X                ; colour high byte — commits the slot colour
  sta $2122                      ; CGDATA high (updates IPPU.ScreenColors[${slot}])
  rts
`;
}
