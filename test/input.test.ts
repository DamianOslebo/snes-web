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

describe('InputManager gamepad presence (Bluetooth → touch fallback)', () => {
  // The node test env has no real Gamepad API; stub getGamepads to simulate a
  // pad appearing and disappearing, and assert the presence callback that
  // main.ts uses to swap the on-screen touch controller on/off.
  const g = globalThis as Record<string, unknown>;
  const nav = (g.navigator ?? (g.navigator = {})) as { getGamepads?: () => (Gamepad | null)[] };

  it('fires onGamepadChange(true) when a pad connects, (false) when it drops', () => {
    const { core } = recordingCore();
    const input = new InputManager(core);
    const events: boolean[] = [];
    input.onGamepadChange = (c) => events.push(c);

    const original = nav.getGamepads;
    try {
      nav.getGamepads = () => [{ connected: true, buttons: [] } as unknown as Gamepad];
      input.pollGamepad();
      expect(events).toEqual([true]);

      input.pollGamepad(); // same state → no duplicate event
      expect(events).toEqual([true]);

      nav.getGamepads = () => [null]; // pad unplugged
      input.pollGamepad();
      expect(events).toEqual([true, false]);
    } finally {
      nav.getGamepads = original;
    }
  });
});
