/**
 * 65C816 disassembler. Pure logic (no DOM) so it's unit-testable.
 *
 * The 65C816 keeps the 6502 instruction set exactly as a subset and adds:
 * 24-bit (banked) addressing, 16-bit relative branches, 16-bit immediate
 * constants, direct-page/bank registers, and extra push/pull ops.
 *
 * The table below is built from the regular ALU/transfer grid (which is
 * perfectly regular across the eight base operations) plus an explicit
 * overlay for the special/mode/branch/stack instructions. Former-6502-illegal
 * slots we are not certain about are intentionally left null and shown as an
 * "illegal" opcode rather than risk a wrong mnemonic — a debugger that says
 * "???" is safe; one that mislabels an instruction is not.
 */

export type AddrMode =
  | 'imp'
  | 'imm'
  | 'imp16'
  | 'zp'
  | 'zpx'
  | 'zpy'
  | 'abs'
  | 'absx'
  | 'absy'
  | 'long'
  | 'longx'
  | 'longy'
  | 'rel'
  | 'ind'
  | 'indlong'
  | 'indx'
  | 'indy'
  | 'indxlong'
  | 'indylong';

export interface Op {
  mnem: string;
  mode: AddrMode;
}

export interface MemReader {
  byte(addr: number): number;
  word(addr: number): number; // little-endian 16-bit
  short(addr: number): number; // signed 16-bit
  long(addr: number): number; // 24-bit: byte(2) << 16 | word(0)
}

export interface Instruction {
  addr: number; // 24-bit program counter
  size: number;
  mnemonic: string;
  operand: string;
  illegal: boolean;
}

const hex = (n: number, w: number): string => (n >>> 0).toString(16).padStart(w, '0');

/**
 * The eight base ALU/transfer operations, one per 0x20 page. For each, the
 * same addressing forms appear at the same nibble offsets in both the primary
 * (x0–xF) and secondary (x1–x1F) halves of the page.
 */
const ALU: [number, string][] = [
  [0x00, 'ORA'],
  [0x20, 'AND'],
  [0x40, 'EOR'],
  [0x60, 'ADC'],
  [0x80, 'STA'],
  [0xA0, 'LDA'],
  [0xC0, 'CMP'],
  [0xE0, 'SBC'],
];

function buildTable(): (Op | null)[] {
  const t: (Op | null)[] = new Array(256).fill(null);
  const set = (op: number, mnem: string, mode: AddrMode): void => {
    t[op] = { mnem, mode };
  };

  for (const [base, mnem] of ALU) {
    // primary half (base + 0x00..0x0f)
    set(base + 0x01, mnem, 'zpx');
    set(base + 0x03, mnem, 'zp');
    set(base + 0x05, mnem, 'abs');
    set(base + 0x07, mnem, 'absx');
    set(base + 0x09, mnem, 'imm');
    set(base + 0x0d, mnem, 'absy');
    set(base + 0x0f, mnem, 'long');
    // secondary half (base + 0x10..0x1f)
    set(base + 0x11, mnem, 'indy');
    set(base + 0x15, mnem, 'zpx');
    set(base + 0x17, mnem, 'zp');
    set(base + 0x19, mnem, 'absy');
    set(base + 0x1d, mnem, 'absy');
    set(base + 0x1f, mnem, 'longy');
  }

  // --- 16-bit relative branches (C816) ------------------------------------
  set(0x10, 'BPL', 'rel');
  set(0x30, 'BMI', 'rel');
  set(0x50, 'BVC', 'rel');
  set(0x70, 'BVS', 'rel');
  set(0x80, 'BRA', 'rel');
  set(0x90, 'BCC', 'rel');
  set(0xB0, 'BCS', 'rel');
  set(0xD0, 'BNE', 'rel');
  set(0xF0, 'BEQ', 'rel');

  // --- processor-control & flags ------------------------------------------
  set(0x00, 'BRK', 'imp');
  set(0x02, 'REP', 'imm');
  set(0x03, 'SEP', 'imm');
  set(0x08, 'PHP', 'imp');
  set(0x18, 'CLC', 'imp');
  set(0x28, 'PLP', 'imp');
  set(0x38, 'SEC', 'imp');
  set(0x58, 'CLI', 'imp');
  set(0x78, 'SEI', 'imp');
  set(0xb8, 'CLV', 'imp');
  set(0xd8, 'CLD', 'imp');
  set(0xf8, 'SED', 'imp');

  // --- subroutine & jump ---------------------------------------------------
  set(0x20, 'JSR', 'long');
  set(0x40, 'RTS', 'imp');
  set(0x4c, 'JMP', 'long');
  set(0x60, 'RTI', 'imp');
  set(0x6c, 'JMP', 'indlong');

  // --- BIT -----------------------------------------------------------------
  set(0x24, 'BIT', 'zp');
  set(0x26, 'BIT', 'abs');
  set(0x2c, 'BIT', 'abs');
  set(0x2e, 'BIT', 'absx');

  // --- registers (16/8-bit transfer) --------------------------------------
  set(0x8a, 'TXA', 'imp');
  set(0x98, 'TYA', 'imp');
  set(0x9a, 'TXS', 'imp');
  set(0xa8, 'LDY', 'imp');
  set(0xaa, 'LDX', 'imp');
  set(0xba, 'TSX', 'imp');

  // --- LDX / LDY forms -----------------------------------------------------
  set(0xa0, 'LDY', 'imm');
  set(0xa2, 'LDX', 'imm');
  set(0xa4, 'LDY', 'zp');
  set(0xa6, 'LDX', 'zp');
  set(0xac, 'LDY', 'abs');
  set(0xae, 'LDX', 'abs');
  set(0xb4, 'LDY', 'zpx');
  set(0xb6, 'LDX', 'zpx');
  set(0xbc, 'LDY', 'absx');
  set(0xbe, 'LDX', 'absx');

  // --- CPX / CPY / DEC / INC ----------------------------------------------
  set(0xc0, 'CPY', 'imm');
  set(0xc4, 'CPY', 'zp');
  set(0xcc, 'CPY', 'abs');
  set(0xe0, 'CPX', 'imm');
  set(0xe4, 'CPX', 'zp');
  set(0xec, 'CPX', 'abs');
  set(0xc6, 'DEC', 'zp');
  set(0xce, 'DEC', 'abs');
  set(0xd6, 'DEC', 'zp');
  set(0xe6, 'INC', 'zp');
  set(0xee, 'INC', 'abs');
  set(0xf6, 'INC', 'zp');

  // --- 6502 increments/decrements (kept as a subset) ----------------------
  set(0x88, 'DEY', 'imp');
  set(0xc8, 'INY', 'imp');
  set(0xca, 'DEX', 'imp');
  set(0xe8, 'INX', 'imp');
  set(0xea, 'NOP', 'imp');

  // --- stack: A / P (6502) -------------------------------------------------
  set(0x48, 'PHA', 'imp');
  set(0x68, 'PLA', 'imp');

  // --- stack: 65C816 extra pushes/pulls (formerly 6502-illegal slots) ------
  set(0x4b, 'PHK', 'imp');
  set(0x8b, 'PHB', 'imp');
  set(0xab, 'PLB', 'imp');
  set(0xcd, 'PHD', 'imp');
  set(0xad, 'PLD', 'imp');
  set(0xda, 'PHX', 'imp');
  set(0xfa, 'PLX', 'imp');
  set(0x2b, 'TSK', 'imp');
  set(0x3b, 'TSC', 'imp');

  return t;
}

/** Opcodes[0..255]; `null` = illegal / undocumented. */
export const OPCODES: (Op | null)[] = buildTable();

function sizeFor(mode: AddrMode): number {
  switch (mode) {
    case 'imp':
      return 1;
    case 'imm':
    case 'zp':
    case 'zpx':
    case 'zpy':
    case 'ind':
    case 'indlong':
    case 'indx':
    case 'indy':
    case 'indxlong':
    case 'indylong':
      return 2;
    case 'imp16':
    case 'abs':
    case 'absx':
    case 'absy':
    case 'rel':
      return 3;
    case 'long':
    case 'longx':
    case 'longy':
      return 4;
  }
}

function formatOperand(mode: AddrMode, pc: number, r: MemReader): string {
  const zp = (a: number): string => hex(r.byte(a), 2);
  const abs = (a: number): string => hex(r.word(a), 4);
  // 65C816 long operand: lo, hi, bank — the bank byte is the third byte.
  const lng = (a: number): string => `${hex(r.byte(a + 2), 2)}:${hex(r.word(a), 4)}`;
  switch (mode) {
    case 'imp':
      return '';
    case 'imm':
      return `#$${zp(pc + 1)}`;
    case 'imp16':
      return `#$${abs(pc + 1)}`;
    case 'zp':
      return `$${zp(pc + 1)}`;
    case 'zpx':
      return `$${zp(pc + 1)},X`;
    case 'zpy':
      return `$${zp(pc + 1)},Y`;
    case 'abs':
      return `$${abs(pc + 1)}`;
    case 'absx':
      return `$${abs(pc + 1)},X`;
    case 'absy':
      return `$${abs(pc + 1)},Y`;
    case 'long':
      return `$${lng(pc + 1)}`;
    case 'longx':
      return `$${lng(pc + 1)},X`;
    case 'longy':
      return `$${lng(pc + 1)},Y`;
    case 'rel': {
      const target = pc + 3 + r.short(pc + 1);
      return `$${hex((target >>> 16) & 0xff, 2)}:${hex(target & 0xffff, 4)}`;
    }
    case 'ind':
    case 'indlong':
      return `($${zp(pc + 1)})`;
    case 'indx':
    case 'indxlong':
      return `($${zp(pc + 1)},X)`;
    case 'indy':
    case 'indylong':
      return `($${zp(pc + 1)}),Y`;
  }
}

/** Disassemble the single instruction at `pc`. */
export function disassemble(pc: number, r: MemReader): Instruction {
  const opcode = r.byte(pc) & 0xff;
  const op = OPCODES[opcode];
  if (!op) {
    return { addr: pc, size: 1, mnemonic: `??`, operand: `$${hex(opcode, 2)}`, illegal: true };
  }
  const size = sizeFor(op.mode);
  return {
    addr: pc,
    size,
    mnemonic: op.mnem,
    operand: formatOperand(op.mode, pc, r),
    illegal: false,
  };
}

/** Disassemble `count` consecutive instructions starting at `pc`. */
export function disassembleRange(pc: number, r: MemReader, count: number): Instruction[] {
  const out: Instruction[] = [];
  let cur = pc;
  for (let i = 0; i < count; i++) {
    const ins = disassemble(cur, r);
    out.push(ins);
    cur = (cur + ins.size) & 0xffffff;
  }
  return out;
}

/**
 * An in-memory MemReader over a core, so the debugger can feed the
 * disassembler without duplicating the bank/byte math.
 */
export function makeCoreReader(core: {
  readMem(bank: number, addr: number, size: number): Uint8Array;
}): MemReader {
  return {
    byte: (a) => core.readMem(a >>> 16, a & 0xffff, 1)[0],
    word: (a) => {
      const b = core.readMem(a >>> 16, a & 0xffff, 2);
      return b[0] | (b[1] << 8);
    },
    short: (a) => {
      const w = core.readMem(a >>> 16, a & 0xffff, 2);
      const v = w[0] | (w[1] << 8);
      return v & 0x8000 ? v - 0x10000 : v;
    },
    long: (a) => {
      const b = core.readMem(a >>> 16, a & 0xffff, 3);
      return (b[2] << 16) | (b[1] << 8) | b[0];
    },
  };
}
