/**
 * Built-in instruments: short PCM samples generated procedurally, so the
 * tracker is musical with zero external assets. The Web Audio synth re-pitches
 * each sample with `playbackRate = noteFreq / baseFreq` — the same relationship
 * as the S-DSP's P(L)/P(H) pitch relative to 0x2000.
 *
 * Every sample starts and ends at (or very near) zero: the S-DSP keys sample
 * playback on/off, and the SNES manual cautions that discontinuous sample data
 * is heard as crackle. A zero-to-zero boundary loops and re-keys cleanly.
 */

import type { Instrument } from './model';

/** Presets are authored at the SNES SPU rate (32 kHz). */
export const PRESET_RATE = 32_040;

/** Keep amplitudes well under 1 — the 8-voice sum can clip the DAC. */
const AMP = 0.7;

/** Deterministic LCG so builds and tests see the same "random" noise. */
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1_664_525 + 1_013_904_223) >>> 0;
    return s / 0x8000_0000 - 1;
  };
}

function render(n: number, f: (i: number) => number): Float32Array {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = f(i);
  // Sample-continuity: no discontinuity at the (re)key-on boundary.
  out[0] = 0;
  out[n - 1] = 0;
  return out;
}

/** Fast attack (a few ms), then a curved decay to ~zero by the end. */
function env(i: number, n: number, atk: number): number {
  if (i < atk) return i / atk;
  const t = (i - atk) / (n - atk);
  return (1 - t) * (1 - t);
}

function square(i: number, freq: number): number {
  return Math.sin((2 * Math.PI * freq * i) / PRESET_RATE) >= 0 ? 1 : -1;
}

function saw(i: number, freq: number): number {
  const x = ((freq * i) / PRESET_RATE) % 1;
  return (x < 0 ? x + 1 : x) * 2 - 1;
}

/** Lead: a square pluck (~125 ms) that loops — each loop re-keys a fresh pluck. */
function makeLead(): Float32Array {
  const n = 4_000; // ~125 ms
  return render(n, (i) => AMP * 0.8 * env(i, n, 60) * square(i, 220));
}

/** Bass: a low square thump with a punchy decay, one-shot. */
function makeBass(): Float32Array {
  const n = 5_760; // 180 ms
  return render(n, (i) => AMP * env(i, n, 20) * square(i, 110));
}

/** Noise: a white-noise hit (kick/snare), one-shot. Pitch (playbackRate) sets its speed. */
function makeNoise(): Float32Array {
  const n = 3_204; // 100 ms
  const rnd = makeRng(0x5eed);
  return render(n, (i) => AMP * 0.85 * env(i, n, 40) * rnd());
}

/** Pad: a few detuned saw partials, soft, loops. */
function makePad(): Float32Array {
  const n = 6_408; // 200 ms
  return render(n, (i) => {
    const e = env(i, n, 80);
    return AMP * 0.5 * e * (0.5 * saw(i, 220) + 0.3 * saw(i, 440) + 0.2 * saw(i, 110));
  });
}

/** The kinds of built-in preset, in default-rack order. */
export const PRESET_KINDS = ['lead', 'bass', 'noise', 'pad'] as const;
export type PresetKind = (typeof PRESET_KINDS)[number];

function presetId(kind: PresetKind): string {
  return `${kind}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Build one preset instrument (for "Add instrument" on the tracker page). */
export function makePresetInstrument(kind: PresetKind): Instrument {
  switch (kind) {
    case 'lead':
      return { id: presetId('lead'), name: 'Lead', sample: makeLead(), baseFreq: 220, loop: true };
    case 'bass':
      return { id: presetId('bass'), name: 'Bass', sample: makeBass(), baseFreq: 110, loop: false };
    case 'noise':
      return { id: presetId('noise'), name: 'Noise', sample: makeNoise(), baseFreq: 1000, loop: false };
    case 'pad':
      return { id: presetId('pad'), name: 'Pad', sample: makePad(), baseFreq: 220, loop: true };
  }
}

/**
 * The default instrument rack (Lead=0, Bass=1, Noise=2, Pad=3). Stable ids —
 * the demo song and round-trip tests rely on these; *added* presets get
 * unique ids via `makePresetInstrument`.
 */
export function defaultInstruments(): Instrument[] {
  return [
    { id: 'lead', name: 'Lead', sample: makeLead(), baseFreq: 220, loop: true },
    { id: 'bass', name: 'Bass', sample: makeBass(), baseFreq: 110, loop: false },
    { id: 'noise', name: 'Noise', sample: makeNoise(), baseFreq: 1000, loop: false },
    { id: 'pad', name: 'Pad', sample: makePad(), baseFreq: 220, loop: true },
  ];
}
