import { describe, expect, it } from 'vitest';
import { VRAM_SIZE, buildVram } from '../src/gfx/vram';
import { encodeTile, encode8x8 } from '../src/gfx/tile-encode';
import { encodePalette, rgb15, type Rgb15 } from '../src/gfx/palette';
import { encodeEntry, type TilemapEntry } from '../src/gfx/tilemap';
import { decodeTile, decodePalette, decodeTilemap } from '../src/gfx/decode';

/** 8x8 pixel grid helpers. */
const checker = (): number[][] =>
  Array.from({ length: 8 }, (_, r) => Array.from({ length: 8 }, (_, c) => (r + c) % 2));
const bars = (): number[][] =>
  Array.from({ length: 8 }, () => [0, 1, 2, 3, 0, 1, 2, 3]);

/** A 16-color palette with a recognizable ramp + one transparent slot. */
const palette = (): Rgb15[] => {
  const out: Rgb15[] = [{ r: 0, g: 0, b: 0, transparent: true }];
  for (let i = 1; i < 16; i++) out.push(rgb15(i * 2, (15 - i) * 2, 0));
  return out;
};

/** A 1024-entry map, each cell a deterministic function of its index. */
const map = (): TilemapEntry[] =>
  new Array(1024).fill(0).map((_, i) => ({
    tile: i % 3,
    palette: i % 2,
    priority: false,
    flipX: i % 4 === 0,
    flipY: i % 8 === 0,
  }));

describe('buildVram — 8x8 mode (mode 0)', () => {
  const tiles = [checker(), bars()];
  const pal = palette();
  const m = map();
  const vram = buildVram({ mode: 0, tiles, palettes: [pal], tilemap: m, tileBase: 0, paletteBase: 0, mapBase: 0x8000 });

  it('is exactly 64 KB', () => {
    expect(VRAM_SIZE).toBe(0x10000);
    expect(vram.length).toBe(0x10000);
  });

  it('places tile i at char slot tileBase + i (16 B per 2bpp tile)', () => {
    expect(Array.from(vram.subarray(0, 16))).toEqual(Array.from(encodeTile(tiles[0], 0)));
    expect(Array.from(vram.subarray(16, 32))).toEqual(Array.from(encodeTile(tiles[1], 0)));
    // and the encoding matches the oracle-confirmed planar layout directly
    expect(Array.from(vram.subarray(0, 16))).toEqual(Array.from(encode8x8(tiles[0], 2)));
    // unused slots stay zero
    expect(Array.from(vram.subarray(32, 48))).toEqual(new Array(16).fill(0));
  });

  it('places palette i at $C000 + i*32', () => {
    expect(Array.from(vram.subarray(0xc000, 0xc020))).toEqual(Array.from(encodePalette(pal)));
    expect(Array.from(vram.subarray(0xc020, 0xc040))).toEqual(new Array(32).fill(0));
  });

  it('places the tilemap at mapBase (little-endian 16-bit entries)', () => {
    const word = encodeEntry(m[0]);
    expect(vram[0x8000]).toBe(word & 0xff);
    expect(vram[0x8001]).toBe((word >> 8) & 0xff);
    const expected = new Uint8Array(2048);
    m.forEach((e, i) => {
      const w = encodeEntry(e);
      expected[i * 2] = w & 0xff;
      expected[i * 2 + 1] = (w >> 8) & 0xff;
    });
    expect(Array.from(vram.subarray(0x8000, 0x8000 + 2048))).toEqual(Array.from(expected));
  });

  it('round-trips: decoding the built image yields the inputs', () => {
    expect(decodeTile(vram, 0, 0)).toEqual(tiles[0]);
    expect(decodeTile(vram, 0, 1)).toEqual(tiles[1]);
    expect(decodePalette(vram, 0)).toEqual(pal);
    expect(Array.from(decodeTilemap(vram, 0x8000, 1024))).toEqual(m);
  });
});

describe('buildVram — 16x16 mode (mode 3, 4bpp)', () => {
  const pixel16 = Array.from({ length: 16 }, (_, r) => Array.from({ length: 16 }, (_, c) => (r * c + r) % 16));
  const vram = buildVram({ mode: 3, tiles: [pixel16], palettes: [], tilemap: undefined, tileBase: 0, paletteBase: 0, mapBase: 0 });

  it('lays out 4 sub-tiles [UL,UR,LL,LR] at char slots 0,1,16,17 (32 B each)', () => {
    // 4bpp: char = 32 B. Slots: UL=0, UR=1, LL=16, LR=17.
    const blob = encodeTile(pixel16, 3); // [UL(0..31), UR(32..63), LL(64..95), LR(96..127)]
    const ul = Array.from(pixel16.slice(0, 8).map((row) => row.slice(0, 8)));
    expect(Array.from(vram.subarray(0, 32))).toEqual(Array.from(encode8x8(ul, 4)));
    expect(Array.from(vram.subarray(32, 64))).toEqual(Array.from(blob.subarray(32, 64)));
    expect(Array.from(vram.subarray(512, 544))).toEqual(Array.from(blob.subarray(64, 96)));
    expect(Array.from(vram.subarray(544, 576))).toEqual(Array.from(blob.subarray(96, 128)));
    expect(vram.length).toBe(VRAM_SIZE);
  });

  it('round-trips through decodeTile', () => {
    expect(decodeTile(vram, 3, 0)).toEqual(pixel16);
  });
});

describe('buildVram — custom bases and errors', () => {
  it('honors non-zero tileBase, paletteBase, and mapBase', () => {
    const tiles = [checker()];
    const pal = palette();
    const m = map();
    const vram = buildVram({ mode: 0, tiles, palettes: [pal], tilemap: m, tileBase: 100, paletteBase: 2, mapBase: 0x7000 });
    expect(Array.from(vram.subarray(100 * 16, 101 * 16))).toEqual(Array.from(encodeTile(tiles[0], 0)));
    // slot 0 (tile 0's would-be default position) is untouched
    expect(Array.from(vram.subarray(0, 16))).toEqual(new Array(16).fill(0));
    expect(Array.from(vram.subarray(0xc000 + 64, 0xc000 + 96))).toEqual(Array.from(encodePalette(pal)));
    expect(Array.from(vram.subarray(0xc000, 0xc020))).toEqual(new Array(32).fill(0));
    expect(decodeTile(vram, 0, 0, 100)).toEqual(tiles[0]);
    expect(decodePalette(vram, 2)).toEqual(pal);
    expect(Array.from(decodeTilemap(vram, 0x7000, 1024))).toEqual(m);
  });

  it('leaves the tilemap region zero when no tilemap is given', () => {
    const vram = buildVram({ mode: 0, tiles: [checker()], palettes: [palette()] });
    // tile 0 occupies bytes 0-15; the rest of the map-sized region stays zero
    expect(Array.from(vram.subarray(16, 2048))).toEqual(new Array(2032).fill(0));
  });

  it('rejects palettes past the end of VRAM', () => {
    // palette 512 lands at $C000 + 512*32 = $10000 — the first palette that
    // would run past the 64 KB image.
    expect(() => buildVram({ mode: 0, tiles: [], palettes: [palette()], paletteBase: 512 })).toThrow(/exceeds VRAM/);
  });

  it('rejects tiles past the end of VRAM', () => {
    // 8x8 2bpp tiles are 16 B; char slot 0x1000 would write past the 64 KB image
    const big = Array.from({ length: 0x1000 + 1 }, () => checker());
    expect(() => buildVram({ mode: 0, tiles: big, palettes: [] })).toThrow(/exceeds VRAM/);
  });
});
