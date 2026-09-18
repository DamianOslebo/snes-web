import { describe, expect, it } from 'vitest';
import {
  A4,
  CHANNELS,
  DEFAULT_ROWS,
  NOTE_MAX,
  NOTE_MIN,
  VOL_MAX,
  VOL_MIN,
  defaultSong,
  emptyPattern,
  fromJSON,
  noteName,
  noteToFreq,
  parseNoteName,
  toJSON,
  type Song,
} from '../src/track/model';
import { defaultInstruments } from '../src/track/preset';

// --- note math -------------------------------------------------------------

describe('note names and frequencies (FamiTracker numbering)', () => {
  it('anchors A4 = 81 to exactly 440 Hz', () => {
    expect(A4).toBe(81);
    expect(noteToFreq(81)).toBeCloseTo(440, 9);
  });

  it('renders note names with the FamiTracker octave convention', () => {
    expect(noteName(0)).toBe('C-2');
    expect(noteName(24)).toBe('C');
    expect(noteName(81)).toBe('A4');
    expect(noteName(82)).toBe('A#4');
    expect(noteName(119)).toBe('B7');
  });

  it('is equal-tempered: +12 semitones doubles the frequency', () => {
    for (const n of [0, 37, 81, 119]) {
      expect(noteToFreq(n + 12)).toBeCloseTo(noteToFreq(n) * 2, 6);
    }
  });
});

describe('parseNoteName — grid entry parsing', () => {
  const note = (t: string): number => {
    const p = parseNoteName(t);
    if (p.kind !== 'note') throw new Error(`expected a note for "${t}", got ${p.kind}`);
    return p.note;
  };

  it('accepts letter, accidental, and octave (case-insensitive)', () => {
    expect(note('A4')).toBe(81);
    expect(note('a4')).toBe(81);
    expect(note('C')).toBe(24);
    expect(note('C#3')).toBe(61);
    expect(note('c#3')).toBe(61);
    expect(note('Fb3')).toBe(64); // Fb = E
  });

  it('maps rests to the rest result', () => {
    for (const t of ['', '-', '--', 'R', 'rest', '  REST ']) {
      expect(parseNoteName(t)).toEqual({ kind: 'rest' });
    }
  });

  it('rejects unknown letters and out-of-range octaves', () => {
    for (const t of ['Z1', 'H1', 'I1', 'C10', 'C-4', 'D-3']) {
      expect(parseNoteName(t).kind).toBe('invalid');
    }
  });

  it('round-trips: parseNoteName(noteName(n)) gives n back across the whole range', () => {
    for (let n = NOTE_MIN; n <= NOTE_MAX; n++) {
      const p = parseNoteName(noteName(n));
      expect(p).toEqual({ kind: 'note', note: n });
    }
  });
});

// --- construction ----------------------------------------------------------

describe('emptyPattern / defaultSong', () => {
  it('builds a full rows × 8 grid of rests', () => {
    const p = emptyPattern();
    expect(p.rows).toHaveLength(DEFAULT_ROWS);
    for (const row of p.rows) {
      expect(row).toHaveLength(CHANNELS);
      for (const c of row) {
        expect(c.note).toBeNull();
        expect(c.inst).toBeGreaterThanOrEqual(0);
        expect(c.vol).toBeGreaterThanOrEqual(VOL_MIN);
        expect(c.vol).toBeLessThanOrEqual(VOL_MAX);
      }
    }
  });

  it('has a playable demo: 4 orders, 2 patterns, 4 instruments', () => {
    const s = defaultSong();
    expect(s.instruments).toHaveLength(4);
    expect(s.patterns).toHaveLength(2);
    expect(s.orders).toEqual([0, 0, 1, 1]);
    expect(s.tempo).toBeGreaterThan(0);
    for (const o of s.orders) {
      expect(o).toBeGreaterThanOrEqual(0);
      expect(o).toBeLessThan(s.patterns.length);
    }
  });

  it('has notes on every default channel used (lead, bass, noise, pad)', () => {
    const s = defaultSong();
    const used = new Set<number>();
    for (const p of s.patterns)
      for (const row of p.rows)
        for (const c of row) if (c.note !== null) used.add(c.inst);
    expect(used).toContain(0);
    expect(used).toContain(1);
    expect(used).toContain(2);
    expect(used).toContain(3);
  });

  it('keeps every cell in range', () => {
    const s = defaultSong();
    for (const p of s.patterns)
      for (const row of p.rows)
        for (const c of row) {
          if (c.note !== null) {
            expect(c.note).toBeGreaterThanOrEqual(NOTE_MIN);
            expect(c.note).toBeLessThanOrEqual(NOTE_MAX);
          }
          expect(c.inst).toBeLessThan(s.instruments.length);
          expect(c.vol).toBeGreaterThanOrEqual(VOL_MIN);
          expect(c.vol).toBeLessThanOrEqual(VOL_MAX);
        }
  });
});

// --- serialization ---------------------------------------------------------

describe('toJSON / fromJSON round-trip', () => {
  const songWithInsts = (): Song => {
    const s = defaultSong();
    s.instruments = defaultInstruments();
    return s;
  };

  it('round-trips a full song (cells, orders, tempo, instruments)', () => {
    const a = songWithInsts();
    a.name = 'Round Trip';
    a.tempo = 132;
    a.patterns[0].rows[5][2] = { note: 72, inst: 3, vol: 11 };
    const b = fromJSON(toJSON(a));
    expect(b.name).toBe('Round Trip');
    expect(b.tempo).toBe(132);
    expect(b.orders).toEqual(a.orders);
    expect(b.patterns).toHaveLength(a.patterns.length);
    for (let p = 0; p < a.patterns.length; p++)
      for (let r = 0; r < a.patterns[p].rows.length; r++)
        for (let c = 0; c < CHANNELS; c++) {
          expect(b.patterns[p].rows[r][c]).toEqual(a.patterns[p].rows[r][c]);
        }
    expect(b.instruments).toHaveLength(a.instruments.length);
    for (let i = 0; i < a.instruments.length; i++) {
      expect(b.instruments[i].name).toBe(a.instruments[i].name);
      expect(b.instruments[i].baseFreq).toBe(a.instruments[i].baseFreq);
      expect(b.instruments[i].loop).toBe(a.instruments[i].loop);
      expect(Array.from(b.instruments[i].sample)).toEqual(Array.from(a.instruments[i].sample));
    }
  });

  it('round-trips rests as null (not 0)', () => {
    const s = defaultSong();
    expect(s.patterns[0].rows[1][0].note).toBeNull();
    const b = fromJSON(toJSON(s));
    expect(b.patterns[0].rows[1][0].note).toBeNull();
  });
});

describe('fromJSON — validation and clamping', () => {
  type TrackDoc = {
    v: number;
    name: string;
    tempo: number | string; // the wire format is untyped — garbage is legal to receive
    orders: number[];
    patterns: [number | null, number, number][][][];
    instruments: { id: string; name: string; baseFreq: number; loop: boolean; sample: number[] }[];
  };
  const minimal = (): TrackDoc => {
    const cell = (note: number | null): [number | null, number, number] => [note, 0, 12];
    const row = [cell(72), ...new Array(7).fill(cell(null))];
    return {
      v: 1,
      name: 't',
      tempo: 120,
      orders: [0],
      patterns: [[row]],
      instruments: [{ id: 'x', name: 'X', baseFreq: 440, loop: true, sample: [0, 0.5, -0.5, 0] }],
    };
  };

  it('rejects documents that are not JSON / not track files', () => {
    expect(() => fromJSON('nope')).toThrow(/JSON/);
    expect(() => fromJSON('42')).toThrow(/track file/);
  });

  it('rejects empty instruments, patterns, and orders', () => {
    const d = minimal();
    expect(() => fromJSON(JSON.stringify({ ...d, instruments: [] }))).toThrow(/instruments/);
    expect(() => fromJSON(JSON.stringify({ ...d, patterns: [] }))).toThrow(/patterns/);
    expect(() => fromJSON(JSON.stringify({ ...d, orders: [] }))).toThrow(/orders/);
  });

  it('rejects a row with the wrong cell count and mismatched pattern row counts', () => {
    const d = minimal();
    d.patterns[0][0] = d.patterns[0][0].slice(0, 3); // 3 cells, need 8
    expect(() => fromJSON(JSON.stringify(d))).toThrow(/8 cells/);
    const d2 = minimal();
    d2.patterns[0].push(d2.patterns[0][0]);
    d2.patterns.push([d2.patterns[0][0].slice(0, 7)]); // 1 row vs 2 rows — different row count
    expect(() => fromJSON(JSON.stringify(d2))).toThrow(/row count/);
  });

  it('rejects instruments with missing/invalid samples', () => {
    const d = minimal();
    d.instruments[0].sample = [];
    expect(() => fromJSON(JSON.stringify(d))).toThrow(/sample/);
    d.instruments[0].sample = [0, NaN, 1];
    expect(() => fromJSON(JSON.stringify(d))).toThrow(/sample/);
  });

  it('clamps out-of-range cell data and orders, falls back on garbage', () => {
    const d = minimal();
    // note 999 → clamped to NOTE_MAX; inst 9 → clamped to 0; vol 99 → 15
    d.patterns[0][0][0] = [999, 9, 99];
    d.orders = [0, 42];
    d.tempo = 'garbage';
    const s = fromJSON(JSON.stringify(d));
    expect(s.patterns[0].rows[0][0].note).toBe(NOTE_MAX);
    expect(s.patterns[0].rows[0][0].inst).toBe(0);
    expect(s.patterns[0].rows[0][0].vol).toBe(VOL_MAX);
    expect(s.orders).toEqual([0, 0]); // 42 clamps into range (1 pattern)
    expect(s.tempo).toBe(8); // non-number → fallback (demo tempo)
  });
});
