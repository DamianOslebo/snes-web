/**
 * Minimal, dependency-free UI shell: screen, transport controls, ROM loader,
 * status line, and a slot (`debug`) the debugger (src/debug) fills in.
 */

export interface Ui {
  root: HTMLElement;
  canvas: HTMLCanvasElement;
  status: HTMLElement;
  romInput: HTMLInputElement;
  playBtn: HTMLButtonElement;
  pauseBtn: HTMLButtonElement;
  stepBtn: HTMLButtonElement;
  saveBtn: HTMLButtonElement;
  asmBtn: HTMLButtonElement;
  focusBtn: HTMLButtonElement;
  fullscreenBtn: HTMLButtonElement;
  bindingsBtn: HTMLButtonElement;
  exitFocusBtn: HTMLButtonElement;
  debug: HTMLElement;
}

export function buildUi(mount: HTMLElement): Ui {
  mount.innerHTML = '';
  const style = document.createElement('style');
  style.textContent = CSS;
  mount.appendChild(style);

  const root = el('div', 'shell');

  const header = el('header', 'header');
  header.appendChild(el('h1', 'title', 'SNES Web'));
  const status = el('div', 'status', 'booting…');
  header.appendChild(status);
  root.appendChild(header);

  const main = el('div', 'main');

  // --- left: screen + transport -----------------------------------------
  const left = el('div', 'left');
  const canvas = document.createElement('canvas');
  canvas.className = 'screen';
  left.appendChild(canvas);

  const transport = el('div', 'transport');
  const romInput = document.createElement('input');
  romInput.type = 'file';
  romInput.accept = '.sfc,.smc,.fig,.bin,.zip';
  romInput.className = 'rom-input';
  const romBtn = el('button', 'btn', 'Load ROM…');
  romBtn.addEventListener('click', () => romInput.click());
  transport.appendChild(romBtn);
  transport.appendChild(romInput);

  const playBtn = el('button', 'btn', '▶ Run');
  const pauseBtn = el('button', 'btn', '⏸ Pause');
  const stepBtn = el('button', 'btn', '⏭ Step');
  const saveBtn = el('button', 'btn', '💾 Save state');
  // The 65C816 assembler — a full page (?asm=1) for writing/reviewing code.
  // Always visible (unlike the gamepad-only Controller button).
  const asmBtn = el('button', 'btn', '⌨ Assembler');
  asmBtn.title = 'Open the 65C816 assembler';
  const focusBtn = el('button', 'btn', '🎮 Focus');
  const fullscreenBtn = el('button', 'btn', '⛶ Fullscreen');
  // Only meaningful once a gamepad is detected; main.ts reveals it then
  // (onGamepadChange) — it opens the binding-config page.
  const bindingsBtn = el('button', 'btn', '🎮 Controller');
  bindingsBtn.hidden = true;
  bindingsBtn.title = 'Configure controller button bindings';
  for (const b of [playBtn, pauseBtn, stepBtn, saveBtn, asmBtn, focusBtn, fullscreenBtn, bindingsBtn]) {
    transport.appendChild(b);
  }
  // Keep the keyboard for the game: a clicked button would otherwise retain
  // focus and Space/Enter would re-fire its click mid-play (Enter is SNES
  // START, and Space activates focused buttons on keyup).
  transport.addEventListener('click', (e) => {
    if (e.target instanceof HTMLButtonElement) e.target.blur();
  });
  left.appendChild(transport);
  main.appendChild(left);

  // --- right: debugger slot ---------------------------------------------
  const debug = el('div', 'debug');
  main.appendChild(debug);

  root.appendChild(main);

  // Key legend, only visible in focus mode (see .focused CSS below).
  root.appendChild(el('div', 'focus-hint',
    'F1 exit focus · F fullscreen · Z A X S buttons · Q L · E R · Enter Start · Shift Select · arrows D-pad'));

  // Exit-focus button: the touch affordance for leaving focus mode (Esc/F1 are
  // keyboard-only). Shown only while focused; also handy on desktop.
  const exitFocusBtn = el('button', 'exit-focus', '✕ Exit');
  root.appendChild(exitFocusBtn);

  mount.appendChild(root);

  return { root, canvas, status, romInput, playBtn, pauseBtn, stepBtn, saveBtn, asmBtn, focusBtn, fullscreenBtn, bindingsBtn, exitFocusBtn, debug };
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const CSS = `
* { box-sizing: border-box; }
[hidden] { display: none !important; }
.shell { color-scheme: light dark; color: #e8e8ea; font: 14px/1.4 ui-sans-serif, system-ui, sans-serif;
  min-height: 100vh; padding: 16px; background: #0d0d10; }
.header { display: flex; align-items: baseline; gap: 16px; margin-bottom: 16px; }
.title { font-size: 20px; margin: 0; font-weight: 650; }
.status { color: #8a8a92; font-variant-numeric: tabular-nums; }
.main { display: flex; gap: 16px; align-items: flex-start; flex-wrap: wrap; }
.left { display: flex; flex-direction: column; gap: 12px; }
.screen { width: 512px; height: 448px; image-rendering: pixelated;
  background: #000; border: 1px solid #2a2a30; }
.transport { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.btn { background: #1c1c22; color: #e8e8ea; border: 1px solid #33333c; border-radius: 6px;
  padding: 6px 12px; cursor: pointer; font: inherit; }
.btn:hover { background: #26262e; }
.rom-input { display: none; }
.debug { flex: 1 1 360px; display: flex; flex-direction: column; gap: 12px; }
.debug h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .06em;
  color: #8a8a92; margin: 0 0 6px; }
.debug .panel { background: #141418; border: 1px solid #2a2a30; border-radius: 8px; padding: 10px 12px; }
.debug pre { margin: 0; font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace;
  overflow: auto; max-height: 260px; }
.debug .row { display: flex; justify-content: space-between; font: 12px/1.6 ui-monospace, monospace; }
.debug .row .k { color: #8a8a92; }
.debug .pc { color: #7cd0ff; }
.debug .bplist { margin: 6px 0 0; padding: 0; list-style: none; font: 12px ui-monospace, monospace; }
.debug .bplist li { display: flex; justify-content: space-between; }
.debug .bplist button { background: none; border: none; color: #ff8a8a; cursor: pointer; font: inherit; }
.debug input { background: #0d0d10; border: 1px solid #33333c; color: #e8e8ea;
  border-radius: 4px; padding: 3px 6px; font: 12px ui-monospace, monospace; }
.debug .toolbar { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; margin-bottom: 8px; }

/* --- focus mode: chrome away, canvas fills the viewport (4:3) ----------- */
.shell.focused { padding: 0; }
.shell.focused .header,
.shell.focused .transport,
.shell.focused .debug { display: none; }
.shell.focused .main { min-height: 100vh; align-items: center; justify-content: center; }
.shell.focused .screen { width: min(calc(100vw - 24px), calc((100vh - 56px) * 4 / 3));
  height: auto; aspect-ratio: 4 / 3; }
.focus-hint { display: none; position: fixed; bottom: 10px; left: 50%; transform: translateX(-50%);
  color: #8a8a92; font-size: 12px; white-space: nowrap; z-index: 10; }
.shell.focused .focus-hint { display: block; }

/* Exit-focus: the touch escape hatch for focus mode (Esc/F1 are keyboard-only). */
.exit-focus { display: none; position: fixed; top: 8px; left: 50%; transform: translateX(-50%);
  z-index: 40; background: rgba(28,28,38,.7); color: #e8e8ea; border: 1px solid #3a3a44;
  border-radius: 999px; padding: 6px 14px; cursor: pointer; font: inherit; touch-action: manipulation; }
.shell.focused .exit-focus { display: inline-block; }

/* --- fullscreen: same scaling, shell paints its own background ---------- */
.shell:fullscreen { padding: 0; background: #000; overflow: auto; }
.shell:fullscreen .main { min-height: 100vh; }
.shell:fullscreen .screen { width: min(calc(100vw - 24px), calc((100vh - 24px) * 4 / 3));
  height: auto; aspect-ratio: 4 / 3; }
`;
