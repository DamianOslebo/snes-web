import { describe, expect, it } from 'vitest';
import { summarizeFrame } from '../src/agent/frame';
import type { VideoFrame } from '../src/core/types';

const W = 256;
const H = 224;
const N = W * H; // 57344 px

/** A 256×224 RGBA frame filled with a single color (alpha 0, like a real PPU frame). */
function solidFrame(r: number, g: number, b: number): VideoFrame {
  const data = new Uint8Array(N * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = 0;
  }
  return { width: W, height: H, data };
}

/** A `w×h` colored block at (x0,y0) on an all-black 256×224 frame. */
function blockFrame(x0: number, y0: number, w: number, h: number, r: number, g: number, b: number): VideoFrame {
  const data = new Uint8Array(N * 4); // zeros = black
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const o = (y * W + x) * 4;
      data[o] = r;
      data[o + 1] = g;
      data[o + 2] = b;
      data[o + 3] = 0;
    }
  }
  return { width: W, height: H, data };
}

describe('summarizeFrame', () => {
  it('an empty frame is a solid-black, empty screen', () => {
    const s = summarizeFrame({ width: W, height: H, data: new Uint8Array(0) });
    expect(s.isSolid).toBe(true);
    expect(s.isSolidBlack).toBe(true);
    expect(s.contentRatio).toBe(0);
    expect(s.contentBbox).toBeNull();
    expect(s.topColors).toEqual([]);
    expect(s.grid).toEqual([]);
  });

  it('a fully-black frame is solid black (the black-screen case)', () => {
    const s = summarizeFrame(solidFrame(0, 0, 0));
    expect(s.isSolid).toBe(true);
    expect(s.isSolidBlack).toBe(true);
    expect(s.contentRatio).toBe(0);
    expect(s.contentBbox).toBeNull();
    expect(s.background).toEqual([0, 0, 0, 0]);
    // The coarse grid is present at the default 32×28 resolution.
    expect(s.grid.length).toBe(28);
    expect(s.grid.every((row) => row.length === 32)).toBe(true);
    expect(s.grid[0]).toBe(' '.repeat(32)); // all dark
  });

  it('a fully-red frame is solid but NOT solid-black', () => {
    const s = summarizeFrame(solidFrame(255, 0, 0));
    expect(s.isSolid).toBe(true);
    expect(s.isSolidBlack).toBe(false);
    expect(s.contentRatio).toBe(0);
    expect(s.background).toEqual([255, 0, 0, 0]);
  });

  it('measures a colored block on black: ratio, bounding box, top colors', () => {
    const s = summarizeFrame(blockFrame(0, 0, 32, 32, 255, 0, 0));
    expect(s.isSolid).toBe(false);
    expect(s.isSolidBlack).toBe(false);
    expect(s.background).toEqual([0, 0, 0, 0]);
    expect(s.contentBbox).toEqual({ x0: 0, y0: 0, x1: 31, y1: 31 });
    expect(s.contentRatio).toBeCloseTo(1024 / N, 8);
    expect(s.topColors[0]).toEqual({ color: [0, 0, 0, 0], count: N - 1024 });
    expect(s.topColors[1]).toEqual({ color: [255, 0, 0, 0], count: 1024 });
  });

  it('tracks a block placed off the origin', () => {
    const s = summarizeFrame(blockFrame(100, 100, 16, 8, 0, 255, 0));
    expect(s.contentBbox).toEqual({ x0: 100, y0: 100, x1: 115, y1: 107 });
    expect(s.contentRatio).toBeCloseTo(128 / N, 8);
  });

  it('renders a coarse grid: dark = space, bright = @', () => {
    expect(summarizeFrame(solidFrame(0, 0, 0)).grid[0]).toBe(' '.repeat(32));
    expect(summarizeFrame(solidFrame(255, 255, 255)).grid[0]).toBe('@'.repeat(32));
  });

  it('places block content in the matching grid cell', () => {
    // A red 32×32 block at the top-left fills grid cell (0,0), which is
    // therefore non-blank; the far bottom-right cell has no content (space).
    // (Red is low-luminance — ramp level 2, ':' — so we assert non-blank,
    // not a specific bright glyph.)
    const s = summarizeFrame(blockFrame(0, 0, 32, 32, 255, 0, 0));
    expect(s.grid[0][0]).not.toBe(' ');
    expect(s.grid[27][31]).toBe(' ');
  });

  it('honors a custom grid resolution', () => {
    const s = summarizeFrame(solidFrame(0, 0, 0), 8, 4);
    expect(s.gridCols).toBe(8);
    expect(s.gridRows).toBe(4);
    expect(s.grid.length).toBe(4);
    expect(s.grid.every((row) => row.length === 8)).toBe(true);
  });
});
