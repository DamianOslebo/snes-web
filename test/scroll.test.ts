/**
 * BG0 scroll toolchain — the pure glue (src/gfx/scroll.ts) that makes a
 * background SCROLL, plus the shared NMI dispatcher.
 *
 * The one fact that drives everything: SNES scroll is a pair of SEPARATE
 * two-byte registers — $210D (HOffset) and $210E (VOffset) — written LOW byte
 * first then HIGH byte, and the two are NOT interleaved (they share the PPU's
 * OFS low-byte latch). So one scroll step is H then 0 to $210D, then V then 0
 * to $210E. The position is held in two 8-bit zero-page counters ($2e/$2f) and
 * advanced ONCE PER FRAME by the NMI — the same pacemaker the d-pad sprite
 * uses. Scroll is written as ABSOLUTE values (this core returns OpenBus garbage
 * on PPU reads, so there is no read-modify-write) and never touches $2107.
 *
 * Because a ROM has exactly ONE NMI vector, the once-per-frame services (the
 * scroll tick and the sprite tick) share a single handler: `nmiGlue` emits it,
 * and `scrollStepsFromSource` recomputes (purely, order-independently) which
 * services are present. This test pins the write protocol, the NMI arm, the
 * per-sign counter advance, and the dispatcher composition.
 */
import { describe, expect, it } from 'vitest';
import { bgScrollGlue, nmiGlue, scrollStepsFromSource } from '../src/gfx/scroll';

describe('bgScrollGlue — the BG0 scroll service', () => {
  it('parks the scroll at the origin and arms the once-per-vblank NMI in bg_scroll_init', () => {
    const g = bgScrollGlue({ dx: 2, dy: 1 });
    expect(g).toMatch(/bg_scroll_init:/);
    // The two 8-bit counters are zeroed BEFORE the first frame.
    expect(g).toMatch(/sta \$2e/);
    expect(g).toMatch(/sta \$2f/);
    // NMITIMEN bit7 armed (NMI once per vblank). The vector is baked at
    // nmi_move by the build, so there is NO runtime sta $fffe/$ffff here.
    expect(g).toMatch(/lda #\$80[\s\S]*?sta \$4200/);
    expect(g).not.toMatch(/sta \$fffe/i);
    expect(g).not.toMatch(/sta \$ffff/i);
  });

  it('writes the ABSOLUTE offsets to $210D then $210E — low byte first, then high (0), never interleaved', () => {
    const g = bgScrollGlue({ dx: 2, dy: 1 });
    // Each register is written exactly twice (low byte, then high byte), and
    // the whole H pair comes BEFORE the V pair (they must not interleave).
    expect((g.match(/sta \$210d/g) ?? []).length).toBe(2);
    expect((g.match(/sta \$210e/g) ?? []).length).toBe(2);
    expect(g.lastIndexOf('sta $210d')).toBeLessThan(g.indexOf('sta $210e'));
    // H: low byte from the $2e counter, then a literal 0 high byte.
    // V: low byte from the $2f counter, then a literal 0 high byte.
    expect(g).toMatch(/lda \$2e[\s\S]*?sta \$210d[\s\S]*?lda #0[\s\S]*?sta \$210d/);
    expect(g).toMatch(/lda \$2f[\s\S]*?sta \$210e[\s\S]*?lda #0[\s\S]*?sta \$210e/);
  });

  it('advances the counters per-sign: positive delta → adc, negative → sbc', () => {
    // Both positive: H += 2, V += 1. The delta is a TRUE immediate (`adc #$nn`,
    // opcode 69) — NOT `adc $nn` (zero-page, opcode 65), which would add whatever
    // happens to sit in that RAM byte instead of the literal step.
    const up = bgScrollGlue({ dx: 2, dy: 1 });
    expect(up).toMatch(/lda \$2e[\s\S]*?clc[\s\S]*?adc #\$02[\s\S]*?sta \$2e/); // H += 2
    expect(up).toMatch(/lda \$2f[\s\S]*?clc[\s\S]*?adc #\$01[\s\S]*?sta \$2f/); // V += 1
    expect(up).not.toMatch(/\bsbc\b/); // no subtraction when both deltas are positive

    // dx negative, dy positive: H decrements (sbc), V still increments (adc).
    const down = bgScrollGlue({ dx: -3, dy: 1 });
    expect(down).toMatch(/lda \$2e[\s\S]*?sec[\s\S]*?sbc #\$03[\s\S]*?sta \$2e/); // H -= 3
    expect(down).toMatch(/lda \$2f[\s\S]*?clc[\s\S]*?adc #\$01[\s\S]*?sta \$2f/); // V += 1
  });

  it('never WRITES $2107 (BG0SC size/base) — the bring-up SCBase stays valid', () => {
    // The header comment may name $2107 to say it is left alone; the code must
    // never `sta` it (that is the bring-up glue's job, and writing it mid-frame
    // could re-home the tilemap).
    expect(bgScrollGlue({ dx: 2, dy: 2 })).not.toMatch(/sta \$2107/i);
  });
});

describe('nmiGlue — the single shared NMI handler', () => {
  it('emits no handler for an empty service list', () => {
    expect(nmiGlue([])).toBe('');
  });

  it('sprite-only: nmi_move dispatches exactly spr_move', () => {
    const g = nmiGlue(['spr_move']);
    // Scope to the handler BODY (after the label) so the explanatory header
    // comment (which names both services) does not interfere.
    const body = g.slice(g.indexOf('nmi_move:'));
    expect(body).toMatch(/nmi_move:\s*jsr spr_move\s*rti/);
    expect(body).not.toMatch(/bg_scroll/);
  });

  it('scroll-only: nmi_move dispatches exactly bg_scroll', () => {
    const g = nmiGlue(['bg_scroll']);
    const body = g.slice(g.indexOf('nmi_move:'));
    expect(body).toMatch(/nmi_move:\s*jsr bg_scroll\s*rti/);
    expect(body).not.toMatch(/spr_move/);
  });

  it('BOTH services: ONE handler dispatches bg_scroll then spr_move', () => {
    const g = nmiGlue(['bg_scroll', 'spr_move']);
    expect(g).toMatch(/nmi_move:\s*jsr bg_scroll\s*\n\s*jsr spr_move\s*\n\s*rti/);
    // Exactly one handler, and it ends in rti.
    expect((g.match(/nmi_move:/g) ?? []).length).toBe(1);
    expect(g).toMatch(/\brti\s*$/);
  });
});

describe('scrollStepsFromSource — which once-per-frame services are active', () => {
  it('none in an empty source', () => {
    expect(scrollStepsFromSource('')).toEqual([]);
  });

  it('detects bg_scroll when its glue is present', () => {
    expect(scrollStepsFromSource(bgScrollGlue({ dx: 2, dy: 2 }))).toEqual(['bg_scroll']);
  });

  it('detects spr_move when its glue is present (label at line start)', () => {
    expect(scrollStepsFromSource('spr_init:\n  lda #0\nspr_move:\n  lda $4219')).toEqual(['spr_move']);
  });

  it('detects both, in dispatch order (bg_scroll then spr_move)', () => {
    const src = bgScrollGlue({ dx: 1, dy: 1 }) + '\nspr_move:\n  lda $4219\n  and #$0f';
    expect(scrollStepsFromSource(src)).toEqual(['bg_scroll', 'spr_move']);
  });

  it('a `jsr <label>` or a mention is NOT a definition', () => {
    const src = 'reset:\n  jsr bg_scroll\n  ; and spr_move is also just mentioned here';
    expect(scrollStepsFromSource(src)).toEqual([]);
  });
});
