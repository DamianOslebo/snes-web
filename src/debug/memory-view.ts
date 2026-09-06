import type { SnesCore } from '../core/types';

/**
 * Helpers for the memory browser. Reads a region's bytes from the core and
 * renders a compact hex grid. Pure logic (no DOM) so it's easy to test.
 */

export interface HexCell {
  addr: number;
  byte: number;
}

export interface HexRow {
  addr: number;
  hex: string[]; // 16 byte hex strings
  ascii: string;
}

export const HEX_COLS = 16;

/** Read `size` bytes from the core at (bank, base). */
export function readRegion(core: SnesCore, bank: number, base: number, size: number): Uint8Array {
  return core.readMem(bank, base, size);
}

/** Format a byte buffer as a list of 16-column hex rows. */
export function toHexRows(bytes: Uint8Array, startAddr: number): HexRow[] {
  const rows: HexRow[] = [];
  for (let off = 0; off < bytes.length; off += HEX_COLS) {
    const row: HexRow = { addr: startAddr + off, hex: [], ascii: '' };
    let ascii = '';
    for (let i = 0; i < HEX_COLS; i++) {
      const idx = off + i;
      if (idx < bytes.length) {
        const b = bytes[idx];
        row.hex.push(b.toString(16).padStart(2, '0'));
        ascii += b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : '.';
      } else {
        row.hex.push('  ');
      }
    }
    row.ascii = ascii;
    rows.push(row);
  }
  return rows;
}

/** Find the first offset within `bytes` where the `needle` pattern appears. */
export function findBytes(bytes: Uint8Array, needle: number[]): number {
  if (needle.length === 0 || needle.length > bytes.length) return -1;
  outer: for (let i = 0; i + needle.length <= bytes.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (bytes[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}

export function parseHexBytes(input: string): number[] {
  const trimmed = input.trim().toLowerCase();
  if (trimmed === '') return [];
  // Packed notation: an even-length run of pure hex is chunked into pairs.
  if (/^[0-9a-f]+$/.test(trimmed) && trimmed.length % 2 === 0) {
    return (trimmed.match(/.{2}/g) as string[]).map((s) => parseInt(s, 16));
  }
  // Separated notation: whitespace / : / , / - delimiters. Any token that is
  // not exactly two hex digits is a hard error (never silently dropped).
  const tokens = trimmed.split(/[\s:,\-]+/).filter((s) => s.length > 0);
  for (const s of tokens) {
    if (!/^[0-9a-f]{2}$/.test(s)) throw new Error(`bad byte: '${s}'`);
  }
  return tokens.map((s) => parseInt(s, 16));
}
