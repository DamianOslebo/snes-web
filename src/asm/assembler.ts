/**
 * 65C816 (SNES 5A22) assembler. Pure logic (no DOM) so it's unit-testable.
 *
 * This is the *encode* half of the pair with the disassembler in
 * `src/debug/disasm.ts`: both read the ONE opcode table in `src/asm/opcode.ts`,
 * so a mnemonic the assembler accepts is exactly one the disassembler will
 * decode back. That is what makes the assemble→disassemble round-trip identity
 * (see `test/asm.test.ts`) hold by construction rather than by coincidence.
 *
 * What it does, and deliberately does NOT do:
 *  - Two-pass: labels may be used before they are defined (branches, `JSL`,
 *    and any addressing form), and label-based addressing infers zero-page vs
 *    absolute from the label's resolved address.
 *  - Tracks the P register's width bits across the listing so immediates
 *    widen to 2 bytes after `REP #$1` (16-bit A mode) and narrow back to
 *    1 byte after `SEP #$1` (8-bit A mode). `REP`/`SEP` themselves — and
 *    `BRK`'s dummy operand — always take exactly 1 byte: see `MASK_OPS`.
 *  - Branch operands: a label, an explicit signed offset (`+$2` / `-$3`), or
 *    an absolute target `$bank:addr` — the same target form the disassembler
 *    prints, which is what makes the text round-trip work.
 *  - Deliberately does NOT interpret "direct page" / bank-relative modes.
 *    Numeric addresses are classified by the width AS WRITTEN — ≤2 hex digits
 *    → zero-page, 3–4 → absolute — the same convention the disassembler
 *    prints with (`$4C` vs `$004C`). That is what makes disassembler output
 *    reassemble byte-identically. Labels still classify by resolved value.
 *
 * Errors fail loudly with a line number — an assembler that guesses is worse
 * than one that refuses (same principle as the debugger, see CLAUDE.md).
 */

import { OPCODES, encodeOp, operandSize, MASK_OPS, type AddrMode } from './opcode';

// --- public types -----------------------------------------------------------

export interface AsmLine {
  line: number;      // 1-based source line number
  label?: string;    // label defined on this line, if any
  mnemonic: string;  // the instruction (or a directive like `.byte`); '' for label-only lines
  operand: string;   // the operand as written (trimmed)
  offset: number;    // byte offset of this line within the output
  size: number;      // number of bytes this line emitted
  bytes: number[];   // the bytes emitted by this line
}

export interface AsmLabel { name: string; offset: number; address: number; }

export interface AsmError { line: number; message: string; }

export interface AsmResult {
  ok: boolean;
  origin: number;                 // the 24-bit base address labels/branches are resolved against
  bytes: Uint8Array;              // the assembled output (empty when !ok)
  lines: AsmLine[];               // per-line breakdown for the UI
  labels: AsmLabel[];             // every label, with its resolved 24-bit address
  errors: AsmError[];             // populated when !ok
  modeTrace: { line: number; a16: boolean; x16: boolean; y16: boolean }[];
                                   // P-register register-width state as seen BY each line
}

/** Thrown for user-facing assembly errors; carries the source line. */
class AsmFail extends Error {
  constructor(public line: number, msg: string) { super(msg); }
}

// --- helpers ----------------------------------------------------------------

const hex = (n: number, w: number): string => (n >>> 0).toString(16).padStart(w, '0');

const isIdent = (s: string): boolean => /^[A-Za-z_][A-Za-z0-9_]*$/.test(s);

/** Parse an integer literal: `$hex`, `0xHEX`, or decimal. No sign, no labels. */
function parseNum(line: number, s: string, what: string): number {
  const t = s.trim();
  let n: number;
  if (/^\$[0-9a-fA-F]+$/.test(t)) n = parseInt(t.slice(1), 16);
  else if (/^0[xX][0-9a-fA-F]+$/.test(t)) n = parseInt(t.slice(2), 16);
  else if (/^[0-9]+$/.test(t)) n = parseInt(t, 10);
  else throw new AsmFail(line, `invalid number "${s}" for ${what}`);
  return n;
}

/** Which addressing modes a mnemonic accepts, straight from the shared table. */
const MODES = new Map<string, Set<AddrMode>>();
for (const op of OPCODES) {
  if (!op) continue;
  let s = MODES.get(op.mnem);
  if (!s) { s = new Set<AddrMode>(); MODES.set(op.mnem, s); }
  s.add(op.mode);
}
const modesFor = (mnem: string): Set<AddrMode> => MODES.get(mnem) ?? new Set();

// A parsed operand. `kind` drives both sizing and byte emission.
interface Operand {
  kind: 'imp' | 'imm' | 'addr' | 'long' | 'branch';
  mode?: AddrMode;              // resolved for addr/long; imp/imm/branch derived at encode
  value?: number;               // imm value, or the 16-bit addr for addr-modes
  bank?: number;                // long
  label?: string;               // unresolved label (branch target or address)
  target?: number;              // branch: absolute 24-bit target ($bank:addr form)
  indexed?: 'x' | 'y';
}

interface Line {
  num: number;
  label?: string;
  mnem: string;
  operandRaw: string;
  op?: Operand;                 // instruction operand
  data?: number[];              // directive bytes
  pState?: { a16: boolean; x16: boolean; y16: boolean };
                                // P-register width state under which this line assembles
}

// --- parsing ----------------------------------------------------------------

function stripComment(s: string): string {
  // `;` and `//` run to end of line. A `#` is an immediate prefix, never a comment.
  const sc = s.indexOf(';');
  const dc = s.indexOf('//');
  let end = s.length;
  if (sc !== -1) end = Math.min(end, sc);
  if (dc !== -1) end = Math.min(end, dc);
  return s.slice(0, end);
}

const DIRECTIVES = new Set(['.byte', '.db', '.word', '.dw', '.ascii', '.asciz', '.text']);

/**
 * Parse one source line into a `Line`. Label is optional (`name:`), then a
 * mnemonic and optional operand, or a directive. Empty/label-only lines are
 * legal (a bare label points at the current offset).
 */
function parseLine(num: number, raw: string): Line {
  let s = stripComment(raw).trim();
  if (s === '') return { num, mnem: '', operandRaw: '' };

  // Label?
  let label: string | undefined;
  const colon = s.indexOf(':');
  if (colon !== -1 && isIdent(s.slice(0, colon))) {
    label = s.slice(0, colon);
    s = s.slice(colon + 1).trim();
  }
  if (s === '') return { num, label, mnem: '', operandRaw: '' };

  // Split mnemonic from operand at the first unparenthesised space.
  let i = 0;
  while (i < s.length && !/\s/.test(s[i]) && s[i] !== '(') i++;
  const mnemRaw = s.slice(0, i);
  const operandRaw = s.slice(i).trim();

  // Directives.
  const m = mnemRaw.toLowerCase();
  if (DIRECTIVES.has(m)) {
    if (m === '.byte' || m === '.db') {
      return { num, label, mnem: m, operandRaw, data: parseByteList(num, operandRaw) };
    }
    if (m === '.word' || m === '.dw') {
      return { num, label, mnem: m, operandRaw, data: parseWordList(num, operandRaw) };
    }
    return { num, label, mnem: m, operandRaw, data: parseAscii(num, operandRaw) };
  }
  if (m[0] === '.') {
    throw new AsmFail(num, `unknown directive "${mnemRaw}" (supported: ${[...DIRECTIVES].join(', ')})`);
  }

  const mnem = mnemRaw.toUpperCase();
  if (modesFor(mnem).size === 0) {
    throw new AsmFail(num, `unknown instruction "${mnem}"`);
  }
  return { num, label, mnem, operandRaw, op: parseOperand(num, mnem, operandRaw) };
}

function parseByteList(num: number, s: string): number[] {
  const out: number[] = [];
  for (const part of s.split(',')) {
    const t = part.trim();
    if (t === '') continue;
    const v = parseNum(num, t, '.byte');
    if (v > 0xff) throw new AsmFail(num, `.byte value $${hex(v, 2)} does not fit in a byte`);
    out.push(v & 0xff);
  }
  if (out.length === 0) throw new AsmFail(num, '.byte needs at least one value');
  return out;
}

function parseWordList(num: number, s: string): number[] {
  const out: number[] = [];
  for (const part of s.split(',')) {
    const t = part.trim();
    if (t === '') continue;
    const v = parseNum(num, t, '.word');
    if (v > 0xffff) throw new AsmFail(num, `.word value $${hex(v, 4)} does not fit in a word`);
    out.push(v & 0xff, (v >> 8) & 0xff);
  }
  if (out.length === 0) throw new AsmFail(num, '.word needs at least one value');
  return out;
}

function parseAscii(num: number, s: string): number[] {
  let t = s.trim();
  if (t.length >= 2 && ((t[0] === '"' && t[t.length - 1] === '"') || (t[0] === "'" && t[t.length - 1] === "'"))) {
    t = t.slice(1, -1);
  }
  const out: number[] = [];
  for (const ch of t) {
    const c = ch.charCodeAt(0);
    if (c > 0xff) throw new AsmFail(num, `.ascii value U+${hex(c, 4)} is not a byte`);
    out.push(c & 0xff);
  }
  return out;
}

/**
 * Turn an operand string into an `Operand`. The addressing mode is inferred
 * from the syntax (`#`=immediate, `(...)`=indirect, `$b:addr`=long,
 * `,X`/`,Y`=indexed) and validated against the modes the mnemonic actually
 * supports per the shared table.
 */
function parseOperand(num: number, mnem: string, s: string): Operand {
  let t = s.trim();
  if (t === '') {
    // BRK always consumes a 1-byte dummy operand; a bare `BRK` fills it with $00.
    if (mnem === 'BRK') {
      requireMode(num, mnem, 'imm');
      return { kind: 'imm', value: 0 };
    }
    requireMode(num, mnem, 'imp');
    return { kind: 'imp' };
  }

  const legal = modesFor(mnem);

  // Immediate: #value. Width (1 vs 2 bytes) is decided at layout time from the
  // current P register; here we only capture the value.
  if (t[0] === '#') {
    requireMode(num, mnem, 'imm');
    const v = parseNum(num, t.slice(1), 'immediate');
    if (v > 0xffff) throw new AsmFail(num, `immediate $${hex(v, 4)} exceeds 16 bits`);
    return { kind: 'imm', value: v & 0xffff };
  }

  // Stack-relative: (S) or (S)+$NN — a single 8-bit offset added to S. The
  // disassembler prints this form, so parsing it is what round-trips.
  if (/^\(S\)/.test(t) || /^\(S\)\+/.test(t)) {
    requireMode(num, mnem, 'sr');
    const v = t.length > 3 ? parseNum(num, t.slice(4), '(S) offset') : 0;
    if (v > 0xff) throw new AsmFail(num, `(S) offset $${hex(v, 4)} does not fit in a byte`);
    return { kind: 'addr', mode: 'sr', value: v & 0xff };
  }

  // Indirect: (abs) | (zp,X) | (zp),Y — the ,Y of the third form sits OUTSIDE
  // the parens, so match on the opening paren and accept both closings.
  if (t[0] === '(' && (t.endsWith(')') || t.endsWith('),Y'))) {
    const inner = t.slice(1, t.lastIndexOf(')')).trim();
    if (isIdent(inner) || inner.endsWith(',X') && isIdent(inner.slice(0, -2))) {
      throw new AsmFail(num, `indirect operand must be a numeric address, not a label ("${t}")`);
    }
    // (zp),Y — the ,Y sits OUTSIDE the parens.
    if (t.endsWith('),Y')) {
      requireMode(num, mnem, 'indy');
      return { kind: 'addr', mode: 'indy', value: parseZp(num, inner) };
    }
    if (inner.endsWith(',X')) {
      requireMode(num, mnem, 'indx');
      return { kind: 'addr', mode: 'indx', value: parseZp(num, inner.slice(0, -2)) };
    }
    requireMode(num, mnem, 'ind');
    return { kind: 'addr', mode: 'ind', value: parseAbs(num, inner) };
  }

  // Branch: label | $bank:addr target | signed offset. Branch mnemonics never
  // take other forms, so anything unrecognised here is an error, not a fall-
  // through to the address paths below.
  if (legal.has('rel') || legal.has('rel16')) {
    const mode: AddrMode = legal.has('rel') ? 'rel' : 'rel16';
    if (isIdent(t)) return { kind: 'branch', mode, label: t };
    if (t.includes(':')) {
      const [bankS, addrS] = t.split(':');
      return {
        kind: 'branch', mode,
        target: (parseHexPart(num, bankS, 'bank') << 16) | parseHexPart(num, addrS, 'branch target'),
      };
    }
    // explicit signed offset: +$NN / -$NN / +NN / -NN
    const sign = t[0] === '-' ? -1 : 1;
    const body = (t[0] === '+' || t[0] === '-') ? t.slice(1) : t;
    if (/^\$?[0-9a-fA-F]+$/.test(body.trim())) {
      return { kind: 'branch', mode, value: sign * parseNum(num, body, 'branch offset') };
    }
    throw new AsmFail(num, `${mnem} takes a label, a $bank:addr target, or a signed offset`);
  }

  // Long (banked): $bank:addr
  if (t.includes(':')) {
    requireMode(num, mnem, 'long');
    const [bankS, addrS] = t.split(':');
    const bank = parseHexPart(num, bankS, 'bank');
    const addr = parseHexPart(num, addrS, 'address');
    if (bank > 0xff) throw new AsmFail(num, `bank $${hex(bank, 2)} does not fit in a byte`);
    if (addr > 0xffff) throw new AsmFail(num, `address $${hex(addr, 4)} exceeds 16 bits`);
    return { kind: 'long', value: addr & 0xffff, bank: bank & 0xff };
  }

  // Plain address (zero-page or absolute), optionally indexed.
  let indexed: 'x' | 'y' | undefined;
  if (t.endsWith(',X')) { indexed = 'x'; t = t.slice(0, -2).trim(); }
  else if (t.endsWith(',Y')) { indexed = 'y'; t = t.slice(0, -2).trim(); }

  if (isIdent(t)) {
    // A label used as an address — resolved to an absolute value at layout
    // time, then classified zp/abs by its width. Remember the index for later.
    return { kind: 'addr', label: t, indexed };
  }

  const v = parseNum(num, t, 'address');
  if (v > 0xffff) throw new AsmFail(num, `address $${hex(v, 4)} exceeds 16 bits`);
  // Zero-page vs absolute by the width as written: `$4C` → zero page,
  // `$004C` → absolute — even though the value fits a byte in both cases.
  // Mirrors the disassembler's printing (2-digit zp, 4-digit abs), so its
  // output reassembles byte-identically. Decimal operands fall back to value.
  let hexDigits = -1;
  if (/^\$[0-9a-fA-F]+$/.test(t)) hexDigits = t.length - 1;
  else if (/^0[xX][0-9a-fA-F]+$/.test(t)) hexDigits = t.length - 2;
  const wide = hexDigits === -1 ? v > 0xff : hexDigits >= 3;
  // Indexed Y is zero-page,Y when written 2-digit ($10,Y) and absolute,Y when
  // written 3-4-digit ($0010,Y) — exactly the way indexed X classifies. The
  // 65C816 has a zp,Y form only on LDX/STX; requireMode below rejects a
  // zero-page,Y operand for any mnemonic that lacks it (e.g. an ALU op).
  const mode: AddrMode =
    indexed === 'x' ? (wide ? 'absx' : 'zpx')
    : indexed === 'y' ? (wide ? 'absy' : 'zpy')
    : (wide ? 'abs' : 'zp');
  requireMode(num, mnem, mode);
  return { kind: 'addr', mode, value: v & 0xffff, indexed };
}

/**
 * Parse one part of a `bank:addr` pair as HEX (optional `$` prefix). The
 * disassembler prints these as unprefixed hex (`$80:0100`), so both halves are
 * hex — decimal here would silently misdecode addresses ≥ $0100.
 */
function parseHexPart(num: number, s: string, what: string): number {
  const m = s.trim().match(/^\$?([0-9a-fA-F]+)$/);
  if (!m) throw new AsmFail(num, `invalid ${what} "${s.trim()}"`);
  return parseInt(m[1], 16);
}

function parseZp(num: number, s: string): number {
  const v = parseNum(num, s, 'zero-page address');
  if (v > 0xff) throw new AsmFail(num, `indexed-indirect needs a zero-page address, got $${hex(v, 4)}`);
  return v & 0xff;
}
function parseAbs(num: number, s: string): number {
  const v = parseNum(num, s, 'absolute address');
  if (v > 0xffff) throw new AsmFail(num, `absolute address $${hex(v, 4)} exceeds 16 bits`);
  return v & 0xffff;
}

function requireMode(num: number, mnem: string, mode: AddrMode): void {
  if (!modesFor(mnem).has(mode)) {
    throw new AsmFail(num, `${mnem} does not take a ${describeMode(mode)} operand`);
  }
}

function describeMode(mode: AddrMode): string {
  return { imp: 'implied', imm: 'immediate', zp: 'zero-page', zpx: 'zero-page,X',
           zpy: 'zero-page,Y', abs: 'absolute', absx: 'absolute,X', absy: 'absolute,Y',
           ind: 'indirect', indx: 'indexed-indirect', indy: 'indexed-indirect,Y',
           sr: 'stack-relative (S)', rel: 'relative branch',
           rel16: '16-bit branch', long: 'long (banked)' }[mode];
}

// --- P-register state -------------------------------------------------------

/**
 * The A/X/Y width state each line assembles under. This is purely a function
 * of the `REP`/`SEP` lines BEFORE it — independent of operand widths — so it
 * can be computed once, up front, and is what makes the label fixed-point
 * below use each immediate's TRUE size (2 or 3 bytes) rather than a guess.
 */
function markPState(lines: Line[]): void {
  let a16 = false, x16 = false, y16 = false;   // power-up: 8-bit mode (A/X/Y bits clear)
  for (const ln of lines) {
    ln.pState = { a16, x16, y16 };
    if (ln.op?.kind !== 'imm' || ln.op.value === undefined) continue;
    const v = ln.op.value;
    if (ln.mnem === 'SEP') {
      // SEP sets the 8-bit flags for the listed bits → width SHRINKS to 8-bit.
      if (v & 0x01) a16 = false;
      if (v & 0x02) x16 = false;
      if (v & 0x04) y16 = false;
    } else if (ln.mnem === 'REP') {
      // REP sets the 16-bit flags for the listed bits → width GROWS to 16-bit.
      if (v & 0x01) a16 = true;
      if (v & 0x02) x16 = true;
      if (v & 0x04) y16 = true;
    }
  }
}

// --- layout & encoding ------------------------------------------------------

/** True byte size of one line, given the current label→offset map. */
function sizeOfLine(ln: Line, origin: number, labelOffset: Map<string, number>): number {
  if (ln.data) return ln.data.length;
  if (!ln.op) return 0;
  const op = ln.op;
  switch (op.kind) {
    case 'imp':
      return 1;
    case 'imm':
      // MASK_OPS (REP/SEP/BRK) are always 1 operand byte; otherwise the P
      // register at this line decides 8- vs 16-bit immediate.
      return MASK_OPS.has(ln.mnem) ? 2 : (ln.pState?.a16 ? 3 : 2);
    case 'long':
      return 4;
    case 'branch':
      return op.mode === 'rel' ? 2 : 3;
    case 'addr': {
      if (op.mode !== undefined) {
        return 1 + operandSize(op.mode);          // numeric: mode fixed at parse time
      }
      const lo = labelOffset.get(op.label!);
      if (lo === undefined) return 3;             // worst case; layout reports the error
      const abs = (origin + lo) & 0xffff;
      // Indexed (,X / ,Y) or plain: 2 bytes if the value fits zero page
      // (zp/zpx/zpy), 3 otherwise (abs/absx/absy).
      return abs <= 0xff ? 2 : 3;
    }
  }
  return 0;
}

/**
 * First pass: seed the label→offset map with worst-case sizes (every immediate
 * 3 bytes, every address 3) so offsets are defined, then refine with true
 * sizes to a fixed point. Every refinement only SHRINKS offsets (widths drop
 * from absolute to zero-page, 16-bit to 8-bit immediates), so the sum of
 * label offsets strictly decreases each non-converging sweep and the loop
 * must terminate.
 */
function labelPass(lines: Line[], origin: number): Map<string, number> {
  let off = 0;
  const current = new Map<string, number>();
  for (const ln of lines) {
    if (ln.label) {
      if (current.has(ln.label)) throw new AsmFail(ln.num, `duplicate label "${ln.label}"`);
      current.set(ln.label, off);
    }
    off += sizeOfLine(ln, origin, current);          // worst-case sizes on a blank map
  }

  for (let pass = 0; pass < 10000; pass++) {
    let off2 = 0;
    const next = new Map<string, number>();
    let changed = false;
    for (const ln of lines) {
      if (ln.label) {
        next.set(ln.label, off2);
        if (current.get(ln.label) !== off2) changed = true;
      }
      off2 += sizeOfLine(ln, origin, current);
    }
    if (!changed) break;
    current.clear();
    for (const [k, v] of next) current.set(k, v);
    if (pass === 9999) throw new AsmFail(0, 'label offsets did not converge — this is a bug, report it');
  }
  return current;
}

/**
 * Second pass: resolve each operand against the settled label map and emit
 * bytes. Sizes here agree with `sizeOfLine` by construction (same inputs).
 */
function layout(lines: Line[], origin: number, labelOffset: Map<string, number>):
  { bytes: number[]; lineBytes: number[][] } {
  const lineBytes: number[][] = [];
  let offset = 0;
  for (const ln of lines) {
    let bytes: number[];
    if (ln.data) bytes = ln.data;
    else if (!ln.op) bytes = [];                    // label-only line
    else bytes = encodeLine(ln, origin, labelOffset, offset);
    lineBytes.push(bytes);
    offset += bytes.length;
  }
  return { bytes: lineBytes.flat(), lineBytes };
}

function encodeLine(ln: Line, origin: number, labelOffset: Map<string, number>, offset: number): number[] {
  const op = ln.op!;
  const mnem = ln.mnem;

  // REP / SEP / BRK: always exactly 1 operand byte (flag mask or dummy).
  if (op.kind === 'imm' && MASK_OPS.has(mnem)) {
    const v = op.value ?? 0;
    if (v > 0xff) throw new AsmFail(ln.num, `${mnem} immediate $${hex(v, 4)} must fit in one byte`);
    return [encodeOp(mnem, 'imm')!, v & 0xff];
  }

  // Resolve the addressing mode (labels → absolute value → zp/abs width).
  let mode: AddrMode;
  let addr = 0;
  if (op.kind === 'imp') mode = 'imp';
  else if (op.kind === 'imm') mode = 'imm';
  else if (op.kind === 'long') mode = 'long';
  else if (op.kind === 'branch') mode = op.mode!;
  else { // addr
    if (op.label !== undefined) {
      const lo = labelOffset.get(op.label);
      if (lo === undefined) throw new AsmFail(ln.num, `undefined label "${op.label}"`);
      const abs = (origin + lo) & 0xffff;
      addr = abs;
      // Classify by resolved width, symmetric for ,X and ,Y: 2-digit (≤$FF)
      // → zero-page form, else absolute. A label that lands in the zero page
      // with an index becomes zp,X or zp,Y; requireMode rejects any mnemonic
      // that lacks that form.
      mode = op.indexed === 'x' ? (abs <= 0xff ? 'zpx' : 'absx')
           : op.indexed === 'y' ? (abs <= 0xff ? 'zpy' : 'absy')
           : (abs <= 0xff ? 'zp' : 'abs');
      requireMode(ln.num, mnem, mode);
    } else {
      mode = op.mode!;
      addr = op.value ?? 0;
    }
  }

  const opcode = encodeOp(mnem, mode);
  if (opcode === null) throw new AsmFail(ln.num, `${mnem} with ${describeMode(mode)} is not supported`);
  const out: number[] = [opcode];

  switch (mode) {
    case 'imp':
      break;
    case 'imm': {
      const v = op.value ?? 0;
      // Width follows the P register (A bit is the 8/16 selector for immediates).
      if (ln.pState?.a16) {
        out.push(v & 0xff, (v >> 8) & 0xff);
      } else {
        if (v > 0xff) throw new AsmFail(ln.num, `immediate $${hex(v, 4)} needs 16-bit mode (SEP #$1 first)`);
        out.push(v & 0xff);
      }
      break;
    }
    case 'zp':
    case 'zpx':
    case 'zpy':
    case 'indx':
    case 'indy':
    case 'sr':
      out.push(addr & 0xff);
      break;
    case 'abs':
    case 'absx':
    case 'absy':
    case 'ind':
      out.push(addr & 0xff, (addr >> 8) & 0xff);
      break;
    case 'long':
      // lo, hi, bank
      out.push((op.value ?? 0) & 0xff, ((op.value ?? 0) >> 8) & 0xff, (op.bank ?? 0) & 0xff);
      break;
    case 'rel':
    case 'rel16': {
      // offset field = target − PC-after-this-instruction, signed. Check the
      // FULL difference against the signed range — masking first would truncate
      // an out-of-range offset into a plausible-looking in-range one.
      const insSize = mode === 'rel' ? 2 : 3;
      // PC-after-instruction as a 24-bit address — the same space targets live in.
      const pcAfter = (origin + offset + insSize) & 0xffffff;
      let target: number;
      if (op.label !== undefined) {
        const lo = labelOffset.get(op.label);
        if (lo === undefined) throw new AsmFail(ln.num, `undefined label "${op.label}"`);
        target = (origin + lo) & 0xffffff;
      } else if (op.target !== undefined) {
        target = op.target & 0xffffff;             // absolute $bank:addr form
      } else {
        target = pcAfter + (op.value ?? 0);        // signed-offset form (exact)
      }
      const off = target - pcAfter;
      if (mode === 'rel') {
        if (off < -128 || off > 127) throw new AsmFail(ln.num, `branch offset ${off} out of range for 8-bit relative (±128..±127; use BRL)`);
        out.push(off & 0xff);
      } else {
        if (off < -32768 || off > 32767) throw new AsmFail(ln.num, `branch offset ${off} out of range for 16-bit relative (±32768..±32767)`);
        out.push(off & 0xff, (off >> 8) & 0xff);
      }
      break;
    }
  }
  return out;
}

// --- entry point ------------------------------------------------------------

/**
 * Assemble 65C816 source to bytes.
 *
 * `origin` is the 24-bit base address: labels resolve to `origin + offset`, and
 * that is what gets emitted into absolute/long operands. Default $008000 — the
 * conventional 5A22 reset vector region and where this project's mock seeds.
 */
export function assemble(source: string, origin = 0x008000): AsmResult {
  const result: AsmResult = {
    ok: false, origin, bytes: new Uint8Array(0), lines: [], labels: [], errors: [], modeTrace: [],
  };
  try {
    const rawLines = source.replace(/\r\n/g, '\n').split('\n');
    const lines: Line[] = rawLines.map((t, i) => parseLine(i + 1, t));

    markPState(lines);
    const labelOffset = labelPass(lines, origin);
    const { bytes, lineBytes } = layout(lines, origin, labelOffset);

    // Build the per-line view + label list.
    let off = 0;
    const outLines: AsmLine[] = [];
    const outLabels: AsmLabel[] = [];
    lines.forEach((ln, i) => {
      if (ln.label) outLabels.push({ name: ln.label, offset: off, address: (origin + off) & 0xffffff });
      outLines.push({
        line: ln.num,
        label: ln.label,
        mnemonic: ln.mnem,
        operand: ln.operandRaw,
        offset: off,
        size: lineBytes[i].length,
        bytes: lineBytes[i],
      });
      off += lineBytes[i].length;
    });

    result.ok = true;
    result.bytes = new Uint8Array(bytes);
    result.lines = outLines;
    result.labels = outLabels;
    result.modeTrace = lines.map((ln) => ({
      line: ln.num,
      a16: !!ln.pState?.a16,
      x16: !!ln.pState?.x16,
      y16: !!ln.pState?.y16,
    }));
    return result;
  } catch (e) {
    if (e instanceof AsmFail) {
      result.errors = [{ line: e.line, message: e.message }];
    } else {
      result.errors = [{ line: 0, message: e instanceof Error ? e.message : String(e) }];
    }
    return result;
  }
}

/** Convenience for the UI/tests: the output as grouped hex rows. */
export function bytesToHex(bytes: Uint8Array, group = 16): string {
  const rows: string[] = [];
  for (let i = 0; i < bytes.length; i += group) {
    const chunk = bytes.slice(i, i + group);
    rows.push(Array.from(chunk, (b) => hex(b, 2)).join(' '));
  }
  return rows.join('\n');
}

/** Re-encode a single instruction and return just its bytes (tests/helpers). */
export { describeMode };
