import { describe, expect, it } from 'vitest';
import {
  COLORS_PER_PALETTE,
  PALETTE_SIZE,
  CGRAM_BASE,
  cgramOffset,
  rgb15,
  rgb5to8,
  encodeColor,
  decode15,
  encodePalette,
  type Rgb15,
} from '../src/gfx/palette';

describe('CGRAM 5-5-5 color words', () => {
  it('encodes pure primaries to their SNES byte pairs', () => {
    // word = R[4:0] | G[4:0] << 5 | B[4:0] << 10 | T << 15, stored little-endian.
    expect(encodeColor(rgb15(31, 0, 0))).toEqual({ low: 0x1f, high: 0x00 }); // red
    expect(encodeColor(rgb15(0, 31, 0))).toEqual({ low: 0xe0, high: 0x03 }); // green
    expect(encodeColor(rgb15(0, 0, 31))).toEqual({ low: 0x00, high: 0x7c }); // blue
    expect(encodeColor(rgb15(31, 31, 31))).toEqual({ low: 0xff, high: 0x7f }); // white
  });

  it('sets the T bit (word bit 15, high-byte top bit) for transparent', () => {
    const t: Rgb15 = { r: 0, g: 0, b: 0, transparent: true };
    expect(encodeColor(t)).toEqual({ low: 0x00, high: 0x80 });
  });

  it('round-trips every 5-5-5 value through decode15', () => {
    const cases: Rgb15[] = [
      rgb15(31, 0, 0),
      rgb15(0, 31, 0),
      rgb15(0, 0, 31),
      rgb15(31, 31, 31),
      rgb15(16, 16, 16),
      rgb15(1, 2, 3),
      { r: 0, g: 0, b: 0, transparent: true },
    ];
    for (const c of cases) {
      const { low, high } = encodeColor(c);
      const back = decode15(low, high);
      expect(back, JSON.stringify(c)).toEqual(c);
    }
  });

  it('decodes the canonical SNES color words', () => {
    expect(decode15(0x1f, 0x00)).toEqual({ r: 31, g: 0, b: 0, transparent: false });
    expect(decode15(0xe0, 0x03)).toEqual({ r: 0, g: 31, b: 0, transparent: false });
    expect(decode15(0x00, 0x7c)).toEqual({ r: 0, g: 0, b: 31, transparent: false });
    expect(decode15(0x00, 0x80)).toEqual({ r: 0, g: 0, b: 0, transparent: true });
  });

  it('rgb5to8 matches the shim convertVideo expansion (x<<3 | x>>2)', () => {
    expect(rgb5to8(0)).toBe(0);
    expect(rgb5to8(1)).toBe(8);
    expect(rgb5to8(16)).toBe(132);
    expect(rgb5to8(31)).toBe(255);
  });
});

describe('encodePalette', () => {
  it('produces 32 bytes for a 16-color palette', () => {
    const pal = new Array(16).fill(null).map((_, i) => rgb15(i, 31 - i, 0));
    const bytes = encodePalette(pal);
    expect(PALETTE_SIZE).toBe(32);
    expect(COLORS_PER_PALETTE).toBe(16);
    expect(bytes.length).toBe(32);
    // color 0 = rgb15(0,31,0) -> 0xE0 0x03 (green)
    expect(bytes[0]).toBe(0xe0);
    expect(bytes[1]).toBe(0x03);
    // color 1 = rgb15(1,30,0) -> low = 1 | ((30&7)<<5) = 1 | 0xC0 = 0xC1, high = (30>>3)&3 = 3
    expect(bytes[2]).toBe(0xc1);
    expect(bytes[3]).toBe(0x03);
  });

  it('rejects a palette of the wrong size', () => {
    expect(() => encodePalette([rgb15(1, 2, 3)])).toThrow(/16 colors/);
  });

  it('cgramOffset is $C000 + index*32', () => {
    expect(CGRAM_BASE).toBe(0xc000);
    expect(cgramOffset(0)).toBe(0xc000);
    expect(cgramOffset(1)).toBe(0xc000 + 32);
    expect(cgramOffset(255)).toBe(0xc000 + 255 * 32);
  });
});
