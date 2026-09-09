import type { MemoryRegion, SnesCore } from '../core/types';
import { MEMORY_REGIONS } from '../core/types';
import { assemble } from '../asm/assembler';
import { disassembleRange, makeCoreReader } from './disasm';
import { findBytes, parseHexBytes, toHexRows, HEX_COLS } from './memory-view';
import { SaveStateManager, type DebugHandle } from './savestate';

/**
 * The in-app debugger. Fills the `#debug` slot with six panels:
 *   1. Registers   (A X Y S P PC DBR DPR + decoded flags)
 *   2. Disassembly (window around the current PC, 65C816)
 *   3. Memory      (region selector + hex dump + byte search)
 *   4. Assembler   (paste 65C816 source → assemble → write to WRAM/SRAM)
 *   5. Save states (capture, restore, diff)
 *   6. Breakpoints (add / remove)
 *
 * The heavy lifting lives in the pure modules (../asm, ./disasm,
 * ./memory-view, ./savestate); this file is only DOM + wiring, so it returns
 * a small `DebugHandle` the rest of the app can drive (main.ts uses it for
 * the transport buttons and the breakpoint callback).
 */

const DISASM_LINES = 16;
const MEM_PAGE = 0x100;

interface PState {
  region: MemoryRegion;
  offset: number; // byte offset within the region
}

export function mountDebug(container: HTMLElement, core: SnesCore): DebugHandle {
  container.innerHTML = '';
  const s = new SaveStateManager(core);
  const reader = makeCoreReader(core);

  const style = document.createElement('style');
  style.textContent = EXTRA_CSS;
  container.appendChild(style);

  const state: PState = { region: MEMORY_REGIONS[0], offset: 0 };
  let bplist = new Set<string>(); // "bank:addr"
  core.listBreakpoints().forEach((b) => bplist.add(key(b.bank, b.addr)));

  // --- panels -----------------------------------------------------------
  const regPanel = panel('Registers', container);
  const regBody = regPanel('body');

  const disPanel = panel('Disassembly', container);
  const disBody = disPanel('body');

  const memPanel = panel('Memory', container);
  const memToolbar = memPanel('toolbar');
  const memBody = memPanel('body');
  const memSel = buildMemToolbar(memToolbar);

  const asmPanel = panel('Assembler', container);
  const asmToolbar = asmPanel('toolbar');
  const asmBody = asmPanel('body');
  buildAsmPanel(asmToolbar, asmBody, memSel);

  const savePanel = panel('Save states', container);
  const saveToolbar = savePanel('toolbar');
  const saveBody = savePanel('body');
  buildSaveToolbar(saveToolbar);

  const bpPanel = panel('Breakpoints', container);
  const bpToolbar = bpPanel('toolbar');
  const bpBody = bpPanel('body');
  buildBpToolbar(bpToolbar);

  // --- renders ----------------------------------------------------------
  function renderRegisters(): void {
    const r = core.readRegisters();
    const row = (k: string, v: string, cls = ''): string =>
      `<div class="row"><span class="k ${cls}">${k}</span><span class="${cls}">${v}</span></div>`;
    const h2 = (n: number, w: number): string => (n >>> 0).toString(16).padStart(w, '0').toUpperCase();
    regBody.innerHTML =
      row('A', `$${h2(r.a, 2)}`) +
      row('X', `$${h2(r.x, 2)}`) +
      row('Y', `$${h2(r.y, 2)}`) +
      row('S', `$${h2(r.s, 2)}`) +
      row('P', `$${h2(r.p, 2)} (${flagsText(r.p)})`) +
      row('PC', `$${h2(r.pc, 6)}`, 'pc') +
      row('DBR', `$${h2(r.dbr, 2)}`) +
      row('DPR', `$${h2(r.dpr, 4)}`);
  }

  function renderDisasm(): void {
    const r = core.readRegisters();
    const pc = r.pc & 0xffffff;
    const ins = disassembleRange(pc, reader, DISASM_LINES);
    const bytes = core.readMem(pc >>> 16, pc & 0xffff, Math.max(1, ins.reduce((a, i) => a + i.size, 0)));
    const rows = ins
      .map((i, n) => {
        const off = ins.slice(0, n).reduce((a, x) => a + x.size, 0);
        const hex = Array.from(bytes.slice(off, off + i.size))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join(' ');
        const cls = n === 0 ? 'row cur' : 'row';
        return `<div class="${cls}"><span class="a">${i.addr.toString(16).padStart(6, '0').toUpperCase()}</span><span class="b">${hex}</span><span class="m ${i.illegal ? 'il' : ''}">${i.mnemonic}</span><span class="o">${i.operand}</span></div>`;
      })
      .join('');
    disBody.innerHTML = `<div class="dh"><span class="a">addr</span><span class="b">bytes</span><span class="m">mn</span><span class="o">operand</span></div>` + rows;
  }

  function renderMem(): void {
    const { region, offset } = state;
    const size = Math.min(region.size, MEM_PAGE);
    const bytes = core.readMem(region.bank, region.base + offset, size);
    const rows = toHexRows(bytes, region.base + offset);
    memBody.innerHTML =
      `<div class="mhead">${region.name} · $${region.bank.toString(16).padStart(2, '0').toUpperCase()}:${(region.base + offset).toString(16).padStart(4, '0').toUpperCase()} · ${rows.length * HEX_COLS}B</div>` +
      rows
        .map(
          (r) =>
            `<div class="mrow"><span class="a">${r.addr.toString(16).padStart(6, '0').toUpperCase()}</span><span class="b">${r.hex.join(' ')}</span><span class="o">${escapeHtml(r.ascii)}</span></div>`,
        )
        .join('');
  }

  function renderSaves(): void {
    const slots = s.summaries();
    if (slots.length === 0) {
      saveBody.innerHTML = '<div class="dim">no save states yet — press “Capture”</div>';
      return;
    }
    const list = slots
      .map((x) => {
        const pc = x.pc.toString(16).padStart(6, '0').toUpperCase();
        const d = s.diff(x.index - 1, x.index);
        const delta =
          d && x.index > 0
            ? `Δpc ${d.pcDelta >= 0 ? '+' : ''}${d.pcDelta} · sram ${d.sramChanged}B · wram ${d.wramChanged}B`
            : '—';
        return `<div class="slot"><span class="k">#${x.index}  PC $${pc}  <span class="dim">${delta}</span></span><button data-slot="${x.index}" class="restore">restore</button></div>`;
      })
      .join('');
    saveBody.innerHTML = list;
    saveBody.querySelectorAll<HTMLButtonElement>('button.restore').forEach((b) => {
      b.addEventListener('click', () => {
        const idx = Number(b.dataset.slot);
        if (s.restore(idx)) {
          core.step(); // force a frame so video/audio settle
          refresh();
        }
      });
    });
  }

  function renderBreakpoints(): void {
    bpBody.innerHTML =
      bplist.size === 0
        ? '<div class="dim">none — add one below (e.g. <code>F0:0200</code> or <code>0200</code>)</div>'
        : `<ul class="bplist">${[...bplist].sort().map((k) => {
            const [bank, addr] = k.split(':');
            return `<li><span class="k">$${bank}:${addr}</span><button data-k="${k}" class="del">×</button></li>`;
          }).join('')}</ul>`;
    bpBody.querySelectorAll<HTMLButtonElement>('button.del').forEach((b) => {
      b.addEventListener('click', () => {
        const k = b.dataset.k!;
        const [bank, addr] = k.split(':').map(Number);
        core.clearBreakpoint(bank, addr);
        bplist.delete(k);
        renderBreakpoints();
      });
    });
  }

  function refresh(): void {
    renderRegisters();
    renderDisasm();
    renderMem();
    renderSaves();
    renderBreakpoints();
  }

  // --- toolbar wiring ---------------------------------------------------
  function parseBp(input: string): { bank: number; addr: number } | null {
    const t = input.trim().toLowerCase();
    const m = /^([0-9a-f]{2}):([0-9a-f]{4})$/.exec(t) ?? /^([0-9a-f]{4})$/.exec(t);
    if (!m) return null;
    const bank = m[1] !== undefined ? parseInt(m[1], 16) : 0;
    const addr = parseInt(m[m[1] !== undefined ? 2 : 1], 16);
    return { bank, addr };
  }

  function setBreakpoint(bank: number, addr: number): void {
    core.setBreakpoint(bank, addr);
    bplist.add(key(bank, addr));
    renderBreakpoints();
  }

  function clearBreakpoint(bank: number, addr: number): void {
    core.clearBreakpoint(bank, addr);
    bplist.delete(key(bank, addr));
    renderBreakpoints();
  }

  // --- build toolbars ---------------------------------------------------
  function buildMemToolbar(bar: HTMLElement): { sel: HTMLSelectElement; off: HTMLInputElement } {
    const sel = document.createElement('select');
    sel.className = 'memsel';
    MEMORY_REGIONS.forEach((r) => {
      const o = document.createElement('option');
      o.value = r.name;
      o.textContent = `${r.name}  ($${r.bank.toString(16)}:${r.base.toString(16).padStart(4, '0')})`;
      sel.appendChild(o);
    });
    sel.value = state.region.name;
    sel.addEventListener('change', () => {
      state.region = MEMORY_REGIONS.find((r) => r.name === sel.value) ?? state.region;
      state.offset = 0;
      off.value = '0';
      renderMem();
    });
    bar.appendChild(sel);

    const off = document.createElement('input');
    off.className = 'memoff';
    off.placeholder = 'offset (hex)';
    off.value = '0';
    bar.appendChild(off);

    const stepFwd = btn('»', () => {
      state.offset = Math.min(state.region.size - MEM_PAGE, state.offset + MEM_PAGE);
      off.value = state.offset.toString(16);
      renderMem();
    });
    const stepBack = btn('«', () => {
      state.offset = Math.max(0, state.offset - MEM_PAGE);
      off.value = state.offset.toString(16);
      renderMem();
    });
    bar.appendChild(stepBack);
    bar.appendChild(stepFwd);

    const go = btn('Go', () => {
      const v = parseInt(off.value || '0', 16);
      state.offset = Number.isFinite(v) ? v : 0;
      renderMem();
    });
    bar.appendChild(go);

    const search = document.createElement('input');
    search.className = 'memfind';
    search.placeholder = 'find bytes e.g. ff ff 00';
    bar.appendChild(search);
    const find = btn('Find', () => {
      let needle: number[];
      try {
        needle = parseHexBytes(search.value);
      } catch (e) {
        memBody.innerHTML = `<div class="err">${escapeHtml((e as Error).message)}</div>`;
        return;
      }
      if (needle.length === 0) return;
      const bytes = core.readMem(state.region.bank, state.region.base, state.region.size);
      const at = findBytes(bytes, needle);
      if (at < 0) {
        memBody.innerHTML = '<div class="err">not found in region</div>';
        return;
      }
      state.offset = at;
      off.value = at.toString(16);
      renderMem();
    });
    bar.appendChild(find);

    // The Assembler panel needs these to jump the view to a written block.
    return { sel, off };
  }

  function buildAsmPanel(
    bar: HTMLElement,
    body: HTMLElement,
    memSel: { sel: HTMLSelectElement; off: HTMLInputElement },
  ): void {
    body.style.maxHeight = '380px';

    const bankIn = document.createElement('input');
    bankIn.className = 'asmbank';
    bankIn.placeholder = 'bank (hex)';
    bankIn.value = '7e'; // WRAM — bank $00 is ROM and unwritable on hardware
    bar.appendChild(bankIn);

    const addrIn = document.createElement('input');
    addrIn.className = 'asmaddr';
    addrIn.placeholder = 'addr (hex)';
    addrIn.value = '8000';
    bar.appendChild(addrIn);

    const asmBtn = btn('Assemble', doAssemble);
    bar.appendChild(asmBtn);
    const write = btn('Write', doWrite);
    write.disabled = true;
    bar.appendChild(write);

    const stat = document.createElement('div');
    stat.className = 'asmstat dim';
    stat.textContent = 'Assemble, then Write copies the bytes into the live core.';
    body.appendChild(stat);

    const ta = document.createElement('textarea');
    ta.className = 'asmsrc';
    ta.rows = 8;
    ta.spellcheck = false;
    ta.value = ASM_EXAMPLE;
    body.appendChild(ta);

    const out = document.createElement('div');
    out.className = 'asmout';
    body.appendChild(out);

    let last: { bytes: Uint8Array; bank: number; addr: number } | null = null;

    function target(): { bank: number; addr: number } | string {
      const bank = parseInt(bankIn.value || '0', 16);
      const addr = parseInt(addrIn.value || '0', 16);
      if (!Number.isFinite(bank) || bank < 0 || bank > 0xff) return 'bank must be hex $00–$FF (e.g. 7e)';
      if (!Number.isFinite(addr) || addr < 0 || addr > 0xffff) return 'addr must be hex $0000–$FFFF (e.g. 8000)';
      return { bank, addr };
    }

    const fmtTarget = (bank: number, addr: number): string =>
      `$${bank.toString(16).padStart(2, '0').toUpperCase()}:${addr.toString(16).padStart(4, '0').toUpperCase()}`;

    function doAssemble(): void {
      const t = target();
      if (typeof t === 'string') {
        stat.className = 'asmstat err';
        stat.textContent = t;
        write.disabled = true;
        return;
      }
      const r = assemble(ta.value, (t.bank << 16) | t.addr);
      if (!r.ok) {
        last = null;
        write.disabled = true;
        stat.className = 'asmstat err';
        stat.textContent = r.errors.map((e) => `line ${e.line}: ${e.message}`).join(' · ');
        out.innerHTML = '';
        return;
      }
      last = { bytes: r.bytes, bank: t.bank, addr: t.addr };
      write.disabled = false;
      stat.className = 'asmstat';
      stat.textContent = `${r.bytes.length} bytes at ${fmtTarget(t.bank, t.addr)} — press “Write” to copy them into live memory.`;
      const rows = r.lines
        .map((l) => {
          const addr = (r.origin + l.offset) >>> 0;
          const hex = l.bytes.map((b) => b.toString(16).padStart(2, '0')).join(' ');
          const text = l.label ? `${l.label}:` : `${l.mnemonic} ${l.operand}`.trim();
          return `<div class="arow"><span class="a">${addr.toString(16).padStart(6, '0').toUpperCase()}</span><span class="b">${hex}</span><span class="m">${escapeHtml(text)}</span></div>`;
        })
        .join('');
      out.innerHTML =
        '<div class="arow dh"><span class="a">addr</span><span class="b">bytes</span><span class="m">source</span></div>' + rows;
    }

    function doWrite(): void {
      if (!last) return;
      const { bytes, bank, addr } = last;
      core.writeMem(bank, addr, bytes);
      // Jump the Memory panel to the block we just wrote, if it is one of
      // the browsable regions.
      const region = MEMORY_REGIONS.find(
        (rg) => rg.bank === bank && addr >= rg.base && addr + bytes.length <= rg.base + rg.size,
      );
      if (region) {
        state.region = region;
        state.offset = Math.max(0, addr - region.base);
        memSel.sel.value = region.name;
        memSel.off.value = state.offset.toString(16);
        renderMem();
      }
      stat.className = 'asmstat';
      stat.textContent = `Wrote ${bytes.length} bytes to ${fmtTarget(bank, addr)} — the Memory panel is pointing at it.`;
    }
  }

  function buildSaveToolbar(bar: HTMLElement): void {
    const cap = btn('💾 Capture', () => {
      s.capture();
      renderSaves();
    });
    bar.appendChild(cap);
    const clear = btn('clear all', () => {
      s.clear();
      renderSaves();
    });
    bar.appendChild(clear);
  }

  function buildBpToolbar(bar: HTMLElement): void {
    const input = document.createElement('input');
    input.className = 'bpin';
    input.placeholder = 'bank:addr';
    bar.appendChild(input);
    const add = btn('set', () => {
      const bp = parseBp(input.value);
      if (bp) {
        setBreakpoint(bp.bank, bp.addr);
        input.value = '';
        input.focus();
      }
    });
    bar.appendChild(add);
  }

  // --- helpers ----------------------------------------------------------
  refresh();
  return {
    refresh,
    step: () => core.step(),
    setBreakpoint,
    clearBreakpoint,
    captureSlot: () => {
      s.capture();
      renderSaves();
      return s.count;
    },
    slots: () => s.summaries(),
    restoreSlot: (i: number) => {
      const ok = s.restore(i);
      if (ok) refresh();
      return ok;
    },
    diff: (from, to) => s.diff(from, to),
  };
}

function key(bank: number, addr: number): string {
  return `${bank.toString(16).padStart(2, '0')}:${addr.toString(16).padStart(4, '0')}`;
}

function flagsText(p: number): string {
  const names: [number, string][] = [
    [7, 'N'],
    [6, 'H'],
    [5, 'V'],
    [4, 'B'],
    [3, 'D'],
    [2, 'I'],
    [1, 'Z'],
    [0, 'C'],
  ];
  const set = names.filter(([b]) => p & (1 << b)).map(([, n]) => n);
  return set.length ? set.join(' ') : '(none)';
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

type Panel = (sel: 'body' | 'toolbar') => HTMLElement;

function panel(title: string, container: HTMLElement): Panel {
  const p = document.createElement('div');
  p.className = 'panel';
  const h = document.createElement('h2');
  h.textContent = title;
  p.appendChild(h);
  const toolbar = document.createElement('div');
  toolbar.className = 'toolbar';
  p.appendChild(toolbar);
  const body = document.createElement('div');
  body.className = 'body';
  p.appendChild(body);
  container.appendChild(p);
  return (sel) => (sel === 'toolbar' ? toolbar : body);
}

function btn(label: string, fn: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = 'btn mini';
  b.textContent = label;
  b.addEventListener('click', fn);
  return b;
}

const EXTRA_CSS = `
.debug .body { max-height: 240px; overflow: auto; }
.debug .asmsrc { width: 100%; min-height: 120px; resize: vertical; background: #141418; color: #e8e8ea;
  border: 1px solid #33333c; border-radius: 4px; padding: 6px 8px;
  font: 12px/1.6 ui-monospace, SFMono-Regular, Menlo, monospace; }
.debug .asmstat { font: 12px ui-monospace, monospace; color: #e8e8ea; }
.debug .asmstat.dim { color: #8a8a92; }
.debug .asmstat.err { color: #ff8a8a; }
.debug .arow {
  display: grid; grid-template-columns: 70px 130px 1fr; gap: 8px;
  align-items: baseline; font: 12px/1.6 ui-monospace, SFMono-Regular, Menlo, monospace;
}
.debug .arow.dh { color: #8a8a92; border-bottom: 1px solid #2a2a30; }
.debug .arow .a { color: #8a8a92; }
.debug .arow .b { color: #9ad0ff; }
.debug .arow .m { color: #d8d8dc; white-space: pre-wrap; }
.debug .panel { display: flex; flex-direction: column; gap: 6px; }
.debug .toolbar { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.debug .toolbar select, .debug .toolbar input { max-width: 160px; }
.debug .btn.mini { padding: 3px 8px; font-size: 12px; }
.debug .dh, .debug .row, .debug .mrow, .debug .slot {
  display: grid; grid-template-columns: 70px 90px 56px 1fr; gap: 8px;
  align-items: baseline; font: 12px/1.6 ui-monospace, SFMono-Regular, Menlo, monospace;
}
.debug .dh { color: #8a8a92; border-bottom: 1px solid #2a2a30; }
.debug .row.cur { color: #ffe08a; background: rgba(255,224,138,.08); }
.debug .m { color: #9ad0ff; }
.debug .m.il { color: #ff8a8a; font-style: italic; }
.debug .a { color: #8a8a92; }
.debug .mhead, .debug .dim { color: #8a8a92; font: 12px ui-monospace, monospace; }
.debug .err { color: #ff8a8a; font: 12px ui-monospace, monospace; }
.debug .slot { grid-template-columns: 1fr auto; margin-bottom: 2px; }
.debug .slot .restore { background: #1c1c22; color: #e8e8ea; border: 1px solid #33333c;
  border-radius: 4px; padding: 2px 8px; cursor: pointer; font-size: 12px; }
`;

/** Pre-fill for the Assembler panel — a small, self-contained loop. */
const ASM_EXAMPLE = [
  '; Count A up to $10, then store it in WRAM $10.',
  '; Targets WRAM $7E:8000 by default — Assemble, then Write.',
  'LDA #$00',
  'again: INCA',
  'CMP #$10',
  'BNE again',
  'STA $10',
  'RTS',
].join('\n');
