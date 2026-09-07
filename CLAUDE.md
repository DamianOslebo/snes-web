# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A web-based SNES (Super Nintendo) emulator that runs entirely client-side. The user opens a webpage, loads a ROM, and plays in the browser. A first-class debugger is in scope: 65C816 code inspection (disassembly, stepping, breakpoints), memory introspection, and save states.

## Commands

```bash
npm run dev          # vite dev server (serves the app; falls back to MockCore until the wasm build exists)
npm run build        # typecheck (tsc --noEmit) + production bundle
npm run preview      # serve the production bundle
npm run typecheck    # tsc --noEmit
npm run test         # vitest run (node env)
npm run test:watch   # vitest in watch mode
npm run core:build   # build the real snes9x→wasm core (bash core/build.sh); requires emsdk
```

Run a single test file: `npx vitest run test/disasm.test.ts`.
Run tests by name: `npx vitest run -t "disassembles the mock seed program"`.

`npm run dev` needs no emulator core: if the wasm build is absent (or `?mock=1` is on the URL) the app boots the in-memory `MockCore`, renders an animated test pattern, and auto-loads a dummy ROM so the UI is alive immediately.

## Architecture

Two layers: a compiled emulator core behind a C ABI, wrapped by a TypeScript app. The app is **core-agnostic** — it only ever talks to the `SnesCore` interface (`src/core/types.ts`). Two implementations satisfy it:

- **`MockCore`** (`src/core/mock-core.ts`) — in-memory, no compiled core. Has a small seeded 65C816 program, an animated test pattern, and a tone, so the whole app + debugger build, run, and unit-test without emsdk. Used in dev/tests and as the fallback.
- **`WasmCore`** (`src/core/wasm-core.ts`) — loads the snes9x Emscripten build (global factory `snesWasm` from `/core/build/snes9x.js`) and calls its C ABI.

`createCore()` (`src/core/snes-core.ts`) picks one: `?mock=1` / non-browser forces the mock; otherwise it tries `WasmCore` and degrades to `MockCore` on any load failure.

**`core/`** — the build side, not part of the Vite bundle:
- `core/shim/s9x_shim.c` — the C ABI bridge over snes9x. It exports exactly the `core_*` functions the `S9xModule` interface in `wasm-core.ts` declares. **These two must stay in sync**, as must the `EXPORTED_FUNCTIONS` list in `core/build.sh`.
- `core/build.sh` — compiles the shim + snes9x to `public/core/build/snes9x.{js,wasm}` (output lives under `public/` so Vite serves it at `/core/build/*`). See `core/README.md` for the ABI reference and the documented gaps.

**`src/runtime/`** — the render/audio/input loop, all core-agnostic:
- `renderer.ts` (2D canvas `putImageData` of the 256×224 RGBA frame),
- `audio.ts` + `worklet.ts` (AudioWorklet queue fed by `drainAudio()`; no SharedArrayBuffer),
- `input.ts` (keyboard + Gamepad + on-screen touch → one composed mask to `setController`),
- `gamepad-bindings.ts` (configurable gamepad→SNES mapping: button **or** axis+dir per action, persisted to localStorage; applied via `maskFromBindings`). Defaults match the standard Gamepad API layout, so a fresh install behaves as before.
- `touch.ts` (on-screen SNES controller: per-pointer tracking so buttons can be held together; the mobile focus-mode fallback when no gamepad is connected),
- `frame-loop.ts` (fixed-timestep 60 Hz `requestAnimationFrame` driver).

Gamepad presence drives UX (all in `main.ts`): the on-screen touch pad is the **fallback** (hidden while a pad is connected, re-shown on unplug), and the "🎮 Controller" transport button appears only when a pad is present. It opens the binding-config page — a standalone `?bindings=1` route (`src/ui/bindings.ts`) that does not boot the core/audio; each SNES action is assigned by pressing a button/axis, saved immediately, and re-read by `InputManager` on the next emulator boot.

**`src/debug/`** — the debugger, a TS layer over the core's debug ABI:
- `disasm.ts` — bank-aware 65C816 disassembler.
- `memory-view.ts` — hex-window formatting, byte search, hex parsing.
- `savestate.ts` — `SaveStateManager`: slots + a differ (PC delta + SRAM/WRAM changed bytes).
- `debugger.ts` — `mountDebug()`: the register / disasm / memory / save-state / breakpoint panels.

**Save states are whole-heap snapshots** (`M.HEAPU8.slice()` for the wasm core; a core blob for the mock), so they can't miss a hidden register. Restore writes the image back verbatim. The mock stores a small header + banked memory.

## Key decisions & constraints

- **Single-threaded WASM first.** No pthreads — avoids SharedArrayBuffer / COOP-COEP header requirements and keeps save states simple. Add multithreading only if profiling demands it (and accept the header requirements then).
- **Coprocessors (Super FX / SA-1 / SDD1) are out of scope for v1.** Detect and show "unsupported." A second core build, not a rewrite.
- **ROMs are user-supplied** (licensing) — the app must never ship or bundle ROMs. (The mock loads a fabricated dummy ROM internally for the test pattern; that is not a real SNES ROM and must not be exposed as one.)
- **Static hosting** is the deploy target while the core is single-threaded.
- **Debugger safety principle:** a disassembler that says `??` for an uncertain opcode is acceptable; mislabeling is not. Uncertain former-illegal 6502 slots are left as illegal/`??`, never guessed.

## Known gaps (documented in core/README.md)

- `core_step` is **frame-granular** (snes9x's public `S9xRun` advances a frame). Single-instruction stepping needs a one-line patch exposing `s9x_step` from `snes9x/src/Cpu.c`.
- Memory-view bank mapping: `$00–$0F` → WRAM, `$F0–$FF` → SRAM. PPU/SPU register windows fall back to a safe read rather than exact register introspection.
