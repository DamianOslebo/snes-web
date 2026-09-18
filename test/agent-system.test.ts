import { describe, expect, it } from 'vitest';
import { buildSystemPrompt } from '../src/agent/system';

describe('buildSystemPrompt', () => {
  it('carries the workflow, LoROM rules, tool names, and the state snapshot', () => {
    for (const page of ['asm', 'gfx', 'track'] as const) {
      const p = buildSystemPrompt(page, 'STATE: 1 tile, 2 files');
      expect(p).toContain('vram.bin');
      expect(p).toContain('spc.bin');
      expect(p).toContain('LoROM');
      expect(p).toContain('asm_run');
      expect(p).toContain('gfx_set_map_grid');
      expect(p).toContain('trk_set_pattern');
      expect(p).toContain('STATE: 1 tile, 2 files');
    }
  });

  it('names the page the panel is mounted on', () => {
    expect(buildSystemPrompt('asm', '')).toContain('assembler');
    expect(buildSystemPrompt('gfx', '')).toContain('graphics');
    expect(buildSystemPrompt('track', '')).toContain('music tracker');
  });
});
