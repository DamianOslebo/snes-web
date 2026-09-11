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

  it('emits the cart header at $7FB0 (snes9x reads RomHeader = ROM + 0x7FB0)', () => {
    const rom = buildRom(CODE);
    // ROMName at $7FC0 (RomHeader[0x10])
    expect(titleAt(rom, 0x7fc0, 10)).toBe('ASM 65C816');
    // The header field group at $7FD5–$7FDA (RomHeader[0x25]–[0x2A])
    expect(rom[0x7fd5]).toBe(0x30); // ROMSpeed
    expect(rom[0x7fd6]).toBe(0x00); // ROMType
    expect(rom[0x7fd7]).toBe(0x08); // ROMSize — the load-gate byte, valid in $07–$1E
    expect(rom[0x7fd8]).toBe(0x00); // SRAMSize — no S-RAM
    expect(rom[0x7fd9]).toBe(0x00); // ROMRegion
    expect(rom[0x7fda]).toBe(0x00); // CompanyId
    // And the old, wrong $0000 header bytes are gone (zero in a zero-filled ROM).
    expect(rom[0x07]).toBe(0x00);
    expect(rom[0x08]).toBe(0x00);
  });

  it('passes snes9x InitROM corrupt-ROM gate (memmap.c:1949)', () => {
    // The gate: SRAMSize = ROM[0x7FD8]; ROMSize = ROM[0x7FD7]; reject if
    // SRAMSize > 16 || ROMSize < 7 || ROMSize - 7 > 23.
    const rom = buildRom(CODE);
    const romSize = rom[0x7fd7];
    const sramSize = rom[0x7fd8];
    expect(sramSize > 16 || romSize < 7 || romSize - 7 > 23).toBe(false);
  });

  it('computes correct 16-bit ROM + complement checksums at $7FDC–$7FDF', () => {
    const rom = buildRom(CODE);
    // sum over every byte except the four checksum bytes ($7FDC–$7FDF)
    let sum = 0;
    for (let i = 0; i < rom.length; i++) {
      if (i >= 0x7fdc && i <= 0x7fdf) continue;
      sum = (sum + rom[i]) & 0xffff;
    }
    const romChk = (0x0000 - sum) & 0xffff;
    const compChk = (0xffff - sum) & 0xffff;
    // stored little-endian (low byte first)
    expect(rom[0x7fde] | (rom[0x7fdf] << 8)).toBe(romChk);
    expect(rom[0x7fdc] | (rom[0x7fdd] << 8)).toBe(compChk);
    // standard relation: complement is one less (mod 0x10000), i.e. comp+1 ≡ rom
    expect((compChk + 1) & 0xffff).toBe(romChk & 0xffff);
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
