/**
 * Mode 7 (BG1 affine) zoom, end-to-end, on the REAL snes9x core.
 *
 * The program is written EXACTLY as the system-prompt recipe:
 *
 *   reset:
 *     jsr mode7_init
 *   idle:
 *     bra idle
 *
 * `mode7_init` streams the 32 KB checkerboard field from the ROM HIGH BANK
 * (CPU bank $01, base $8000 — the `lda $01:8000,X` 0xBF sweep) into VRAM,
 * enables Mode 7, pins the centre/offsets, writes the initial matrix, and
 * arms the once-per-vblank NMI. `mode7_tick` (run by the shared NMI dispatcher
 * `nmiGlue`/`nmi_move`) advances the baked table index and re-writes A/B/C/D
 * to $211b–$211e every frame. So the ROM never does any math — the matrix is
 * precomputed in TS, baked as a byte table, and the 65C816 only steps an index
 * and blits bytes. This proves on the real PPU, on-screen:
 *
 *   1. the screen is a checkerboard (bright AND dark) — Mode 7 is on and the
 *      high-bank field actually reached VRAM (a black/white solid fill would
 *      mean the field never loaded or Mode 7 is off);
 *   2. the field SCALES across a cycle — a fixed central window's bright
 *      coverage changes frame to frame, which only a live per-frame A/B/C/D
 *      write (the NMI-tick'd matrix) can do. A static matrix would show the
 *      SAME coverage every frame.
 *
 * The probe is a SMALL central window, deliberately: a checkerboard keeps its
 * white FRACTION (~50%) at any scale, so the whole-screen white count is
 * zoom-invariant. But the CELL SIZE changes (zoom-in grows 16px cells
 * 0.5×→2.0×, i.e. 8px→32px on screen), so a fixed 32×32 window's bright count
 * swings from "straddles ~9 cells (≈half bright)" to "fits inside one cell
 * (≈all or ≈none bright)" as it zooms. That swing is the proof.
 *
 * (The core-free glue/dispatcher contracts live in test/mode7.test.ts; this
 * file is the real-PPU proof, the way test/anim-core.test.ts is for the
 * char-swap. Skipped when the wasm build is absent.)
 */
import { describe, expect, it, beforeAll } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { WasmCore } from '../src/core/wasm-core';
import type { S9xModule } from '../src/core/wasm-core';
import { assemble } from '../src/asm/assembler';
import { buildRomFromResult } from '../src/asm/rom';
import { nmiGlue, scrollStepsFromSource } from '../src/gfx/scroll';
import { mode7Glue, mode7FieldBytes } from '../src/gfx/mode7';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const JS = resolve(root, 'public/core/build/snes9x.js');
const WASM = resolve(root, 'public/core/build/snes9x.wasm');
const haveBuild = existsSync(JS) && existsSync(WASM);

const SPEED = 60; // frames per full zoom cycle (0.5× → 2.0×)

/**
 * The Mode 7 ROM: the EXACT system-prompt program (init once, then idle), the
 * mode7 glue, the shared NMI dispatcher, and the 32 KB field in the HIGH BANK
 * (which `mode7_init` reads at runtime with the `lda $01:8000,X` sweep — it is
 * NOT a `.incbin` data file, so `assemble` gets no data files here).
 */
function mode7Rom(): Uint8Array {
  const program = ['reset:', '  jsr mode7_init', 'idle:', '  bra idle'].join('\n');
  const glue = mode7Glue({ kind: 'zoom', dir: 'in', speed: SPEED });
  const nmi = nmiGlue(scrollStepsFromSource(glue));
  const r = assemble(program + '\n' + glue + (nmi ? '\n' + nmi : ''), 0x008000);
  if (!r.ok) throw new Error('assemble failed: ' + r.errors.map((e) => `${e.line}: ${e.message}`).join('; '));
  return buildRomFromResult(r, { title: 'MODE7', highBank: mode7FieldBytes() });
}

describe.skipIf(!haveBuild)('Mode 7 (BG1 affine) zoom on the REAL snes9x core', () => {
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
    await core.loadRom(mode7Rom());
  }, 60_000);

  /**
   * Wait for the boot-time field upload to finish and Mode 7 to show its
   * checkerboard. The 32 KB VRAM stream runs in the 65C816 at boot, and under
   * snes9x's wall-clock throttle it takes ~a dozen rendered frames to land
   * (Mode 7 itself is only enabled at the END of `mode7_init`), so a fixed
   * "frame once" is too early: the screen is still the black backdrop. Instead
   * poll the rendered frame — the bright-pixel count jumps from ~0 (black) to
   * ~28 k (the checkerboard) the moment the field is up and BGMODE=7. Returns
   * how many frames it took (0 if it was already up — idempotent, so calling it
   * in both tests is safe).
   */
  function settle(maxFrames = 40): number {
    const bright = (): number => {
      const vf = core.lastVideo();
      let b = 0;
      for (let i = 0; i < vf.data.length; i += 4) {
        if (vf.data[i] > 110 && vf.data[i + 1] > 110 && vf.data[i + 2] > 110) b++;
      }
      return b;
    };
    let f = 0;
    while (f < maxFrames && bright() < 5000) {
      core.frame();
      f++;
    }
    return f;
  }

  /**
   * Bright (field "white" = CGRAM[1] $7fff) vs dark (transparent → backdrop)
   * counts for one frame: `whole` across the whole screen, `center` in a fixed
   * 32×32 window at the screen centre (the zoom-sensitive probe).
   */
  function counts(): { wholeBright: number; wholeDark: number; total: number; centerBright: number; center: number } {
    const vf = core.lastVideo();
    let wholeBright = 0, wholeDark = 0, centerBright = 0;
    const total = vf.width * vf.height;
    const center = 32 * 32;
    for (let y = 0; y < vf.height; y++) {
      for (let x = 0; x < vf.width; x++) {
        const idx = (y * vf.width + x) * 4;
        const r = vf.data[idx], g = vf.data[idx + 1], b = vf.data[idx + 2];
        const bright = r > 110 && g > 110 && b > 110;
        if (bright) wholeBright++; else wholeDark++;
        // Central 32×32 window (centre = 128,112): x 112..143, y 96..127.
        if (x >= 112 && x < 144 && y >= 96 && y < 128 && bright) centerBright++;
      }
    }
    return { wholeBright, wholeDark, total, centerBright, center };
  }

  it('1. the screen is a checkerboard (bright AND dark) — the field loaded, Mode 7 on', () => {
    // Let the boot-time field upload land in VRAM and Mode 7 be enabled before
    // reading (the upload runs in the 65C816 at boot and takes a few frames
    // under the core's wall-clock throttle — see `settle`).
    settle();
    const s = counts();
    // Both colours present: this is a two-colour checkerboard, NOT a solid
    // fill. A solid black (field never loaded / Mode 7 off) → wholeBright 0.
    // A solid white → wholeDark 0. Both must be non-trivial.
    expect(s.wholeBright).toBeGreaterThan(s.total * 0.15);
    expect(s.wholeDark).toBeGreaterThan(s.total * 0.15);
    // And the central window is not solid either (mix of both colours).
    expect(s.centerBright).toBeGreaterThan(0);
    expect(s.centerBright).toBeLessThan(s.center);
  }, 90_000);

  it('2. the field SCALES — the central window\'s bright coverage changes across a cycle', () => {
    // Make sure the upload has landed (idempotent if test 1 already settled it),
    // then sample one full zoom cycle.
    settle();
    const counts_ = new Array<number>(SPEED);
    for (let i = 0; i < SPEED; i++) {
      core.frame();
      counts_[i] = counts().centerBright;
    }
    const min = Math.min(...counts_);
    const max = Math.max(...counts_);
    const distinct = new Set(counts_).size;
    // A working zoom-in: the central window's bright count sweeps from ~50%
    // (straddles several small cells) to ~all-or-none (one big cell) as the
    // cells grow — so coverage changes meaningfully AND through several values.
    // A static matrix would hold ONE coverage value every frame.
    expect(distinct).toBeGreaterThanOrEqual(4);
    expect(max - min).toBeGreaterThan(150); // comfortably above one window's noise
    // …and at no point does the field collapse to solid (still a checkerboard).
    expect(min).toBeGreaterThan(0);
    expect(max).toBeLessThanOrEqual(32 * 32); // sanity: within the 32×32 window
  }, 90_000);
});
