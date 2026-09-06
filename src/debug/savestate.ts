import type { SaveState, SnesCore } from '../core/types';

/**
 * Save-state slot manager + differ.
 *
 * A save state is a whole-core snapshot (see `core.capture()`), so it can
 * never miss a register. On top of that, the differ summarises what changed
 * between two states — the PC delta plus which SRAM/WRAM bytes moved — so the
 * user can see, at a glance, whether a save actually captured a meaningful
 * game state.
 */

export interface SlotSummary {
  index: number;
  capturedAt: number;
  coreId: string;
  pc: number;
  /** Number of bytes that differ in the 128KB SRAM window. */
  sramChanged: number;
  /** Number of bytes that differ in the 128KB WRAM window. */
  wramChanged: number;
  bytes: number; // serialized size, for UI/`💾 saved slot #n` context
}

export interface DiffResult {
  fromIndex: number | null;
  toIndex: number;
  pcFrom: number;
  pcTo: number;
  pcDelta: number; // signed, may span 24-bit wrap
  sramChanged: number;
  wramChanged: number;
  firstSramChange: number; // byte offset within the window, or -1
  firstWramChange: number;
}

export interface DebugHandle {
  /** Re-read live core state and re-render every panel. */
  refresh(): void;
  /** Step one CPU instruction (halts the loop first — handled by the caller). */
  step(): void;
  setBreakpoint(bank: number, addr: number): void;
  clearBreakpoint(bank: number, addr: number): void;
  /** Capture into the next free slot; returns the slot's 1-based count. */
  captureSlot(): number;
  /** All captured slots, oldest first. */
  slots(): readonly SlotSummary[];
  /** Restore a slot by index; returns true on success. */
  restoreSlot(index: number): boolean;
  /** Compare two slots; `from` of -1/omitted compares to the previous slot. */
  diff(from: number, to: number): DiffResult | null;
}

/** How many changed bytes between two same-length buffers, and the first one. */
function countDiffs(a: Uint8Array, b: Uint8Array): { changed: number; first: number } {
  const n = Math.min(a.length, b.length);
  let changed = 0;
  let first = -1;
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i]) {
      if (first < 0) first = i;
      changed++;
    }
  }
  // If lengths differ, count the extra tail as changed.
  const lenDiff = Math.abs(a.length - b.length);
  changed += lenDiff;
  if (changed === lenDiff && first < 0) first = n;
  return { changed, first };
}

const PC_WRAP = 1 << 24;

function signedPcDelta(from: number, to: number): number {
  let d = (to - from) & (PC_WRAP - 1);
  if (d & (PC_WRAP >>> 1)) d -= PC_WRAP; // put in signed 24-bit range
  return d;
}

export class SaveStateManager {
  private slots: SaveState[] = [];

  constructor(private readonly core: SnesCore) {}

  get count(): number {
    return this.slots.length;
  }

  /** Capture the current core state into a new slot. Returns its index. */
  capture(): number {
    const save = this.core.capture();
    this.slots.push(save);
    return this.slots.length - 1;
  }

  slot(index: number): SaveState | undefined {
    return this.slots[index];
  }

  restore(index: number): boolean {
    const save = this.slots[index];
    if (!save) return false;
    this.core.restore(save);
    return true;
  }

  clear(): void {
    this.slots = [];
  }

  summaries(): SlotSummary[] {
    return this.slots.map((s, i) => {
      const prev = i > 0 ? this.slots[i - 1] : undefined;
      const sram = prev ? countDiffs(prev.sram, s.sram) : { changed: 0, first: -1 };
      const wram = prev ? countDiffs(prev.wram, s.wram) : { changed: 0, first: -1 };
      return {
        index: i,
        capturedAt: s.capturedAt,
        coreId: s.coreId,
        pc: s.registers.pc,
        sramChanged: sram.changed,
        wramChanged: wram.changed,
        bytes: s.coreImage.length,
      };
    });
  }

  diff(from: number, to: number): DiffResult | null {
    const a = this.slots[from];
    const b = this.slots[to];
    if (!a || !b) return null;
    const sram = countDiffs(a.sram, b.sram);
    const wram = countDiffs(a.wram, b.wram);
    return {
      fromIndex: from,
      toIndex: to,
      pcFrom: a.registers.pc,
      pcTo: b.registers.pc,
      pcDelta: signedPcDelta(a.registers.pc, b.registers.pc),
      sramChanged: sram.changed,
      wramChanged: wram.changed,
      firstSramChange: sram.first,
      firstWramChange: wram.first,
    };
  }
}
