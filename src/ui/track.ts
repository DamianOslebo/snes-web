/**
 * The 🎵 Music tracker page (`?track=1`) — a core-free, FamiTracker-style
 * editor for the SNES S-DSP: a pattern grid (32 rows × 8 sample voices),
 * an instrument rack (procedural PCM presets), a song-order list with tempo,
 * and live Web Audio preview.
 *
 * Mirrors `src/ui/graphics.ts` (the other standalone page): one
 * `mountTrack(container)`, its own CSS, plain DOM, no framework. The page
 * drives the pure `src/track/*` core — model, sequencer, presets — whose
 * logic stays testable in node; `synth.ts` is the only file that touches
 * AudioContext, so this whole page (with it) is browser-only.
 */

import {
  CHANNELS,
  DEFAULT_ROWS,
  NOTE_MAX,
  NOTE_MIN,
  emptyPattern,
  defaultSong,
  fromJSON,
  noteName,
  parseNoteName,
  toJSON,
  type Cell,
  type Song,
} from '../track/model';
import {
  advanceSong,
  patternOf,
  rowToSteps,
  scheduleWindow,
  songRowAt,
  type Playhead,
} from '../track/sequencer';
import { PRESET_KINDS, makePresetInstrument, type PresetKind } from '../track/preset';
import { TrackerSynth } from '../track/synth';
import type { TrackController } from '../agent/types';
import {
  buildSpc as buildSpcPackage,
  spcGlue as spcGlueSrc,
  spcLayout as spcLayoutInfo,
} from '../spc/layout';

// --- shared state ---------------------------------------------------------

/** localStorage key for the persisted song (snes-web:<feature>:v1). */
const STORAGE_KEY = 'snes-web:track-song:v1';
/** Schedule this far ahead (the lookahead-scheduler horizon). */
const LOOKAHEAD_MS = 300;
/** Scheduler tick interval (ms) — well under the lookahead horizon. */
const TICK_MS = 25;
/** Debounce for persisting the (sample-heavy) song to localStorage. */
const SAVE_DEBOUNCE_MS = 400;

interface TrkState {
  song: Song;
  synth: TrackerSynth;
  playing: boolean;
  loop: boolean;
  /** Index into `song.patterns` for the grid being edited. */
  pattern: number;
  /** Scheduler cursor: the next unscheduled row (see `scheduleWindow`). */
  playhead: Playhead;
  /** When `playhead` should sound (absolute AudioContext time). */
  schedUntil: number;
  /** When song row 0 sounds — anchors the playhead highlight. */
  startAt: number;
  schedTimer: number | null;
  saveTimer: number | null;
  brushNote: number | null;
  brushInst: number;
  brushVol: number;
  // DOM references, assigned by mountTrack (Object.assign) before wiring.
  statEl: HTMLElement;
  playBtn: HTMLButtonElement;
  gridWrap: HTMLElement;
  patSel: HTMLSelectElement;
  nameIn: HTMLInputElement;
  noteIn: HTMLInputElement;
  restChk: HTMLInputElement;
  instSel: HTMLSelectElement;
  volIn: HTMLInputElement;
  volLbl: HTMLElement;
  tempoIn: HTMLInputElement;
  loopChk: HTMLInputElement;
  orderList: HTMLElement;
  fileEl: HTMLInputElement;
}

function loadSong(): Song {
  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return fromJSON(raw);
    } catch {
      // corrupt or stale save — fall back to the demo below
    }
  }
  return defaultSong();
}

// Data-only initial state; mountTrack (Object.assign) fills in the DOM
// element references before any control is wired up.
const trk = {
  song: loadSong(),
  synth: new TrackerSynth(),
  playing: false,
  loop: true,
  pattern: 0,
  playhead: { order: 0, row: 0 },
  schedUntil: 0,
  startAt: 0,
  schedTimer: null,
  saveTimer: null,
  brushNote: 81, // A4
  brushInst: 0,
  brushVol: 12,
} as unknown as TrkState;

// 1:1 with the grid being rendered (row → ch → button); rebuilt by renderGrid.
let gridCells: HTMLButtonElement[][] = [];
/** Row-number labels of the rendered grid, for the playhead highlight. */
let gridRowNums: HTMLElement[] = [];
/**
 * Agent-controller seam: true once `mountTrack` has wired the DOM refs, so
 * the controller knows whether re-rendering (and preview) is possible right
 * now. The song state itself is always current regardless.
 */
let trkMounted = false;

// --- small helpers --------------------------------------------------------

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function setStat(stat: HTMLElement, text: string, isErr = false): void {
  stat.textContent = text;
  stat.className = `trk-stat${isErr ? ' err' : ''}`.trim();
}

/** Clamp a number input to [lo, hi], falling back when non-numeric. */
function num(inp: HTMLInputElement, fb: number, lo: number, hi: number): number {
  const v = parseInt(inp.value, 10);
  if (!Number.isFinite(v)) return fb;
  return Math.max(lo, Math.min(hi, v));
}

function label(text: string, control: HTMLElement): HTMLElement {
  const l = el('label', '', text);
  l.appendChild(control);
  return l;
}

function numInput(value: number, max: number, title: string): HTMLInputElement {
  const i = el('input', '');
  i.type = 'number';
  i.min = '0';
  i.max = String(max);
  i.value = String(value);
  i.title = title;
  return i;
}

function checkbox(text: string): { lbl: HTMLLabelElement; input: HTMLInputElement } {
  const input = el('input', '');
  input.type = 'checkbox';
  const lbl = el('label', '', text);
  lbl.appendChild(input);
  return { lbl, input };
}

// --- page shell -----------------------------------------------------------

const CSS = `
.trk-root{color-scheme:dark;background:#0d0d10;color:#e8e8ea;min-height:100vh;font:14px/1.5 ui-sans-serif,system-ui,sans-serif;padding:20px;max-width:1180px;margin:0 auto;display:flex;flex-direction:column;gap:14px;box-sizing:border-box}
.trk-root *,.trk-root *::before,.trk-root *::after{box-sizing:border-box}
.trk-head{display:flex;align-items:center;gap:12px}
.trk-head h1{font-size:18px;margin:0;font-weight:600}
.btn{background:#1c1c22;color:#e8e8ea;border:1px solid #33333c;border-radius:6px;padding:5px 12px;cursor:pointer;font:inherit}
.btn:hover{border-color:#4a4a55}
.btn:disabled{opacity:.4;cursor:default}
.btn.primary{background:#1d3350;border-color:#2b4a70}
.btn.sm{padding:3px 9px;font-size:12px}
label.btn{cursor:pointer}
.trk-stat{font:12px ui-monospace,SFMono-Regular,Menlo,monospace;color:#9fd0ff}
.trk-stat.err{color:#ff8a8a}
.muted{color:#6a6a75;font-size:12px}
.panel{background:#141418;border:1px solid #2a2a30;border-radius:8px;padding:14px;display:flex;flex-direction:column;gap:12px}
.row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.row label{display:inline-flex;align-items:center;gap:6px;font-size:13px;color:#b8b8c0}
select,input[type=number],input[type=text]{background:#1c1c22;color:#e8e8ea;border:1px solid #33333c;border-radius:6px;padding:4px 8px;font:inherit}
input[type=number]{width:84px}
input[type=text].trk-note{width:74px;text-align:center;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.h2{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#8a8a94;margin:0 0 2px}
.trk-cols{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px;align-items:start}
.trk-gridwrap{overflow:auto;max-height:64vh}
.trk-grid{display:grid;grid-template-columns:repeat(9,minmax(38px,1fr));gap:2px;width:max-content;min-width:100%}
.trk-rnum{font:11px ui-monospace,SFMono-Regular,Menlo,monospace;color:#5a5a66;text-align:right;padding:3px 6px 3px 2px;user-select:none}
.trk-hcell{font:11px ui-monospace,SFMono-Regular,Menlo,monospace;color:#8a8a94;text-align:center;padding:3px 0;user-select:none}
.trk-cell{background:#1c1c22;color:#e8e8ea;border:1px solid #26262e;border-radius:4px;padding:4px 0;font:12px ui-monospace,SFMono-Regular,Menlo,monospace;cursor:pointer}
.trk-cell:hover{border-color:#4a7ab5}
.trk-cell.rest{color:#4a4a55}
.trk-cell.trk-cur{background:#1d3350;border-color:#4a7ab5;color:#fff}
.trk-rnum.trk-cur{color:#9fd0ff;font-weight:600}
.trk-order{display:flex;align-items:center;gap:8px;font:13px ui-monospace,SFMono-Regular,Menlo,monospace}
.trk-order .muted{font:inherit}
.trk-order button{background:none;border:none;color:#9fd0ff;cursor:pointer;font:inherit;padding:0 3px}
.trk-order button:hover{color:#fff}
.trk-order button:disabled{color:#3a3a44;cursor:default}
input[type=range]{accent-color:#4a7ab5}
input[type=checkbox]{accent-color:#4a7ab5}
@media (max-width:900px){.trk-cols{grid-template-columns:1fr}}
`;

function styleEl(): HTMLStyleElement {
  const s = document.createElement('style');
  s.textContent = CSS;
  return s;
}

// --- playback -------------------------------------------------------------

/**
 * One scheduler tick: fill the lookahead window with the rows whose slot
 * falls within `now + LOOKAHEAD_MS`. `scheduleWindow` (sequencer.ts) anchors
 * each row to ITS OWN slot in the song — first at `schedUntil`, the rest a
 * row-time later — and hands back the cursor/until to feed into the next
 * tick. That is what keeps the song at true tempo: re-anchoring the window
 * to `now` on every tick instead would race it through at
 * ~LOOKAHEAD/TICK times its speed.
 */
function tick(): void {
  const st = trk;
  if (!st.playing) return;
  const now = st.synth.now();
  if (now === null) {
    stopPlayback();
    return;
  }
  const w = scheduleWindow(st.song, st.song.tempo, st.playhead, st.schedUntil, now + LOOKAHEAD_MS / 1000, st.loop);
  // `s.at` is absolute AudioContext time (synth.ts: playNote(step, when)).
  for (const s of w.steps) st.synth.playNote(s.step, s.at);
  if (w.ended) {
    stopPlayback(); // non-loop: the song's last row was just scheduled
    return;
  }
  st.playhead = w.cursor;
  st.schedUntil = w.until;
  updateHighlight(now);
}

async function startPlayback(): Promise<void> {
  const st = trk;
  // resume() from the user gesture satisfies the autoplay rules, and builds
  // the graph (and the sample buffers) on first use.
  try {
    await st.synth.resume();
  } catch (err) {
    setStat(st.statEl, `audio unavailable: ${(err as Error).message}`, true);
    return;
  }
  const now = st.synth.now();
  if (now === null) {
    stopPlayback();
    return;
  }
  st.synth.stop(); // key off any voice left over from a Step or an earlier Play
  // Row 0 sounds a short lead-in ahead of "now"; the highlight is anchored
  // to the same moment, so it stays in step with the audio.
  st.playhead = { order: 0, row: 0 };
  st.startAt = now + 0.05;
  st.schedUntil = st.startAt;
  st.playing = true;
  st.schedTimer = window.setInterval(tick, TICK_MS);
  tick(); // schedule the first window immediately, don't wait a tick
  st.playBtn.textContent = '⏸ Pause';
  setStat(st.statEl, `playing at ${st.song.tempo} rows/s${st.loop ? '' : ' (one pass)'}`);
}

function stopPlayback(): void {
  const st = trk;
  st.playing = false;
  if (st.schedTimer !== null) {
    clearInterval(st.schedTimer);
    st.schedTimer = null;
  }
  st.synth.stop(); // keys off every voice, looping ones included
  st.playhead = { order: 0, row: 0 };
  st.schedUntil = 0;
  st.startAt = 0;
  clearHighlight();
  st.playBtn.textContent = '▶ Play';
  setStat(st.statEl, 'stopped');
}

/** Audition one row at the playhead, then advance the playhead one row. */
async function stepOnce(): Promise<void> {
  const st = trk;
  if (st.playing) return;
  try {
    await st.synth.resume();
  } catch (err) {
    setStat(st.statEl, `audio unavailable: ${(err as Error).message}`, true);
    return;
  }
  st.synth.stop(); // clear voices left over from a previous step
  const now = st.synth.now();
  if (now === null) return;
  const pos = st.playhead;
  for (const s of rowToSteps(st.song, pos.order, pos.row)) {
    st.synth.playNote(s, now);
  }
  const next = advanceSong(st.song, pos.order, pos.row, st.loop);
  st.playhead = next ?? { order: 0, row: 0 };
  setStat(st.statEl, `stepped row ${pos.row + 1} of pattern ${patternOf(st.song, pos.order) + 1}`);
}

// --- playhead highlight ---------------------------------------------------
// The row currently SOUNDING in the grid being viewed. Driven by the synth
// clock (startAt + elapsed rows), not by the scheduler cursor — the cursor
// is always a lookahead ahead of what's sounding.

let curRow: number | null = null;

function clearHighlight(): void {
  if (curRow === null) return;
  for (const b of gridCells[curRow] ?? []) b.classList.remove('trk-cur');
  gridRowNums[curRow]?.classList.remove('trk-cur');
  curRow = null;
}

function updateHighlight(now: number): void {
  const st = trk;
  let row: number | null = null;
  if (st.playing) {
    const k = Math.max(0, Math.floor((now - st.startAt) * st.song.tempo + 0.5));
    const pos = songRowAt(st.song, k);
    if (patternOf(st.song, pos.order) === st.pattern) row = pos.row;
  }
  if (row === curRow) return;
  clearHighlight();
  if (row === null) return;
  curRow = row;
  for (const b of gridCells[row] ?? []) b.classList.add('trk-cur');
  gridRowNums[row]?.classList.add('trk-cur');
}

// --- editing --------------------------------------------------------------

function scheduleSave(): void {
  if (trk.saveTimer !== null) return;
  trk.saveTimer = window.setTimeout(() => {
    trk.saveTimer = null;
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, toJSON(trk.song));
    } catch {
      // storage full or unavailable — the in-memory song still works
    }
  }, SAVE_DEBOUNCE_MS);
}

function paintCellContent(b: HTMLButtonElement, cell: Cell): void {
  b.textContent = cell.note === null ? '···' : noteName(cell.note);
  b.classList.toggle('rest', cell.note === null);
  const inst = trk.song.instruments[cell.inst];
  b.title = `${cell.note === null ? 'rest' : noteName(cell.note)} · ${inst ? inst.name : `inst ${cell.inst}`} · vol ${cell.vol}`;
}

function cellBtn(cell: Cell, row: number, ch: number): HTMLButtonElement {
  const b = el('button', 'trk-cell', '');
  paintCellContent(b, cell);
  b.addEventListener('click', () => paintAt(row, ch));
  return b;
}

/**
 * Paint (row, ch) with the current brush. FamiTracker toggle: clicking a
 * cell that already holds the brush note erases it; a rest brush clears.
 */
function paintAt(row: number, ch: number): void {
  const st = trk;
  const pat = st.song.patterns[st.pattern];
  if (!pat || row >= pat.rows.length || ch >= CHANNELS) return;
  const cell = pat.rows[row][ch];
  const note = st.brushNote;
  pat.rows[row][ch] =
    note === null || cell.note === note
      ? { note: null, inst: st.brushInst, vol: st.brushVol }
      : { note, inst: st.brushInst, vol: st.brushVol };
  const b = gridCells[row]?.[ch];
  if (b) paintCellContent(b, pat.rows[row][ch]);
  scheduleSave();
}

function renderGrid(): void {
  const st = trk;
  const pat = st.song.patterns[st.pattern];
  if (!pat) return;
  st.gridWrap.innerHTML = '';
  const grid = el('div', 'trk-grid');
  gridCells = [];
  gridRowNums = [];
  grid.appendChild(el('div', 'trk-rnum', ''));
  for (let ch = 0; ch < CHANNELS; ch++) {
    grid.appendChild(el('div', 'trk-hcell', `Ch ${ch}`));
  }
  for (let r = 0; r < pat.rows.length; r++) {
    const rnum = el('div', 'trk-rnum', String(r + 1));
    gridRowNums.push(rnum);
    grid.appendChild(rnum);
    const rowBtns: HTMLButtonElement[] = [];
    for (let ch = 0; ch < CHANNELS; ch++) {
      const b = cellBtn(pat.rows[r][ch], r, ch);
      grid.appendChild(b);
      rowBtns.push(b);
    }
    gridCells.push(rowBtns);
  }
  st.gridWrap.appendChild(grid);
  // The grid was rebuilt under a running song (e.g. pattern switch) — re-apply
  // the highlight to the new DOM.
  if (st.playing) updateHighlight(st.synth.now() ?? 0);
}

function renderPatSel(): void {
  const st = trk;
  st.patSel.innerHTML = '';
  st.song.patterns.forEach((_, i) => {
    const o = document.createElement('option');
    o.value = String(i);
    o.textContent = `Pattern ${i + 1}`;
    st.patSel.appendChild(o);
  });
  if (st.pattern >= st.song.patterns.length) st.pattern = 0;
  st.patSel.value = String(st.pattern);
}

function addPattern(): void {
  const st = trk;
  const rows = st.song.patterns[0]?.rows.length ?? DEFAULT_ROWS;
  st.song.patterns.push(emptyPattern(rows));
  st.pattern = st.song.patterns.length - 1;
  renderPatSel();
  renderGrid();
  scheduleSave();
  setStat(st.statEl, `added pattern ${st.pattern + 1} (${rows} rows)`);
}

function renderInstOptions(): void {
  const st = trk;
  st.instSel.innerHTML = '';
  st.song.instruments.forEach((inst, i) => {
    const o = document.createElement('option');
    o.value = String(i);
    o.textContent = `${i + 1} · ${inst.name}`;
    st.instSel.appendChild(o);
  });
  if (st.brushInst >= st.song.instruments.length) st.brushInst = 0;
  st.instSel.value = String(st.brushInst);
}

function addInstrument(kind: PresetKind): void {
  const st = trk;
  const inst = makePresetInstrument(kind);
  st.song.instruments.push(inst);
  // Rebuild the synth's sample buffers for the new rack (synth.ts is lazy —
  // this is what materializes them once the context exists).
  st.synth.setInstruments(st.song.instruments);
  st.brushInst = st.song.instruments.length - 1;
  renderInstOptions();
  scheduleSave();
  setStat(st.statEl, `added instrument ${inst.name} (rack #${st.brushInst + 1})`);
}

function transpose(d: number): void {
  if (trk.brushNote === null) return;
  trk.brushNote = Math.min(NOTE_MAX, Math.max(NOTE_MIN, trk.brushNote + d));
  trk.restChk.checked = false;
  trk.noteIn.value = noteName(trk.brushNote);
}

function renderOrders(): void {
  const st = trk;
  st.orderList.innerHTML = '';
  st.song.orders.forEach((patIdx, i) => {
    const row = el('div', 'trk-order');
    row.appendChild(el('span', '', `#${i + 1}`));
    row.appendChild(el('span', 'muted', `→ pattern ${patIdx + 1}`));
    const prev = el('button', '', '◀');
    prev.title = 'move earlier';
    prev.disabled = i === 0;
    prev.addEventListener('click', () => moveOrder(i, -1));
    const next = el('button', '', '▶');
    next.title = 'move later';
    next.disabled = i === st.song.orders.length - 1;
    next.addEventListener('click', () => moveOrder(i, 1));
    const del = el('button', '', '✕');
    del.title = 'remove this order';
    del.disabled = st.song.orders.length <= 1;
    del.addEventListener('click', () => removeOrder(i));
    row.appendChild(prev);
    row.appendChild(next);
    row.appendChild(del);
    st.orderList.appendChild(row);
  });
}

function moveOrder(i: number, d: number): void {
  const o = trk.song.orders;
  const j = i + d;
  if (j < 0 || j >= o.length) return;
  const t = o[i];
  o[i] = o[j];
  o[j] = t;
  renderOrders();
  scheduleSave();
}

function removeOrder(i: number): void {
  if (trk.song.orders.length <= 1) return;
  trk.song.orders.splice(i, 1);
  renderOrders();
  scheduleSave();
}

function addOrder(): void {
  const st = trk;
  // New orders start on the last pattern in the list (or pattern 0).
  st.song.orders.push(st.song.orders.length ? st.song.orders[st.song.orders.length - 1] : 0);
  renderOrders();
  scheduleSave();
}

// --- files ----------------------------------------------------------------

function downloadSong(): void {
  const st = trk;
  const text = toJSON(st.song);
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safe = st.song.name.replace(/[^\w.-]+/g, '_') || 'song';
  a.href = url;
  a.download = `${safe}.snc`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  setStat(st.statEl, `downloaded ${safe}.snc`);
}

/** Swap the whole song (file load / reset): re-bind state + all panels. */
function replaceSong(song: Song): void {
  const st = trk;
  stopPlayback();
  st.song = song;
  st.synth.setInstruments(song.instruments);
  st.pattern = 0;
  st.playhead = { order: 0, row: 0 };
  if (st.brushInst >= song.instruments.length) st.brushInst = 0;
  st.nameIn.value = song.name;
  st.tempoIn.value = String(song.tempo);
  renderInstOptions();
  renderPatSel();
  renderGrid();
  renderOrders();
  scheduleSave();
}

// --- page ------------------------------------------------------------------

export function mountTrack(container: HTMLElement): void {
  document.title = 'SNES Music — SNES Web';
  container.innerHTML = '';

  // Materialize any sample buffers now that the song is known (the synth
  // defers them until its AudioContext exists — see synth.ts ensureGraph).
  trk.synth.setInstruments(trk.song.instruments);

  const root = el('div', 'trk-root');
  root.appendChild(styleEl());

  const head = el('div', 'trk-head');
  const back = el('button', 'btn', '← Emulator');
  back.addEventListener('click', () => {
    stopPlayback();
    trk.synth.dispose();
    const url = new URL(location.href);
    url.searchParams.delete('track');
    location.href = url.toString();
  });
  head.appendChild(back);
  head.appendChild(el('h1', '', '🎵 SNES Music Tracker'));
  root.appendChild(head);

  const statEl = el('div', 'trk-stat', 'ready — press ▶ Play to preview');

  // --- transport -----------------------------------------------------------
  const bar = el('div', 'panel');
  const row = el('div', 'row');
  const playBtn = el('button', 'btn primary', '▶ Play');
  playBtn.addEventListener('click', () => {
    if (trk.playing) stopPlayback();
    else void startPlayback();
  });
  const stopBtn = el('button', 'btn', '⏹ Stop');
  stopBtn.addEventListener('click', () => stopPlayback());
  const stepBtn = el('button', 'btn', '⏭ Step');
  stepBtn.addEventListener('click', () => void stepOnce());
  const loop = checkbox('♻ loop');
  loop.input.checked = trk.loop;
  loop.input.addEventListener('change', () => {
    trk.loop = loop.input.checked;
  });
  const tempoIn = numInput(trk.song.tempo, 999, 'rows per second (song speed)');
  tempoIn.addEventListener('change', () => {
    trk.song.tempo = num(tempoIn, trk.song.tempo, 1, 999);
    tempoIn.value = String(trk.song.tempo);
    scheduleSave();
  });
  row.appendChild(playBtn);
  row.appendChild(stopBtn);
  row.appendChild(stepBtn);
  row.appendChild(loop.lbl);
  row.appendChild(label('tempo', tempoIn));
  row.appendChild(statEl);
  bar.appendChild(row);
  bar.appendChild(
    el('div', 'muted',
      'An approximation of the SNES S-DSP — 8 sample voices (Ch 0–7), per-voice volume, echo + reverb. ' +
      'Not the real SPC700; see TRACKER.md.'),
  );
  root.appendChild(bar);

  // --- pattern grid ---------------------------------------------------------
  const gridPanel = el('div', 'panel');
  const gridTop = el('div', 'row');
  const patSel = el('select', '');
  patSel.title = 'pattern to edit';
  gridTop.appendChild(label('pattern', patSel));
  const addPatBtn = el('button', 'btn sm', '＋ Add pattern');
  addPatBtn.addEventListener('click', () => addPattern());
  gridTop.appendChild(addPatBtn);
  const nameIn = el('input', '');
  nameIn.type = 'text';
  nameIn.value = trk.song.name;
  nameIn.placeholder = 'song name';
  nameIn.addEventListener('change', () => {
    trk.song.name = nameIn.value.trim() || 'Untitled';
    nameIn.value = trk.song.name;
    scheduleSave();
  });
  gridTop.appendChild(label('name', nameIn));
  gridPanel.appendChild(gridTop);
  const gridWrap = el('div', 'trk-gridwrap');
  gridPanel.appendChild(gridWrap);
  root.appendChild(gridPanel);

  // --- brush + rack | song + files ------------------------------------------
  const cols = el('div', 'trk-cols');

  const brushPanel = el('div', 'panel');
  brushPanel.appendChild(el('h2', 'h2', 'Brush'));
  const brushRow = el('div', 'row');
  const noteIn = el('input', 'trk-note', noteName(trk.brushNote ?? 81));
  noteIn.placeholder = 'note';
  noteIn.title = 'note, e.g. A4, C#2, C (middle C), or -- for a rest';
  noteIn.addEventListener('change', () => {
    const p = parseNoteName(noteIn.value);
    if (p.kind === 'note') {
      trk.brushNote = p.note;
      trk.restChk.checked = false;
      noteIn.value = noteName(p.note);
    } else if (p.kind === 'rest') {
      trk.brushNote = null;
      trk.restChk.checked = true;
    } else {
      setStat(statEl, `“${noteIn.value}” is not a note — try A4, C#2, --`, true);
      noteIn.value = trk.brushNote === null ? '--' : noteName(trk.brushNote);
    }
  });
  brushRow.appendChild(noteIn);
  const upBtn = el('button', 'btn sm', '↑');
  upBtn.title = 'transpose brush note +1';
  upBtn.addEventListener('click', () => transpose(1));
  const dnBtn = el('button', 'btn sm', '↓');
  dnBtn.title = 'transpose brush note −1';
  dnBtn.addEventListener('click', () => transpose(-1));
  brushRow.appendChild(upBtn);
  brushRow.appendChild(dnBtn);
  const rest = checkbox('rest');
  rest.input.checked = trk.brushNote === null;
  rest.input.addEventListener('change', () => {
    if (rest.input.checked) {
      trk.brushNote = null;
      noteIn.value = '--';
    } else if (trk.brushNote === null) {
      trk.brushNote = 81;
      noteIn.value = noteName(81);
    }
  });
  brushRow.appendChild(rest.lbl);
  brushPanel.appendChild(brushRow);

  const instRow = el('div', 'row');
  const instSel = el('select', '');
  instSel.title = 'brush instrument';
  const volIn = el('input', '');
  volIn.type = 'range';
  volIn.min = '0';
  volIn.max = '15';
  volIn.value = String(trk.brushVol);
  const volLbl = el('span', 'muted', `vol ${trk.brushVol}`);
  volIn.addEventListener('input', () => {
    trk.brushVol = num(volIn, 12, 0, 15);
    volLbl.textContent = `vol ${trk.brushVol}`;
  });
  instRow.appendChild(label('instrument', instSel));
  instRow.appendChild(label('', volIn));
  instRow.appendChild(volLbl);
  brushPanel.appendChild(instRow);

  brushPanel.appendChild(el('h2', 'h2', 'Add instrument'));
  const addRow = el('div', 'row');
  for (const kind of PRESET_KINDS) {
    const b = el('button', 'btn sm', `＋ ${kind[0].toUpperCase()}${kind.slice(1)}`);
    b.title = `add a ${kind} sample to the rack`;
    b.addEventListener('click', () => addInstrument(kind));
    addRow.appendChild(b);
  }
  brushPanel.appendChild(addRow);
  brushPanel.appendChild(
    el('div', 'muted',
      'Instruments are PCM samples the software S-DSP plays, re-pitched per note ' +
      '(playbackRate = note freq ÷ base freq, clamped to 0.25×–4× like the S-DSP pitch law).'),
  );
  cols.appendChild(brushPanel);

  const songPanel = el('div', 'panel');
  songPanel.appendChild(el('h2', 'h2', 'Song order'));
  const orderList = el('div', 'row');
  songPanel.appendChild(orderList);
  const addOrdBtn = el('button', 'btn sm', '＋ Add order');
  addOrdBtn.title = 'append another order entry (the song plays this list, in order)';
  addOrdBtn.addEventListener('click', () => addOrder());
  songPanel.appendChild(addOrdBtn);
  songPanel.appendChild(el('div', 'muted', 'Each order plays its pattern top-to-bottom; playback continues at order #1 when it loops.'));

  songPanel.appendChild(el('h2', 'h2', 'Files'));
  const fileRow = el('div', 'row');
  const dlBtn = el('button', 'btn', '⬇ Download .snc');
  dlBtn.addEventListener('click', () => downloadSong());
  fileRow.appendChild(dlBtn);
  const fileEl = el('input', '');
  fileEl.type = 'file';
  fileEl.accept = '.snc,.json,application/json';
  const fileLbl = el('label', 'btn', '⬆ Load .snc');
  fileLbl.appendChild(fileEl);
  fileEl.addEventListener('change', async () => {
    const file = fileEl.files?.[0];
    fileEl.value = ''; // allow re-loading the same file
    if (!file) return;
    try {
      replaceSong(fromJSON(await file.text()));
      setStat(statEl, `loaded ${file.name}`);
    } catch (err) {
      setStat(statEl, `${file.name}: ${(err as Error).message}`, true);
    }
  });
  fileRow.appendChild(fileLbl);
  const resetBtn = el('button', 'btn sm', '↺ Reset demo');
  resetBtn.title = 'discard the current song and reload the built-in demo';
  resetBtn.addEventListener('click', () => {
    replaceSong(defaultSong());
    setStat(statEl, 'reset to the demo song');
  });
  fileRow.appendChild(resetBtn);
  songPanel.appendChild(fileRow);
  cols.appendChild(songPanel);

  root.appendChild(cols);
  container.appendChild(root);

  // Wire up the state object, then render every panel from it.
  Object.assign(trk, { statEl, playBtn, gridWrap, patSel, nameIn, noteIn, restChk: rest.input, instSel, volIn, volLbl, tempoIn, loopChk: loop.input, orderList, fileEl });

  patSel.addEventListener('change', () => {
    trk.pattern = Number(patSel.value) || 0;
    renderGrid();
  });

  renderPatSel();
  renderGrid();
  renderInstOptions();
  renderOrders();

  // All DOM refs are wired now — the agent controller may re-render/preview.
  trkMounted = true;
}

// --- agent controller (the trk_* tools dispatch against this) ---------------

/**
 * Re-render the mounted tracker after the agent edits the song (no-op when
 * the page is not on screen — the state itself is always updated, and the
 * page picks it up on its next mount).
 */
export function refreshTrack(): void {
  if (!trkMounted) return;
  renderPatSel();
  renderGrid();
  renderInstOptions();
  renderOrders();
}

/**
 * The `TrackController` the agent loop dispatches the `trk_*` tools against.
 *
 * It reads/writes the same persisted song the page edits
 * (`snes-web:track-song:v1`), so it works whether or not the tracker is
 * mounted, and re-renders the page when it happens to be on screen.
 *
 * `buildSpc` / `spcGlue` / `spcLayout` expose the EXPERIMENTAL in-ROM SPU
 * package from `src/spc/layout.ts`: `buildSpc()` is the Appendix D transfer
 * stream (driver + BRR sample + directory), `spcGlue(name)` the pure-8-bit
 * 65C816 loader that `.incbin`s it.
 */
export function makeTrackController(): TrackController {
  const st = trk;

  /** Write one cell, updating the grid in place when it's the shown pattern. */
  function applyCell(pattern: number, row: number, channel: number, cell: Cell): boolean {
    const pat = st.song.patterns[pattern];
    if (!pat || row < 0 || row >= pat.rows.length || channel < 0 || channel >= CHANNELS) return false;
    pat.rows[row][channel] = cell;
    if (st.pattern === pattern) {
      const b = gridCells[row]?.[channel];
      if (b) paintCellContent(b, pat.rows[row][channel]);
    }
    scheduleSave();
    return true;
  }

  return {
    getSong() {
      return toJSON(st.song);
    },

    setCell(pattern, row, channel, note, inst, vol) {
      return applyCell(pattern, row, channel, { note, inst, vol });
    },

    setPatternCells(pattern, cells) {
      const pat = st.song.patterns[pattern];
      if (!pat) return 0;
      let applied = 0;
      for (const c of cells) {
        if (c.row < 0 || c.row >= pat.rows.length || c.channel < 0 || c.channel >= CHANNELS) continue;
        pat.rows[c.row][c.channel] = { note: c.note, inst: c.inst, vol: c.vol };
        applied++;
      }
      if (applied > 0) {
        if (trkMounted && st.pattern === pattern) renderGrid();
        scheduleSave();
      }
      return applied;
    },

    setTempo(rowsPerSecond) {
      // Same range the page's own tempo input allows (num(…, 1, 999)).
      st.song.tempo = Math.round(Math.max(1, Math.min(999, rowsPerSecond)));
      if (trkMounted) st.tempoIn.value = String(st.song.tempo);
      scheduleSave();
    },

    setOrders(orders) {
      const n = st.song.patterns.length;
      const list = orders.filter((o) => Number.isInteger(o) && o >= 0 && o < n);
      if (list.length === 0) return; // never leave the song with no play order
      st.song.orders = list;
      if (trkMounted) renderOrders();
      scheduleSave();
    },

    addPattern() {
      const rows = st.song.patterns[0]?.rows.length ?? DEFAULT_ROWS;
      const idx = st.song.patterns.length;
      st.song.patterns.push(emptyPattern(rows));
      st.pattern = idx;
      if (trkMounted) {
        renderPatSel();
        renderGrid();
      }
      scheduleSave();
      return idx;
    },

    addInstrument(kind) {
      const k: PresetKind = (PRESET_KINDS as readonly string[]).includes(kind)
        ? (kind as PresetKind)
        : 'lead';
      const idx = st.song.instruments.length;
      st.song.instruments.push(makePresetInstrument(k));
      st.synth.setInstruments(st.song.instruments);
      st.brushInst = idx;
      if (trkMounted) renderInstOptions();
      scheduleSave();
      return idx;
    },

    preview() {
      if (!trkMounted) {
        return { ok: false, error: 'tracker page not mounted — open ?track=1 to audition the song' };
      }
      void startPlayback(); // resume() failures surface on the page's status line
      return { ok: true };
    },

    stop() {
      if (trkMounted) {
        stopPlayback();
      } else {
        // Page is gone but a preview may still be ringing; silence it.
        try {
          st.synth.stop();
        } catch {
          // no AudioContext — nothing to stop
        }
      }
      return { ok: true };
    },

    buildSpc() {
      return buildSpcPackage();
    },

    spcGlue(dataName) {
      return spcGlueSrc(dataName);
    },

    spcLayout() {
      return spcLayoutInfo();
    },
  };
}
