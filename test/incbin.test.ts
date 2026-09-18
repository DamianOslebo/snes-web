import { describe, expect, it } from 'vitest';
import { assemble } from '../src/asm/assembler';
import { buildRom, ROM_ENTRY, ROM_SIZE } from '../src/asm/rom';
import { looksLikeSnesRom } from '../src/core/rom-check';

const ORIGIN = 0x8000;

const hexBytes = (r: ReturnType<typeof assemble>): string =>
  Array.from(r.bytes).map((b) => b.toString(16).padStart(2, '0')).join(' ');

const expectOk = (src: string, origin: number, includes: Record<string, Uint8Array>) => {
  const r = assemble(src, origin, includes);
  expect(r.ok, r.errors.map((e) => `line ${e.line}: ${e.message}`).join('; ')).toBe(true);
  return r;
};

const expectFail = (src: string, origin: number, includes: Record<string, Uint8Array> | undefined, match: RegExp): void => {
  const r = assemble(src, origin, includes);
  expect(r.ok).toBe(false);
  expect(r.errors).toHaveLength(1);
  expect(r.errors[0].message).toMatch(match);
};

const DATA = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);

describe('.incbin (binary data include)', () => {
  it('embeds the file bytes at the directive position, verbatim', () => {
    const r = expectOk([
      'LDA #$00',
      '.incbin "d.bin"',
      'NOP',
    ].join('\n'), ORIGIN, { 'd.bin': DATA });
    expect(hexBytes(r)).toBe('a9 00 de ad be ef ea');
  });

  it('accepts the .bin alias, bare (unquoted) names, and names with spaces', () => {
    expect(hexBytes(expectOk('.bin "d.bin"', ORIGIN, { 'd.bin': DATA }))).toBe('de ad be ef');
    expect(hexBytes(expectOk('.incbin d.bin', ORIGIN, { 'd.bin': DATA }))).toBe('de ad be ef');
    expect(hexBytes(expectOk('.incbin \'d.bin\'', ORIGIN, { 'd.bin': DATA }))).toBe('de ad be ef');
    expect(hexBytes(expectOk('.incbin "my tiles.bin"', ORIGIN, { 'my tiles.bin': DATA }))).toBe('de ad be ef');
  });

  it('embeds multiple includes in order', () => {
    const r = expectOk([
      '.incbin "a.bin"',
      'mid:  .incbin "b.bin"',
      'LDA #$FF',
    ].join('\n'), ORIGIN, { 'a.bin': new Uint8Array([1, 2]), 'b.bin': new Uint8Array([3, 4, 5]) });
    expect(hexBytes(r)).toBe('01 02 03 04 05 a9 ff');
  });

  it('resolves a label before the include to the data\'s CPU address', () => {
    const r = expectOk([
      'LDA #$00',
      'data: .incbin "d.bin"',
      'past: NOP',
    ].join('\n'), ORIGIN, { 'd.bin': DATA });
    const data = r.labels.find((l) => l.name === 'data');
    const past = r.labels.find((l) => l.name === 'past');
    expect(data).toEqual({ name: 'data', offset: 2, address: (ORIGIN + 2) & 0xffffff });
    expect(past).toEqual({ name: 'past', offset: 6, address: (ORIGIN + 6) & 0xffffff });
  });

  it('emits a label pointing at the data as an absolute address operand', () => {
    // data is at $8000 (offset 0) — LDA data,X = absolute,X (bd lo hi).
    const r = expectOk([
      'data: .incbin "d.bin"',
      'LDA data,X',
    ].join('\n'), ORIGIN, { 'd.bin': DATA });
    expect(hexBytes(r)).toBe('de ad be ef bd 00 80');
  });

  it('branches correctly over included data to a label past it', () => {
    // BRA at offset 0 (2 B); 4-byte include at 2..5; past at 6 → rel = 6-2 = +4.
    const r = expectOk([
      'BRA past',
      '.incbin "d.bin"',
      'past:  NOP',
    ].join('\n'), ORIGIN, { 'd.bin': DATA });
    expect(hexBytes(r)).toBe('80 04 de ad be ef ea');
  });

  it('lists the loaded files when the name is unknown', () => {
    expectFail('.incbin "nope.bin"', ORIGIN, { 'd.bin': DATA }, /unknown include "nope\.bin" \(loaded: d\.bin\)/);
  });

  it('fails with a line number when no data files are loaded at all', () => {
    const r = assemble('.incbin "d.bin"', ORIGIN, undefined);
    expect(r.ok).toBe(false);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0].line).toBe(1);
    expect(r.errors[0].message).toMatch(/no data files are loaded/);
  });

  it('fails on an empty operand', () => {
    const r = assemble('.incbin', ORIGIN, { 'd.bin': DATA });
    expect(r.ok).toBe(false);
    expect(r.errors[0].message).toMatch(/needs a file name/);
  });

  it('still produces a runnable SFC through buildRom', () => {
    const r = expectOk([
      'LDA #$00',
      'data: .incbin "d.bin"',
      'NOP',
    ].join('\n'), ROM_ENTRY, { 'd.bin': DATA });
    const rom = buildRom(r.bytes);
    expect(rom.length).toBe(ROM_SIZE);
    expect(looksLikeSnesRom(rom)).toBe(true);
    // The data sits at the assembled offset (file $0000 + 2), byte-identical.
    expect(Array.from(rom.slice(2, 6))).toEqual([0xde, 0xad, 0xbe, 0xef]);
  });

  it('lets buildRom reject data that overflows the 32 KB entry region', () => {
    const big = new Uint8Array(0x7fb1); // 1 past MAX_CODE (0x7fb0 = 32688 B)
    const r = expectOk('.incbin "big.bin"', ORIGIN, { 'big.bin': big });
    expect(r.bytes.length).toBe(0x7fb1);
    expect(() => buildRom(r.bytes)).toThrow(/max 32688 bytes/);
  });

  it('accepts exactly-32 KB-of-code as the boundary', () => {
    const fit = new Uint8Array(0x7fb0);
    const r = expectOk('.incbin "fit.bin"', ORIGIN, { 'fit.bin': fit });
    expect(() => buildRom(r.bytes)).not.toThrow();
  });

  it('keeps .incbin listed as a supported directive in unknown-directive errors', () => {
    const r = assemble('.bogus x');
    expect(r.ok).toBe(false);
    expect(r.errors[0].message).toMatch(/\.incbin/);
  });
});
