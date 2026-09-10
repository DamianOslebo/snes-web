/**
 * 65C816 (SNES 5A22) disassembler. Pure logic (no DOM) so it's unit-testable.
 *
 * The opcode map itself lives in the shared table at `src/asm/opcode.ts` —
 * the SAME table the assembler reads — so decode here and encode over there
 * can never drift apart. This file only adds the presentation layer:
 * computing instruction size, formatting operands, and resolving branch
 * targets from a `MemReader`.
 *
 * Sizing uses the 8-bit-immediate (power-up) baseline: immediates are 1
 * byte, 8-bit conditional branches carry a 1-byte offset. Opcodes we do not
 * list decode as `??` (size 1) rather than risk a wrong mnemonic — a debugger
 * that says "???" is safe; one that mislabels an instruction is not.
 */

import { OPCODES as SHARED_OPCODES, operandSize, type AddrMode, type Op } from '../asm/opcode';

export type { AddrMode, Op };

/** The decode table, re-exported so existing importers keep their path. */
export const OPCODES: (Op | null)[] = SHARED_OPCODES;

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

/** Total instruction size = 1 opcode byte + the operand's byte count. */
function sizeFor(mode: AddrMode): number {
  return 1 + operandSize(mode);
}

function formatOperand(mode: AddrMode, pc: number, r: MemReader): string {
  const zp = (a: number): string => hex(r.byte(a), 2);
  const abs = (a: number): string => hex(r.word(a), 4);
  // 65C816 long operand: lo, hi, bank — the bank byte is the third byte.
  const lng = (a: number): string => `${hex(r.byte(a + 2), 2)}:${hex(r.word(a), 4)}`;
  // Branch targets are 24-bit: bank:addr, sign-extended from the operand.
  const target = (n: number): string =>
    `$${hex((n >>> 16) & 0xff, 2)}:${hex(n & 0xffff, 4)}`;
  switch (mode) {
    case 'imp':
      return '';
    case 'imm':
      return `#$${zp(pc + 1)}`;
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
    case 'rel': {
      // 8-bit conditional branch: target = PC-after-branch + sign-extended 8-bit offset.
      const off = r.byte(pc + 1) & 0xff;
      const s = off & 0x80 ? off - 0x100 : off;
      return target(((pc + 2 + s) & 0xffffff) >>> 0);
    }
    case 'rel16': {
      // BRL: target = PC-after-branch + sign-extended 16-bit offset.
      return target(((pc + 3 + r.short(pc + 1)) & 0xffffff) >>> 0);
    }
    case 'ind':
      return `($${abs(pc + 1)})`;
    case 'indx':
      return `($${zp(pc + 1)},X)`;
    case 'indy':
      return `($${zp(pc + 1)}),Y`;
    case 'sr':
      // Stack-relative: the operand is a single 8-bit offset added to S.
      return `(S)+$${zp(pc + 1)}`;
  }
}

/** Disassemble the single instruction at `pc`. */
export function disassemble(pc: number, r: MemReader): Instruction {
  const opcode = r.byte(pc) & 0xff;
  const op = OPCODES[opcode];
  if (!op) {
    return { addr: pc, size: 1, mnemonic: '??', operand: `$${hex(opcode, 2)}`, illegal: true };
  }
  return {
    addr: pc,
    size: sizeFor(op.mode),
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
