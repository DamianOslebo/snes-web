/**
 * The 🎨 Graphics page (`?gfx=1`) — two tools, one page:
 *
 *  1. **VRAM Inspector** (core-backed): load a ROM, run/step the core, and read
 *     back its 64 KB of PPU VRAM live — tiles decoded for a chosen background
 *     mode, the CG-RAM palette strip, and a hex dump of the first 4 KB.
 *  2. **Tile Editor** (core-free): paint 8×8 / 16×16 tiles, edit a 16-color
 *     palette, place a 32×32 tilemap — and download the result as a raw 64 KB
 *     SNES VRAM image (`.bin`) for your own project. No ROM, no 65C816.
 *
 * Mirrors `src/ui/assembler.ts` (the other standalone page): one
 * `mountGraphics(container)`, its own CSS, plain DOM, no framework.
 */

import { MODES, colorsForMode, depthForMode, sizeForMode } from '../gfx/tile-encode';
import { cgramOffset, rgb5to8, type Rgb15 } from '../gfx/palette';
import { MAP_ENTRIES, type TilemapEntry } from '../gfx/tilemap';
import { VRAM_SIZE, buildVram as buildVramImage, buildVramCompact, vramGlue as vramGlueGen, type BuildVramOptions } from '../gfx/vram';
import { OAM_ENTRIES, encodeOam, oamGlue, type OamEntry, type OamSize } from '../gfx/oam';
import { decodePalette, decodeTile } from '../gfx/decode';
import { toHexRows } from '../debug/memory-view';
import { looksLikeSnesRom } from '../core/rom-check';
import { createCore } from '../core/snes-core';
import type { GfxController } from '../agent/types';
import { loadState, saveState } from '../agent/state-store';
import {
  SNES_HEIGHT,
  SNES_WIDTH,
  SYSTEM_UNSUPPORTED,
  unsupportedCoprocessors,
  type SnesCore,
} from '../core/types';

// --- shared state ---------------------------------------------------------

interface InsState {
  core: SnesCore | null;
  vram: Uint8Array | null;
  mode: number;
  tileBase: number;
  first: number;
  count: number;
  palette: number;
  showHex: boolean;
  busy: boolean;
  runTimer: number | null;
  paintTimer: number | null;
  romName: string | null;
  statEl: HTMLElement;
  romNameEl: HTMLElement;
  runBtn: HTMLButtonElement;
  pauseBtn: HTMLButtonElement;
  stepBtn: HTMLButtonElement;
  fileEl: HTMLInputElement;
  modeEl: HTMLSelectElement;
  tileBaseEl: HTMLInputElement;
  firstEl: HTMLInputElement;
  countEl: HTMLInputElement;
  palEl: HTMLInputElement;
  hexChk: HTMLInputElement;
  tilesEl: HTMLElement;
  stripEl: HTMLElement;
  hexPanel: HTMLElement;
  hexBody: HTMLElement;
}

interface EdState {
  mode: number;
  tiles: number[][][];
  palette: Rgb15[];
  /**
   * The OBJ (sprite) palette — 16 colors, exported to CGRAM palette 8
   * (colors 128-143). Kept separate from `palette` (the background palette,
   * CGRAM palette 0) so sprites can be colored independently. In the agent's
   * flat `setPaletteColor` index space this is colors 16-31.
   */
  objPalette: Rgb15[];
  tileIdx: number;
  colIdx: number;
  paint: number;
  map: Array<TilemapEntry | null>;
  /** The SECOND (alt) tilemap — the runtime-switchable screen. Data-only; the editor pane paints the primary `map`. */
  mapAlt: Array<TilemapEntry | null>;
  mapBrush: TilemapEntry;
  eraseBrush: boolean;
  /**
   * The 128 OAM sprite slots (OBJ). `null` = hidden (off-screen). These are
   * independent of the tilemap — sprites sample the OBJ palette (colors
   * 16-31) and the char tiles directly by 9-bit index.
   */
  oam: Array<OamEntry | null>;
  /** Global sprite size — the ONE size every sprite in this ROM draws at (baked into OBJSEL on export). */
  oamSize: OamSize;
  /** Which OBJ palette color (flat index 16-31) the sprite-pane RGB sliders are editing. */
  objColIdx: number;
  /** Sprite-pane DOM refs (filled by buildSpritesPane before wiring). */
  spOamBody: HTMLElement;
  spObjPalEl: HTMLElement;
  spObjR: HTMLInputElement;
  spObjG: HTMLInputElement;
  spObjB: HTMLInputElement;
  spObjT: HTMLInputElement;
  spObjColLbl: HTMLElement;
  spSizeEl: HTMLSelectElement;
  spCount: HTMLElement;
  tileBase: number;
  paletteBase: number;
  mapBase: number;
  paintOn: boolean;
  mapPainting: boolean;
  lastErase: boolean;
  statEl: HTMLElement;
  modeEl: HTMLSelectElement;
  tileBaseEl: HTMLInputElement;
  palBaseEl: HTMLInputElement;
  mapBaseEl: HTMLInputElement;
  stripEl: HTMLElement;
  paintEl: HTMLCanvasElement;
  brushEl: HTMLElement;
  idxEl: HTMLInputElement;
  palEl: HTMLElement;
  rEl: HTMLInputElement;
  gEl: HTMLInputElement;
  bEl: HTMLInputElement;
  tEl: HTMLInputElement;
  colLbl: HTMLElement;
  mapEl: HTMLElement;
  brushTileEl: HTMLInputElement;
  flXEl: HTMLInputElement;
  flYEl: HTMLInputElement;
  priEl: HTMLInputElement;
  eraseEl: HTMLInputElement;
  previewEl: HTMLCanvasElement;
}

// Data-only initial state; buildInspectorPane (Object.assign) fills in the
// DOM element references before any control is wired up.
const ins = {
  core: null,
  vram: null,
  mode: 0,
  tileBase: 0,
  first: 0,
  count: 16,
  palette: 0,
  showHex: false,
  busy: false,
  runTimer: null,
  paintTimer: null,
  romName: null,
} as unknown as InsState;

// Data-only initial state; buildEditorPane (Object.assign) fills in the
// DOM element references before any control is wired up.
const ed = {
  mode: 0,
  tiles: [],
  palette: defaultPalette(),
  objPalette: defaultPalette(),
  oam: new Array<OamEntry | null>(OAM_ENTRIES).fill(null),
  oamSize: '16x16',
  objColIdx: 17,
  tileIdx: 0,
  colIdx: 0,
  paint: 1,
  map: new Array<TilemapEntry | null>(MAP_ENTRIES).fill(null),
  mapAlt: new Array<TilemapEntry | null>(MAP_ENTRIES).fill(null),
  mapBrush: { tile: 0, palette: 0, flipX: false, flipY: false, priority: false },
  eraseBrush: false,
  tileBase: 0,
  paletteBase: 0,
  mapBase: 0x8000, // $8000 — the usual SCBase, clear of char slots 0-1023
  paintOn: false,
  mapPainting: false,
  lastErase: false,
} as unknown as EdState;

// --- editor persistence (agent + page share the same canonical state) -----

const GFX_STORE_KEY = 'snes-web:gfx:v1';

/** The persisted editor content (the inspector/core-backed half is not saved). */
interface GfxStore {
  v: 1;
  mode: number;
  tiles: number[][][];
  palette: Rgb15[];
  /** Optional: the OBJ (sprite) palette, 16 colors. Absent in v1 stores predating sprites. */
  objPalette?: Rgb15[];
  /** Optional: the 128 OAM sprite slots (`null` = hidden). Absent in v1 stores predating sprites. */
  oam?: Array<OamEntry | null>;
  /** Optional: global sprite size ('8x8' | '16x16'). Absent in v1 stores predating sprites. */
  oamSize?: OamSize;
  map: Array<TilemapEntry | null>;
  /** Optional: the second (alt) tilemap. Absent in v1 stores predating the toggle feature. */
  mapAlt?: Array<TilemapEntry | null>;
  tileBase: number;
  paletteBase: number;
  mapBase: number;
}

const isGfxStore = (v: unknown): v is GfxStore => {
  const g = v as GfxStore | null;
  if (!g || g.v !== 1) return false;
  if (typeof g.mode !== 'number' || !Array.isArray(g.tiles)) return false;
  const valid16 = (a: unknown): boolean => {
    if (!Array.isArray(a) || a.length !== 16) return false;
    for (const c of a) {
      if (typeof c?.r !== 'number' || typeof c.g !== 'number' ||
          typeof c.b !== 'number' || typeof c.transparent !== 'boolean') return false;
    }
    return true;
  };
  if (!valid16(g.palette)) return false;
  if (g.objPalette !== undefined && !valid16(g.objPalette)) return false;
  if (g.oam !== undefined) {
    if (!Array.isArray(g.oam) || g.oam.length !== OAM_ENTRIES) return false;
    for (const e of g.oam) {
      if (e === null) continue; // hidden slot
      if (typeof e?.tile !== 'number' || typeof e.x !== 'number' || typeof e.y !== 'number') return false;
    }
  }
  if (!Array.isArray(g.map) || g.map.length !== MAP_ENTRIES) return false;
  if (g.mapAlt !== undefined && (!Array.isArray(g.mapAlt) || g.mapAlt.length !== MAP_ENTRIES)) return false;
  return typeof g.tileBase === 'number' && typeof g.paletteBase === 'number' && typeof g.mapBase === 'number';
};

let gfxStateReady = false;
let gfxPersistTimer = 0;
let gfxMounted = false; // true once mountGraphics has wired the editor DOM

/**
 * Apply the persisted editor state to the `ed` singleton (once per page load).
 * Both `mountGraphics` and the agent controller rely on this, so the agent
 * sees the user's saved artwork even when it drives graphics from another
 * page (where the module defaults would otherwise be in force).
 */
function ensureGfxState(): void {
  if (gfxStateReady) return;
  gfxStateReady = true;
  const { value } = loadState<GfxStore>(
    localStorage,
    GFX_STORE_KEY,
    isGfxStore,
    {
      v: 1,
      mode: 0,
      tiles: [],
      palette: defaultPalette(),
      map: new Array<TilemapEntry | null>(MAP_ENTRIES).fill(null),
      tileBase: 0,
      paletteBase: 0,
      mapBase: 0x8000,
    },
  );
  ed.mode = value.mode;
  ed.tiles = value.tiles.length ? value.tiles : [blankTile()];
  ed.palette = value.palette;
  // Optional in the store; fall back to the default OBJ palette (v1 predates sprites).
  ed.objPalette = value.objPalette && value.objPalette.length === 16
    ? value.objPalette
    : defaultPalette();
  // Optional in the store; fall back to all-hidden slots (v1 predates sprites).
  ed.oam = value.oam && value.oam.length === OAM_ENTRIES
    ? value.oam
    : new Array<OamEntry | null>(OAM_ENTRIES).fill(null);
  ed.oamSize = value.oamSize === '8x8' ? '8x8' : '16x16';
  ed.map = value.map;
  // Optional in the store; fall back to a blank alt map (v1 predates the toggle).
  ed.mapAlt = value.mapAlt && value.mapAlt.length === MAP_ENTRIES
    ? value.mapAlt
    : new Array<TilemapEntry | null>(MAP_ENTRIES).fill(null);
  ed.tileBase = value.tileBase;
  ed.paletteBase = value.paletteBase;
  ed.mapBase = value.mapBase;
}

function gfxPersist(): void {
  const value: GfxStore = {
    v: 1,
    mode: ed.mode,
    tiles: ed.tiles,
    palette: ed.palette,
    objPalette: ed.objPalette,
    oam: ed.oam,
    oamSize: ed.oamSize,
    map: ed.map,
    mapAlt: ed.mapAlt,
    tileBase: ed.tileBase,
    paletteBase: ed.paletteBase,
    mapBase: ed.mapBase,
  };
  saveState(localStorage, GFX_STORE_KEY, value);
}

/** Debounced (300 ms) — paint/map drags call this on every pointer event. */
function scheduleGfxPersist(): void {
  window.clearTimeout(gfxPersistTimer);
  gfxPersistTimer = window.setTimeout(gfxPersist, 300);
}

// --- small helpers --------------------------------------------------------

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function mkCanvas(w: number, h: number, cssSize?: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  if (cssSize) {
    c.style.width = `${cssSize}px`;
    c.style.height = `${cssSize}px`;
  }
  return c;
}

function setStat(stat: HTMLElement, text: string, isErr = false): void {
  stat.textContent = text;
  stat.className = `gfx-stat${isErr ? ' err' : ''}`.trim();
}

function cssColor(c: Rgb15): string {
  return `rgb(${rgb5to8(c.r)},${rgb5to8(c.g)},${rgb5to8(c.b)})`;
}

/** Draw a 4-px checkerboard (stands in for transparent pixels). */
function checker(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const cell = 4;
  for (let y = 0; y < h; y += cell) {
    for (let x = 0; x < w; x += cell) {
      ctx.fillStyle = ((x / cell + y / cell) & 1) ? '#3a3a42' : '#2c2c33';
      ctx.fillRect(x, y, cell, cell);
    }
  }
}

/** Clamp a number input to [lo, hi], falling back when non-numeric. */
function num(inp: HTMLInputElement, fb: number, lo: number, hi: number): number {
  const v = parseInt(inp.value, 10);
  if (!Number.isFinite(v)) return fb;
  return Math.max(lo, Math.min(hi, v));
}

function defaultPalette(): Rgb15[] {
  const out: Rgb15[] = [];
  for (let i = 0; i < 16; i++) {
    const v = Math.round((i / 15) * 31);
    out.push(i === 0 ? { r: 0, g: 0, b: 0, transparent: true } : { r: v, g: v, b: v, transparent: false });
  }
  return out;
}

function blankTile(): number[][] {
  const size = sizeForMode(ed.mode);
  return Array.from({ length: size }, () => new Array<number>(size).fill(0));
}

function blankEntry(): TilemapEntry {
  return { tile: 0, palette: 0, flipX: false, flipY: false, priority: false };
}

// --- page shell -----------------------------------------------------------

const CSS = `
.gfx-root{color-scheme:dark;background:#0d0d10;color:#e8e8ea;min-height:100vh;font:14px/1.5 ui-sans-serif,system-ui,sans-serif;padding:20px;max-width:1280px;margin:0 auto;display:flex;flex-direction:column;gap:14px;box-sizing:border-box}
.gfx-root *,.gfx-root *::before,.gfx-root *::after{box-sizing:border-box}
.gfx-head{display:flex;align-items:center;gap:12px}
.gfx-head h1{font-size:18px;margin:0;font-weight:600}
.btn{background:#1c1c22;color:#e8e8ea;border:1px solid #33333c;border-radius:6px;padding:5px 12px;cursor:pointer;font:inherit}
.btn:hover{border-color:#4a4a55}
.btn:disabled{opacity:.4;cursor:default}
.btn.primary{background:#1d3350;border-color:#2b4a70}
label.btn{cursor:pointer}
.gfx-stat{font:12px ui-monospace,SFMono-Regular,Menlo,monospace;color:#9fd0ff}
.gfx-stat.err{color:#ff8a8a}
.muted{color:#6a6a75;font-size:12px}
.panel{background:#141418;border:1px solid #2a2a30;border-radius:8px;padding:14px;display:flex;flex-direction:column;gap:12px}
.row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.row label{display:inline-flex;align-items:center;gap:6px;font-size:13px;color:#b8b8c0}
select,input[type=number]{background:#1c1c22;color:#e8e8ea;border:1px solid #33333c;border-radius:6px;padding:4px 8px;font:inherit}
input[type=number]{width:84px}
.tabs{display:flex;gap:8px}
.tab{background:#1c1c22;border:1px solid #33333c;color:#b8b8c0;border-radius:999px;padding:6px 16px;cursor:pointer;font:inherit}
.tab.active{background:#1d3350;border-color:#2b4a70;color:#fff}
.tiles{display:grid;grid-template-columns:repeat(auto-fill,76px);gap:10px}
.tile-cell{background:#1c1c22;border:1px solid #2a2a30;border-radius:6px;padding:4px}
.tile-cell canvas{display:block;image-rendering:pixelated}
.swatch{width:18px;height:18px;border:1px solid #3a3a44;border-radius:3px;display:inline-block}
.swatch.t{background:repeating-linear-gradient(45deg,#2a2a30 0 3px,#1c1c22 3px 6px)}
.strip{display:flex;gap:4px;align-items:center;flex-wrap:wrap}
.strip .swatch{cursor:pointer}
.strip .swatch.sel{outline:2px solid #9fd0ff}
pre.hex{font:11px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;color:#8a8a94;background:#101014;border:1px solid #2a2a30;border-radius:6px;padding:10px;max-height:320px;overflow:auto;white-space:pre;margin:0}
.ed-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px;align-items:start}
.ed-col{display:flex;flex-direction:column;gap:12px;min-width:0}
.tilestrip{display:flex;gap:6px;flex-wrap:wrap;max-height:132px;overflow:auto;padding:2px}
.thumb{background:#141418;border:1px solid #2a2a30;border-radius:6px;padding:3px;cursor:pointer}
.thumb.sel{border-color:#9fd0ff}
.thumb canvas{display:block;image-rendering:pixelated}
.paintwrap canvas{image-rendering:pixelated;background:#2c2c33;border:1px solid #2a2a30;border-radius:4px;touch-action:none;cursor:crosshair}
.palswatch{width:26px;height:26px;border:1px solid #3a3a44;border-radius:4px;cursor:pointer;padding:0}
.palswatch.t{background:repeating-linear-gradient(45deg,#2a2a30 0 4px,#1c1c22 4px 8px)}
.palswatch.sel{outline:2px solid #9fd0ff}
.palgrid{display:grid;grid-template-columns:repeat(8,28px);gap:5px}
.sp-section{display:flex;flex-direction:column;gap:10px}
.sp-section h3{margin:0;font-size:13px;font-weight:600;color:#b8b8c0;text-transform:uppercase;letter-spacing:.04em}
.oam-wrap{max-height:420px;overflow:auto;border:1px solid #2a2a30;border-radius:6px;background:#101014}
table.oam-tbl{border-collapse:collapse;width:100%;font:12px ui-monospace,SFMono-Regular,Menlo,monospace}
.oam-tbl th,.oam-tbl td{padding:3px 6px;text-align:left;border-bottom:1px solid #22222a;white-space:nowrap}
.oam-tbl th{position:sticky;top:0;background:#1c1c22;color:#8a8a94;font-weight:600;z-index:1}
.oam-tbl td input[type=number]{width:64px;padding:2px 5px;font:inherit}
.oam-tbl td input[type=checkbox]{accent-color:#4a7ab5}
.oam-tbl tr.sel td{background:#16233a}
.oam-tbl tr.off td{color:#5a5a64}
.sp-stat{font:12px ui-monospace,SFMono-Regular,Menlo,monospace;color:#9fd0ff}
.mapgrid{display:grid;grid-template-columns:repeat(32,12px);gap:1px;background:#2a2a30;padding:1px;border-radius:4px;width:max-content;max-width:100%;overflow:auto}
.mapcell{width:12px;height:12px;background:#1a1a1f}
.mapcell:hover{outline:1px solid #9fd0ff}
.preview canvas{image-rendering:pixelated;background:#000;border:1px solid #2a2a30}
input[type=range]{accent-color:#4a7ab5}
input[type=checkbox]{accent-color:#4a7ab5}
@media (max-width:900px){.ed-grid{grid-template-columns:1fr}}
`;

function styleEl(): HTMLStyleElement {
  const s = document.createElement('style');
  s.textContent = CSS;
  return s;
}

/** Mount the whole 🎨 Graphics page into `container` (see `main.ts` `?gfx=1`). */
export function mountGraphics(container: HTMLElement): void {
  document.title = 'SNES Graphics — SNES Web';
  container.innerHTML = '';

  // Pick up the user's saved artwork (or the agent's, if it edited from
  // another page) before the editor pane is built from `ed`.
  ensureGfxState();

  const root = el('div', 'gfx-root');
  root.appendChild(styleEl());

  const head = el('div', 'gfx-head');
  const back = el('button', 'btn', '← Emulator');
  back.addEventListener('click', () => {
    const url = new URL(location.href);
    url.searchParams.delete('gfx');
    location.href = url.toString();
  });
  head.appendChild(back);
  head.appendChild(el('h1', '', '🎨 SNES Graphics'));
  root.appendChild(head);

  const tabs = el('nav', 'tabs');
  const insTab = el('button', 'tab active', '🔍 VRAM Inspector');
  const edTab = el('button', 'tab', '🖌 Tile Editor');
  const spTab = el('button', 'tab', '🎯 Sprites (OAM)');
  tabs.appendChild(insTab);
  tabs.appendChild(edTab);
  tabs.appendChild(spTab);
  root.appendChild(tabs);

  const insPane = buildInspectorPane();
  const edPane = buildEditorPane();
  const spPane = buildSpritesPane();
  edPane.hidden = true;
  spPane.hidden = true;
  root.appendChild(insPane);
  root.appendChild(edPane);
  root.appendChild(spPane);

  const panes: HTMLElement[] = [insPane, edPane, spPane];
  const tabEls = [insTab, edTab, spTab];
  const show = (pane: HTMLElement): void => {
    for (const p of panes) p.hidden = p !== pane;
    for (let i = 0; i < panes.length; i++) tabEls[i].classList.toggle('active', panes[i] === pane);
  };
  insTab.addEventListener('click', () => show(insPane));
  edTab.addEventListener('click', () => show(edPane));
  spTab.addEventListener('click', () => show(spPane));

  // Release paint/map drags wherever the pointer comes up.
  window.addEventListener('pointerup', () => {
    ed.paintOn = false;
    ed.mapPainting = false;
  });

  container.appendChild(root);

  // The editor's DOM is fully wired now — the agent controller may re-render.
  gfxMounted = true;

  // If the wasm build is missing (or ?mock=1) createCore() degrades to the
  // mock, whose seeded VRAM makes the Inspector demoable without emsdk.
  void ensureCore().then((core) => {
    if (core.isMock && ins.vram === null) {
      ins.vram = core.readVram();
      renderInspector();
      setStat(ins.statEl, 'mock core — showing its seeded demo VRAM; load a ROM to read a real one');
    }
  });
}

// --- Inspector tab (core-backed) -----------------------------------------

function modeOptions(selected: number): HTMLSelectElement {
  const sel = el('select', '');
  for (const m of MODES) {
    const o = document.createElement('option');
    o.value = String(m.mode);
    o.textContent = `${m.mode} — ${m.size}×${m.size} ${m.depth}bpp`;
    if (m.mode === selected) o.selected = true;
    sel.appendChild(o);
  }
  return sel;
}

function buildInspectorPane(): HTMLElement {
  const pane = el('div', 'panel');

  // Toolbar: ROM + transport + refresh.
  const bar = el('div', 'row');
  const fileWrap = el('label', 'btn');
  const file = el('input', '');
  file.type = 'file';
  file.accept = '.sfc,.smc,.fig,.bin,.zip';
  file.hidden = true;
  file.addEventListener('change', () => {
    const f = file.files?.[0];
    if (f) void loadRomFile(f);
    file.value = '';
  });
  fileWrap.appendChild(el('span', '', '📼 Load ROM'));
  fileWrap.appendChild(file);
  const runBtn = el('button', 'btn', '▶ Run');
  const pauseBtn = el('button', 'btn', '⏸ Pause');
  const stepBtn = el('button', 'btn', '⏭ Step');
  runBtn.disabled = pauseBtn.disabled = stepBtn.disabled = true;
  const refreshBtn = el('button', 'btn primary', '⟳ Refresh VRAM');
  const stat = el('span', 'gfx-stat', 'load a ROM — or open this page with ?mock=1 for the seeded demo');
  bar.appendChild(fileWrap);
  bar.appendChild(runBtn);
  bar.appendChild(pauseBtn);
  bar.appendChild(stepBtn);
  bar.appendChild(refreshBtn);
  bar.appendChild(stat);
  pane.appendChild(bar);

  // Controls: mode / bases / palette / hex.
  const ctr = el('div', 'row');
  const modeEl = modeOptions(0);
  const tileBaseEl = numInput(0, 2047, 'tile base (char slot)');
  const firstEl = numInput(0, 1023, 'first tile');
  const countEl = numInput(16, 256, 'tiles to show');
  const palEl = numInput(0, 255, 'CGRAM palette (2/4bpp)');
  const hexChk = el('input', '');
  hexChk.type = 'checkbox';
  const hexLbl = el('label', '', 'hex dump');
  hexLbl.appendChild(hexChk);
  const romNameEl = el('span', 'muted', '');
  ctr.appendChild(label('mode', modeEl));
  ctr.appendChild(label('tile base', tileBaseEl));
  ctr.appendChild(label('first tile', firstEl));
  ctr.appendChild(label('count', countEl));
  ctr.appendChild(label('palette', palEl));
  ctr.appendChild(hexLbl);
  ctr.appendChild(romNameEl);
  pane.appendChild(ctr);

  const tilesEl = el('div', 'tiles');
  pane.appendChild(tilesEl);

  const palRow = el('div', 'row');
  const palLbl = el('span', 'muted', `palette @ $${cgramOffset(0).toString(16)}`);
  palRow.appendChild(palLbl);
  const stripEl = el('div', 'strip');
  palRow.appendChild(stripEl);
  pane.appendChild(palRow);

  const hexPanel = el('div', '');
  hexPanel.hidden = true;
  hexPanel.appendChild(el('div', 'row', 'first 4 KB of VRAM (tile graphics region at their char-slot base)'));
  const hexBody = el('pre', 'hex');
  hexPanel.appendChild(hexBody);
  pane.appendChild(hexPanel);

  // Wire state to elements.
  Object.assign(ins, {
    statEl: stat, romNameEl, runBtn, pauseBtn, stepBtn, fileEl: file,
    modeEl, tileBaseEl, firstEl, countEl, palEl, hexChk,
    tilesEl, stripEl, hexPanel, hexBody,
  });

  const repaint = (): void => { if (ins.vram) renderInspector(); };
  modeEl.addEventListener('change', () => { ins.mode = +modeEl.value; repaint(); });
  tileBaseEl.addEventListener('change', () => { ins.tileBase = num(tileBaseEl, 0, 0, 2047); repaint(); });
  firstEl.addEventListener('change', () => { ins.first = num(firstEl, 0, 0, 1023); repaint(); });
  countEl.addEventListener('change', () => { ins.count = num(countEl, 16, 1, 256); repaint(); });
  palEl.addEventListener('change', () => {
    ins.palette = num(palEl, 0, 0, 255);
    palLbl.textContent = `palette @ $${cgramOffset(ins.palette).toString(16).padStart(4, '0')}`;
    repaint();
  });
  hexChk.addEventListener('change', () => { ins.showHex = hexChk.checked; renderHex(); });

  runBtn.addEventListener('click', () => runCore());
  pauseBtn.addEventListener('click', () => pauseCore());
  stepBtn.addEventListener('click', () => { ins.core?.frame(); void refreshVram(); });
  refreshBtn.addEventListener('click', () => void refreshVram());

  return pane;
}

/** `<label>` wrapper pairing a caption with a control. */
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

async function ensureCore(): Promise<SnesCore> {
  ins.core ??= await createCore();
  return ins.core;
}

async function loadRomFile(file: File): Promise<void> {
  if (ins.busy) return;
  ins.busy = true;
  try {
    const rom = new Uint8Array(await file.arrayBuffer());
    if (!looksLikeSnesRom(rom)) {
      setStat(ins.statEl, `'${file.name}' doesn't look like an SNES ROM (no $8000 reset vector at $7FC0/$7FFC)`, true);
      return;
    }
    const core = await ensureCore();
    await core.loadRom(rom);
    const sys = core.system();
    if (sys & SYSTEM_UNSUPPORTED) {
      setStat(ins.statEl, `warning: needs ${unsupportedCoprocessors(sys).join(', ')} — VRAM may be incomplete`, true);
    } else {
      setStat(ins.statEl, `loaded ${file.name} on ${core.isMock ? 'mock core' : 'wasm core'} — running; pause to hold a frame`);
    }
    ins.romName = file.name;
    ins.romNameEl.textContent = file.name;
    ins.runBtn.disabled = false;
    ins.stepBtn.disabled = false;
    ins.pauseBtn.disabled = true;
    await refreshVram();
    runCore();
  } catch (err) {
    setStat(ins.statEl, (err as Error).message, true);
  } finally {
    ins.busy = false;
  }
}

function runCore(): void {
  if (!ins.core || ins.runTimer !== null) return;
  const core = ins.core;
  ins.runTimer = window.setInterval(() => core.frame(), 1000 / 60);
  ins.paintTimer = window.setInterval(() => { void refreshVram(); }, 250);
  ins.runBtn.disabled = true;
  ins.pauseBtn.disabled = false;
}

function pauseCore(): void {
  if (ins.runTimer !== null) { window.clearInterval(ins.runTimer); ins.runTimer = null; }
  if (ins.paintTimer !== null) { window.clearInterval(ins.paintTimer); ins.paintTimer = null; }
  ins.runBtn.disabled = ins.core === null;
  ins.pauseBtn.disabled = true;
}

async function refreshVram(): Promise<void> {
  const core = ins.core;
  if (!core) { setStat(ins.statEl, 'load a ROM first', true); return; }
  if (!core.ready) { setStat(ins.statEl, 'core not ready yet', true); return; }
  ins.vram = core.readVram();
  renderInspector();
  if (ins.runTimer === null) setStat(ins.statEl, `VRAM read: ${ins.vram.length} bytes`);
}

/** Resolve one pixel index to a color per the mode's depth (8bpp: index encodes its own palette). */
function colorFor(vram: Uint8Array, mode: number, palette: number, idx: number): Rgb15 {
  let pal = palette;
  if (depthForMode(mode) === 8) pal = idx >> 4;
  try {
    const colors = decodePalette(vram, pal);
    const c = colors[idx & 15];
    if (c) return c;
  } catch { /* palette out of range -> transparent below */ }
  return { r: 0, g: 0, b: 0, transparent: true };
}

function renderInspector(): void {
  const grid = ins.tilesEl;
  grid.innerHTML = '';
  if (!ins.vram) {
    grid.appendChild(el('div', 'muted', 'no VRAM yet — load a ROM and refresh'));
    ins.stripEl.innerHTML = '';
    renderHex();
    return;
  }
  const size = sizeForMode(ins.mode);
  for (let i = 0; i < ins.count; i++) {
    const idx = ins.first + i;
    const c = mkCanvas(size, size, 64);
    const ctx = c.getContext('2d');
    if (ctx) {
      checker(ctx, size, size);
      let px: number[][] = [];
      try {
        px = decodeTile(ins.vram, ins.mode, idx, ins.tileBase);
      } catch {
        ctx.fillStyle = '#5a2a2a';
        ctx.fillRect(0, 0, size, size);
      }
      for (let r = 0; r < size; r++) {
        for (let col = 0; col < size; col++) {
          const c15 = colorFor(ins.vram, ins.mode, ins.palette, px[r][col] ?? 0);
          if (!c15.transparent) {
            ctx.fillStyle = cssColor(c15);
            ctx.fillRect(col, r, 1, 1);
          }
        }
      }
    }
    const cell = el('div', 'tile-cell');
    cell.title = `tile ${idx}`;
    cell.appendChild(c);
    grid.appendChild(cell);
  }
  renderPaletteStrip();
  renderHex();
}

function renderPaletteStrip(): void {
  const strip = ins.stripEl;
  strip.innerHTML = '';
  if (!ins.vram) return;
  let colors: Rgb15[] = [];
  try {
    colors = decodePalette(ins.vram, ins.palette);
  } catch { /* out of range -> empty strip */ }
  for (let i = 0; i < 16; i++) {
    const c = colors[i];
    const s = el('div', 'swatch' + (c && c.transparent ? ' t' : ''));
    if (c && !c.transparent) s.style.background = cssColor(c);
    s.title = c ? `${i}: ${c.transparent ? 'transparent' : `${c.r},${c.g},${c.b}`}` : `${i}: (unmapped)`;
    strip.appendChild(s);
  }
}

function renderHex(): void {
  ins.hexPanel.hidden = !ins.showHex;
  if (!ins.showHex) return;
  if (!ins.vram) { ins.hexBody.textContent = '(no VRAM)'; return; }
  const rows = toHexRows(ins.vram.subarray(0, 0x1000), 0);
  ins.hexBody.textContent = rows
    .map((r) => `${r.addr.toString(16).padStart(4, '0')}  ${r.hex.join(' ')}  ${r.ascii}`)
    .join('\n');
}

// --- Editor tab (core-free) ----------------------------------------------

/** Range input 0-31 (one 5-bit channel of the palette editor). */
function rangeEl(title: string): HTMLInputElement {
  const i = el('input', '');
  i.type = 'range';
  i.min = '0';
  i.max = '31';
  i.value = '0';
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

function buildEditorPane(): HTMLElement {
  if (ed.tiles.length === 0) ed.tiles.push(blankTile());

  const pane = el('div', 'panel');

  // Toolbar: mode / bases / tile ops / download.
  const bar = el('div', 'row');
  const modeEl = modeOptions(ed.mode);
  const tileBaseEl = numInput(0, 2047, 'char slot for tile 0');
  const palBaseEl = numInput(0, 255, 'CGRAM palette index for palette 0');
  const mapBaseEl = numInput(0x8000, 0xf800, 'tilemap (SC0) byte base in VRAM');
  const addBtn = el('button', 'btn', '+ tile');
  const delBtn = el('button', 'btn', '− tile');
  const clearBtn = el('button', 'btn', 'clear tile');
  const dlBtn = el('button', 'btn primary', '⬇ Download VRAM .bin');
  const size0 = sizeForMode(ed.mode);
  const stat = el('span', 'gfx-stat', `mode ${ed.mode} — ${size0}×${size0} ${depthForMode(ed.mode)}bpp`);
  bar.appendChild(label('mode', modeEl));
  bar.appendChild(label('tile base', tileBaseEl));
  bar.appendChild(label('pal base', palBaseEl));
  bar.appendChild(label('map base', mapBaseEl));
  bar.appendChild(addBtn);
  bar.appendChild(delBtn);
  bar.appendChild(clearBtn);
  bar.appendChild(dlBtn);
  bar.appendChild(stat);
  pane.appendChild(bar);

  const grid = el('div', 'ed-grid');
  const left = el('div', 'ed-col');
  const right = el('div', 'ed-col');
  grid.appendChild(left);
  grid.appendChild(right);
  pane.appendChild(grid);

  // --- left column: tile list, paint grid, brush, palette editor ----------
  const stripEl = el('div', 'tilestrip');
  left.appendChild(stripEl);

  const paintWrap = el('div', 'paintwrap');
  const paint = mkCanvas(size0, size0, 160);
  paintWrap.appendChild(paint);
  left.appendChild(paintWrap);

  const brushRow = el('div', 'row');
  brushRow.appendChild(el('span', 'muted', 'brush'));
  const brushEl = el('div', 'strip');
  brushRow.appendChild(brushEl);
  const idxEl = numInput(1, 15, 'brush color index (0 = transparent)');
  brushRow.appendChild(label('idx', idxEl));
  brushRow.appendChild(el('span', 'muted', '· right-click paints transparent'));
  left.appendChild(brushRow);

  const palRow = el('div', 'row');
  const colLbl = el('span', 'muted', '0');
  palRow.appendChild(colLbl);
  const rEl = rangeEl('red (0-31)');
  const gEl = rangeEl('green (0-31)');
  const bEl = rangeEl('blue (0-31)');
  palRow.appendChild(label('R', rEl));
  palRow.appendChild(label('G', gEl));
  palRow.appendChild(label('B', bEl));
  const t = checkbox('T');
  palRow.appendChild(t.lbl);
  const resetPalBtn = el('button', 'btn', 'reset palette');
  palRow.appendChild(resetPalBtn);
  left.appendChild(palRow);

  const palEl = el('div', 'palgrid');
  left.appendChild(palEl);

  // --- right column: map brush, 32×32 map, preview ------------------------
  const mbRow = el('div', 'row');
  const brushTileEl = numInput(0, Math.max(0, ed.tiles.length - 1), 'map brush tile number');
  const flX = checkbox('H-flip');
  const flY = checkbox('V-flip');
  const pri = checkbox('priority');
  const erase = checkbox('erase brush');
  mbRow.appendChild(label('tile', brushTileEl));
  mbRow.appendChild(flX.lbl);
  mbRow.appendChild(flY.lbl);
  mbRow.appendChild(pri.lbl);
  mbRow.appendChild(erase.lbl);
  mbRow.appendChild(el('span', 'muted', '· right-click a cell to clear it'));
  right.appendChild(mbRow);

  const mapEl = el('div', 'mapgrid');
  for (let i = 0; i < MAP_ENTRIES; i++) {
    const cell = el('div', 'mapcell');
    const idx = i;
    cell.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      const doErase = ev.button === 2 || ed.eraseBrush;
      ed.mapPainting = true;
      ed.lastErase = doErase;
      placeMap(idx, doErase);
    });
    cell.addEventListener('pointerenter', () => {
      if (ed.mapPainting) placeMap(idx, ed.lastErase);
    });
    cell.addEventListener('contextmenu', (ev) => ev.preventDefault());
    mapEl.appendChild(cell);
  }
  right.appendChild(mapEl);

  const prev = el('div', 'preview');
  const previewEl = mkCanvas(SNES_WIDTH, SNES_HEIGHT);
  prev.appendChild(previewEl);
  right.appendChild(prev);

  Object.assign(ed, {
    statEl: stat, modeEl, tileBaseEl, palBaseEl, mapBaseEl,
    stripEl, paintEl: paint, brushEl, idxEl, palEl,
    rEl, gEl, bEl, tEl: t.input, colLbl,
    mapEl, brushTileEl, flXEl: flX.input, flYEl: flY.input, priEl: pri.input, eraseEl: erase.input,
    previewEl,
  });

  // Mode change: new geometry invalidates tiles/brush/map — reset them.
  modeEl.addEventListener('change', () => {
    ed.mode = +modeEl.value;
    const s = sizeForMode(ed.mode);
    ed.tiles = [blankTile()];
    ed.tileIdx = 0;
    ed.paint = Math.min(ed.paint, colorsForMode(ed.mode) - 1);
    ed.map = new Array<TilemapEntry | null>(MAP_ENTRIES).fill(null);
    ed.paintEl.width = s;
    ed.paintEl.height = s;
    ed.brushTileEl.max = String(Math.max(0, ed.tiles.length - 1));
    rebuildAll();
    scheduleGfxPersist();
    setStat(ed.statEl, `mode ${ed.mode} — ${s}×${s} ${depthForMode(ed.mode)}bpp`);
  });

  tileBaseEl.addEventListener('change', () => { ed.tileBase = num(tileBaseEl, 0, 0, 2047); scheduleGfxPersist(); });
  palBaseEl.addEventListener('change', () => { ed.paletteBase = num(palBaseEl, 0, 0, 255); scheduleGfxPersist(); });
  mapBaseEl.addEventListener('change', () => { ed.mapBase = num(mapBaseEl, 0x8000, 0, 0xf800); scheduleGfxPersist(); });
  addBtn.addEventListener('click', () => addTile());
  delBtn.addEventListener('click', () => delTile());
  clearBtn.addEventListener('click', () => {
    for (const row of ed.tiles[ed.tileIdx]) row.fill(0);
    drawPaint();
    rebuildStrip();
    renderPreview();
    scheduleGfxPersist();
  });
  dlBtn.addEventListener('click', () => download());
  resetPalBtn.addEventListener('click', () => {
    ed.palette = defaultPalette();
    refreshPalette();
    setStat(ed.statEl, 'palette reset');
  });

  brushTileEl.addEventListener('change', () => {
    ed.mapBrush.tile = num(brushTileEl, 0, 0, Math.max(0, ed.tiles.length - 1));
  });
  flX.input.addEventListener('change', () => { ed.mapBrush.flipX = flX.input.checked; });
  flY.input.addEventListener('change', () => { ed.mapBrush.flipY = flY.input.checked; });
  pri.input.addEventListener('change', () => { ed.mapBrush.priority = pri.input.checked; });
  erase.input.addEventListener('change', () => { ed.eraseBrush = erase.input.checked; });

  // Paint canvas: left-click paints the brush, right-click erases.
  paint.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    paint.setPointerCapture(ev.pointerId);
    ed.paintOn = true;
    ed.lastErase = ev.button === 2;
    paintAt(ev.clientX, ev.clientY, ed.lastErase);
  });
  paint.addEventListener('pointermove', (ev) => {
    if (ed.paintOn) paintAt(ev.clientX, ev.clientY, ed.lastErase);
  });
  paint.addEventListener('pointerup', () => { ed.paintOn = false; rebuildStrip(); });
  paint.addEventListener('contextmenu', (ev) => ev.preventDefault());

  // Palette sliders + T flag.
  rEl.addEventListener('input', () => { ed.palette[ed.colIdx].r = +rEl.value; refreshPalette(); });
  gEl.addEventListener('input', () => { ed.palette[ed.colIdx].g = +gEl.value; refreshPalette(); });
  bEl.addEventListener('input', () => { ed.palette[ed.colIdx].b = +bEl.value; refreshPalette(); });
  t.input.addEventListener('change', () => { ed.palette[ed.colIdx].transparent = t.input.checked; refreshPalette(); });

  rebuildAll();
  return pane;
}

/** Redraw every editor surface from the current state (called after resets). */
function rebuildAll(): void {
  rebuildStrip();
  drawPaint();
  rebuildBrush();
  rebuildPal();
  paintMapAll();
  renderPreview();
  // The sprite pane is built after the editor pane, so it may not exist yet.
  if (ed.spOamBody) rebuildSprites();
}

/** Translate a client-space pointer position into a pixel and paint it. */
function paintAt(cx: number, cy: number, erase: boolean): void {
  const rect = ed.paintEl.getBoundingClientRect();
  const size = ed.paintEl.width;
  const x = Math.floor(((cx - rect.left) / rect.width) * size);
  const y = Math.floor(((cy - rect.top) / rect.height) * size);
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  const tile = ed.tiles[ed.tileIdx];
  if (!tile || !tile[y]) return;
  tile[y][x] = erase ? 0 : ed.paint;
  scheduleGfxPersist();
  drawPaint();
  renderPreview();
}

/** Paint one tile into a canvas: checkerboard + opaque palette pixels. */
function drawTileInto(c: HTMLCanvasElement, tile: number[][]): void {
  const ctx = c.getContext('2d');
  if (!ctx) return;
  checker(ctx, c.width, c.height);
  for (let r = 0; r < c.height; r++) {
    for (let col = 0; col < c.width; col++) {
      const idx = tile[r]?.[col] ?? 0;
      if (idx === 0) continue;
      const cc = ed.palette[idx & 15];
      if (!cc || cc.transparent) continue;
      ctx.fillStyle = cssColor(cc);
      ctx.fillRect(col, r, 1, 1);
    }
  }
}

function drawPaint(): void {
  const tile = ed.tiles[ed.tileIdx];
  if (tile) drawTileInto(ed.paintEl, tile);
}

function rebuildStrip(): void {
  const strip = ed.stripEl;
  strip.innerHTML = '';
  const size = sizeForMode(ed.mode);
  for (let i = 0; i < ed.tiles.length; i++) {
    const t = ed.tiles[i];
    const b = el('button', i === ed.tileIdx ? 'thumb sel' : 'thumb');
    b.title = `tile ${i}`;
    if (t) {
      const c = mkCanvas(size, size, 48);
      drawTileInto(c, t);
      b.appendChild(c);
    }
    b.addEventListener('click', () => selectTile(i));
    strip.appendChild(b);
  }
}

function selectTile(i: number): void {
  ed.tileIdx = i;
  rebuildStrip();
  drawPaint();
}

function addTile(): void {
  if (ed.tiles.length >= 256) {
    setStat(ed.statEl, 'max 256 tiles', true);
    return;
  }
  ed.tiles.push(blankTile());
  scheduleGfxPersist();
  selectTile(ed.tiles.length - 1);
}

function delTile(): void {
  if (ed.tiles.length <= 1) {
    setStat(ed.statEl, 'keep at least one tile', true);
    return;
  }
  ed.tiles.pop();
  ed.tileIdx = Math.min(ed.tileIdx, ed.tiles.length - 1);
  scheduleGfxPersist();
  selectTile(ed.tileIdx);
}

function onIdx(): void {
  const max = Math.min(15, colorsForMode(ed.mode) - 1); // v1: one 16-color palette
  ed.paint = num(ed.idxEl, ed.paint, 0, max);
  ed.idxEl.value = String(ed.paint);
  rebuildBrush();
}

function rebuildBrush(): void {
  const strip = ed.brushEl;
  strip.innerHTML = '';
  for (let i = 0; i < 16; i++) {
    const c = ed.palette[i];
    const s = el('div', `swatch${c && c.transparent ? ' t' : ''}${i === ed.paint ? ' sel' : ''}`);
    if (c && !c.transparent) s.style.background = cssColor(c);
    s.title = `${i}${c && c.transparent ? ' — transparent' : ''}`;
    s.addEventListener('click', () => {
      ed.paint = i;
      ed.idxEl.value = String(i);
      rebuildBrush();
    });
    strip.appendChild(s);
  }
  // addEventListener dedupes identical (type, listener) pairs, so this is safe
  // to re-attach on every rebuild.
  ed.idxEl.addEventListener('change', onIdx);
}

function syncSliders(): void {
  const c = ed.palette[ed.colIdx];
  if (!c) return;
  ed.rEl.value = String(c.r);
  ed.gEl.value = String(c.g);
  ed.bEl.value = String(c.b);
  ed.tEl.checked = c.transparent;
  ed.colLbl.textContent = String(ed.colIdx);
}

function rebuildPal(): void {
  const grid = ed.palEl;
  grid.innerHTML = '';
  for (let i = 0; i < 16; i++) {
    const c = ed.palette[i];
    const b = el('button', `palswatch${c && c.transparent ? ' t' : ''}${i === ed.colIdx ? ' sel' : ''}`);
    if (c && !c.transparent) b.style.background = cssColor(c);
    b.title = `${i}: ${c && c.transparent ? 'transparent' : `${c.r},${c.g},${c.b}`}`;
    b.addEventListener('click', () => {
      ed.colIdx = i;
      syncSliders();
      rebuildPal();
    });
    grid.appendChild(b);
  }
  syncSliders();
}

/** A palette color changed — repaint everything that shows colors. */
function refreshPalette(): void {
  rebuildPal();
  rebuildBrush();
  drawPaint();
  paintMapAll();
  renderPreview();
  scheduleGfxPersist();
}

/** Recolor one map cell from the tile's first opaque pixel. */
function paintCell(i: number): void {
  const cell = ed.mapEl.children.item(i) as HTMLElement | null;
  if (!cell) return;
  const e = ed.map[i];
  if (!e) {
    cell.style.background = '';
    cell.title = 'empty';
    return;
  }
  const tile = ed.tiles[e.tile];
  let bg = '';
  if (tile) {
    outer: for (const row of tile) {
      for (const idx of row) {
        const cc = ed.palette[idx & 15];
        if (cc && !cc.transparent) {
          bg = cssColor(cc);
          break outer;
        }
      }
    }
  }
  cell.style.background = bg || '#3a3a44';
  const flags = [e.flipX ? 'H' : '', e.flipY ? 'V' : '', e.priority ? 'P' : '', `pal${e.palette}`]
    .filter(Boolean)
    .join(' ');
  cell.title = `tile ${e.tile} ${flags}`.trim();
}

function paintMapAll(): void {
  for (let i = 0; i < MAP_ENTRIES; i++) paintCell(i);
}

function placeMap(i: number, erase: boolean): void {
  ed.map[i] = erase ? null : { ...ed.mapBrush };
  scheduleGfxPersist();
  paintCell(i);
  renderPreview();
}

/**
 * Compose the background: for each 32-cell map row, draw the referenced tile
 * into the 256×224 frame, applying the entry's sub-tile flips (16×16 modes)
 * and skipping transparent pixels. 8×8 tiles map 1:1.
 */
function renderPreview(): void {
  const cv = ed.previewEl;
  const ctx = cv.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0d0d10';
  ctx.fillRect(0, 0, cv.width, cv.height);
  const size = sizeForMode(ed.mode);
  const cols = Math.floor(SNES_WIDTH / size);
  const rows = Math.floor(SNES_HEIGHT / size);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const e = ed.map[r * 32 + c];
      const tile = e ? ed.tiles[e.tile] : undefined;
      if (!e || !tile) continue;
      for (let dr = 0; dr < size; dr++) {
        for (let dc = 0; dc < size; dc++) {
          const vr = (dr >> 3) * 8 + ((dr & 7) ^ (e.flipY ? 7 : 0));
          const vc = (dc >> 3) * 8 + ((dc & 7) ^ (e.flipX ? 7 : 0));
          const idx = tile[vr]?.[vc] ?? 0;
          if (idx === 0) continue;
          const col = ed.palette[idx & 15];
          if (!col || col.transparent) continue;
          ctx.fillStyle = cssColor(col);
          ctx.fillRect(c * size + dc, r * size + dr, 1, 1);
        }
      }
    }
  }
}

/** Compile the current tiles + palette + map to a 64 KB image and save it. */
function download(): void {
  try {
    const vram = buildVramImage({
      mode: ed.mode,
      tiles: ed.tiles.length ? ed.tiles : [blankTile()],
      palettes: [ed.palette],
      tilemap: ed.map.map((e) => e ?? blankEntry()),
      tileBase: ed.tileBase,
      paletteBase: ed.paletteBase,
      mapBase: ed.mapBase,
    });
    if (vram.length !== VRAM_SIZE) {
      setStat(ed.statEl, `unexpected image size ${vram.length} (expected ${VRAM_SIZE})`, true);
      return;
    }
    // Copy into a fresh ArrayBuffer-backed view (same pattern as the
    // assembler's download) so the Blob constructor accepts the image.
    const blob = new Blob([new Uint8Array(vram)], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = el('a', '');
    a.href = url;
    a.download = 'vram.bin';
    document.body.appendChild(a);
    a.click();
    window.setTimeout(() => {
      a.remove();
      URL.revokeObjectURL(url);
    }, 5000);
    setStat(ed.statEl, `saved ${blob.size} bytes → vram.bin`);
  } catch (err) {
    setStat(ed.statEl, (err as Error).message, true);
  }
}

// --- Sprites (OBJ) tab — the OAM table + OBJ palette -----------------------

/** The 👾 Sprites (OBJ) pane: the global size, the OBJ palette (16–31), and
 * the 128-slot OAM table. It edits the same `ed.oam` / `ed.objPalette` state
 * the agent drives from any page, and is persisted under `snes-web:gfx:v1`. */
function buildSpritesPane(): HTMLElement {
  const pane = el('div', 'panel');

  // Header: global size + live count + clear-all.
  const head = el('div', 'row');
  const sizeLbl = el('label', '', 'size');
  const sizeEl = el('select', '');
  for (const s of ['8x8', '16x16'] as OamSize[]) {
    const o = document.createElement('option');
    o.value = s;
    o.textContent = s === '8x8' ? '8×8 — one char (OBJSEL $00)' : '16×16 — a 2×2 char block (OBJSEL $60)';
    if (s === ed.oamSize) o.selected = true;
    sizeEl.appendChild(o);
  }
  sizeLbl.appendChild(sizeEl);
  head.appendChild(sizeLbl);
  const countEl = el('span', 'sp-stat', '');
  head.appendChild(countEl);
  const clearBtn = el('button', 'btn', 'clear all sprites');
  head.appendChild(clearBtn);
  pane.appendChild(head);

  // OBJ palette (colors 16–31) — sprites sample THIS, not the background one.
  const palSec = el('div', 'sp-section');
  palSec.appendChild(el('h3', '', 'OBJ palette (colors 16–31)'));
  palSec.appendChild(el('p', 'muted', 'Index 16 (CGRAM 128) is the sprite transparency slot. A char painted with background color N renders as OBJ color 16+N, so set those here.'));
  const objPalEl = el('div', 'palgrid');
  palSec.appendChild(objPalEl);
  const rgbRow = el('div', 'row');
  const objColLbl = el('span', 'muted', '17');
  rgbRow.appendChild(objColLbl);
  const spObjR = rangeEl('OBJ red (0–31)');
  const spObjG = rangeEl('OBJ green (0–31)');
  const spObjB = rangeEl('OBJ blue (0–31)');
  rgbRow.appendChild(label('R', spObjR));
  rgbRow.appendChild(label('G', spObjG));
  rgbRow.appendChild(label('B', spObjB));
  const spObjT = checkbox('transparent');
  rgbRow.appendChild(spObjT.lbl);
  palSec.appendChild(rgbRow);
  pane.appendChild(palSec);

  // The 128-slot OAM table (scrollable).
  const tblSec = el('div', 'sp-section');
  tblSec.appendChild(el('h3', '', 'OAM slots (128)'));
  tblSec.appendChild(el('p', 'muted', 'Size is global (the selector above). 8×8 = one char, any index. 16×16 = a 2×2 char block: the tile is its TOP-LEFT char, which must sit on an even char column (0, 2, 4, … — tile % 2 == 0, any row). The SNES lays 8×8 chars out 16 per row, so the block is (tile, tile+1, tile+16, tile+17) — paint all four chars. x/y are the top-left screen pixel. Positions are static — OAM loads once, so a moving sprite re-calls oam_load.'));
  const wrap = el('div', 'oam-wrap');
  const tbl = el('table', 'oam-tbl');
  const thead = el('thead', '');
  const hr = el('tr', '');
  for (const th of ['#', 'on', 'tile', 'x', 'y', 'H', 'V', 'pri', '']) {
    hr.appendChild(el('th', '', th));
  }
  thead.appendChild(hr);
  tbl.appendChild(thead);
  const tbody = el('tbody', '');
  tbl.appendChild(tbody);
  wrap.appendChild(tbl);
  tblSec.appendChild(wrap);
  tblSec.appendChild(el('p', 'muted', 'The gfx_export_oam agent tool compiles these 128 slots into oam.bin, registers it, and appends the oam_load routine (destName "oam.bin", size "8x8"|"16x16"). The program then calls jsr oam_load after jsr vram_load.'));
  pane.appendChild(tblSec);

  Object.assign(ed, {
    spOamBody: tbody,
    spObjPalEl: objPalEl,
    spObjR, spObjG, spObjB, spObjT: spObjT.input,
    spObjColLbl: objColLbl,
    spSizeEl: sizeEl,
    spCount: countEl,
  });

  sizeEl.addEventListener('change', () => {
    ed.oamSize = sizeEl.value === '8x8' ? '8x8' : '16x16';
    scheduleGfxPersist();
  });
  clearBtn.addEventListener('click', () => {
    for (let i = 0; i < OAM_ENTRIES; i++) ed.oam[i] = null;
    rebuildSprites();
    scheduleGfxPersist();
  });
  const objT = spObjT.input;
  spObjR.addEventListener('input', () => { setObjColor(ed.objColIdx, { r: +spObjR.value, g: +spObjG.value, b: +spObjB.value, transparent: objT.checked }); });
  spObjG.addEventListener('input', () => { setObjColor(ed.objColIdx, { r: +spObjR.value, g: +spObjG.value, b: +spObjB.value, transparent: objT.checked }); });
  spObjB.addEventListener('input', () => { setObjColor(ed.objColIdx, { r: +spObjR.value, g: +spObjG.value, b: +spObjB.value, transparent: objT.checked }); });
  objT.addEventListener('change', () => { setObjColor(ed.objColIdx, { r: +spObjR.value, g: +spObjG.value, b: +spObjB.value, transparent: objT.checked }); });

  rebuildSprites();
  return pane;
}

/** Write one OBJ palette color (flat index 16–31) and repaint the sprite surfaces. */
function setObjColor(flatIdx: number, color: Rgb15): void {
  const i = Math.max(0, Math.min(15, Math.round(flatIdx) - 16));
  ed.objPalette[i] = { r: clamp5(color.r), g: clamp5(color.g), b: clamp5(color.b), transparent: !!color.transparent };
  rebuildSprites();
  scheduleGfxPersist();
}

/** Sync the OBJ-pane RGB sliders to the currently selected OBJ color. */
function syncObjSliders(): void {
  const i = ed.objColIdx - 16;
  const c = ed.objPalette[i];
  if (!c) return;
  ed.spObjR.value = String(c.r);
  ed.spObjG.value = String(c.g);
  ed.spObjB.value = String(c.b);
  ed.spObjT.checked = c.transparent;
  ed.spObjColLbl.textContent = String(ed.objColIdx);
}

/**
 * Redraw the whole Sprites (OBJ) pane from state: the OBJ palette swatches,
 * the 128 OAM slot rows, and the live "N active" count. Called on tab mount and
 * after any OAM/size/OBJ-palette change.
 */
function rebuildSprites(): void {
  // --- OBJ palette swatches (colors 16–31) ---
  const grid = ed.spObjPalEl;
  grid.innerHTML = '';
  for (let i = 0; i < 16; i++) {
    const flat = 16 + i;
    const c = ed.objPalette[i];
    const b = el('button', `palswatch${c && c.transparent ? ' t' : ''}${flat === ed.objColIdx ? ' sel' : ''}`);
    if (c && !c.transparent) b.style.background = cssColor(c);
    b.title = `${flat}: ${c && c.transparent ? 'transparent' : `${c.r},${c.g},${c.b}`}`;
    b.addEventListener('click', () => {
      ed.objColIdx = flat;
      syncObjSliders();
      rebuildSprites();
    });
    grid.appendChild(b);
  }
  syncObjSliders();

  // --- 128 OAM slot rows ---
  const tbody = ed.spOamBody;
  tbody.innerHTML = '';
  let active = 0;
  for (let slot = 0; slot < OAM_ENTRIES; slot++) {
    const e = ed.oam[slot];
    const on = e !== null;
    if (on) active++;
    const tr = el('tr', on ? '' : 'off');
    tr.appendChild(el('td', '', String(slot)));

    const onCell = el('td', '');
    const onChk = el('input', '');
    onChk.type = 'checkbox';
    onChk.checked = on;
    onChk.addEventListener('change', () => {
      if (onChk.checked) {
        ed.oam[slot] = { tile: 0, x: 128, y: 128, flipH: false, flipV: false, priority: 0 };
      } else {
        ed.oam[slot] = null;
      }
      rebuildSprites();
      scheduleGfxPersist();
    });
    onCell.appendChild(onChk);
    tr.appendChild(onCell);

    // Capture the (possibly-absent) entry's fields once, narrowed by `on`,
    // so the per-cell closures below only touch plain numbers.
    const i0 = {
      tile: on ? e.tile : 0,
      x: on ? e.x : 0,
      y: on ? e.y : 0,
      fh: on ? !!e.flipH : false,
      fv: on ? !!e.flipV : false,
      pr: on ? (e.priority ?? 0) : 0,
    };

    const numIn = (hi: number, key: 'tile' | 'x' | 'y', initial: number) => {
      const inp = el('input', '');
      inp.type = 'number';
      inp.min = '0';
      inp.max = String(hi);
      inp.value = String(initial);
      inp.title = key;
      inp.addEventListener('change', () => {
        const cur = ed.oam[slot];
        if (!cur) return;
        cur[key] = num(inp, 0, 0, hi);
        scheduleGfxPersist();
      });
      const td = el('td', '');
      td.appendChild(inp);
      tr.appendChild(td);
    };
    numIn(511, 'tile', i0.tile);
    numIn(255, 'x', i0.x);
    numIn(255, 'y', i0.y);

    const chkCell = (key: 'flipH' | 'flipV', initial: boolean) => {
      const inp = el('input', '');
      inp.type = 'checkbox';
      inp.checked = initial;
      inp.title = key;
      inp.addEventListener('change', () => {
        const cur = ed.oam[slot];
        if (!cur) return;
        cur[key] = inp.checked;
        scheduleGfxPersist();
      });
      const td = el('td', '');
      td.appendChild(inp);
      tr.appendChild(td);
    };
    chkCell('flipH', i0.fh);
    chkCell('flipV', i0.fv);

    const priInp = el('input', '');
    priInp.type = 'number';
    priInp.min = '0';
    priInp.max = '3';
    priInp.value = String(i0.pr);
    priInp.title = 'priority (0–3)';
    priInp.addEventListener('change', () => {
      const cur = ed.oam[slot];
      if (!cur) return;
      cur.priority = num(priInp, 0, 0, 3);
      scheduleGfxPersist();
    });
    const priTd = el('td', '');
    priTd.appendChild(priInp);
    tr.appendChild(priTd);

    const actCell = el('td', '');
    const hideBtn = el('button', 'btn', '×');
    hideBtn.title = 'hide this slot';
    hideBtn.addEventListener('click', () => {
      ed.oam[slot] = null;
      rebuildSprites();
      scheduleGfxPersist();
    });
    actCell.appendChild(hideBtn);
    tr.appendChild(actCell);

    tbody.appendChild(tr);
  }
  ed.spCount.textContent = `${active}/${OAM_ENTRIES} active · ${ed.oamSize}`;
}

// --- agent controller (the gfx_* tools dispatch against this) --------------

/** Re-render the mounted editor after the agent edits it (no-op when off-screen). */
export function refreshGfx(): void {
  if (!gfxMounted) return;
  rebuildAll();
}

/** Clamp a 5-bit palette channel to 0–31. */
function clamp5(v: number): number {
  return Math.max(0, Math.min(31, Math.round(v)));
}

/**
 * The `GfxController` the agent loop dispatches the `gfx_*` tools against.
 *
 * It edits the same `ed` state the page does (and persists it under
 * `snes-web:gfx:v1`), so it works whether or not the graphics page is
 * mounted, and re-renders the editor when it happens to be on screen.
 * `buildVram()` compiles the current tiles + palette + map — the bytes the
 * agent feeds to `asm_add_data_file("vram.bin")`.
 */
export function makeGfxController(): GfxController {
  /** Grow `ed.tiles` to reach `tile` (page cap: 256). */
  function ensureTile(tile: number): number[][] | null {
    if (!Number.isInteger(tile) || tile < 0 || tile > 255) return null;
    while (ed.tiles.length <= tile) ed.tiles.push(blankTile());
    return ed.tiles[tile] ?? null;
  }

  /** Fill a (clamped) rectangle of one tile; refreshes the editor if it's on screen. */
  function paintTile(tile: number, x0: number, y0: number, x1: number, y1: number, color: number): boolean {
    const t = ensureTile(tile);
    if (!t) return false;
    const size = t.length;
    const cx0 = Math.max(0, Math.min(x0, x1, size - 1));
    const cx1 = Math.min(size - 1, Math.max(x0, x1));
    const cy0 = Math.max(0, Math.min(y0, y1, size - 1));
    const cy1 = Math.min(size - 1, Math.max(y0, y1));
    const c = Math.round(color) & 15;
    for (let r = cy0; r <= cy1; r++) {
      const row = t[r];
      if (!row) continue;
      for (let col = cx0; col <= cx1; col++) row[col] = c;
    }
    if (gfxMounted && ed.tileIdx === tile) {
      drawPaint();
      rebuildStrip();
      renderPreview();
    }
    scheduleGfxPersist();
    return true;
  }

  return {
    getState() {
      return {
        mode: ed.mode,
        tiles: ed.tiles.length,
        palette: ed.palette.length,
        objPalette: ed.objPalette.length,
        mapEntries: ed.map.reduce((n, e) => n + (e !== null ? 1 : 0), 0),
        altMapEntries: ed.mapAlt.reduce((n, e) => n + (e !== null ? 1 : 0), 0),
        oamEntries: ed.oam.filter((e) => e !== undefined).length,
      };
    },

    /**
     * `index` 0-15 = background palette (CGRAM palette 0);
     * 16-31 = OBJ/sprite palette (CGRAM palette 8, the one sprites sample).
     */
    setPaletteColor(index, r, g, b, transparent) {
      if (!Number.isInteger(index) || index < 0 || index > 31) return;
      const color = { r: clamp5(r), g: clamp5(g), b: clamp5(b), transparent };
      if (index < 16) ed.palette[index] = color;
      else ed.objPalette[index - 16] = color;
      if (gfxMounted) refreshPalette(); // (also persists — harmless double)
      else scheduleGfxPersist();
    },

    setTilePixel(tile, row, col, color) {
      paintTile(tile, col, row, col, row, color);
    },

    fillTileRect(tile, x0, y0, x1, y1, color) {
      paintTile(tile, x0, y0, x1, y1, color);
    },

    addTile() {
      if (ed.tiles.length >= 256) return ed.tiles.length - 1;
      ed.tiles.push(blankTile());
      const idx = ed.tiles.length - 1;
      if (gfxMounted) {
        rebuildStrip();
        ed.brushTileEl.max = String(ed.tiles.length - 1);
      }
      scheduleGfxPersist();
      return idx;
    },

    setMapEntry(col, row, entry) {
      if (row < 0 || row > 31 || col < 0 || col > 31) return;
      const i = row * 32 + col;
      ed.map[i] = {
        tile: Math.max(0, Math.min(0x3ff, Math.round(entry.tile))),
        palette: entry.palette & 3,
        flipX: !!entry.flipX,
        flipY: !!entry.flipY,
        priority: !!entry.priority,
      };
      if (gfxMounted) paintCell(i); // repaints the cell + preview
      scheduleGfxPersist();
    },

    fillMap(tile, palette) {
      const t = Math.max(0, Math.min(0x3ff, Math.round(tile)));
      const p = palette & 3;
      for (let i = 0; i < MAP_ENTRIES; i++) {
        ed.map[i] = { tile: t, palette: p, flipX: false, flipY: false, priority: false };
      }
      if (gfxMounted) {
        paintMapAll();
        renderPreview();
      }
      scheduleGfxPersist();
    },

    setMapFromGrid(grid, palette) {
      // Replaces the map: grid cells that are 0/absent become empty entries.
      const p = palette & 3;
      for (let row = 0; row < 32; row++) {
        for (let col = 0; col < 32; col++) {
          const v = grid[row]?.[col];
          if (typeof v === 'number' && Number.isFinite(v) && v >= 1) {
            ed.map[row * 32 + col] = {
              tile: Math.round(v) & 0x3ff,
              palette: p,
              flipX: false,
              flipY: false,
              priority: false,
            };
          } else {
            ed.map[row * 32 + col] = null;
          }
        }
      }
      if (gfxMounted) {
        paintMapAll();
        renderPreview();
      }
      scheduleGfxPersist();
    },

    // --- second (alt) tilemap: the runtime-switchable screen ----------------
    // Data-only — the editor pane paints the PRIMARY `ed.map`, so these mutate
    // `ed.mapAlt` without any DOM refresh. Once any cell is set, `gfxVramOpts`
    // picks the alt map up and the generated glue emits `vram_toggle`.

    setAltMapEntry(col, row, entry) {
      if (row < 0 || row > 31 || col < 0 || col > 31) return;
      const i = row * 32 + col;
      ed.mapAlt[i] = {
        tile: Math.max(0, Math.min(0x3ff, Math.round(entry.tile))),
        palette: entry.palette & 3,
        flipX: !!entry.flipX,
        flipY: !!entry.flipY,
        priority: !!entry.priority,
      };
      scheduleGfxPersist();
    },

    fillAltMap(tile, palette) {
      const t = Math.max(0, Math.min(0x3ff, Math.round(tile)));
      const p = palette & 3;
      for (let i = 0; i < MAP_ENTRIES; i++) {
        ed.mapAlt[i] = { tile: t, palette: p, flipX: false, flipY: false, priority: false };
      }
      scheduleGfxPersist();
    },

    setAltMapFromGrid(grid, palette) {
      const p = palette & 3;
      for (let row = 0; row < 32; row++) {
        for (let col = 0; col < 32; col++) {
          const v = grid[row]?.[col];
          if (typeof v === 'number' && Number.isFinite(v) && v >= 1) {
            ed.mapAlt[row * 32 + col] = {
              tile: Math.round(v) & 0x3ff,
              palette: p,
              flipX: false,
              flipY: false,
              priority: false,
            };
          } else {
            ed.mapAlt[row * 32 + col] = null;
          }
        }
      }
      scheduleGfxPersist();
    },

    // --- sprites (OAM): 128 slots, 16×16 chars ------------------------------
    // Data-only — the editor pane's sprite list (when mounted) re-renders on
    // refreshGfx. Slots are `null`-hidden until authored.

    setOamEntry(slot, entry) {
      if (!Number.isInteger(slot) || slot < 0 || slot > 127) return;
      ed.oam[slot] = entry
        ? {
            tile: Math.max(0, Math.min(0x1ff, Math.round(entry.tile))),
            x: ((Math.round(entry.x) % 256) + 256) & 0xff,
            y: ((Math.round(entry.y) % 256) + 256) & 0xff,
            flipH: !!entry.flipH,
            flipV: !!entry.flipV,
            priority: (Math.round(entry.priority ?? 0)) & 3,
          }
        : null;
      if (gfxMounted) rebuildAll();
      scheduleGfxPersist();
    },

    clearOam() {
      ed.oam = new Array<OamEntry | null>(OAM_ENTRIES).fill(null);
      if (gfxMounted) rebuildAll();
      scheduleGfxPersist();
    },

    buildOam() {
      ensureGfxState();
      return encodeOam(ed.oam);
    },

    oamGlue(dataName, size) {
      return oamGlue(dataName, size);
    },

    buildVram() {
      ensureGfxState();
      return buildVramImage(gfxVramOpts());
    },

    buildVramCompact() {
      ensureGfxState();
      return buildVramCompact(gfxVramOpts());
    },

    vramGlue(dataName) {
      const c = buildVramCompact(gfxVramOpts());
      // `c.altMapBase` (present only when an alt tilemap was authored) is what
      // makes the generated glue emit the `vram_toggle` service routine.
      return vramGlueGen(c.mapBase, c.bgmode, c.blocks, dataName, c.altMapBase);
    },
  };
}

/** The shared `BuildVramOptions` for the gfx controller's compile methods. */
function gfxVramOpts(): BuildVramOptions {
  // The alt map is only included once at least one cell has been set — that's
  // the trigger that (a) re-homes it into the next SCBase window and (b) makes
  // vramGlue emit the `vram_toggle` service routine. An empty alt map keeps
  // the single-screen build clean (no `vram_toggle`, identical to before).
  const hasAlt = ed.mapAlt.some((e) => e !== null);
  return {
    mode: ed.mode,
    tiles: ed.tiles.length ? ed.tiles : [blankTile()],
    palettes: [ed.palette],
    objPalette: ed.objPalette,
    tilemap: ed.map.map((e) => e ?? blankEntry()),
    altTilemap: hasAlt ? ed.mapAlt.map((e) => e ?? blankEntry()) : undefined,
    tileBase: ed.tileBase,
    paletteBase: ed.paletteBase,
    mapBase: ed.mapBase,
  };
}
