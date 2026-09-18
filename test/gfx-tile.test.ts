import { describe, expect, it } from 'vitest';
import {
  MODES,
  depthForMode,
  sizeForMode,
  colorsForMode,
  charBytesForMode,
  tileCharStride,
  SUBTILE_OFFSETS,
  encode8x8,
  decode8x8,
  encodeTile,
  encodeTileAt,
} from '../src/gfx/tile-encode';
import { decodeTile } from '../src/gfx/decode';

/** Build an `n×n` grid from a per-pixel function. */
const grid = (n: number, fn: (r: number, c: number) => number): number[][] => {
  const out: number[][] = [];
  for (let r = 0; r < n; r++) {
    const row: number[] = [];
    for (let c = 0; c < n; c++) row.push(fn(r, c));
    out.push(row);
  }
  return out;
};

/** 8×8 grid with `row0` in the top row and zeros elsewhere. */
const topRow = (row0: number[]): number[][] => {
  const g = grid(8, () => 0);
  g[0] = [...row0];
  return g;
};

describe('mode table', () => {
  it('matches the SNES background modes 0-7', () => {
    expect(MODES.length).toBe(8);
    expect(depthForMode(0)).toBe(2);
    expect(sizeForMode(0)).toBe(8);
    expect(depthForMode(1)).toBe(2);
    expect(sizeForMode(1)).toBe(16);
    expect(depthForMode(2)).toBe(4);
    expect(sizeForMode(2)).toBe(8);
    expect(depthForMode(3)).toBe(4);
    expect(sizeForMode(3)).toBe(16);
    expect(depthForMode(4)).toBe(8);
    expect(sizeForMode(4)).toBe(8);
    expect(depthForMode(5)).toBe(8);
    expect(sizeForMode(5)).toBe(16);
    expect(colorsForMode(0)).toBe(4);
    expect(colorsForMode(2)).toBe(16);
    expect(colorsForMode(4)).toBe(256);
  });

  it('char bytes per 8x8 sub-tile = depth * 8', () => {
    expect(charBytesForMode(0)).toBe(16);
    expect(charBytesForMode(2)).toBe(32);
    expect(charBytesForMode(4)).toBe(64);
  });

  it('16x16 tiles stride 2 char slots, 8x8 tiles stride 1', () => {
    expect(tileCharStride(0)).toBe(1);
    expect(tileCharStride(1)).toBe(2);
    expect(tileCharStride(5)).toBe(2);
  });

  it('16x16 sub-tile offsets are [UL, UR, LL, LR] = [0, 1, 16, 17]', () => {
    expect([...SUBTILE_OFFSETS]).toEqual([0, 1, 16, 17]);
  });
});

describe('encode8x8 — oracle-confirmed byte layout', () => {
  it('2bpp: planar, MSB-first (verified against the core ConvertTile2 oracle)', () => {
    // plane 0 (byte 0) carries the low index bit; plane 1 (byte 1) the high bit.
    // Within a byte, bit 7 = col 0 (leftmost), bit 0 = col 7.
    expect(Array.from(encode8x8(topRow([1, 0, 0, 0, 0, 0, 0, 0]), 2).subarray(0, 2))).toEqual([0x80, 0x00]);
    expect(encode8x8(topRow([0, 0, 0, 0, 0, 0, 0, 1]), 2)[0]).toBe(0x01);
    expect(encode8x8(topRow([2, 0, 0, 0, 0, 0, 0, 0]), 2)[1]).toBe(0x80);
    expect(Array.from(encode8x8(topRow([1, 1, 1, 1, 2, 2, 2, 2]), 2).subarray(0, 2))).toEqual([0xf0, 0x0f]);
    expect(Array.from(encode8x8(topRow([3, 3, 3, 3, 3, 3, 3, 3]), 2).subarray(0, 2))).toEqual([0xff, 0xff]);
  });

  it('4bpp: plane bits at byte (p>>1)*16 + 2*r + (p&1)', () => {
    const e = encode8x8(topRow([1, 0, 0, 0, 0, 0, 0, 0]), 4);
    expect(e.length).toBe(32);
    expect(e[0]).toBe(0x80); // index 1 = plane 0, row 0, col 0
    expect(encode8x8(topRow([4, 0, 0, 0, 0, 0, 0, 0]), 4)[16]).toBe(0x80); // plane 2
    expect(encode8x8(topRow([8, 0, 0, 0, 0, 0, 0, 0]), 4)[17]).toBe(0x80); // plane 3
  });

  it('8bpp: index bits at byte (p>>1)*16 + 2*r + (p&1)', () => {
    const e = encode8x8(topRow([1, 0, 0, 0, 0, 0, 0, 0]), 8);
    expect(e.length).toBe(64);
    expect(e[0]).toBe(0x80);
    expect(encode8x8(topRow([2, 0, 0, 0, 0, 0, 0, 0]), 8)[1]).toBe(0x80);
    expect(encode8x8(topRow([16, 0, 0, 0, 0, 0, 0, 0]), 8)[32]).toBe(0x80);
  });

  it('round-trips a full 8x8 grid at each depth', () => {
    const g = grid(8, (r, c) => (r * 3 + c) % 4);
    for (const depth of [2, 4, 8]) {
      const g2 = grid(8, (r, c) => (r * 3 + c) % (1 << depth));
      const enc = encode8x8(g2, depth);
      expect(Array.from(decode8x8(enc, 0, depth))).toEqual(g2);
    }
    expect(Array.from(decode8x8(encode8x8(g, 2), 0, 2))).toEqual(g);
  });

  it('rejects palette indices that do not fit the depth', () => {
    const bad = topRow([4, 0, 0, 0, 0, 0, 0, 0]);
    expect(() => encode8x8(bad, 2)).toThrow(/out of range/);
    expect(() => encode8x8(grid(8, () => 16), 4)).toThrow(/out of range/);
  });
});

describe('encodeTile — 16x16 tiles', () => {
  it('emits 4 sub-tiles [UL, UR, LL, LR], each depth*8 bytes', () => {
    const pixels = grid(16, (r, c) => (r + c) % 4);
    const blob = encodeTile(pixels, 1); // mode 1: 16x16, 2bpp
    expect(blob.length).toBe(4 * 16);
    const ul = grid(8, (r, c) => (r + c) % 4);
    expect(Array.from(blob.subarray(0, 16))).toEqual(Array.from(encode8x8(ul, 2)));
  });

  it('round-trips through a VRAM buffer via the sub-tile slots', () => {
    const pixels = grid(16, (r, c) => ((r >> 2) ^ c) % 4);
    const vram = new Uint8Array(0x10000);
    encodeTileAt(vram, pixels, 1, 0); // UL at char slot 0
    expect(decodeTile(vram, 1, 0)).toEqual(pixels);
  });

  it('mode 3 (16x16, 4bpp) blob is 128 bytes and round-trips', () => {
    const pixels = grid(16, (r, c) => (r * 5 + c) % 16);
    const blob = encodeTile(pixels, 3);
    expect(blob.length).toBe(4 * 32);
    const vram = new Uint8Array(0x10000);
    encodeTileAt(vram, pixels, 3, 0);
    expect(decodeTile(vram, 3, 0)).toEqual(pixels);
  });

  it('places consecutive 16x16 tiles 2 char slots apart', () => {
    const a = grid(16, (r, c) => (r + c) % 4);
    const b = grid(16, (r, c) => (r * c) % 4);
    const vram = new Uint8Array(0x10000);
    encodeTileAt(vram, a, 1, 0); // tile 0: slots {0,1,16,17}
    encodeTileAt(vram, b, 1, 2); // tile 1: slots {2,3,18,19}
    expect(decodeTile(vram, 1, 0)).toEqual(a);
    expect(decodeTile(vram, 1, 2)).toEqual(b);
    // tile 0's UR (slot 1) and LL (slot 16) still hold tile 0's data, not tile 1's
    const ur = grid(8, (r, c) => (r + (c + 8)) % 4);
    expect(Array.from(decode8x8(vram, 1 * 16, 2))).toEqual(ur);
  });

  it('16x16 modes reject 8x8 grids and vice versa', () => {
    expect(() => encodeTile(grid(8, () => 0), 1)).toThrow(/16×16/);
    expect(() => encodeTile(grid(16, () => 0), 0)).toThrow(/8×8/);
  });
});
