/**
 * `emu` — the headless "eyes" controller.
 *
 * The authoring pages (?asm=1 / ?gfx=1 / ?track=1) are core-free: they author
 * state and hand a built ROM to the emulator by NAVIGATING AWAY (which destroys
 * the chat). So the agent could never watch what it built — it was structurally
 * blind, and could not tell a working sprite from a black screen. This module
 * closes that loop: it boots ONE shared core (cached across probes), loads the
 * ROM the agent just built, runs a few frames, and hands back a compact,
 * model-readable summary of the rendered screen.
 *
 * The heavy I/O lives here (async core boot + `loadRom`), keeping the rest of
 * the agent pure. `summarizeFrame` (frame.ts) is the pure measurement; the
 * "what this means, what to fix" prose is composed in tools.ts. `probe` NEVER
 * throws — every failure becomes a clean `{ ok:false, error }`.
 */

import { createCore } from '../core/snes-core';
import type { SnesCore } from '../core/types';
import type { AsmController, EmuProbeController, EmuProbeResult } from './types';
import { summarizeFrame } from './frame';

/** Advance a few VBlanks before sampling so a sprite/first-frame has drawn. */
const DEFAULT_FRAMES = 3;
/** Hard cap: enough to see movement without spinning a ROM for any length. */
const MAX_FRAMES = 24;

export interface EmuControllerOptions {
  /**
   * How to obtain the core. Defaults to `createCore()` — the real snes9x build
   * in the browser, degrading to MockCore (and reporting it as a mock) on node
   * or if the wasm is absent. Tests inject a fake here.
   */
  makeCore?: () => Promise<SnesCore>;
}

export function makeEmuController(
  asm: AsmController,
  opts: EmuControllerOptions = {},
): EmuProbeController {
  const makeCore = opts.makeCore ?? (() => createCore());
  // One shared core for the life of the panel: booting the wasm is the expensive
  // part, so we do it at most once and reuse it for every probe.
  let corePromise: Promise<SnesCore> | null = null;
  const ensureCore = () => (corePromise ??= makeCore());

  function clampFrames(v: unknown): number {
    const n = Math.floor(Number(v ?? DEFAULT_FRAMES));
    if (!Number.isFinite(n) || n < 1) return DEFAULT_FRAMES;
    return Math.min(MAX_FRAMES, n);
  }

  async function probe(opts?: { frames?: number }): Promise<EmuProbeResult> {
    const frames = clampFrames(opts?.frames);
    try {
      // 1. Build the ROM the agent just authored (current source + data files).
      const built = asm.buildRomBytes();
      if (!built.ok || !built.bytes || built.bytes.length === 0) {
        return {
          ok: false,
          error: built.error ?? 'nothing to probe — there is no clean assemble to build a ROM from',
        };
      }
      // 2. Boot (or reuse) one core, load the ROM, advance a few frames.
      const core = await ensureCore();
      await core.loadRom(built.bytes);
      for (let i = 0; i < frames; i++) core.frame();
      // 3. Measure what is actually on screen.
      const screen = summarizeFrame(core.lastVideo());
      const mock = core.isMock;
      return {
        ok: true,
        core: mock
          ? `${core.id} (MOCK — this is the emulator's test pattern, NOT your ROM; a real core was unavailable on this page)`
          : core.id,
        isMock: mock,
        frames,
        screen,
      };
    } catch (err) {
      return { ok: false, error: `probe failed: ${(err as Error).message}` };
    }
  }

  return { probe };
}
