import { describe, expect, it } from 'vitest';
import { initialCollapsed } from '../src/ui/agent-chat';

describe('initialCollapsed', () => {
  it('starts collapsed on a fresh install on a small screen (mobile)', () => {
    expect(initialCollapsed(null, true)).toBe(true);
  });

  it('starts expanded on a fresh install on a large screen (desktop)', () => {
    expect(initialCollapsed(null, false)).toBe(false);
  });

  it('an explicit stored preference wins on any screen size', () => {
    expect(initialCollapsed(true, false)).toBe(true);
    expect(initialCollapsed(false, true)).toBe(false);
  });
});
