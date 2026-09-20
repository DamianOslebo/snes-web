import { describe, expect, it } from 'vitest';
import { VRAM_SIZE, buildVram, buildVramCompact, vramGlue, type VramBlock } from '../src/gfx/vram';
import { assemble } from '../src/asm/assembler';
import { buildRom, ROM_SIZE } from '../src/asm/rom';
import { looksLikeSnesRom } from '../src/core/rom-check';
import type { Rgb15 } from '../src/gfx/palette';
import type { TilemapEntry } from '../src/gfx/tilemap';

// `buildRom` caps the entry region at file $0000–$7FB0 (32,688 B).
const MAX_CODE = 0x7fb0;

const checker = (): number[][] =>
  Array.from({ length: 8 }, (_, r) => Array.from({ length: 8 }, (_, c) => (r + c) % 2));
const bars = (): number[][] =>
  Array.from({ length: 8 }, () => [0, 1, 2, 3, 0, 1, 2, 3]);
const palette = (): Rgb15[] => {
  const out: Rgb15[] = [{ r: 0, g: 0, b: 0, transparent: true }];
  for (let i = 1; i < 16; i++) out.push({ r: (i * 2) & 0x1f, g: ((15 - i) * 2) & 0x1f, b: 0, transparent: false });
  return out;
};
const map = (): TilemapEntry[] =>
  new Array(1024).fill(0).map((_, i) => ({
    tile: i % 3,
    palette: i % 2,
    priority: false,
    flipX: i % 4 === 0,
    flipY: i % 8 === 0,
  }));

/**
 * Simulate exactly what the generated glue does at run time: walk the block
 * table and stream the blob into a fresh 64 KB VRAM, honoring each block's
 * word destination. The resulting image is what the PPU would display.
 */
function simulateLoad(compact: { blob: Uint8Array; blocks: VramBlock[] }): Uint8Array {
  const vram = new Uint8Array(VRAM_SIZE);
  let off = 0;
  for (const b of compact.blocks) {
    const n = b.len * 2;
    vram.set(compact.blob.slice(off, off + n), b.dest * 2);
    off += n;
  }
  return vram;
}

describe('buildVramCompact — mode 0 (8x8, 2bpp)', () => {
  const opts = { mode: 0, tiles: [checker(), bars()], palettes: [palette()], tilemap: map(), tileBase: 0, paletteBase: 0, mapBase: 0x8000 };
  const full = buildVram(opts);
  const compact = buildVramCompact(opts);

  it('re-homes the tilemap into a displayable NameBase (≤ $7000)', () => {
    // Char region is 32 B (2 tiles × 16 B), so the first 4 KB boundary at/after
    // it is $1000 — a valid BG NameBase, unlike the editor default of $8000.
    expect(compact.mapBase).toBe(0x1000);
    expect(compact.mapBase).toBeLessThanOrEqual(0x7000);
    expect(compact.bgmode).toBe(0);
  });

  it('is a few KB, not 64 KB — comfortably under the 32 KB code cap', () => {
    expect(compact.blob.length).toBe(32 + 2048 + 32); // char + tilemap + palette
    expect(compact.blob.length).toBeLessThan(MAX_CODE);
  });

  it('streams into exactly the regions the full image used (byte-for-byte round-trip)', () => {
    const vram = simulateLoad(compact);
    // char region, verbatim
    expect(Array.from(vram.subarray(0, 32))).toEqual(Array.from(full.subarray(0, 32)));
    // tilemap, at the re-homed base, byte-identical to the source map
    expect(Array.from(vram.subarray(compact.mapBase, compact.mapBase + 2048))).toEqual(
      Array.from(full.subarray(0x8000, 0x8000 + 2048)),
    );
    // palette, verbatim
    expect(Array.from(vram.subarray(0xc000, 0xc020))).toEqual(Array.from(full.subarray(0xc000, 0xc020)));
  });

  it('splits the tilemap into ≤255-word chunks whose lengths sum to the blob', () => {
    expect(compact.blocks.every((b) => b.len <= 255)).toBe(true);
    const totalWords = compact.blocks.reduce((s, b) => s + b.len, 0);
    expect(totalWords).toBe(Math.ceil((32 + 2048 + 32) / 2));
  });
});

describe('vramGlue — assembles, and a full hello-world ROM', () => {
  const opts = { mode: 0, tiles: [checker(), bars()], palettes: [palette()], tilemap: map(), tileBase: 0, paletteBase: 0, mapBase: 0x8000 };
  const compact = buildVramCompact(opts);

  it('assembles cleanly in pure 8-bit mode with its vram.bin embedded verbatim', () => {
    const glue = vramGlue(compact.mapBase, compact.bgmode, compact.blocks, 'vram.bin');
    const r = assemble(glue, 0x8000, { 'vram.bin': compact.blob });
    expect(r.errors).toEqual([]);
    // The .incbin payload lands byte-for-byte at the tail of the program.
    const tail = r.bytes.slice(r.bytes.length - compact.blob.length);
    expect(Array.from(tail)).toEqual(Array.from(compact.blob));
  });

  it('is pure 8-bit and carries the re-homed map base into BG12NBA', () => {
    const glue = vramGlue(compact.mapBase, compact.bgmode, compact.blocks, 'vram.bin');
    const lines = glue.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith(';'));
    const mnemonics = lines.map((l) => l.split(/\s+/)[0].toLowerCase());
    for (const m of mnemonics) expect(['rep', 'sep']).not.toContain(m);
    expect(mnemonics).toContain('pea');
    expect(glue).toContain('vram_load:');
    expect(glue).toContain('.incbin "vram.bin"');
    expect(glue).toContain('sta $210b'); // BG12NBA — the tilemap's 4 KB window
    expect(glue).toContain('sta $2118'); // word-stream into VRAM
  });

  it('produces a valid 256 KB LoROM SFC from the agent\'s minimal entry', () => {
    // The program the agent writes: a reset entry that calls the generated
    // glue, then idles. `vram_load` is defined by the glue; the assembler
    // (two-pass) resolves the forward label.
    const entry = 'reset:\n  jsr vram_load\nidle:\n  bra idle\n\n';
    const glue = vramGlue(compact.mapBase, compact.bgmode, compact.blocks, 'vram.bin');
    const r = assemble(entry + glue, 0x8000, { 'vram.bin': compact.blob });
    expect(r.errors).toEqual([]);
    expect(r.bytes.length).toBeGreaterThan(0);
    expect(r.bytes.length).toBeLessThanOrEqual(MAX_CODE);

    const rom = buildRom(r.bytes, { title: 'HELLO WORLD ' });
    expect(rom.length).toBe(ROM_SIZE);
    expect(looksLikeSnesRom(rom)).toBe(true);
    // reset vector at file $7FFC points at $008000 (the LoROM entry)
    expect(rom[0x7ffc]).toBe(0x00);
    expect(rom[0x7ffd]).toBe(0x80);
  });
});
