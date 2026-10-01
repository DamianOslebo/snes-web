/**
 * `frame` — a PURE, node-testable summarizer for a rendered SNES frame.
 *
 * This is the data half of the agent's "eyes" (`emu_probe`): it turns a raw
 * 256×224 RGBA `VideoFrame` (229 KB) into a small, human- and model-readable
 * summary — the effective background color, how much of the screen differs
 * from it, where that content sits, the top few colors, and a coarse ASCII
 * picture. The judgment (what this means, what to fix) lives in `tools.ts`;
 * this file only measures. No DOM, no core, no I/O — so node tests drive it
 * directly with synthetic frames.
 */

import type { VideoFrame } from '../core/types';

/** A compact, serializable description of what a rendered frame actually shows. */
export interface FrameSummary {
  width: number;
  height: number;
  /** The most common RGBA color — the screen's effective background. */
  background: [number, number, number, number];
  /** How many pixels share the background color. */
  backgroundCount: number;
  /** Fraction (0..1) of pixels that differ from `background`. */
  contentRatio: number;
  /** Bounding box (screen pixels) of the non-background pixels; null if none. */
  contentBbox: { x0: number; y0: number; x1: number; y1: number } | null;
  /** The most frequent colors, most first (capped), with their pixel counts. */
  topColors: { color: [number, number, number, number]; count: number }[];
  /** True when the frame is essentially a single color. */
  isSolid: boolean;
  /** True when it is a single NEAR-BLACK color — the "black screen" case. */
  isSolidBlack: boolean;
  /** A coarse luminance picture: `gridRows` strings, each `gridCols` chars (' '=dark → '@'=bright). */
  grid: string[];
  gridCols: number;
  gridRows: number;
}

/** Dark→bright ASCII ramp (index by luminance level 0..9). */
const RAMP = ' .:-=+*#%@';

/** contentRatio below this (≈ <29 px on a full frame) counts as "nothing drawn." */
const SOLID_EPS = 0.0005;
/** A background color at or under this per-channel value is "black" enough. */
const BLACK_MAX = 16;

function unpack(key: number): [number, number, number, number] {
  return [(key >>> 24) & 0xff, (key >>> 16) & 0xff, (key >>> 8) & 0xff, key & 0xff];
}

function pack(r: number, g: number, b: number, a: number): number {
  return (r << 24) | (g << 16) | (b << 8) | a;
}

function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b; // 0..255
}

/**
 * Summarize a rendered frame. `gridCols`/`gridRows` set the coarse picture
 * resolution (defaults = 8×8-pixel blocks → a 32×28 grid for a 256×224 frame).
 */
export function summarizeFrame(frame: VideoFrame, gridCols = 32, gridRows = 28): FrameSummary {
  const w = frame.width;
  const h = frame.height;
  const data = frame.data;
  const n = Math.min(w * h, Math.floor(data.length / 4));

  // Degenerate frame (no pixels): report a solid-black, empty screen.
  if (n === 0) {
    return {
      width: w,
      height: h,
      background: [0, 0, 0, 0],
      backgroundCount: 0,
      contentRatio: 0,
      contentBbox: null,
      topColors: [],
      isSolid: true,
      isSolidBlack: true,
      grid: [],
      gridCols,
      gridRows,
    };
  }

  // Pass 1: exact color histogram + the dominant (background) color.
  const counts = new Map<number, number>();
  let bgKey = 0;
  let bgCount = -1;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const key = pack(data[o], data[o + 1], data[o + 2], data[o + 3]);
    const c = (counts.get(key) ?? 0) + 1;
    counts.set(key, c);
    if (c > bgCount) {
      bgCount = c;
      bgKey = key;
    }
  }

  // Top colors, most first.
  const topColors = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([key, count]) => ({ color: unpack(key), count }));

  // Pass 2: bounding box of the non-background pixels + per-block luminance.
  let minx = Infinity;
  let miny = Infinity;
  let maxx = -1;
  let maxy = -1;
  const blockLum = new Array<number>(gridCols * gridRows).fill(0);
  const blockN = new Array<number>(gridCols * gridRows).fill(0);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const x = i % w;
    const y = (i / w) | 0;
    const key = pack(data[o], data[o + 1], data[o + 2], data[o + 3]);
    if (key !== bgKey) {
      if (x < minx) minx = x;
      if (x > maxx) maxx = x;
      if (y < miny) miny = y;
      if (y > maxy) maxy = y;
    }
    const bx = Math.min(gridCols - 1, (x * gridCols) / w | 0);
    const by = Math.min(gridRows - 1, (y * gridRows) / h | 0);
    const bi = by * gridCols + bx;
    blockLum[bi] += luminance(data[o], data[o + 1], data[o + 2]);
    blockN[bi] += 1;
  }

  const contentRatio = (n - bgCount) / n;
  const isSolid = contentRatio < SOLID_EPS;
  const [br, bg, bb] = unpack(bgKey);
  const isSolidBlack = isSolid && br <= BLACK_MAX && bg <= BLACK_MAX && bb <= BLACK_MAX;

  const grid: string[] = new Array<string>(gridRows);
  for (let by = 0; by < gridRows; by++) {
    let row = '';
    for (let bx = 0; bx < gridCols; bx++) {
      const bi = by * gridCols + bx;
      const avg = blockN[bi] > 0 ? blockLum[bi] / blockN[bi] : 0; // 0..255
      const level = Math.min(RAMP.length - 1, (avg / 255 * RAMP.length) | 0);
      row += RAMP[level];
    }
    grid[by] = row;
  }

  return {
    width: w,
    height: h,
    background: unpack(bgKey),
    backgroundCount: bgCount,
    contentRatio,
    contentBbox: maxx >= 0 ? { x0: minx, y0: miny, x1: maxx, y1: maxy } : null,
    topColors,
    isSolid,
    isSolidBlack,
    grid,
    gridCols,
    gridRows,
  };
}
