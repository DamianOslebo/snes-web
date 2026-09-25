/**
 * Shared types for the Ollama-backed agent chat.
 *
 * Pure: no DOM, no AudioContext, no fetch — so every consumer (the node-test
 * loop, the browser panel, the per-page controllers) can import this without
 * pulling in a browser-only module. The page controllers implement the
 * `*Controller` interfaces; `src/agent/tools.ts` dispatches tool calls against
 * them; `src/agent/loop.ts` drives the multi-turn loop.
 *
 * Wire shape follows Ollama's `/api/chat` (function calling) — verified:
 *   request  POST /api/chat  { model, messages, tools, stream:false }
 *   response { message: { role, content, tool_calls?: [{ function: { name,
 *             arguments } }] } }   // `arguments` is a JSON *object*
 *   tool msg { role:'tool', content:string, tool_name:string }
 *   models   GET  /api/tags  → { models: [{ name, ... }] }
 */

import type { VramCompact } from '../gfx/vram';
import type { OamSize } from '../gfx/oam';

export type Role = 'system' | 'user' | 'assistant' | 'tool';

/** One tool call requested by the model (arguments already parsed to a value). */
export interface ToolCall {
  name: string;
  /** Parsed `arguments` — an object in practice; kept `unknown` for tolerance. */
  args: unknown;
}

/** A single message in the conversation (request or response, either way). */
export interface Message {
  role: Role;
  content: string;
  /** Assistant messages only: the tool calls the model asked to run. */
  tool_calls?: ToolCall[];
  /** Tool-result messages only: which call this is the result of. */
  tool_name?: string;
}

/** `parameters` block of a tool spec — a JSON-Schema object. */
export type JsonSchema = Record<string, unknown>;

/** One Ollama `tools` entry (the `type:"function"` wrapper). */
export interface ToolSpec {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: JsonSchema;
  };
}

/** The tool-calling request body sent to `/api/chat`. */
export interface ChatRequest {
  model: string;
  messages: Message[];
  tools: ToolSpec[];
  stream: false;
  /** Ollama `think` — enable/disable the model's reasoning. Omitted = model default. */
  think?: boolean;
}

/**
 * The loose response we accept from `/api/chat`. Ollama's `arguments` is
 * normally a JSON object; we also tolerate a JSON string (some frontends /
 * proxies string-ify it), so `parseArgs` in ollama.ts handles both.
 */
export interface OllamaToolCallRaw {
  function?: { name?: string; arguments?: unknown };
  name?: string;
  arguments?: unknown;
}

export interface OllamaChatResponse {
  message?: {
    role?: string;
    content?: string;
    tool_calls?: OllamaToolCallRaw[];
  };
  // Ollama also returns model/created_at/… — unused; left open.
  [key: string]: unknown;
}

export interface OllamaTagResponse {
  models?: Array<{ name: string; [key: string]: unknown }>;
  [key: string]: unknown;
}

// --- controllers (the page-facing capability surface) ----------------------
//
// Every page (asm/gfx/track) exposes one of these, backed by that page's
// module-scoped + localStorage-persisted state. All three are always
// available to the agent (they work whether or not their page is mounted —
// they read/write persisted state, and `refresh` re-renders the page when it
// happens to be on screen). This is what lets the agent drive all three pages
// from any one of them.

/** Assembler page: 65C816 source, its `.incbin` data files, assemble/build. */
export interface AsmController {
  /** Current 65C816 source text. */
  getSource(): string;
  /** Replace the whole source. */
  setSource(source: string): void;
  /** Append text to the source (for adding snippets/glue). */
  appendSource(text: string): void;
  /** The `.incbin` data files (name → size), in insertion order. */
  listDataFiles(): { name: string; bytes: number }[];
  /** Add (or replace) a data file; the program `.incbin`s it by name. */
  addDataFile(name: string, bytes: Uint8Array): void;
  /** Remove a data file (no-op if absent). */
  removeDataFile(name: string): void;
  /** Assemble the current source (with its data files). */
  assemble(): { ok: boolean; byteCount: number; errors: { line: number; message: string }[] };
  /** Build the 256 KB SFC from the last successful assemble. */
  buildRom(): { ok: boolean; bytes?: number; error?: string };
  /** Hand the built ROM to the emulator (▶ Run). Browser-only. */
  run(): { ok: boolean; error?: string };
}

/** Graphics page: tiles, palette, tilemap, sprites (OAM), and the compiled VRAM. */
export interface GfxController {
  /** A compact snapshot of the editor state (for the agent to inspect). */
  getState(): { mode: number; tiles: number; palette: number; mapEntries: number; altMapEntries: number; oamEntries: number };
  /**
   * Set palette `index` to a 5-5-5 color.
   * Index 0-15 = background palette (CGRAM palette 0).
   * Index 16-31 = OBJ/sprite palette (CGRAM palette 8 — the one sprites sample).
   */
  setPaletteColor(index: number, r: number, g: number, b: number, transparent: boolean): void;
  /** Paint one pixel of a tile with palette `color`. Creates the tile if needed. */
  setTilePixel(tile: number, row: number, col: number, color: number): void;
  /** Fill a rectangular region of one tile with a palette color. */
  fillTileRect(tile: number, x0: number, y0: number, x1: number, y1: number, color: number): void;
  /** Add a blank tile; returns its index. */
  addTile(): number;
  /** Set the tilemap entry at (col,row) for the 32×32 SC0 map. */
  setMapEntry(col: number, row: number, entry: { tile: number; palette: number; flipX: boolean; flipY: boolean; priority: boolean }): void;
  /** Fill the whole 32×32 SC0 map with one (tile, palette) entry. */
  fillMap(tile: number, palette: number): void;
  /**
   * Replace the SC0 map from a row-major grid of tile indices (32 rows ×
   * 32 columns); palette/flags come from `palette` (0/0/0/0/false).
   */
  setMapFromGrid(grid: number[][], palette: number): void;

  // --- second tilemap (the runtime-switchable screen) -----------------------
  //
  // These author the ALT tilemap — a distinct 32×32 screen the PPU can be
  // flipped to at runtime. When at least one alt cell is set, `buildVramCompact`
  // places it in the next SCBase window and `vramGlue` emits a `vram_toggle`
  // service routine that flips between the primary and alt screens.

  /** Set the tilemap entry at (col,row) for the 32×32 ALT (second) SC0 map. */
  setAltMapEntry(col: number, row: number, entry: { tile: number; palette: number; flipX: boolean; flipY: boolean; priority: boolean }): void;
  /** Fill the whole 32×32 ALT SC0 map with one (tile, palette) entry. */
  fillAltMap(tile: number, palette: number): void;
  /**
   * Replace the ALT SC0 map from a row-major grid of tile indices (32 rows ×
   * 32 columns); palette/flags come from `palette`.
   */
  setAltMapFromGrid(grid: number[][], palette: number): void;

  // --- sprites (OAM) ---------------------------------------------------------
  //
  // 128 OBJ slots. Sprite SIZE is global (OBJSEL), chosen once at export — the
  // two supported sizes are 8×8 and 16×16 (see OamSize / `oamGlue`). A sprite
  // samples the OBJ palette (colors 16-31 → CGRAM palette 8) and a char by its
  // 9-bit `tile` index (8×8 = that char; 16×16 = the 2×2 block from its
  // top-left). `setOamEntry(slot, null)` hides a slot.

  /** One sprite slot. `tile` = 8×8 char index (0-511): the whole 8×8 sprite, or the top-left of the 16×16 block. */
  setOamEntry(slot: number, entry: { tile: number; x: number; y: number; flipH?: boolean; flipV?: boolean; priority?: number } | null): void;
  /** Hide every sprite slot. */
  clearOam(): void;
  /** Compile the 128 slots to the 512-byte OAM image the program `.incbin`s. */
  buildOam(): Uint8Array;
  /**
   * The self-contained 65C816 `oam_load` routine (OBJSEL + OAMADDR + TM +
   * 512-byte stream through $2104). Call AFTER `vram_load`. `dataName` is the
   * `.incbin` file name the glue references (default "oam.bin"); `size`
   * (`'8x8' | '16x16'`, default `'16x16'`) is the global sprite size baked into
   * OBJSEL.
   */
  oamGlue(dataName?: string, size?: OamSize): string;

  /** Compile the editor to a 64 KB VRAM image. */
  buildVram(): Uint8Array;
  /**
   * Compile the editor to a **compact** VRAM export — only the used char,
   * tilemap, and palette regions (a few KB, not all 64 KB), with the tilemap
   * re-homed into a displayable NameBase. This is what a ROM should embed.
   */
  buildVramCompact(): VramCompact;
  /**
   * The self-contained 65C816 bring-up routine (PPU setup + VRAM fill) that
   * loads `buildVramCompact()`'s blob. The program only needs `JSR vram_load`.
   * `dataName` is the `.incbin` file name the glue references (default "vram.bin").
   */
  vramGlue(dataName?: string): string;
}

/** Music page: the S-DSP song, and the SPC package export. */
export interface TrackController {
  /** The song as its `.snc` JSON (a string, so it crosses the boundary cleanly). */
  getSong(): string;
  /** Replace a single cell (note `null` = rest). `true` when applied. */
  setCell(pattern: number, row: number, channel: number, note: number | null, inst: number, vol: number): boolean;
  /**
   * Apply many cell edits to one pattern in a single call (the agent's
   * authoring path); each entry with `note: null` clears the cell to a rest.
   * Returns the number of cells applied.
   */
  setPatternCells(
    pattern: number,
    cells: { row: number; channel: number; note: number | null; inst: number; vol: number }[],
  ): number;
  /** Set the song speed (rows per second). */
  setTempo(rowsPerSecond: number): void;
  /** Set the play-order list (pattern indices). */
  setOrders(orders: number[]): void;
  /** Add a blank pattern; returns its index. */
  addPattern(): number;
  /** Add a preset instrument (`lead|bass|noise|pad`); returns its rack index. */
  addInstrument(kind: string): number;
  /** Start/stop the Web Audio preview. Browser-only; a no-op where unavailable. */
  preview(): { ok: boolean; error?: string };
  stop(): { ok: boolean; error?: string };
  /** Build the SPC-RAM image (driver + BRR samples + directory). */
  buildSpc(): Uint8Array;
  /**
   * The 65C816 loader glue (Appendix D) that moves `buildSpc()` into SPU RAM.
   * `dataName` is the `.incbin` file name the glue references (default
   * "spc.bin").
   */
  spcGlue(dataName?: string): string;
  /** A compact layout summary (sample/driver offsets) for the agent. */
  spcLayout(): Record<string, unknown>;
}

/**
 * The full capability surface the agent loop dispatches against. All three
 * groups are present (each backed by its page's persisted state) so the agent
 * can author code + graphics + music from any single page.
 */
export interface AgentControllers {
  asm: AsmController;
  gfx: GfxController;
  track: TrackController;
}

/** A tool's outcome, as returned by `dispatchTool` and surfaced to the UI. */
export interface ToolResult {
  ok: boolean;
  /** Compact JSON (or a plain error string) fed back to the model as the tool result. */
  content: string;
}

/** Which authoring page the panel is currently mounted on (drives the prompt). */
export type PageKind = 'asm' | 'gfx' | 'track';
