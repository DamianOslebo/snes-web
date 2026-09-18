/**
 * SNES background tilemap (SC0) encoding — 16-bit entries.
 *
 * Entry bit layout (verified against the manual + `core/ppu.c` + `core/tile.c`):
 *   bits  9-0  = tile name (10-bit)        0x03FF
 *   bits 12-10 = palette (3-bit, bank)     0x1C00   (ignored for 8bpp modes)
 *   bit  13    = priority                  0x2000
 *   bit  14    = H-flip (mirror X)         0x4000
 *   bit  15    = V-flip (mirror Y)         0x8000
 *
 * Little-endian 16-bit: low byte first. A full SC0 map is 1024 entries = 2048 B,
 * located at byte offset `SCBase * 2` in VRAM (ppu.c: `SC0 = &VRAM[SCBase << 1]`).
 *
 * Pure TS, no DOM — unit-testable in the node env like the rest of `src/asm/`.
 */

export interface TilemapEntry {
  tile: number; // 0..1023 (10-bit tile name)
  palette: number; // 0..7 (3-bit; ignored by 8bpp modes)
  flipX: boolean; // H-flip (bit 14)
  flipY: boolean; // V-flip (bit 15)
  priority: boolean; // bit 13
}

export const MAP_ENTRIES = 1024; // 1024 × 16-bit entries
export const MAP_BYTES = MAP_ENTRIES * 2; // 2048 bytes

const BIT_NAME = 0x03ff;
const BIT_PALETTE = 0x1c00;
const BIT_PRIORITY = 0x2000;
const BIT_HFLIP = 0x4000;
const BIT_VFLIP = 0x8000;

/** Encode one tilemap entry to its 16-bit value. */
export function encodeEntry(e: TilemapEntry): number {
  const word =
    (e.tile & 0x03ff) |
    ((e.palette & 0x7) << 10) |
    (e.priority ? BIT_PRIORITY : 0) |
    (e.flipX ? BIT_HFLIP : 0) |
    (e.flipY ? BIT_VFLIP : 0);
  if (e.tile < 0 || e.tile > 0x3ff) throw new Error(`encodeEntry: tile name ${e.tile} out of range 0..1023`);
  return word & 0xffff;
}

/** Decode one 16-bit tilemap value to an entry (inverse of `encodeEntry`). */
export function decodeEntry(word: number): TilemapEntry {
  return {
    tile: word & BIT_NAME,
    palette: (word & BIT_PALETTE) >> 10,
    priority: (word & BIT_PRIORITY) !== 0,
    flipX: (word & BIT_HFLIP) !== 0,
    flipY: (word & BIT_VFLIP) !== 0,
  };
}

/**
 * Encode `entries` to little-endian 16-bit bytes (2 per entry). Pass 1024
 * entries for a full SC0 map (2048 bytes); shorter arrays yield shorter output.
 */
export function encodeTilemap(entries: readonly TilemapEntry[]): Uint8Array {
  const out = new Uint8Array(entries.length * 2);
  for (let i = 0; i < entries.length; i++) {
    const w = encodeEntry(entries[i]);
    out[i * 2] = w & 0xff;
    out[i * 2 + 1] = (w >> 8) & 0xff;
  }
  return out;
}

/**
 * Write a tilemap into a VRAM buffer at byte offset `mapBase` (the SC0 map
 * base). `entries` may be up to 1024; the rest of a full map is left untouched.
 */
export function encodeTilemapAt(vram: Uint8Array, entries: readonly TilemapEntry[], mapBase: number): void {
  const end = mapBase + entries.length * 2;
  if (end > vram.length) {
    throw new Error(`encodeTilemapAt: map at base ${mapBase} with ${entries.length} entries exceeds VRAM`);
  }
  const bytes = encodeTilemap(entries);
  vram.set(bytes, mapBase);
}
