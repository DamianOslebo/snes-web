import { describe, expect, it } from 'vitest';
import { findBytes, parseHexBytes, toHexRows, HEX_COLS } from '../src/debug/memory-view';

describe('memory-view', () => {
  it('formats bytes into 16-wide rows with ASCII gutter', () => {
    const bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) bytes[i] = i; // 0x00..0x1f (non-printable → '.')
    const rows = toHexRows(bytes, 0x100);

    expect(rows.length).toBe(2);
    expect(rows[0].addr).toBe(0x100);
    expect(rows[1].addr).toBe(0x110);
    expect(rows[0].hex.length).toBe(HEX_COLS);
    expect(rows[0].hex[0]).toBe('00');
    expect(rows[0].hex[15]).toBe('0f');
    expect(rows[0].ascii.length).toBe(HEX_COLS);
    expect(rows[0].ascii).toBe('.'.repeat(HEX_COLS));
  });

  it('renders printable ASCII and pads a short final row', () => {
    const msg = 'Hi'.split('').map((c) => c.charCodeAt(0)); // 'H'=0x48 'i'=0x69
    const bytes = new Uint8Array([...msg, 0x00, 0xff]);
    const [row] = toHexRows(bytes, 0);
    expect(row.hex.slice(0, 4)).toEqual(['48', '69', '00', 'ff']);
    expect(row.ascii.slice(0, 2)).toBe('Hi');
    expect(row.hex.length).toBe(HEX_COLS);
    // last 12 cells are padding
    expect(row.hex.slice(4)).toEqual(Array(12).fill('  '));
  });

  it('finds a byte pattern', () => {
    const bytes = new Uint8Array([1, 2, 3, 9, 9, 9, 3]);
    expect(findBytes(bytes, [9, 9, 9])).toBe(3);
    expect(findBytes(bytes, [2, 3])).toBe(1);
    expect(findBytes(bytes, [7, 7])).toBe(-1);
  });

  it('rejects empty or oversized needles', () => {
    const bytes = new Uint8Array([1, 2, 3]);
    expect(findBytes(bytes, [])).toBe(-1);
    expect(findBytes(bytes, [1, 2, 3, 4])).toBe(-1);
  });

  it('parses hex bytes in several notations', () => {
    expect(parseHexBytes('ff 00 1a')).toEqual([0xff, 0x00, 0x1a]);
    expect(parseHexBytes('ff001a')).toEqual([0xff, 0x00, 0x1a]);
    expect(parseHexBytes('ff:00:1a')).toEqual([0xff, 0x00, 0x1a]);
    expect(parseHexBytes('')).toEqual([]);
    expect(() => parseHexBytes('zz')).toThrow(/bad byte/);
    // odd-length token is not a valid byte
    expect(() => parseHexBytes('f')).toThrow(/bad byte/);
  });
});
