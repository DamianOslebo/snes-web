import { describe, expect, it } from 'vitest';
import {
  clearState,
  loadState,
  MemoryStorage,
  saveState,
  type StorageBackend,
} from '../src/agent/state-store';

const isString = (v: unknown): v is string => typeof v === 'string';

describe('loadState', () => {
  it('returns the fallback when the key is absent', () => {
    const store = new MemoryStorage();
    const r = loadState(store, 'k', isString, 'fallback');
    expect(r.value).toBe('fallback');
    expect(r.from).toBe('fallback');
  });

  it('returns the fallback when the stored JSON is malformed', () => {
    const store = new MemoryStorage();
    store.setItem('k', '{not json');
    const r = loadState(store, 'k', isString, 'fallback');
    expect(r.value).toBe('fallback');
    expect(r.from).toBe('fallback');
  });

  it('returns the fallback when the value fails the guard', () => {
    const store = new MemoryStorage();
    store.setItem('k', JSON.stringify(42));
    const r = loadState(store, 'k', isString, 'fallback');
    expect(r.value).toBe('fallback');
    expect(r.from).toBe('fallback');
  });

  it('accepts an empty stored string as absent', () => {
    const store = new MemoryStorage();
    store.setItem('k', '');
    const r = loadState(store, 'k', isString, 'fallback');
    expect(r.from).toBe('fallback');
  });

  it('reads back a valid stored value, tagged `stored`', () => {
    const store = new MemoryStorage();
    store.setItem('k', JSON.stringify('hi'));
    const r = loadState(store, 'k', isString, 'fallback');
    expect(r.value).toBe('hi');
    expect(r.from).toBe('stored');
  });

  it('validates an object with a custom guard', () => {
    const guard = (v: unknown): v is { n: number } =>
      typeof v === 'object' && v !== null && typeof (v as { n?: unknown }).n === 'number';
    const store = new MemoryStorage();
    store.setItem('k', JSON.stringify({ n: 3 }));
    expect(loadState(store, 'k', guard, { n: 0 }).value).toEqual({ n: 3 });
    store.setItem('k', JSON.stringify({ n: 'nope' }));
    expect(loadState(store, 'k', guard, { n: 0 }).value).toEqual({ n: 0 });
  });

  it('swallows a backend that throws on read (e.g. storage disabled)', () => {
    const boom: StorageBackend = {
      getItem() { throw new Error('denied'); },
      setItem() { throw new Error('denied'); },
      removeItem() { throw new Error('denied'); },
    };
    const r = loadState(boom, 'k', isString, 'fallback');
    expect(r.value).toBe('fallback');
    expect(r.from).toBe('fallback');
  });
});

describe('saveState', () => {
  it('writes JSON and reports success', () => {
    const store = new MemoryStorage();
    expect(saveState(store, 'k', { a: 1 })).toBe(true);
    expect(store.getItem('k')).toBe(JSON.stringify({ a: 1 }));
  });

  it('reports false (never throws) when the backend refuses', () => {
    const boom: StorageBackend = {
      getItem: () => null,
      setItem() { throw new Error('quota'); },
      removeItem() {},
    };
    expect(saveState(boom, 'k', 'x')).toBe(false);
  });
});

describe('clearState', () => {
  it('removes the key', () => {
    const store = new MemoryStorage();
    store.setItem('k', 'v');
    clearState(store, 'k');
    expect(store.getItem('k')).toBeNull();
    expect(store.keys()).toEqual([]);
  });

  it('is a no-op for an absent key and swallows backend errors', () => {
    const store = new MemoryStorage();
    expect(() => clearState(store, 'nope')).not.toThrow();
    const boom: StorageBackend = {
      getItem: () => null,
      setItem() {},
      removeItem() { throw new Error('denied'); },
    };
    expect(() => clearState(boom, 'k')).not.toThrow();
  });
});

describe('MemoryStorage', () => {
  it('behaves like a minimal Map-backed store', () => {
    const m = new MemoryStorage();
    expect(m.getItem('a')).toBeNull();
    m.setItem('a', '1');
    expect(m.getItem('a')).toBe('1');
    m.setItem('a', '2');
    expect(m.getItem('a')).toBe('2');
    m.removeItem('a');
    expect(m.keys()).toEqual([]);
  });
});
