import {
  SNES_AUDIO_RATE,
  type AudioFrame,
  type BreakpointHit,
  type SaveState,
  type SnesCore,
  type SnesRegisters,
  type VideoFrame,
} from './types';

/** Where the emscripten build is served from (see core/build.sh). */
const SCRIPT_URL = '/core/build/snes9x.js';
const EXPORT_NAME = 'snesWasm';
const SRAM_SIZE = 0x20000; // 128KB
const WRAM_SIZE = 0x20000; // 128KB

/**
 * The C ABI the snes9x shim (core/shim/s9x_shim.c) must export. Keep in sync
 * with core/shim and core/README.md. Emscripten exposes exported C functions
 * on the module with a leading underscore (`_core_ready`, `_malloc`, ...).
 * All pointers index into the module's linear memory (`M.HEAPU8`).
 */
export interface S9xModule {
  HEAPU8: Uint8Array;
  wasmMemory: WebAssembly.Memory;
  _malloc(bytes: number): number;
  _free(ptr: number): void;

  _core_ready(): number;
  _core_load_rom(ptr: number, len: number): number;
  _core_frame(): void;
  _core_set_controller(player: number, buttons: number): void;

  _core_video_ptr(): number;
  _core_video_len(): number;
  _core_audio_ptr(): number; // interleaved int16, L R L R ...
  _core_audio_len(): number; // in bytes
  _core_audio_rate(): number; // native SPU output rate in Hz
  _core_system(): number; // coprocessor/system mask (SYSTEM bits in types.ts)

  _core_read_mem_into(bank: number, addr: number, dest: number, len: number): void;
  _core_write_mem(bank: number, addr: number, src: number, len: number): void;

  _core_reg_a(): number;
  _core_reg_x(): number;
  _core_reg_y(): number;
  _core_reg_s(): number;
  _core_reg_p(): number;
  _core_reg_pc(): number;
  _core_reg_dbr(): number;
  _core_reg_dpr(): number;

  _core_step(): void;
  _core_set_breakpoint(bank: number, addr: number): void;
  _core_clear_breakpoint(bank: number, addr: number): void;
  _core_breakpoint_count(): number;
  _core_breakpoint_bank(i: number): number;
  _core_breakpoint_addr(i: number): number;

  _core_sram_ptr(): number;
  _core_wram_ptr(): number;
}

type Factory = (moduleOverrides?: Record<string, unknown>) => Promise<S9xModule>;

/** Load the emscripten factory (browser only) without bundler-time resolution. */
function loadFactory(): Promise<Factory> {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('WasmCore requires a DOM (node environment)'));
      return;
    }
    const g = globalThis as Record<string, unknown>;
    if (typeof g[EXPORT_NAME] === 'function') {
      resolve(g[EXPORT_NAME] as Factory);
      return;
    }
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.onload = () => {
      const f = (globalThis as Record<string, unknown>)[EXPORT_NAME];
      if (typeof f !== 'function') reject(new Error(`emscripten factory '${EXPORT_NAME}' not found`));
      else resolve(f as Factory);
    };
    script.onerror = () => reject(new Error(`failed to load ${SCRIPT_URL} (run: npm run core:build)`));
    document.head.appendChild(script);
  });
}

export async function createWasmCore(): Promise<SnesCore> {
  const factory = await loadFactory();
  const M = await factory({ locateFile: (f: string) => `/core/build/${f}` });
  return new WasmCore(M);
}

export class WasmCore implements SnesCore {
  readonly id = 'snes9x-wasm';
  readonly isMock = false;

  private readonly M: S9xModule;
  private scratchPtr = 0;
  private scratchSize = 0;
  onBreakpoint?: (hit: BreakpointHit) => void;

  constructor(M: S9xModule) {
    this.M = M;
    // Wire the shim's C-side breakpoint callback into this instance.
    (M as unknown as Record<string, unknown>)._s9xBreakpoint = (bank: number, addr: number) => {
      this.onBreakpoint?.({ bank: bank & 0xff, addr: addr & 0xffff, registers: this.readRegisters() });
    };
  }

  get ready(): boolean {
    return this.M._core_ready() !== 0;
  }

  async loadRom(rom: Uint8Array): Promise<void> {
    const M = this.M;
    const ptr = M._malloc(rom.length);
    try {
      M.HEAPU8.set(rom, ptr);
      if (M._core_load_rom(ptr, rom.length) !== 0) throw new Error('core failed to load ROM');
    } finally {
      M._free(ptr);
    }
  }

  frame(): void {
    this.M._core_frame();
  }

  setController(player: number, buttons: number): void {
    this.M._core_set_controller(player, buttons);
  }

  /** Native SPU output rate (Hz) — 32040 for snes9x. Used to size the AudioContext. */
  audioRate(): number {
    return this.M._core_audio_rate() || SNES_AUDIO_RATE;
  }

  /** Coprocessor / system feature mask of the loaded ROM (see SYSTEM in types.ts). */
  system(): number {
    return this.M._core_system() >>> 0;
  }

  lastVideo(): VideoFrame {
    const M = this.M;
    const len = M._core_video_len();
    const ptr = M._core_video_ptr();
    return {
      width: 256,
      height: 224,
      data: M.HEAPU8.slice(ptr, ptr + len),
    };
  }

  drainAudio(): AudioFrame {
    const M = this.M;
    const len = M._core_audio_len();
    const bytes = M.HEAPU8.slice(M._core_audio_ptr(), M._core_audio_ptr() + len);
    const ints = new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.length / 2));
    const n = ints.length / 2;
    const left = new Int16Array(n);
    const right = new Int16Array(n);
    for (let i = 0; i < n; i++) {
      left[i] = ints[i * 2];
      right[i] = ints[i * 2 + 1];
    }
    return { sampleRate: this.audioRate(), left, right };
  }

  // --- debug surface -----------------------------------------------------
  private ensureScratch(len: number): number {
    if (len > this.scratchSize) {
      if (this.scratchPtr) this.M._free(this.scratchPtr);
      this.scratchSize = len;
      this.scratchPtr = this.M._malloc(len);
    }
    return this.scratchPtr;
  }

  readMem(bank: number, addr: number, len: number): Uint8Array {
    const M = this.M;
    const dest = this.ensureScratch(len);
    M._core_read_mem_into(bank & 0xff, addr & 0xffff, dest, len);
    return M.HEAPU8.slice(dest, dest + len);
  }

  writeMem(bank: number, addr: number, bytes: Uint8Array): void {
    const M = this.M;
    const src = this.ensureScratch(bytes.length);
    M.HEAPU8.set(bytes, src);
    M._core_write_mem(bank & 0xff, addr & 0xffff, src, bytes.length);
  }

  readRegisters(): SnesRegisters {
    const M = this.M;
    return {
      a: M._core_reg_a() & 0xff,
      x: M._core_reg_x() & 0xff,
      y: M._core_reg_y() & 0xff,
      s: M._core_reg_s() & 0xff,
      p: M._core_reg_p() & 0xff,
      pc: M._core_reg_pc() & 0xffffff,
      dbr: M._core_reg_dbr() & 0xf,
      dpr: M._core_reg_dpr() & 0xffff,
    };
  }

  step(): void {
    this.M._core_step();
  }

  setBreakpoint(bank: number, addr: number): void {
    this.M._core_set_breakpoint(bank & 0xff, addr & 0xffff);
  }

  clearBreakpoint(bank: number, addr: number): void {
    this.M._core_clear_breakpoint(bank & 0xff, addr & 0xffff);
  }

  listBreakpoints(): ReadonlyArray<{ bank: number; addr: number }> {
    const M = this.M;
    const n = M._core_breakpoint_count();
    const out: { bank: number; addr: number }[] = [];
    for (let i = 0; i < n; i++) {
      out.push({ bank: M._core_breakpoint_bank(i) & 0xff, addr: M._core_breakpoint_addr(i) & 0xffff });
    }
    return out;
  }

  // --- save states -------------------------------------------------------
  /**
   * Whole-heap snapshot: the core's linear memory holds CPU, PPU, SPU, WRAM,
   * SRAM and bus state, so copying it all is the only save path that can't
   * miss a register. Restore writes it back verbatim.
   */
  capture(): SaveState {
    const M = this.M;
    const sram = M._core_sram_ptr();
    const wram = M._core_wram_ptr();
    return {
      coreImage: M.HEAPU8.slice(),
      registers: this.readRegisters(),
      sram: M.HEAPU8.slice(sram, sram + SRAM_SIZE),
      wram: M.HEAPU8.slice(wram, wram + WRAM_SIZE),
      audio: new Uint8Array(0),
      capturedAt: Date.now(),
      coreId: this.id,
    };
  }

  restore(save: SaveState): void {
    if (save.coreId !== this.id) {
      throw new Error(`save state from core '${save.coreId}' cannot be restored on '${this.id}'`);
    }
    if (save.coreImage.length !== this.M.HEAPU8.length) {
      throw new Error('save state core image size does not match this core build');
    }
    this.M.HEAPU8.set(save.coreImage);
  }
}
