import { describe, expect, it } from 'vitest';
import { assemble } from '../src/asm/assembler';
import {
  buildDriver,
  DRIVER_BYTE_LENGTH,
  DRIVER_REG_WRITES,
  R_DIR,
  R_KON,
  SPC_SLEEP,
} from '../src/spc/driver';
import {
  SPC_DIR_OFF,
  SPC_DRIVER_OFF,
  SPC_MAX_BLOCK,
  SPC_SAMPLE_OFF,
  SPC_START_ADDR,
  buildDirectory,
  buildSample,
  buildSpc,
  spcBlocks,
  spcBinLength,
  spcGlue,
  spcLayout,
  spcRamImage,
} from '../src/spc/layout';
import { BRR_SAMPLES_PER_BLOCK, decodeBrr } from '../src/spc/brr';

const SAMPLE_BYTES = 800 * 9; // 800 BRR blocks × 9 bytes
const DIR_BYTES = [0x80, 0x00, 0x80, 0x00];

describe('driver blob', () => {
  it('is 122 bytes, opens with CLRP (0x20), closes with SLEEP (0xEF)', () => {
    const d = buildDriver();
    expect(d.length).toBe(122);
    expect(DRIVER_BYTE_LENGTH).toBe(122);
    expect(d[0]).toBe(0x20); // CLRP
    expect(d[d.length - 1]).toBe(0xef); // SLEEP
  });

  it('writes exactly 20 S-DSP registers; DIR=$20 and KON=$01 (last)', () => {
    expect(DRIVER_REG_WRITES.length).toBe(20);
    expect(DRIVER_REG_WRITES.find((w) => w.reg === R_DIR)!.value).toBe(0x20);
    const last = DRIVER_REG_WRITES[DRIVER_REG_WRITES.length - 1];
    expect(last.reg).toBe(R_KON);
    expect(last.value).toBe(0x01);
  });

  it('emits each register as a $F2 select then a $F3 data write (0x8F value-then-address)', () => {
    const d = buildDriver();
    // After CLRP (index 0), every 6-byte group is: 8F reg F2 | 8F value F3.
    let i = 1;
    for (const w of DRIVER_REG_WRITES) {
      expect(d[i]).toBe(0x8f);
      expect(d[i + 1]).toBe(w.reg);
      expect(d[i + 2]).toBe(0xf2);
      expect(d[i + 3]).toBe(0x8f);
      expect(d[i + 4]).toBe(w.value);
      expect(d[i + 5]).toBe(0xf3);
      i += 6;
    }
    expect(d[i]).toBe(SPC_SLEEP);
  });
});

describe('the looping sample', () => {
  it('is 7200 bytes and decodes back to 12800 samples', () => {
    const s = buildSample();
    expect(s.length).toBe(SAMPLE_BYTES);
    expect(decodeBrr(s).length).toBe(800 * BRR_SAMPLES_PER_BLOCK);
  });

  it('sets the LOOP and END bits only on the last block', () => {
    const s = buildSample();
    // Header is byte 0 of each 9-byte block. LOOP = bit1, END = bit0.
    for (let b = 0; b < 799; b++) {
      expect(s[b * 9] & 0b11).toBe(0b00); // neither loop nor end, all but the last
    }
    const lastHeader = s[799 * 9];
    expect(lastHeader & 0b11).toBe(0b11); // loop + end on the final block
  });
});

describe('the source directory', () => {
  it('points source 0 (SA,LSA) at $0080, little-endian', () => {
    expect(Array.from(buildDirectory())).toEqual(DIR_BYTES);
  });
});

describe('spc.bin block list (Appendix D)', () => {
  it('lists driver, the sample in ≤255-byte chunks, the directory, then the terminator', () => {
    const blocks = spcBlocks();
    expect(blocks[0]).toEqual({ quantity: DRIVER_BYTE_LENGTH, address: SPC_DRIVER_OFF });
    const dir = blocks.filter((b) => b.address === SPC_DIR_OFF);
    expect(dir).toEqual([{ quantity: 4, address: SPC_DIR_OFF }]);
    expect(blocks[blocks.length - 1]).toEqual({ quantity: 0, address: SPC_START_ADDR });

    const sampleBlocks = blocks.filter(
      (b) => b.address !== SPC_DIR_OFF && b.quantity !== 0 && b.address !== SPC_DRIVER_OFF,
    );
    expect(sampleBlocks.reduce((n, b) => n + b.quantity, 0)).toBe(SAMPLE_BYTES);
    for (const b of sampleBlocks) expect(b.quantity).toBeLessThanOrEqual(SPC_MAX_BLOCK);
    // successive sample chunks are contiguous in SPC RAM
    for (let i = 1; i < sampleBlocks.length; i++) {
      expect(sampleBlocks[i].address).toBe(sampleBlocks[i - 1].address + sampleBlocks[i - 1].quantity);
    }
    expect(sampleBlocks[0].address).toBe(SPC_SAMPLE_OFF);
  });

  it('buildSpc() is the right total length and round-trips its block headers', () => {
    const bin = buildSpc();
    expect(bin.length).toBe(spcBinLength());

    const expected = spcBlocks();
    let p = 0;
    for (const b of expected) {
      expect(bin[p]).toBe(b.quantity & 0xff);
      expect(bin[p + 1]).toBe((b.quantity >> 8) & 0xff);
      expect(bin[p + 2]).toBe(b.address & 0xff);
      expect(bin[p + 3]).toBe((b.address >> 8) & 0xff);
      p += 4 + b.quantity;
    }
    expect(p).toBe(bin.length);
  });

  it('carries the exact driver bytes in its first data payload', () => {
    const bin = buildSpc();
    const drv = buildDriver();
    for (let i = 0; i < drv.length; i++) expect(bin[4 + i]).toBe(drv[i]);
  });

  it('ends with the directory block (header + payload) then the 4-byte terminator', () => {
    const bin = buildSpc();
    const n = bin.length;
    // Last 12 bytes: dir header (qty=4, addr=$2000) + dir payload + terminator (qty=0, addr=$0000).
    expect(Array.from(bin.slice(n - 12))).toEqual([
      0x04, 0x00,   // dir qty = 4
      0x00, 0x20,   // dir addr = $2000
      ...DIR_BYTES, // directory payload (SA,LSA @ $0080)
      0x00, 0x00,   // terminator qty = 0
      0x00, 0x00,   // terminator addr = $0000 (SPU start)
    ]);
  });
});

describe('spcRamImage()', () => {
  it('places the driver @ $0000, the sample @ $0080, the directory @ $2000', () => {
    const img = spcRamImage();
    expect(img.length).toBe(0x10000);
    const drv = buildDriver();
    for (let i = 0; i < drv.length; i++) expect(img[SPC_DRIVER_OFF + i]).toBe(drv[i]);
    const s = buildSample();
    expect(img[SPC_SAMPLE_OFF]).toBe(s[0]);
    expect(img[SPC_SAMPLE_OFF + 8]).toBe(s[8]);
    expect(img[SPC_DIR_OFF]).toBe(DIR_BYTES[0]);
    expect(img[SPC_DIR_OFF + 3]).toBe(DIR_BYTES[3]);
  });
});

describe('spcGlue()', () => {
  it('assembles cleanly in pure 8-bit mode, with its spc.bin embedded verbatim', () => {
    const glue = spcGlue('spc.bin');
    const bin = buildSpc();
    const r = assemble(glue, 0x8000, { 'spc.bin': bin });
    expect(r.errors).toEqual([]);
    // The .incbin payload lands byte-for-byte at the tail of the program.
    const tail = r.bytes.slice(r.bytes.length - bin.length);
    expect(Array.from(tail)).toEqual(Array.from(bin));
  });

  it('is pure 8-bit: no REP, no SEP, no 16-bit immediates it could not encode', () => {
    const glue = spcGlue('spc.bin').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith(';'));
    const mnemonics = glue.map((l) => l.split(/\s+/)[0].toLowerCase());
    for (const m of mnemonics) {
      expect(['rep', 'sep']).not.toContain(m);
    }
    // and it uses the label-resolvable address load and the port window
    expect(mnemonics).toContain('pea');
    expect(glue.join('\n')).toContain('spc_load:');
    expect(glue.join('\n')).toContain('.incbin "spc.bin"');
  });
});

describe('spcLayout()', () => {
  it('reports the offsets, the block list, and the spc.bin size', () => {
    const L = spcLayout() as {
      driver: { offset: number; size: number };
      sample: { offset: number; size: number; loop: boolean };
      directory: { offset: number; bytes: number[] };
      startAddr: number;
      spcBinBytes: number;
      blocks: { quantity: number; address: number }[];
    };
    expect(L.driver).toEqual({ offset: 0x0000, size: 122 });
    expect(L.sample.offset).toBe(0x0080);
    expect(L.sample.size).toBe(SAMPLE_BYTES);
    expect(L.sample.loop).toBe(true);
    expect(L.directory.bytes).toEqual(DIR_BYTES);
    expect(L.startAddr).toBe(0x0000);
    expect(L.spcBinBytes).toBe(buildSpc().length);
    expect(L.blocks[0]).toEqual({ quantity: 122, address: 0x0000 });
  });
});
