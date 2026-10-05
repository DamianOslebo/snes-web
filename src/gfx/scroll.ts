/**
 * `scroll` — pure 65C816 glue for a SCROLLABLE BG0 background.
 *
 * A scrolling background is driven by the SNES scroll-offset registers, which
 * are SEPARATE from the bring-up glue's BG0SC (`$2107` sets only SCSize +
 * SCBase, not scroll — verified against this snes9x-2010 core's ppu.c):
 *   $210D (HOffset) and $210E (VOffset), each written LOW byte first then HIGH
 *   byte, and the two are NOT interleaved (they share the PPU's OFS low-byte
 *   latch). So one scroll step is: H then 0 to $210D, then V then 0 to $210E.
 *
 * The position lives in two persistent 8-bit zero-page counters ($2e/$2f — the
 * free gap between vramGlue's $2a and oamGlue's $2b) and is advanced ONCE PER
 * FRAME by the NMI at vblank — the same pacemaker the d-pad sprite uses. The
 * program arms the tick once (`JSR bg_scroll_init`) and then idles; it never
 * advances the scroll itself and NEVER reads a PPU register (this core returns
 * OpenBus garbage on reads, so scroll is written as ABSOLUTE values).
 *
 * Because a ROM has exactly ONE NMI vector, the once-per-frame services (the
 * scroll tick and the sprite tick) share a single handler: `nmiGlue` emits that
 * one `nmi_move`, and `scrollStepsFromSource` recomputes (purely and
 * order-independently) which services the current source actually has. The
 * build (rom.ts) bakes the NMI vector at `nmi_move`.
 *
 * Pure: no DOM, no core — unit-testable and importable by tools.ts.
 */

export interface ScrollConfig {
  /** Signed pixels/frame to scroll horizontally. Positive = right, negative = left. */
  dx: number;
  /** Signed pixels/frame to scroll vertically. Positive = down, negative = up. */
  dy: number;
}

const hex = (n: number) => '$' + (n & 0xff).toString(16).padStart(2, '0');

/**
 * One counter advance for a signed 8-bit delta, baked in at export time. The
 * sign picks `adc` (positive) vs `sbc` (negative); each sets the carry flag it
 * needs first (`clc`/`sec`) so the result never depends on prior flags, and the
 * 8-bit wrap is free (low byte of the 65C816 accumulator).
 */
function step(reg: string, what: string, delta: number): string {
  const d = delta | 0;
  if (d >= 0) {
    return `  lda ${reg}\n  clc\n  adc #${hex(d & 0xff)}\n  sta ${reg}    ; ${what} += ${d} (8-bit wrap)`;
  }
  return `  lda ${reg}\n  sec\n  sbc #${hex((-d) & 0xff)}\n  sta ${reg}    ; ${what} -= ${-d} (8-bit wrap)`;
}

/**
 * The BG0 scroll service. `bg_scroll_init` parks the scroll at the origin and
 * arms the once-per-vblank NMI; `bg_scroll` is the per-frame tick the NMI
 * dispatcher (`nmiGlue`) runs — it advances the two counters and writes the
 * ABSOLUTE offsets to $210D/$210E (low byte first, then high, never
 * interleaved). The program calls `JSR bg_scroll_init` once and then idles.
 */
export function bgScrollGlue(config: ScrollConfig): string {
  return `; --- BG0 scroll glue (generated) ---------------------------------------
; SCROLLS the BG0 background once per frame via the SNES scroll-offset
; registers. $2e = HOffset, $2f = VOffset (persistent 8-bit counters). The
; NMI handler nmi_move (see the shared NMI-dispatcher glue) runs bg_scroll
; once per frame at vblank. The program arms it once:
;   JSR bg_scroll_init          ... then:  idle: bra idle
; It never reads a PPU register (this core returns OpenBus garbage on reads)
; and never touches $2107 (BG0SC size/base) — the bring-up SCBase stays valid.
bg_scroll_init:
  lda #0
  sta $2e                        ; HOffset = 0
  sta $2f                        ; VOffset = 0
  lda #$80                       ; NMITIMEN bit7: fire the NMI once per vblank
  sta $4200                      ; (the vector -> nmi_move is baked by the build)
  rts
bg_scroll:
${step('$2e', 'H', config.dx)}
${step('$2f', 'V', config.dy)}
  lda $2e                        ; write HOffset ($210D): LOW byte
  sta $210d
  lda #0                         ; ...then HIGH byte (0)
  sta $210d
  lda $2f                        ; write VOffset ($210E): LOW byte
  sta $210e
  lda #0                         ; ...then HIGH byte (0)
  sta $210e
  rts
`;
}

/**
 * The single NMI handler for the ROM. A ROM has exactly ONE NMI vector (the
 * build bakes it at `nmi_move`), so every once-per-frame service — the BG0
 * scroll tick (`bg_scroll`) and the d-pad sprite tick (`spr_move`) — must be
 * dispatched from this one handler. `steps` is the ordered list of the services
 * present in the current source; it is recomputed (purely and order-
 * independently) by the export tools, so whichever services are active are all
 * covered in one NMI. Returns `''` for an empty list (no once-per-frame
 * service → no handler needed).
 */
export function nmiGlue(steps: string[]): string {
  if (steps.length === 0) return '';
  const body = steps.map((s) => `  jsr ${s}`).join('\n');
  return `; --- NMI dispatcher glue (generated) ------------------------------------
; THE single NMI handler for this ROM — the build bakes the NMI vector at
; nmi_move. It fires once per frame at vblank and runs every once-per-frame
; service that is present, in order: the BG0 scroll tick (bg_scroll) and/or
; the d-pad sprite tick (spr_move). Recomputed by the export tools from the
; current source, so a ROM with BOTH a moving sprite and a scrolling
; background gets one handler that does both.
nmi_move:
${body}
  rti
`;
}

/**
 * Which once-per-frame services are present in the current asm source, in
 * dispatch order. (Named after the first feature added here; it is really "the
 * NMI steps" — every once-per-frame service a ROM wants to run.) A service is
 * present when its defining label exists — i.e. the glue that emits it was
 * exported (`gfx_set_scroll` → `bg_scroll`, `gfx_export_oam` → `spr_move`,
 * `gfx_sprite_anim` → `anim_tick`, `gfx_bg_mode7` → `mode7_tick`,
 * `gfx_bg_tile_anim` → `bgtile_tick`). Line-anchored (label at the start of a
 * line) so a `jsr <label>` or a comment never counts as a definition.
 */
export function scrollStepsFromSource(src: string): string[] {
  const steps: string[] = [];
  if (/^\s*bg_scroll\s*:/m.test(src)) steps.push('bg_scroll');
  if (/^\s*spr_move\s*:/m.test(src)) steps.push('spr_move');
  if (/^\s*anim_tick\s*:/m.test(src)) steps.push('anim_tick');
  if (/^\s*mode7_tick\s*:/m.test(src)) steps.push('mode7_tick');
  if (/^\s*bgtile_tick\s*:/m.test(src)) steps.push('bgtile_tick');
  return steps;
}
