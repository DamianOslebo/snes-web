import { describe, expect, it } from 'vitest';
import { defaultInstruments, makePresetInstrument, PRESET_KINDS, PRESET_RATE } from '../src/track/preset';

describe('defaultInstruments', () => {
  it('is the 4-voice rack: Lead, Bass, Noise, Pad', () => {
    const insts = defaultInstruments();
    expect(insts).toHaveLength(4);
    expect(insts.map((i) => i.name)).toEqual(['Lead', 'Bass', 'Noise', 'Pad']);
    // The demo song (model.ts) addresses them by these indices.
    expect(insts.map((i) => i.id)).toEqual(['lead', 'bass', 'noise', 'pad']);
  });

  it('every sample is finite, bounded, and zero at both ends (S-DSP key-on/off continuity)', () => {
    for (const inst of defaultInstruments()) {
      const s = inst.sample;
      expect(s.length).toBeGreaterThan(500);
      expect(s[0]).toBe(0);
      expect(s[s.length - 1]).toBe(0);
      for (let i = 0; i < s.length; i += 7) {
        expect(Number.isFinite(s[i])).toBe(true);
        expect(Math.abs(s[i])).toBeLessThanOrEqual(1);
      }
    }
  });

  it('leads/pads loop, bass and noise are one-shots', () => {
    const [lead, bass, noise, pad] = defaultInstruments();
    expect(lead.loop).toBe(true);
    expect(pad.loop).toBe(true);
    expect(bass.loop).toBe(false);
    expect(noise.loop).toBe(false);
  });

  it('presets are authored at the SPU rate', () => {
    expect(PRESET_RATE).toBe(32_040);
  });
});

describe('makePresetInstrument', () => {
  it('builds a valid instrument per kind', () => {
    for (const kind of PRESET_KINDS) {
      const inst = makePresetInstrument(kind);
      expect(inst.name).not.toBe('');
      expect(inst.id).not.toBe('');
      expect(inst.sample.length).toBeGreaterThan(500);
      expect(inst.sample[0]).toBe(0);
      expect(inst.sample[inst.sample.length - 1]).toBe(0);
      expect(inst.baseFreq).toBeGreaterThan(0);
    }
  });

  it('gives two adds of the same kind distinct ids (a rack can hold two "Lead"s)', () => {
    const a = makePresetInstrument('lead');
    const b = makePresetInstrument('lead');
    expect(a.id).not.toBe(b.id);
  });
});
