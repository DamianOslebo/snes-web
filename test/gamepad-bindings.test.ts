import { describe, expect, it } from 'vitest';
import { BTN } from '../src/core/types';
import {
  SNES_ACTIONS, STORAGE_KEY,
  defaultBindings, describeInput, loadBindings, maskFromBindings, saveBindings,
  type Bindings,
} from '../src/runtime/gamepad-bindings';

/** A stand-in Gamepad with the standard button/axis count. */
function fakePad(opts: { buttons?: Record<number, boolean>; axes?: number[] } = {}): Gamepad {
  const buttons: GamepadButton[] = [];
  for (let i = 0; i < 16; i++) {
    const pressed = !!opts.buttons?.[i];
    buttons.push({ pressed, touched: pressed, value: pressed ? 1 : 0 });
  }
  return {
    id: 'test-pad', index: 0, mapping: 'standard', timestamp: 0,
    buttons, axes: opts.axes ?? [0, 0, 0, 0],
  } as unknown as Gamepad;
}

describe('defaultBindings', () => {
  it('covers all 12 SNES actions with a well-formed input each', () => {
    const b = defaultBindings();
    for (const a of SNES_ACTIONS) {
      const v = b[a];
      expect(v?.kind).toBeTypeOf('string');
      expect(['button', 'axis']).toContain(v.kind);
    }
  });

  it('keeps the standard Gamepad API layout', () => {
    const b = defaultBindings();
    expect(b.B).toEqual({ kind: 'button', index: 0 });
    expect(b.A).toEqual({ kind: 'button', index: 4 });
    expect(b.Up).toEqual({ kind: 'button', index: 9 });
  });
});

describe('maskFromBindings', () => {
  it('lights the SNES bit for a pressed bound button', () => {
    const mask = maskFromBindings(fakePad({ buttons: { 4: true } }), defaultBindings());
    expect(mask & BTN.A).toBe(BTN.A);
    expect(mask & BTN.B).toBe(0);
  });

  it('combines several held buttons into one mask', () => {
    // A (4) + UP (9) + RIGHT (12)
    const mask = maskFromBindings(
      fakePad({ buttons: { 4: true, 9: true, 12: true } }),
      defaultBindings(),
    );
    expect(mask & (BTN.A | BTN.UP | BTN.RIGHT)).toBe(BTN.A | BTN.UP | BTN.RIGHT);
  });

  it('registers an axis binding past the dead zone', () => {
    const b: Bindings = { ...defaultBindings(), Up: { kind: 'axis', index: 1, dir: -1 } };
    const mask = maskFromBindings(fakePad({ axes: [0, -1, 0, 0] }), b);
    expect(mask & BTN.UP).toBe(BTN.UP);
  });

  it('ignores an axis inside the dead zone', () => {
    const b: Bindings = { ...defaultBindings(), Up: { kind: 'axis', index: 1, dir: -1 } };
    const mask = maskFromBindings(fakePad({ axes: [0, -0.2, 0, 0] }), b);
    expect(mask & BTN.UP).toBe(0);
  });

  it('does not crash when the pad has no axes', () => {
    const b: Bindings = { ...defaultBindings(), Up: { kind: 'axis', index: 0, dir: 1 } };
    const pad = fakePad({ buttons: { 0: true } });
    (pad as unknown as { axes?: unknown }).axes = undefined;
    expect(maskFromBindings(pad, b) & BTN.B).toBe(BTN.B);
  });
});

describe('describeInput', () => {
  it('labels buttons and axes', () => {
    expect(describeInput({ kind: 'button', index: 4 })).toBe('Button 4');
    expect(describeInput({ kind: 'axis', index: 1, dir: -1 })).toBe('Axis 1 −');
  });
});

describe('persistence', () => {
  const store = new Map<string, string>();
  const nav = globalThis as Record<string, unknown>;
  nav.localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, String(v)); },
    removeItem: (k: string) => { store.delete(k); },
  };

  it('returns defaults when nothing is stored', () => {
    expect(loadBindings()).toEqual(defaultBindings());
  });

  it('round-trips a user change through save/load', () => {
    const b = defaultBindings();
    b.Start = { kind: 'button', index: 8 };
    saveBindings(b);
    expect(store.has(STORAGE_KEY)).toBe(true);
    expect(loadBindings().Start).toEqual({ kind: 'button', index: 8 });
    // Unchanged actions survive too.
    expect(loadBindings().A).toEqual({ kind: 'button', index: 4 });
  });

  it('falls back to defaults on a corrupt store', () => {
    store.set(STORAGE_KEY, '{not-json');
    expect(loadBindings()).toEqual(defaultBindings());
  });

  it('ignores malformed entries in a partial store', () => {
    store.set(STORAGE_KEY, JSON.stringify({ A: { bogus: true }, B: { kind: 'button', index: 2 } }));
    const b = loadBindings();
    expect(b.A).toEqual({ kind: 'button', index: 4 }); // default kept
    expect(b.B).toEqual({ kind: 'button', index: 2 }); // valid entry used
  });
});
