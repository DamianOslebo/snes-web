import { describe, expect, it } from 'vitest';
import {
  MAP_ENTRIES,
  MAP_BYTES,
  encodeEntry,
  decodeEntry,
  encodeTilemap,
  encodeTilemapAt,
  type TilemapEntry,
} from '../src/gfx/tilemap';
import { decodeTilemap } from '../src/gfx/decode';

describe('tilemap entry bits', () => {
  it('packs {tile, palette, priority, flipX, flipY} into the SNES 16-bit layout', () => {
    // bits: 9-0 tile | 12-10 palette | 13 priority | 14 H-flip | 15 V-flip
    const e: TilemapEntry = { tile: 0x123, palette: 5, priority: true, flipX: true, flipY: false };
    const word = encodeEntry(e);
    expect(word & 0x03ff).toBe(0x123);
    expect((word & 0x1c00) >> 10).toBe(5);
    expect(word & 0x2000).toBe(0x2000);
    expect(word & 0x4000).toBe(0x4000);
    expect(word & 0x8000).toBe(0);
    expect(word).toBe(0x123 | 0x1400 | 0x2000 | 0x4000);
  });

  it('round-trips through decodeEntry', () => {
    const e: TilemapEntry = { tile: 1023, palette: 7, priority: true, flipX: true, flipY: true };
    expect(decodeEntry(encodeEntry(e))).toEqual(e);
    const clear: TilemapEntry = { tile: 0, palette: 0, priority: false, flipX: false, flipY: false };
    expect(decodeEntry(encodeEntry(clear))).toEqual(clear);
  });

  it('rejects tile names outside 0..1023', () => {
    expect(() =>
      encodeEntry({ tile: 1024, palette: 0, priority: false, flipX: false, flipY: false }),
    ).toThrow(/out of range/);
    expect(() =>
      encodeEntry({ tile: -1, palette: 0, priority: false, flipX: false, flipY: false }),
    ).toThrow(/out of range/);
  });
});

describe('encodeTilemap — byte layout', () => {
  it('emits little-endian 16-bit entries, 2 bytes each', () => {
    const entries: TilemapEntry[] = [
      { tile: 0x234, palette: 5, priority: true, flipX: true, flipY: false }, // 0x7634
      { tile: 7, palette: 0, priority: false, flipX: false, flipY: true }, // 0x8007
    ];
    const bytes = encodeTilemap(entries);
    expect(bytes.length).toBe(4);
    expect(Array.from(bytes)).toEqual([0x34, 0x76, 0x07, 0x80]);
  });

  it('a full SC0 map is 1024 entries = 2048 bytes', () => {
    expect(MAP_ENTRIES).toBe(1024);
    expect(MAP_BYTES).toBe(2048);
    const entries = new Array(1024)
      .fill(0)
      .map((_, i) => ({ tile: i & 0x3ff, palette: i & 7, priority: false, flipX: false, flipY: false }));
    expect(encodeTilemap(entries).length).toBe(2048);
  });
});

describe('tilemap in a VRAM buffer', () => {
  it('encodeTilemapAt + decodeTilemap round-trips at a custom base', () => {
    const vram = new Uint8Array(0x10000);
    const map = new Array(1024).fill(0).map((_, i) => ({
      tile: (i * 7) & 0x3ff,
      palette: (i >> 3) & 7,
      priority: i % 2 === 0,
      flipX: i % 3 === 0,
      flipY: i % 5 === 0,
    }));
    const base = 0x8000; // e.g. SCBase = $4000
    encodeTilemapAt(vram, map, base);
    expect(vram[base]).toBe(map[0].tile & 0xff); // little-endian low byte first
    expect(Array.from(decodeTilemap(vram, base, 1024))).toEqual(map);
    // bytes outside the map are untouched
    expect(vram[base + 2048]).toBe(0);
  });

  it('refuses a map that would run past the end of VRAM', () => {
    const vram = new Uint8Array(0x10000);
    const map = Array.from({ length: 1024 }, () => ({
      tile: 0, palette: 0, priority: false, flipX: false, flipY: false,
    }));
    expect(() => encodeTilemapAt(vram, map, 0x10000 - 100)).toThrow(/exceeds VRAM/);
  });
});
