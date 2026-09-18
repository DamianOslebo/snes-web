/**
 * CGRAM (Color GRaphics RAM) palette encoding — SNES 5-5-5 RGB.
 *
 * A palette is 16 colors, each color 2 bytes (little-endian), for 32 bytes
 * total. Color index 0 is the transparent color by SNES convention (it may be
 * given any RGB; the T bit is what the hardware uses for transparency).
 *
 * 16-bit color word layout (verified against core/ppu.c `S9xFixColourBrightness`,
 * where `CGDATA[i]` is the 16-bit word):
 *   R = CGDATA & 0x1f          -> bits 0-4  (low byte, low 5 bits)
 *   G = (CGDATA >>  5) & 0x1f  -> bits 5-9
 *   B = (CGDATA >> 10) & 0x1f  -> bits 10-14
 *   T = CGDATA >> 15           -> bit 15  (transparency)
 *
 * NOTE: this is the 5-5-5 CGRAM layout. The shim's `convertVideo()` uses
 * 5-6-5 for the *screen framebuffer* — a different thing; do not mix them.
 *
 * Pure TS, no DOM — unit-testable in the node env like the rest of `src/asm/`.
 */

/** A single 5-5-5 SNES color. `transparent` is the CGRAM T bit (word bit 15). */
export interface Rgb15 {
  r: number; // 0..31
  g: number; // 0..31
  b: number; // 0..31
  transparent: boolean;
}

export const COLORS_PER_PALETTE = 16;
export const BYTES_PER_COLOR = 2;
/** One palette is 16 colors × 2 bytes = 32 bytes. */
export const PALETTE_SIZE = COLORS_PER_PALETTE * BYTES_PER_COLOR;

/** CGRAM base offset within VRAM, and per-palette stride. */
export const CGRAM_BASE = 0xc000;

/** Byte offset in VRAM of palette `paletteIndex` (0-based). */
export function cgramOffset(paletteIndex: number): number {
  return CGRAM_BASE + paletteIndex * PALETTE_SIZE;
}

/** Build a 5-5-5 color from (possibly wider) RGB components; T bit not set. */
export function rgb15(r: number, g: number, b: number): Rgb15 {
  return { r: r & 0x1f, g: g & 0x1f, b: b & 0x1f, transparent: false };
}

/** Expand one 5-bit channel to 8 bits for display: `x8 = (x5<<3)|(x5>>2)`. */
export function rgb5to8(x5: number): number {
  const x = x5 & 0x1f;
  return ((x << 3) | (x >> 2)) & 0xff;
}

/**
 * Encode a 5-5-5 color to its little-endian 2-byte pair (low, high).
 * Low byte carries R[4:0] + G[2:0]; high byte carries G[4:3] + B[4:0] + T.
 */
export function encodeColor(c: Rgb15): { low: number; high: number } {
  const low = (c.r & 0x1f) | ((c.g & 0x7) << 5);
  const high = ((c.g >> 3) & 0x3) | ((c.b & 0x1f) << 2) | ((c.transparent ? 1 : 0) << 7);
  return { low: low & 0xff, high: high & 0xff };
}

/** Decode a little-endian 2-byte pair (low, high) to a 5-5-5 color. */
export function decode15(low: number, high: number): Rgb15 {
  return {
    r: low & 0x1f,
    g: ((low >> 5) & 0x7) | ((high & 0x3) << 3),
    b: (high >> 2) & 0x1f,
    transparent: (high & 0x80) !== 0,
  };
}

/** Encode one 16-color palette to its 32 bytes (2 little-endian bytes/color). */
export function encodePalette(colors: readonly Rgb15[]): Uint8Array {
  if (colors.length !== COLORS_PER_PALETTE) {
    throw new Error(`encodePalette: expected ${COLORS_PER_PALETTE} colors, got ${colors.length}`);
  }
  const out = new Uint8Array(PALETTE_SIZE);
  for (let i = 0; i < COLORS_PER_PALETTE; i++) {
    const { low, high } = encodeColor(colors[i]);
    out[i * 2] = low;
    out[i * 2 + 1] = high;
  }
  return out;
}
