/**
 * Decode SNES VRAM back into pixels / colors / tilemap entries — the inverse of
 * the encoders in `tile-encode.ts`, `palette.ts`, `tilemap.ts`. All functions
 * read straight out of a 64 KB VRAM buffer.
 *
 * Pure TS, no DOM — unit-testable in the node env like the rest of `src/asm/`.
 */

import {
  charBytesForMode,
  decode8x8,
  depthForMode,
  sizeForMode,
  SUBTILE_OFFSETS,
} from './tile-encode';
import {
  decode15,
  cgramOffset,
  COLORS_PER_PALETTE,
  PALETTE_SIZE,
  type Rgb15,
} from './palette';
import { decodeEntry, type TilemapEntry } from './tilemap';

/**
 * Decode one background tile to a `size×size` grid of palette indices.
 *
 * `vram` is the tile-graphics region (or full VRAM), `tileIndex` the tile's
 * 8×8 char slot (UL sub-tile for 16×16), `tileBase` the char-region base
 * (default 0 so tests can pass a bare tile buffer). 16×16 tiles compose their
 * four sub-tiles from slots N, N+1, N+16, N+17.
 */
export function decodeTile(vram: Uint8Array, mode: number, tileIndex: number, tileBase = 0): number[][] {
  const size = sizeForMode(mode);
  const cb = charBytesForMode(mode);
  const depth = depthForMode(mode);
  const px: number[][] = [];
  for (let r = 0; r < size; r++) px.push(new Array(size).fill(0));

  if (size === 8) {
    // char-slot semantics (matches the 16×16 branch): tileBase + tileIndex is
    // the 8×8 char slot, in bytes that's * cb.
    const dec = decode8x8(vram, (tileBase + tileIndex) * cb, depth);
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) px[r][c] = dec[r][c];
    return px;
  }

  // 16×16: compose from [UL,UR,LL,LR] at char slots N, N+1, N+16, N+17.
  const quads: Array<[number, number]> = [[0, 0], [0, 8], [8, 0], [8, 8]];
  for (let k = 0; k < 4; k++) {
    const slot = tileBase + tileIndex + SUBTILE_OFFSETS[k];
    const dec = decode8x8(vram, slot * cb, depth);
    const [r0, c0] = quads[k];
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) px[r0 + r][c0 + c] = dec[r][c];
  }
  return px;
}

/**
 * Decode one CGRAM palette (16 colors) from VRAM. `paletteIndex` is 0-based
 * from CGRAM ($C000); each color is 2 little-endian bytes.
 */
export function decodePalette(vram: Uint8Array, paletteIndex: number): Rgb15[] {
  const off = cgramOffset(paletteIndex);
  if (off + PALETTE_SIZE > vram.length) {
    throw new Error(`decodePalette: palette ${paletteIndex} at $${off.toString(16)} exceeds VRAM`);
  }
  const out: Rgb15[] = [];
  for (let i = 0; i < COLORS_PER_PALETTE; i++) {
    out.push(decode15(vram[off + i * 2], vram[off + i * 2 + 1]));
  }
  return out;
}

/**
 * Decode a tilemap (SC0) of `count` 16-bit entries starting at byte offset
 * `mapBase` (default: 1024 entries from base 0). Little-endian pairs.
 */
export function decodeTilemap(vram: Uint8Array, mapBase = 0, count = 1024): TilemapEntry[] {
  const end = mapBase + count * 2;
  if (end > vram.length) {
    throw new Error(`decodeTilemap: map at base ${mapBase} with ${count} entries exceeds VRAM`);
  }
  const out: TilemapEntry[] = [];
  for (let i = 0; i < count; i++) {
    const word = vram[mapBase + i * 2] | (vram[mapBase + i * 2 + 1] << 8);
    out.push(decodeEntry(word));
  }
  return out;
}
