import { BTN } from '../core/types';

/**
 * On-screen SNES controller for touch devices.
 *
 * Discrete buttons (D-pad, A/B/X/Y, L/R, Start/Select) laid out like a real
 * pad: shoulders + Start/Select along the top, D-pad bottom-left, face
 * buttons bottom-right. Rendered as a fixed overlay that is inert until it
 * carries `.active` (set by focus mode, see main.ts).
 *
 * Pointer Events + per-pointer tracking (not per-button booleans) so several
 * buttons can be held at once — a thumb on *Up* while a finger is on *A*.
 * Each press/recompute calls the `apply` hook with the full pressed-bit mask;
 * main.ts wires that to `InputManager.setTouchMask`, so the keyboard /
 * gamepad / touch masks are still composed in exactly one place.
 */

type Apply = (mask: number) => void;

interface Spec {
  bit: number;
  label: string;
  cls: string;
}

const SHOULDER: Spec[] = [
  { bit: BTN.L, label: 'L', cls: 'tc-l' },
  { bit: BTN.R, label: 'R', cls: 'tc-r' },
];
const CENTER: Spec[] = [
  { bit: BTN.SELECT, label: 'SELECT', cls: 'tc-select' },
  { bit: BTN.START, label: 'START', cls: 'tc-start' },
];
const DPAD: Spec[] = [
  { bit: BTN.UP, label: '▲', cls: 'tc-up' },
  { bit: BTN.DOWN, label: '▼', cls: 'tc-down' },
  { bit: BTN.LEFT, label: '◀', cls: 'tc-left' },
  { bit: BTN.RIGHT, label: '▶', cls: 'tc-right' },
];
const FACE: Spec[] = [
  { bit: BTN.X, label: 'X', cls: 'tc-x' },
  { bit: BTN.Y, label: 'Y', cls: 'tc-y' },
  { bit: BTN.B, label: 'B', cls: 'tc-b' },
  { bit: BTN.A, label: 'A', cls: 'tc-a' },
];

export class TouchController {
  readonly root: HTMLElement;

  private readonly apply: Apply;
  /** pointerId → pressed bit; a finger on each button is a distinct pointer. */
  private readonly pointers = new Map<number, number>();

  constructor(apply: Apply) {
    this.apply = apply;
    injectCss();
    const root = (this.root = document.createElement('div'));
    root.className = 'touchpad';
    root.setAttribute('role', 'group');
    root.setAttribute('aria-label', 'On-screen controller');

    root.appendChild(this.group('tc-shoulder', SHOULDER));
    root.appendChild(this.group('tc-center', CENTER));
    root.appendChild(this.group('tc-dpad', DPAD));
    root.appendChild(this.group('tc-face', FACE));

    // Leaving the window kills any in-flight touches; clear so we don't hold
    // a button after regaining focus.
    window.addEventListener('blur', this.onBlur);
  }

  private group(cls: string, specs: Spec[]): HTMLElement {
    const g = document.createElement('div');
    g.className = `tc-group ${cls}`;
    for (const s of specs) g.appendChild(this.button(s));
    return g;
  }

  private button(s: Spec): HTMLButtonElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `tc-btn ${s.cls}`;
    b.textContent = s.label;
    b.dataset.bit = String(s.bit);
    b.setAttribute('aria-label', `SNES ${s.label}`);
    b.addEventListener('pointerdown', (e) => this.onDown(e, s.bit, b));
    b.addEventListener('pointerup', (e) => this.onUp(e, b));
    b.addEventListener('pointercancel', (e) => this.onUp(e, b));
    b.addEventListener('contextmenu', (e) => e.preventDefault()); // no long-press menu
    return b;
  }

  private onDown(e: PointerEvent, bit: number, el: HTMLButtonElement): void {
    e.preventDefault();
    // Capture so pointerup is delivered here even if the finger drifts.
    el.setPointerCapture?.(e.pointerId);
    this.pointers.set(e.pointerId, bit);
    el.classList.add('is-down');
    this.push();
  }

  private onUp(e: PointerEvent, el: HTMLButtonElement): void {
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.delete(e.pointerId);
    el.classList.remove('is-down');
    this.push();
  }

  private push(): void {
    let mask = 0;
    for (const bit of this.pointers.values()) mask |= bit;
    this.apply(mask);
  }

  private onBlur = (): void => {
    this.clear();
  };

  /** Release every held button and report the empty mask to the core. */
  clear(): void {
    if (this.pointers.size === 0) return;
    this.pointers.clear();
    this.root.querySelectorAll('.tc-btn.is-down').forEach((b) => b.classList.remove('is-down'));
    this.apply(0);
  }

  /** Show / hide the overlay (call from focus mode). Hiding also releases. */
  setEnabled(on: boolean): void {
    if (on) this.root.classList.add('active');
    else {
      this.root.classList.remove('active');
      this.clear();
    }
  }

  unmount(): void {
    window.removeEventListener('blur', this.onBlur);
    this.clear();
    this.root.remove();
  }
}

const CSS = `
.touchpad { position: fixed; inset: 0; z-index: 30; pointer-events: none;
  font: 600 14px/1 ui-sans-serif, system-ui, sans-serif;
  --tc: min(60px, 15vmin); display: none; }
.touchpad.active { display: block; }
.tc-group { position: absolute; pointer-events: none; }
.tc-btn { position: absolute; pointer-events: auto; touch-action: none;
  user-select: none; -webkit-user-select: none; -webkit-tap-highlight-color: transparent;
  width: var(--tc); height: var(--tc); border-radius: 50%;
  border: 1.5px solid rgba(255,255,255,.38); background: rgba(28,28,38,.6);
  color: #fff; display: grid; place-items: center; backdrop-filter: blur(3px);
  font-size: calc(var(--tc) * .36); }
.tc-btn.is-down { background: rgba(96,120,255,.72); border-color: #fff; }

/* Top row: shoulders on the ends, Select/Start in the middle. Sits below the
   exit-focus button (top: 8px, ~34px tall) so the two never overlap. */
.tc-shoulder { left: 14px; right: 14px; top: 58px; display: flex; justify-content: space-between; }
.tc-shoulder .tc-btn { position: static; width: calc(var(--tc) * 1.7); height: calc(var(--tc) * .8); border-radius: 12px; }
.tc-center { left: 50%; top: 60px; transform: translateX(-50%); display: flex; gap: 12px; }
.tc-center .tc-btn { position: static; width: auto; padding: 0 15px; height: calc(var(--tc) * .72); border-radius: 999px; font-size: 11px; }

/* D-pad (cross), bottom-left. */
.tc-dpad { left: 14px; bottom: 18px; width: calc(var(--tc) * 3 + 10px); height: calc(var(--tc) * 3 + 10px); }
.tc-dpad .tc-btn { border-radius: 14px; }
.tc-dpad .tc-up { left: 50%; top: 0; transform: translateX(-50%); }
.tc-dpad .tc-down { left: 50%; bottom: 0; transform: translateX(-50%); }
.tc-dpad .tc-left { left: 0; top: 50%; transform: translateY(-50%); }
.tc-dpad .tc-right { right: 0; top: 50%; transform: translateY(-50%); }

/* Face buttons (diamond), bottom-right. */
.tc-face { right: 14px; bottom: 18px; width: calc(var(--tc) * 3 + 10px); height: calc(var(--tc) * 3 + 10px); }
.tc-face .tc-x { left: 50%; top: 0; transform: translateX(-50%); }
.tc-face .tc-y { left: 0; top: 50%; transform: translateY(-50%); }
.tc-face .tc-b { right: 0; top: 50%; transform: translateY(-50%); }
.tc-face .tc-a { left: 50%; bottom: 0; transform: translateX(-50%); }
`;

/** Inject the overlay stylesheet once per document (idempotent). */
function injectCss(): void {
  if (typeof document === 'undefined' || document.getElementById('snes-touch-css')) return;
  const style = document.createElement('style');
  style.id = 'snes-touch-css';
  style.textContent = CSS;
  document.head.appendChild(style);
}
