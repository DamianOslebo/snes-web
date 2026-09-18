/**
 * The tracker's data model — pure, no DOM, no audio.
 *
 * A `Song` is a play-order list of `orders` (pattern indices), each `Pattern`
 * a grid of rows × `CHANNELS` of `Cell`s, plus a set of `Instrument`s (PCM
 * samples the Web Audio synth plays, re-pitched per note).
 *
 * Note numbers follow the FamiTracker convention: 0 = C-2, 24 = C (middle C),
 * 81 = A4 (440 Hz), 119 = B7 (NOTE_MAX). `CHANNELS` is fixed at 8 — the SNES S-DSP
 * has exactly 8 sample voices (Voice 0–7), and the tracker grid mirrors it.
 */

import { defaultInstruments } from './preset';

/** S-DSP voice count (SNES SPC700: Voice 0–7). */
export const CHANNELS = 8;
/** Rows per pattern (FamiTracker's default). */
export const DEFAULT_ROWS = 32;
/** Valid note-number range (0 = C-2 … 119 = B7). */
export const NOTE_MIN = 0;
export const NOTE_MAX = 119;
/** A4 (440 Hz) in our note numbering — the frequency anchor. */
export const A4 = 81;
/** Per-cell volume range (0–15, like the S-DSP's 4-bit per-voice volume). */
export const VOL_MIN = 0;
export const VOL_MAX = 15;

export interface Cell {
  /** Note number, or `null` for a rest (key off, nothing played). */
  note: number | null;
  /** Instrument index into `Song.instruments`. */
  inst: number;
  /** 0–15. */
  vol: number;
}

export interface Pattern {
  /** `rows[row][channel]`. Every pattern in a song has the same row count. */
  rows: Cell[][];
}

export interface Instrument {
  id: string;
  name: string;
  /**
   * Mono PCM in -1…1. MUST start and end at (or very near) zero: the S-DSP
   * keys samples on/off, and a discontinuous sample boundary is heard as a
   * crackle (the SNES manual's sample-continuity caution).
   */
  sample: Float32Array;
  /** Frequency the sample is pitched at with playbackRate 1. */
  baseFreq: number;
  /** Loop the sample (the SNES re-keys looping BRR data; a one-shot decays). */
  loop: boolean;
}

export interface Song {
  name: string;
  /** Rows per second (FamiTracker-style song speed). */
  tempo: number;
  /** Pattern indices in play order; playback wraps at the end when looping. */
  orders: number[];
  patterns: Pattern[];
  instruments: Instrument[];
}

/** The .snc export format version. */
export const TRACK_VERSION = 1;

// --- notes -----------------------------------------------------------------

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const LETTER_SEMITONE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Equal-temperament frequency for a note number (A4 = 81 → exactly 440 Hz). */
export function noteToFreq(note: number): number {
  return 440 * Math.pow(2, (note - A4) / 12);
}

/** `81` → `"A4"`, `0` → `"C-2"`, `24` → `"C"` (middle C, octave 0 is unnamed). */
export function noteName(note: number): string {
  const n = Math.floor(note);
  const name = NOTE_NAMES[((n % 12) + 12) % 12];
  const octave = Math.floor(n / 12) - 2;
  return octave === 0 ? name : name + String(octave);
}

export type NoteParse =
  | { kind: 'note'; note: number }
  | { kind: 'rest' }
  | { kind: 'invalid' };

/**
 * Parse a grid note entry: `"A#3"`, `"C"`, `"C-1"`, `"b4"` → a note (a bare
 * letter is octave 0, i.e. middle-C row); `"--"`, `"R"`, `"rest"`, `""` → a
 * rest; anything else (or out of range) → invalid.
 */
export function parseNoteName(text: string): NoteParse {
  const t = text.trim().toLowerCase();
  if (t === '' || t === '-' || t === '--' || t === 'r' || t === 'rest') return { kind: 'rest' };
  const m = /^([a-h])(#|b)?(-?\d+)?$/.exec(t);
  if (!m) return { kind: 'invalid' };
  const base = LETTER_SEMITONE[m[1].toUpperCase()];
  if (base === undefined) return { kind: 'invalid' };
  let semi = base;
  if (m[2] === '#') semi += 1;
  else if (m[2] === 'b') semi -= 1;
  const octave = m[3] === undefined ? 0 : Number(m[3]);
  const note = (octave + 2) * 12 + semi;
  if (note < NOTE_MIN || note > NOTE_MAX) return { kind: 'invalid' };
  return { kind: 'note', note };
}

// --- construction ----------------------------------------------------------

/** A fresh, all-rest pattern. */
export function emptyPattern(rows: number = DEFAULT_ROWS): Pattern {
  const grid: Cell[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: Cell[] = [];
    for (let c = 0; c < CHANNELS; c++) row.push({ note: null, inst: 0, vol: 12 });
    grid.push(row);
  }
  return { rows: grid };
}

function setNote(p: Pattern, row: number, ch: number, note: number, inst: number, vol: number): void {
  p.rows[row][ch] = { note, inst, vol };
}

/**
 * The song shown on first open (no saved song yet): a short 8-bar A-minor
 * demo — lead, bass, a noise drum, and a pad — so ▶ Play is audible at once.
 * Built from `defaultInstruments()` (Lead=0, Bass=1, Noise=2, Pad=3).
 */
export function defaultSong(): Song {
  const p0 = emptyPattern();
  // Lead (ch 0), one note per beat, an A-minor arpeggio phrase.
  setNote(p0, 0, 0, 69, 0, 12);  // A3
  setNote(p0, 4, 0, 72, 0, 12); // C4
  setNote(p0, 8, 0, 76, 0, 12); // E4
  setNote(p0, 12, 0, 81, 0, 12); // A4
  setNote(p0, 16, 0, 79, 0, 12); // G4
  setNote(p0, 20, 0, 76, 0, 12); // E4
  setNote(p0, 24, 0, 72, 0, 12); // C4
  setNote(p0, 28, 0, 69, 0, 12); // A3
  // Bass (ch 1): A–F–C–G roots, one per bar.
  setNote(p0, 0, 1, 45, 1, 13);  // A2
  setNote(p0, 8, 1, 53, 1, 13);  // F2
  setNote(p0, 16, 1, 60, 1, 13); // C3
  setNote(p0, 24, 1, 55, 1, 13); // G2
  // Noise (ch 2): kick on the beat, snare on the off-beat.
  for (const r of [0, 8, 16, 24]) setNote(p0, r, 2, 0, 2, 15);
  for (const r of [4, 12, 20, 28]) setNote(p0, r, 2, 96, 2, 11);
  // Pad (ch 3): sustained chord tone per bar.
  setNote(p0, 0, 3, 69, 3, 9);  // A3
  setNote(p0, 8, 3, 65, 3, 9);  // F3
  setNote(p0, 16, 3, 72, 3, 9); // C4
  setNote(p0, 24, 3, 67, 3, 9); // G3

  const p1 = emptyPattern();
  // Lead climbs an octave.
  setNote(p1, 0, 0, 84, 0, 12); // C5
  setNote(p1, 4, 0, 88, 0, 12); // E5
  setNote(p1, 8, 0, 93, 0, 12); // A5
  setNote(p1, 12, 0, 91, 0, 12); // G5
  setNote(p1, 16, 0, 88, 0, 12); // E5
  setNote(p1, 20, 0, 84, 0, 12); // C5
  setNote(p1, 24, 0, 81, 0, 12); // A4
  setNote(p1, 28, 0, 84, 0, 12); // C5
  setNote(p1, 0, 1, 45, 1, 13);
  setNote(p1, 8, 1, 53, 1, 13);
  setNote(p1, 16, 1, 60, 1, 13);
  setNote(p1, 24, 1, 55, 1, 13);
  for (const r of [0, 8, 16, 24]) setNote(p1, r, 2, 0, 2, 15);
  for (const r of [4, 12, 20, 28]) setNote(p1, r, 2, 96, 2, 11);
  setNote(p1, 0, 3, 69, 3, 9);
  setNote(p1, 8, 3, 65, 3, 9);
  setNote(p1, 16, 3, 72, 3, 9);
  setNote(p1, 24, 3, 67, 3, 9);

  return {
    name: 'Demo Song',
    // 8 rows/s: the voicing below is written at 120 BPM, 4 rows per beat
    // (quarter note = 4 rows → 4 × 8 = 32 rows/bar = 4 s at this speed).
    // Not 120 — that would be rows/SECOND, racing through the bar in 260 ms.
    tempo: 8,
    orders: [0, 0, 1, 1],
    patterns: [p0, p1],
    instruments: defaultInstruments(),
  };
}

// --- serialization ---------------------------------------------------------

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, Math.round(v)));
}

/** Serialize a song to JSON (the `.snc` file / localStorage payload). */
export function toJSON(song: Song): string {
  const doc = {
    v: TRACK_VERSION,
    name: song.name,
    tempo: song.tempo,
    orders: song.orders.slice(),
    patterns: song.patterns.map((p) =>
      p.rows.map((row) => row.map((c) => [c.note, c.inst, c.vol] as [number | null, number, number])),
    ),
    instruments: song.instruments.map((i) => ({
      id: i.id,
      name: i.name,
      baseFreq: i.baseFreq,
      loop: i.loop,
      sample: Array.from(i.sample),
    })),
  };
  return JSON.stringify(doc);
}

function readInstruments(raw: unknown): Instrument[] {
  if (!Array.isArray(raw) || raw.length === 0) throw new Error('track file: no instruments');
  return raw.map((item, i) => {
    if (typeof item !== 'object' || item === null) throw new Error(`track file: instrument ${i} malformed`);
    const o = item as Record<string, unknown>;
    const sample = o.sample;
    if (!Array.isArray(sample) || sample.length === 0 || sample.some((x) => typeof x !== 'number' || !Number.isFinite(x))) {
      throw new Error(`track file: instrument ${i} has no valid sample`);
    }
    const baseFreq = typeof o.baseFreq === 'number' && o.baseFreq > 0 && Number.isFinite(o.baseFreq) ? o.baseFreq : 440;
    return {
      id: typeof o.id === 'string' && o.id ? o.id : `inst${i}`,
      name: typeof o.name === 'string' && o.name ? o.name : `Instrument ${i + 1}`,
      sample: Float32Array.from(sample),
      baseFreq,
      loop: typeof o.loop === 'boolean' ? o.loop : true,
    };
  });
}

function readPatterns(raw: unknown, instCount: number): Pattern[] {
  // `raw` is `patterns[pattern][row][channel] = [note, inst, vol]`, matching
  // `toJSON` above (a bare array of rows per pattern, not a `{rows: …}` object).
  if (!Array.isArray(raw) || raw.length === 0) throw new Error('track file: no patterns');
  const patterns: Pattern[] = [];
  let rowCount = -1;
  for (let p = 0; p < raw.length; p++) {
    const rowsRaw = raw[p];
    if (!Array.isArray(rowsRaw) || rowsRaw.length === 0) throw new Error(`track file: pattern ${p} has no rows`);
    if (rowCount === -1) rowCount = rowsRaw.length;
    else if (rowsRaw.length !== rowCount) throw new Error(`track file: pattern ${p} row count differs`);
    const rows: Cell[][] = [];
    for (let r = 0; r < rowsRaw.length; r++) {
      const cellsRaw = rowsRaw[r];
      if (!Array.isArray(cellsRaw) || cellsRaw.length !== CHANNELS) {
        throw new Error(`track file: pattern ${p} row ${r} must have ${CHANNELS} cells`);
      }
      const row: Cell[] = [];
      for (let c = 0; c < CHANNELS; c++) {
        const cellRaw = cellsRaw[c];
        let note: number | null = null;
        let inst = 0;
        let vol = 12;
        if (Array.isArray(cellRaw) && cellRaw.length === 3) {
          const [n, i, v] = cellRaw;
          note = n === null ? null : clampInt(n, NOTE_MIN, NOTE_MAX, 0);
          inst = clampInt(i, 0, instCount - 1, 0);
          vol = clampInt(v, VOL_MIN, VOL_MAX, 12);
        }
        row.push({ note, inst, vol });
      }
      rows.push(row);
    }
    patterns.push({ rows });
  }
  return patterns;
}

/** Parse a song from JSON; throws `Error` with a reason if the doc is invalid. */
export function fromJSON(text: string): Song {
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch {
    throw new Error('not valid JSON');
  }
  if (typeof doc !== 'object' || doc === null) throw new Error('not a track file');
  const d = doc as Record<string, unknown>;
  const instruments = readInstruments(d.instruments);
  const patterns = readPatterns(d.patterns, instruments.length);
  const ordersRaw = d.orders;
  if (!Array.isArray(ordersRaw) || ordersRaw.length === 0) throw new Error('track file: no orders');
  const orders = (ordersRaw as unknown[]).map((o) => clampInt(o, 0, patterns.length - 1, 0));
  const tempo = clampInt(d.tempo, 1, 999, 8);
  return {
    name: typeof d.name === 'string' && d.name ? d.name : 'Untitled',
    tempo,
    orders,
    patterns,
    instruments,
  };
}
