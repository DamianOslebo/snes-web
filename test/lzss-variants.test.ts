import { describe, expect, it } from 'vitest';
import { assemble, type AsmResult } from '../src/asm/assembler';
import { lzssGlue } from '../src/asm/lzss';
import { vramGlue, vramGlueLz, type VramBlock } from '../src/gfx/vram';
import { spcGlue, spcGlueLz } from '../src/spc/layout';

const fails = (r: AsmResult) => r.errors.map((e) => `line ${e.line}: ${e.message}`).join('; ');
const blocks: VramBlock[] = [{ dest: 0x0000, len: 1 }];

describe('vramGlueLz / spcGlueLz — the LZ glue variants', () => {
  it('raw glue stays untouched (no lz_decode)', () => {
    expect(vramGlue(0x8000, 0, blocks)).not.toContain('jsr lz_decode');
    expect(spcGlue()).not.toContain('jsr lz_decode');
  });

  it('LZ variants swap in the decode call + repoint, still raw otherwise', () => {
    const vg = vramGlueLz(0x8000, 0, blocks);
    expect(vg).toContain('jsr lz_decode');
    expect(vg).toContain('lda #$02'); // LZ_SCRATCH hi
    expect(vg).toContain('vram_blocks'); // walker still present
    expect(vg).not.toContain('  pea vram_data\n  pla\n  sta $20'); // raw block swapped out

    const sg = spcGlueLz();
    expect(sg).toContain('jsr lz_decode');
    expect(sg).toContain('sta $10'); // repointed at spc walker $10/$11
    expect(sg).toContain('spc_by'); // SPU stream loop still present
  });

  it('both Lz variants + the shared lz glue assemble cleanly', () => {
    const vram = assemble(lzssGlue() + '\n' + vramGlueLz(0x8000, 0, blocks) + '\nmydata:\n.byte 1,2,3', 0x008000, { 'vram.bin': new Uint8Array([1, 2, 3]) });
    expect(vram.ok).toBe(true);
    if (!vram.ok) throw new Error(fails(vram));

    const spc = assemble(lzssGlue() + '\n' + spcGlueLz(), 0x008000, { 'spc.bin': new Uint8Array([1, 2, 3]) });
    expect(spc.ok).toBe(true);
    if (!spc.ok) throw new Error(fails(spc));
  });
});
