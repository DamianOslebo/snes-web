/**
 * SNES background tile encoding (and the low-level 8×8 decode its tests need).
 *
 * SNES tiles are stored **planar** and **MSB-first** — confirmed by running the
 * core's real `ConvertTile2/4/8` (oracle) and against `core/ppu.c` + the manual.
 * For an 8×8 sub-tile, pixel (row r, col c) at plane p lives at:
 *
 *     byteOffset = (p >> 1) * 16 + 2 * r + (p & 1)
 *     bit        = 7 - c                      // bit 7 = leftmost (col 0)
 *
 * so the color *index* is the 2/4/8 planes recombined: `index |= bit << p`.
 * Bytes per 8×8 sub-tile = depth × 8 (2bpp→16, 4bpp→32, 8bpp→64).
 *
 * A 16×16 tile is 4 8×8 sub-tiles at 8×8 char slots (verified via ppu.c
 * `TILE_PLUS` + `t1=16`, `TILE_PLUS(Tile, HTile & 1)`):
 *     UL → N,   UR → N+1,  LL → N+16,  LR → N+17
 *
 * Pure TS, no DOM — unit-testable in the node env like the rest of `src/asm/`.
 */

/** Per-background-mode geometry (manual Appendix A / ppu.c). Indexed by mode 0-7. */
export interface ModeInfo {
  mode: number;
  depth: number; // bits per pixel: 2 | 4 | 8
  size: number; // tile edge in px: 8 or 16
}

/** All 8 background modes. (7 is mode 7 EXTBG, 8×8 256-color.) */
export const MODES: readonly ModeInfo[] = [
  { mode: 0, depth: 2, size: 8 }, // 8×8,  4 colors
  { mode: 1, depth: 2, size: 16 }, // 16×16, 4 colors
  { mode: 2, depth: 4, size: 8 }, // 8×8, 16 colors
  { mode: 3, depth: 4, size: 16 }, // 16×16, 16 colors
  { mode: 4, depth: 8, size: 8 }, // 8×8, 256 colors
  { mode: 5, depth: 8, size: 16 }, // 16×16, 256 colors
  { mode: 6, depth: 2, size: 8 }, // 8×8,  4 colors
  { mode: 7, depth: 8, size: 8 }, // 8×8, 256 colors (EXTBG)
];

function info(mode: number): ModeInfo {
  const m = MODES[mode & 7];
  if (!m) throw new Error(`tile-encode: invalid mode ${mode} (must be 0-7)`);
  return m;
}

export function depthForMode(mode: number): number {
  return info(mode).depth;
}

export function sizeForMode(mode: number): number {
  return info(mode).size;
}

/** Number of colors a mode's tiles can address (2^depth). */
export function colorsForMode(mode: number): number {
  return 1 << depthForMode(mode);
}

/** Bytes per 8×8 sub-tile for the given mode (depth × 8). */
export function charBytesForMode(mode: number): number {
  return depthForMode(mode) * 8;
}

/**
 * 8×8 char-slot stride between consecutive tiles: 1 for 8×8 modes, 2 for 16×16
 * (each 16×16 tile spans 2 char columns: its UL at N and UR at N+1).
 */
export function tileCharStride(mode: number): number {
  return sizeForMode(mode) === 16 ? 2 : 1;
}

/** Relative 8×8 char-slot offsets of a 16×16 tile's sub-tiles: [UL,UR,LL,LR]. */
export const SUBTILE_OFFSETS = [0, 1, 16, 17] as const;

/**
 * Encode a single 8×8 sub-tile (8 rows × 8 cols of palette indices) to its
 * `depth*8` planar bytes. Throws on an index that doesn't fit the depth.
 */
export function encode8x8(pixels: number[][], depth: number): Uint8Array {
  if (pixels.length !== 8 || pixels.some((row) => row.length !== 8)) {
    throw new Error('encode8x8: expected an 8×8 pixel grid');
  }
  const maxIdx = (1 << depth) - 1;
  const out = new Uint8Array(depth * 8);
  for (let p = 0; p < depth; p++) {
    for (let r = 0; r < 8; r++) {
      let byte = 0;
      for (let c = 0; c < 8; c++) {
        const idx = pixels[r][c];
        if (idx < 0 || idx > maxIdx) {
          throw new Error(`encode8x8: palette index ${idx} out of range for ${depth}bpp (0..${maxIdx})`);
        }
        const bit = (idx >> p) & 1;
        if (bit) byte |= 1 << (7 - c);
      }
      // byteOffset = (p>>1)*16 + 2*r + (p&1)  ==  row r of plane-pair (p>>1), byte (p&1)
      out[(p >> 1) * 16 + 2 * r + (p & 1)] = byte;
    }
  }
  return out;
}

/**
 * Decode a single 8×8 sub-tile from planar bytes (inverse of `encode8x8`).
 * `src` must have at least `depth*8` bytes from `byteOff`. Returns 8×8 indices.
 */
export function decode8x8(src: Uint8Array, byteOff: number, depth: number): number[][] {
  const px: number[][] = [];
  for (let r = 0; r < 8; r++) {
    const row: number[] = [];
    for (let c = 0; c < 8; c++) {
      let idx = 0;
      for (let p = 0; p < depth; p++) {
        const byte = src[byteOff + (p >> 1) * 16 + 2 * r + (p & 1)];
        if ((byte >> (7 - c)) & 1) idx |= 1 << p;
      }
      row.push(idx);
    }
    px.push(row);
  }
  return px;
}

/**
 * Encode a whole background tile (8×8 or 16×16 pixel grid, palette indices) to
 * a standalone byte blob:
 *   - 8×8 mode:  `depth*8` bytes (the single sub-tile)
 *   - 16×16 mode: `4 * depth*8` bytes in [UL, UR, LL, LR] order (each `depth*8`)
 */
export function encodeTile(pixels: number[][], mode: number): Uint8Array {
  const m = info(mode);
  const cb = m.depth * 8;
  if (pixels.length !== m.size || pixels.some((row) => row.length !== m.size)) {
    throw new Error(`encodeTile: expected a ${m.size}×${m.size} pixel grid for mode ${mode}`);
  }
  if (m.size === 8) return encode8x8(pixels, m.depth);

  // 16×16: four 8×8 sub-tiles, [UL, UR, LL, LR]
  const sub = (r0: number, c0: number): number[][] => {
    const out: number[][] = [];
    for (let r = 0; r < 8; r++) out.push(pixels[r0 + r].slice(c0, c0 + 8));
    return out;
  };
  const blob = new Uint8Array(4 * cb);
  const blocks = [sub(0, 0), sub(0, 8), sub(8, 0), sub(8, 8)];
  for (let k = 0; k < 4; k++) {
    const enc = encode8x8(blocks[k], m.depth);
    blob.set(enc, k * cb);
  }
  return blob;
}

/**
 * Encode a tile directly into a VRAM buffer (zero-filling the slots it writes)
 * so `buildVram` can place many tiles at their char slots. `charSlot` is the
 * tile's UL sub-tile slot; `tileBase` is the char region base (both 8×8 units).
 */
export function encodeTileAt(
  vram: Uint8Array,
  pixels: number[][],
  mode: number,
  charSlot: number,
  tileBase = 0,
): void {
  const m = info(mode);
  const cb = m.depth * 8;
  const slots: number[] = m.size === 8 ? [0] : [...SUBTILE_OFFSETS];
  const quads: Array<[number, number]> = m.size === 8 ? [[0, 0]] : [[0, 0], [0, 8], [8, 0], [8, 8]];
  for (let k = 0; k < slots.length; k++) {
    const slot = (tileBase + charSlot + slots[k]) * cb;
    if (slot + cb > vram.length) throw new Error(`encodeTileAt: tile at char slot ${tileBase + charSlot + slots[k]} exceeds VRAM`);
    // Zero the sub-tile region first so a re-encode is self-contained.
    vram.fill(0, slot, slot + cb);
    const enc = m.size === 8
      ? encode8x8(pixels, m.depth)
      : encode8x8(quad8(pixels, quads[k]), m.depth);
    vram.set(enc, slot);
  }
}

function quad8(pixels: number[][], [r0, c0]: [number, number]): number[][] {
  const out: number[][] = [];
  for (let r = 0; r < 8; r++) out.push(pixels[r0 + r].slice(c0, c0 + 8));
  return out;
}
