import { describe, expect, it } from 'vitest';
import { BTN, type SnesCore } from '../src/core/types';
import { InputManager } from '../src/runtime/input';

/** Records every setController call so we can assert the composed mask. */
function recordingCore() {
  const calls: number[] = [];
  const core = {
    setController(_player: number, buttons: number): void {
      calls.push(buttons);
    },
  } as unknown as SnesCore;
  return { core, calls };
}

describe('InputManager touch mask', () => {
  it('pushes the touch mask to the core', () => {
    const { core, calls } = recordingCore();
    const input = new InputManager(core);

    input.setTouchMask(BTN.A);
    expect(calls.at(-1)).toBe(BTN.A);
  });

  it('ORs multiple held buttons (a D-pad direction + a face button at once)', () => {
    const { core, calls } = recordingCore();
    const input = new InputManager(core);

    const mask = BTN.UP | BTN.RIGHT | BTN.A;
    input.setTouchMask(mask);
    expect(calls.at(-1)).toBe(mask);
  });

  it('releases a button when the mask drops its bit', () => {
    const { core, calls } = recordingCore();
    const input = new InputManager(core);

    input.setTouchMask(BTN.A | BTN.START);
    input.setTouchMask(BTN.A); // finger lifts off START
    expect(calls.at(-1)).toBe(BTN.A);
  });

  it('ignores an unchanged mask (no redundant core push)', () => {
    const { core, calls } = recordingCore();
    const input = new InputManager(core);

    input.setTouchMask(BTN.A);
    const n = calls.length;
    input.setTouchMask(BTN.A); // identical → should not push again
    expect(calls.length).toBe(n);
  });
});
