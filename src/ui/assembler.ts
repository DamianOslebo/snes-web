import type { SnesCore } from '../core/types';
import { assemble } from '../asm/assembler';
import { DEFAULT_ROM } from '../config';

/**
 * The 65C816 assembler as its own page (opened via `?asm=1`, reached from the
 * "Assembler" transport button). A full-width editor on the left, a live
 * listing of the assembled machine code on the right — enough room to actually
 * write and review code, which the old cramped debugger panel was not.
 *
 * Like the bindings page it is a standalone view, but it DOES boot a core
 * (no audio, no renderer): Write and Read-back need `core.writeMem`/`readMem`.
 * The default ROM is loaded best-effort so the real core is in a ready state
 * and WRAM is usable; on the mock the writes always land in its banked RAM.
 *
 * Execution is intentionally NOT wired: the core ABI exposes the PC read-only,
 * so the page can place and inspect code in RAM but cannot make the CPU start
 * there. That is a documented open item (a PC-setter ABI addition), not a gap
 * hidden behind a button that does nothing.
 */
export async function mountAssembler(container: HTMLElement, core: SnesCore): Promise<void> {
  document.title = '65C816 Assembler — SNES Web';
  container.innerHTML = '';

  const style = document.createElement('style');
  style.textContent = CSS;
  container.appendChild(style);

  // --- core status: boot a ready core best-effort -----------------------
  const status = el('div', 'asm-core');
  status.textContent = `booting ${core.id}${core.isMock ? ' (mock)' : ''}…`;

  try {
    if (DEFAULT_ROM) {
      const res = await fetch(DEFAULT_ROM.url);
      if (res.ok && !/text\/html/i.test(res.headers.get('content-type') ?? '')) {
        await core.loadRom(new Uint8Array(await res.arrayBuffer()));
      }
    } else if (core.isMock) {
      await core.loadRom(new Uint8Array(0x10000)); // make the mock ready
    }
  } catch {
    // Non-fatal: assembling is pure TS and the mock still accepts writes.
  }
  status.textContent = `${core.id}${core.isMock ? ' (mock)' : ''} · ${
    core.ready ? 'ready' : 'no ROM — Write may not stick on the real core'
  }`;

  // --- DOM ------------------------------------------------------------
  const root = el('div', 'asm-root');
  const head = el('div', 'asm-head');
  const title = el('h1', 'asm-title', '65C816 Assembler');
  head.append(title, status);
  root.append(head);
  root.append(el('p', 'asm-sub',
    'Write 65C816 on the left; the assembled bytes appear live on the right. ' +
    'Assemble, then Write copies them into the core’s memory and Read-back confirms they landed.'));

  // --- toolbar ----------------------------------------------------------
  const bar = el('div', 'asm-bar');
  const bankIn = num('bank', '7e', 'bank (hex)');
  const addrIn = num('addr', '8000', 'addr (hex)');
  const stat = el('div', 'asm-stat');
  const assembleBtn = el('button', 'btn', 'Assemble');
  assembleBtn.type = 'button';
  const writeBtn = el('button', 'btn primary', 'Write');
  writeBtn.type = 'button';
  writeBtn.disabled = true;
  const readBtn = el('button', 'btn', 'Read back');
  readBtn.type = 'button';
  const clearBtn = el('button', 'btn', 'Clear');
  clearBtn.type = 'button';
  const backBtn = el('button', 'btn back', '← Back to game');
  backBtn.type = 'button';
  bar.append(bankIn, addrIn, assembleBtn, writeBtn, readBtn, clearBtn, stat, backBtn);
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
    'Execution is not wired: the core’s PC is read-only, so code can be written and inspected in RAM ' +
    'but not started. Immediates widen after REP #$1 and narrow after SEP #$1; addresses classify as ' +
    'zero-page ($4C) or absolute ($004C) by the width you write.'));

  container.appendChild(root);

  // --- state ------------------------------------------------------------
  let last: ReturnType<typeof assemble> | null = null;
  let debounce = 0;

  function target(): { bank: number; addr: number } | string {
    const bank = parseInt(bankIn.value || '0', 16);
    const addr = parseInt(addrIn.value || '0', 16);
    if (!Number.isFinite(bank) || bank < 0 || bank > 0xff) return 'bank must be hex $00–$FF (e.g. 7e)';
    if (!Number.isFinite(addr) || addr < 0 || addr > 0xffff) return 'addr must be hex $0000–$FFFF (e.g. 8000)';
    return { bank, addr };
  }
  const fmt = (bank: number, addr: number): string =>
    `$${bank.toString(16).padStart(2, '0').toUpperCase()}:${addr.toString(16).padStart(4, '0').toUpperCase()}`;

  function setStat(text: string, cls = ''): void {
    stat.className = `asm-stat ${cls}`.trim();
    stat.textContent = text;
  }

  // --- assemble + render ------------------------------------------------
  function doAssemble(): void {
    const t = target();
    if (typeof t === 'string') {
      setStat(t, 'err');
      writeBtn.disabled = true;
      return;
    }
    const r = assemble(src.value, (t.bank << 16) | t.addr);
    last = r;
    if (!r.ok) {
      writeBtn.disabled = true;
      setStat(r.errors.map((e) => `line ${e.line}: ${e.message}`).join('  ·  '), 'err');
      renderErrors(r.errors);
      return;
    }
    writeBtn.disabled = false;
    setStat(`${r.bytes.length} byte${r.bytes.length === 1 ? '' : 's'} @ ${fmt(t.bank, t.addr)} — ready to Write`);
    renderListing(r, t.bank, t.addr);
  }

  function doWrite(): void {
    if (!last || !last.ok) return;
    const t = target();
    if (typeof t === 'string') { setStat(t, 'err'); return; }
    try {
      core.writeMem(t.bank, t.addr, last.bytes);
    } catch (err) {
      setStat(`write failed: ${(err as Error).message}`, 'err');
      return;
    }
    // Confirm the bytes actually landed in the core (mock: RAM; wasm: S9xSetByte).
    const back = core.readMem(t.bank, t.addr, last.bytes.length);
    const ok = back.length === last.bytes.length &&
      Array.from(last.bytes).every((b, i) => back[i] === b);
    setStat(
      ok
        ? `Wrote ${last.bytes.length} bytes to ${fmt(t.bank, t.addr)} — read-back ✓`
        : `Wrote ${last.bytes.length} bytes to ${fmt(t.bank, t.addr)} — read-back MISMATCH`,
      ok ? '' : 'err',
    );
    renderMem(t.bank, t.addr, back);
  }

  function doRead(): void {
    const t = target();
    if (typeof t === 'string') { setStat(t, 'err'); return; }
    const n = last && last.ok ? Math.max(last.bytes.length, 1) : 0x40;
    const bytes = core.readMem(t.bank, t.addr, n);
    setStat(`Read ${bytes.length} bytes @ ${fmt(t.bank, t.addr)}`);
    renderMem(t.bank, t.addr, bytes);
  }

  // --- listings ---------------------------------------------------------
  function renderListing(r: ReturnType<typeof assemble>, bank: number, addr: number): void {
    const rows = r.lines
      .map((l) => {
        const a = (r.origin + l.offset) >>> 0;
        const bytes = l.bytes.map((b) => b.toString(16).padStart(2, '0')).join(' ');
        const text = l.label ? `${l.label}:` : `${l.mnemonic} ${l.operand}`.trim();
        return `<div class="lrow"><span class="la">${a.toString(16).padStart(6, '0').toUpperCase()}</span>` +
          `<span class="lb">${bytes || '·'}</span><span class="ls">${esc(text)}</span></div>`;
      })
      .join('');
    listing.innerHTML =
      `<div class="lhead asm-listtitle">assembled · ${r.bytes.length} bytes @ ${fmt(bank, addr)}</div>` +
      `<div class="lrow lh"><span class="la">addr</span><span class="lb">bytes</span><span class="ls">source</span></div>` +
      (rows || '<div class="lrow"><span class="ls">— empty program —</span></div>');
  }

  function renderErrors(errs: { line: number; message: string }[]): void {
    listing.innerHTML =
      '<div class="lhead asm-listtitle err">assembly errors</div>' +
      errs.map((e) => `<div class="lrow errrow"><span class="la">${e.line}</span><span class="ls">${esc(e.message)}</span></div>`).join('');
  }

  function renderMem(bank: number, addr: number, bytes: Uint8Array): void {
    // Grouped hex dump: 8 bytes per row, offset + hex + ascii — the memory view.
    const rows: string[] = [];
    for (let i = 0; i < bytes.length; i += 8) {
      const chunk = bytes.slice(i, i + 8);
      const hex = Array.from(chunk).map((b) => b.toString(16).padStart(2, '0')).join(' ');
      const asc = Array.from(chunk).map((b) => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : '·')).join('');
      const a = (addr + i) >>> 0;
      rows.push(`<div class="lrow"><span class="la">${a.toString(16).padStart(6, '0').toUpperCase()}</span>` +
        `<span class="lb">${hex.padEnd(23)}</span><span class="ls">${esc(asc)}</span></div>`);
    }
    listing.innerHTML =
      `<div class="lhead asm-listtitle">memory @ ${fmt(bank, addr)} · ${bytes.length} bytes</div>` + rows.join('');
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
  writeBtn.addEventListener('click', doWrite);
  readBtn.addEventListener('click', doRead);
  clearBtn.addEventListener('click', () => {
    src.value = '';
    refreshGutter();
    last = null;
    writeBtn.disabled = true;
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

function num(cls: string, value: string, placeholder: string): HTMLInputElement {
  const i = document.createElement('input');
  i.className = cls;
  i.value = value;
  i.placeholder = placeholder;
  return i;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Prefill: a small, self-contained program that shows the main constructs. */
const EXAMPLE = [
  '; 65C816 — count A up to $0A, store it in WRAM, then a 16-bit demo.',
  '; Targets WRAM $7E:8000 by default. Assemble, then Write.',
  '',
  '        LDA #$00',
  'again:  INCA',
  '        CMP #$0A',
  '        BNE again',
  '        STA $10              ; count now sits in WRAM $10',
  '',
  '        ; 16-bit immediate after REP #$1 (A width bit), 8-bit after SEP',
  '        REP #$1',
  '        LDA #$0100',
  '        SEP #$1',
  '        RTS',
].join('\n');

const CSS = `
.asm-root { color-scheme: dark; background: #0d0d10; color: #e8e8ea; min-height: 100vh;
  font: 14px/1.5 ui-sans-serif, system-ui, sans-serif; padding: 20px; max-width: 1280px;
  margin: 0 auto; display: flex; flex-direction: column; gap: 12px; }
.asm-head { display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap; }
.asm-title { font-size: 21px; margin: 0; font-weight: 650; }
.asm-core { color: #8a8a92; font: 12px ui-monospace, SFMono-Regular, Menlo, monospace; }
.asm-sub { color: #8a8a92; margin: 0; max-width: 900px; }

.asm-bar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
  background: #141418; border: 1px solid #2a2a30; border-radius: 8px; padding: 8px 10px; }
.asm-bar input { background: #0d0d10; border: 1px solid #33333c; color: #e8e8ea;
  border-radius: 5px; padding: 4px 8px; font: 12px ui-monospace, monospace; width: 78px; }
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
