import { describe, expect, it } from 'vitest';
import {
  CONVERSATION_KEY,
  MAX_HISTORY_MESSAGES,
  clearHistory,
  guardMessages,
  loadHistory,
  sanitizeHistory,
  saveHistory,
} from '../src/agent/conversation';
import type { StorageBackend } from '../src/agent/state-store';
import type { Message } from '../src/agent/types';

function fakeStore(maxBytes = Infinity): { store: StorageBackend; raw: () => string | null } {
  let v: string | null = null;
  const store: StorageBackend = {
    getItem: () => v,
    setItem: (_k, val) => {
      if (val.length > maxBytes) throw new Error('QuotaExceededError');
      v = val;
    },
    removeItem: () => {
      v = null;
    },
  };
  return { store, raw: () => v };
}

const user = (content = 'hi'): Message => ({ role: 'user', content });
const asst = (content = 'ok'): Message => ({ role: 'assistant', content });
const asstCall = (name = 'asm_assemble'): Message => ({
  role: 'assistant',
  content: '',
  tool_calls: [{ name, args: {} }],
});
const tool = (tool_name = 'asm_assemble'): Message => ({
  role: 'tool',
  content: JSON.stringify({ ok: true }),
  tool_name,
});

describe('guardMessages', () => {
  it('accepts well-formed histories', () => {
    expect(guardMessages([user(), asst(), asstCall(), tool()])).toBe(true);
    expect(guardMessages([])).toBe(true);
  });

  it('rejects junk of every shape', () => {
    expect(guardMessages(null)).toBe(false);
    expect(guardMessages('nope')).toBe(false);
    expect(guardMessages({ role: 'user', content: 'hi' })).toBe(false); // not an array
    expect(guardMessages([{ role: 'alien', content: 'x' }])).toBe(false);
    expect(guardMessages([{ role: 'user' }])).toBe(false); // no content
    expect(guardMessages([{ role: 'tool', content: 'x' }])).toBe(false); // no tool_name
    expect(guardMessages([{ role: 'assistant', content: '', tool_calls: [{ args: {} }] }])).toBe(
      false,
    ); // call without a name
  });
});

describe('sanitizeHistory', () => {
  it('drops a trailing assistant tool-call (a turn interrupted by reload)', () => {
    expect(sanitizeHistory([user(), asstCall()])).toEqual([user()]);
    expect(sanitizeHistory([user(), asstCall(), asstCall()])).toEqual([user()]);
  });

  it('keeps a completed turn (assistant call followed by its result)', () => {
    expect(sanitizeHistory([user(), asstCall(), tool()])).toEqual([user(), asstCall(), tool()]);
  });

  it('caps to the newest MAX_HISTORY_MESSAGES messages', () => {
    const many: Message[] = [];
    for (let i = 0; i < MAX_HISTORY_MESSAGES + 25; i++) many.push(i % 2 ? asst(`a${i}`) : user(`u${i}`));
    const out = sanitizeHistory(many);
    expect(out).toHaveLength(MAX_HISTORY_MESSAGES);
    // The tail (newest) survives, not the head.
    expect(out[out.length - 1].content).toBe(many[many.length - 1].content);
  });

  it('drops leading tool results whose call was capped away', () => {
    // 62 messages; the cap keeps the last 60, which starts mid-batch.
    const hist: Message[] = [user('old'), asstCall(), tool(), user('old2')];
    for (let i = 0; i < MAX_HISTORY_MESSAGES - 2; i++) hist.push(i % 2 ? asst(`a${i}`) : user(`u${i}`));
    const out = sanitizeHistory(hist);
    expect(out[0].role).not.toBe('tool');
    // ...and a leading incomplete batch is dropped with its orphans.
  });

  it('drops a leading incomplete tool batch but keeps a complete one', () => {
    // Incomplete: call made 2, only 1 result survived the cut.
    const two: Message = {
      role: 'assistant',
      content: '',
      tool_calls: [
        { name: 'asm_assemble', args: {} },
        { name: 'gfx_add_tile', args: {} },
      ],
    };
    const cut = sanitizeHistory([two, tool('asm_assemble'), user('next')]);
    expect(cut).toEqual([user('next')]);

    // Complete: both results present — valid Ollama context, kept.
    const kept = sanitizeHistory([two, tool('asm_assemble'), tool('gfx_add_tile'), user('next')]);
    expect(kept).toEqual([two, tool('asm_assemble'), tool('gfx_add_tile'), user('next')]);
  });

  it('empties a history that is only dangling pieces', () => {
    expect(sanitizeHistory([tool()])).toEqual([]);
    expect(sanitizeHistory([asstCall()])).toEqual([]);
  });
});

describe('loadHistory', () => {
  it('restores a valid stored conversation', () => {
    const { store } = fakeStore();
    const hist = [user('build a game'), asstCall(), tool(), asst('done')];
    store.setItem(CONVERSATION_KEY, JSON.stringify(hist));
    expect(loadHistory(store)).toEqual(hist);
  });

  it('returns [] for an empty, corrupt, or malformed key', () => {
    const { store } = fakeStore();
    expect(loadHistory(store)).toEqual([]);
    store.setItem(CONVERSATION_KEY, '{not json');
    expect(loadHistory(store)).toEqual([]);
    store.setItem(CONVERSATION_KEY, JSON.stringify({ no: 'messages' }));
    expect(loadHistory(store)).toEqual([]);
  });

  it('sanitizes what it loads (a trailing interrupted call is dropped)', () => {
    const { store } = fakeStore();
    store.setItem(CONVERSATION_KEY, JSON.stringify([user('go'), asstCall()]));
    expect(loadHistory(store)).toEqual([user('go')]);
  });

  it('survives a storage backend that throws', () => {
    const throwing: StorageBackend = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
      removeItem: () => {
        throw new Error('denied');
      },
    };
    expect(loadHistory(throwing)).toEqual([]);
  });
});

describe('saveHistory', () => {
  it('stores the sanitized history under the conversation key', () => {
    const { store, raw } = fakeStore();
    expect(saveHistory(store, [user('go'), asstCall()])).toBe(true); // call dropped
    expect(JSON.parse(raw()!)).toEqual([user('go')]);
  });

  it('retries with a shorter tail when storage refuses the full history', () => {
    // ~45 bytes per message; 30 of them ≈ 1.3 KB, over the 900-byte ceiling.
    const hist: Message[] = [];
    for (let i = 0; i < 30; i++) hist.push(user(`message number ${i} with a little padding text`));
    const { store, raw } = fakeStore(900);
    expect(saveHistory(store, hist)).toBe(true);
    const saved = JSON.parse(raw()!) as Message[];
    expect(saved.length).toBeLessThan(30);
    // The newest message survived the trim.
    expect(saved[saved.length - 1]).toEqual(hist[hist.length - 1]);
  });

  it('returns false when even the shortest tail is refused', () => {
    const hist: Message[] = [user('one'), asst('two')];
    const { store } = fakeStore(10);
    expect(saveHistory(store, hist)).toBe(false);
  });
});

describe('clearHistory', () => {
  it('removes the stored conversation', () => {
    const { store, raw } = fakeStore();
    store.setItem(CONVERSATION_KEY, JSON.stringify([user('x')]));
    clearHistory(store);
    expect(raw()).toBeNull();
  });

  it('does not throw when the backend refuses', () => {
    const throwing: StorageBackend = {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {
        throw new Error('denied');
      },
    };
    expect(() => clearHistory(throwing)).not.toThrow();
  });
});
