/**
 * `tools` — the agent's tool catalog and dispatcher.
 *
 * The 34 `asm_*` / `gfx_*` / `trk_*` tools are the model's only way to touch
 * the three pages: each maps to one or two `AgentControllers` methods. Three
 * of them are cross-page bridges — `gfx_export_vram`, `gfx_export_oam`, and `trk_export_spc` build
 * a binary on one page and register it on the asm page as an `.incbin` data
 * file, so a 64 KB image never has to cross the model's context as text.
 *
 * Contract: `dispatchTool` NEVER throws. Unknown tools and malformed
 * arguments become clean, compact JSON error strings — the model reads them
 * as the tool result and retries. Handlers validate every argument they use.
 *
 * Pure: depends only on the `AgentControllers` interface (implemented by the
 * browser page modules) and the pure track model for note names — so node
 * tests drive it with mock controllers and no DOM.
 */

import { NOTE_MAX, NOTE_MIN, parseNoteName } from '../track/model';
import type { OamSize } from '../gfx/oam';
import type { AgentControllers, ToolResult, ToolSpec } from './types';

export interface ToolCtx {
  controllers: AgentControllers;
}

type Args = Record<string, unknown>;
type Handler = (args: Args, c: AgentControllers) => ToolResult;

interface ToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  run: Handler;
}

/** Manual `.incbin` uploads are capped; the big images go through the exports. */
export const MAX_MANUAL_DATA_BYTES = 64 * 1024;

// The two cross-page export tools append generated 65C816 glue to the asm
// source. Each wraps its glue in its own marker comment so a later re-export
// (e.g. after painting more tiles) REPLACES the old block instead of duplicating
// it — a duplicate `vram_load:` label would otherwise fail assembly. Markers are
// `;`-prefixed, so the assembler treats them as plain comments.
const GLUE_MARKERS: Record<'gfx' | 'spc' | 'oam', { start: string; end: string }> = {
  gfx: { start: ';=== GFX_VRAM_GLUE (generated) ===', end: ';=== /GFX_VRAM_GLUE ===' },
  spc: { start: ';=== SPC_GLUE (generated; EXPERIMENTAL) ===', end: ';=== /SPC_GLUE ===' },
  oam: { start: ';=== GFX_OAM_GLUE (generated) ===', end: ';=== /GFX_OAM_GLUE ===' },
};

/**
 * Upsert a generated-glue block in the asm source: if the block's start marker
 * is already present, replace the whole marker..marker region in place (preserving
 * the surrounding whitespace); otherwise append it. Idempotent — re-exporting
 * after changing graphics or music converges to the same source instead of
 * duplicating the block (a duplicate `vram_load`/`spc_load` label would fail
 * assembly).
 */
function upsertGlue(c: AgentControllers, kind: 'gfx' | 'spc' | 'oam', block: string): void {
  const { start, end } = GLUE_MARKERS[kind];
  const body = `${start}\n${block}\n${end}`;
  const src = c.asm.getSource();
  const s = src.indexOf(start);
  if (s >= 0) {
    const e = src.indexOf(end, s);
    if (e >= 0) {
      c.asm.setSource(src.slice(0, s) + body + src.slice(e + end.length));
      return;
    }
  }
  // Not present — append with a single blank-line separator.
  c.asm.appendSource(`\n${body}`);
}

// --- result helpers ---------------------------------------------------------

export function ok(content: unknown): ToolResult {
  return {
    ok: true,
    content: typeof content === 'string' ? content : JSON.stringify(content),
  };
}

export function fail(message: string, extra?: Record<string, unknown>): ToolResult {
  return { ok: false, content: JSON.stringify({ error: message, ...extra }) };
}

/**
 * Turn raw assembler diagnostics into an ACTIONABLE hint for the model. This is
 * the highest-leverage nudge: in practice the model writes the correct tiny
 * program (`jsr vram_load`) but then forgets the one call that makes the label
 * exist — `gfx_export_vram`. Seeing `undefined label "vram_load"` it re-writes
 * source and appends hand-rolled junk instead of calling the export. Naming the
 * exact tool + args in the failure is what steers it back to the recipe.
 * Returns `undefined` when none of the known signatures match.
 */
export function assembleHint(errors: { line: number; message: string }[]): string | undefined {
  const text = errors.map((e) => e.message).join('\n');
  if (/undefined label "vram_load"/.test(text)) {
    return (
      'vram_load is a GENERATED routine — you do not write it. Call gfx_export_vram with ' +
      '{"destName":"vram.bin"} to compile the compact VRAM, register vram.bin, and append the ' +
      'vram_load routine; then call asm_assemble again. Do NOT hand-write PPU setup, DMA, or VRAM bytes.'
    );
  }
  if (/undefined label "oam_load"/.test(text)) {
    return (
      'oam_load is a GENERATED routine — you do not write it. Call gfx_export_oam with ' +
      '{"destName":"oam.bin","size":"16x16"} (use "8x8" for 8×8 sprites) to compile the 512-byte OAM ' +
      'sprite table, register oam.bin, and append the oam_load routine; then call asm_assemble again. ' +
      'Do NOT hand-write OAM ($2104) or OBJSEL ($2101) bytes. ' +
      'Remember to also call gfx_export_vram first (sprites are colored by the OBJ palette, colors 16–31, ' +
      'which vram_load writes to CGRAM).'
    );
  }
  if (/undefined label "spc_load"/.test(text)) {
    return (
      'spc_load is a GENERATED routine — you do not write it. Call trk_export_spc with ' +
      '{"destName":"spc.bin"} to build the SPC package and append the spc_load routine; then call ' +
      'asm_assemble again. Do NOT hand-write the SPU port handshake.'
    );
  }
  if (/unknown instruction/.test(text)) {
    return (
      'This assembler does not support that instruction. It assembles a 65C816 subset only — do NOT ' +
      'use x=0/x=1, pcsh/pcsw, RTI, or hand-rolled PPU/DMA/SPU writes. For screen and sound bring-up, ' +
      'call gfx_export_vram / trk_export_spc and let their generated glue do that work.'
    );
  }
  if (/invalid number/.test(text) && /[+<>]/.test(text)) {
    return (
      'This assembler has no label arithmetic — you cannot use `label+1` or `<label`/`>label` in an ' +
      'immediate. Remove the hand-rolled byte offsets; gfx_export_vram / trk_export_spc generate the ' +
      'data files for you.'
    );
  }
  return undefined;
}

// --- argument validation (each returns either a value or an error) ----------

interface Field<T> {
  v?: T;
  e?: string;
}

function strF(a: Args, key: string): Field<string> {
  const v = a[key];
  if (typeof v !== 'string' || v.trim() === '') return { e: `"${key}" must be a non-empty string` };
  return { v };
}

function optStrF(a: Args, key: string): Field<string> {
  if (a[key] === undefined || a[key] === null) return {};
  return strF(a, key);
}

function intF(a: Args, key: string, min: number, max: number): Field<number> {
  const v = a[key];
  if (typeof v !== 'number' || !Number.isInteger(v)) return { e: `"${key}" must be an integer` };
  if (v < min || v > max) return { e: `"${key}" must be ${min}–${max} (got ${v})` };
  return { v };
}

function optIntF(a: Args, key: string, min: number, max: number): Field<number> {
  if (a[key] === undefined || a[key] === null) return {};
  return intF(a, key, min, max);
}

function optBoolF(a: Args, key: string): Field<boolean> {
  if (a[key] === undefined || a[key] === null) return {};
  const v = a[key];
  if (typeof v !== 'boolean') return { e: `"${key}" must be true or false` };
  return { v };
}

/** A note: number 0–119 (24 = C, 81 = A4), a name ("A4", "C#5"), or a rest. */
function noteF(a: Args, key: string): Field<number | null> {
  const v = a[key];
  if (v === undefined || v === null) return { v: null };
  if (typeof v === 'number' && Number.isInteger(v) && v >= NOTE_MIN && v <= NOTE_MAX) return { v };
  if (typeof v === 'string') {
    const p = parseNoteName(v);
    if (p.kind === 'rest') return { v: null };
    if (p.kind === 'note') return { v: p.note };
  }
  return {
    e: `"${key}" must be a note number ${NOTE_MIN}–${NOTE_MAX} (24 = C, 81 = A4), a name like "A4"/"C#5", or null for a rest`,
  };
}

// --- byte decoders for asm_add_data_file (pure, no atob) ---------------------

/** "01 02FF :ab" → 3 bytes; `null` when not valid hex. */
export function hexToBytes(hex: string): Uint8Array | null {
  const t = hex.replace(/^0[xX]/, '').replace(/[\s:_.]+/g, '');
  if (t.length === 0 || t.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(t)) return null;
  const out = new Uint8Array(t.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(t.slice(i * 2, i * 2 + 2), 16);
  return out;
}

const B64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_REV: Record<string, number> = {};
for (let i = 0; i < B64_ALPHABET.length; i++) B64_REV[B64_ALPHABET[i]] = i;

/** Standard base64 (optional data-URI prefix / whitespace); `null` when invalid. */
export function base64ToBytes(b64: string): Uint8Array | null {
  const t = b64.replace(/^data:[^,]*,/, '').replace(/\s+/g, '');
  if (t.length === 0 || t.length % 4 !== 0) return null;
  let bits = 0;
  let nbits = 0;
  const out: number[] = [];
  for (const ch of t) {
    if (ch === '=') continue;
    const v = B64_REV[ch];
    if (v === undefined) return null;
    bits = (bits << 6) | v;
    nbits += 6;
    if (nbits >= 8) {
      nbits -= 8;
      out.push((bits >> nbits) & 0xff);
    }
  }
  if (out.length === 0) return null;
  return Uint8Array.from(out);
}

// --- the catalog -------------------------------------------------------------
//
// The `description` strings are the model's API docs — keep them concrete.

const DEFS: ToolDef[] = [
  // ===== asm (65C816 source, data files, build, run) ========================

  {
    name: 'asm_get_source',
    description: 'Get the current 65C816 source on the assembler page.',
    parameters: { type: 'object', properties: {} },
    run: (_a, c) => ok(c.asm.getSource()),
  },
  {
    name: 'asm_set_source',
    description:
      'Replace the entire 65C816 source with a complete program (labels, code, .incbin directives). ' +
      'LoROM: code at file $0000 = CPU $8000 — the assembler and buildRom handle the org/header, so just write the program. ' +
      'Assemble with asm_assemble; it returns per-line errors to fix and retry.',
    parameters: {
      type: 'object',
      properties: { source: { type: 'string', description: 'The complete new 65C816 source' } },
      required: ['source'],
    },
    run: (a, c) => {
      const s = strF(a, 'source');
      if (s.e) return fail(s.e);
      c.asm.setSource(s.v as string);
      return ok({ chars: (s.v as string).length });
    },
  },
  {
    name: 'asm_append_source',
    description: 'Append text to the 65C816 source (data tables, snippets, or loader glue).',
    parameters: {
      type: 'object',
      properties: { text: { type: 'string', description: 'Source text to append' } },
      required: ['text'],
    },
    run: (a, c) => {
      const t = strF(a, 'text');
      if (t.e) return fail(t.e);
      c.asm.appendSource(t.v as string);
      return ok({ appended: (t.v as string).length });
    },
  },
  {
    name: 'asm_list_data_files',
    description: 'List the .incbin data files the program can reference by name (name + byte count).',
    parameters: { type: 'object', properties: {} },
    run: (_a, c) => ok(c.asm.listDataFiles()),
  },
  {
    name: 'asm_add_data_file',
    description:
      'Add (or replace) a small data file the program can `.incbin` by name. Provide the bytes as `hex` ("01 02 FF") or `base64`. ' +
      `Max ${MAX_MANUAL_DATA_BYTES / 1024} KB — for the big images use gfx_export_vram / trk_export_spc instead.`,
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'File name, e.g. "jump.bin"' },
        hex: { type: 'string', description: 'Hex bytes (spaces/colons/dots ok)' },
        base64: { type: 'string', description: 'Base64 bytes' },
      },
      required: ['name'],
    },
    run: (a, c) => {
      const n = strF(a, 'name');
      if (n.e) return fail(n.e);
      const name = n.v as string;
      if (!/^[A-Za-z0-9_.-]+$/.test(name)) return fail(`bad data-file name "${name}"`);
      let bytes: Uint8Array | null = null;
      if (typeof a.hex === 'string') bytes = hexToBytes(a.hex);
      else if (typeof a.base64 === 'string') bytes = base64ToBytes(a.base64);
      if (!bytes) return fail('provide `hex` or `base64` with valid bytes');
      if (bytes.length > MAX_MANUAL_DATA_BYTES) {
        return fail(`data file too large (${bytes.length} > ${MAX_MANUAL_DATA_BYTES} bytes) — use an export tool`);
      }
      c.asm.addDataFile(name, bytes);
      return ok({ name, bytes: bytes.length });
    },
  },
  {
    name: 'asm_remove_data_file',
    description: 'Remove a .incbin data file by name (no-op if absent).',
    parameters: {
      type: 'object',
      properties: { name: { type: 'string' } },
      required: ['name'],
    },
    run: (a, c) => {
      const n = strF(a, 'name');
      if (n.e) return fail(n.e);
      c.asm.removeDataFile(n.v as string);
      return ok({ removed: n.v });
    },
  },
  {
    name: 'asm_assemble',
    description:
      'Assemble the current source with its data files. On failure the result lists per-line errors — ' +
      'fix the source (asm_set_source/asm_append_source) and assemble again.',
    parameters: { type: 'object', properties: {} },
    run: (_a, c) => {
      const r = c.asm.assemble();
      if (r.ok) return ok({ ok: true, byteCount: r.byteCount });
      const hint = assembleHint(r.errors);
      return fail('assemble failed — fix these diagnostics and re-assemble', {
        errors: r.errors,
        ...(hint ? { hint } : {}),
      });
    },
  },
  {
    name: 'asm_build_rom',
    description: 'Build the 256 KB SFC from the last successful assemble (cart header included).',
    parameters: { type: 'object', properties: {} },
    run: (_a, c) => {
      const r = c.asm.buildRom();
      if (r.ok) return ok({ ok: true, bytes: r.bytes });
      const err = r.error ?? 'no successful assemble yet — run asm_assemble first';
      // The 32 KB entry-region blowout is almost always a stale 64 KB vram.bin.
      const hint = /entry region|max \d+ bytes/.test(err)
        ? 'Your code + .incbin data exceed the 32 KB entry region — a stale 64 KB vram.bin is the usual cause. ' +
          'Remove it with asm_remove_data_file, then re-export with gfx_export_vram (it produces a few-KB ' +
          'COMPACT image, not 64 KB), and assemble again. Keep graphics small.'
        : undefined;
      return fail(`buildRom failed: ${err}`, hint ? { hint } : undefined);
    },
  },
  {
    name: 'asm_run',
    description: 'Hand the built ROM to the emulator and run it (browser only).',
    parameters: { type: 'object', properties: {} },
    run: (_a, c) => {
      const r = c.asm.run();
      return r.ok ? ok({ ok: true }) : fail(`run failed: ${r.error ?? 'unknown error'}`);
    },
  },

  // ===== gfx (palette, tiles, tilemap, VRAM) =================================

  {
    name: 'gfx_get_state',
    description: 'Snapshot of the graphics editor: mode, tile count, palette entries, tilemap cells set.',
    parameters: { type: 'object', properties: {} },
    run: (_a, c) => ok(c.gfx.getState()),
  },
  {
    name: 'gfx_set_palette_color',
    description:
      'Set one palette color in 5-bit RGB (r/g/b 0–31). Index 0–15 = background palette; ' +
      'index 16–31 = OBJ/sprite palette (the colors sprites sample). Conventionally index 0 is ' +
      'transparent (pass transparent:true for it).',
    parameters: {
      type: 'object',
      properties: {
        index: { type: 'integer', minimum: 0, maximum: 31 },
        r: { type: 'integer', minimum: 0, maximum: 31 },
        g: { type: 'integer', minimum: 0, maximum: 31 },
        b: { type: 'integer', minimum: 0, maximum: 31 },
        transparent: { type: 'boolean' },
      },
      required: ['index', 'r', 'g', 'b'],
    },
    run: (a, c) => {
      const i = intF(a, 'index', 0, 15);
      const r = intF(a, 'r', 0, 31);
      const g = intF(a, 'g', 0, 31);
      const b = intF(a, 'b', 0, 31);
      const t = optBoolF(a, 'transparent');
      const e = i.e ?? r.e ?? g.e ?? b.e ?? t.e;
      if (e) return fail(e);
      c.gfx.setPaletteColor(i.v as number, r.v as number, g.v as number, b.v as number, t.v ?? false);
      return ok({ index: i.v });
    },
  },
  {
    name: 'gfx_set_tile_pixel',
    description: 'Paint one pixel of a 16×16 tile with palette color 0–15.',
    parameters: {
      type: 'object',
      properties: {
        tile: { type: 'integer', minimum: 0, maximum: 4095 },
        row: { type: 'integer', minimum: 0, maximum: 15 },
        col: { type: 'integer', minimum: 0, maximum: 15 },
        color: { type: 'integer', minimum: 0, maximum: 15 },
      },
      required: ['tile', 'row', 'col', 'color'],
    },
    run: (a, c) => {
      const tile = intF(a, 'tile', 0, 4095);
      const row = intF(a, 'row', 0, 15);
      const col = intF(a, 'col', 0, 15);
      const color = intF(a, 'color', 0, 15);
      const e = tile.e ?? row.e ?? col.e ?? color.e;
      if (e) return fail(e);
      c.gfx.setTilePixel(tile.v as number, row.v as number, col.v as number, color.v as number);
      return ok({});
    },
  },
  {
    name: 'gfx_fill_rect',
    description: 'Fill an inclusive rectangle of one 16×16 tile with a palette color (corners auto-ordered).',
    parameters: {
      type: 'object',
      properties: {
        tile: { type: 'integer', minimum: 0, maximum: 4095 },
        x0: { type: 'integer', minimum: 0, maximum: 15 },
        y0: { type: 'integer', minimum: 0, maximum: 15 },
        x1: { type: 'integer', minimum: 0, maximum: 15 },
        y1: { type: 'integer', minimum: 0, maximum: 15 },
        color: { type: 'integer', minimum: 0, maximum: 15 },
      },
      required: ['tile', 'x0', 'y0', 'x1', 'y1', 'color'],
    },
    run: (a, c) => {
      const tile = intF(a, 'tile', 0, 4095);
      const x0 = intF(a, 'x0', 0, 15);
      const y0 = intF(a, 'y0', 0, 15);
      const x1 = intF(a, 'x1', 0, 15);
      const y1 = intF(a, 'y1', 0, 15);
      const color = intF(a, 'color', 0, 15);
      const e = tile.e ?? x0.e ?? y0.e ?? x1.e ?? y1.e ?? color.e;
      if (e) return fail(e);
      const rx0 = Math.min(x0.v as number, x1.v as number);
      const rx1 = Math.max(x0.v as number, x1.v as number);
      const ry0 = Math.min(y0.v as number, y1.v as number);
      const ry1 = Math.max(y0.v as number, y1.v as number);
      c.gfx.fillTileRect(tile.v as number, rx0, ry0, rx1, ry1, color.v as number);
      return ok({});
    },
  },
  {
    name: 'gfx_add_tile',
    description: 'Add a blank 16×16 tile; returns its index.',
    parameters: { type: 'object', properties: {} },
    run: (_a, c) => ok({ tile: c.gfx.addTile() }),
  },
  {
    name: 'gfx_set_map_entry',
    description: 'Set one SC0 tilemap cell (the 32×32 screen map).',
    parameters: {
      type: 'object',
      properties: {
        col: { type: 'integer', minimum: 0, maximum: 31 },
        row: { type: 'integer', minimum: 0, maximum: 31 },
        tile: { type: 'integer', minimum: 0, maximum: 4095 },
        palette: { type: 'integer', minimum: 0, maximum: 15 },
        flipX: { type: 'boolean' },
        flipY: { type: 'boolean' },
        priority: { type: 'boolean' },
      },
      required: ['col', 'row', 'tile'],
    },
    run: (a, c) => {
      const col = intF(a, 'col', 0, 31);
      const row = intF(a, 'row', 0, 31);
      const tile = intF(a, 'tile', 0, 4095);
      const palette = optIntF(a, 'palette', 0, 15);
      const flipX = optBoolF(a, 'flipX');
      const flipY = optBoolF(a, 'flipY');
      const priority = optBoolF(a, 'priority');
      const e = col.e ?? row.e ?? tile.e ?? palette.e ?? flipX.e ?? flipY.e ?? priority.e;
      if (e) return fail(e);
      c.gfx.setMapEntry(col.v as number, row.v as number, {
        tile: tile.v as number,
        palette: palette.v ?? 0,
        flipX: flipX.v ?? false,
        flipY: flipY.v ?? false,
        priority: priority.v ?? false,
      });
      return ok({});
    },
  },
  {
    name: 'gfx_fill_map',
    description: 'Fill the whole 32×32 SC0 tilemap with one tile (a solid background).',
    parameters: {
      type: 'object',
      properties: {
        tile: { type: 'integer', minimum: 0, maximum: 4095 },
        palette: { type: 'integer', minimum: 0, maximum: 15 },
      },
      required: ['tile'],
    },
    run: (a, c) => {
      const tile = intF(a, 'tile', 0, 4095);
      const palette = optIntF(a, 'palette', 0, 15);
      const e = tile.e ?? palette.e;
      if (e) return fail(e);
      c.gfx.fillMap(tile.v as number, palette.v ?? 0);
      return ok({});
    },
  },
  {
    name: 'gfx_set_map_grid',
    description:
      'Author the 32×32 SC0 tilemap in one call: grid[row][col] = tile index (0–4095). ' +
      'Up to 32 rows × 32 columns; cells outside the grid keep their current tile.',
    parameters: {
      type: 'object',
      properties: {
        grid: {
          type: 'array',
          description: 'Up to 32 rows, each up to 32 tile indices',
          items: { type: 'array', items: { type: 'integer', minimum: 0, maximum: 4095 } },
        },
        palette: { type: 'integer', minimum: 0, maximum: 15 },
      },
      required: ['grid'],
    },
    run: (a, c) => {
      const g = a.grid;
      if (!Array.isArray(g) || g.length === 0 || g.length > 32) {
        return fail('"grid" must be 1–32 rows of tile indices');
      }
      let cols = 0;
      for (const row of g) {
        if (!Array.isArray(row) || row.length === 0 || row.length > 32) {
          return fail('each grid row must have 1–32 cells');
        }
        cols = Math.max(cols, row.length);
        for (const cell of row) {
          if (typeof cell !== 'number' || !Number.isInteger(cell) || cell < 0 || cell > 4095) {
            return fail('grid cells must be tile indices 0–4095');
          }
        }
      }
      const palette = optIntF(a, 'palette', 0, 15);
      if (palette.e) return fail(palette.e);
      c.gfx.setMapFromGrid(g as number[][], palette.v ?? 0);
      return ok({ rows: g.length, cols });
    },
  },

  // --- second tilemap (the runtime-switchable screen) ------------------------
  // Author the ALT tilemap; once any cell is set, gfx_export_vram places it in
  // the next SCBase window and the generated glue emits a `vram_toggle` routine
  // that flips the display between the primary and alt screens.

  {
    name: 'gfx_set_alt_map_entry',
    description:
      'Set one cell of the SECOND (alt) SC0 tilemap — the alternate screen the PPU can be ' +
      'flipped to at runtime (e.g. the lowercase of a screen). Same (col,row) coordinates as the ' +
      'primary map. Setting ANY alt cell activates the runtime toggle (vram_toggle) on export.',
    parameters: {
      type: 'object',
      properties: {
        col: { type: 'integer', minimum: 0, maximum: 31 },
        row: { type: 'integer', minimum: 0, maximum: 31 },
        tile: { type: 'integer', minimum: 0, maximum: 4095 },
        palette: { type: 'integer', minimum: 0, maximum: 15 },
        flipX: { type: 'boolean' },
        flipY: { type: 'boolean' },
        priority: { type: 'boolean' },
      },
      required: ['col', 'row', 'tile'],
    },
    run: (a, c) => {
      const col = intF(a, 'col', 0, 31);
      const row = intF(a, 'row', 0, 31);
      const tile = intF(a, 'tile', 0, 4095);
      const palette = optIntF(a, 'palette', 0, 15);
      const flipX = optBoolF(a, 'flipX');
      const flipY = optBoolF(a, 'flipY');
      const priority = optBoolF(a, 'priority');
      const e = col.e ?? row.e ?? tile.e ?? palette.e ?? flipX.e ?? flipY.e ?? priority.e;
      if (e) return fail(e);
      c.gfx.setAltMapEntry(col.v as number, row.v as number, {
        tile: tile.v as number,
        palette: palette.v ?? 0,
        flipX: flipX.v ?? false,
        flipY: flipY.v ?? false,
        priority: priority.v ?? false,
      });
      return ok({});
    },
  },
  {
    name: 'gfx_fill_alt_map',
    description:
      'Fill the whole SECOND (alt) 32×32 tilemap with one tile (a solid alternate screen). ' +
      'Activates the runtime toggle (vram_toggle) on export.',
    parameters: {
      type: 'object',
      properties: {
        tile: { type: 'integer', minimum: 0, maximum: 4095 },
        palette: { type: 'integer', minimum: 0, maximum: 15 },
      },
      required: ['tile'],
    },
    run: (a, c) => {
      const tile = intF(a, 'tile', 0, 4095);
      const palette = optIntF(a, 'palette', 0, 15);
      const e = tile.e ?? palette.e;
      if (e) return fail(e);
      c.gfx.fillAltMap(tile.v as number, palette.v ?? 0);
      return ok({});
    },
  },
  {
    name: 'gfx_set_alt_map_grid',
    description:
      'Author the SECOND (alt) 32×32 tilemap in one call: grid[row][col] = tile index (0–4095). ' +
      'This is the alternate screen (e.g. the lowercase version of the primary). Activates the ' +
      'runtime toggle (vram_toggle) on export.',
    parameters: {
      type: 'object',
      properties: {
        grid: {
          type: 'array',
          description: 'Up to 32 rows, each up to 32 tile indices',
          items: { type: 'array', items: { type: 'integer', minimum: 0, maximum: 4095 } },
        },
        palette: { type: 'integer', minimum: 0, maximum: 15 },
      },
      required: ['grid'],
    },
    run: (a, c) => {
      const g = a.grid;
      if (!Array.isArray(g) || g.length === 0 || g.length > 32) {
        return fail('"grid" must be 1–32 rows of tile indices');
      }
      let cols = 0;
      for (const row of g) {
        if (!Array.isArray(row) || row.length === 0 || row.length > 32) {
          return fail('each grid row must have 1–32 cells');
        }
        cols = Math.max(cols, row.length);
        for (const cell of row) {
          if (typeof cell !== 'number' || !Number.isInteger(cell) || cell < 0 || cell > 4095) {
            return fail('grid cells must be tile indices 0–4095');
          }
        }
      }
      const palette = optIntF(a, 'palette', 0, 15);
      if (palette.e) return fail(palette.e);
      c.gfx.setAltMapFromGrid(g as number[][], palette.v ?? 0);
      return ok({ rows: g.length, cols });
    },
  },
  {
    name: 'gfx_set_oam_entry',
    description:
      'Place or update one SPRITE (OBJ slot 0–127). `tile` (0–511) is an 8×8 char index: for an 8×8 sprite ' +
      'it IS the whole sprite; for a 16×16 sprite it is the TOP-LEFT char of the 2×2 block — paint that 2×2 ' +
      'and pick a top-left on an even char column (e.g. 0, 2, 4; the SNES lays chars 16 per row, so the block ' +
      'is tile, tile+1, tile+16, tile+17 — the bottom pair sits 16 chars below, not 8). Which size you render ' +
      'at is set GLOBALLY at export via gfx_export_oam `size` ' +
      '(8×8 or 16×16). The sprite is colored by the OBJ palette (gfx_set_palette_color index 16–31 — NOT the ' +
      '0–15 background palette). `x`/`y` = screen position (0–255); `flipH`/`flipV` mirror it; `priority` 0–3 ' +
      'for draw order — 0–1 draws the sprite UNDER the background, 2–3 draws it OVER the background, so use ' +
      '2 or 3 when the sprite sits on a painted background (default 0 = invisible behind a full-screen BG). ' +
      'Pass `hide:true` to remove the sprite from that slot.',
    parameters: {
      type: 'object',
      properties: {
        slot: { type: 'integer', minimum: 0, maximum: 127 },
        tile: { type: 'integer', minimum: 0, maximum: 511, description: '8×8 char index — the whole 8×8 sprite, or the top-left char of the 16×16 block (even column; the block is tile, tile+1, tile+16, tile+17)' },
        x: { type: 'integer', minimum: 0, maximum: 255 },
        y: { type: 'integer', minimum: 0, maximum: 255 },
        flipH: { type: 'boolean' },
        flipV: { type: 'boolean' },
        priority: { type: 'integer', minimum: 0, maximum: 3, description: '0–3. 0–1 = sprite under the background, 2–3 = sprite over it. Default 0 — use 2 or 3 so a sprite over a painted background is visible.' },
        hide: { type: 'boolean', description: 'true = hide this slot (clears it)' },
      },
      required: ['slot'],
    },
    run: (a, c) => {
      const slot = intF(a, 'slot', 0, 127);
      if (slot.e) return fail(slot.e);
      if (a.hide === true || a.hide === 'true') {
        c.gfx.setOamEntry(slot.v as number, null);
        return ok({ slot: slot.v, hidden: true });
      }
      const tile = intF(a, 'tile', 0, 511);
      const x = intF(a, 'x', 0, 255);
      const y = intF(a, 'y', 0, 255);
      const flipH = optBoolF(a, 'flipH');
      const flipV = optBoolF(a, 'flipV');
      const priority = optIntF(a, 'priority', 0, 3);
      const e = tile.e ?? x.e ?? y.e ?? flipH.e ?? flipV.e ?? priority.e;
      if (e) return fail(e + ' (tile/x/y are required unless hide:true)');
      c.gfx.setOamEntry(slot.v as number, {
        tile: tile.v as number,
        x: x.v as number,
        y: y.v as number,
        flipH: flipH.v ?? false,
        flipV: flipV.v ?? false,
        priority: priority.v ?? 0,
      });
      return ok({ slot: slot.v, tile: tile.v });
    },
  },
  {
    name: 'gfx_clear_oam',
    description: 'Hide EVERY sprite slot (128 slots) — start clean before placing sprites.',
    parameters: { type: 'object', properties: {} },
    run: (_a, c) => {
      c.gfx.clearOam();
      return ok({ cleared: 128 });
    },
  },
  {
    name: 'gfx_export_vram',
    description:
      'Compile the graphics into a COMPACT VRAM image (only the used palette + tiles + tilemap — a few KB, ' +
      'not 64 KB). With `destName` (standard name "vram.bin"), also register it on the assembler page as an ' +
      '`.incbin` data file AND append the self-contained 65C816 bring-up routine (`vram_load`) to the asm ' +
      'source. The program then only needs `JSR vram_load` at startup — no manual PPU setup or DMA required. ' +
      'If a SECOND tilemap was authored (gfx_set_alt_map_*), the glue ALSO emits `vram_toggle`, which flips ' +
      'the display between the primary and alt screens at runtime — JSR it to switch. The result\'s ' +
      'layout.toggleAvailable tells you whether vram_toggle was emitted.',
    parameters: {
      type: 'object',
      properties: {
        destName: { type: 'string', description: 'Data-file name, e.g. "vram.bin"' },
      },
    },
    run: (a, c) => {
      const compact = c.gfx.buildVramCompact();
      const bytes = compact.blob;
      const dn = optStrF(a, 'destName');
      if (dn.e) return fail(dn.e);
      const layout = {
        bytes: bytes.length,
        blocks: compact.blocks.length,
        mapBase: compact.mapBase,
        altMapBase: compact.altMapBase,
        toggleAvailable: !!compact.altMapBase,
        bgmode: compact.bgmode,
      };
      if (dn.v) {
        c.asm.addDataFile(dn.v, bytes);
        // Idempotent: replaces any previous vram glue block, so re-exporting
        // after painting more tiles can't produce a duplicate `vram_load` label.
        upsertGlue(c, 'gfx', c.gfx.vramGlue(dn.v));
        return ok({ bytes: bytes.length, dataFile: dn.v, glueAppended: true, layout });
      }
      return ok({ bytes: bytes.length, glue: c.gfx.vramGlue(), layout });
    },
  },
  {
    name: 'gfx_export_oam',
    description:
      'Compile the 128 SPRITE (OBJ) slots into the 512-byte OAM table. With `destName` (standard name ' +
      '"oam.bin"), also register it on the assembler page as an `.incbin` data file AND append the ' +
      'self-contained 65C816 `oam_load` routine to the asm source. The program then calls `JSR vram_load` ' +
      'at startup, then `JSR oam_load` once sprites are placed — no manual OAM/OBJSEL/TM writes needed. ' +
      '`size` sets the GLOBAL sprite size baked into OBJSEL (the ONE size every sprite draws at): ' +
      '"8x8" or "16x16" (default "16x16"). IMPORTANT: vram_load must come first (it writes the OBJ palette ' +
      'into CGRAM palette 8); oam_load then points OBJ at the sprite slots. Export after you are done ' +
      'placing sprites so the table is final.',
    parameters: {
      type: 'object',
      properties: {
        destName: { type: 'string', description: 'Data-file name, e.g. "oam.bin"' },
        size: { type: 'string', enum: ['8x8', '16x16'], description: 'Global sprite size for this ROM: "8x8" or "16x16" (default "16x16")' },
      },
    },
    run: (a, c) => {
      const bytes = c.gfx.buildOam();
      const dn = optStrF(a, 'destName');
      if (dn.e) return fail(dn.e);
      const sizeRaw = typeof a.size === 'string' ? a.size.toLowerCase() : '';
      const size: OamSize = sizeRaw === '8x8' || sizeRaw === '8×8' ? '8x8' : '16x16';
      if (dn.v) {
        c.asm.addDataFile(dn.v, bytes);
        // Idempotent: replaces any previous oam glue block (no duplicate `oam_load` label).
        upsertGlue(c, 'oam', c.gfx.oamGlue(dn.v, size));
        return ok({ bytes: bytes.length, dataFile: dn.v, glueAppended: true, size });
      }
      return ok({ bytes: bytes.length, glue: c.gfx.oamGlue(undefined, size), size });
    },
  },

  // ===== trk (song, instruments, SPC package) ===============================

  {
    name: 'trk_get_song',
    description:
      'Summarize the current song: name, tempo (rows/s), play order, patterns (rows + filled-cell counts), ' +
      'instruments.',
    parameters: { type: 'object', properties: {} },
    run: (_a, c) => {
      const summary = summarizeSong(c.track.getSong());
      if (typeof summary.error === 'string') return fail(summary.error);
      return ok(summary);
    },
  },
  {
    name: 'trk_set_cell',
    description:
      'Set one cell of a pattern. `note`: a number 0–119 (24 = C, 81 = A4), a name like "A4"/"C#5", or null for a rest. ' +
      'Channels 0–7 (8 S-DSP voices). `inst` defaults 0, `vol` 0–15 defaults 12.',
    parameters: {
      type: 'object',
      properties: {
        pattern: { type: 'integer', minimum: 0 },
        row: { type: 'integer', minimum: 0 },
        channel: { type: 'integer', minimum: 0, maximum: 7 },
        note: { type: ['integer', 'string', 'null'], description: 'Note number, name, or null (rest)' },
        inst: { type: 'integer', minimum: 0 },
        vol: { type: 'integer', minimum: 0, maximum: 15 },
      },
      required: ['pattern', 'row', 'channel'],
    },
    run: (a, c) => {
      const pattern = intF(a, 'pattern', 0, 999);
      const row = intF(a, 'row', 0, 4095);
      const channel = intF(a, 'channel', 0, 7);
      const note = noteF(a, 'note');
      const inst = optIntF(a, 'inst', 0, 63);
      const vol = optIntF(a, 'vol', 0, 15);
      const e = pattern.e ?? row.e ?? channel.e ?? note.e ?? inst.e ?? vol.e;
      if (e) return fail(e);
      const applied = c.track.setCell(
        pattern.v as number,
        row.v as number,
        channel.v as number,
        note.v ?? null,
        inst.v ?? 0,
        vol.v ?? 12,
      );
      return applied ? ok({ applied: true }) : fail('cell not applied (pattern or row out of range?)');
    },
  },
  {
    name: 'trk_set_pattern',
    description:
      'Author many cells of one pattern in a single call. `cells`: [{ row, channel, note?, inst?, vol? }] — ' +
      'note a number 0–119, a name "A4"/"C#5", or null to clear; inst defaults 0, vol 12.',
    parameters: {
      type: 'object',
      properties: {
        pattern: { type: 'integer', minimum: 0 },
        cells: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              row: { type: 'integer', minimum: 0 },
              channel: { type: 'integer', minimum: 0, maximum: 7 },
              note: { type: ['integer', 'string', 'null'] },
              inst: { type: 'integer', minimum: 0 },
              vol: { type: 'integer', minimum: 0, maximum: 15 },
            },
            required: ['row', 'channel'],
          },
        },
      },
      required: ['pattern', 'cells'],
    },
    run: (a, c) => {
      const pattern = intF(a, 'pattern', 0, 999);
      if (pattern.e) return fail(pattern.e);
      const raw = a.cells;
      if (!Array.isArray(raw) || raw.length === 0) return fail('"cells" must be a non-empty array');
      const cells: { row: number; channel: number; note: number | null; inst: number; vol: number }[] = [];
      for (let k = 0; k < raw.length; k++) {
        const o = (raw[k] ?? {}) as Args;
        const row = intF(o, 'row', 0, 4095);
        const channel = intF(o, 'channel', 0, 7);
        const note = noteF(o, 'note');
        const inst = optIntF(o, 'inst', 0, 63);
        const vol = optIntF(o, 'vol', 0, 15);
        const e = row.e ?? channel.e ?? note.e ?? inst.e ?? vol.e;
        if (e) return fail(`cells[${k}]: ${e}`);
        cells.push({
          row: row.v as number,
          channel: channel.v as number,
          note: note.v ?? null,
          inst: inst.v ?? 0,
          vol: vol.v ?? 12,
        });
      }
      const applied = c.track.setPatternCells(pattern.v as number, cells);
      if (applied === 0) return fail(`no cells applied (pattern ${pattern.v} out of range?)`, { total: cells.length });
      return ok({ applied, total: cells.length });
    },
  },
  {
    name: 'trk_set_tempo',
    description: 'Set the song speed in rows per second (8 ≈ 120 BPM at 4 rows per beat).',
    parameters: {
      type: 'object',
      properties: { rowsPerSecond: { type: 'integer', minimum: 1, maximum: 255 } },
      required: ['rowsPerSecond'],
    },
    run: (a, c) => {
      const t = intF(a, 'rowsPerSecond', 1, 255);
      if (t.e) return fail(t.e);
      c.track.setTempo(t.v as number);
      return ok({ rowsPerSecond: t.v });
    },
  },
  {
    name: 'trk_set_orders',
    description: 'Set the play order (list of pattern indices, in order).',
    parameters: {
      type: 'object',
      properties: { orders: { type: 'array', items: { type: 'integer', minimum: 0 } } },
      required: ['orders'],
    },
    run: (a, c) => {
      const o = a.orders;
      if (
        !Array.isArray(o) ||
        o.length === 0 ||
        !o.every((x) => typeof x === 'number' && Number.isInteger(x) && x >= 0 && x <= 999)
      ) {
        return fail('"orders" must be a non-empty array of pattern indices ≥ 0');
      }
      c.track.setOrders(o as number[]);
      return ok({ orders: o });
    },
  },
  {
    name: 'trk_add_pattern',
    description: 'Add a blank pattern; returns its index.',
    parameters: { type: 'object', properties: {} },
    run: (_a, c) => ok({ pattern: c.track.addPattern() }),
  },
  {
    name: 'trk_add_instrument',
    description: 'Add a preset instrument (lead | bass | noise | pad); returns its index.',
    parameters: {
      type: 'object',
      properties: { kind: { type: 'string', enum: ['lead', 'bass', 'noise', 'pad'] } },
      required: ['kind'],
    },
    run: (a, c) => {
      const k = strF(a, 'kind');
      if (k.e) return fail(k.e);
      const kind = k.v as string;
      if (!['lead', 'bass', 'noise', 'pad'].includes(kind)) return fail('kind must be one of lead|bass|noise|pad');
      return ok({ inst: c.track.addInstrument(kind) });
    },
  },
  {
    name: 'trk_preview',
    description: 'Play the song in the browser (Web Audio preview — not the SNES SPU).',
    parameters: { type: 'object', properties: {} },
    run: (_a, c) => {
      const r = c.track.preview();
      return r.ok ? ok({ ok: true }) : fail(`preview failed: ${r.error ?? 'unavailable in this environment'}`);
    },
  },
  {
    name: 'trk_stop',
    description: 'Stop the browser preview.',
    parameters: { type: 'object', properties: {} },
    run: (_a, c) => {
      const r = c.track.stop();
      return r.ok ? ok({ ok: true }) : fail(`stop failed: ${r.error ?? 'unknown error'}`);
    },
  },
  {
    name: 'trk_export_spc',
    description:
      'Build the in-ROM SPC700 song package (BRR samples + minimal driver). With `destName` (standard name ' +
      '"spc.bin"), also register it on the assembler page as an `.incbin` data file AND append the 65C816 ' +
      'loader glue to the asm source. Returns the SPC-RAM layout. EXPERIMENTAL: SPU playback is minimal.',
    parameters: {
      type: 'object',
      properties: {
        destName: { type: 'string', description: 'Data-file name, e.g. "spc.bin"' },
      },
    },
    run: (a, c) => {
      const bytes = c.track.buildSpc();
      const dn = optStrF(a, 'destName');
      if (dn.e) return fail(dn.e);
      const layout = c.track.spcLayout();
      if (dn.v) {
        c.asm.addDataFile(dn.v, bytes);
        // Idempotent: replaces any previous spc glue block (see `upsertGlue`).
        upsertGlue(c, 'spc', c.track.spcGlue(dn.v));
        return ok({ bytes: bytes.length, dataFile: dn.v, glueAppended: true, layout });
      }
      return ok({ bytes: bytes.length, glue: c.track.spcGlue(), layout });
    },
  },
];

/** The JSON-Schema tool specs sent to Ollama (derived from the catalog). */
export const TOOL_SPECS: ToolSpec[] = DEFS.map((d) => ({
  type: 'function',
  function: { name: d.name, description: d.description, parameters: d.parameters },
}));

const HANDLERS: Record<string, Handler> = {};
for (const d of DEFS) HANDLERS[d.name] = d.run;

/** All tool names (for prompts/errors), in catalog order. */
export function toolNames(): string[] {
  return DEFS.map((d) => d.name);
}

/**
 * Dispatch one tool call. NEVER throws: unknown tools and malformed arguments
 * become a clean `ok:false` result whose `content` the model can read and act
 * on. A throwing controller is caught and reported the same way.
 */
export function dispatchTool(name: string, args: Args, ctx: ToolCtx): ToolResult {
  const h = HANDLERS[name];
  if (!h) return fail(`unknown tool "${name}"`, { tools: toolNames() });
  try {
    return h(args ?? {}, ctx.controllers);
  } catch (err) {
    return fail(`tool "${name}" crashed: ${(err as Error).message}`);
  }
}

// --- helpers -----------------------------------------------------------------

/** Compact view of a `.snc` JSON doc (drops the sample arrays). */
function summarizeSong(json: string): Record<string, unknown> {
  let d: unknown;
  try {
    d = JSON.parse(json);
  } catch {
    return { error: 'song JSON is malformed' };
  }
  const doc = d as {
    name?: unknown;
    tempo?: unknown;
    orders?: unknown;
    patterns?: unknown[];
    instruments?: { name?: unknown; baseFreq?: unknown }[];
  };
  const patterns = Array.isArray(doc.patterns) ? doc.patterns : [];
  return {
    name: doc.name ?? null,
    tempo: doc.tempo ?? null,
    orders: Array.isArray(doc.orders) ? doc.orders : [],
    patterns: patterns.length,
    patternRows: patterns.map((p) => (Array.isArray(p) ? p.length : 0)),
    filledPerPattern: patterns.map((p) =>
      Array.isArray(p)
        ? p.reduce(
            (n: number, row) =>
              n + (Array.isArray(row) ? row.filter((cell) => Array.isArray(cell) && cell[0] !== null).length : 0),
            0,
          )
        : 0,
    ),
    instruments: Array.isArray(doc.instruments)
      ? doc.instruments.map((i) => ({ name: i?.name ?? null, baseFreq: i?.baseFreq ?? null }))
      : [],
  };
}
