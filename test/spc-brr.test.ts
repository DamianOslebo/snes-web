import { describe, expect, it } from 'vitest';
import {
  BRR_BLOCK_BYTES,
  BRR_FILTERS,
  BRR_FLOAT_SCALE,
  BRR_MAX_RANGE,
  BRR_SAMPLES_PER_BLOCK,
  brrHeaderByte,
  decodeBrr,
  encodeBrr,
} from '../src/spc/brr';

/** Build a raw block: header byte + 8 data bytes holding the given nibbles. */
function block(range: number, filter: number, flags: number, nibbles: number[]): Uint8Array {
  const b = new Uint8Array(BRR_BLOCK_BYTES);
  b[0] = brrHeaderByte(range, filter, (flags & 2) !== 0, (flags & 1) !== 0);
  nibbles.forEach((n, i) => {
    b[1 + (i >> 1)] |= (n & 0x0f) << ((i & 1) ? 0 : 4); // HIGH nibble first
  });
  return b;
}

describe('BRR header byte', () => {
  it('lays out range D7-D4, filter D3-D2, loop D1, end D0', () => {
    expect(brrHeaderByte(0, 0, false, false)).toBe(0x00);
    expect(brrHeaderByte(12, 0, false, true)).toBe(0xc1); // 1100_0001
    expect(brrHeaderByte(0, 1, false, false)).toBe(0x04); // filter 1 in D3-D2
    expect(brrHeaderByte(4, 2, true, true)).toBe(0x4b); // 0100_1011
    expect(brrHeaderByte(13, 3, true, false)).toBe(0xde); // invalid range + f3 + loop
    // round-trip: the decoder's own bit extraction reads back what we wrote
    for (const range of [0, 3, 12, 15])
      for (const filter of [0, 1, 2, 3]) {
        const h = brrHeaderByte(range, filter, true, true);
        expect(h >> 4).toBe(range); // range in D7-D4
        expect((h >> 2) & 3).toBe(filter); // filter in D3-D2
        expect(h & 3).toBe(3); // loop + end
      }
  });
});

describe('BRR filter table (manual table 3-2-1, effective coefficients)', () => {
  it('has the exact four (a, b) pairs', () => {
    expect(BRR_FILTERS).toEqual([
      { a: 0, b: 0 },
      { a: 15 / 16, b: 0 },
      { a: 61 / 32, b: -15 / 16 },
      { a: 115 / 64, b: -13 / 16 },
    ]);
  });
});

describe('decodeBrr — reference decoder (bit-exact to apu.c dsp_decode_brr)', () => {
  it('decodes nibbles at range 0 (filter 0), losing the odd-nibble LSB', () => {
    // s = (d<<0)>>1 then ×2: even nibbles exact, odd nibbles drop the LSB.
    const out = decodeBrr(block(0, 0, 0, [1, 2, 3, -1, -2, -3, 7, -8, 0, 4]));
    expect(Array.from(out.subarray(0, 10))).toEqual([0, 2, 2, -2, -2, -4, 6, -8, 0, 4]);
  });

  it('left-shifts by the range (16-bit reconstruction)', () => {
    const out = decodeBrr(block(4, 0, 0, [1, -1, 2, -2, 3, 7, -8, 0, 0, 0, 0, 0, 0, 0, 0, 0]));
    expect(Array.from(out.subarray(0, 8))).toEqual([16, -16, 32, -32, 48, 112, -128, 0]);
  });

  it('decodes the HIGH nibble of each data byte first', () => {
    // data bytes 0xA5 (nibbles -6, +5) and 0x57 (+5, +7) at range 4
    const out = decodeBrr(block(4, 0, 0, [-6, 5, 5, 7]));
    expect(Array.from(out.subarray(0, 4))).toEqual([-96, 80, 80, 112]);
  });

  it('filter 1 applies a·x[-1] (a = 15/16)', () => {
    const out = decodeBrr(block(0, 1, 0, new Array(16).fill(4)));
    // x = 4 + 15/16·x[-1]: 4, 6, 8, 10, … (+2 per sample, converging near 34)
    expect(Array.from(out)).toEqual([4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34]);
  });

  it('filter 2 applies a·x[-1] + b·x[-2] (61/32, -15/16)', () => {
    const out = decodeBrr(block(0, 2, 0, new Array(16).fill(4)));
    expect(Array.from(out)).toEqual([4, 10, 18, 28, 38, 48, 58, 68, 76, 84, 92, 98, 102, 106, 110, 112]);
  });

  it('filter 3 applies a·x[-1] + b·x[-2] (115/64, -13/16)', () => {
    const out = decodeBrr(block(0, 3, 0, new Array(16).fill(4)));
    expect(Array.from(out)).toEqual([4, 10, 16, 22, 28, 36, 44, 52, 60, 66, 72, 78, 84, 90, 94, 98]);
  });

  it('keeps filter state across blocks (per-voice, like the S-DSP)', () => {
    const a = block(0, 1, 0, new Array(16).fill(4));
    const z = new Uint8Array(BRR_BLOCK_BYTES * 2);
    z.set(a);
    z[BRR_BLOCK_BYTES] = 0x05; // second block: same samples, END bit set
    z.set(a.subarray(1), BRR_BLOCK_BYTES + 1);
    const out = decodeBrr(z);
    // first block ends at x = 34 (p1) — the second block continues from there
    expect(Array.from(out.subarray(16))).toEqual(new Array(16).fill(34));
  });

  it('treats ranges 13-15 as the core invalid-range sentinels', () => {
    const out = decodeBrr(block(13, 0, 0, [-8, 7, -1, 0]));
    // s = (s>>25)<<11: every negative nibble survives as -0x800 (positives vanish); ×2 doubles
    expect(Array.from(out.subarray(0, 4))).toEqual([-4096, 0, -4096, 0]);
    const out15 = decodeBrr(block(15, 0, 0, [-8, 7, 1, 2]));
    expect(Array.from(out15.subarray(0, 4))).toEqual([-4096, 0, 0, 0]);
  });

  it('reproduces the core (int16)(s*2) wrap on full-scale filter feedback', () => {
    // filter 2, range 12, all +7: raw 28672 wraps back past ±32767 with feedback
    const out = decodeBrr(block(12, 2, 0, new Array(16).fill(7)));
    // sample 2: s = 14336 + 28672 - 1344 = 41664 → CLAMP16 → 32767 → ×2 wraps to -2
    expect(Array.from(out)).toEqual([
      28672, -2, 1788, 32080, -2, -1408, 25988, -2, 4304, -28660, -29998, -1644, -11876, 7572,
      -11298, 34,
    ]);
  });

  it('raw decode reaches the asymmetric 16-bit extremes without wrapping', () => {
    const pos = decodeBrr(block(12, 0, 0, [7]));
    const neg = decodeBrr(block(12, 0, 0, [-8]));
    expect(pos[0]).toBe(28672); // +7 · 2^12: max positive raw value
    expect(neg[0]).toBe(-32768); // -8 · 2^12: min negative
  });

  it('decodes exactly 16 samples per block and no more', () => {
    const out = decodeBrr(block(0, 0, 0, new Array(16).fill(1)));
    expect(out).toHaveLength(BRR_SAMPLES_PER_BLOCK);
  });

  it('ignores a trailing partial block instead of reading past it', () => {
    const full = block(0, 0, 0, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0]);
    const tail = new Uint8Array(full.length + 3); // one full block + 3 stray bytes
    tail.set(full);
    expect(decodeBrr(tail)).toHaveLength(BRR_SAMPLES_PER_BLOCK);
    expect(decodeBrr(new Uint8Array(8))).toHaveLength(0); // fewer than one block
  });
});

describe('encodeBrr — PCM → BRR', () => {
  it('produces ceil(n/16)·9 bytes (one block minimum)', () => {
    expect(encodeBrr([])).toHaveLength(BRR_BLOCK_BYTES);
    expect(encodeBrr(new Array(16).fill(0))).toHaveLength(9);
    expect(encodeBrr(new Array(17).fill(0))).toHaveLength(18);
    expect(encodeBrr(new Array(32).fill(0))).toHaveLength(18);
    expect(encodeBrr(new Array(33).fill(0))).toHaveLength(27);
  });

  it('round-trips exactly at the range it chose (filter 0)', () => {
    // every sample is an integer multiple of 8 (range-3 terms), max 32 →
    // range 3, so the 4-bit quantization is exact and decode(encode(x)) = x
    const pcm = [0, 8, -8, 16, -16, 24, -24, 32, -32, 16, -16, 8, -8, 24, -24, 0];
    const enc = encodeBrr(pcm.map((v) => v / BRR_FLOAT_SCALE));
    expect(enc[0] >> 4).toBe(3); // 32 = 4·2³, so range 3 is the smallest that fits
    expect(Array.from(decodeBrr(enc))).toEqual(pcm);
  });

  it('picks the smallest range whose nibbles all fit in -8..+7', () => {
    const enc = (v: number): number => (encodeBrr(new Array(16).fill(v))[0] >> 4);
    expect(enc(7 / BRR_FLOAT_SCALE)).toBe(0); // 7 fits in a raw nibble
    expect(enc(16 / BRR_FLOAT_SCALE)).toBe(2); // 16/4 = 4 fits; 16/2 = 8 does not
    expect(enc(0.5)).toBe(12); // 16384 = 4·2¹²; 16384/2¹¹ = 8 does not fit
    expect(enc(1)).toBe(12); // 32767 clamps its nibble to +7 at range 12
    expect(enc(-1)).toBe(12); // -32768/4096 = -8, and -8 IS a valid nibble
    expect(enc(12345)).toBe(12); // clamped to 32767 before range search
  });

  it('clamps out-of-range input to the 16-bit range', () => {
    const enc = encodeBrr([2.5, -3, 1, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const out = Array.from(decodeBrr(enc));
    expect(out[0]).toBe(28672); // +32767 → nibble clamps to +7 at range 12
    expect(out[1]).toBe(-32768); // -32768 → -8 at range 12, exact
  });

  it('zero-pads the final partial block (decodes to zeros there)', () => {
    const out = Array.from(decodeBrr(encodeBrr([0.5, 0, 0, 0, 0, 0, 0, 0])));
    expect(out).toHaveLength(BRR_SAMPLES_PER_BLOCK);
    expect(out[0]).toBe(16384); // 0.5 → 16384 = 4·2¹² → exact at range 12
    for (let i = 1; i < BRR_SAMPLES_PER_BLOCK; i++) expect(out[i]).toBe(0);
  });

  it('sets the end bit on the last block and the loop bit only when asked', () => {
    const plain = encodeBrr(new Array(32).fill(1));
    expect(plain[0] & 0b11).toBe(0b00);
    expect(plain[9] & 0b11).toBe(0b01);
    const looping = encodeBrr(new Array(32).fill(1), { loop: true });
    expect(looping[0] & 0b11).toBe(0b00);
    expect(looping[9] & 0b11).toBe(0b11);
    const oneBlock = encodeBrr(new Array(4).fill(1), { loop: true });
    expect(oneBlock[0] & 0b11).toBe(0b11);
  });

  it('stores the chosen filter in every block header (nibbles unchanged)', () => {
    const pcm = [4, -4, 0, 8, -8, 2, -2, 6, -6, 1, -1, 3, -3, 5, -5, 7].map((v) => v / 2);
    const f0 = encodeBrr(pcm);
    const f2 = encodeBrr(pcm, { filter: 2 });
    expect(f2[0] & 0b001100).toBe(2 << 2); // filter 2 in D3-D2
    expect(f2[0] & 0b11).toBe(1); // end bit still set
    expect(Array.from(f2.subarray(1))).toEqual(Array.from(f0.subarray(1))); // data identical
  });

  it('never chooses a range above 12', () => {
    const enc = encodeBrr([BRR_FLOAT_SCALE * 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(enc[0] >> 4).toBeLessThanOrEqual(BRR_MAX_RANGE);
  });

  it('keeps a sine wave recognizable after a round-trip', () => {
    const n = 256;
    const pcm = Array.from({ length: n }, (_, i) => Math.sin((i / n) * Math.PI * 4) * 0.8);
    const out = Array.from(decodeBrr(encodeBrr(pcm)));
    expect(out).toHaveLength(n);
    let err = 0;
    for (let i = 0; i < n; i++) err += Math.abs(out[i] - pcm[i] * BRR_FLOAT_SCALE);
    expect(err / n / BRR_FLOAT_SCALE).toBeLessThan(0.05); // mean error < 5% of full scale
  });
});
