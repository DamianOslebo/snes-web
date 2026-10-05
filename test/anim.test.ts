/**
 * Sprite char-swap animation — the pure glue (src/gfx/anim.ts) that makes ONE
 * sprite slot CYCLE a short sequence of char images (a walk / a flap), plus the
 * shared NMI dispatcher it feeds.
 *
 * The one fact that drives everything: a slot's OAM is TWO independent words —
 * word0 (HPos/VPos, OAMADDR = slot*2) and word1 (Name + attr, OAMADDR =
 * slot*2+1). The PPU commits each on a separate OAMDATA write (ppu.c:3052-3055,
 * :3590-3644), so writing word1 changes ONLY the 9-bit char + attr and leaves
 * word0 (the d-pad position from `spr_move`) untouched. The attr byte packs
 * Name[8] in bit0, Priority in bits 4-5, HFlip in bit6, VFlip in bit7 — the
 * SAME decode as `oam.ts`'s `encodeOamEntry`.
 *
 * `spriteAnimTables` bakes the per-frame Name/attr bytes; `spriteAnimGlue`
 * emits the two `.byte` tables + `anim_init` (park the phase, arm the NMI) +
 * `anim_tick` (the per-frame service the NMI dispatcher runs — step + wrap the
 * phase, then write Name then attr to word1). This test pins the table baking,
 * the OAMADDR-target/commit order, the phase advance+wrap, and the NMI arm.
 */
import { describe, expect, it } from 'vitest';
import { spriteAnimGlue, spriteAnimTables } from '../src/gfx/anim';
import { nmiGlue, scrollStepsFromSource } from '../src/gfx/scroll';

describe('spriteAnimTables — bake the per-frame Name + attr bytes', () => {
  it('splits each char into Name[7:0] and (Name[8] | priority | flips)', () => {
    const { names, attrs } = spriteAnimTables([1, 2, 3], 0, false, false);
    expect(names).toEqual([1, 2, 3]);
    expect(attrs).toEqual([0, 0, 0]);
  });

  it('puts the 9th char bit (Name[8]) in attr bit0', () => {
    // tile 257 = 0b1_0000_0001 → Name[7:0] = 1, Name[8] = 1.
    const { names, attrs } = spriteAnimTables([257], 0, false, false);
    expect(names).toEqual([1]);
    expect(attrs).toEqual([1]); // attr bit0 = Name[8]
  });

  it('packs priority into bits 4-5 and the flips into bits 6-7', () => {
    const { attrs } = spriteAnimTables([5], 3, true, false);
    // priority 3 → (3<<4)=0x30; flipH → (1<<6)=0x40; 0x30|0x40 = 0x70.
    expect(attrs).toEqual([0x70]);

    const { attrs: v } = spriteAnimTables([5], 1, false, true);
    // priority 1 → (1<<4)=0x10; flipV → (1<<7)=0x80; 0x10|0x80 = 0x90.
    expect(v).toEqual([0x90]);
  });
});

describe('spriteAnimGlue — the sprite char-swap service', () => {
  it('emits the two char tables and the init/tick labels', () => {
    const g = spriteAnimGlue({ tiles: [1, 2, 3, 4] });
    expect(g).toMatch(/anim_name:/);
    expect(g).toMatch(/anim_attr:/);
    expect(g).toMatch(/anim_init:/);
    expect(g).toMatch(/anim_tick:/);
    // The baked tables hold exactly the char sequence.
    expect(g).toMatch(/anim_name:\s*\.byte \$01, \$02, \$03, \$04/);
    expect(g).toMatch(/anim_attr:\s*\.byte \$00, \$00, \$00, \$00/);
  });

  it('parks the phase at 0 and arms the once-per-vblank NMI in anim_init', () => {
    const g = spriteAnimGlue({ tiles: [1, 2] });
    expect(g).toMatch(/anim_init:/);
    // The phase ($32) and divider ($33) are zeroed BEFORE the first frame.
    expect(g).toMatch(/sta \$32/);
    expect(g).toMatch(/sta \$33/);
    // NMITIMEN bit7 armed (NMI once per vblank). The vector is baked at
    // nmi_move by the build, so there is NO runtime sta $fffe/$ffff here.
    expect(g).toMatch(/lda #\$80[\s\S]*?sta \$4200/);
    expect(g).not.toMatch(/sta \$fffe/i);
    expect(g).not.toMatch(/sta \$ffff/i);
  });

  it('writes OAMADDR to word1 (slot*2+1) low-then-high(0), then Name then attr to $2104', () => {
    const g = spriteAnimGlue({ tiles: [1, 2, 3], slot: 0 });
    // word1 of slot 0 = 1. OAMADDR low = 1, then high = 0.
    expect(g).toMatch(/lda #1[\s\S]*?sta \$2102[\s\S]*?lda #0[\s\S]*?sta \$2103/);
    // Name byte first, then the attr byte — that is what commits word1.
    const nameWrite = g.indexOf('anim_name,X');
    const attrWrite = g.indexOf('anim_attr,X');
    expect(nameWrite).toBeGreaterThan(-1);
    expect(attrWrite).toBeGreaterThan(nameWrite);
    // Both land on $2104.
    expect((g.match(/sta \$2104/g) ?? []).length).toBe(2);
  });

  it('targets the right slot: word1 = slot*2+1', () => {
    expect(spriteAnimGlue({ tiles: [1, 2], slot: 5 })).toMatch(/lda #11[\s\S]*?sta \$2102/);
    expect(spriteAnimGlue({ tiles: [1, 2], slot: 3 })).toMatch(/lda #7[\s\S]*?sta \$2102/);
  });

  it('advances the phase once every `skip` ticks and wraps at K', () => {
    const g = spriteAnimGlue({ tiles: [1, 2, 3, 4], skip: 4 });
    // The divider is incremented and compared to the skip value…
    expect(g).toMatch(/inc \$33[\s\S]*?cmp #4/);
    // …and the char index is advanced (+1) and wrapped when it reaches K (4).
    expect(g).toMatch(/lda \$32[\s\S]*?clc[\s\S]*?adc #1[\s\S]*?cmp #4/);
    expect(g).toMatch(/anim_nowrap:/);
  });

  it('never READS a PPU register (OpenBus garbage) — all PPU writes are absolute', () => {
    const g = spriteAnimGlue({ tiles: [1, 2] });
    // No `lda` from any PPU register window ($21xx) — only writes (sta) to it.
    expect(g).not.toMatch(/lda \$21[0-9a-f][0-9a-f]/i);
    // The char tables are read from ROM via X-index (valid), not a PPU read.
    expect(g).toMatch(/lda anim_name,X/);
    expect(g).toMatch(/lda anim_attr,X/);
  });
});

describe('the shared NMI dispatcher folds in the sprite char-swap tick', () => {
  it('detects anim_tick when its glue is present (label, not a jsr-mention)', () => {
    const g = spriteAnimGlue({ tiles: [1, 2, 3] });
    expect(scrollStepsFromSource(g)).toEqual(['anim_tick']);
    expect(scrollStepsFromSource('reset:\n  jsr anim_tick')).toEqual([]);
  });

  it('composes with the d-pad sprite tick: ONE handler dispatches both, then rti', () => {
    const g = nmiGlue(['spr_move', 'anim_tick']);
    expect(g).toMatch(/nmi_move:\s*jsr spr_move\s*\n\s*jsr anim_tick\s*\n\s*rti/);
    expect((g.match(/nmi_move:/g) ?? []).length).toBe(1);
    expect(g).toMatch(/\brti\s*$/);
  });

  it('a ROM with scroll + d-pad + char-swap gets ONE handler running all three', () => {
    const steps = scrollStepsFromSource(
      'bg_scroll:\n  rts\nspr_move:\n  rts\n' + spriteAnimGlue({ tiles: [1, 2] }),
    );
    expect(steps).toEqual(['bg_scroll', 'spr_move', 'anim_tick']);
    const g = nmiGlue(steps);
    expect(g).toMatch(/nmi_move:\s*jsr bg_scroll\s*\n\s*jsr spr_move\s*\n\s*jsr anim_tick\s*\n\s*rti/);
  });
});
