import {
  BTN,
  SNES_AUDIO_RATE,
  SNES_HEIGHT,
  SNES_WIDTH,
  type AudioFrame,
  type BreakpointHit,
  type SaveState,
  type SnesCore,
  type SnesRegisters,
  type VideoFrame,
} from './types';

// The 65C816 address space is 256 banks of 64KB (16MB) with 8-bit bank
// numbers. The mock gives every bank real storage and treats bank $7E as
// WRAM ($7E:0000) and bank $70 as SRAM ($70:0000) — the same windows the
// real core exposes through its bus, so MEMORY_REGIONS and the save-state
// windows line up across both cores.
const BANKS = 0x100;
const BANK_SIZE = 0x10000;
const SAMPLES_PER_FRAME = Math.round(SNES_AUDIO_RATE / 60);

/**
 * In-memory core used for development and unit tests. It satisfies the full
 * `SnesCore` ABI without a compiled core:
 *  - banked memory model so `readMem`/the disassembler have real bytes
 *  - a small seeded 65C816 program that `step()` walks through
 *  - an animated test pattern for the renderer and a tone for the audio engine
 *
 * It is NOT cycle-accurate and does not run real ROMs — it exists so the entire
 * web app and debugger can be built, exercised, and tested without emsdk.
 */
export class MockCore implements SnesCore {
  readonly id = 'mock';
  readonly isMock = true;

  private mem: Uint8Array[];
  ready = false;

  private pcIndex = 0;
  private frameCounter = 0;
  private audioPhase = 0;
  private registers: SnesRegisters = { a: 0, x: 0, y: 0, s: 0x100, p: 0x34, pc: 0x8000, dbr: 0, dpr: 0x8000 };
  private inputs: number[] = [0, 0];

  private video!: VideoFrame;
  private lastAudio!: AudioFrame;

  private breakpoints = new Map<number, { bank: number; addr: number }>();
  onBreakpoint?: (hit: BreakpointHit) => void;

  // Ordered (addr, byte-length) sequence the mock PC walks through.
  // Same program the disassembler test decodes. 65C816 branches are 8-bit
  // relative (opcode + 1 offset byte = 2 total), so BNE is 2 bytes here.
  private readonly seq = [
    { a: 0x8000, l: 2 }, // LDX #$00
    { a: 0x8002, l: 1 }, // INX
    { a: 0x8003, l: 1 }, // DEX
    { a: 0x8004, l: 2 }, // BNE +2
    { a: 0x8006, l: 2 }, // LDA #$FF
    { a: 0x8008, l: 3 }, // STA $0200
    { a: 0x800b, l: 1 }, // RTS
  ];

  constructor() {
    this.mem = Array.from({ length: BANKS }, () => new Uint8Array(BANK_SIZE));
    this.seedProgram();
    this.render(0);
    this.generateAudio(0, 0);
  }

  private seedProgram(): void {
    // A2 00 / E8 / CA / D0 02 / A9 FF / 8D 00 02 / 40
    //   LDX #$00  INX  DEX  BNE +2  LDA #$FF  STA $0200  RTS
    // BNE is 8-bit relative (2 bytes), STA $0200 is absolute (3 bytes).
    // $40 is RTS on the 65C816 — the C816 swaps RTS/RTI vs the 6502.
    const bytes = [0xa2, 0x00, 0xe8, 0xca, 0xd0, 0x02, 0xa9, 0xff, 0x8d, 0x00, 0x02, 0x40];
    for (let i = 0; i < bytes.length; i++) this.mem[0][0x8000 + i] = bytes[i];
  }

  async loadRom(_rom: Uint8Array): Promise<void> {
    // A real core would decode the ROM and reset; the mock just becomes ready.
    this.seedProgram();
    this.pcmReset();
    this.ready = true;
  }

  private pcmReset(): void {
    this.pcIndex = 0;
    this.frameCounter = 0;
    this.audioPhase = 0;
    this.registers = { a: 0, x: 0, y: 0, s: 0x100, p: 0x34, pc: this.seq[0].a, dbr: 0, dpr: 0x8000 };
  }

  setController(player: number, buttons: number): void {
    this.inputs[player - 1] = buttons;
  }

  audioRate(): number {
    return SNES_AUDIO_RATE;
  }

  /** The mock's dummy ROM is a plain SFC image: no coprocessors. */
  system(): number {
    return 0;
  }

  frame(): void {
    if (!this.ready) return;
    this.frameCounter++;
    // Advance the mock PC by a handful of instructions per frame.
    for (let i = 0; i < 8; i++) this.advancePc();
    this.registers.x = (this.registers.x + 1) & 0xff;
    this.render(this.frameCounter);
    this.generateAudio(this.audioPhase, this.inputs[0]);
  }

  private advancePc(): void {
    this.pcIndex = (this.pcIndex + 1) % this.seq.length;
    this.registers.pc = this.seq[this.pcIndex].a;
    this.checkBreakpoint();
  }

  private checkBreakpoint(): void {
    const pc = this.registers.pc;
    const bank = pc >> 16;
    const hit = this.breakpoints.get((bank << 16) | (pc & 0xffff));
    if (hit && this.onBreakpoint) {
      this.onBreakpoint({ ...hit, registers: this.readRegisters() });
    }
  }

  step(): void {
    if (!this.ready) return;
    // Fire a breakpoint at the instruction about to run, then advance past it
    // (a debugger halts on the PC currently at the break, not the one after).
    this.checkBreakpoint();
    this.frameCounter++;
    this.advancePc();
  }

  lastVideo(): VideoFrame {
    return this.video;
  }

  drainAudio(): AudioFrame {
    const a = this.lastAudio;
    this.lastAudio = {
      sampleRate: a.sampleRate,
      left: new Int16Array(a.left.length),
      right: new Int16Array(a.right.length),
    };
    return a;
  }

  // --- debug surface -----------------------------------------------------
  readMem(bank: number, addr: number, len: number): Uint8Array {
    const out = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      const off = (addr + i) & 0xffff;
      out[i] = this.mem[bank & 0xff][off];
    }
    return out;
  }

  writeMem(bank: number, addr: number, bytes: Uint8Array): void {
    for (let i = 0; i < bytes.length; i++) {
      const off = (addr + i) & 0xffff;
      this.mem[bank & 0xff][off] = bytes[i];
    }
  }

  readRegisters(): SnesRegisters {
    return { ...this.registers };
  }

  setBreakpoint(bank: number, addr: number): void {
    const b = bank & 0xff;
    const key = (b << 16) | (addr & 0xffff);
    this.breakpoints.set(key, { bank: b, addr: addr & 0xffff });
  }

  clearBreakpoint(bank: number, addr: number): void {
    this.breakpoints.delete(((bank & 0xff) << 16) | (addr & 0xffff));
  }

  listBreakpoints(): ReadonlyArray<{ bank: number; addr: number }> {
    return Array.from(this.breakpoints.values());
  }

  // --- save states -------------------------------------------------------
  capture(): SaveState {
    const coreImage = new Uint8Array(12 + BANKS * BANK_SIZE);
    const dv = new DataView(coreImage.buffer);
    dv.setUint32(0, this.frameCounter, true);
    dv.setUint32(4, this.pcIndex, true);
    dv.setFloat32(8, this.audioPhase, true);
    let o = 12;
    for (const bank of this.mem) {
      coreImage.set(bank, o);
      o += BANK_SIZE;
    }
    return {
      coreImage,
      registers: this.readRegisters(),
      sram: this.copyBankRange(0x70, 0x02),
      wram: this.copyBankRange(0x7e, 0x02),
      audio: new Uint8Array(new Float32Array([this.audioPhase]).buffer),
      capturedAt: Date.now(),
      coreId: this.id,
    };
  }

  restore(save: SaveState): void {
    if (save.coreId !== this.id) {
      throw new Error(`save state from core '${save.coreId}' cannot be restored on '${this.id}'`);
    }
    const dv = new DataView(save.coreImage.buffer, save.coreImage.byteOffset, 12);
    this.frameCounter = dv.getUint32(0, true);
    this.pcIndex = dv.getUint32(4, true) % this.seq.length;
    this.audioPhase = dv.getFloat32(8, true);
    let o = 12;
    for (let b = 0; b < BANKS; b++) {
      this.mem[b].set(save.coreImage.subarray(o, o + BANK_SIZE));
      o += BANK_SIZE;
    }
    this.registers = { ...save.registers };
    this.ready = true;
  }

  private copyBankRange(bank: number, count: number): Uint8Array {
    const out = new Uint8Array(count * BANK_SIZE);
    let o = 0;
    for (let i = 0; i < count; i++) {
      out.set(this.mem[(bank + i) & 0xff], o);
      o += BANK_SIZE;
    }
    return out;
  }

  // --- render / audio (the mock "game") ---------------------------------
  private render(frame: number): void {
    const w = SNES_WIDTH;
    const h = SNES_HEIGHT;
    const data = new Uint8Array(w * h * 4);
    // bouncing dot + fading trail
    const cx = (Math.sin(frame / 30) * 0.5 + 0.5) * (w - 40) + 20;
    const cy = (Math.cos(frame / 22) * 0.5 + 0.5) * (h - 40) + 20;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const d = Math.hypot(x - cx, y - cy);
        const g = d < 14 ? 235 : d < 24 ? 120 : ((x + y) & 8) ? 18 : 10;
        data[i] = g;
        data[i + 1] = g;
        data[i + 2] = 255 - g;
        data[i + 3] = 255;
      }
    }
    this.video = { width: w, height: h, data };
  }

  private generateAudio(phase: number, buttons: number): void {
    const n = SAMPLES_PER_FRAME;
    const left = new Int16Array(n);
    const right = new Int16Array(n);
    const freq = (buttons & BTN.A) ? 660 : 440;
    for (let i = 0; i < n; i++) {
      const t = phase + i;
      const s = Math.sin((2 * Math.PI * freq * t) / SNES_AUDIO_RATE) * 0.25;
      const v = Math.max(-1, Math.min(1, s)) * 0x7fff;
      left[i] = v;
      right[i] = v;
    }
    this.audioPhase = (phase + n) % SNES_AUDIO_RATE;
    this.lastAudio = { sampleRate: SNES_AUDIO_RATE, left, right };
  }
}
