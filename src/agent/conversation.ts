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

  // The invariants below apply to the first NON-system message: a stored
  // conversation starts with the system prompt, and a broken batch right
  // after it (a dangling tool result, or a call with fewer results than it
  // made) is still a wire error.
  const sys = out[0] && out[0].role === 'system' ? 1 : 0;

  for (;;) {
    const head = out[sys];
    if (!head) return out;
    if (head.role === 'tool') {
      out.splice(sys, 1);
      continue;
    }
    if (head.role === 'assistant' && (head.tool_calls?.length ?? 0) > 0) {
      const n = head.tool_calls!.length;
      let i = sys + 1;
      while (i < out.length && out[i].role === 'tool') i++;
      if (i - (sys + 1) >= n) return out; // complete batch — a valid head
      out.splice(sys, i - sys); // incomplete: drop the call and its orphan results
      continue;
    }
    return out;
  }
}

/**
 * Tail sizes (total messages, system included) tried in order when Ollama
 * rejects a request as longer than the model's context window. Each round
 * shows the model less of the old conversation until only the system prompt
 * plus the last couple of messages remain.
 */
export const CONTEXT_TRIM_TAILS = [8, 4, 2] as const;

/**
 * Shrink `messages` for a context-length failure: keep the last
 * `CONTEXT_TRIM_TAILS[round]` messages (the budget includes the system
 * prompt, so the model keeps its instructions), then run `sanitizeHistory`
 * to repair the cut — it can orphan a leading tool result or split an
 * assistant call/result batch, and it also drops a trailing dangling tool
 * call. `round` = how many times this step has already been trimmed
 * (0 → 8, 1 → 4, ≥2 → 2 total).
 *
 * The trim is LOSSY on purpose (that's what "it doesn't fit" means): the
 * newest work stays in context, the oldest is what the model can most afford
 * to have forgotten, and the loop re-asks the model for the final answer.
 */
export function trimForContext(messages: Message[], round: number): Message[] {
  const keep = CONTEXT_TRIM_TAILS[Math.min(Math.max(round, 0), CONTEXT_TRIM_TAILS.length - 1)];
  const sys = messages[0] && messages[0].role === 'system' ? 1 : 0;
  const body = messages.slice(sys);
  const tail = body.slice(Math.max(body.length + sys - keep, 0));
  return sanitizeHistory([...messages.slice(0, sys), ...tail]);
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
