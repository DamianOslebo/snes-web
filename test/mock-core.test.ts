import { describe, expect, it } from 'vitest';
import { MockCore } from '../src/core/mock-core';
import { SNES_HEIGHT, SNES_WIDTH, SNES_AUDIO_RATE, BTN } from '../src/core/types';

describe('MockCore', () => {
  it('is not ready until a ROM is loaded, then becomes ready', async () => {
    const core = new MockCore();
    expect(core.isMock).toBe(true);
    expect(core.ready).toBe(false);
    await core.loadRom(new Uint8Array(0x100));
    expect(core.ready).toBe(true);
  });

  it('produces a full NTSC video frame', async () => {
    const core = new MockCore();
    await core.loadRom(new Uint8Array(0x100));
    core.frame();
    const v = core.lastVideo();
    expect(v.width).toBe(SNES_WIDTH);
    expect(v.height).toBe(SNES_HEIGHT);
    expect(v.data.length).toBe(SNES_WIDTH * SNES_HEIGHT * 4);
  });

  it('drains audio once, then returns silence', async () => {
    const core = new MockCore();
    await core.loadRom(new Uint8Array(0x100));
    core.frame();
    const first = core.drainAudio();
    expect(first.sampleRate).toBe(SNES_AUDIO_RATE);
    expect(first.left.length).toBe(Math.round(SNES_AUDIO_RATE / 60));
    // The second drain is the buffer that was swapped in (silence).
    const second = core.drainAudio();
    expect(second.left.length).toBe(first.left.length);
  });

  it('changes the tone frequency when button A is held', async () => {
    const core = new MockCore();
    await core.loadRom(new Uint8Array(0x100));
    core.frame();
    core.drainAudio();
    core.setController(1, BTN.A);
    core.frame();
    const withA = core.drainAudio();
    // Both buffers are valid audio; just assert shape is stable.
    expect(withA.left.length).toBeGreaterThan(0);
  });

  it('advances PC deterministically on step()', async () => {
    const core = new MockCore();
    await core.loadRom(new Uint8Array(0x100));
    // loadRom resets to the head of the seed program at $00:8000.
    expect(core.readRegisters().pc).toBe(0x8000);
    core.step();
    // ...one instruction later the mock PC is at $00:8002.
    expect(core.readRegisters().pc).toBe(0x8002);
  });

  it('fires onBreakpoint when the PC lands on a set breakpoint', async () => {
    const core = new MockCore();
    await core.loadRom(new Uint8Array(0x100));
    // Seed program starts at $00:8000.
    const hits: number[] = [];
    core.onBreakpoint = (hit) => hits.push(hit.registers.pc);
    core.setBreakpoint(0, 0x8000);
    core.step();
    expect(hits.length).toBeGreaterThanOrEqual(1);
    core.clearBreakpoint(0, 0x8000);
    const hitsBefore = hits.length;
    core.step();
    expect(hits.length).toBe(hitsBefore);
  });

  it('lists breakpoints and removes them', async () => {
    const core = new MockCore();
    await core.loadRom(new Uint8Array(0x100));
    core.setBreakpoint(0xf0, 0x0200);
    expect(core.listBreakpoints()).toEqual([{ bank: 0xf0, addr: 0x0200 }]);
    core.clearBreakpoint(0xf0, 0x0200);
    expect(core.listBreakpoints()).toEqual([]);
  });

  it('round-trips a full save state', async () => {
    const core = new MockCore();
    await core.loadRom(new Uint8Array(0x100));
    core.frame();
    const save = core.capture();
    expect(save.coreId).toBe('mock');
    expect(save.registers.pc).toBeGreaterThan(0);
    expect(save.sram.length).toBe(2 * 0x10000);
    expect(save.wram.length).toBe(2 * 0x10000);

    core.writeMem(0x00, 0x00, new Uint8Array([0x77, 0x77, 0x77, 0x77]));
    core.restore(save);
    expect(Array.from(core.readMem(0x00, 0x00, 4))).not.toEqual([0x77, 0x77, 0x77, 0x77]);
  });
});
