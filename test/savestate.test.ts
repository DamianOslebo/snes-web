import { describe, expect, it } from 'vitest';
import { MockCore } from '../src/core/mock-core';
import { SaveStateManager } from '../src/debug/savestate';

describe('save-state manager (against MockCore)', () => {
  it('captures, mutates, and diffs SRAM/WRAM windows', () => {
    const core = new MockCore();
    void core.loadRom(new Uint8Array(0x100));
    const s = new SaveStateManager(core);

    s.capture(); // slot 0
    // Mutate the SRAM window (bank $70) and WRAM window (bank $7E).
    core.writeMem(0x70, 0x100, new Uint8Array([0xde, 0xad, 0xbe, 0xef]));
    core.writeMem(0x7e, 0x200, new Uint8Array([0xca, 0xfe]));

    s.capture(); // slot 1
    const d = s.diff(0, 1);
    expect(d).not.toBeNull();
    expect(d!.sramChanged).toBe(4);
    expect(d!.wramChanged).toBe(2);
    expect(d!.firstSramChange).toBe(0x100);
    expect(d!.firstWramChange).toBe(0x200);
  });

  it('round-trips memory and registers through a restore', () => {
    const core = new MockCore();
    void core.loadRom(new Uint8Array(0x100));
    const s = new SaveStateManager(core);

    core.writeMem(0x00, 0x8000, new Uint8Array([0x11, 0x22, 0x33]));
    s.capture();
    const snapshot = core.readMem(0x00, 0x8000, 3).slice();
    const regSnapshot = core.readRegisters();

    // Perturb live state.
    core.writeMem(0x00, 0x8000, new Uint8Array([0xaa, 0xbb, 0xcc]));
    core.step();

    expect(s.restore(0)).toBe(true);
    expect(Array.from(core.readMem(0x00, 0x8000, 3))).toEqual(Array.from(snapshot));
    expect(core.readRegisters().pc).toBe(regSnapshot.pc);
  });

  it('summarises slots with their index, PC, and change counts', () => {
    const core = new MockCore();
    void core.loadRom(new Uint8Array(0x100));
    const s = new SaveStateManager(core);

    s.capture();
    core.writeMem(0x70, 0, new Uint8Array([0x01]));
    s.capture();

    const sum = s.summaries();
    expect(sum.length).toBe(2);
    expect(sum[0].index).toBe(0);
    expect(sum[1].index).toBe(1);
    expect(sum[0].sramChanged).toBe(0); // first slot has nothing to diff against
    expect(sum[1].sramChanged).toBe(1);
    expect(sum[1].coreId).toBe('mock');
  });

  it('rejects restoring a save from a different core', () => {
    const core = new MockCore();
    void core.loadRom(new Uint8Array(0x100));
    const s = new SaveStateManager(core);
    s.capture();
    const save = s.slot(0)!;
    (save as { coreId: string }).coreId = 'wasm';
    expect(() => core.restore(save)).toThrow(/core/);
  });
});
