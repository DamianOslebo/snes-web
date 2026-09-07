import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { looksLikeSnesRom } from '../src/core/rom-check';

const romPath = fileURLToPath(new URL('./cpu_test/cputest-basic.sfc', import.meta.url));
const cputest = new Uint8Array(readFileSync(romPath));
const spctest = new Uint8Array(
  readFileSync(fileURLToPath(new URL('./spc700_test/spctest.sfc', import.meta.url))),
);

describe('looksLikeSnesRom', () => {
  it('accepts the repo ROMs (HiROM and LoROM vector layouts)', () => {
    expect(looksLikeSnesRom(cputest)).toBe(true);
    expect(looksLikeSnesRom(spctest)).toBe(true);
  });

  it('accepts the repo ROM behind a 512-byte header', () => {
    const withHeader = new Uint8Array(0x200 + cputest.length);
    withHeader.set(cputest, 0x200);
    expect(looksLikeSnesRom(withHeader)).toBe(true);
  });

  it('accepts minimal synthetic images with a $0080 vector', () => {
    const lo = new Uint8Array(0x8000);
    lo[0x7fc0] = 0x00;
    lo[0x7fc1] = 0x80;
    expect(looksLikeSnesRom(lo)).toBe(true);
    const hi = new Uint8Array(0x8000);
    hi[0x7ffc] = 0x00;
    hi[0x7ffd] = 0x80;
    expect(looksLikeSnesRom(hi)).toBe(true);
  });

  it('rejects a dev-server HTML fallback page', () => {
    const html = new Uint8Array(
      Buffer.from('<!doctype html><html><head><title>snes-web</title></head><body></body></html>'),
    );
    expect(looksLikeSnesRom(html)).toBe(false);
  });

  it('rejects an all-zero buffer and a too-small one', () => {
    expect(looksLikeSnesRom(new Uint8Array(0x10000))).toBe(false);
    expect(looksLikeSnesRom(new Uint8Array(16))).toBe(false);
  });

  it('rejects a full-size file whose vectors are mangled', () => {
    const corrupted = new Uint8Array(cputest);
    // Break every candidate vector slot the check looks at.
    for (const i of [0x7fc0, 0x7ffc, 0x200 + 0x7fc0, 0x200 + 0x7ffc]) {
      corrupted[i] = 0x00;
      corrupted[i + 1] = 0x00;
    }
    expect(looksLikeSnesRom(corrupted)).toBe(false);
  });
});
