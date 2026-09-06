# core/ — snes9x → WebAssembly build

This directory builds the snes9x-2010 emulator core to WebAssembly, in front of
a thin C shim that exposes the stable C ABI the web app depends on. The build
target is the [snes9x-2010-wasm](https://github.com/gallaux/snes9x-2010-wasm)
"globals API" generation of snes9x (the 2010 vintage codebase, whose CPU/PPU/SPU
state lives in C globals — which is also what makes whole-heap save states
trivial). It is auto-cloned into `core/snes9x-2010/` on first build.

The app itself is core-agnostic: it only ever talks to the
`SnesCore` interface, and the real implementation of that interface
(`src/core/wasm-core.ts`) calls exactly the functions this module exports.

Two files here matter:

| File                    | Role                                                                 |
| ----------------------- | -------------------------------------------------------------------- |
| `shim/s9x_shim.c`       | The C ABI bridge. One function per app capability, defined below.    |
| `build.sh`              | Compiles `s9x_shim.c` + snes9x into `public/core/build/snes9x.{js,wasm}`. |

The TypeScript side of the same contract lives in
[`src/core/wasm-core.ts`](../src/core/wasm-core.ts) — the `S9xModule` interface
there and the `EXPORTED_FUNCTIONS` list in `build.sh` **must stay in sync**. If
you add a function to one, add it to the other.

## Build

Prerequisites: `emcc` on `PATH` (or set `EMSDK_DIR`), plus `git` and network for
the first run only (it auto-clones snes9x-2010 into `core/snes9x-2010/`).

```bash
npm run core:build          # == bash core/build.sh
```

Output:

```
public/core/build/snes9x.js      # emscripten loader (factory: global `snesWasm`)
public/core/build/snes9x.wasm
```

These are web-served assets, so they go under `public/` — Vite serves them at
`/core/build/*` in both `vite dev` and `vite build`, which is exactly the URL
`wasm-core.ts` loads (`SCRIPT_URL = '/core/build/snes9x.js'`). The emulator does
**not** require the wasm build: if it's absent, the app degrades to the
in-memory `MockCore` (see `src/core/mock-core.ts`) so the debugger UI still runs.

To use your own snes9x-2010 checkout,
`SNES9X_DIR=/path/to/snes9x-2010 npm run core:build`.

## The C ABI (what `s9x_shim.c` exports)

All pointers are indices into the module's linear memory (`Module.HEAPU8`).
Emscripten exposes each `core_*` function as `Module._core_*`.

- **Lifecycle:** `core_ready`, `core_load_rom(ptr, len)`,
  `core_system` (coprocessor/system feature mask of the loaded ROM — bit
  order matches the `SYSTEM` constants in `src/core/types.ts`)
- **Per-frame:** `core_frame`, `core_set_controller(player, buttons)`
- **Frame output:** `core_video_ptr/len` (RGBA8, 256×224),
  `core_audio_ptr/len` (interleaved int16 L R L R…, `len` is bytes since last
  call), `core_audio_rate` (native SPU output sample rate in Hz — size the
  AudioContext to this)
- **Memory introspection:** `core_read_mem_into(bank, addr, dest, len)`,
  `core_write_mem(bank, addr, src, len)` — full 24-bit SNES addresses, see
  [Memory addressing](#memory-addressing) below
- **Registers:** `core_reg_a/x/y/s/p/pc/dbr/dpr`
- **Stepping & breakpoints:** `core_step` (exactly **one** 65C816 instruction,
  see below), `core_set_breakpoint`, `core_clear_breakpoint`,
  `core_breakpoint_count/bank/addr`
- **Save-state differ:** `core_sram_ptr`, `core_wram_ptr`

Breakpoint *hits* are delivered C→JS: the shim calls the `EM_JS` bridge
`js_on_breakpoint(bank, addr)`, which invokes `Module._s9xBreakpoint` — a
function `WasmCore` installs in its constructor to fire the app's
`onBreakpoint` callback (auto-pause).

## Memory addressing (for the hex viewer)

`core_read_mem_into(bank, addr, …)` and `core_write_mem(bank, addr, …)` take an
**8-bit bank (high byte) + 16-bit offset**, which the shim composes into a full
24-bit SNES address and read/writes **through the real bus**
(`S9xGetByte`/`S9xSetByte`). So the address space behaves the way it does on
hardware:

- ROM banks `$00–$FF` read back ROM (and whatever the mapper mapped there)
- WRAM at `$7E0000–$7FFFFF`, SRAM wherever the ROM's header mapped it
- PPU/SPU register windows read/write the actual registers (with the same
  read-side-effect caveats as hardware — e.g. shift-register reads)

The save-state **differ** still uses the direct `core_sram_ptr`/`core_wram_ptr`
pointers (`S9xGetRAM`) rather than the bus, since those give exact region bases.

## Save states

No shim hook is needed to *capture*: the app snapshots the whole linear-memory
heap (`M.HEAPU8.slice()`), which already contains CPU, PPU, SPU, WRAM, SRAM and
bus state — the only save path that can't miss a register. Restore writes it
back verbatim. The shim only supplies the `core_sram_ptr`/`core_wram_ptr`
pointers the save-state **differ** uses to show which SRAM/WRAM bytes changed
between two slots.

## Single-instruction stepping

snes9x's public `S9xRun` advances a whole frame, but the debugger needs
single-step. `core_step` implements one instruction directly in the shim using
the same fetch/decode sequence as the core's main loop (NMI/IRQ preamble,
fast/slow opcode fetch, 4K-block rebasing, H-event processing), so stepping is
faithful to run mode — no core patch required.

## Known gaps (intentional, documented)

1. **Coprocessors (Super FX / SA-1 / SDD1) are out of scope for v1** — see the
   project notes in [`CLAUDE.md`](../CLAUDE.md). Such ROMs are detected via the
   `core_system()` bitmask (bit order in the shim's `core_system()` and the
   `SYSTEM` constants in `src/core/types.ts`) and reported by the app as
   "unsupported coprocessor" — loaded, then stopped, not emulated.

2. **PPU/SPU introspection is bus-accurate, not register-authoritative.**
   Memory-window reads go through the real bus (above), which is correct for
   values the hardware exposes — but shift registers and similar read-once
   values behave as they do on hardware. For the debugger's register panel,
   trust the CPU registers from `core_reg_*` (snes9x's `Cpu.h` globals) as the
   source of truth.
