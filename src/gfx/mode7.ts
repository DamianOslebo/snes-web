/**
 * `mode7` — pure 65C816 glue that drives a BG1 **Mode 7** (affine) background:
 * a 128×128-tile field in VRAM that ZOOMS or ROTATES once per vblank NMI.
 *
 * It is the per-frame-background sibling of `scroll.ts`'s `bg_scroll`. `scroll`
 * nudges a tilemap's scroll offset each frame; `mode7` instead writes the affine
 * MATRIX (A/B/C/D) each frame so the whole field scales/rotates — the classic
 * SNES starfield / zoom / spin. The heavy lifting (the matrix for every frame)
 * is precomputed in TypeScript and baked as a small ROM table; the 65C816 glue
 * only steps an index and blits 8 bytes to `$211b`–`$211e`. No trig, no 16-bit
 * multiply in asm — the split the rest of this repo already uses.
 *
 * Pinned against this core (snes9x-2010), not the manual:
 *
 *   * BGMODE ($2105) = `Byte & 7` (ppu.c:3280) — write 7 to select Mode 7.
 *   * case 7 (ppu.c:2046): BG1 draws when `BGActive & 0x01` (TM bit 0, $212c),
 *     via `DrawBackgroundMode7(0, …, DrawMode7BG1Nomath, …)` when the MATH
 *     register bit 0 ($2131) is 0. So: TM bit 0 on, $2131 = 0 (Nomath, default
 *     colour op) — the Math/Nomath split is the colour-ADD op, NOT the affine;
 *     both read the same matrix + M7HOFS/M7VOFS.
 *   * M7A–M7D ($211b–$211e) and M7X/M7Y ($211f/$2120) all use the lo-then-hi
 *     `PPU.M7byte` latch (ppu.c:3482-3512): write the LOW byte, then the HIGH
 *     byte, both to the SAME address. So `w16(addr, v)` = write `v&0xff` then
 *     `(v>>8)&0xff`. M7HOFS/M7VOFS ($210d/$210e) latch identically (ppu.c:
 *     3347-3358). Every PPU value here is 16-bit signed (`short`, ppu.h:360-367),
 *     so two's-complement lo/hi writes are correct and a negative B/C (rotate)
 *     sign-extends.
 *   * The renderer is `DrawMode7BG1_Normal1x1` (tile.c:10339). With the centre
 *     and offsets pinned below, screen centre (128,112) maps to field centre
 *     (512,512), and the sampled field stays in 0..1023 across a 0.5×–2× zoom
 *     or a full 360° rotate — so with the REPEAT bit set (M7SEL bit 6 = $40)
 *     nothing is ever skipped to black.
 *
 *   Field layout (from tile.c:10393-10394): the NAME table (128×128 char
 *   indices) lives on the EVEN bytes `256·(Y>>3) + 2·(X>>3)`, and a char L's
 *   colour bytes live on the ODD bytes `1 + L·128 + (Y&7)·16 + (X&7)·2`. The
 *   two parities are disjoint, so the 2-char field below uses even bytes for
 *   the LUT and odd bytes 1..127 for char 0 (white) — char 1 (odd bytes
 *   129..255) stays 0 = colour 0 = transparent (the `if (M)` guard in
 *   M7N_PIXEL_N1x1, tile.c:10275, skips colour-0 pixels, so the black backdrop
 *   shows through). CGRAM[1] is white.
 *
 *   The 32 KB field is TOO BIG for the low-bank entry region (MAX_CODE =
 *   $7FB0 — which is also where the assembled code lives) and for WRAM (only
 *   8 KB in the system view), so it is NOT `.incbin`-embedded and NOT
 *   decompressed into WRAM. It is placed in the ROM's HIGH BANK — file
 *   $8000–$ffff — by `AsmController.setHighBank()` (see `rom.ts` `highBank`),
 *   which under LoROM maps to CPU **bank $01, offset $8000–$ffff** (memmap.c
 *   `MAP_LOROM_OFFSET`: `addr = (c - bank_s) * 0x8000` → bank $01 ⇒ file $8000).
 *   `mode7_init` streams it straight to VRAM with the 65C816 **Absolute Long
 *   Indexed X** mode (opcode 0xBF): `lda $01:8000,X` reads `READ_3WORD + X.W`
 *   (cpuaddr.h `AbsoluteLongIndexedX`) — a 24-bit base of `$01:8000` plus the
 *   FULL 16-bit X. Sweeping X 0..$7FFF reads field byte 0..$7FFF with no
 *   decompression and no WRAM scratch — the field is the only thing that big,
 *   and it lives exactly where it must. 16-bit X is REQUIRED for the sweep
 *   (8-bit X wraps at $100 after one page), so the loop saves the 8-bit X bit
 *   with `rep #$02` / `sep #$02` — a targeted save/restore of just the X-width
 *   bit, restoring the codebase's pure-8-bit contract on the other side.
 *
 * Zero-page: $34 = table index (0..speed-1), $38/$39 = the 16384-word upload
 * counter. All in the free band $32–$3f — clear of spcGlue's $10–$17,
 * vramGlue's $20–$2a, oamGlue's $2b–$31, anim's $32/$33, bgtile's $3a–$3c,
 * and the LZ decoder's $40–$4c.
 *
 * Pure: no DOM, no core — unit-testable and importable by tools.ts, exactly
 * like `scroll.ts`.
 */

export type Mode7Kind = 'zoom' | 'rotate';
export type Mode7Dir = 'in' | 'out' | 'cw' | 'ccw';

export interface Mode7Config {
  kind: Mode7Kind;
  /** zoom: 'in' | 'out'; rotate: 'cw' | 'ccw'. */
  dir: Mode7Dir;
  /** Frames per full cycle (a zoom pass, or one 360° turn). 2–64, default 60. */
  speed?: number;
}

/** The 32 KB Mode 7 field is 16 384 VRAM words. */
export const MODE7_FIELD_WORDS = 16384;

const FIELD_BYTES = 32768;

const hex = (n: number) => '$' + (n & 0xff).toString(16).padStart(2, '0');

/**
 * The 32 KB parity-interleaved field for a two-char checkerboard:
 *
 *   - even bytes `256·R + 2·C` (R=C=0..127)  — the NAME table, a 2×2 checker
 *     of char 0 / char 1 (a 16×16 px checkerboard on screen — a high-contrast
 *     pattern whose zoom/rotation is unmistakable to the eye and to a probe);
 *   - char 0 (white): colour bytes on odd `1 + 16·r + 2·c` (r,c=0..7) set to 1;
 *   - char 1 (transparent): colour bytes on odd `129 + 16·r + 2·c` left 0.
 *
 * Colour 0 is transparent in this core's Nomath renderer (M7N_PIXEL_N1x1 only
 * plots when the colour index is non-zero), so char 1 shows the black backdrop
 * and CGRAM[1] (white) is the only colour that must be defined.
 */
export function mode7FieldBytes(): Uint8Array {
  const f = new Uint8Array(FIELD_BYTES);
  // NAME table (even bytes): a 2×2 tile checkerboard of char 0 / char 1.
  for (let R = 0; R < 128; R++)
    for (let C = 0; C < 128; C++) f[256 * R + 2 * C] = ((R >> 1) ^ (C >> 1)) & 1;
  // char 0 (the "white" char): colour index 1 at each pixel's even-relative slot.
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) f[1 + r * 16 + c * 2] = 1;
  // char 1 stays 0 everywhere → colour 0 → transparent (black backdrop).
  return f;
}

/** One entry of the precomputed matrix table: A/B/C/D as 16-bit (signed) words. */
export interface Mode7Entry {
  A: number;
  B: number;
  C: number;
  D: number;
}

/**
 * Precompute the per-frame matrix for `speed` frames (index 0..speed-1).
 *
 *   zoom   s(t) = 0.5 + 1.5·t        (t=0 → 0.5×, t=1 → 2.0×)
 *          'in'  grows the field, 'out' shrinks it; A=D=256·s, B=C=0.
 *   rotate s = 1.0, θ(t) = ±2π·t     (one full turn over the cycle)
 *          A=D=256·cos θ, B=−256·sin θ, C=256·sin θ.
 *
 * All values are 16-bit two's-complement (`& 0xffff`) so the lo-then-hi PPU
 * writes in the glue are exact, and a negative B/C for rotate sign-extends
 * through the `short` matrix registers.
 */
export function mode7MatrixTable(kind: Mode7Kind, dir: Mode7Dir, speed: number): Mode7Entry[] {
  const n = Math.max(2, Math.min(64, Math.round(speed)));
  const out: Mode7Entry[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / n;
    let A: number, B: number, C: number, D: number;
    if (kind === 'zoom') {
      const s = dir === 'in' ? 0.5 + 1.5 * t : 2.0 - 1.5 * t;
      const m = Math.round(256 * s);
      A = D = m;
      B = C = 0;
    } else {
      const th = dir === 'cw' ? 2 * Math.PI * t : -2 * Math.PI * t;
      A = D = Math.round(256 * Math.cos(th));
      B = Math.round(-256 * Math.sin(th));
      C = Math.round(256 * Math.sin(th));
    }
    out.push({ A: A & 0xffff, B: B & 0xffff, C: C & 0xffff, D: D & 0xffff });
  }
  return out;
}

const w16 = (addr: string, v: number): string =>
  `  lda ${hex(v & 0xff)}\n  sta $${addr}\n  lda ${hex((v >> 8) & 0xff)}\n  sta $${addr}\n`;

/**
 * The Mode 7 service. `mode7_init` streams the 32 KB high-bank field
 * (CPU bank $01, base $8000) straight into VRAM words 0..16383 with the 0xBF
 * `lda $01:8000,X` Absolute-Long-Indexed-X sweep, paints CGRAM[0]=black /
 * CGRAM[1]=white, enables Mode 7 (BGMODE=7, repeat, Nomath, TM bit 0), pins
 * the centre (512,512) + offsets (HOFS=384, VOFS=400) so screen-centre maps
 * to field-centre, writes the initial matrix, un-blanks, and arms the
 * once-per-vblank NMI. `mode7_tick` is the per-frame service the NMI dispatcher
 * (`nmiGlue`) runs: it advances (and wraps) the table index and writes A/B/C/D
 * (lo-then-hi) to `$211b`–`$211e`.
 *
 * The field itself is NOT embedded or decompressed: `AsmController.setHighBank`
 * (see `rom.ts` `highBank`) places it in the ROM's high bank (file $8000–$ffff),
 * which this glue reads with the 16-bit-X sweep above.
 */
export function mode7Glue(config: Mode7Config): string {
  const speed = Math.max(2, Math.min(64, Math.round(config.speed ?? 60)));
  const table = mode7MatrixTable(config.kind, config.dir, speed);
  const byteLine = (vals: number[]) =>
    '  .byte ' + vals.map((v) => hex(v & 0xff)).join(', ');
  const aLo = table.map((e) => e.A & 0xff);
  const aHi = table.map((e) => (e.A >> 8) & 0xff);
  const bLo = table.map((e) => e.B & 0xff);
  const bHi = table.map((e) => (e.B >> 8) & 0xff);
  const cLo = table.map((e) => e.C & 0xff);
  const cHi = table.map((e) => (e.C >> 8) & 0xff);
  const dLo = table.map((e) => e.D & 0xff);
  const dHi = table.map((e) => (e.D >> 8) & 0xff);
  return `; --- Mode 7 (BG1 affine) background glue (generated) ---------------
; Drives a ${config.kind} Mode 7 background (${config.dir}), ${speed} frames/cycle.
; The program calls (after its other bring-up):
;   JSR mode7_init          ... then:  idle: bra idle
; and never touches the matrix itself: the NMI handler (nmi_move) runs
; mode7_tick once per frame, which steps the table index and writes A/B/C/D
; (lo-then-hi) to $211b-$211e. Every PPU write is ABSOLUTE (this core returns
; OpenBus garbage on PPU reads).
; The 32 KB field is read from the ROM high bank (CPU $018000) by the 0xBF
; lda $01:8000,X sweep — it is NOT embedded or decompressed here.
; $34 = table index (0..${speed - 1}), $38/$39 = word counter.
mode7_init:
  ; --- stream the 32 KB high-bank field into VRAM words 0..16383 ------------
  ; The field lives in the ROM high bank: CPU bank $01, base $8000 (file
  ; $8000..$ffff under LoROM). 0xBF lda $01:8000,X reads READ_3WORD + X.W —
  ; a 24-bit base plus the FULL 16-bit X — so sweeping X 0..$7FFF reads the
  ; whole field with no decompression and no WRAM scratch. 16-bit X is
  ; REQUIRED (8-bit X wraps at $100 after one page), hence rep/sep #$02.
  lda #$80                       ; VMAIN: high byte + auto-increment
  sta $2115
  lda #$00                       ; VMADDL/H = 0 (start at VRAM word 0)
  sta $2116
  sta $2117
  lda #$00                       ; word counter = 16384 (0x4000)
  sta $38
  lda #$40
  sta $39
  lda #$80                       ; INIDISP forced-blank (BlockInvalidVRAMAccess)
  sta $2100
  rep #$02                       ; 16-bit X — required to sweep 32 KB
  ldx #$0000                     ; X = 0 (2-byte immediate; 16-bit X mode)
m7_field:
  lda $01:8000,X                 ; 0xBF: field word low byte (bank $01, base $8000, +X)
  sta $2118
  inx
  lda $01:8000,X                 ; 0xBF: field word high byte
  sta $2119
  inx
  dec $38                        ; 16-bit word counter (lo)
  bne m7_field
  dec $39                        ; (hi)
  bne m7_field
  sep #$02                       ; restore 8-bit X
  ; --- CGRAM: colour 0 = black (transparent), colour 1 = white --------------
  lda #$00                       ; CGADD = 0 (first $2122 = low byte)
  sta $2121
  lda #$00
  sta $2122                      ; colour 0 low
  lda #$00
  sta $2122                      ; colour 0 high
  lda #$ff                       ; colour 1 = white (15-bit, full on)
  sta $2122
  lda #$7f
  sta $2122
  ; --- enable Mode 7 (Nomath: the affine is the same either way) ------------
  lda #$07                       ; BGMODE = 7
  sta $2105
  lda #$40                       ; M7SEL bit 6: repeat (no black out-of-range)
  sta $211a
  lda #$00                       ; MATH bit 0 = 0 (Nomath / default colour op)
  sta $2131
  lda #$01                       ; TM bit 0: BG1 (Mode 7) on
  sta $212c
  ; --- centre + offsets (lo-then-hi): screen-centre -> field-centre ----------
${w16('210d', 384).split('\n').map((l) => l.trim() ? '  ' + l.trimStart() : l).join('\n')}
${w16('210e', 400).split('\n').map((l) => l.trim() ? '  ' + l.trimStart() : l).join('\n')}
${w16('211f', 512).split('\n').map((l) => l.trim() ? '  ' + l.trimStart() : l).join('\n')}
${w16('2120', 512).split('\n').map((l) => l.trim() ? '  ' + l.trimStart() : l).join('\n')}
  ; --- write the initial matrix (index 0) so frame 1 is already live ---------
  lda #0
  sta $34
  jsr mode7_matrix
  lda #$0f                       ; un-blank + full brightness
  sta $2100
  lda #$80                       ; NMITIMEN bit7: fire the NMI once per vblank
  sta $4200
  rts
mode7_tick:
  inc $34                        ; step the frame index
  lda $34
  cmp #${speed}                  ; wrap at ${speed} frames
  bne m7_nowrap
  lda #0
m7_nowrap:
  sta $34
  jsr mode7_matrix               ; write A/B/C/D for this index
  rts
mode7_matrix:
  lda $34
  tax                            ; X = table index (0..${speed - 1})
  lda mode7_Alo,X
  sta $211b
  lda mode7_Ahi,X
  sta $211b
  lda mode7_Blo,X
  sta $211c
  lda mode7_Bhi,X
  sta $211c
  lda mode7_Clo,X
  sta $211d
  lda mode7_Chi,X
  sta $211d
  lda mode7_Dlo,X
  sta $211e
  lda mode7_Dhi,X
  sta $211e
  rts
; --- the precomputed matrix table (8 parallel byte arrays, X = index) --------
mode7_Alo:
${byteLine(aLo)}
mode7_Ahi:
${byteLine(aHi)}
mode7_Blo:
${byteLine(bLo)}
mode7_Bhi:
${byteLine(bHi)}
mode7_Clo:
${byteLine(cLo)}
mode7_Chi:
${byteLine(cHi)}
mode7_Dlo:
${byteLine(dLo)}
mode7_Dhi:
${byteLine(dHi)}
`;
}
