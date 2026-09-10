import { describe, expect, it } from 'vitest';
import { assemble, type AsmResult } from '../src/asm/assembler';
import { disassembleRange, type MemReader } from '../src/debug/disasm';

const ORIGIN = 0x8000;

const hexBytes = (r: AsmResult): string =>
  Array.from(r.bytes).map((b) => b.toString(16).padStart(2, '0')).join(' ');

const expectOk = (src: string, origin = ORIGIN): AsmResult => {
  const r = assemble(src, origin);
  expect(r.ok, r.errors.map((e) => `line ${e.line}: ${e.message}`).join('; ')).toBe(true);
  return r;
};

const expectFail = (src: string, match: RegExp, line?: number): AsmResult => {
  const r = assemble(src);
  expect(r.ok).toBe(false);
  expect(r.errors).toHaveLength(1);
  if (line !== undefined) expect(r.errors[0].line).toBe(line);
  expect(r.errors[0].message).toMatch(match);
  return r;
};

/** A MemReader that places `bytes` at `base` — for feeding the disassembler. */
function readerAt(base: number, bytes: Uint8Array): MemReader {
  const at = (a: number): number => {
    const i = a - base;
    return i >= 0 && i < bytes.length ? bytes[i] : 0;
  };
  return {
    byte: (a) => at(a) & 0xff,
    word: (a) => (at(a) | (at(a + 1) << 8)) & 0xffff,
    short: (a) => {
      const v = (at(a) | (at(a + 1) << 8)) & 0xffff;
      return v & 0x8000 ? v - 0x10000 : v;
    },
    long: (a) => (at(a) | (at(a + 1) << 8) | (at(a + 2) << 16)) & 0xffffff,
  };
}

/**
 * The payoff of the shared opcode table: disassemble the assembled bytes,
 * then reassemble each instruction's DISASSEMBLER TEXT (at that instruction's
 * own address) and demand byte-identity with the original output. Round-trips
 * are in the 8-bit baseline — the same baseline the disassembler assumes.
 */
const roundTrip = (src: string, count: number, origin = ORIGIN): void => {
  const r = expectOk(src, origin);
  const insns = disassembleRange(origin, readerAt(origin, r.bytes), count);
  for (const insn of insns) {
    const re = assemble(`${insn.mnemonic} ${insn.operand}`.trim(), insn.addr);
    const i = insn.addr - origin;
    expect(re.ok, `re-assembly of "${insn.mnemonic} ${insn.operand}" failed: ${re.errors.map((e) => e.message).join('; ')}`).toBe(true);
    expect(Array.from(re.bytes), `"${insn.mnemonic} ${insn.operand}" at $${hex(insn.addr, 6)}`).toEqual(
      Array.from(r.bytes.slice(i, i + insn.size)));
  }
};

const hex = (n: number, w: number): string => (n >>> 0).toString(16).padStart(w, '0');

describe('65C816 assembler', () => {
  it('encodes every standard addressing form', () => {
    const r = expectOk([
      'LDA #$2A',      // a9 2a       immediate (8-bit baseline)
      'STA $004C',     // 8d 4c 00    4 digits = absolute, even though ≤ $FF
      'LDA $10',       // a5 10       2 digits = zero page
      'LDA $10,X',     // b5 10       zero page,X
      'LDA $0010,Y',   // b9 10 00    absolute,Y
      'LDA $0010,X',   // bd 10 00    absolute,X
      'ORA ($0A),Y',   // 11 0a       indexed-indirect,Y — (zp),Y
      'ORA ($0A,X)',   // 01 0a       indexed-indirect — (zp,X)
      'JMP ($C080)',   // 6c 80 c0    absolute indirect ($6C on 65C816; $4C is plain JMP abs)
      'JSL $C0:8000',  // 22 00 80 c0 long (banked), lo hi bank
      'JSR $0100',     // 20 00 01    absolute (3 digits = wide)
      'RTS',           // 60          (RTS=$60, RTI=$40 — same as the 6502)
    ].join('\n'));
    expect(hexBytes(r)).toBe(
      'a9 2a 8d 4c 00 a5 10 b5 10 b9 10 00 bd 10 00 11 0a 01 0a 6c 80 c0 22 00 80 c0 20 00 01 60');
  });

  it('classifies numeric addresses by the width as written', () => {
    expect(hexBytes(expectOk('LDA $4C'))).toBe('a5 4c');        // 2 digits → zp   (A5)
    expect(hexBytes(expectOk('LDA $004C'))).toBe('ad 4c 00');   // 4 digits → abs  (AD)
    expect(hexBytes(expectOk('LDA $0A,X'))).toBe('b5 0a');      // 2 digits → zp,X (B5)
    expect(hexBytes(expectOk('LDA $000A,X'))).toBe('bd 0a 00'); // 4 digits → abs,X (BD)
  });

  it('encodes explicit signed branch offsets', () => {
    const r = expectOk('BNE +2\nBNE -1\nBRL +0');
    expect(hexBytes(r)).toBe('d0 02 d0 ff 82 00 00');
  });

  it('resolves labels forward and backward', () => {
    const r = expectOk([
      'start:',
      'LDA #$01',     // a9 01   @0
      'BEQ skip',     // f0 01   @2  (target @5 → offset +1)
      'INX',          // e8      @4
      'skip:',
      'RTS',          // 60      @5
      'loop:',
      'DEC $0A',      // c6 0a   @6
      'BNE loop',     // d0 fc   @8  (target @6 → offset -4)
    ].join('\n'));
    expect(hexBytes(r)).toBe('a9 01 f0 01 e8 60 c6 0a d0 fc');
    expect(r.labels).toEqual([
      { name: 'start', offset: 0, address: ORIGIN },
      { name: 'skip', offset: 5, address: ORIGIN + 5 },
      { name: 'loop', offset: 6, address: ORIGIN + 6 },
    ]);
  });

  it('resolves labels that follow 8-bit immediates (fixed-point seed)', () => {
    // Regression: the label pass once seeded every immediate as 3 bytes, which
    // would have put `end` one byte too far ahead and mis-encoded the branch.
    const r = expectOk(['LDA #$05', 'BEQ end', 'NOP', 'end:', 'RTS'].join('\n'));
    expect(hexBytes(r)).toBe('a9 05 f0 01 ea 60');
    expect(r.labels).toEqual([{ name: 'end', offset: 5, address: ORIGIN + 5 }]);
  });

  it('resolves labels that follow 16-bit immediates', () => {
    const r = expectOk(['REP #$1', 'LDA #$1234', 'BEQ end', 'NOP', 'end:', 'RTS'].join('\n'));
    expect(hexBytes(r)).toBe('c2 01 a9 34 12 f0 01 ea 60');
    expect(r.labels).toEqual([{ name: 'end', offset: 8, address: ORIGIN + 8 }]);
  });

  it('widens immediates after REP #$1 and narrows after SEP #$1', () => {
    const r = expectOk(['REP #$1', 'LDA #$FFFF', 'SEP #$1', 'LDA #$FF', 'RTS'].join('\n'));
    expect(hexBytes(r)).toBe('c2 01 a9 ff ff e2 01 a9 ff 60');
    // a16 as seen BY each line: line 1 (REP) assembles under 8-bit, line 2
    // under 16-bit (REP already executed), line 4 back under 8-bit.
    expect(r.modeTrace.map((m) => m.a16)).toEqual([false, true, true, false, false]);
  });

  it('tracks the X and Y width bits independently', () => {
    const r = expectOk(['REP #$7', 'TXA', 'SEP #$2', 'TXA'].join('\n'));
    expect(hexBytes(r)).toBe('c2 07 8a e2 02 8a');
    expect(r.modeTrace.map((m) => [m.a16, m.x16, m.y16])).toEqual([
      [false, false, false],
      [true, true, true],
      [true, true, true],
      [true, false, true],   // SEP #$2 clears only the X bit
    ]);
  });

  it('accepts a 16-bit immediate only in 16-bit mode', () => {
    expect(hexBytes(expectOk('REP #$1\nLDA #$100'))).toBe('c2 01 a9 00 01');
    expectFail('LDA #$100', /needs 16-bit mode/);
  });

  it('emits BRK with its 1-byte dummy operand, never widened', () => {
    expect(hexBytes(expectOk('BRK'))).toBe('00 00');
    // 16-bit mode must not turn BRK's dummy byte into two bytes.
    expect(hexBytes(expectOk('REP #$1\nBRK'))).toBe('c2 01 00 00');
  });

  it('emits the data directives', () => {
    const r = expectOk(['.byte $01, $02, 3', '.word $1234', '.ascii "ab"'].join('\n'));
    expect(hexBytes(r)).toBe('01 02 03 34 12 61 62');
  });

  it('resolves labels used as addresses by their width', () => {
    // `rel` lands at offset 2 → zero page (A5).
    expect(hexBytes(expectOk(['LDA rel', 'rel:', 'RTS'].join('\n'), 0x0000))).toBe('a5 02 60');
    // Origin near the top of the bank: `top` lands at $00ffa3 (offset 3),
    // which is absolute even though it looks small — the classification uses
    // the resolved ADDRESS, not the offset within the output.
    expect(hexBytes(expectOk(['LDA top', 'top:', 'RTS'].join('\n'), 0x00ffa0))).toBe('ad a3 ff 60');
  });

  it('exposes a per-line byte map for the UI', () => {
    const r = expectOk(['LDA #$01', 'label:', 'RTS'].join('\n'));
    expect(r.lines.map((l) => [l.offset, l.size, l.bytes])).toEqual([
      [0, 2, [0xa9, 0x01]],
      [2, 0, []],
      [2, 1, [0x60]],
    ]);
    expect(r.lines[1].label).toBe('label');
  });

  it('returns an empty result on failure', () => {
    const r = assemble('LDA #$100');
    expect(r.ok).toBe(false);
    expect(r.bytes).toHaveLength(0);
    expect(r.lines).toHaveLength(0);
  });

  // --- round-trip: assemble → disassemble → reassemble → identical bytes ---

  it('round-trips every addressing form through the disassembler', () => {
    roundTrip([
      'LDA #$2A',
      'STA $004C',
      'LDA $10',
      'LDA $10,X',
      'LDA $0010,Y',
      'LDA $0010,X',
      'ORA ($0A),Y',
      'ORA ($0A,X)',
      'JMP ($C080)',
      'JSL $C0:8000',
      'JSR $0100',
      'RTS',
    ].join('\n'), 12);
  });

  it('round-trips branches (labels, targets, and self-referential +0)', () => {
    roundTrip([
      'LDA #$01',
      'BEQ end',
      'NOP',
      'end:',
      'RTS',
      'BRL begin',
      'BNE +0',
      'begin:',
      'RTS',
    ].join('\n'), 7);
  });

  it('round-trips the extended 65C816 set ((S), zp,Y, STZ/ROL/TSB/TRB, PER, WAI/STP)', () => {
    roundTrip([
      'ORA (S)+$10',   // 03 10      stack-relative
      'LDX $0A,Y',     // b6 0a      zero-page,Y (LDX)
      'STX $0A,Y',     // 96 0a      zero-page,Y (STX)
      'LDX $000A,Y',   // be 0a 00   absolute,Y
      'STZ $0100',     // 9c 00 01   STZ absolute
      'STZ $0A,X',     // 9e 0a      STZ absolute,X
      'ROL $004C',     // 2e 4c 00   ROL absolute
      'TSB $0100',     // 0c 00 01   TSB absolute
      'TRB $0A',       // 14 0a      TRB zero-page
      'BIT #$10',      // 89 10      BIT immediate
      'PER +$10',      // 62 10 00   16-bit PC-relative
      'WAI',           // cb         wait for interrupt
      'STP',           // db         stop
    ].join('\n'), 13);
  });

  // --- errors fail loudly, with line numbers, never by guessing -----------

  it('rejects malformed sources with a precise message per case', () => {
    expectFail('FOO $10', /unknown instruction "FOO"/);
    expectFail('LDA nothere', /undefined label "nothere"/);
    expectFail('BNE +$100', /out of range for 8-bit relative/);
    expectFail('BRL +$10000', /out of range for 16-bit relative/);
    expectFail('LDA #$10000', /exceeds 16 bits/);
    expectFail('.align 4', /unknown directive "\.align"/);
    expectFail('LDX $0A,X', /zero-page,X/);  // LDX has zp,Y but no zp,X
    expectFail('LDA ($0100)', /indirect/);   // 65C816 has no LDA (abs) indirect
    expectFail('.word $10000', /does not fit in a word/);
  });

  it('pins the error to the offending line', () => {
    expectFail(['NOP', 'LDA #$100', 'NOP'].join('\n'), /needs 16-bit mode/, 2);
  });

  it('rejects duplicate labels', () => {
    expectFail(['a:', 'NOP', 'a:', 'RTS'].join('\n'), /duplicate label "a"/);
  });
});
