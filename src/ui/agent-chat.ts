/**
 * `agent-chat` — the 🤖 panel that drives the three authoring pages from one
 * window, backed by an Ollama function-calling endpoint.
 *
 * Browser-only (plain DOM, no deps): it wires the pure agent core
 * (`src/agent/*`) to the page controllers (`makeAsmController` /
 * `makeGfxController` / `makeTrackController`). One send = one
 * `runAgent()` loop (non-streaming `POST /api/chat` per step); the panel
 * shows a thinking indicator, tool-call chips, and the final reply. Stop
 * aborts the in-flight request via `AbortController`.
 *
 * Endpoint + model are user-configured (persisted to
 * `localStorage["snes-web:agent:v1"]`); "test connection" fetches the
 * installed-model list from `/api/tags`.
 *
 * The conversation itself is ONE across all three authoring pages: the
 * message history (the exact context sent to Ollama) is persisted to
 * `localStorage["snes-web:agent-conversation:v1"]` and restored on every
 * mount, and a tab strip switches between the pages. User-clicked navigation
 * is safe because the history survives the reload; the agent itself still
 * NEVER navigates — the one sanctioned navigation is `asm_run`'s handoff to
 * the emulator, inside the assembler controller.
 */

import type { AgentControllers, Message, PageKind } from '../agent/types';
import { checkHealth } from '../agent/ollama';
import { runAgent, type AgentEvent } from '../agent/loop';
import { buildSystemPrompt } from '../agent/system';
import { clearHistory, loadHistory, saveHistory } from '../agent/conversation';
import {
  append,
  buildExport,
  clearLog,
  loadLog,
  makeLog,
  saveLog,
  type AgentLog,
} from '../agent/log';

const SETTINGS_KEY = 'snes-web:agent:v1';
const DEFAULT_ENDPOINT = 'http://127.0.0.1:11434';

/**
 * Ollama's `think` as surfaced in the panel. 'auto' = don't send the field
 * at all (the model's default — Qwen3 models think by default); 'on'/'off'
 * map to `think: true/false` on `/api/chat`.
 */
type ThinkMode = 'auto' | 'off' | 'on';

const THINK_MODES: readonly ThinkMode[] = ['auto', 'off', 'on'];

interface AgentSettings {
  endpoint: string;
  model: string;
  think: ThinkMode;
  /** Bumped once a migration has run, so a later explicit choice is respected. */
  v?: 1;
}

/**
 * Resolve a stored (or missing) `think` to the effective mode.
 *
 * The legacy default was `'auto'` — which for Qwen3-style models means
 * thinking **ON**, i.e. long reasoning-heavy responses. That is the failure
 * mode: it blows past the tunnel timeout (524) and trips Ollama's tool-call
 * parser. So a stored object from before the migration (no `v` field) that
 * still carries the default `'auto'` is flipped to `'off'`. An explicit
 * `'on'`/`'off'` — or an `'auto'` chosen *after* migration (versioned) — is
 * always respected verbatim.
 *
 * Pure + node-testable: no localStorage here.
 */
export function normalizeThink(raw: string | undefined, legacy: boolean): ThinkMode {
  if (raw === 'on' || raw === 'off') return raw; // explicit — always respected
  if (raw === 'auto') return legacy ? 'off' : 'auto'; // legacy default → off
  return 'off'; // fresh install default
}

function loadSettings(): AgentSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const v = JSON.parse(raw) as Partial<AgentSettings>;
      if (typeof v.endpoint === 'string' && v.endpoint !== '' && typeof v.model === 'string') {
        const legacy = v.v === undefined; // pre-migration stored object
        return { endpoint: v.endpoint, model: v.model, think: normalizeThink(v.think, legacy), v: 1 };
      }
    }
  } catch {
    // private mode / bad JSON — fall through to defaults
  }
  return { endpoint: DEFAULT_ENDPOINT, model: '', think: 'off', v: 1 };
}

function saveSettings(s: AgentSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // best effort — the panel still works for this page load
  }
}

/** A compact snapshot of all three pages, shown to the model in the prompt. */
function stateSummary(controllers: AgentControllers): string {
  const lines: string[] = [];
  try {
    const g = controllers.gfx.getState();
    lines.push(
      `graphics: mode ${g.mode}, ${g.tiles} tile(s), ${g.palette} palette colors, ${g.mapEntries}/1024 SC0 cells set`,
    );
    const files = controllers.asm.listDataFiles();
    lines.push(
      `assembler: source ${controllers.asm.getSource().length} bytes, data files ${files.length ? files.map((f) => `${f.name} (${f.bytes} B)`).join(', ') : '(none)'}`,
    );
    const song = JSON.parse(controllers.track.getSong()) as {
      name?: string;
      tempo?: number;
      orders?: number[];
      patterns?: unknown[];
      instruments?: unknown[];
    };
    lines.push(
      `tracker: "${song.name ?? 'song'}", ${song.tempo ?? '?'} rows/s, ${song.patterns?.length ?? '?'} pattern(s), ${song.instruments?.length ?? '?'} instrument(s), order [${(song.orders ?? []).join(', ')}]`,
    );
  } catch {
    // controller snapshots are best-effort; an empty summary is fine
  }
  return `## Current page state\n${lines.join('\n')}`;
}

/** One rendered line of the conversation list. */
type UiItem =
  | { kind: 'user'; text: string }
  | { kind: 'assistant'; text: string }
  | { kind: 'chip'; name: string; args: Record<string, unknown>; ok?: boolean; content?: string }
  | { kind: 'error'; text: string };

const CSS = `
.agc-root{position:fixed;right:16px;bottom:16px;width:min(430px,calc(100vw - 32px));height:min(600px,calc(100vh - 96px));display:flex;flex-direction:column;background:#14161b;border:1px solid #2e3440;border-radius:12px;box-shadow:0 10px 32px rgba(0,0,0,.55);z-index:1000;font:13px/1.5 ui-sans-serif,system-ui,sans-serif;color:#dde3ec}
.agc-head{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid #2e3440;cursor:default;flex:none}
.agc-title{font-weight:600;font-size:14px}
.agc-sub{color:#8a93a5;font-size:11px;margin-left:auto}
.agc-toggle{cursor:pointer;background:none;border:none;color:#8a93a5;font-size:14px;padding:2px 6px}
.agc-body{display:flex;flex-direction:column;flex:1;min-height:0}
.agc-root.collapsed .agc-body{display:none}
.agc-settings{display:grid;gap:6px;padding:10px 12px;border-bottom:1px solid #2e3440;flex:none}
.agc-row{display:flex;gap:6px;align-items:center}
.agc-settings input[type=text]{flex:1;min-width:0;background:#0f1115;border:1px solid #2e3440;border-radius:6px;color:#dde3ec;padding:5px 8px;font-size:12px}
.agc-settings select{flex:1;min-width:0;background:#0f1115;border:1px solid #2e3440;border-radius:6px;color:#dde3ec;padding:5px 8px;font-size:12px}
.agc-lbl{flex:0 0 auto;font-size:11.5px;color:#8a93a5}
.agc-btn{background:#242a35;border:1px solid #343c4c;color:#dde3ec;border-radius:6px;padding:5px 10px;font-size:12px;cursor:pointer}
.agc-btn:hover{background:#2c3342}
.agc-btn:disabled{opacity:.45;cursor:default}
.agc-btn.primary{background:#2f6feb;border-color:#2f6feb;color:#fff}
.agc-btn.primary:hover{background:#3b7bff}
.agc-status{font-size:11px;color:#8a93a5;min-height:14px}
.agc-status.err{color:#f0883e}
.agc-status.ok{color:#56b369}
.agc-hint{font-size:10.5px;color:#5d6575}
.agc-msgs{flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:8px;padding:12px}
.agc-user,.agc-asst,.agc-error{max-width:92%;padding:8px 10px;border-radius:10px;white-space:pre-wrap;word-wrap:break-word}
.agc-user{align-self:flex-end;background:#2f6feb22;border:1px solid #2f6feb55}
.agc-asst{align-self:flex-start;background:#1c212b;border:1px solid #2e3440}
.agc-error{align-self:flex-start;background:#f0883e1a;border:1px solid #f0883e66;color:#ffb27a}
.agc-retry{align-self:flex-start;background:#f0883e12;border-radius:8px;color:#ffb27a;font-size:12px;padding:2px 10px}
.agc-chip{align-self:flex-start;display:flex;flex-direction:column;gap:4px;background:#171b22;border:1px solid #2a3140;border-radius:8px;padding:6px 9px;font-size:12px}
.agc-chip .top{display:flex;align-items:center;gap:6px}
.agc-chip .name{font-weight:600;color:#9db1d8;font-family:ui-monospace,monospace}
.agc-chip .badge{font-size:10.5px;padding:1px 6px;border-radius:8px}
.agc-chip .badge.ok{background:#56b36922;color:#56b369}
.agc-chip .badge.err{background:#f0883e22;color:#f0883e}
.agc-chip .badge.run{background:#8a93a522;color:#8a93a5}
.agc-chip details{font-size:11px;color:#8a93a5}
.agc-chip details pre{white-space:pre-wrap;word-wrap:break-word;max-height:160px;overflow-y:auto;margin:4px 0 0}
.agc-think{align-self:flex-start;color:#8a93a5;font-size:12px;padding:2px 4px}
.agc-think i{display:inline-block;width:6px;height:6px;border-radius:50%;background:#8a93a5;margin-right:2px;animation:agc-blink 1.2s infinite}
.agc-think i:nth-child(2){animation-delay:.2s}
.agc-think i:nth-child(3){animation-delay:.4s}
@keyframes agc-blink{0%,80%,100%{opacity:.25}40%{opacity:1}}
.agc-nav{display:flex;gap:6px;align-items:center;padding:8px 12px;border-bottom:1px solid #2e3440;flex:none}
.agc-navbtn{flex:1;min-width:0;background:#1a1f28;border:1px solid #2e3440;border-radius:6px;color:#aeb8c9;padding:5px 6px;font-size:11.5px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.agc-navbtn:hover{background:#242a35}
.agc-navbtn.cur{background:#2f6feb22;border-color:#2f6feb88;color:#9db1d8;font-weight:600}
.agc-navbtn:disabled{opacity:.45;cursor:default}
.agc-new{flex:0 0 auto;background:none;border:1px solid #2e3440;border-radius:6px;color:#8a93a5;font-size:11.5px;padding:5px 8px;cursor:pointer}
.agc-new:hover{background:#242a35;color:#dde3ec}
.agc-new:disabled{opacity:.45;cursor:default}
.agc-input{display:flex;flex-direction:column;gap:6px;padding:10px 12px;border-top:1px solid #2e3440;flex:none}
.agc-input textarea{width:100%;box-sizing:border-box;min-height:52px;max-height:140px;resize:vertical;background:#0f1115;border:1px solid #2e3440;border-radius:8px;color:#dde3ec;padding:8px;font:13px/1.45 ui-sans-serif,system-ui,sans-serif}
.agc-actions{display:flex;gap:6px;justify-content:flex-end}
`;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag);
  if (className) n.className = className;
  return n;
}

function fmtArgs(args: Record<string, unknown>): string {
  try {
    const s = JSON.stringify(args, null, 1);
    return s.length > 600 ? `${s.slice(0, 600)}…` : s;
  } catch {
    return String(args);
  }
}

function clip(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

/** Tool results are compact JSON; errors carry an `error` field (tools.ts `fail`). */
function resultLooksOk(content: string): boolean {
  try {
    const j: unknown = JSON.parse(content);
    if (j && typeof j === 'object' && 'error' in (j as Record<string, unknown>)) return false;
  } catch {
    // not JSON — informational, not an error
  }
  return true;
}

/** Rebuild the rendered conversation list from a restored wire history. */
function itemsFromHistory(h: Message[]): UiItem[] {
  const out: UiItem[] = [];
  for (const m of h) {
    if (m.role === 'user') {
      out.push({ kind: 'user', text: m.content });
    } else if (m.role === 'assistant') {
      for (const tc of m.tool_calls ?? []) {
        out.push({ kind: 'chip', name: tc.name, args: (tc.args ?? {}) as Record<string, unknown> });
      }
      if (m.content.trim() !== '') out.push({ kind: 'assistant', text: m.content });
    } else if (m.role === 'tool') {
      // Attach the result to the first still-open chip (same pairing as the live loop).
      const open = out.find((it) => it.kind === 'chip' && it.content === undefined);
      if (open && open.kind === 'chip') {
        open.ok = resultLooksOk(m.content);
        open.content = m.content;
      }
    }
  }
  for (const it of out) {
    // A chip whose result never arrived: the page reloaded mid-turn.
    if (it.kind === 'chip' && it.content === undefined) {
      it.ok = false;
      it.content = '(no result — the page reloaded before this step finished)';
    }
  }
  return out;
}

export function mountAgentChat(container: HTMLElement, page: PageKind, controllers: AgentControllers): void {
  let settings = loadSettings();
  // One shared conversation across all three pages — restored here, saved on
  // every send/turn (see `saveHistory` calls below).
  let history: Message[] = loadHistory(localStorage);
  const items: UiItem[] = itemsFromHistory(history);
  // A separate, append-only journal of what actually happened — each run's
  // config (page/endpoint/model/thinking), the prompt, every tool call +
  // result, errors, and per-step latency/retry metrics. Persists across pages
  // and reloads (its own key, independent of the conversation); "⬇ Log"
  // downloads it as JSON for sharing.
  let log: AgentLog =
    loadLog(localStorage) ?? makeLog(typeof navigator !== 'undefined' ? navigator.userAgent : undefined);
  let thinking = false;
  let running = false;
  let retryNote = ''; // "retrying n/m…" text, set by the retry event, shown at the foot of the thread
  let aborter: AbortController | null = null;

  const root = el('div', 'agc-root');
  const style = el('style');
  style.textContent = CSS;
  root.appendChild(style);

  // --- header ---------------------------------------------------------------
  const head = el('div', 'agc-head');
  const title = el('span', 'agc-title');
  title.textContent = '🤖 Agent';
  const sub = el('span', 'agc-sub');
  const PAGE_NAMES = { asm: 'assembler', gfx: 'graphics', track: 'tracker' } as const;
  sub.textContent = `on ${PAGE_NAMES[page]}`;
  const toggle = el('button', 'agc-toggle');
  toggle.textContent = '▾';
  toggle.title = 'Collapse / expand';
  head.append(title, sub, toggle);
  root.appendChild(head);
  toggle.addEventListener('click', () => {
    const collapsed = root.classList.toggle('collapsed');
    toggle.textContent = collapsed ? '▸' : '▾';
  });

  const body = el('div', 'agc-body');
  root.appendChild(body);

  // --- page tabs (user-initiated only — the agent itself never navigates) ---
  const NAV_PAGES: { page: PageKind; label: string }[] = [
    { page: 'asm', label: '65C816' },
    { page: 'gfx', label: '🎨 Graphics' },
    { page: 'track', label: '🎵 Music' },
  ];
  const navRow = el('div', 'agc-nav');
  const navBtns: HTMLButtonElement[] = [];
  for (const n of NAV_PAGES) {
    const b = document.createElement('button');
    b.className = n.page === page ? 'agc-navbtn cur' : 'agc-navbtn';
    b.textContent = n.label;
    b.title = `Open the ${n.label} page (the conversation follows)`;
    b.addEventListener('click', () => {
      if (running) return; // a turn is in flight — Stop it first
      const url = new URL(location.href);
      url.searchParams.delete('asm');
      url.searchParams.delete('gfx');
      url.searchParams.delete('track');
      url.searchParams.set(n.page, '1');
      location.href = url.toString();
    });
    navRow.appendChild(b);
    navBtns.push(b);
  }
  const newBtn = document.createElement('button');
  newBtn.className = 'agc-new';
  newBtn.textContent = '↺ New';
  newBtn.title = 'Start a fresh conversation (your code/graphics/music pages are kept)';
  newBtn.addEventListener('click', () => {
    if (running || items.length === 0) return;
    if (!confirm('Clear the agent conversation? (Your code/graphics/music are kept.)')) return;
    history = [];
    items.length = 0;
    clearHistory(localStorage);
    renderAll();
  });
  navRow.append(newBtn);

  // --- log tools: export the journal, or clear it ---------------------------
  // The log is separate from the conversation: "↺ New" and page reloads don't
  // touch it, so it accumulates runs across the whole session. Exporting it is
  // how the user shares what went wrong / how slow things were.
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : undefined;
  const exportBtn = document.createElement('button');
  exportBtn.className = 'agc-new';
  exportBtn.textContent = '⬇ Log';
  exportBtn.title =
    'Download the agent log (JSON) — timestamps, run config, tool calls + results, errors, and per-step latency/retry metrics';
  exportBtn.addEventListener('click', () => {
    const blob = new Blob([buildExport(log)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `snes-agent-log-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  const clearLogBtn = document.createElement('button');
  clearLogBtn.className = 'agc-new';
  clearLogBtn.textContent = '🧹';
  clearLogBtn.title = 'Clear the agent log (your conversation and pages are kept)';
  clearLogBtn.addEventListener('click', () => {
    if (log.entries.length === 0) return;
    if (!confirm('Clear the agent log? (Your conversation and pages are kept.)')) return;
    log = makeLog(ua);
    clearLog(localStorage);
  });

  navRow.append(exportBtn, clearLogBtn);
  body.appendChild(navRow);

  // --- settings -------------------------------------------------------------
  const settingsBox = el('div', 'agc-settings');
  const epRow = el('div', 'agc-row');
  const epIn = document.createElement('input');
  epIn.type = 'text';
  epIn.value = settings.endpoint;
  epIn.placeholder = 'http://127.0.0.1:11434';
  epIn.spellcheck = false;
  const testBtn = el('button', 'agc-btn');
  testBtn.textContent = 'Test';
  epRow.append(epIn, testBtn);

  const modelRow = el('div', 'agc-row');
  const modelSel = document.createElement('select');
  const thinkRow = el('div', 'agc-row');
  const thinkLbl = el('span', 'agc-lbl');
  thinkLbl.textContent = 'Thinking';
  const thinkSel = document.createElement('select');
  const THINK_LABELS: Record<ThinkMode, string> = {
    auto: 'Auto (model default)',
    on: 'On — reasons each step (slow)',
    off: 'Off — no reasoning (fastest)',
  };
  for (const m of THINK_MODES) {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = THINK_LABELS[m];
    thinkSel.appendChild(opt);
  }
  thinkSel.value = settings.think;
  thinkSel.title =
    "Ollama's `think` field: Off skips the model's reasoning phase — the biggest per-step speedup. Qwen3-style models are on/off only (no token budget).";
  const status = el('div', 'agc-status');
  const hint = el('div', 'agc-hint');
  hint.textContent =
    'Phone/LAN: Ollama must allow this origin — run it with OLLAMA_ORIGINS=http://<host>:<port> (e.g. OLLAMA_ORIGINS=http://10.0.1.5:8080) or it will refuse the CORS preflight.';
  modelRow.append(modelSel);
  thinkRow.append(thinkLbl, thinkSel);
  settingsBox.append(epRow, modelRow, thinkRow, status, hint);
  body.appendChild(settingsBox);

  function rebuildModelSelect(models: string[]): void {
    const current = modelSel.value || settings.model;
    modelSel.innerHTML = '';
    const all = new Set<string>(models);
    if (current && !all.has(current)) all.add(current);
    if (all.size === 0) {
      const opt = el('option');
      opt.value = '';
      opt.textContent = '— run “Test” to load models —';
      modelSel.appendChild(opt);
    }
    for (const m of Array.from(all).sort()) {
      const opt = el('option');
      opt.value = m;
      opt.textContent = m;
      modelSel.appendChild(opt);
    }
    if (current && all.has(current)) modelSel.value = current;
  }

  function persistSettings(): void {
    // spread `settings` to keep the `v` migration stamp (dropping it would
    // re-classify the next load as legacy and re-flip an explicit Auto)
    settings = { ...settings, endpoint: epIn.value.trim(), model: modelSel.value, think: thinkSel.value as ThinkMode };
    saveSettings(settings);
  }
  epIn.addEventListener('change', persistSettings);
  epIn.addEventListener('input', () => {
    // live-update so a typo doesn't require a blur
    settings.endpoint = epIn.value.trim();
  });
  modelSel.addEventListener('change', persistSettings);
  thinkSel.addEventListener('change', persistSettings);

  testBtn.addEventListener('click', () => {
    const ep = epIn.value.trim();
    if (!ep) return;
    persistSettings();
    testBtn.disabled = true;
    status.className = 'agc-status';
    status.textContent = 'checking…';
    void (async () => {
      const res = await checkHealth(ep).catch(() => null);
      testBtn.disabled = false;
      if (res && res.ok) {
        rebuildModelSelect(res.models);
        persistSettings();
        status.className = 'agc-status ok';
        status.textContent =
          res.models.length > 0
            ? `connected — ${res.models.length} model(s) installed`
            : 'connected — no models installed (ollama pull <model>)';
      } else {
        status.className = 'agc-status err';
        status.textContent = res?.error ? `unreachable: ${res.error}` : 'unreachable (see CORS hint)';
      }
    })();
  });

  // --- message list -----------------------------------------------------------
  const msgs = el('div', 'agc-msgs');
  body.appendChild(msgs);

  function renderChip(c: UiItem & { kind: 'chip' }): HTMLElement {
    const chip = el('div', 'agc-chip');
    const top = el('div', 'top');
    const name = el('span', 'name');
    name.textContent = c.name;
    const badge = el('span', `badge ${c.ok === undefined ? 'run' : c.ok ? 'ok' : 'err'}`);
    badge.textContent = c.ok === undefined ? 'running…' : c.ok ? 'ok' : 'error';
    top.append(name, badge);
    chip.appendChild(top);
    if (c.args && Object.keys(c.args).length > 0) {
      const d = document.createElement('details');
      const s = document.createElement('summary');
      s.textContent = 'arguments';
      const pre = el('pre');
      pre.textContent = fmtArgs(c.args);
      d.append(s, pre);
      chip.appendChild(d);
    }
    if (c.content !== undefined) {
      const d = document.createElement('details');
      const s = document.createElement('summary');
      s.textContent = c.ok === false ? 'result (error)' : 'result';
      const pre = el('pre');
      pre.textContent = clip(c.content, 2000);
      d.append(s, pre);
      chip.appendChild(d);
    }
    return chip;
  }

  function renderAll(): void {
    msgs.innerHTML = '';
    for (const it of items) {
      if (it.kind === 'user') {
        const n = el('div', 'agc-user');
        n.textContent = it.text;
        msgs.appendChild(n);
      } else if (it.kind === 'assistant') {
        const n = el('div', 'agc-asst');
        n.textContent = it.text;
        msgs.appendChild(n);
      } else if (it.kind === 'error') {
        const n = el('div', 'agc-error');
        n.textContent = it.text;
        msgs.appendChild(n);
      } else {
        msgs.appendChild(renderChip(it));
      }
    }
    if (retryNote) {
      const r = el('div', 'agc-retry');
      r.textContent = retryNote;
      msgs.appendChild(r);
    }
    if (thinking) {
      const t = el('div', 'agc-think');
      t.innerHTML = '<i></i><i></i><i></i>';
      t.append(' thinking');
      msgs.appendChild(t);
    }
    msgs.scrollTop = msgs.scrollHeight;
  }

  // --- input ------------------------------------------------------------------
  const inputBox = el('div', 'agc-input');
  const ta = document.createElement('textarea');
  ta.placeholder = 'What should we make? (Enter to send, Shift+Enter for a newline)';
  const actions = el('div', 'agc-actions');
  const sendBtn = el('button', 'agc-btn primary');
  sendBtn.textContent = 'Send';
  const stopBtn = el('button', 'agc-btn');
  stopBtn.textContent = 'Stop';
  stopBtn.disabled = true;
  actions.append(sendBtn, stopBtn);
  inputBox.append(ta, actions);
  body.appendChild(inputBox);

  function send(): void {
    const text = ta.value.trim();
    if (!text || running) return;
    const ep = epIn.value.trim();
    const model = modelSel.value;
    if (!ep || !model) {
      status.className = 'agc-status err';
      status.textContent = 'set the endpoint and a model (Test connection loads the list)';
      return;
    }
    persistSettings();
    ta.value = '';
    items.push({ kind: 'user', text });
    history.push({ role: 'user', content: text });
    saveHistory(localStorage, history); // survives even a mid-turn reload
    // Open the run in the journal (config snapshot + prompt) before anything
    // can fail, so even an immediate error is logged with its context.
    const runId = 'r' + Date.now().toString(36);
    log = append(log, { type: 'run-start', runId, config: { page, endpoint: ep, model, think: settings.think } });
    log = append(log, { type: 'user', text });
    thinking = true;
    running = true;
    sendBtn.disabled = true;
    stopBtn.disabled = false;
    navBtns.forEach((b) => (b.disabled = true));
    newBtn.disabled = true;
    aborter = new AbortController();
    renderAll();

    const pending: (UiItem & { kind: 'chip' })[] = [];
    const onEvent = (ev: AgentEvent): void => {
      if (ev.type === 'thinking') {
        retryNote = '';
        thinking = true;
        renderAll();
      } else if (ev.type === 'tool-call') {
        retryNote = '';
        const chip: UiItem & { kind: 'chip' } = { kind: 'chip', name: ev.name, args: ev.args };
        items.push(chip);
        pending.push(chip);
        log = append(log, { type: 'tool-call', name: ev.name, args: ev.args });
        renderAll();
      } else if (ev.type === 'tool-result') {
        // The loop dispatches calls in order, so pop the first open chip.
        retryNote = '';
        const chip = pending.shift();
        const target = chip && chip.name === ev.name ? chip : items[items.length - 1];
        if (target && target.kind === 'chip') {
          target.ok = ev.ok;
          target.content = ev.content;
        }
        log = append(log, { type: 'tool-result', name: ev.name, ok: ev.ok, content: ev.content });
        renderAll();
      } else if (ev.type === 'message') {
        retryNote = '';
        if (ev.content.trim() !== '') {
          items.push({ kind: 'assistant', text: ev.content });
          log = append(log, { type: 'assistant', text: ev.content });
        }
        renderAll();
      } else if (ev.type === 'retry') {
        // Transient model/server hiccup — the loop is retrying; stay alive,
        // show it, and keep a per-attempt trail in the journal.
        retryNote = `↻ hiccup — retrying ${ev.attempt}/${ev.max}…`;
        log = append(log, { type: 'retry', runId, attempt: ev.attempt, max: ev.max, error: ev.error });
        renderAll();
      }
    };

    void (async () => {
      try {
        const res = await runAgent({
          endpoint: ep,
          model,
          system: buildSystemPrompt(page, stateSummary(controllers)),
          messages: history,
          controllers,
          think: settings.think === 'on' ? true : settings.think === 'off' ? false : undefined,
          signal: aborter?.signal,
          onEvent,
        });
        // Continue the conversation from the full wire history (minus system).
        history = res.messages.slice(1);
        saveHistory(localStorage, history);
        if (res.stopped === 'max-turns' && res.finalContent.trim() === '') {
          items.push({
            kind: 'assistant',
            text: `⏸ I kept working and used my full ${res.turns}-step budget without finishing. Send “continue” to give me more steps and pick up where I left off.`,
          });
        }
        if (res.stopped === 'aborted') {
          items.push({ kind: 'assistant', text: '⏹ Stopped.' });
        }
        // Close the run in the journal with the loop's latency + retry metrics.
        log = append(log, {
          type: 'run-end',
          runId,
          stopped: res.stopped,
          turns: res.turns,
          totalMs: res.totalMs,
          perStep: res.perStep,
        });
      } catch (err) {
        // The loop throws a self-contained, actionable message per failure
        // class — a permanent 4xx (bad model name) fails fast on the first
        // attempt, a context overflow is auto-trimmed a few rounds before
        // giving up, a transient endpoint burns the retry budget and says
        // what to check. Show it verbatim.
        const msg = (err as Error).message;
        items.push({ kind: 'error', text: msg });
        log = append(log, { type: 'error', phase: 'model', message: msg });
      } finally {
        thinking = false;
        running = false;
        sendBtn.disabled = false;
        stopBtn.disabled = true;
        navBtns.forEach((b) => (b.disabled = false));
        newBtn.disabled = items.length === 0;
        aborter = null;
        renderAll();
        saveLog(localStorage, log); // persist the journal (best-effort, capped)
      }
    })();
  }

  sendBtn.addEventListener('click', send);
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });
  stopBtn.addEventListener('click', () => aborter?.abort());

  // --- init ---------------------------------------------------------------------
  rebuildModelSelect([]);
  if (settings.model) modelSel.value = settings.model;
  newBtn.disabled = items.length === 0;
  renderAll();

  container.appendChild(root);
}
