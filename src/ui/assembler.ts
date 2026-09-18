import { assemble } from '../asm/assembler';
import { buildRom, bytesToBase64, base64ToBytes, ASM_ROM_KEY, ROM_ENTRY, ROM_SIZE } from '../asm/rom';
import type { AsmController } from '../agent/types';
import { loadState, saveState } from '../agent/state-store';

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

// --- module-scope state (shared by the page and the agent's `asm_*` tools) ---
//
// Navigation is a full page reload, so the mounted page's closure is
// ephemeral: the canonical state (source + `.incbin` data files) lives in
// localStorage under ASM_STORE_KEY, and the page is just a live view over it.
// The agent's controller (`makeAsmController`) reads/writes the same state and
// re-renders through `asmRefresh` when the page happens to be on screen.

const ASM_STORE_KEY = 'snes-web:asm:v1';

/** The shape persisted under ASM_STORE_KEY (data files: name → base64). */
interface AsmStore {
  v: 1;
  source: string;
  files: Record<string, string>;
}

const isAsmStore = (v: unknown): v is AsmStore => {
  const p = v as Record<string, unknown>;
  return (
    !!p &&
    p.v === 1 &&
    typeof p.source === 'string' &&
    !!p.files &&
    typeof p.files === 'object' &&
    Object.values(p.files as Record<string, unknown>).every((f) => typeof f === 'string')
  );
};

let asmLoaded = false;
let asmSource = '';
let asmIncludes: Record<string, Uint8Array> = {};
let asmMounted = false;
let asmRefresh: (() => void) | null = null;
let asmSaveTimer = 0;

/** Load the persisted state once per page load (idempotent). */
function initAsmState(): void {
  if (asmLoaded) return;
  asmLoaded = true;
  const stored = loadState(
    localStorage,
    ASM_STORE_KEY,
    isAsmStore,
    { v: 1, source: EXAMPLE, files: {} },
  ).value;
  asmSource = stored.source;
  asmIncludes = {};
  for (const [name, b64] of Object.entries(stored.files)) {
    try {
      asmIncludes[name] = base64ToBytes(b64);
    } catch {
      // Skip a corrupt entry — the assembler reports the missing `.incbin`.
    }
  }
}

/** Write the current state back to the store (never throws). */
function asmPersist(): void {
  const files: Record<string, string> = {};
  for (const [name, bytes] of Object.entries(asmIncludes)) files[name] = bytesToBase64(bytes);
  saveState(localStorage, ASM_STORE_KEY, { v: 1, source: asmSource, files });
}

/** Debounced save for high-frequency edits (typing in the editor). */
function scheduleAsmPersist(): void {
  window.clearTimeout(asmSaveTimer);
  asmSaveTimer = window.setTimeout(asmPersist, 300);
}

export function mountAssembler(container: HTMLElement): void {
  document.title = '65C816 Assembler — SNES Web';
  container.innerHTML = '';
  initAsmState(); // load the persisted source + data files (the page is a view)

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
  // 📦 Data files: .bin files the user can embed with `.incbin "name"` (e.g.
  // the graphics editor's VRAM dump). Kept in page state, not persisted.
  const filesBtn = el('button', 'btn', '📦 Data files…');
  filesBtn.type = 'button';
  filesBtn.title = 'Load .bin files to embed with .incbin (e.g. the graphics editor\'s VRAM dump)';
  const binInput = document.createElement('input');
  binInput.type = 'file';
  binInput.accept = '.bin,.dat,.img,.rom';
  binInput.multiple = true;
  binInput.className = 'bin-input';
  const stat = el('div', 'asm-stat');
  const backBtn = el('button', 'btn back', '← Back to game');
  backBtn.type = 'button';
  bar.append(entry, assembleBtn, runBtn, downloadBtn, clearBtn, filesBtn, binInput, stat, backBtn);
  root.append(bar);

  // Loaded data files, one chip each (name + size + remove). Hidden when empty.
  const incs = el('div', 'asm-incs');
  root.append(incs);

  // --- editor + listing -----------------------------------------------
  const main = el('div', 'asm-main');

  const edWrap = el('div', 'asm-edwrap');
  const gutter = el('div', 'asm-gutter');
  const src = document.createElement('textarea');
  src.className = 'asm-src';
  src.spellcheck = false;
  src.wrap = 'off';
  src.value = asmSource; // module-scope store (agent + page share it; see makeAsmController)
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
    'Load .bin files with 📦 Data files and embed them with .incbin "name" — ' +
    'a label on the line is the data\'s CPU address, and labels after it point just past it. ' +
    'Code + data must fit the 32 KB entry region (file $0000–$7FAF). ' +
    'A cold boot has no return address — end in an idle loop (WAI / BRA), not RTS.'));

  container.appendChild(root);

  // Agent refresh seam: the controller re-renders through this when the page
  // is on screen (a no-op otherwise — see makeAsmController).
  asmMounted = true;
  asmRefresh = () => {
    src.value = asmSource;
    refreshGutter();
    renderIncludes();
    doAssemble();
  };

  // --- state ------------------------------------------------------------
  let last: ReturnType<typeof assemble> | null = null;
  let debounce = 0;
  // The `.incbin` data files live in module scope (`asmIncludes`) so the
  // agent's controller and the page always see the same set.

  function setStat(text: string, cls = ''): void {
    stat.className = `asm-stat ${cls}`.trim();
    stat.textContent = text;
  }

  // --- data files (.incbin) ----------------------------------------------
  function renderIncludes(): void {
    const names = Object.keys(asmIncludes);
    incs.innerHTML = names.map((n) => {
      const sz = asmIncludes[n].length;
      const kb = sz >= 1024 ? `${(sz / 1024).toFixed(1)} KB` : `${sz} B`;
      return `<span class="inc-chip">${esc(n)} · ${kb}` +
        `<button type="button" class="inc-x" data-inc="${esc(n)}" title="Remove ${esc(n)}">✕</button></span>`;
    }).join('');
  }

  binInput.addEventListener('change', async () => {
    const files = Array.from(binInput.files ?? []);
    for (const f of files) {
      asmIncludes[f.name] = new Uint8Array(await f.arrayBuffer());
    }
    // Reset so re-picking the same file re-fires `change`.
    binInput.value = '';
    scheduleAsmPersist();
    renderIncludes();
    doAssemble(); // any pending `.incbin "name"` now resolves
  });

  incs.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest('.inc-x');
    if (!t) return;
    const name = t.getAttribute('data-inc');
    if (name && name in asmIncludes) {
      delete asmIncludes[name];
      scheduleAsmPersist();
      renderIncludes();
      doAssemble(); // re-assemble: `.incbin "name"` will now fail loudly
    }
  });

  // --- assemble + render ------------------------------------------------
  function doAssemble(): void {
    const r = assemble(src.value, ROM_ENTRY, asmIncludes);
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
    // Copy into a fresh, exactly-sized view so the Blob is always `ROM_SIZE`
    // bytes even if buildRom ever returned a subarray over a larger buffer.
    const blob = new Blob([new Uint8Array(rom)], { type: 'application/octet-stream' });
    if (blob.size !== ROM_SIZE) {
      setStat(`download aborted: built ${blob.size} bytes, expected ${ROM_SIZE}`, 'err');
      return;
    }
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = 'assembled.sfc';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    // Hold the anchor + blob until the download has actually read them.
    // Revoking the object URL (or removing the anchor) too early is a common
    // cause of a 0-byte / truncated file on mobile — give it a real window.
    window.setTimeout(() => {
      a.remove();
      URL.revokeObjectURL(objectUrl);
    }, 5000);
    setStat(`Saved ${blob.size} bytes as assembled.sfc`);
  }

  // --- listings ---------------------------------------------------------
  function renderListing(r: ReturnType<typeof assemble>): void {
    const rows = r.lines
      .map((l) => {
        const a = (r.origin + l.offset) >>> 0;
        // A `.incbin` line can carry tens of KB — show a head of the bytes
        // plus the total, never the full dump (it would wreck the DOM).
        const isInc = l.mnemonic === '.incbin' || l.mnemonic === '.bin';
        const shown = isInc && l.bytes.length > 16 ? l.bytes.slice(0, 16) : l.bytes;
        const bytes =
          shown.map((b) => b.toString(16).padStart(2, '0')).join(' ') +
          (isInc && l.bytes.length > 16 ? ` … +${l.bytes.length - 16} more` : '');
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
    asmSource = src.value; // the module-scope store is canonical
    refreshGutter();
    window.clearTimeout(debounce);
    debounce = window.setTimeout(doAssemble, 300); // live assemble as you type
    scheduleAsmPersist();
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
    asmSource = '';
    scheduleAsmPersist();
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

/**
 * The agent-facing controller for this page (the `asm_*` tools in
 * `src/agent/tools.ts`). It works whether or not the page is mounted — it
 * reads/writes the module-scope state (persisted to localStorage on every
 * change) and re-renders through `asmRefresh` only while the page is on
 * screen. `run()` is the workflow's sanctioned terminal action: it hands the
 * built ROM to the emulator via sessionStorage and navigates (the chat panel
 * itself never navigates on its own).
 */
export function makeAsmController(): AsmController {
  const errorsText = (errs: { line: number; message: string }[]): string =>
    errs.map((e) => `line ${e.line}: ${e.message}`).join('; ');

  /** Re-render the mounted page after a controller edit (no-op when off). */
  function refreshIfMounted(): void {
    if (asmMounted && asmRefresh) asmRefresh();
  }

  return {
    getSource(): string {
      initAsmState();
      return asmSource;
    },
    setSource(source: string): void {
      initAsmState();
      asmSource = source;
      asmPersist();
      refreshIfMounted();
    },
    appendSource(text: string): void {
      initAsmState();
      asmSource = asmSource.trim() ? `${asmSource.replace(/\s+$/, '')}\n\n${text}` : text;
      asmPersist();
      refreshIfMounted();
    },
    listDataFiles(): { name: string; bytes: number }[] {
      initAsmState();
      return Object.entries(asmIncludes).map(([name, b]) => ({ name, bytes: b.length }));
    },
    addDataFile(name: string, bytes: Uint8Array): void {
      initAsmState();
      asmIncludes[name] = bytes;
      asmPersist();
      refreshIfMounted();
    },
    removeDataFile(name: string): void {
      initAsmState();
      delete asmIncludes[name];
      asmPersist();
      refreshIfMounted();
    },
    assemble(): { ok: boolean; byteCount: number; errors: { line: number; message: string }[] } {
      initAsmState();
      const r = assemble(asmSource, ROM_ENTRY, asmIncludes);
      return { ok: r.ok, byteCount: r.bytes.length, errors: r.errors };
    },
    buildRom(): { ok: boolean; bytes?: number; error?: string } {
      initAsmState();
      const r = assemble(asmSource, ROM_ENTRY, asmIncludes);
      if (!r.ok) return { ok: false, error: errorsText(r.errors) };
      try {
        return { ok: true, bytes: buildRom(r.bytes).length };
      } catch (err) {
        return { ok: false, error: (err as Error).message };
      }
    },
    run(): { ok: boolean; error?: string } {
      initAsmState();
      const r = assemble(asmSource, ROM_ENTRY, asmIncludes);
      if (!r.ok) return { ok: false, error: errorsText(r.errors) };
      let rom: Uint8Array;
      try {
        rom = buildRom(r.bytes);
      } catch (err) {
        return { ok: false, error: (err as Error).message };
      }
      try {
        sessionStorage.setItem(ASM_ROM_KEY, bytesToBase64(rom));
      } catch (err) {
        return { ok: false, error: (err as Error).message };
      }
      // Same handoff the page's own ▶ Run uses: main.ts loads ASM_ROM_KEY.
      const url = new URL(location.href);
      url.searchParams.delete('asm');
      location.href = url.toString();
      return { ok: true };
    },
  };
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
  '',
  '; --- Embedding binary data (e.g. the graphics editor\'s VRAM .bin) ------',
  '; Load the file with the 📦 Data files button, then uncomment:',
  ';',
  '; data:   .incbin "tiles.bin"          ; label = the data\'s CPU address',
  ';        LDA data,X                   ; read byte $X of the data',
  '; past:   NOP                        ; label just past the data',
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
.bin-input { display: none; }
.asm-incs { display: flex; flex-wrap: wrap; gap: 6px; }
.asm-incs:empty { display: none; }
.inc-chip { display: inline-flex; align-items: center; gap: 8px; background: #141418;
  border: 1px solid #2a2a30; border-radius: 999px; padding: 3px 4px 3px 10px;
  font: 12px ui-monospace, SFMono-Regular, Menlo, monospace; color: #9fd0ff; }
.inc-x { background: none; border: none; cursor: pointer; font: inherit; padding: 0 4px;
  color: #6a6a72; border-radius: 999px; line-height: 1; }
.inc-x:hover { color: #ff8a8a; }
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
