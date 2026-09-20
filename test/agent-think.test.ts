import { describe, expect, it } from 'vitest';
import { normalizeThink } from '../src/ui/agent-chat';

describe('normalizeThink', () => {
  it('defaults a fresh install to off (no thinking)', () => {
    expect(normalizeThink(undefined, false)).toBe('off');
  });

  it('flips the legacy default auto (thinking on) to off', () => {
    expect(normalizeThink('auto', true)).toBe('off');
  });

  it('respects an explicit on or off from the legacy era', () => {
    expect(normalizeThink('on', true)).toBe('on');
    expect(normalizeThink('off', true)).toBe('off');
  });

  it('respects an auto chosen after migration (versioned store)', () => {
    expect(normalizeThink('auto', false)).toBe('auto');
  });

  it('still honors explicit modes on a versioned store', () => {
    expect(normalizeThink('on', false)).toBe('on');
    expect(normalizeThink('off', false)).toBe('off');
  });

  it('rejects garbage with the safe default', () => {
    expect(normalizeThink('bogus', true)).toBe('off');
    expect(normalizeThink('bogus', false)).toBe('off');
  });
});
