/**
 * `log` — a timestamped journal of the agent's runs, for debugging errors and
 * tuning performance.
 *
 * The conversation history (see `conversation`) is what gets sent to Ollama;
 * this is a separate, append-only record of what actually happened in the
 * panel: each run's config (page / endpoint / model / think), the user's
 * prompt, every tool call + result, the final reply, any error, and the
 * per-step latency / retry metrics the loop reports. It is capped and persisted
 * to its own localStorage key, and one click in the panel serializes it to a
 * downloadable JSON file the user can share.
 *
 * Pure, like `conversation`: an injectable `StorageBackend` (the browser passes
 * `localStorage`) keeps this node-testable, and `append` takes an explicit
 * timestamp so tests are deterministic. Nothing here touches DOM or globals.
 */

import type { StorageBackend } from './state-store';
import type { StepMetrics } from './loop';
import type { PageKind } from './types';

/** The localStorage key holding the agent journal. */
export const LOG_KEY = 'snes-web:agent-log:v1';

/** Soft cap on journal entries — the oldest are dropped first. */
export const MAX_LOG_ENTRIES = 400;

/** Long free-text fields are truncated to this many characters in the log. */
export const MAX_CONTENT_CHARS = 2000;

/** The settings snapshot recorded at the start of each run. */
export interface LogConfig {
  page: PageKind;
  endpoint: string;
  model: string;
  /** 'auto' | 'on' | 'off' (the panel's Thinking control). */
  think: string;
}

/** One line in the journal. `t` is an epoch-ms timestamp. */
export type LogEntry =
  | { t: number; type: 'run-start'; runId: string; config: LogConfig }
  | { t: number; type: 'user'; text: string }
  | { t: number; type: 'tool-call'; name: string; args: Record<string, unknown> }
  | { t: number; type: 'tool-result'; name: string; ok: boolean; content: string }
  | { t: number; type: 'assistant'; text: string }
  | { t: number; type: 'retry'; runId: string; attempt: number; max: number; error: string }
  | { t: number; type: 'error'; phase: string; message: string }
  | {
      t: number;
      type: 'run-end';
      runId: string;
      stopped: string;
      turns: number;
      totalMs: number;
      perStep: StepMetrics[];
    };

export interface AgentLog {
  app: 'snes-web';
  schema: 1;
  userAgent?: string;
  createdAt: number;
  entries: LogEntry[];
}

function truncStr(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…(+${s.length - n} chars)` : s;
}

/** Truncate the known long-text fields; leave structured fields (args, metrics) intact. */
function sanitize(entry: LogEntry): LogEntry {
  switch (entry.type) {
    case 'user':
    case 'assistant':
      return { ...entry, text: truncStr(entry.text, MAX_CONTENT_CHARS) };
    case 'tool-result':
      return { ...entry, content: truncStr(entry.content, MAX_CONTENT_CHARS) };
    default:
      return entry;
  }
}

/** A journal entry before `append` stamps it with a timestamp (distributive `Omit`). */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type LogEntryInput = DistributiveOmit<LogEntry, 't'>;

/** A fresh, empty journal. */
export function makeLog(userAgent?: string, createdAt = Date.now()): AgentLog {
  return {
    app: 'snes-web',
    schema: 1,
    ...(userAgent ? { userAgent } : {}),
    createdAt,
    entries: [],
  };
}

/**
 * Append an entry (returns a new log). The entry is stamped with `at` (defaults
 * to now), its long-text fields are truncated, and the result is capped to
 * `MAX_LOG_ENTRIES` (the oldest entries are dropped first).
 */
export function append(log: AgentLog, entry: LogEntryInput, at = Date.now()): AgentLog {
  const clean = sanitize({ ...entry, t: at });
  const entries = [...log.entries, clean];
  if (entries.length > MAX_LOG_ENTRIES) entries.splice(0, entries.length - MAX_LOG_ENTRIES);
  return { ...log, entries };
}

/**
 * Serialize the journal to pretty-printed JSON for export. Includes the export
 * time and entry count alongside the raw entries, so a shared file is
 * self-describing.
 */
export function buildExport(log: AgentLog, exportedAt = Date.now()): string {
  return JSON.stringify(
    {
      app: log.app,
      schema: log.schema,
      userAgent: log.userAgent,
      createdAt: log.createdAt,
      exportedAt: exportedAt,
      entryCount: log.entries.length,
      entries: log.entries,
    },
    null,
    2,
  );
}

// --- persistence (mirrors `conversation.ts`) ---------------------------------

function isEntry(v: unknown): boolean {
  if (typeof v !== 'object' || v === null) return false;
  const e = v as Record<string, unknown>;
  return typeof e.t === 'number' && typeof e.type === 'string';
}

function guardLog(v: unknown): v is AgentLog {
  if (typeof v !== 'object' || v === null) return false;
  const l = v as Record<string, unknown>;
  if (typeof l.createdAt !== 'number') return false;
  return Array.isArray(l.entries) && l.entries.every(isEntry);
}

/** Load + validate the journal; `null` if absent, malformed, or the wrong shape. */
export function loadLog(store: StorageBackend): AgentLog | null {
  let raw: string | null = null;
  try {
    raw = store.getItem(LOG_KEY);
  } catch {
    return null;
  }
  if (raw === null || raw === '') return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!guardLog(parsed)) return null;
  return parsed;
}

function trySet(store: StorageBackend, value: string): boolean {
  try {
    store.setItem(LOG_KEY, value);
    return true;
  } catch {
    return false; // quota / disabled storage — degrade to the next attempt
  }
}

/**
 * Persist the journal. If storage refuses the full log (quota, a very long
 * session), retry with progressively shorter tails so the newest entries always
 * win. Returns `false` only if even the shortest attempt was refused — the
 * in-memory journal still works for this page load.
 */
export function saveLog(store: StorageBackend, log: AgentLog): boolean {
  const clean =
    log.entries.length > MAX_LOG_ENTRIES ? { ...log, entries: log.entries.slice(-MAX_LOG_ENTRIES) } : log;
  const candidates: AgentLog[] = [];
  const seen = new Set<number>();
  for (const l of [
    clean,
    { ...clean, entries: clean.entries.slice(-80) },
    { ...clean, entries: clean.entries.slice(-20) },
  ]) {
    if (!seen.has(l.entries.length)) {
      seen.add(l.entries.length);
      candidates.push(l);
    }
  }
  for (const l of candidates) {
    if (trySet(store, JSON.stringify(l))) return true;
  }
  return false;
}

/** Remove the stored journal (the "clear log" button). Never throws. */
export function clearLog(store: StorageBackend): void {
  try {
    store.removeItem(LOG_KEY);
  } catch {
    // nothing to do — the key simply stays
  }
}
