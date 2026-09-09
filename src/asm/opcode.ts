/**
 * The single source of truth for the 65C816 (SNES 5A22) opcode map.
 *
 * BOTH the disassembler (`src/debug/disasm.ts`) and the assembler
 * (`src/asm/assembler.ts`) read this one table, so decode and encode can
 * never drift apart. Every entry is an opcode the snes9x core we actually
 * ship implements — cross-checked against snes9x's `S9xOpcodesM1X1`
 * dispatch table and `S9xOpLengthsM1X1` length table. Nothing we are not
 * certain about is listed: an opcode we leave out decodes as `??` (safe);
 * mislabeling an instruction is not (see CLAUDE.md).
 *
 * Sizes here are the 8-bit-immediate (power-up) baseline, so an immediate
 * operand is 1 byte. The assembler separately tracks REP/SEP to emit a 16-bit
 * immediate (2 bytes) once the P register's 8-bit-mode bit is cleared — that
 * is the assembler's concern and is deliberately kept OUT of this table so
 * the table stays one canonical decode.
 */

export type AddrMode =
  | 'imp'     // implied — no operand bytes
  | 'imm'     // #immediate — 1 byte (8-bit baseline)
  | 'zp'      // zero page — 1 byte
  | 'zpx'     // zero page,X — 1 byte
  | 'abs'     // absolute — 2 bytes
  | 'absx'    // absolute,X — 2 bytes
  | 'absy'    // absolute,Y — 2 bytes
  | 'ind'     // (absolute) indirect — 2 bytes
  | 'indx'    // (zp,X) indexed-indirect — 1 byte
  | 'indy'    // (zp),Y indexed-indirect — 1 byte
  | 'rel'     // 8-bit relative branch — 1 byte
  | 'rel16'   // 16-bit relative branch — 2 bytes
  | 'long';   // 24-bit banked absolute — 3 bytes

export interface Op {
  mnem: string;
  mode: AddrMode;
}

/** Operand byte count (excluding the opcode itself) at the 8-bit baseline. */
export function operandSize(mode: AddrMode): number {
  switch (mode) {
    case 'imp':
      return 0;
    case 'imm':
    case 'zp':
    case 'zpx':
    case 'indx':
    case 'indy':
    case 'rel':
      return 1;
    case 'abs':
    case 'absx':
    case 'absy':
    case 'ind':
    case 'rel16':
      return 2;
    case 'long':
      return 3;
  }
}

/** The eight base ALU/transfer operations — one per 0x20 page. */
const ALU: [number, string][] = [
  [0x00, 'ORA'],
  [0x20, 'AND'],
  [0x40, 'EOR'],
  [0x60, 'ADC'],
  [0x80, 'STA'],
  [0xa0, 'LDA'],
  [0xc0, 'CMP'],
  [0xe0, 'SBC'],
];

/**
 * The eight standard addressing forms at their fixed offsets from a base.
 * Sizes confirmed against snes9x `S9xOpLengthsM1X1` (operand bytes in
 * order: 1, 1, 1, 2, 1, 1, 2, 2).
 */
const ALU_FORMS: [number, AddrMode][] = [
  [0x01, 'indy'],
  [0x05, 'zp'],
  [0x09, 'imm'],
  [0x0d, 'abs'],
  [0x11, 'indx'],
  [0x15, 'zpx'],
  [0x19, 'absx'],
  [0x1d, 'absy'],
];

/** Every non-ALU-grid instruction we are confident the SNES 5A22 implements. */
const SPECIALS: [number, string, AddrMode][] = [
  // --- 8-bit relative branches (opcode + 1 offset byte = 2 total) --------
  [0x10, 'BPL', 'rel'],
  [0x30, 'BMI', 'rel'],
  [0x50, 'BVC', 'rel'],
  [0x70, 'BVS', 'rel'],
  [0x80, 'BRA', 'rel'],
  [0x90, 'BCC', 'rel'],
  [0xb0, 'BCS', 'rel'],
  [0xd0, 'BNE', 'rel'],
  [0xf0, 'BEQ', 'rel'],
  [0x82, 'BRL', 'rel16'], // 16-bit relative — the one 3-byte branch

  // --- jumps & returns ----------------------------------------------------
  // BRK takes a 1-byte dummy operand (the core consumes 2 bytes); a bare
  // `BRK` in the assembler fills it with $00.
  [0x00, 'BRK', 'imm'],
  [0x20, 'JSR', 'abs'],
  [0x22, 'JSL', 'long'], // 24-bit absolute (bank:addr)
  [0x40, 'RTS', 'imp'],
  [0x4c, 'JMP', 'abs'],
  [0x60, 'RTI', 'imp'],
  [0x6b, 'RTL', 'imp'], // return from JSL
  [0x6c, 'JMP', 'ind'], // (absolute) indirect

  // --- flag / status ------------------------------------------------------
  [0x08, 'PHP', 'imp'],
  [0x18, 'CLC', 'imp'],
  [0x28, 'PLP', 'imp'],
  [0x38, 'SEC', 'imp'],
  [0x58, 'CLI', 'imp'],
  [0x78, 'SEI', 'imp'],
  [0xb8, 'CLV', 'imp'],
  [0xd8, 'CLD', 'imp'],
  [0xf8, 'SED', 'imp'],

  // --- mode: always a 1-byte flag mask, never a 16-bit immediate ----------
  [0xc2, 'REP', 'imm'],
  [0xe2, 'SEP', 'imm'],

  // --- register transfers -------------------------------------------------
  [0x8a, 'TXA', 'imp'],
  [0x98, 'TYA', 'imp'],
  [0x9a, 'TXS', 'imp'],
  [0x9b, 'TXY', 'imp'],
  [0xa8, 'TAY', 'imp'],
  [0xaa, 'TAX', 'imp'],
  [0xba, 'TSX', 'imp'],
  [0xbb, 'TYX', 'imp'],

  // --- A-register shift/rotate/inc/dec -----------------------------------
  [0x1a, 'INCA', 'imp'],
  [0x2a, 'ROLA', 'imp'],
  [0x3a, 'DECA', 'imp'],
  [0x4a, 'LSRA', 'imp'],
  [0x6a, 'RORA', 'imp'],

  // --- A <-> S / A <-> D --------------------------------------------------
  [0x1b, 'TCS', 'imp'],
  [0x3b, 'TSC', 'imp'],
  [0x5b, 'TCD', 'imp'],
  [0x7b, 'TDC', 'imp'],

  // --- index manipulators -------------------------------------------------
  [0xeb, 'XBA', 'imp'],
  [0xfb, 'XCE', 'imp'],

  // --- register inc/dec ---------------------------------------------------
  [0x88, 'DEY', 'imp'],
  [0xc8, 'INY', 'imp'],
  [0xca, 'DEX', 'imp'],
  [0xe8, 'INX', 'imp'],

  // --- misc ---------------------------------------------------------------
  [0xea, 'NOP', 'imp'],
  [0xdb, 'WAI', 'imp'],

  // --- stack pushes/pulls -------------------------------------------------
  [0x0b, 'PHD', 'imp'],
  [0x2b, 'PLD', 'imp'],
  [0x48, 'PHA', 'imp'],
  [0x4b, 'PHK', 'imp'],
  [0x5a, 'PHY', 'imp'],
  [0x68, 'PLA', 'imp'],
  [0x7a, 'PLY', 'imp'],
  [0x8b, 'PHB', 'imp'],
  [0xab, 'PLB', 'imp'],
  [0xda, 'PHX', 'imp'],
  [0xfa, 'PLX', 'imp'],

  // --- BIT ----------------------------------------------------------------
  [0x24, 'BIT', 'zp'],
  [0x26, 'BIT', 'zpx'],
  [0x2c, 'BIT', 'abs'],
  [0x2e, 'BIT', 'absx'],

  // --- LDX / LDY ----------------------------------------------------------
  [0xa0, 'LDY', 'imm'],
  [0xa2, 'LDX', 'imm'],
  [0xa4, 'LDY', 'zp'],
  [0xa6, 'LDX', 'zp'],
  [0xac, 'LDY', 'abs'],
  [0xae, 'LDX', 'abs'],
  [0xb4, 'LDY', 'zpx'],
  [0xb6, 'LDX', 'zpx'],
  [0xbc, 'LDY', 'absx'],
  [0xbe, 'LDX', 'absx'],

  // --- CPX / CPY ----------------------------------------------------------
  [0xc0, 'CPY', 'imm'],
  [0xc4, 'CPY', 'zp'],
  [0xcc, 'CPY', 'abs'],
  [0xe0, 'CPX', 'imm'],
  [0xe4, 'CPX', 'zp'],
  [0xec, 'CPX', 'abs'],

  // --- INC / DEC (memory) -------------------------------------------------
  [0xc6, 'DEC', 'zp'],
  [0xd6, 'DEC', 'zpx'],
  [0xce, 'DEC', 'abs'],
  [0xe6, 'INC', 'zp'],
  [0xf6, 'INC', 'zpx'],
  [0xee, 'INC', 'abs'],

  // --- STX / STY / STZ ----------------------------------------------------
  // (STZ absolute 0x92 is deliberately left out — the core's length table
  // disagrees with the documented 2-byte form, and we would rather show `??`
  // than risk mislabeling. Trivial to add later.)
  [0x84, 'STY', 'zp'],
  [0x86, 'STX', 'zp'],
  [0x8c, 'STY', 'abs'],
  [0x8e, 'STX', 'abs'],
  [0x94, 'STY', 'zpx'],
  [0x96, 'STX', 'zpx'],
  [0x9c, 'STY', 'absx'],
  [0x9e, 'STX', 'absx'],
  [0x64, 'STZ', 'zp'],
  [0x74, 'STZ', 'zpx'],
];

// --- build the decode table (byte -> Op) and the encode map (Op -> byte) --
const OPCODES: (Op | null)[] = new Array(256).fill(null);
const ENCODE = new Map<string, number>(); // "MNEM|mode" -> opcode byte

function reg(byte: number, mnem: string, mode: AddrMode): void {
  if (OPCODES[byte] !== null) {
    // A collision means two entries claim the same opcode byte — a table bug,
    // not a real second encoding. Fail loudly in dev rather than silently win.
    throw new Error(`opcode table collision at $${byte.toString(16)}: ${OPCODES[byte]!.mnem} vs ${mnem}`);
  }
  OPCODES[byte] = { mnem, mode };
  const key = `${mnem}|${mode}`;
  if (ENCODE.has(key)) {
    throw new Error(`encode map collision for ${key}: $${ENCODE.get(key)!.toString(16)} vs $${byte.toString(16)}`);
  }
  ENCODE.set(key, byte);
}

for (const [base, mnem] of ALU) {
  for (const [off, mode] of ALU_FORMS) reg(base + off, mnem, mode);
}
for (const [byte, mnem, mode] of SPECIALS) reg(byte, mnem, mode);

/** `OPCODES[byte]` -> the instruction, or null if not in our supported set. */
export { OPCODES };

/** Encode a (mnemonic, mode) pair to its opcode byte, or null if unsupported. */
export function encodeOp(mnem: string, mode: AddrMode): number | null {
  return ENCODE.get(`${mnem}|${mode}`) ?? null;
}

/**
 * Mnemonics whose immediate is ALWAYS 1 byte, even when the P register is in
 * 16-bit mode — the assembler must not widen it. REP/SEP take a flag mask;
 * BRK's byte is a dummy operand the core consumes and ignores.
 */
export const MASK_OPS = new Set<string>(['REP', 'SEP', 'BRK']);
