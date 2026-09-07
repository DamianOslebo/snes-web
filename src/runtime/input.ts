import { BTN, type SnesCore } from '../core/types';

/** Keyboard → SNES button. Arrow keys + Z/X/A/S + Q/E (L/R) + Enter/Shift. */
const KEYMAP: Record<string, number> = {
  KeyZ: BTN.A,
  KeyX: BTN.B,
  KeyA: BTN.Y,
  KeyS: BTN.X,
  KeyQ: BTN.L,
  KeyE: BTN.R,
  Enter: BTN.START,
  ShiftLeft: BTN.SELECT,
  ArrowUp: BTN.UP,
  ArrowDown: BTN.DOWN,
  ArrowLeft: BTN.LEFT,
  ArrowRight: BTN.RIGHT,
};

/**
 * Tracks keyboard state and, when polled, Gamepad API state, and merges both
 * into a single button mask for player 1. Keyboard is edge-tracked on keydown/
 * up; gamepads are sampled on demand (they have no reliable release events in
 * some browsers).
 *
 * `captureKeys` (focus mode): when set, EVERY keydown/keyup is consumed —
 * the keyboard is dedicated to the game, so nothing else in the page reacts
 * (no page scroll on arrows, no Space/Enter re-clicking a focused button,
 * no typing into debugger fields). Unmapped keys are still swallowed.
 */
export class InputManager {
  private readonly core: SnesCore;
  private down = new Set<string>();
  private gamepadMask = 0;
  private touchMask = 0;

  /** Set by focus mode (see main.ts) to dedicate the keyboard to the game. */
  captureKeys = false;

  constructor(core: SnesCore) {
    this.core = core;
  }

  attach(el: HTMLElement): void {
    el.addEventListener('keydown', this.onKeyDown, { passive: false });
    el.addEventListener('keyup', this.onKeyUp, { passive: false });
    window.addEventListener('blur', this.onBlur);
  }

  detach(el: HTMLElement): void {
    el.removeEventListener('keydown', this.onKeyDown);
    el.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.repeat) return;
    const mapped = KEYMAP[e.code] !== undefined;
    if (this.captureKeys || mapped) e.preventDefault();
    if (mapped) {
      this.down.add(e.code);
      this.apply();
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    const mapped = KEYMAP[e.code] !== undefined;
    if (this.captureKeys || mapped) e.preventDefault();
    if (mapped) {
      this.down.delete(e.code);
      this.apply();
    }
  };

  private onBlur = (): void => {
    this.down.clear();
    this.gamepadMask = 0;
    this.apply();
  };

  private apply(): void {
    this.core.setController(1, this.keyboardMask() | this.gamepadMask | this.touchMask);
  }

  /**
   * Set the on-screen controller's button mask (see touch.ts). Composed with
   * keyboard + gamepad in apply(); only pushes when it actually changes so a
   * resting finger doesn't spam the core.
   */
  setTouchMask(mask: number): void {
    if (mask === this.touchMask) return;
    this.touchMask = mask;
    this.apply();
  }

  private keyboardMask(): number {
    let mask = 0;
    for (const code of this.down) mask |= KEYMAP[code] ?? 0;
    return mask;
  }

  /** Sample connected gamepads and apply. Call once per emulated frame. */
  pollGamepad(): void {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return;
    const gp = Array.from(navigator.getGamepads()).find((g) => g !== null && g.connected);
    if (!gp) return;
    let mask = 0;
    // Gamepad mapping: standard button indices.
    const b = gp.buttons;
    if (b[0]?.pressed) mask |= BTN.B;
    if (b[1]?.pressed) mask |= BTN.Y;
    if (b[2]?.pressed) mask |= BTN.SELECT;
    if (b[3]?.pressed) mask |= BTN.START;
    if (b[9]?.pressed) mask |= BTN.UP;
    if (b[10]?.pressed) mask |= BTN.DOWN;
    if (b[11]?.pressed) mask |= BTN.LEFT;
    if (b[12]?.pressed) mask |= BTN.RIGHT;
    if (b[4]?.pressed) mask |= BTN.A;
    if (b[5]?.pressed) mask |= BTN.X;
    if (b[6]?.pressed) mask |= BTN.L;
    if (b[7]?.pressed) mask |= BTN.R;
    if (mask !== this.gamepadMask) {
      this.gamepadMask = mask;
      this.apply();
    }
  }
}
