import { assemble } from '../asm/assembler';
import { buildRom, bytesToBase64, ASM_ROM_KEY, ROM_ENTRY, ROM_SIZE } from '../asm/rom';

/**
 * The 65C816 assembler as its own page (opened via `?asm=1`, reached from the
 * "Assembler" transport button). A full-width editor on the left, a live
 * listing of the assembled machine code on the right — enough room to actually
 * write and review code, which the old cramped debugger panel was not.
 *
 * The output is a **runnable SFC ROM**, not a memory write: `Assemble` builds
 * the machine code, `▶ Run in emulator` wraps it in a 256 KB LoROM image
 * (clean header, reset vector → the code, correct checksums), hands it to the
 * app via sessionStorage, and navigates so `main.ts` loads + runs it through
 * the exact same pipeline a user-picked `.sfc` uses. `⬇ Download .sfc` writes
 * the same image to disk. No core is booted here — the page is pure TS — so it
 * stays usable on any origin (Run needs a secure origin only because the full
 * emulator boots audio there).
 */
export function mountAssembler(container: HTMLElement): void {
  document.title = '65C816 Assembler — SNES Web';
  container.innerHTML = '';

  const style = document.createElement('style');
  style.textContent = CSS;
  container.appendChild(style);

  // --- DOM ------------------------------------------------------------
  const root = el('div', 'asm-root');
  const head = el('div', 'asm-head');
  const title = el('h1', 'asm-title', '65C816 Assembler');
  head.append(title);
  root.append(head);
  root.append(el('p', 'asm-sub',
    'Write 65C816 on the left; the assembled bytes appear live on the right. ' +
    'Assemble, then ▶ Run in emulator to load the result as a ROM, or ⬇ Download .sfc to save it.'));

  // --- toolbar ----------------------------------------------------------
  const bar = el('div', 'asm-bar');
  const entry = el('span', 'asm-entry',
    `ROM entry $${addrHex(ROM_ENTRY)} · ${ROM_SIZE / 0x1000} KB LoROM · bank $00`);
  const assembleBtn = el('button', 'btn', 'Assemble');
  assembleBtn.type = 'button';
  const runBtn = el('button', 'btn primary', '▶ Run in emulator');
  runBtn.type = 'button';
  runBtn.disabled = true;
  const downloadBtn = el('button', 'btn', '⬇ Download .sfc');
  downloadBtn.type = 'button';
  downloadBtn.disabled = true;
  const clearBtn = el('button', 'btn', 'Clear');
  clearBtn.type = 'button';
  const stat = el('div', 'asm-stat');
  const backBtn = el('button', 'btn back', '← Back to game');
  backBtn.type = 'button';
  bar.append(entry, assembleBtn, runBtn, downloadBtn, clearBtn, stat, backBtn);
  root.append(bar);

  // --- editor + listing -----------------------------------------------
  const main = el('div', 'asm-main');

  const edWrap = el('div', 'asm-edwrap');
  const gutter = el('div', 'asm-gutter');
  const src = document.createElement('textarea');
  src.className = 'asm-src';
  src.spellcheck = false;
  src.wrap = 'off';
  src.value = EXAMPLE;
  edWrap.append(gutter, src);
  main.append(edWrap);

  const listing = el('div', 'asm-listing');
  main.append(listing);
  root.append(main);

  root.append(el('div', 'asm-foot',
    'Runs as a ROM: the code is placed at the entry ($' + addrHex(ROM_ENTRY) +
    ') and the reset vector points there, so the CPU starts in your program on boot. ' +
    'Immediates widen after REP #$1 and narrow after SEP #$1; addresses classify as ' +
    'zero-page ($4C) or absolute ($004C) by the width you write. ' +
    'A cold boot has no return address — end in an idle loop (WAI / BRA), not RTS.'));

  container.appendChild(root);

  // --- state ------------------------------------------------------------
  let last: ReturnType<typeof assemble> | null = null;
  let debounce = 0;

  function setStat(text: string, cls = ''): void {
    stat.className = `asm-stat ${cls}`.trim();
    stat.textContent = text;
  }

  // --- assemble + render ------------------------------------------------
  function doAssemble(): void {
    const r = assemble(src.value, ROM_ENTRY);
    last = r;
    if (!r.ok) {
      runBtn.disabled = true;
      downloadBtn.disabled = true;
      setStat(r.errors.map((e) => `line ${e.line}: ${e.message}`).join('  ·  '), 'err');
      renderErrors(r.errors);
      return;
    }
    runBtn.disabled = false;
    downloadBtn.disabled = false;
    setStat(`${r.bytes.length} byte${r.bytes.length === 1 ? '' : 's'} @ $${addrHex(r.origin)} — ready`);
    renderListing(r);
  }

  // --- Run in emulator: build a ROM, hand it off, navigate to the app ---
  function doRun(): void {
    if (!last || !last.ok) return;
    let rom: Uint8Array;
    try {
      rom = buildRom(last.bytes);
    } catch (err) {
      setStat(`build failed: ${(err as Error).message}`, 'err');
      return;
    }
    try {
      sessionStorage.setItem(ASM_ROM_KEY, bytesToBase64(rom));
    } catch (err) {
      setStat(`handoff failed: ${(err as Error).message}`, 'err');
      return;
    }
    setStat('ROM built — loading it in the emulator…');
    const url = new URL(location.href);
    url.searchParams.delete('asm');
    location.href = url.toString(); // main.ts reads ASM_ROM_KEY and runs it
  }

  // --- Download: same ROM to disk as assembled.sfc -----------------------
  function doDownload(): void {
    if (!last || !last.ok) return;
    let rom: Uint8Array;
    try {
      rom = buildRom(last.bytes);
    } catch (err) {
      setStat(`build failed: ${(err as Error).message}`, 'err');
      return;
    }
    const blob = new Blob([rom.buffer as ArrayBuffer], { type: 'application/octet-stream' });
    const a = document.createElement('a');
    const objectUrl = URL.createObjectURL(blob);
    a.href = objectUrl;
    a.download = 'assembled.sfc';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    setStat(`Saved ${rom.length} bytes as assembled.sfc`);
  }

  // --- listings ---------------------------------------------------------
  function renderListing(r: ReturnType<typeof assemble>): void {
    const rows = r.lines
      .map((l) => {
        const a = (r.origin + l.offset) >>> 0;
        const bytes = l.bytes.map((b) => b.toString(16).padStart(2, '0')).join(' ');
        const text = l.label ? `${l.label}:` : `${l.mnemonic} ${l.operand}`.trim();
        return `<div class="lrow"><span class="la">${addrHex(a)}</span>` +
          `<span class="lb">${bytes || '·'}</span><span class="ls">${esc(text)}</span></div>`;
      })
      .join('');
    listing.innerHTML =
      `<div class="lhead asm-listtitle">assembled · ${r.bytes.length} bytes @ $${addrHex(r.origin)}</div>` +
      `<div class="lrow lh"><span class="la">addr</span><span class="lb">bytes</span><span class="ls">source</span></div>` +
      (rows || '<div class="lrow"><span class="ls">— empty program —</span></div>');
  }

  function renderErrors(errs: { line: number; message: string }[]): void {
    listing.innerHTML =
      '<div class="lhead asm-listtitle err">assembly errors</div>' +
      errs.map((e) => `<div class="lrow errrow"><span class="la">${e.line}</span><span class="ls">${esc(e.message)}</span></div>`).join('');
  }

  // --- editor behaviour -------------------------------------------------
  function refreshGutter(): void {
    const n = src.value.split('\n').length;
    gutter.textContent = Array.from({ length: n }, (_, i) => i + 1).join('\n');
  }
  const syncScroll = (): void => { gutter.scrollTop = src.scrollTop; };
  src.addEventListener('scroll', syncScroll);
  src.addEventListener('input', () => {
    refreshGutter();
    window.clearTimeout(debounce);
    debounce = window.setTimeout(doAssemble, 300); // live assemble as you type
  });
  // Tab inserts 4 spaces instead of moving focus off the editor.
  src.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const s = src.selectionStart, epos = src.selectionEnd;
      src.value = src.value.slice(0, s) + '    ' + src.value.slice(epos);
      src.selectionStart = src.selectionEnd = s + 4;
      refreshGutter();
    }
  });

  // --- buttons ----------------------------------------------------------
  assembleBtn.addEventListener('click', () => { window.clearTimeout(debounce); doAssemble(); });
  runBtn.addEventListener('click', doRun);
  downloadBtn.addEventListener('click', doDownload);
  clearBtn.addEventListener('click', () => {
    src.value = '';
    refreshGutter();
    last = null;
    runBtn.disabled = true;
    downloadBtn.disabled = true;
    setStat('cleared — type 65C816 to begin');
    listing.innerHTML = '<div class="lrow"><span class="ls">— nothing assembled yet —</span></div>';
    src.focus();
  });
  backBtn.addEventListener('click', () => {
    const url = new URL(location.href);
    url.searchParams.delete('asm');
    location.href = url.toString();
  });

  refreshGutter();
  doAssemble(); // render the example's listing up front
  src.focus();
}

// --- helpers -------------------------------------------------------------

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function addrHex(a: number): string {
  return (a >>> 0).toString(16).padStart(6, '0').toUpperCase();
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Prefill: a small, **cold-boot-safe** program. A ROM entry is reached with
 * an empty stack and the I-flag set, so it must not `RTS` (there is no valid
 * return address to pop) — it ends parked in a `WAI` / `BRA loop` idle spin,
 * the way a real 65C816 reset vector does.
 */
const EXAMPLE = [
  '; 65C816 — cold-boot-safe example. On reset the CPU lands here with an',
  '; empty stack, so we must NOT RTS (nothing to return to); we park in WAI.',
  ';',
  '; Count A up to $0A, keep the count in zero page, then idle.',
  '        LDA #$00',
  'again:  INCA',
  '        CMP #$0A',
  '        BNE again',
  '        STA $10              ; final count (=$0A) now sits in zero page $10',
  '',
  '; Idle loop: WAI waits for an interrupt, BRA spins so the PC never falls off.',
  'loop:   WAI',
  '        BRA loop',
].join('\n');

const CSS = `
.asm-root { color-scheme: dark; background: #0d0d10; color: #e8e8ea; min-height: 100vh;
  font: 14px/1.5 ui-sans-serif, system-ui, sans-serif; padding: 20px; max-width: 1280px;
  margin: 0 auto; display: flex; flex-direction: column; gap: 12px; }
.asm-head { display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap; }
.asm-title { font-size: 21px; margin: 0; font-weight: 650; }
.asm-sub { color: #8a8a92; margin: 0; max-width: 900px; }

.asm-bar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
  background: #141418; border: 1px solid #2a2a30; border-radius: 8px; padding: 8px 10px; }
.asm-entry { color: #8a8a92; font: 12px ui-monospace, SFMono-Regular, Menlo, monospace; margin-right: 4px; }
.btn { background: #1c1c22; color: #e8e8ea; border: 1px solid #33333c; border-radius: 6px;
  padding: 5px 12px; cursor: pointer; font: inherit; }
.btn:hover { background: #26262e; }
.btn:disabled { opacity: .4; cursor: default; }
.btn.primary { background: #1d3350; border-color: #2b4a70; }
.btn.primary:hover { background: #244163; }
.btn.back { margin-left: auto; }
.asm-stat { font: 12px ui-monospace, monospace; color: #9fd0ff; }
.asm-stat.err { color: #ff8a8a; }
.asm-stat:empty { flex: 0; }

.asm-main { flex: 1; display: flex; gap: 12px; min-height: 460px; align-items: stretch; }
.asm-edwrap { flex: 1 1 50%; display: flex; min-width: 0; background: #141418;
  border: 1px solid #2a2a30; border-radius: 8px; overflow: hidden; }
.asm-gutter { flex: 0 0 auto; padding: 10px 8px; margin: 0; text-align: right; user-select: none;
  overflow: hidden; color: #5a5a63; background: #101014; border-right: 1px solid #2a2a30;
  font: 12.5px/1.62 ui-monospace, SFMono-Regular, Menlo, monospace; white-space: pre; }
.asm-src { flex: 1 1 auto; min-width: 0; border: none; outline: none; resize: none;
  background: #141418; color: #e8e8ea; padding: 10px 12px;
  font: 12.5px/1.62 ui-monospace, SFMono-Regular, Menlo, monospace; white-space: pre;
  tab-size: 4; overflow: auto; }
.asm-listing { flex: 1 1 50%; min-width: 0; overflow: auto; background: #141418;
  border: 1px solid #2a2a30; border-radius: 8px; padding: 8px 10px; }
.asm-listtitle { color: #8a8a92; font: 11px/1.4 ui-monospace, monospace; text-transform: uppercase;
  letter-spacing: .05em; margin-bottom: 6px; }
.asm-listtitle.err { color: #ff8a8a; }
.lrow { display: grid; grid-template-columns: 74px 210px 1fr; gap: 10px; align-items: baseline;
  font: 12.5px/1.62 ui-monospace, SFMono-Regular, Menlo, monospace; white-space: pre; }
.lrow.lh { color: #6a6a72; border-bottom: 1px solid #2a2a30; }
.lrow .la { color: #7a7a83; }
.lrow .lb { color: #9ad0ff; overflow: hidden; text-overflow: ellipsis; }
.lrow .ls { color: #d8d8dc; }
.lrow.errrow .la { color: #ff8a8a; }
.lrow.errrow .ls { color: #ff9a9a; }
.asm-foot { color: #6a6a72; font: 12px/1.5 ui-monospace, monospace; }
@media (max-width: 820px) {
  .asm-main { flex-direction: column; }
  .asm-edwrap, .asm-listing { flex: 1 1 auto; min-height: 320px; }
}
`;
