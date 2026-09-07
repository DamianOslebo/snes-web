import {
  SNES_ACTIONS, defaultBindings, describeInput, loadBindings, saveBindings,
  type SnesAction, type GamepadInput,
} from '../runtime/gamepad-bindings';

/**
 * The controller-binding config page (opened via `?bindings=1`, reached from
 * the "Controller" button). A standalone view — it does NOT boot the emulator
 * or audio, so it's light and works the moment a pad is paired.
 *
 * Each row is an SNES action. "Set…" arms a capture: the next button press
 * (or stick deflection) on the connected pad is assigned to that action and
 * saved immediately. Buttons already held when capture starts are ignored so a
 * resting thumb doesn't fire a binding. "Reset" restores the standard mapping.
 */
export function mountBindings(container: HTMLElement): void {
  container.innerHTML = '';

  let bindings = loadBindings();
  let pad: Gamepad | null = null;
  let pendingAction: SnesAction | null = null;
  // Baseline for the armed capture: inputs already active when "Set…" was hit.
  let heldButtons = new Set<number>();
  let baseAxes: number[] = [];

  const style = document.createElement('style');
  style.textContent = CSS;
  container.appendChild(style);

  const root = el('div', 'bind-root');

  const h1 = el('h1', 'bind-title', 'Controller bindings');
  const sub = el('p', 'bind-sub',
    'Assign each SNES action to a button or stick on your controller. ' +
    'Click "Set…", then press the input you want to use.');
  const status = el('div', 'bind-status');
  root.append(h1, sub, status);

  const list = el('div', 'bind-list');
  const valueEls = new Map<SnesAction, HTMLElement>();
  const setBtns = new Map<SnesAction, HTMLButtonElement>();
  for (const action of SNES_ACTIONS) {
    const row = el('div', 'bind-row');
    const label = el('span', 'bind-label', action);
    const value = el('span', 'bind-value');
    const setBtn = el('button', 'btn bind-set', 'Set…');
    setBtn.type = 'button';
    setBtn.onclick = () => onSet(action);
    row.append(label, value, setBtn);
    list.append(row);
    valueEls.set(action, value);
    setBtns.set(action, setBtn);
  }
  root.append(list);

  const controls = el('div', 'bind-controls');
  const resetBtn = el('button', 'btn', '↺ Reset to defaults');
  resetBtn.type = 'button';
  resetBtn.onclick = () => {
    bindings = defaultBindings();
    saveBindings(bindings);
    pendingAction = null;
    update();
  };
  const backBtn = el('button', 'btn bind-back', '← Back to game');
  backBtn.type = 'button';
  backBtn.onclick = () => {
    const url = new URL(location.href);
    url.searchParams.delete('bindings');
    location.href = url.toString();
  };
  controls.append(resetBtn, backBtn);
  root.append(controls);

  container.appendChild(root);

  function onSet(action: SnesAction): void {
    if (pendingAction === action) { // click again to cancel the armed capture
      pendingAction = null;
      update();
      return;
    }
    pendingAction = action;
    // Snapshot the pad's current state so only a NEW press/deflection binds.
    const g = getConnectedPad();
    heldButtons = new Set<number>();
    if (g) g.buttons.forEach((b, i) => { if (b.pressed) heldButtons.add(i); });
    baseAxes = g ? g.axes.map((a) => a) : [];
    update();
  }

  function update(): void {
    status.textContent = pad
      ? `🎮 ${pad.id || 'Controller'} · ${pad.buttons.length} buttons · ${pad.axes.length} axes`
      : 'No controller detected. Pair one, then click "Set…" and press an input.';
    for (const action of SNES_ACTIONS) {
      valueEls.get(action)!.textContent = describeInput(bindings[action]);
      setBtns.get(action)!.textContent =
        pendingAction === action ? 'Listening… (Esc / click = cancel)' : 'Set…';
    }
  }

  // One loop does both jobs: keep `pad` fresh (so a pad paired after the page
  // opened is picked up) and, while a capture is armed, watch for the next
  // new input relative to the baseline.
  const loop = (): void => {
    const g = getConnectedPad();
    if (g !== pad) {
      pad = g;
      update();
    }
    if (pendingAction && pad) {
      const found = nextInput(pad, heldButtons, baseAxes);
      if (found) {
        bindings = { ...bindings, [pendingAction]: found };
        saveBindings(bindings);
        pendingAction = null;
        update();
      }
    }
    window.requestAnimationFrame(loop);
  };
  window.requestAnimationFrame(loop);

  const onEsc = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && pendingAction) {
      e.preventDefault();
      pendingAction = null;
      update();
    }
  };
  window.addEventListener('keydown', onEsc);
}

/** First button/axis on `gp` that changed since the baseline, or null. */
function nextInput(gp: Gamepad, held: Set<number>, baseAxes: number[]): GamepadInput | null {
  for (let i = 0; i < gp.buttons.length; i++) {
    if (gp.buttons[i]?.pressed && !held.has(i)) return { kind: 'button', index: i };
  }
  for (let i = 0; i < gp.axes.length; i++) {
    const v = gp.axes[i];
    const base = baseAxes[i] ?? 0;
    if (v > 0.5 && base <= 0.5) return { kind: 'axis', index: i, dir: 1 };
    if (v < -0.5 && base >= -0.5) return { kind: 'axis', index: i, dir: -1 };
  }
  return null;
}

function getConnectedPad(): Gamepad | null {
  if (typeof navigator === 'undefined' || !navigator.getGamepads) return null;
  return Array.from(navigator.getGamepads()).find((g): g is Gamepad => g !== null && g.connected) ?? null;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const CSS = `
.bind-root { color-scheme: light dark; color: #e8e8ea; min-height: 100vh;
  font: 14px/1.5 ui-sans-serif, system-ui, sans-serif; background: #0d0d10;
  padding: 24px; max-width: 640px; margin: 0 auto; }
.bind-title { font-size: 22px; margin: 0 0 4px; font-weight: 650; }
.bind-sub { color: #8a8a92; margin: 0 0 16px; }
.bind-status { background: #141418; border: 1px solid #2a2a30; border-radius: 8px;
  padding: 10px 12px; margin-bottom: 16px; color: #9fd0ff; }
.bind-list { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.bind-row { display: flex; align-items: center; gap: 8px; background: #141418;
  border: 1px solid #2a2a30; border-radius: 8px; padding: 8px 10px; }
.bind-label { flex: 0 0 64px; font-weight: 600; }
.bind-value { flex: 1; color: #8a8a92; font: 12px ui-monospace, SFMono-Regular, Menlo, monospace;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bind-set { flex: 0 0 auto; }
.btn { background: #1c1c22; color: #e8e8ea; border: 1px solid #33333c; border-radius: 6px;
  padding: 5px 11px; cursor: pointer; font: inherit; }
.btn:hover { background: #26262e; }
.bind-set { min-width: 74px; }
.bind-controls { display: flex; gap: 8px; margin-top: 20px; }
.bind-back { margin-left: auto; }
@media (max-width: 520px) { .bind-list { grid-template-columns: 1fr; } }
`;
