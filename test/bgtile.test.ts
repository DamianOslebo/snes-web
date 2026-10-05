/**
 * `bgtile` — pure glue/dispatcher contracts for the BG tile water/fire colour
 * animation (src/gfx/bgtile.ts). Mirrors test/anim.test.ts and
 * test/mode7.test.ts: the glue is pure 65C816 TEXT, so we assert on the
 * generated source (the labels, the register writes, the byte order, the table
 * shape) rather than booting a core. The real-PPU proof — the animated tile
 * actually changing colour on screen — is in test/bgtile-core.test.ts.
 *
 * The one fact that drives everything: a background tile pixel's sub-palette
 * index reads CGRAM slot = (palette bits) + StartPalette + Pix (tile.c:1032 +
 * GFX.ScreenColors[Pix]); and a CGDATA write updates that exact array (ppu.c
 * :2853-2902). So a tile whose hot pixels all point at ONE CGRAM slot renders
 * as whatever colour that slot holds *right now*, and rewriting that slot
 * every frame — the classic water/fire — animates the tile with the tilemap
 * and the tile's own bitmap untouched. This test pins the lo/hi colour bake,
 * the $2121/$2122 write order (slot → low → high), the index advance+wrap, and
 * the NMI arm-once — the same shape as the sprite char-swap and Mode 7 tests.
 */
import { describe, expect, it } from 'vitest';
import { bgTileAnimGlue, bgTileAnimTables } from '../src/gfx/bgtile';
import { nmiGlue, scrollStepsFromSource } from '../src/gfx/scroll';

describe('bgTileAnimTables — bake the lo/hi byte split of each 15-bit colour', () => {
  it('splits each colour into its low byte and 7-bit high byte', () => {
    // 0x7fff (white): lo 0xff, hi 0x7f.  0x0000 (black): lo 0x00, hi 0x00.
    const { lo, hi } = bgTileAnimTables([0x7fff, 0x0000]);
    expect(lo).toEqual([0xff, 0x00]);
    expect(hi).toEqual([0x7f, 0x00]);
  });

  it('keeps the low 8 bits in `lo` and bits 8-14 in `hi`', () => {
    // 0x2100: bits 8-9 are 0b10 → hi = 0x21 & 0x7f = 0x21; low byte = 0x00.
    const { lo, hi } = bgTileAnimTables([0x2100]);
    expect(lo).toEqual([0x00]);
    expect(hi).toEqual([0x21]);
  });

  it('both tables are the same length, indexed by the colour index', () => {
    const { lo, hi } = bgTileAnimTables([0x1234, 0x5678, 0x0f0f]);
    expect(lo.length).toBe(3);
    expect(hi.length).toBe(3);
    expect(lo).toEqual([0x34, 0x78, 0x0f]);
    expect(hi).toEqual([0x12, 0x56, 0x0f]);
  });

  it('every baked byte is a single byte (fits the .byte table + $2122 write)', () => {
    for (const c of [0x0000, 0x7fff, 0x4000, 0x0001, 0x2100, 0x7c00]) {
      const { lo, hi } = bgTileAnimTables([c]);
      expect(lo[0]).toBeGreaterThanOrEqual(0);
      expect(lo[0]).toBeLessThanOrEqual(0xff);
      expect(hi[0]).toBeGreaterThanOrEqual(0);
      expect(hi[0]).toBeLessThanOrEqual(0x7f);
    }
  });
});

describe('bgTileAnimGlue — the BG tile water/fire service', () => {
  const g = bgTileAnimGlue({ frames: [0x7fff, 0x4210, 0x2108, 0x0000], cgramSlot: 1, speed: 4 });

  it('emits the two colour tables and the init/tick labels', () => {
    expect(g).toMatch(/^bgtile_lo:\s*$/m);
    expect(g).toMatch(/^bgtile_hi:\s*$/m);
    expect(g).toMatch(/^bgtile_init:\s*$/m);
    expect(g).toMatch(/^bgtile_tick:\s*$/m);
    // The baked tables hold the lo/hi of the colour sequence, in order.
    // lo: 0x7fff→0xff, 0x4210→0x10, 0x2108→0x08, 0x0000→0x00
    // hi: 0x7fff→0x7f, 0x4210→0x42, 0x2108→0x21, 0x0000→0x00
    expect(g).toMatch(/bgtile_lo:\s*\.byte \$ff, \$10, \$08, \$00/);
    expect(g).toMatch(/bgtile_hi:\s*\.byte \$7f, \$42, \$21, \$00/);
  });

  it('parks the index + divider at 0 and arms the once-per-vblank NMI in bgtile_init', () => {
    expect(g).toMatch(/bgtile_init:/);
    // The index ($3a) and divider ($3b) are zeroed BEFORE the first frame.
    expect(g).toMatch(/sta \$3a/);
    expect(g).toMatch(/sta \$3b/);
    // NMITIMEN bit7 armed (NMI once per vblank). The vector is baked at
    // nmi_move by the build, so there is NO runtime sta $fffe/$ffff here.
    expect(g).toMatch(/lda #\$80[\s\S]*?sta \$4200/);
    expect(g).not.toMatch(/sta \$fffe/i);
    expect(g).not.toMatch(/sta \$ffff/i);
  });

  it('writes the CGRAM slot (low-then-high colour), never clobbering the tilemap', () => {
    expect(g).toMatch(/bgtile_tick:/);
    // Slot 1 into CGADD=$2121 first, then the colour low byte to $2122, then
    // the colour high byte to $2122 — that is the commit that changes the
    // slot's colour (and with it the tile pixels that read it).
    expect(g).toMatch(/lda #1[\s\S]*?sta \$2121/);
    // Two CGDATA writes ($2122) — low then high — each fed by its table byte.
    expect((g.match(/sta \$2122/g) ?? []).length).toBe(2);
    expect(g).toMatch(/lda bgtile_lo,X[\s\S]*?sta \$2122/);
    expect(g).toMatch(/lda bgtile_hi,X[\s\S]*?sta \$2122/);
    // The low byte is written BEFORE the high byte (the commit order).
    expect(g.indexOf('lda bgtile_lo,X')).toBeLessThan(g.indexOf('lda bgtile_hi,X'));
  });

  it('targets the requested CGRAM slot in CGADD ($2121)', () => {
    expect(bgTileAnimGlue({ frames: [1, 2], cgramSlot: 1 })).toMatch(/lda #1[\s\S]*?sta \$2121/);
    expect(bgTileAnimGlue({ frames: [1, 2], cgramSlot: 9 })).toMatch(/lda #9[\s\S]*?sta \$2121/);
    expect(bgTileAnimGlue({ frames: [1, 2], cgramSlot: 31 })).toMatch(/lda #31[\s\S]*?sta \$2121/);
  });

  it('advances the index once every `speed` ticks and wraps at K', () => {
    // 4 frames, speed 3: the divider counts to 3 before an advance, and the
    // index (+1) wraps when it reaches 4 (K). Kept distinct so both `cmp`s are
    // unambiguous.
    const g2 = bgTileAnimGlue({ frames: [1, 2, 3, 4], cgramSlot: 1, speed: 3 });
    expect(g2).toMatch(/inc \$3b[\s\S]*?cmp #3/); // divider → skip (3)
    expect(g2).toMatch(/lda \$3a[\s\S]*?clc[\s\S]*?adc #1[\s\S]*?cmp #4/); // index → K (4)
    expect(g2).toMatch(/bt_nowrap:/);
  });

  it('never READS a PPU register (OpenBus garbage) — all PPU writes are absolute', () => {
    const g2 = bgTileAnimGlue({ frames: [1, 2] });
    // No `lda`/`ldx`/`ldy` from any PPU register window ($21xx) — only writes.
    expect(g2).not.toMatch(/lda \$21[0-9a-f][0-9a-f]/i);
    expect(g2).not.toMatch(/ldx \$21[0-9a-f][0-9a-f]/i);
    expect(g2).not.toMatch(/ldy \$21[0-9a-f][0-9a-f]/i);
    // The colour tables are read from ROM via X-index (valid), not a PPU read.
    expect(g2).toMatch(/lda bgtile_lo,X/);
    expect(g2).toMatch(/lda bgtile_hi,X/);
  });
});

describe('the shared NMI dispatcher folds in the BG tile water/fire tick', () => {
  it('detects bgtile_tick when its glue is present (label, not a jsr-mention)', () => {
    const g = bgTileAnimGlue({ frames: [1, 2, 3] });
    expect(scrollStepsFromSource(g)).toEqual(['bgtile_tick']);
    expect(scrollStepsFromSource('reset:\n  jsr bgtile_tick')).toEqual([]);
  });

  it('composes with the other services: ONE handler dispatches all, then rti', () => {
    const g = nmiGlue(['bg_scroll', 'spr_move', 'anim_tick', 'mode7_tick', 'bgtile_tick']);
    expect(g).toMatch(/nmi_move:/);
    const order = (l: string) => g.indexOf(`jsr ${l}`);
    expect(order('bg_scroll')).toBeLessThan(order('spr_move'));
    expect(order('spr_move')).toBeLessThan(order('anim_tick'));
    expect(order('anim_tick')).toBeLessThan(order('mode7_tick'));
    expect(order('mode7_tick')).toBeLessThan(order('bgtile_tick'));
    expect((g.match(/nmi_move:/g) ?? []).length).toBe(1);
    expect(g).toMatch(/\brti\s*$/);
  });

  it('a ROM with scroll + d-pad + char-swap + mode7 + water gets ONE handler running all five', () => {
    const steps = scrollStepsFromSource(
      'bg_scroll:\n  rts\nspr_move:\n  rts\n' +
      bgTileAnimGlue({ frames: [1, 2] }),
    );
    expect(steps).toEqual(['bg_scroll', 'spr_move', 'bgtile_tick']);
    const g = nmiGlue(steps);
    expect(g).toMatch(/nmi_move:\s*jsr bg_scroll\s*\n\s*jsr spr_move\s*\n\s*jsr bgtile_tick\s*\n\s*rti/);
  });
});
