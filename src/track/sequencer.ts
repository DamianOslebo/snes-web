/**
 * Pure scheduling: expand song rows into concrete note events. No audio, no
 * clock — the Web Audio synth (synth.ts) and the tracker page each take the
 * rows they need and apply real time, so this stays testable in node.
 */

import type { Song } from './model';

/** One note event. `time` is seconds relative to "now" at schedule time. */
export interface Step {
  time: number;
  channel: number;
  note: number;
  /** Index into `Song.instruments`. */
  inst: number;
  /** 0–15. */
  vol: number;
}

/** A position in the song: which order entry, and the row within it. */
export interface Playhead {
  order: number;
  row: number;
}

/** A pattern index into `song.patterns`, always in range. */
export function patternOf(song: Song, order: number): number {
  const idx = song.orders[order % song.orders.length];
  return ((idx % song.patterns.length) + song.patterns.length) % song.patterns.length;
}

function requirePlayable(song: Song, tempo: number): void {
  if (song.orders.length === 0) throw new Error('song has no orders');
  if (song.patterns.length === 0) throw new Error('song has no patterns');
  if (!Number.isFinite(tempo) || tempo <= 0) throw new RangeError('tempo must be a positive number');
}

/**
 * Expand one row of one order entry into its note events (time 0). Rests
 * (null note) produce no event. `order`/`row` are normalized into range.
 */
export function rowToSteps(song: Song, order: number, row: number): Step[] {
  if (song.orders.length === 0 || song.patterns.length === 0) return [];
  const n = song.orders.length;
  const o = ((Math.round(order) % n) + n) % n;
  const pat = song.patterns[patternOf(song, o)];
  const r = Math.max(0, Math.floor(row));
  if (r >= pat.rows.length) return [];
  const out: Step[] = [];
  const cells = pat.rows[r];
  for (let ch = 0; ch < cells.length; ch++) {
    const c = cells[ch];
    if (c.note !== null && c.note !== undefined) {
      out.push({ time: 0, channel: ch, note: c.note, inst: c.inst, vol: c.vol });
    }
  }
  return out;
}

/**
 * Expand upcoming rows — across rows, pattern boundaries, and order entries —
 * into note events within a lookahead horizon, starting at `playhead`.
 * `dt = 1/tempo` seconds per row. When `loop` is false, expansion stops at
 * the song's end instead of wrapping past the last order.
 */
export function playheadToSteps(
  song: Song,
  tempo: number,
  playhead: Playhead,
  lookaheadMs: number,
  loop = true,
): Step[] {
  requirePlayable(song, tempo);
  const dt = 1 / tempo;
  const horizon = Math.max(0, lookaheadMs) / 1000;
  const nOrders = song.orders.length;
  let order = ((Math.round(playhead.order) % nOrders) + nOrders) % nOrders;
  let row = Number.isInteger(playhead.row) && playhead.row >= 0 ? playhead.row : 0;

  const out: Step[] = [];
  const maxRows = Math.floor(horizon / dt) + 2;
  for (let i = 0; i < maxRows; i++) {
    const time = i * dt;
    if (i > 0 && time > horizon) break;
    let pat = song.patterns[patternOf(song, order)];
    if (row >= pat.rows.length) {
      row = 0;
      if (loop) {
        order = (order + 1) % nOrders;
      } else if (order + 1 < nOrders) {
        order += 1; // advance to the next order entry
      } else {
        break; // last order entry exhausted — end of song
      }
      pat = song.patterns[patternOf(song, order)];
    }
    const cells = pat.rows[row];
    for (let ch = 0; ch < cells.length; ch++) {
      const c = cells[ch];
      if (c.note !== null && c.note !== undefined) {
        out.push({ time, channel: ch, note: c.note, inst: c.inst, vol: c.vol });
      }
    }
    row++;
  }
  return out;
}

/**
 * The row after (order, row), following the song's order list. Wraps back to
 * the first order entry when `loop` is set; `null` at the end of the song
 * when it isn't.
 */
export function advanceSong(song: Song, order: number, row: number, loop: boolean): Playhead | null {
  const n = song.orders.length;
  if (n === 0) return null;
  const start = ((Math.round(order) % n) + n) % n;
  let r = row + 1;
  // Loop: scan a full cycle (n entries — at least one pattern is non-empty,
  // or we land back at the start). Non-loop: scan ONLY forward to the last
  // order entry — wrapping past it would play the song forever.
  const span = loop ? n : n - start;
  for (let i = 0; i < span; i++) {
    const o = (start + i) % n;
    const pat = song.patterns[patternOf(song, o)];
    if (pat.rows.length > 0 && r < pat.rows.length) return { order: o, row: r };
    r = 0;
  }
  return loop ? { order: start, row: 0 } : null;
}

/**
 * The (order, row) of the song's k-th row in play order (wrapping past the
 * end). Drives the playhead highlight: given how many rows have elapsed since
 * the song started, which order entry — and which row within it — is sounding?
 */
export function songRowAt(song: Song, k: number): Playhead {
  const n = song.orders.length;
  if (n === 0) return { order: 0, row: 0 };
  const rowsPer = song.orders.map((o) => song.patterns[patternOf(song, o)].rows.length);
  const total = rowsPer.reduce((a, b) => a + b, 0);
  if (total === 0) return { order: 0, row: 0 };
  let idx = ((Math.floor(k) % total) + total) % total;
  for (let i = 0; i < n; i++) {
    if (idx < rowsPer[i]) return { order: i, row: idx };
    idx -= rowsPer[i];
  }
  return { order: n - 1, row: Math.max(0, rowsPer[n - 1] - 1) };
}

/** One scheduled event: a row's note, at its absolute AudioContext time. */
export interface ScheduledStep {
  step: Step;
  /** Absolute time (seconds, AudioContext clock) this event should sound. */
  at: number;
}

/** The result of filling one lookahead window of rows. */
export interface ScheduleWindow {
  steps: ScheduledStep[];
  /** The next unscheduled row — feed back as `cursor` on the next call. */
  cursor: Playhead;
  /** When `cursor` should sound — feed back as `until` on the next call. */
  until: number;
  /** True when the (non-looping) song's last row was just scheduled. */
  ended: boolean;
}

/**
 * Expand the rows from `cursor` whose sound time falls within `horizon`
 * (absolute time — the caller passes `now + lookahead`).
 *
 * Each row is anchored to its OWN slot in the song: the first sounds at
 * `until`, the next at `until + 1/tempo`, and so on. Calling this in quick
 * succession with the returned cursor/until therefore keeps the song at true
 * tempo, with no gaps and no re-anchoring. (Anchoring a window to `now` on
 * every call instead — the naive version — races the song through at roughly
 * `lookahead ÷ tickInterval` times its tempo.)
 */
export function scheduleWindow(
  song: Song,
  tempo: number,
  cursor: Playhead,
  until: number,
  horizon: number,
  loop: boolean,
): ScheduleWindow {
  const steps: ScheduledStep[] = [];
  let pos: Playhead = { ...cursor };
  let t = until;
  let ended = false;
  const dt = 1 / (Number.isFinite(tempo) && tempo > 0 ? tempo : 8);
  let guard = 0;
  for (;;) {
    if (t > horizon) break;
    if (guard++ > 4096) break; // a degenerate song must not spin
    for (const s of rowToSteps(song, pos.order, pos.row)) steps.push({ step: s, at: t });
    const next = advanceSong(song, pos.order, pos.row, loop);
    if (next === null) {
      ended = true;
      break;
    }
    pos = next;
    t += dt;
  }
  return { steps, cursor: pos, until: t, ended };
}
