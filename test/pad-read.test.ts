/**
 * `pad_read` — the SNES controller-1 contract, proven on the REAL snes9x core.
 *
 * Background (the bug this file exists for): the app's documented contract was
 * "A = $01 bit of `lda $4016`, active-LOW". In this snes9x fork that is wrong:
 *   * $4016 is the NES-style SERIAL port — it returns a single bit (the B
 *     button, as bit 0) plus OpenBus garbage. A lives there NOWHERE.
 *   * The SNES-style registers are $4218 (JOY1L) and $4219 (JOY1H), filled
 *     every frame by S9xDoAutoJoypad from the same joypad[] state that
 *     core_set_controller writes:
 *       $4218: bit7=A  bit6=X  bit5=L  bit4=R
 *       $4219: bit7=B  bit6=Y  bit5=SELECT  bit4=START
 *              bit3=UP  bit2=DOWN  bit1=LEFT  bit0=RIGHT
 *     bit SET = pressed (active-HIGH). (snes9x.h SNES_*_MASK + SNES manual.)
 *
 * So the old recipe (`and #$01` on the $4016 byte, active-LOW) can NEVER see
 * an A press — exactly the "button doesn't toggle the screen" failure.
 *
 * This file pins both halves:
 *   1. core-free: the generated glue reads $4219→X and $4218→A, never $4016.
 *   2. real core: a ROM written EXACTLY as the system-prompt recipe
 *      (jsr pad_read / and #$80 gating jsr vram_toggle) flips white → red the
 *      moment the app sets BTN.A, holds while the button is held, and flips
 *      back after release + re-press. Same for B, through the X byte.
 */
import { describe, expect, it, beforeAll } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { WasmCore } from '../src/core/wasm-core';
import type { S9xModule } from '../src/core/wasm-core';
import { BTN } from '../src/core/types';
import { assemble } from '../src/asm/assembler';
import { buildRom } from '../src/asm/rom';
import { buildVramCompact, vramGlue } from '../src/gfx/vram';
import type { Rgb15 } from '../src/gfx/palette';
import type { TilemapEntry } from '../src/gfx/tilemap';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const JS = resolve(root, 'public/core/build/snes9x.js');
const WASM = resolve(root, 'public/core/build/snes9x.wasm');
const haveBuild = existsSync(JS) && existsSync(WASM);

// ---------------------------------------------------------------------------
// Two SOLID screens: primary = white, alt = red (same build as vram-toggle).
// ---------------------------------------------------------------------------

function twoScreenGraphics() {
  const size = 8; // mode 0 → 4-bit 8×8 tiles
  const solid = (idx: number): number[][] =>
    Array.from({ length: size }, () => Array.from({ length: size }, () => idx));
  const tiles = [solid(1), solid(2)]; // tile 0 = white, tile 1 = red
  const palette: Rgb15[] = Array.from({ length: 16 }, (_, i) => {
    if (i === 0) return { r: 0, g: 0, b: 0, transparent: true };
    if (i === 1) return { r: 31, g: 31, b: 31, transparent: false }; // white
    if (i === 2) return { r: 31, g: 0, b: 0, transparent: false }; // red
    return { r: 0, g: 0, b: 0, transparent: false }; // opaque black
  });
  const full = (tile: number): TilemapEntry[] =>
    Array.from({ length: 1024 }, () => ({ tile, palette: 0, flipX: false, flipY: false, priority: false }));
  return { tiles, palette, primary: full(0), alt: full(1) };
}

function composeRom(program: string, glue: string, blob: Uint8Array): Uint8Array {
  const r = assemble(program + '\n' + glue, 0x008000, { 'vram.bin': blob });
  if (!r.ok) throw new Error('assemble failed: ' + r.errors.map((e) => `${e.line}: ${e.message}`).join('; '));
  return buildRom(r.bytes, { title: 'PADRD' });
}

function twoScreenRom(program: string): Uint8Array {
  const { tiles, palette, primary, alt } = twoScreenGraphics();
  const compact = buildVramCompact({
    mode: 0, tiles, palettes: [palette], tilemap: primary, altTilemap: alt,
    tileBase: 0, paletteBase: 0, mapBase: 0x8000,
  });
  const glue = vramGlue(compact.mapBase, compact.bgmode, compact.blocks, 'vram.bin', compact.altMapBase);
  return composeRom(program, glue, compact.blob);
}

// --- core-free: the generated glue reads the SNES joypad registers ----------

describe('vramGlue — pad_read contract (core-free)', () => {
  it('reads $4219 into X and $4218 into A — and never touches $4016', () => {
    const { tiles, palette, primary, alt } = twoScreenGraphics();
    const compact = buildVramCompact({
      mode: 0, tiles, palettes: [palette], tilemap: primary, altTilemap: alt,
      tileBase: 0, paletteBase: 0, mapBase: 0x8000,
    });
    const g = vramGlue(compact.mapBase, compact.bgmode, compact.blocks, 'vram.bin', compact.altMapBase);
    // The exact sequence: high byte → X, low byte → A, return.
    expect(g).toMatch(/pad_read:[\s\S]*?lda \$4219[\s\S]*?tax[\s\S]*?lda \$4218[\s\S]*?rts/);
    // The old (wrong) contract must be gone from the glue.
    expect(g).not.toContain('lda $4016');
  });
});

// --- real core: the pad-driven toggle, exactly as the system prompt says ----

describe.skipIf(!haveBuild)('pad_read drives the REAL snes9x core', () => {
  let core: WasmCore;

  beforeAll(async () => {
    const src = readFileSync(JS, 'utf8');
    const factory = new Function(`${src}\n;return snesWasm;`)() as unknown as (m: object) => Promise<S9xModule>;
    const wasmB64 = readFileSync(WASM, 'base64');
    const M = await factory({
      locateFile: (f: string) => (f === 'snes9x.wasm' ? `data:application/wasm;base64,${wasmB64}` : f),
      print: () => {}, printErr: () => {}, out: () => {}, err: () => {},
    });
    core = new WasmCore(M, []);
  }, 60_000);

  /** Average screen RGB + non-black pixel count (the current frame). */
  function probe() {
    const vf = core.lastVideo();
    let r = 0, g = 0, b = 0, nonBlack = 0;
    const total = vf.data.length / 4;
    for (let i = 0; i < vf.data.length; i += 4) {
      const pr = vf.data[i], pg = vf.data[i + 1], pb = vf.data[i + 2];
      r += pr; g += pg; b += pb;
      if (pr !== 0 || pg !== 0 || pb !== 0) nonBlack++;
    }
    return { r: r / total, g: g / total, b: b / total, nonBlack, total };
  }
  const frames = (n: number) => { for (let i = 0; i < n; i++) core.frame(); };
  const isWhite = (p: ReturnType<typeof probe>) => p.nonBlack > p.total * 0.5 && p.r > 200 && p.g > 200 && p.b > 200;
  const isRed = (p: ReturnType<typeof probe>) => p.nonBlack > p.total * 0.5 && p.r > 200 && p.g < 60 && p.b < 60;

  it('pressing A flips white → red; release + re-press flips back (the user scenario)', async () => {
    // EXACTLY the recipe the agent system prompt tells the LLM to write.
    const rom = twoScreenRom([
      'reset:',
      '  jsr vram_load          ; PPU bring-up + load BOTH tilemaps',
      'waitA:',
      '  jsr pad_read',
      '  and #$80               ; A-bit of $4218: SET = pressed',
      '  beq waitA              ; A not pressed -> keep polling',
      '  jsr vram_toggle        ; A pressed -> flip the screen',
      'rel:',
      '  jsr pad_read',
      '  and #$80',
      '  bne rel                ; still held -> wait for release',
      '  bra waitA',
    ].join('\n'));

    await core.loadRom(rom);
    core.setController(1, 0);
    frames(8);
    const idle = probe();
    console.log(`[A idle    ] rgb=(${idle.r.toFixed(1)},${idle.g.toFixed(1)},${idle.b.toFixed(1)})`);
    expect(isWhite(idle), 'no A press -> screen stays white (no toggle)').toBe(true);

    core.setController(1, BTN.A); // app mask bit 8 = A
    frames(6);
    const pressed = probe();
    console.log(`[A pressed ] rgb=(${pressed.r.toFixed(1)},${pressed.g.toFixed(1)},${pressed.b.toFixed(1)})`);
    expect(isRed(pressed), 'A press -> vram_toggle fired -> screen is red').toBe(true);

    frames(6); // still holding A: the ROM must be in release-wait, NOT re-toggling
    const held = probe();
    expect(isRed(held), 'A held -> no second toggle (release-wait loop)').toBe(true);

    core.setController(1, 0); // release
    frames(6);
    const released = probe();
    expect(isRed(released), 'A released -> still red (no spurious toggle)').toBe(true);

    core.setController(1, BTN.A); // press again
    frames(6);
    const again = probe();
    console.log(`[A re-press] rgb=(${again.r.toFixed(1)},${again.g.toFixed(1)},${again.b.toFixed(1)})`);
    expect(isWhite(again), 'release + re-press -> toggled back to white').toBe(true);
  }, 90_000);

  it('pressing B flips too — the high byte comes back in X (txa path)', async () => {
    const rom = twoScreenRom([
      'reset:',
      '  jsr vram_load',
      'waitB:',
      '  jsr pad_read',
      '  txa                    ; B lives in the $4219 byte (X register)',
      '  and #$80               ; B-bit of $4219: SET = pressed',
      '  beq waitB',
      '  jsr vram_toggle',
      'rel:',
      '  jsr pad_read',
      '  txa',
      '  and #$80',
      '  bne rel',
      '  bra waitB',
    ].join('\n'));

    await core.loadRom(rom);
    core.setController(1, 0);
    frames(8);
    const idle = probe();
    expect(isWhite(idle)).toBe(true);

    core.setController(1, BTN.B); // app mask bit 0 = B
    frames(6);
    const pressed = probe();
    console.log(`[B pressed ] rgb=(${pressed.r.toFixed(1)},${pressed.g.toFixed(1)},${pressed.b.toFixed(1)})`);
    expect(isRed(pressed), 'B press (via X byte) -> toggle fired').toBe(true);

    core.setController(1, 0);
    frames(6);
  }, 90_000);
});

describe('harness availability', () => {
  it('records whether the wasm build is present (so CI degrades, not breaks)', () => {
    expect(haveBuild).toBeTypeOf('boolean');
    if (!haveBuild) console.warn('[pad-read] snes9x.{js,wasm} absent — skipping real-core runs');
  });
});
