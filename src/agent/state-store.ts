/**
 * `state-store` — the small persistence seam shared by the agent and the pages
 * it drives. Each page's canonical state (asm source + data files, the gfx
 * editor, the track song) is persisted to one localStorage key and reloaded on
 * mount; the agent's controllers read/write those same keys. Keeping the
 * load/save/validate logic in one pure module (with an injectable storage
 * backend) means it is node-testable — the pages just pass `localStorage`.
 *
 * Pure: no globals are touched unless a backend is handed in.
 */

/** The minimal surface of `localStorage` we rely on (easy to fake in tests). */
export interface StorageBackend {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** A type guard: does this parsed value have the shape we expect? */
export type Guard<T> = (v: unknown) => v is T;

export interface LoadResult<T> {
  value: T;
  /** `stored` when a valid value was read; `fallback` when the key was absent,
   *  the JSON was malformed, or the value failed the guard. */
  from: 'stored' | 'fallback';
}

/**
 * Read + parse + validate `key`. Never throws: any failure (missing key, bad
 * JSON, guard failure) yields the `fallback`. The backend itself may throw
 * (e.g. storage disabled) — that is swallowed too.
 */
export function loadState<T>(
  store: StorageBackend,
  key: string,
  guard: Guard<T>,
  fallback: T,
): LoadResult<T> {
  let raw: string | null = null;
  try {
    raw = store.getItem(key);
  } catch {
    return { value: fallback, from: 'fallback' };
  }
  if (raw === null || raw === '') return { value: fallback, from: 'fallback' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { value: fallback, from: 'fallback' };
  }
  if (!guard(parsed)) return { value: fallback, from: 'fallback' };
  return { value: parsed, from: 'stored' };
}

/**
 * Serialize + write `value` to `key`. Returns `true` on success. Never throws:
 * a backend that refuses (quota, disabled) is reported as `false` so the
 * caller can degrade (the in-memory state still works).
 */
export function saveState(store: StorageBackend, key: string, value: unknown): boolean {
  try {
    store.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/** Remove `key` (clearing a page's saved state). Never throws. */
export function clearState(store: StorageBackend, key: string): void {
  try {
    store.removeItem(key);
  } catch {
    // nothing to do — the key simply stays
  }
}

// --- a tiny in-memory backend for tests (and any non-browser use) ----------

export class MemoryStorage implements StorageBackend {
  private map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  /** Test helper: all current keys. */
  keys(): string[] {
    return [...this.map.keys()];
  }
}
