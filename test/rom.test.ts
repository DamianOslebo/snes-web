import { describe, expect, it } from 'vitest';
import {
  buildRom,
  bytesToBase64,
  base64ToBytes,
  ROM_SIZE,
  ROM_ENTRY,
} from '../src/asm/rom';
import { looksLikeSnesRom } from '../src/core/rom-check';
import { assemble } from '../src/asm/assembler';

/** A few known, non-empty code bytes for the layout assertions. */
const CODE = new Uint8Array([0xa9, 0x00, 0x85, 0x00, 0xcb, 0x80, 0xfd]);

/** Read `n` ASCII bytes of the ROM at `off` as a string. */
const titleAt = (rom: Uint8Array, off: number, n: number): string =>
  String.fromCharCode(...Array.from(rom.subarray(off, off + n)));

describe('buildRom — layout', () => {
  it('produces exactly 256 KB (256 KB LoROM)', () => {
    expect(ROM_SIZE).toBe(0x40000);
    expect(buildRom(CODE).length).toBe(ROM_SIZE);
  });

  it('copies the code byte-for-byte at the entry ($8000)', () => {
    const rom = buildRom(CODE);
    expect(Array.from(rom.subarray(ROM_ENTRY, ROM_ENTRY + CODE.length))).toEqual(
      Array.from(CODE),
    );
  });

  it('points the reset and NMI vectors at $8000 (bytes 00 80)', () => {
    const rom = buildRom(CODE);
    // reset vector ($7FFC) → $8000, little-endian: low byte 00, high byte 80
    expect(rom[0x7ffc]).toBe(0x00);
    expect(rom[0x7ffd]).toBe(0x80);
    // NMI vector ($7FFE) → $8000
    expect(rom[0x7ffe]).toBe(0x00);
    expect(rom[0x7fff]).toBe(0x80);
  });

  it('writes a null-padded 12-byte title at $7FC0 (default and custom)', () => {
    const rom = buildRom(CODE);
    expect(titleAt(rom, 0x7fc0, 10)).toBe('ASM 65C816');
    expect(rom[0x7fc0 + 10]).toBe(0); // null-padded out to 12
    expect(rom[0x7fc0 + 11]).toBe(0);

    const named = buildRom(CODE, { title: 'HELLO' });
    expect(titleAt(named, 0x7fc0, 5)).toBe('HELLO');
    expect(named[0x7fc0 + 5]).toBe(0);
  });

  it('emits a clean standard SFC header (Mapper 0, entry $8000, LoROM)', () => {
    const rom = buildRom(CODE);
    expect(rom[0x00]).toBe(0x00); // no S-RAM (Mapper 0)
    expect(rom[0x07]).toBe(0x33); // SFC_M1
    expect(rom[0x08]).toBe(0xff); // SFC_M2
    expect(rom[0x0b]).toBe(0x00); // entry $8000 (lo)
    expect(rom[0x0c]).toBe(0x80); // entry (hi)
    expect(rom[0x0d]).toBe(0x01); // version 1
    expect(rom[0x0e]).toBe(0x00); // LoROM
  });

  it('computes correct ROM and header checksums (standard two-step order)', () => {
    const rom = buildRom(CODE);
    // ROM checksum ($09) = 0xFF − (sum of all image bytes except $09) & 0xFF.
    // Computed LAST, so it includes the final header-checksum byte ($0A).
    let sum = 0;
    for (let i = 0; i < rom.length; i++) if (i !== 0x09) sum = (sum + rom[i]) & 0xffffff;
    expect(rom[0x09]).toBe((0xff - (sum & 0xff)) & 0xff);

    // Header checksum ($0A) = 0xFF − (sum of header $00–$7F except $0A) & 0xFF.
    // Computed FIRST, with the ROM-checksum byte ($09) still zero — hence $09 is
    // excluded here (it is not part of the header-checksum input).
    let hsum = 0;
    for (let i = 0; i < 0x80; i++) if (i !== 0x0a && i !== 0x09) hsum = (hsum + rom[i]) & 0xffffff;
    expect(rom[0x0a]).toBe((0xff - (hsum & 0xff)) & 0xff);
  });

  it('satisfies looksLikeSnesRom (the app pre-load gate)', () => {
    expect(looksLikeSnesRom(buildRom(CODE))).toBe(true);
  });

  it('rejects an empty program and one past the entry region', () => {
    expect(() => buildRom(new Uint8Array(0))).toThrow(/empty program/);
    const tooBig = new Uint8Array(ROM_SIZE - ROM_ENTRY + 1); // one byte over MAX_CODE
    expect(() => buildRom(tooBig)).toThrow(/entry region|bytes\)/);
  });
});

describe('base64 handoff', () => {
  it('round-trips byte arrays of every size the app will use', () => {
    for (const len of [1, 2, 3, 100, 0x1000, 0x8000, ROM_SIZE]) {
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) bytes[i] = i & 0xff;
      const back = base64ToBytes(bytesToBase64(bytes));
      expect(Array.from(back), `len=${len}`).toEqual(Array.from(bytes));
    }
  });
});

describe('assemble → ROM → gate (integration)', () => {
  it('wraps a cold-boot-safe assembled program in a loadable ROM', () => {
    // Cold-boot-safe: no trailing RTS (there is no return address on a cold
    // boot); parks in WAI and loops. Assembled at the ROM entry ($8000).
    const src = ['LDA #$00', 'STA $00', 'loop:', 'WAI', 'BRA loop'].join('\n');
    const asm = assemble(src, ROM_ENTRY);
    expect(asm.ok, asm.errors.map((e) => `line ${e.line}: ${e.message}`).join('; ')).toBe(
      true,
    );
    const rom = buildRom(asm.bytes);
    expect(looksLikeSnesRom(rom)).toBe(true);
    // and the code really is at the entry
    expect(Array.from(rom.subarray(ROM_ENTRY, ROM_ENTRY + asm.bytes.length))).toEqual(
      Array.from(asm.bytes),
    );
  });
});
