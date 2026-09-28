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
      expect(p).toContain('$4218');
      expect(p).toContain('$4219');
      expect(p).toContain('and #$80');
      expect(p).not.toContain('active-LOW');
      expect(p).toContain('STATE: 1 tile, 2 files');
    }
  });

  it('offers the d-pad sprite service and stops claiming movement is out of scope', () => {
    for (const page of ['asm', 'gfx'] as const) {
      const p = buildSystemPrompt(page, '');
      expect(p).toContain('spr_init');
      expect(p).toContain('spr_move');
      expect(p).toContain('SLOT 0'); // the movable sprite is OAM slot 0
      // A "circle" from background tiles is the exact failure from the d-pad
      // log — the prompt must call it out as a mistake.
      expect(p).toContain('Faking a sprite with background tiles');
      // The old scope line ("static positions … moving sprites not in v1") is gone.
      expect(p).not.toMatch(/static positions/i);
      expect(p).not.toMatch(/moving sprites (?:are )?not (?:in|supported)/i);
    }
  });

  it('names the page the panel is mounted on', () => {
    expect(buildSystemPrompt('asm', '')).toContain('assembler');
    expect(buildSystemPrompt('gfx', '')).toContain('graphics');
    expect(buildSystemPrompt('track', '')).toContain('music tracker');
  });
});
