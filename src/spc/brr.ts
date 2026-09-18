/**
 * BRR (Bit Rate Reduction) — the S-DSP's sample format (manual book 1,
 * "BRR (Bit Rate Reduction)", ch. 3-2).
 *
 * Pure, node-testable: an encoder (linear PCM → BRR blocks) and a reference
 * decoder (BRR blocks → 16-bit samples) so the encoder can be verified in
 * tests without any hardware. Neither touches the Web Audio API.
 *
 * One block = 1 header byte + 8 data bytes (16 four-bit samples). Header:
 *   D7-D4  range (0-12; 13-15 are invalid-range sentinels)
 *          — the 4-bit sample is left-shifted by this much (then halved)
 *   D3-D2  filter number (0-3) — the IIR applied AFTER the shift; this is
 *          PER BLOCK, selected by the encoder/driver, not a global register
 *   D1     loop — sample loops from its start when this is the last block
 *   D0     end  — this is the sample's last block
 *
 * Nibbles are packed HIGH-nibble-first within each data byte and are signed
 * two's complement, -8..+7.
 *
 * Decoding — `decodeBrr` mirrors the vendored core's `dsp_decode_brr`
 * (core/snes9x-2010/core/apu.c) bit-exactly, so blocks this encoder emits
 * decode in the real emulator exactly as the tests see them:
 *
 *   s  = (d << range) >> 1                    // half-scale working value
 *   if (range >= 13) s = (s >> 25) << 11      // invalid-range sentinel
 *   filter 1: s += (p1 >> 1) + ((-p1) >> 5)
 *   filter 2: s += p1 - p2 + (p2 >> 4) + ((p1 * -3) >> 6)
 *   filter 3: s += p1 - p2 + ((p1 * -13) >> 7) + ((p2 * 3) >> 4)
 *   CLAMP16(s);  output = (int16)(s * 2)
 *
 * with p1/p2 the previous two FULL-SCALE output samples (p2 pre-halved by
 * `>> 1` — the S-DSP keeps a per-voice circular buffer of them). The extra
 * factor of 2 is absorbed by the final doubling, so the effective feedback
 * coefficients are the manual's Table 3-2-1 (see BRR_FILTERS). Note the
 * final `(int16)(s * 2)` WRAPS: full-scale filter feedback can land the
 * output past ±32767 and re-enter as the opposite sign — the core's
 * genuine behavior, which this reference decoder reproduces.
 */

export const BRR_BLOCK_BYTES = 9;
export const BRR_SAMPLES_PER_BLOCK = 16;
export const BRR_MAX_RANGE = 12;

/** S-DSP samples are 16-bit; `BRR_FLOAT_SCALE` maps -1…1 onto -32768…32767. */
export const BRR_BITS = 16;
export const BRR_FLOAT_SCALE = 1 << (BRR_BITS - 1);
export const BRR_MIN = -BRR_FLOAT_SCALE;
export const BRR_MAX = BRR_FLOAT_SCALE - 1;

/** Effective full-scale feedback coefficients per filter (manual Table 3-2-1). */
export const BRR_FILTERS: readonly { a: number; b: number }[] = [
  { a: 0, b: 0 },
  { a: 15 / 16, b: 0 },
  { a: 61 / 32, b: -15 / 16 },
  { a: 115 / 64, b: -13 / 16 },
];

export interface BrrOptions {
  /** Set the loop bit on the last block (hardware sample loop). Default false. */
  loop?: boolean;
  /** BRR filter number 0-3, stored in every block's header. Default 0 (raw). */
  filter?: number;
}

/** One BRR header byte: range (D7-D4), filter (D3-D2), loop (D1), end (D0). */
export function brrHeaderByte(range: number, filter: number, loop: boolean, end: boolean): number {
  return ((range & 0x0f) << 4) | ((filter & 3) << 2) | (loop ? 0b10 : 0) | (end ? 0b01 : 0);
}

/**
 * Encode linear PCM (roughly -1…1; out-of-range is clamped) into BRR blocks.
 * Each 16-sample block gets the smallest range 0-12 whose quantized nibbles
 * all fit in -8..+7 — the smallest such range is optimal because every
 * multiple of 2^r is also a multiple of 2^r' for r' ≥ r. Filter 0 (raw)
 * decodes the nibbles with no feedback, so this quantization is the only
 * loss on round-trip.
 */
export function encodeBrr(pcm: ArrayLike<number>, options: BrrOptions = {}): Uint8Array {
  const loop = options.loop === true;
  const filter = options.filter ?? 0;
  const n = pcm.length;
  const blocks = Math.max(1, Math.ceil(n / BRR_SAMPLES_PER_BLOCK));
  const out = new Uint8Array(blocks * BRR_BLOCK_BYTES);
  for (let b = 0; b < blocks; b++) {
    const off = b * BRR_BLOCK_BYTES;
    // 16-bit integers for this block (zero-padded on the last block).
    const s: number[] = new Array(BRR_SAMPLES_PER_BLOCK);
    for (let i = 0; i < BRR_SAMPLES_PER_BLOCK; i++) {
      const v = b * BRR_SAMPLES_PER_BLOCK + i < n ? pcm[b * BRR_SAMPLES_PER_BLOCK + i] : 0;
      s[i] = clamp16(Math.round(Number.isFinite(v) ? v * BRR_FLOAT_SCALE : 0));
    }
    // Smallest range in which every sample survives the 4-bit round-trip.
    let range = 0;
    for (;;) {
      let fits = true;
      for (const v of s) {
        const d = Math.round(v / 2 ** range);
        if (d < -8 || d > 7) {
          fits = false;
          break;
        }
      }
      if (fits || range === BRR_MAX_RANGE) break;
      range++;
    }
    const last = b === blocks - 1;
    out[off] = brrHeaderByte(range, filter, loop && last, last); // D1 loop, D0 end
    for (let i = 0; i < BRR_SAMPLES_PER_BLOCK; i++) {
      const d = clampNibble(Math.round(s[i] / 2 ** range));
      out[off + 1 + (i >> 1)] |= (d & 0x0f) << ((i & 1) ? 0 : 4); // HIGH nibble first
    }
  }
  return out;
}

/**
 * Decode BRR blocks into 16-bit samples (one value per four-bit nibble),
 * reading each block's own range/filter from its header. Filter state
 * (the previous two outputs) persists ACROSS blocks, as on the S-DSP.
 * Loop/end bits are ignored — sequencing and looping are the SPC700
 * driver's job.
 */
export function decodeBrr(blocks: Uint8Array): Int16Array {
  const count = Math.floor(blocks.length / BRR_BLOCK_BYTES) * BRR_SAMPLES_PER_BLOCK;
  const out = new Int16Array(count);
  let p1 = 0; // previous output sample
  let p2 = 0; // sample before that
  let i = 0;
  for (let b = 0; b + BRR_BLOCK_BYTES <= blocks.length; b += BRR_BLOCK_BYTES) {
    const header = blocks[b];
    const range = header >> 4;
    const filter = (header >> 2) & 3;
    for (let k = 0; k < 8; k++) {
      const byte = blocks[b + 1 + k];
      for (const shift of [4, 0]) {
        let d = (byte >> shift) & 0x0f;
        if (d & 8) d -= 16; // two's complement, -8..+7
        const x = coreSample(d, range, filter, p1, p2);
        out[i++] = x;
        p2 = p1;
        p1 = x;
      }
    }
  }
  return out;
}

/** Bit-exact mirror of the core's per-sample BRR math (see file header). */
function coreSample(d: number, range: number, filter: number, p1: number, p2full: number): number {
  let s = d;
  s = (s << range) >> 1;
  if (range >= 13) s = (s >> 25) << 11;
  const p2 = p2full >> 1;
  if (filter >= 2) {
    s += p1;
    s -= p2;
    if (filter === 2) {
      s += p2 >> 4;
      s += (p1 * -3) >> 6;
    } else {
      s += (p1 * -13) >> 7;
      s += (p2 * 3) >> 4;
    }
  } else if (filter === 1) {
    s += p1 >> 1;
    s += (-p1) >> 5;
  }
  if (s > BRR_MAX) s = BRR_MAX;
  else if (s < BRR_MIN) s = BRR_MIN;
  return toInt16(s * 2);
}

/** C `(int16_t)` cast: keep the low 16 bits, interpret two's complement. */
function toInt16(v: number): number {
  const u = ((v % 0x10000) + 0x10000) % 0x10000;
  return u > 0x7fff ? u - 0x10000 : u;
}

function clamp16(v: number): number {
  if (!Number.isFinite(v)) return 0;
  if (v < BRR_MIN) return BRR_MIN;
  if (v > BRR_MAX) return BRR_MAX;
  return Math.trunc(v);
}

function clampNibble(d: number): number {
  if (d < -8) return -8;
  if (d > 7) return 7;
  return d;
}
