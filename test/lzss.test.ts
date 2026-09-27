/**
 * `lzss` — round-trip correctness of the compressor + reference decoder
 * (the BRR house pattern: `encodeX` + `decodeX` proven by a round-trip test,
 * then `test/lzss-core.test.ts` proves the *65C816* decoder agrees on snes9x).
 *
 * Core-free: only `lzssCompress` + `lzssDecompress` from `src/asm/lzss.ts`.
 * The gold property is `lzssDecompress(lzssCompress(x)) === x` on
 * compressible data, real asset blobs (`buildSpc`, `buildVramCompact`), and
 * the adversarial incompressible/random case (where the compressor is allowed
 * to emit literals — the output must still round-trip and stay a valid stream).
 */
import { describe, expect, it } from 'vitest';

import {
  LZSS_MAGIC,
  lzssCompress,
  lzssDecompress,
} from '../src/asm/lzss';
import { buildSpc } from '../src/spc/layout';
import { buildVramCompact } from '../src/gfx/vram';
import type { Rgb15 } from '../src/gfx/palette';
import type { TilemapEntry } from '../src/gfx/tilemap';

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** Round-trip `x` and assert byte-identity. */
function roundTrips(x: Uint8Array) {
  const enc = lzssCompress(x);
  expect(bytesEqual(lzssDecompress(enc), x)).toBe(true);
}

// --- a small but real asset blob -------------------------------------------

function sampleVramBlob(): Uint8Array {
  const size = 8;
  const solid = (idx: number): number[][] =>
    Array.from({ length: size }, () => Array.from({ length: size }, () => idx));
  const tiles = [solid(1), solid(2), solid(0), solid(3)];
  const palette: Rgb15[] = Array.from({ length: 16 }, (_, i) => ({
    r: (i * 7) & 31,
    g: (i * 11) & 31,
    b: (i * 13) & 31,
    transparent: i === 0,
  }));
  const map: TilemapEntry[] = [];
  for (let row = 0; row < 32; row++)
    for (let col = 0; col < 32; col++)
      map.push({ tile: (row + col) & 3, palette: 0, flipX: false, flipY: false, priority: false });
  return buildVramCompact({
    mode: 0, tiles, palettes: [palette], tilemap: map,
    tileBase: 0, paletteBase: 0, mapBase: 0x8000,
  }).blob;
}

describe('lzssCompress / lzssDecompress — round-trip', () => {
  it('is a no-op byte-identity on an empty input', () => {
    const enc = lzssCompress(new Uint8Array(0));
    expect(Array.from(enc)).toEqual([LZSS_MAGIC[0], LZSS_MAGIC[1], LZSS_MAGIC[2], LZSS_MAGIC[3], 0, 0]);
    expect(Array.from(lzssDecompress(enc))).toEqual([]);
  });

  it('round-trips a single byte', () => roundTrips(new Uint8Array([0x42])));

  it('round-trips an all-same-byte run (maximally compressible)', () => {
    const x = new Uint8Array(4096).fill(0xab);
    roundTrips(x);
    // A long run of one byte must compress hard — this is the whole point.
    expect(lzssCompress(x).length).toBeLessThan(x.length / 8);
  });

  it('round-trips a highly repetitive ramp', () => {
    const pattern = [0x00, 0x01, 0x02, 0x03, 0x00, 0x01, 0x02, 0x03];
    const out = new Uint8Array(8 * 512);
    for (let i = 0; i < out.length; i++) out[i] = pattern[i % pattern.length];
    roundTrips(out);
    expect(lzssCompress(out).length).toBeLessThan(out.length / 2);
  });

  it('round-trips the real buildSpc() blob (music asset)', () => roundTrips(buildSpc()));

  it('round-trips the real buildVramCompact() blob (graphics asset)', () => roundTrips(sampleVramBlob()));

  it('round-trips incompressible (random) data — allowed to not shrink, must stay valid', () => {
    // Deterministic PRNG (xorshift32) so the test is reproducible.
    let s = 0x2f6e2b1;
    const rnd = () => {
      s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
      return s & 0xff;
    };
    const n = 2048;
    const x = new Uint8Array(n);
    for (let i = 0; i < n; i++) x[i] = rnd();
    roundTrips(x);
    // The compressed stream is a valid stream (header + tokens) that the
    // decoder fully consumes. It may be LARGER than raw — that's the fallback
    // case the export tools guard against (they compare against the raw size).
    expect(lzssCompress(x).length).toBeGreaterThan(6);
  });
});

describe('lzss stream header', () => {
  it('starts with the 4-byte "LZSS" magic + a 16-bit LE uncompressed length', () => {
    const x = new Uint8Array([1, 2, 3, 4, 5]);
    const enc = lzssCompress(x);
    expect(Array.from(enc.slice(0, 4))).toEqual([0x4c, 0x5a, 0x53, 0x31]); // "LZSS"
    expect(enc[4]).toBe(5 & 0xff);   // length lo
    expect(enc[5]).toBe((5 >> 8) & 0xff); // length hi
  });

  it('records length 0xFFFF for a 65535-byte input', () => {
    const x = new Uint8Array(65535).fill(0);
    const enc = lzssCompress(x);
    expect(enc[4]).toBe(0xff);
    expect(enc[5]).toBe(0xff);
    expect(bytesEqual(lzssDecompress(enc), x)).toBe(true);
  });
});

describe('lzssDecompress — rejects malformed streams', () => {
  it('throws on a stream shorter than the header', () => {
    expect(() => lzssDecompress(new Uint8Array([0x4c, 0x5a, 0x53]))).toThrow(/too short/);
  });

  it('throws on a bad magic', () => {
    const bad = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0, 0]);
    expect(() => lzssDecompress(bad)).toThrow(/magic/);
  });

  it('throws when a copy over-reads the token stream', () => {
    // Header claims 10 bytes out, but the token stream runs dry mid-copy.
    const bad = new Uint8Array([0x4c, 0x5a, 0x53, 0x31, 10, 0]); // no tokens
    expect(() => lzssDecompress(bad)).toThrow(/end of stream/);
  });
});
