import { BTN } from '../core/types';

/**
 * Configurable gamepad → SNES button mapping.
 *
 * The Gamepad API reports a *standard mapping* (a fixed button/axis index
 * layout), but which of those inputs a given physical pad puts a finger on is
 * a user preference. This module holds the mapping as data: one `GamepadInput`
 * per SNES action, persisted to localStorage, and applied by `InputManager`
 * via `maskFromBindings`. The on-screen "Controller" config page
 * (src/ui/bindings.ts) edits the same stored state.
 *
 * A binding is either a *button* (by index) or an *axis* (by index +
 * direction) — axes cover pads whose D-pad is an analog stick (most modern
 * controllers), which have no dedicated D-pad buttons.
 */

/** One input on a Gamepad: a button by index, or an axis by index + direction. */
export type GamepadInput =
  | { kind: 'button'; index: number }
  | { kind: 'axis'; index: number; dir: 1 | -1 };

/** The 12 SNES controller actions, in a stable display order. */
export const SNES_ACTIONS = [
  'A', 'B', 'X', 'Y',
  'L', 'R',
  'Select', 'Start',
  'Up', 'Down', 'Left', 'Right',
] as const;
export type SnesAction = (typeof SNES_ACTIONS)[number];

/** A complete set of bindings: one input for every SNES action. */
export type Bindings = Record<SnesAction, GamepadInput>;

const ACTION_BIT: Record<SnesAction, number> = {
  A: BTN.A, B: BTN.B, X: BTN.X, Y: BTN.Y,
  L: BTN.L, R: BTN.R,
  Select: BTN.SELECT, Start: BTN.START,
  Up: BTN.UP, Down: BTN.DOWN, Left: BTN.LEFT, Right: BTN.RIGHT,
};

/**
 * The factory mapping — matches the standard Gamepad API layout and the
 * mapping the emulator shipped with before bindings were configurable, so a
 * fresh install behaves exactly as it always has.
 */
export function defaultBindings(): Bindings {
  return {
    A: { kind: 'button', index: 4 },
    B: { kind: 'button', index: 0 },
    X: { kind: 'button', index: 5 },
    Y: { kind: 'button', index: 1 },
    L: { kind: 'button', index: 6 },
    R: { kind: 'button', index: 7 },
    Select: { kind: 'button', index: 2 },
    Start: { kind: 'button', index: 3 },
    Up: { kind: 'button', index: 9 },
    Down: { kind: 'button', index: 10 },
    Left: { kind: 'button', index: 11 },
    Right: { kind: 'button', index: 12 },
  };
}

/** Axis magnitude above which a stick counts as deflected (dead zone). */
const AXIS_DEADZONE = 0.5;

/** Compute the SNES button mask for a live gamepad under the given bindings. */
export function maskFromBindings(gp: Gamepad, b: Bindings): number {
  let mask = 0;
  const axes = gp.axes ?? [];
  for (const action of SNES_ACTIONS) {
    const bit = ACTION_BIT[action];
    const input = b[action];
    if (input.kind === 'button') {
      if (gp.buttons[input.index]?.pressed) mask |= bit;
    } else if (axes[input.index] !== undefined && axes[input.index] * input.dir > AXIS_DEADZONE) {
      mask |= bit;
    }
  }
  return mask;
}

/** Human-readable label for an input (config page + any future display). */
export function describeInput(input: GamepadInput): string {
  return input.kind === 'button'
    ? `Button ${input.index}`
    : `Axis ${input.index} ${input.dir > 0 ? '+' : '−'}`;
}

export const STORAGE_KEY = 'snes-web:gamepad-bindings:v1';

/** Load persisted bindings; any missing/invalid action falls back to the default. */
export function loadBindings(): Bindings {
  const out = defaultBindings();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return out;
    const parsed = JSON.parse(raw) as Partial<Record<SnesAction, GamepadInput>>;
    for (const action of SNES_ACTIONS) {
      const v = parsed[action];
      if (v && (v.kind === 'button' || v.kind === 'axis')) out[action] = v;
    }
    return out;
  } catch {
    // No localStorage (node), unset, or corrupt JSON → safe defaults.
    return out;
  }
}

/** Persist bindings. No-op (no throw) where localStorage is unavailable. */
export function saveBindings(b: Bindings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(b));
  } catch {
    // Storage unavailable (private mode / non-browser): bindings stay in-memory.
  }
}
