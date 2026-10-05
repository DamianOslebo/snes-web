/**
 * `mode7` — core-free glue/dispatcher contracts for the Mode 7 (BG1 affine)
 * per-frame background. Mirrors test/scroll.test.ts / test/anim.test.ts: the
 * glue is pure 65C816 TEXT, so we assert on the generated source (the labels,
 * the register writes, the byte order, the table shape) rather than booting a
 * core. The real-PPU proof — the field actually zooms on screen — is in
 * test/mode7-core.test.ts.
 *
 * The contract: `mode7_init` streams the 32 KB field from the ROM HIGH BANK
 * (CPU bank $01, base $8000) into VRAM with the 0xBF `lda $01:8000,X`
 * Absolute-Long-Indexed-X sweep (16-bit X via rep/sep #$02), paints
 * CGRAM[0]=black / CGRAM[1]=white, enables Mode 7 (BGMODE=7, repeat, Nomath,
 * TM bit 0), pins the centre + offsets, writes the initial matrix, un-blanks,
 * and arms the once-per-vblank NMI. `mode7_tick` (run by the NMI dispatcher)
 * steps the table index and writes A/B/C/D lo-then-hi to $211b–$211e. No
 * trig, no 16-bit multiply in asm — the matrix is precomputed in TS and baked
 * as a byte table; the 65C816 only steps an index and blits bytes.
 */
import { describe, it, expect } from 'vitest';
import {
  mode7FieldBytes,
  mode7MatrixTable,
  mode7Glue,
  MODE7_FIELD_WORDS,
} from '../src/gfx/mode7';
import { nmiGlue, scrollStepsFromSource } from '../src/gfx/scroll';

// The generated glue annotates each `lda` with an inline `; comment` on the
// SAME line before the `sta` it feeds (e.g. `lda #$80   ; VMAIN...` \n `sta
// $2115`), so a plain `lda #X\s*sta $Y` can't match. This matcher allows
// whitespace OR one trailing comment between the load and its store, keeping
// the pairing tight (it cannot skip over intervening code lines).
const loadStore = (imm: string, addr: string): RegExp =>
  new RegExp(`lda #${imm.replace(/\$/g, '\\$')}\\s*(?:;[^\\n]*)?\\s*sta \\$${addr}`, 's');

describe('mode7FieldBytes — the 32 KB parity-interleaved checker field', () => {
  const f = mode7FieldBytes();

  it('is exactly 32 KB (16 384 VRAM words)', () => {
    expect(f.length).toBe(32768);
    expect(MODE7_FIELD_WORDS).toBe(16384);
  });

  it('char 0 (white): every colour byte on odd 1..127 is 1', () => {
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      expect(f[1 + r * 16 + c * 2]).toBe(1);
    }
    expect(f[1]).toBe(1);
    expect(f[127]).toBe(1);
  });

  it('char 1 (transparent): every colour byte on odd 129..255 is 0', () => {
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      expect(f[129 + r * 16 + c * 2]).toBe(0);
    }
    expect(f[129]).toBe(0);
    expect(f[255]).toBe(0);
  });

  it('NAME table (even bytes) is a checkerboard of char 0 / char 1', () => {
    expect(f[0]).toBe(0); // R=0,C=0 → (0^0)&1 = 0
    expect(f[2]).toBe(0); // R=0,C=1 → (0^0)&1 = 0
    expect(f[4]).toBe(1); // R=0,C=2 → (0^1)&1 = 1
    expect(f[256 * 2 + 0]).toBe(1); // R=2,C=0 → (1^0)&1 = 1
    expect(f[256 * 2 + 2]).toBe(1); // R=2,C=1 → (1^0)&1 = 1
    // Both chars must actually be referenced somewhere in the field.
    let has0 = false, has1 = false;
    for (let i = 0; i < f.length; i += 2) {
      if (f[i] === 0) has0 = true;
      else if (f[i] === 1) has1 = true;
    }
    expect(has0).toBe(true);
    expect(has1).toBe(true);
  });
});

describe('mode7MatrixTable — the precomputed per-frame A/B/C/D', () => {
  it('zoom in: A=D grow from 0.5× to 2.0×, B=C stay 0', () => {
    const t = mode7MatrixTable('zoom', 'in', 60);
    expect(t.length).toBe(60);
    expect(t[0]).toEqual({ A: 128, B: 0, C: 0, D: 128 }); // 256 * 0.5
    // The end of the cycle is the largest scale (zoom in = the field grows).
    expect(t[59].A).toBeGreaterThan(t[0].A);
    expect(t[59].D).toBe(t[59].A);
    for (const e of t) {
      expect(e.B).toBe(0);
      expect(e.C).toBe(0);
      expect(e.A).toBe(e.D);
    }
  });

  it('zoom out: A=D shrink from 2.0× to 0.5×', () => {
    const t = mode7MatrixTable('zoom', 'out', 60);
    expect(t[0]).toEqual({ A: 512, B: 0, C: 0, D: 512 }); // 256 * 2.0
    expect(t[59].A).toBeLessThan(t[0].A);
  });

  it('rotate cw: one full turn — A=D=256cos θ, B=−256sin θ, C=256sin θ', () => {
    const t = mode7MatrixTable('rotate', 'cw', 60);
    expect(t.length).toBe(60);
    expect(t[0]).toEqual({ A: 256, B: 0, C: 0, D: 256 }); // θ=0
    expect(t[15]).toEqual({ A: 0, B: 0xff00, C: 256, D: 0 }); // θ=90° → B=−256 (0xff00)
    expect(t[30]).toEqual({ A: 0xff00, B: 0, C: 0, D: 0xff00 }); // θ=180° → A=D=−256 (0xff00)
  });

  it('rotate ccw: B is the negative of cw (opposite spin)', () => {
    const cw = mode7MatrixTable('rotate', 'cw', 60);
    const ccw = mode7MatrixTable('rotate', 'ccw', 60);
    // At 90°: cw B = -256 (0xff00), ccw B = +256; C swaps sign the same way.
    expect(cw[15].B).toBe(0xff00);
    expect(ccw[15].B).toBe(256);
    expect(cw[15].C).toBe(256);
    expect(ccw[15].C).toBe(0xff00);
  });

  it('every entry is a 16-bit word (fits the lo/hi PPU writes)', () => {
    for (const e of mode7MatrixTable('rotate', 'cw', 64)) {
      for (const v of [e.A, e.B, e.C, e.D]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(0xffff);
      }
    }
  });
});

describe('mode7Glue — the 65C816 bring-up + per-frame service', () => {
  const g = mode7Glue({ kind: 'zoom', dir: 'in', speed: 60 });

  it('defines the three labels', () => {
    expect(g).toMatch(/^mode7_init:\s*$/m);
    expect(g).toMatch(/^mode7_tick:\s*$/m);
    expect(g).toMatch(/^mode7_matrix:\s*$/m);
  });

  it('sets up the VRAM write path (VMAIN + VMADD, forced-blank first)', () => {
    expect(g).toMatch(loadStore('$80', '2115')); // VMAIN = high byte + auto-inc
    expect(g).toMatch(/sta \$2116/); // VMADDL = 0
    expect(g).toMatch(/sta \$2117/); // VMADDH = 0
    expect(g).toMatch(loadStore('$80', '2100')); // INIDISP forced-blank
  });

  it('uses the 0xBF sweep from bank $01 with 16-bit X (rep/sep #$02)', () => {
    expect(g).toMatch(/lda \$01:8000,X/);
    expect(g).toMatch(/sta \$2118/); // VRAMDATA low byte
    expect(g).toMatch(/sta \$2119/); // VRAMDATA high byte
    expect(g).toMatch(/rep #\$02/);
    expect(g).toMatch(/ldx #\$0000/); // 16-bit X immediate (2 bytes)
    expect(g).toMatch(/sep #\$02/);
  });

  it('counts 16 384 words with a 16-bit counter ($38/$39)', () => {
    expect(g).toMatch(loadStore('$00', '38')); // counter lo = 0x0000
    expect(g).toMatch(loadStore('$40', '39')); // counter hi = 0x40 → 0x4000
    expect(g).toMatch(/dec \$38/);
    expect(g).toMatch(/bne m7_field/);
    expect(g).toMatch(/dec \$39/);
  });

  it('paints CGRAM[0]=black, CGRAM[1]=white via $2121/$2122', () => {
    expect(g).toMatch(/sta \$2121/); // CGADD = 0
    expect(g).toMatch(/sta \$2122/); // the colour bytes
    // colour 1 = white (15-bit full on): $ff (lo) then $7f (hi).
    expect(g).toMatch(loadStore('$ff', '2122'));
    expect(g).toMatch(loadStore('$7f', '2122'));
  });

  it('enables Mode 7: BGMODE=7, M7SEL repeat, MATH=0 (Nomath), TM bit 0', () => {
    expect(g).toMatch(loadStore('$07', '2105')); // BGMODE = 7
    expect(g).toMatch(loadStore('$40', '211a')); // M7SEL bit 6 = repeat
    expect(g).toMatch(loadStore('$00', '2131')); // MATH bit 0 = 0 (Nomath)
    expect(g).toMatch(loadStore('$01', '212c')); // TM bit 0 = BG1 on
  });

  it('pins the centre + offsets lo-then-hi (each written twice)', () => {
    for (const [addr, count] of [
      ['210d', 2], // M7HOFS = 384
      ['210e', 2], // M7VOFS = 400
      ['211f', 2], // M7X = 512
      ['2120', 2], // M7Y = 512
    ]) {
      expect((g.match(new RegExp(`sta \\$${addr}`, 'g')) || []).length).toBe(count);
    }
  });

  it('writes the initial matrix, un-blanks, and arms the NMI once', () => {
    expect(g).toMatch(loadStore('0', '34')); // table index = 0
    expect(g).toMatch(/jsr mode7_matrix/);
    expect(g).toMatch(loadStore('$0f', '2100')); // un-blank + full brightness
    // The NMI is armed EXACTLY once (NMITIMEN bit 7 = $80 → $4200).
    expect((g.match(/sta \$4200/g) || []).length).toBe(1);
    expect(g).toMatch(loadStore('$80', '4200'));
  });

  it('does not bake the NMI vector here (that is rom.ts / the build)', () => {
    expect(g).not.toMatch(/sta \$fffe/);
    expect(g).not.toMatch(/sta \$ffff/);
  });

  it('mode7_tick steps + wraps the index, then jsrs mode7_matrix and rts', () => {
    expect(g).toMatch(/mode7_tick:/);
    expect(g).toMatch(/inc \$34/);
    expect(g).toMatch(/cmp #60/); // wraps at `speed` frames
    expect(g).toMatch(/sta \$34/);
    expect(g).toMatch(/jsr mode7_matrix/);
    // mode7_tick is a JSR-called service (nmi_move calls it), so it ends with
    // the return-from-subroutine — the interrupt-return lives in nmi_move
    // itself (the actual NMI handler, emitted by nmiGlue), not here.
    expect(g).toMatch(/mode7_tick:[\s\S]*?rts/);
    expect(g).not.toMatch(/rti/i); // no interrupt-return inside the glue
  });

  it('mode7_matrix reads the 8 table arrays via X and writes A/B/C/D lo-then-hi', () => {
    expect(g).toMatch(/mode7_matrix:/);
    expect(g).toMatch(/lda \$34\s*tax/s); // X = table index
    // A/B/C/D each written low then high to $211b/$211c/$211d/$211e.
    for (const [arr, addr] of [
      ['mode7_Alo', '211b'],
      ['mode7_Blo', '211c'],
      ['mode7_Clo', '211d'],
      ['mode7_Dlo', '211e'],
    ]) {
      expect(g).toMatch(new RegExp(`lda ${arr},X\\s*sta \\$${addr}`));
      expect(g).toMatch(new RegExp(`lda ${arr.replace('Lo', 'Hi')},X\\s*sta \\$${addr}`));
    }
  });

  it('bakes the 8 table arrays (one .byte line each, `speed` entries)', () => {
    for (const name of ['mode7_Alo', 'mode7_Ahi', 'mode7_Blo', 'mode7_Bhi', 'mode7_Clo', 'mode7_Chi', 'mode7_Dlo', 'mode7_Dhi']) {
      const re = new RegExp(`^${name}:\n  \\.byte (.*)$`, 'm');
      const m = g.match(re);
      expect(m, `${name} table present`).toBeTruthy();
      expect(m![1].split(',').length).toBe(60); // one byte per cycle frame
    }
  });

  it('never READS a PPU register (all PPU access is absolute writes)', () => {
    expect(g).not.toMatch(/lda \$21[0-9a-f][0-9a-f]/i);
    expect(g).not.toMatch(/ldx \$21[0-9a-f][0-9a-f]/i);
    expect(g).not.toMatch(/ldy \$21[0-9a-f][0-9a-f]/i);
  });
});

describe('NMI dispatcher — mode7_tick is a first-class service', () => {
  it('scrollStepsFromSource detects mode7_tick', () => {
    const steps = scrollStepsFromSource(mode7Glue({ kind: 'zoom', dir: 'in' }));
    expect(steps).toContain('mode7_tick');
  });

  it('nmiGlue composes the single nmi_move that runs mode7_tick', () => {
    const nmi = nmiGlue(['mode7_tick']);
    expect(nmi).toMatch(/^nmi_move:\s*$/m);
    expect(nmi).toMatch(/jsr mode7_tick/);
    expect(nmi).toMatch(/rti/);
  });

  it('composes with the other services in dispatch order', () => {
    const nmi = nmiGlue(['bg_scroll', 'spr_move', 'anim_tick', 'mode7_tick']);
    const order = (l: string) => nmi.indexOf(`jsr ${l}`);
    expect(order('bg_scroll')).toBeLessThan(order('spr_move'));
    expect(order('spr_move')).toBeLessThan(order('anim_tick'));
    expect(order('anim_tick')).toBeLessThan(order('mode7_tick'));
    expect(nmi.match(/rti/g)!.length).toBe(1);
  });
});
