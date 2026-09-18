/**
 * Input probe (opened via `?inputtest=1`). Standalone — no core, no audio —
 * it shows, live, exactly what the phone/browser reports when you press a
 * controller: every keydown/keyup (with `code`, `keyCode`, `key`, `which`)
 * plus a snapshot of the Web Gamepad API.
 *
 * Why it exists: mobile browsers do not expose the Gamepad API, so a gamepad
 * (e.g. a Backbone) may only reach a web page as keyboard events — or not at
 * all. This page tells us definitively which, so we know whether in-browser
 * button binding is even possible on this device before we wire anything up.
 */
export function mountInputTest(container: HTMLElement): void {
  container.innerHTML = '';

  const style = document.createElement('style');
  style.textContent = CSS;
  container.appendChild(style);

  const root = el('div', 'it-root');
  root.appendChild(el('h1', 'it-title', 'Input probe'));
  root.appendChild(el('p', 'it-sub',
    'Plug in your controller, then press and hold each button. ' +
    'Whatever the browser reports shows up below, live.'));

  // --- Web Gamepad API ----------------------------------------------------
  const gpCard = el('div', 'it-card');
  gpCard.appendChild(el('h2', 'it-h', 'Web Gamepad API'));
  const gpStatus = el('div', 'it-status it-wait');
  const gpList = el('div', 'it-list');
  gpCard.append(gpStatus, gpList);
  root.appendChild(gpCard);

  // --- Keyboard events ----------------------------------------------------
  const keyCard = el('div', 'it-card');
  keyCard.appendChild(el('h2', 'it-h', 'Keyboard events (keydown / keyup)'));
  const keyStatus = el('div', 'it-status it-wait', 'Press a controller button…');
  const keyList = el('div', 'it-list');
  keyCard.append(keyStatus, keyList);
  root.appendChild(keyCard);

  const clearBtn = el('button', 'btn it-clear', 'Clear');
  clearBtn.type = 'button';
  clearBtn.onclick = () => { keyList.innerHTML = ''; };
  root.appendChild(clearBtn);

  container.appendChild(root);

  function push(list: HTMLElement, status: HTMLElement, text: string): void {
    status.classList.remove('it-wait');
    const row = el('div', 'it-row', text);
    list.prepend(row);
    while (list.children.length > 50) list.lastChild?.remove();
  }

  const onKey = (label: string) => (e: KeyboardEvent): void => {
    if (e.repeat) return;
    push(keyList, keyStatus,
      `${label.padEnd(6)}  code="${e.code}"   keyCode=${e.keyCode}   key="${e.key}"   which=${e.which}`);
  };
  window.addEventListener('keydown', onKey('keydown'));
  window.addEventListener('keyup', onKey('keyup'));

  // Poll the Gamepad API: some engines only start reporting a pad after it's
  // been used, so refresh on input and on a light timer.
  function refreshGamepads(): void {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) {
      gpStatus.classList.add('it-wait');
      gpStatus.textContent = 'navigator.getGamepads() is not available in this browser.';
      gpList.innerHTML = '';
      return;
    }
    const pads = Array.from(navigator.getGamepads()).filter(
      (g): g is Gamepad => g !== null && g.connected,
    );
    if (pads.length === 0) {
      gpStatus.classList.add('it-wait');
      gpStatus.textContent = 'No connected gamepad reported by the Gamepad API.';
      gpList.innerHTML = '';
      return;
    }
    gpStatus.classList.remove('it-wait');
    gpStatus.textContent = `${pads.length} gamepad(s) via the Gamepad API:`;
    gpList.innerHTML = '';
    for (const g of pads) {
      gpList.append(el('div', 'it-row', `${g.id}  (mapping="${g.mapping}")`));
      g.buttons.forEach((b, i) => {
        if (b.pressed) gpList.append(el('div', 'it-row', `  button ${i} pressed`));
      });
      g.axes.forEach((a, i) => {
        if (Math.abs(a) > 0.01) gpList.append(el('div', 'it-row', `  axis ${i} = ${a.toFixed(2)}`));
      });
    }
  }
  refreshGamepads();
  window.addEventListener('keydown', refreshGamepads);
  const timer = window.setInterval(refreshGamepads, 1000);
  window.addEventListener('pagehide', () => window.clearInterval(timer), { once: true });
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const CSS = `
.it-root { color-scheme: light dark; color: #e8e8ea; min-height: 100vh;
  font: 15px/1.5 ui-sans-serif, system-ui, sans-serif; background: #0d0d10;
  padding: 24px; max-width: 640px; margin: 0 auto; }
.it-title { font-size: 22px; margin: 0 0 4px; font-weight: 650; }
.it-sub { color: #8a8a92; margin: 0 0 16px; }
.it-card { background: #141418; border: 1px solid #2a2a30; border-radius: 8px;
  padding: 10px 12px; margin-bottom: 14px; }
.it-h { font-size: 13px; text-transform: uppercase; letter-spacing: .06em;
  color: #8a8a92; margin: 0 0 8px; }
.it-status { color: #9fd0ff; font: 12px ui-monospace, SFMono-Regular, Menlo, monospace;
  margin-bottom: 8px; }
.it-status.it-wait { color: #8a8a92; }
.it-list { display: flex; flex-direction: column; gap: 4px;
  font: 12px ui-monospace, SFMono-Regular, Menlo, monospace;
  max-height: 40vh; overflow: auto; }
.it-row { background: #0d0d10; border: 1px solid #2a2a30; border-radius: 6px;
  padding: 6px 8px; white-space: pre-wrap; word-break: break-all; }
.btn { background: #1c1c22; color: #e8e8ea; border: 1px solid #33333c; border-radius: 6px;
  padding: 6px 12px; cursor: pointer; font: inherit; }
.btn:hover { background: #26262e; }
`;
