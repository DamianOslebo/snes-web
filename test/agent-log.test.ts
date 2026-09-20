import { describe, expect, it } from 'vitest';
import {
  MAX_CONTENT_CHARS,
  MAX_LOG_ENTRIES,
  append,
  buildExport,
  clearLog,
  loadLog,
  makeLog,
  saveLog,
  type AgentLog,
  type LogEntry,
} from '../src/agent/log';
import { MemoryStorage, type StorageBackend } from '../src/agent/state-store';

const t0 = 1_700_000_000_000;

function user(text: string, t = t0): LogEntry {
  return { t, type: 'user', text };
}

describe('makeLog', () => {
  it('starts empty and records the browser user-agent when given', () => {
    const log = makeLog('TestAgent/1.0', t0);
    expect(log.app).toBe('snes-web');
    expect(log.schema).toBe(1);
    expect(log.userAgent).toBe('TestAgent/1.0');
    expect(log.createdAt).toBe(t0);
    expect(log.entries).toEqual([]);
    expect(makeLog().userAgent).toBeUndefined();
  });
});

describe('append', () => {
  it('stamps the entry with the given timestamp (defaults to now)', () => {
    const log = append(makeLog(), user('hi'), 123);
    expect(log.entries[0].t).toBe(123);
    // A second append with the default clock is >= the first.
    const again = append(log, user('again'));
    expect(again.entries[1].t).toBeGreaterThanOrEqual(t0);
  });

  it('truncates long free-text fields but leaves short ones intact', () => {
    const short = 'RTI';
    const long = 'x'.repeat(3000);
    const log = append(makeLog(), user(short), t0);
    const withLong = append(log, user(long), t0);
    const a = withLong.entries[0] as { text: string };
    const b = withLong.entries[1] as { text: string };
    expect(a.text).toBe('RTI');
    expect(b.text).not.toBe(long);
    expect(b.text.length).toBeLessThan(long.length);
    expect(b.text).toContain('…');
    expect(b.text.length).toBeLessThanOrEqual(MAX_CONTENT_CHARS + 40);
  });

  it('truncates tool-result content too, but keeps structured args whole', () => {
    const log = makeLog();
    const withCall = append(log, { type: 'tool-call', name: 'asm_set_source', args: { source: 'y'.repeat(5000) } }, t0);
    const withResult = append(withCall, { type: 'tool-result', name: 'asm_set_source', ok: true, content: 'z'.repeat(5000) }, t0);
    const call = withResult.entries[0] as unknown as { args: { source: string } };
    const result = withResult.entries[1] as { content: string };
    expect(call.args.source.length).toBe(5000); // args are not truncated
    expect(result.content.length).toBeLessThan(5000);
    expect(result.content).toContain('…');
  });

  it('caps to the newest MAX_LOG_ENTRIES, dropping the oldest first', () => {
    let log: AgentLog = makeLog();
    for (let i = 0; i < MAX_LOG_ENTRIES + 5; i++) log = append(log, user(`m${i}`), t0 + i);
    expect(log.entries.length).toBe(MAX_LOG_ENTRIES);
    const first = log.entries[0] as { text: string };
    const last = log.entries[log.entries.length - 1] as { text: string };
    expect(first.text).toBe(`m5`); // m0..m4 were dropped
    expect(last.text).toBe(`m${MAX_LOG_ENTRIES + 4}`);
  });

  it('is immutable — the original log is not mutated', () => {
    const before = makeLog();
    const after = append(before, user('hi'), t0);
    expect(before.entries).toEqual([]);
    expect(after.entries.length).toBe(1);
  });
});

describe('buildExport', () => {
  it('produces self-describing JSON that round-trips', () => {
    let log: AgentLog = makeLog('UA', 1000);
    log = append(log, { type: 'run-start', runId: 'r1', config: { page: 'asm', endpoint: 'http://h', model: 'm', think: 'off' } }, 2000);
    log = append(log, user('make a block'), 2000);
    log = append(log, { type: 'run-end', runId: 'r1', stopped: 'reply', turns: 0, totalMs: 120, perStep: [{ index: 0, modelMs: 120, retries: 0, retryErrors: [], toolCalls: 0, toolMs: 0 }] }, 3000);

    const text = buildExport(log, 9999);
    const parsed = JSON.parse(text) as {
      app: string;
      schema: number;
      userAgent: string;
      exportedAt: number;
      entryCount: number;
      entries: unknown[];
    };
    expect(parsed.app).toBe('snes-web');
    expect(parsed.schema).toBe(1);
    expect(parsed.userAgent).toBe('UA');
    expect(parsed.exportedAt).toBe(9999);
    expect(parsed.entryCount).toBe(3);
    expect(parsed.entries).toHaveLength(3);
    expect(parsed.entries[0]).toMatchObject({ type: 'run-start', runId: 'r1', config: { page: 'asm', think: 'off' } });
  });
});

describe('persistence', () => {
  it('round-trips a journal through the storage backend', () => {
    const store = new MemoryStorage();
    let log: AgentLog = makeLog('UA', 100);
    log = append(log, user('hello'), 200);
    log = append(log, { type: 'error', phase: 'model', message: 'XML syntax error on line 3' }, 300);
    expect(saveLog(store, log)).toBe(true);

    const back = loadLog(store);
    expect(back).not.toBeNull();
    expect(back!.entries.length).toBe(2);
    expect((back!.entries[1] as { message: string }).message).toBe('XML syntax error on line 3');
  });

  it('returns null when the key is absent or the JSON is malformed', () => {
    expect(loadLog(new MemoryStorage())).toBeNull();
    const store = new MemoryStorage();
    store.setItem('snes-web:agent-log:v1', '{not json');
    expect(loadLog(store)).toBeNull();
  });

  it('rejects a stored value that is not a journal shape', () => {
    const store = new MemoryStorage();
    store.setItem('snes-web:agent-log:v1', JSON.stringify({ createdAt: 1, entries: [{ t: 'nope' }] }));
    expect(loadLog(store)).toBeNull();
    store.setItem('snes-web:agent-log:v1', JSON.stringify({ entries: [] })); // no createdAt
    expect(loadLog(store)).toBeNull();
  });

  it('retries with shorter tails when storage refuses the full log', () => {
    // A backend that only accepts values up to a fixed size — emulating a quota.
    let log: AgentLog = makeLog();
    for (let i = 0; i < 30; i++) log = append(log, user(`big-${'x'.repeat(40)}-${i}`), t0 + i);
    // Set the quota between the full log and the shortest retry tail (20 entries),
    // so the full save is refused but the tail fits.
    const full = JSON.stringify(log).length;
    const tail = JSON.stringify({ ...log, entries: log.entries.slice(-20) }).length;
    const max = Math.floor((full + tail) / 2);
    let stored: string | null = null;
    const store: StorageBackend = {
      getItem: () => stored,
      setItem: (_k, v) => {
        if (v.length > max) throw new Error('QuotaExceededError');
        stored = v;
      },
      removeItem: () => {
        stored = null;
      },
    };
    expect(saveLog(store, log)).toBe(true); // some shorter tail fit
    const back = loadLog(store);
    expect(back).not.toBeNull();
    expect(back!.entries.length).toBeGreaterThanOrEqual(1);
    expect(back!.entries.length).toBeLessThan(30); // only a tail made it
  });

  it('clearLog removes the stored journal', () => {
    const store = new MemoryStorage();
    const log = append(makeLog(), user('x'), t0);
    saveLog(store, log);
    expect(loadLog(store)).not.toBeNull();
    clearLog(store);
    expect(loadLog(store)).toBeNull();
  });
});
