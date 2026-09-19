/**
 * `conversation` — persistence for the shared agent conversation.
 *
 * The three authoring pages are full-reload routes, but the 🤖 panel is ONE
 * conversation across all of them: its message history (the exact array sent
 * to Ollama as context) lives under a single localStorage key and is restored
 * on every mount — so switching ASM ⇄ GFX ⇄ TRACK keeps the same context, and
 * a mid-turn page reload never strands the model with a dangling tool call.
 *
 * Pure, like `state-store`: an injectable `StorageBackend` (the browser
 * passes `localStorage`) keeps this node-testable. Nothing here touches DOM
 * or globals.
 */

import type { Message, Role } from './types';
import type { StorageBackend } from './state-store';

/** The localStorage key holding the shared conversation. */
export const CONVERSATION_KEY = 'snes-web:agent-conversation:v1';

/** Soft cap on persisted messages — older turns are trimmed before newer ones. */
export const MAX_HISTORY_MESSAGES = 60;

const ROLES: readonly Role[] = ['system', 'user', 'assistant', 'tool'];

function isToolCall(v: unknown): boolean {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as { name?: unknown }).name === 'string' &&
    (v as { name?: unknown }).name !== ''
  );
}

function isMessage(v: unknown): boolean {
  if (typeof v !== 'object' || v === null) return false;
  const m = v as Record<string, unknown>;
  if (typeof m.role !== 'string' || !ROLES.includes(m.role as Role)) return false;
  if (typeof m.content !== 'string') return false;
  if (m.tool_calls !== undefined && (!Array.isArray(m.tool_calls) || !m.tool_calls.every(isToolCall))) {
    return false;
  }
  if (m.role === 'tool' && typeof m.tool_name !== 'string') return false;
  return true;
}

/** Type guard: is `v` an array of well-formed `Message`s? */
export function guardMessages(v: unknown): v is Message[] {
  return Array.isArray(v) && v.every(isMessage);
}

/**
 * Make a restored history safe to send back to Ollama:
 *  - drop a trailing assistant tool-call — the page reloaded mid-turn, and a
 *    call whose results never arrived is a wire error if re-sent;
 *  - cap to the most recent `MAX_HISTORY_MESSAGES` messages;
 *  - repair a possibly-dangling head (the cap can slice a tool batch in
 *    half): a leading `tool` result whose call was cut away, or a leading
 *    assistant call with fewer results than it made, is dropped together
 *    with its orphans until the first message is self-contained.
 *
 * A COMPLETE leading batch (all its results present) is valid Ollama context
 * and is kept.
 */
export function sanitizeHistory(messages: Message[]): Message[] {
  const out = messages.slice();

  while (
    out.length > 0 &&
    out[out.length - 1].role === 'assistant' &&
    (out[out.length - 1].tool_calls?.length ?? 0) > 0
  ) {
    out.pop();
  }

  if (out.length > MAX_HISTORY_MESSAGES) {
    out.splice(0, out.length - MAX_HISTORY_MESSAGES); // keep the newest tail
  }

  for (;;) {
    const head = out[0];
    if (!head) return out;
    if (head.role === 'tool') {
      out.shift();
      continue;
    }
    if (head.role === 'assistant' && (head.tool_calls?.length ?? 0) > 0) {
      const n = head.tool_calls!.length;
      let i = 1;
      while (i < out.length && out[i].role === 'tool') i++;
      if (i - 1 >= n) return out; // complete batch — a valid head
      out.splice(0, i); // incomplete: drop the call and its orphan results
      continue;
    }
    return out;
  }
}

/** Load + validate + sanitize the shared conversation; `[]` on any problem. */
export function loadHistory(store: StorageBackend): Message[] {
  let raw: string | null = null;
  try {
    raw = store.getItem(CONVERSATION_KEY);
  } catch {
    return [];
  }
  if (raw === null || raw === '') return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!guardMessages(parsed)) return [];
  return sanitizeHistory(parsed);
}

function trySet(store: StorageBackend, value: string): boolean {
  try {
    store.setItem(CONVERSATION_KEY, value);
    return true;
  } catch {
    return false; // quota / disabled storage — degrade to the next attempt
  }
}

/**
 * Persist `messages` (sanitized). If storage refuses the full history (quota,
 * a very long conversation), retry with progressively shorter tails so the
 * newest context always wins. Returns `false` only if even the shortest
 * attempt was refused — the in-memory conversation still works for this page
 * load.
 */
export function saveHistory(store: StorageBackend, messages: Message[]): boolean {
  const clean = sanitizeHistory(messages);
  const candidates: Message[][] = [];
  const seen = new Set<number>();
  for (const m of [clean, clean.slice(-20), clean.slice(-8)]) {
    if (!seen.has(m.length)) {
      seen.add(m.length);
      candidates.push(m);
    }
  }
  for (const m of candidates) {
    if (trySet(store, JSON.stringify(m))) return true;
  }
  return false;
}

/** Remove the stored conversation (the "New conversation" button). Never throws. */
export function clearHistory(store: StorageBackend): void {
  try {
    store.removeItem(CONVERSATION_KEY);
  } catch {
    // nothing to do — the key simply stays
  }
}
