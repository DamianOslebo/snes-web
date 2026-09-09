import { describe, expect, it } from 'vitest';
import { disassemble, disassembleRange, OPCODES, type MemReader } from '../src/debug/disasm';

const PC = 0x8000;

/**
 * A MemReader that places `bytes` at PC (bank $00). Reads outside the
 * supplied range return 0, the same as a zero-filled 64KB page.
 */
function readerFrom(bytes: Uint8Array): MemReader {
  const at = (a: number): number => {
    const i = a - PC;
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

describe('65C816 disassembler', () => {
  it('disassembles the mock seed program correctly', () => {
    // A2 00     LDX #$00
    // E8        INX
    // CA        DEX
    // D0 02     BNE +2        (8-bit relative → $00:8008, target = pc+2+2)
    // A9 FF     LDA #$FF
    // 8D 00 02  STA $0200     (absolute, 3 bytes)
    // 40        RTS           (65C816: RTS is $40 and RTI is $60 — swapped
    //                          relative to the 6502)
    // (Same program the MockCore seeds at $00:8000.)
    const bytes = new Uint8Array([0xa2, 0x00, 0xe8, 0xca, 0xd0, 0x02, 0xa9, 0xff, 0x8d, 0x00, 0x02, 0x40]);
    const r = readerFrom(bytes);
    const ins = disassembleRange(PC, r, 7);

    expect(ins.map((i) => i.mnemonic)).toEqual(['LDX', 'INX', 'DEX', 'BNE', 'LDA', 'STA', 'RTS']);
    expect(ins.map((i) => i.operand)).toEqual(['#$00', '', '', '$00:8008', '#$ff', '$0200', '']);
    expect(ins.map((i) => i.size)).toEqual([2, 1, 1, 2, 2, 3, 1]);
    expect(ins.map((i) => i.illegal)).toEqual([false, false, false, false, false, false, false]);
  });

  it('computes 8-bit relative branch targets (forward and backward)', () => {
    const hex4 = (n: number): string => (n & 0xffff).toString(16).padStart(4, '0');
    // BRA +$10 → target = pc + 2 + 0x10
    let bytes = new Uint8Array([0x80, 0x10]);
    expect(disassemble(PC, readerFrom(bytes)).operand).toBe(`$00:${hex4(PC + 2 + 0x10)}`);
    // BRA -4 (0xfc) → target = pc + 2 - 4 = pc - 2
    bytes = new Uint8Array([0x80, 0xfc]);
    expect(disassemble(PC, readerFrom(bytes)).operand).toBe(`$00:${hex4(PC + 2 - 4)}`);
  });

  it('computes 16-bit relative BRL targets', () => {
    const hex4 = (n: number): string => (n & 0xffff).toString(16).padStart(4, '0');
    // BRL +$0010 (82 10 00) → target = pc + 3 + 0x10
    const bytes = new Uint8Array([0x82, 0x10, 0x00]);
    const ins = disassemble(PC, readerFrom(bytes));
    expect(ins.mnemonic).toBe('BRL');
    expect(ins.operand).toBe(`$00:${hex4(PC + 3 + 0x10)}`);
    expect(ins.size).toBe(3);
  });

  it('decodes banked (long) addressing as bank:addr', () => {
    // JSL $C0:0301 → 22 01 03 C0
    const bytes = new Uint8Array([0x22, 0x01, 0x03, 0xc0]);
    const ins = disassemble(PC, readerFrom(bytes));
    expect(ins.mnemonic).toBe('JSL');
    expect(ins.operand).toBe('$c0:0301');
    expect(ins.size).toBe(4);
  });

  it('decodes the C816 extra stack and register-transfer ops', () => {
    const cases: [number, string][] = [
      [0x48, 'PHA'],
      [0x68, 'PLA'],
      [0x4b, 'PHK'],
      [0x8b, 'PHB'],
      [0xab, 'PLB'],
      [0x0b, 'PHD'],
      [0x2b, 'PLD'],
      [0x5a, 'PHY'],
      [0x7a, 'PLY'],
      [0xda, 'PHX'],
      [0xfa, 'PLX'],
      [0x1b, 'TCS'],
      [0x3b, 'TSC'],
      [0x5b, 'TCD'],
      [0x7b, 'TDC'],
      [0x9b, 'TXY'],
      [0xbb, 'TYX'],
      [0xeb, 'XBA'],
      [0xfb, 'XCE'],
      [0xc2, 'REP'],
      [0xe2, 'SEP'],
    ];
    for (const [op, mnem] of cases) {
      const r = readerFrom(new Uint8Array([op, 0]));
      const ins = disassemble(PC, r);
      expect(ins.mnemonic, `opcode $${op.toString(16)}`).toBe(mnem);
      expect(ins.illegal).toBe(false);
    }
  });

  it('flags illegal / undocumented opcodes with size 1', () => {
    // $4E is not a defined instruction in our table.
    const ins = disassemble(PC, readerFrom(new Uint8Array([0x4e, 0, 0])));
    expect(ins.illegal).toBe(true);
    expect(ins.size).toBe(1);
    expect(ins.mnemonic).toBe('??');
  });

  it('covers the 6502-compatible core ops', () => {
    const expectOp = (op: number, mnem: string, mode: string): void => {
      const def = OPCODES[op];
      expect(def, `opcode $${op.toString(16)}`).toBeTruthy();
      expect(def!.mnem).toBe(mnem);
      expect(def!.mode).toBe(mode);
    };
    expectOp(0x00, 'BRK', 'imm'); // 1-byte dummy operand; core consumes 2 bytes
    expectOp(0x20, 'JSR', 'abs');
    expectOp(0x4c, 'JMP', 'abs');
    expectOp(0x60, 'RTI', 'imp');
    expectOp(0x24, 'BIT', 'zp');
    expectOp(0x2e, 'BIT', 'absx');
    expectOp(0xa2, 'LDX', 'imm');
    expectOp(0xc0, 'CPY', 'imm');
    expectOp(0xe0, 'CPX', 'imm');
    expectOp(0x88, 'DEY', 'imp');
    expectOp(0xca, 'DEX', 'imp');
    expectOp(0xc8, 'INY', 'imp');
    expectOp(0xe8, 'INX', 'imp');
    expectOp(0xa5, 'LDA', 'zp');
    expectOp(0x85, 'STA', 'zp');
    expectOp(0xad, 'LDA', 'abs');
    expectOp(0xbd, 'LDA', 'absy');
    expectOp(0x01, 'ORA', 'indy');
    expectOp(0x11, 'ORA', 'indx');
    expectOp(0x2d, 'AND', 'abs');
    expectOp(0x69, 'ADC', 'imm');
    expectOp(0xc9, 'CMP', 'imm');
  });
});
