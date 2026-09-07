import { BTN, type SnesCore } from '../core/types';
import { loadBindings, maskFromBindings, type Bindings } from './gamepad-bindings';

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
  private anyGamepad = false; // whether a gamepad was connected on the last check

  /** gamepad → SNES mapping, loaded from storage (see gamepad-bindings.ts). */
  private bindings: Bindings;

  /** Set by focus mode (see main.ts) to dedicate the keyboard to the game. */
  captureKeys = false;

  /**
   * Fired whenever the "is any gamepad connected?" state flips. Lets the app
   * prefer a (Bluetooth) gamepad over the on-screen touch controller and swap
   * back when the pad is unplugged (see main.ts).
   */
  onGamepadChange?: (connected: boolean) => void;

  constructor(core: SnesCore, bindings?: Bindings) {
    this.core = core;
    // Load the stored mapping (default when none exists) so the emulator uses
    // the user's bindings as soon as it boots.
    this.bindings = bindings ?? loadBindings();
  }

  /** Swap in a new gamepad → SNES mapping (e.g. after the config page saves). */
  setBindings(bindings: Bindings): void {
    this.bindings = bindings;
  }

  attach(el: HTMLElement): void {
    el.addEventListener('keydown', this.onKeyDown, { passive: false });
    el.addEventListener('keyup', this.onKeyUp, { passive: false });
    window.addEventListener('blur', this.onBlur);
    // A Bluetooth controller pairing/unpairing while the page is open fires
    // here; we use it to swap the on-screen touch controller on/off. (A pad
    // already connected before the page loaded is picked up by the poll.)
    window.addEventListener('gamepadconnected', this.onGamepadEvent);
    window.addEventListener('gamepaddisconnected', this.onGamepadEvent);
  }

  detach(el: HTMLElement): void {
    el.removeEventListener('keydown', this.onKeyDown);
    el.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('gamepadconnected', this.onGamepadEvent);
    window.removeEventListener('gamepaddisconnected', this.onGamepadEvent);
  }

  private onGamepadEvent = (): void => {
    this.emitGamepadPresence(this.anyConnectedGamepad() !== undefined);
  };

  /** Report a change in "is any gamepad connected?" to onGamepadChange. */
  private emitGamepadPresence(present: boolean): void {
    if (present === this.anyGamepad) return;
    this.anyGamepad = present;
    this.onGamepadChange?.(present);
  }

  /** First connected gamepad, or undefined if none (or on non-browser). */
  private anyConnectedGamepad(): Gamepad | undefined {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return undefined;
    return Array.from(navigator.getGamepads()).find((g): g is Gamepad => g !== null && g.connected);
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
    const gp = this.anyConnectedGamepad();
    this.emitGamepadPresence(gp !== undefined);
    if (!gp) return;
    // The mapping is data (see gamepad-bindings.ts), configurable from the
    // on-screen "Controller" page; maskFromBindings resolves it for this pad.
    const mask = maskFromBindings(gp, this.bindings);
    if (mask !== this.gamepadMask) {
      this.gamepadMask = mask;
      this.apply();
    }
  }
}
