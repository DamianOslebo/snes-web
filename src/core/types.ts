/**
 * Core ABI — the contract between the web app and the emulator core.
 *
 * Two implementations exist:
 *  - `MockCore`  (in-memory, for dev/tests; renders a test pattern + tone)
 *  - `WasmCore`  (loads a snes9x Emscripten build; the real thing)
 *
 * Everything above this line is UI- and debugger-agnostic: it never knows
 * whether the pixels came from a fake or from snes9x.
 */

/** SNES nominal output geometry (NTSC). PAL is 256x240. */
export const SNES_WIDTH = 256;
export const SNES_HEIGHT = 224;

/** Nominal SNES SPU sample rate — fallback only; snes9x runs the SPC at 32040 Hz. */
export const SNES_AUDIO_RATE = 32_000;

/**
 * Coprocessor / system feature mask reported by the core for the loaded ROM.
 * Bit order MUST match the shim's `core_system()` (core/shim/s9x_shim.c).
 */
export const SYSTEM = {
  SUPER_FX: 1 << 0,
  SA1: 1 << 1,
  C4: 1 << 2,
  SDD1: 1 << 3,
  SPC7110: 1 << 4,
  SPC7110_RTC: 1 << 5,
  OBC1: 1 << 6,
  SETA: 1 << 7,
  SRTC: 1 << 8,
  BSX: 1 << 9,
} as const;

/** Coprocessors this build does NOT emulate (v1 scope, see CLAUDE.md). */
export const SYSTEM_UNSUPPORTED = SYSTEM.SUPER_FX | SYSTEM.SA1 | SYSTEM.SDD1;

/** Human-readable names of the unsupported coprocessors present in `sys`. */
export function unsupportedCoprocessors(sys: number): string[] {
  const named: ReadonlyArray<readonly [number, string]> = [
    [SYSTEM.SUPER_FX, 'Super FX'],
    [SYSTEM.SA1, 'SA-1'],
    [SYSTEM.SDD1, 'SDD1'],
  ];
  return named.filter(([bit]) => sys & bit).map(([, name]) => name);
}

/** Button bitmask, matching the snes9x `Controller` bit order. */
export const BTN = {
  B: 1 << 0,
  Y: 1 << 1,
  SELECT: 1 << 2,
  START: 1 << 3,
  UP: 1 << 4,
  DOWN: 1 << 5,
  LEFT: 1 << 6,
  RIGHT: 1 << 7,
  A: 1 << 8,
  X: 1 << 9,
  L: 1 << 10,
  R: 1 << 11,
} as const;

export interface SnesRegisters {
  a: number; // 8-bit accumulator
  x: number;
  y: number;
  s: number; // stack pointer (within $100-$1FF)
  p: number; // processor status flags
  pc: number; // 24-bit program counter
  dbr: number; // direct bank register
  dpr: number; // direct page register (16-bit)
}

/** One rendered frame, standardized on RGBA8 row-major. */
export interface VideoFrame {
  width: number;
  height: number;
  /** length === width * height * 4 */
  data: Uint8Array;
}

/** One chunk of decoded audio (interleaved stereo, 16-bit). */
export interface AudioFrame {
  sampleRate: number;
  left: Int16Array;
  right: Int16Array;
}

/** A region the memory viewer can browse. */
export interface MemoryRegion {
  name: string;
  bank: number;
  base: number; // byte offset within the bank (0..0xFFFF)
  size: number;
}

export interface BreakpointHit {
  bank: number;
  addr: number;
  registers: SnesRegisters;
}

/** A captured save state — the whole core image plus the regions we diff. */
export interface SaveState {
  /** Opaque core image (whole WASM heap for the real core; core blob for the mock). */
  coreImage: Uint8Array;
  registers: SnesRegisters;
  /** 128KB battery-backed SRAM — surfaced so the save-state differ can show it. */
  sram: Uint8Array;
  /** 128KB WRAM — surfaced for the differ. */
  wram: Uint8Array;
  /** Opaque audio/SPU state, if the core tracks it. */
  audio: Uint8Array;
  capturedAt: number;
  coreId: string;
}

export interface SnesCore {
  readonly id: string;
  readonly isMock: boolean;

  /** True once a ROM is loaded and the core is ready to run. */
  readonly ready: boolean;

  /** Load a ROM image and reset the core. */
  loadRom(rom: Uint8Array): Promise<void>;

  /** Advance emulation by exactly one frame (one video + one audio frame). */
  frame(): void;

  /** Set the full button state for a player (1-based). */
  setController(player: number, buttons: number): void;

  /** Most recent rendered frame. */
  lastVideo(): VideoFrame;

  /** Drain all audio samples accumulated since the last call. */
  drainAudio(): AudioFrame;

  /** Native SPU output sample rate (Hz). Size the AudioContext to this. */
  audioRate(): number;

  /**
   * Coprocessor / system feature mask of the loaded ROM (`SYSTEM` bits;
   * `SYSTEM.SUPER_FX` etc.). Check against `SYSTEM_UNSUPPORTED` before
   * running — the core cannot emulate those carts. `0` for a plain SFC or
   * before a ROM is loaded.
   */
  system(): number;

  // --- debug surface -----------------------------------------------------
  readMem(bank: number, addr: number, len: number): Uint8Array;
  writeMem(bank: number, addr: number, bytes: Uint8Array): void;
  readRegisters(): SnesRegisters;

  /** Single-step one CPU instruction (debug only). */
  step(): void;

  setBreakpoint(bank: number, addr: number): void;
  clearBreakpoint(bank: number, addr: number): void;
  listBreakpoints(): ReadonlyArray<{ bank: number; addr: number }>;

  /** Invoked by the core when a breakpoint is hit during step(). */
  onBreakpoint?: (hit: BreakpointHit) => void;

  // --- save states -------------------------------------------------------
  capture(): SaveState;
  restore(save: SaveState): void;
}

/**
 * The well-known memory regions, in the order the viewer lists them.
 *
 * Bank is the high byte and base the low 16 bits of a full 24-bit SNES
 * address (the same split the core's `readMem`/`writeMem` take), so these
 * are real hardware addresses: WRAM at $7E0000, SRAM in its $700000 window
 * (snes9x maps the $FE0000 window too), and the PPU/SPU/controller register
 * windows where the bus actually puts them.
 */
export const MEMORY_REGIONS: ReadonlyArray<MemoryRegion> = [
  { name: 'WRAM', bank: 0x7e, base: 0x0000, size: 0x20000 }, // $7E:0000 128K main RAM
  { name: 'SRAM', bank: 0x70, base: 0x0000, size: 0x20000 }, // $70:0000 battery-backed
  { name: 'C-RA', bank: 0xfc, base: 0x8000, size: 0x00002 }, // $FC:8000 controller regs
  { name: 'SPU', bank: 0xff, base: 0x4000, size: 0x00800 }, // $FF:4000 SPU regs
  { name: 'PPU', bank: 0xff, base: 0xe000, size: 0x00080 }, // $FF:e000 PPU regs
];
