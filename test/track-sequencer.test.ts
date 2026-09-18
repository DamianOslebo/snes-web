import { describe, expect, it } from 'vitest';
import { CHANNELS, type Cell, type Song } from '../src/track/model';
import { advanceSong, patternOf, playheadToSteps, rowToSteps, scheduleWindow, songRowAt } from '../src/track/sequencer';

/** Build a song from per-row note-per-channel maps (sparse). */
function makeSong(patterns: (number | null)[][][], orders: number[]): Song {
  return {
    name: 'test',
    tempo: 120,
    orders,
    patterns: patterns.map((rows) => ({
      rows: rows.map((chNotes) => {
        const row: Cell[] = [];
        for (let ch = 0; ch < CHANNELS; ch++) {
          const note = chNotes[ch] ?? null;
          row.push({ note, inst: ch % 4, vol: 12 });
        }
        return row;
      }),
    })),
    instruments: [
      { id: 'a', name: 'A', sample: new Float32Array(8), baseFreq: 440, loop: true },
      { id: 'b', name: 'B', sample: new Float32Array(8), baseFreq: 220, loop: true },
      { id: 'c', name: 'C', sample: new Float32Array(8), baseFreq: 110, loop: true },
      { id: 'd', name: 'D', sample: new Float32Array(8), baseFreq: 55, loop: true },
    ],
  };
}

describe('patternOf', () => {
  it('maps order entries to pattern indices and wraps out-of-range orders', () => {
    const s = makeSong([[[0, null, null, null, null, null, null, null]]], [1, 0, 1]);
    s.patterns.push(makeSong([[[null, 0, null, null, null, null, null, null]]], [0]).patterns[0]);
    expect(patternOf(s, 0)).toBe(1); // orders[0] = 1
    expect(patternOf(s, 1)).toBe(0); // orders[1] = 0
    expect(patternOf(s, 2)).toBe(1); // orders[2] = 1
    expect(patternOf(s, 7)).toBe(0); // 7 % 3 = 1 → orders[1] = 0
  });
});

describe('rowToSteps', () => {
  it('emits one event per non-rest cell, at time 0', () => {
    // row 0: ch0 and ch2 ring; row 1: all rests
    const s = makeSong([
      [[69, null, 72, null, null, null, null, null], [null, null, null, null, null, null, null, null]],
    ], [0]);
    expect(rowToSteps(s, 0, 0)).toEqual([
      { time: 0, channel: 0, note: 69, inst: 0, vol: 12 },
      { time: 0, channel: 2, note: 72, inst: 2, vol: 12 },
    ]);
    expect(rowToSteps(s, 0, 1)).toEqual([]);
  });

  it('normalizes order/row into range and stops at rows past the pattern', () => {
    const s = makeSong([
      [[69, null, null, null, null, null, null, null], [72, null, null, null, null, null, null, null]],
    ], [0]);
    expect(rowToSteps(s, 0, 2).length).toBe(0); // row past the pattern
    expect(rowToSteps(s, 1000, 1)).toEqual(rowToSteps(s, 0, 1)); // order wraps
  });

  it('returns [] (without throwing) for an empty song', () => {
    expect(rowToSteps({ name: 'x', tempo: 120, orders: [], patterns: [], instruments: [] }, 0, 0)).toEqual([]);
  });
});

describe('playheadToSteps', () => {
  it('expands rows across pattern and order boundaries at 1/tempo spacing', () => {
    // Two 2-row patterns, orders [0,1]; tempo 4 → dt = 0.25 s
    const s = makeSong(
      [
        [[69, null, null, null, null, null, null, null], [72, null, null, null, null, null, null, null]],
        [[76, null, null, null, null, null, null, null], [81, null, null, null, null, null, null, null]],
      ],
      [0, 1],
    );
    // horizon 0.6 s → the 0.75 s step (pat 1) is beyond it and excluded
    const steps = playheadToSteps(s, 4, { order: 0, row: 0 }, 600, true);
    expect(steps.map((x) => x.time)).toEqual([0, 0.25, 0.5]);
    expect(steps.map((x) => x.note)).toEqual([69, 72, 76]);
  });

  it('wraps past the last order back to the first when looping', () => {
    const s = makeSong(
      [
        [[69, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null]],
        [[72, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null]],
      ],
      [0, 1, 0],
    );
    // order 2 → pat 0 (69 at t=0, rest at 0.25), wrap → order 0 → pat 0
    // (69 at t=0.5, rest at 0.75), then order 1 → pat 1 (72 at t=1.0).
    const steps = playheadToSteps(s, 4, { order: 2, row: 0 }, 1300, true);
    expect(steps.filter((x) => x.time <= 1.0).map((x) => x.note)).toEqual([69, 69, 72]);
  });

  it('stops at the end of the last order when not looping', () => {
    const s = makeSong(
      [
        [[69, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null]],
        [[72, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null]],
      ],
      [0, 1],
    );
    // horizon well past the song end (2 patterns × 2 rows = 1.0 s)
    const steps = playheadToSteps(s, 4, { order: 0, row: 0 }, 10_000, false);
    expect(steps.map((x) => x.note).filter((n) => n !== undefined)).toEqual([69, 72]);
    expect(steps[steps.length - 1].time).toBeLessThan(1.0 + 1 / 4);
  });

  it('honors the lookahead horizon (no steps past it)', () => {
    const s = makeSong(
      [
        [[69, null, null, null, null, null, null, null], [72, null, null, null, null, null, null, null]],
      ],
      [0],
    );
    const steps = playheadToSteps(s, 4, { order: 0, row: 0 }, 250, true);
    for (const st of steps) expect(st.time).toBeLessThanOrEqual(0.25);
  });

  it('resumes mid-pattern (the playhead row plays first)', () => {
    const s = makeSong(
      [
        [[69, null, null, null, null, null, null, null], [72, null, null, null, null, null, null, null]],
      ],
      [0],
    );
    const steps = playheadToSteps(s, 4, { order: 0, row: 1 }, 250, true);
    expect(steps[0].note).toBe(72);
  });

  it('rejects an unplayable tempo or empty song', () => {
    const s = makeSong([[[69, null, null, null, null, null, null, null]]], [0]);
    expect(() => playheadToSteps(s, 0, { order: 0, row: 0 }, 100)).toThrow(RangeError);
    const empty: Song = { name: 'x', tempo: 120, orders: [], patterns: [], instruments: [] };
    expect(() => playheadToSteps(empty, 120, { order: 0, row: 0 }, 100)).toThrow(/orders/);
  });
});

describe('advanceSong', () => {
  it('steps within a pattern, across patterns, and wraps at the song end', () => {
    const s = makeSong(
      [
        [[69, null, null, null, null, null, null, null], [72, null, null, null, null, null, null, null]],
        [[76, null, null, null, null, null, null, null], [81, null, null, null, null, null, null, null]],
      ],
      [0, 1],
    );
    expect(advanceSong(s, 0, 0, true)).toEqual({ order: 0, row: 1 });
    expect(advanceSong(s, 0, 1, true)).toEqual({ order: 1, row: 0 }); // crosses into pat 1
    expect(advanceSong(s, 1, 1, true)).toEqual({ order: 0, row: 0 }); // loop wraps back
  });

  it('returns null at the end of the song when not looping (and for an empty song)', () => {
    const s = makeSong(
      [
        [[69, null, null, null, null, null, null, null], [72, null, null, null, null, null, null, null]],
      ],
      [0, 0],
    );
    expect(advanceSong(s, 0, 0, false)).toEqual({ order: 0, row: 1 });
    expect(advanceSong(s, 0, 1, false)).toEqual({ order: 1, row: 0 });
    expect(advanceSong(s, 1, 1, false)).toBeNull();
    const empty: Song = { name: 'x', tempo: 120, orders: [], patterns: [], instruments: [] };
    expect(advanceSong(empty, 0, 0, true)).toBeNull();
  });
});

describe('songRowAt', () => {
  it('maps the k-th played row back to (order, row), wrapping past the end', () => {
    const s = makeSong(
      [
        [[69, null, null, null, null, null, null, null], [72, null, null, null, null, null, null, null]],
        [[76, null, null, null, null, null, null, null], [81, null, null, null, null, null, null, null]],
      ],
      [0, 1],
    );
    expect(songRowAt(s, 0)).toEqual({ order: 0, row: 0 });
    expect(songRowAt(s, 1)).toEqual({ order: 0, row: 1 });
    expect(songRowAt(s, 2)).toEqual({ order: 1, row: 0 });
    expect(songRowAt(s, 3)).toEqual({ order: 1, row: 1 });
    expect(songRowAt(s, 4)).toEqual({ order: 0, row: 0 }); // wraps
    expect(songRowAt(s, 12)).toEqual({ order: 0, row: 0 });
    const empty: Song = { name: 'x', tempo: 120, orders: [], patterns: [], instruments: [] };
    expect(songRowAt(empty, 0)).toEqual({ order: 0, row: 0 });
  });
});

describe('scheduleWindow', () => {
  /** Two 2-row patterns, orders [0,1] — a 4-row song. */
  const song = (): Song =>
    makeSong(
      [
        [[69, null, null, null, null, null, null, null], [72, null, null, null, null, null, null, null]],
        [[76, null, null, null, null, null, null, null], [81, null, null, null, null, null, null, null]],
      ],
      [0, 1],
    );

  it('anchors each row to its own slot — the next window starts where the last one left off', () => {
    // tempo 4 → 0.25 s per row. The classic bug anchors the window to
    // "now" on every tick, which races the song through at ~lookahead/tick
    // times its tempo. Anchoring to the returned `until` keeps exactly
    // 0.25 s/row across the window boundary.
    const s = song();
    const w1 = scheduleWindow(s, 4, { order: 0, row: 0 }, 0, 0.5, true);
    expect(w1.steps.map((x) => x.at)).toEqual([0, 0.25, 0.5]);
    expect(w1.cursor).toEqual({ order: 1, row: 1 });
    expect(w1.until).toBeCloseTo(0.75);
    expect(w1.ended).toBe(false);

    const w2 = scheduleWindow(s, 4, w1.cursor, w1.until, 0.8, true);
    // The first row of window 2 sounds at window 1's `until` (0.75) —
    // not at "now" (≥ 0.5 by the time this tick runs).
    expect(w2.steps.length).toBe(1);
    expect(w2.steps[0].at).toBeCloseTo(0.75);

    // The combined timeline is an exact 0.25 s grid, no gaps, no overlap:
    expect([...w1.steps, ...w2.steps].map((x) => x.at)).toEqual([0, 0.25, 0.5, 0.75]);
  });

  it('marks ended once the non-looping song\'s last row is scheduled', () => {
    const s = song();
    const w = scheduleWindow(s, 4, { order: 0, row: 0 }, 0, 10, false);
    expect(w.ended).toBe(true);
    expect(w.steps.map((x) => x.at)).toEqual([0, 0.25, 0.5, 0.75]);
  });

  it('keeps wrapping rows when looping', () => {
    const s = song();
    const w = scheduleWindow(s, 4, { order: 0, row: 0 }, 0, 1.2, true);
    expect(w.ended).toBe(false);
    // 4 song rows (up to 0.75 s) + the first row of the loop at 1.0 s
    expect(w.steps.length).toBe(5);
    expect(w.steps[4].at).toBeCloseTo(1.0);
  });

  it('tolerates an empty song and a zero tempo without throwing', () => {
    const empty: Song = { name: 'x', tempo: 120, orders: [], patterns: [], instruments: [] };
    const w = scheduleWindow(empty, 120, { order: 0, row: 0 }, 0, 0.3, true);
    expect(w.steps).toEqual([]);
    expect(scheduleWindow(song(), 0, { order: 0, row: 0 }, 0, 0.3, true).steps.length).toBeGreaterThan(0);
  });
});
