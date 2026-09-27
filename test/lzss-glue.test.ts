/**
 * `lzss-glue` — prove the generated 65C816 `lz_decode` glue (src/asm/lzss.ts)
 * assembles under the repo assembler's opcode subset and is internally
 * consistent. Core-free: no snes9x, no wasm. The real-silicon proof of the
 * decoder's correctness is `test/lzss-core.test.ts`.
 *
 * The repo assembler's `opcode.ts` is a pure-8-bit 5A22 table (no PEX/MVP/MVN).
 * `lz_decode` is written to use ONLY that table (the BRR/spc/vram glue house
 * pattern — "pure 8-bit mode, no REP/SEP"), so this test asserts the subset
 * discipline actually holds: every instruction the glue emits must resolve.
 */
import { describe, expect, it } from 'vitest';

import { assemble, type AsmResult } from '../src/asm/assembler';
import {
  LZ_ROUTINE_BYTES,
  LZSS_MAGIC,
  lzDecodeCall,
  lzRepoint,
  lzssCompress,
  lzssGlue,
  lzssDecompress,
} from '../src/asm/lzss';

const fails = (r: AsmResult): string =>
  r.errors.map((e) => `line ${e.line}: ${e.message}`).join('; ');

describe('lzssGlue() — the lz_decode routine', () => {
  const glue = lzssGlue();

  it('assembles cleanly under the repo opcode subset', () => {
    const r = assemble(glue, 0x008000);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error(fails(r));
    expect(r.bytes.length).toBeGreaterThan(20);
    expect(r.bytes.length).toBeLessThan(512); // a compact decoder, not a library
  });

  it('exposes the lz_decode label at its assembled address', () => {
    const r = assemble(glue, 0x008000);
    expect(r.ok).toBe(true);
    const label = r.labels.find((l) => l.name === 'lz_decode');
    expect(label).toBeTruthy();
    expect(label!.address & 0xffffff).toBe(0x008000); // first label at origin
  });

  it('contains exactly one lz_decode label (the upsert guard relies on this)', () => {
    expect((glue.match(/^lz_decode:/gm) ?? []).length).toBe(1);
    expect(glue).toContain(';=== LZSS_DECODE_GLUE (generated) ===');
    expect(glue).toContain(';=== /LZSS_DECODE_GLUE ===');
  });

  it('LZ_ROUTINE_BYTES matches the actually-assembled size', () => {
    const r = assemble(glue, 0x008000);
    expect(r.ok).toBe(true);
    expect(LZ_ROUTINE_BYTES).toBe(r.bytes.length);
  });
});

describe('lzDecodeCall + lzRepoint — the asset preamble', () => {
  it('assembles with the routine and resolves the jsr to lz_decode', () => {
    // A compressed blob, embedded as a label, decompressed via the preamble.
    const blob = lzssCompress(new Uint8Array([1, 2, 2, 2, 2, 3, 4, 5, 5, 5, 5, 6]));
    const preamble = lzDecodeCall('myblob') + '\n' + lzRepoint('$20', '$21');
    const data = 'myblob:\n  .byte ' + Array.from(blob).map((b) => b.toString(10)).join(', ') + '\n';
    const src = lzssGlue() + '\n' + preamble + '\n' + data;
    const r = assemble(src, 0x008000);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error(fails(r));
    // The jsr target (lz_decode) must be among the defined labels.
    expect(r.labels.some((l) => l.name === 'lz_decode')).toBe(true);
  });

  it('repoints the asset walker at LZ_SCRATCH ($0200)', () => {
    const rp = lzRepoint('$10', '$11');
    expect(rp).toContain('lda #$00'); // $0200 lo
    expect(rp).toContain('sta $10');
    expect(rp).toContain('lda #$02'); // $0200 hi
    expect(rp).toContain('sta $11');
  });
});

describe('round-trip sanity via the glue module (encoder + ref decoder agree)', () => {
  it('compress→decompress of a small blob is byte-exact', () => {
    const x = new Uint8Array(64);
    for (let i = 0; i < x.length; i++) x[i] = i % 5;
    const enc = lzssCompress(x);
    expect(Array.from(enc.slice(0, 4))).toEqual([LZSS_MAGIC[0], LZSS_MAGIC[1], LZSS_MAGIC[2], LZSS_MAGIC[3]]);
    expect(Array.from(lzssDecompress(enc))).toEqual(Array.from(x));
  });
});
