/**
 * `lzss-core` — prove the *65C816* `lz_decode` (src/asm/lzss.ts) decompresses
 * correctly on REAL silicon. This is the gold-standard companion to
 * `test/lzss.test.ts`:
 *
 *   - `lzss.test.ts` proves `lzssDecompress(lzssCompress(x)) === x` in the JS
 *     reference decoder (the BRR house pattern: encoder + reference decoder,
 *     round-trip proven).
 *   - HERE we assemble a real ROM that (1) bakes a COMPRESSED blob via
 *     `.incbin`, (2) runs the generated `lz_decode` to expand it into the
 *     WRAM scratch buffer ($0200), then idles — and read the WRAM back on the
 *     snes9x core and assert it is BYTE-IDENTICAL to the original.
 *
 * That closes the loop the TS reference decoder can't: the compressor and the
 * reference decoder could both share a bug the 65C816 routine has (a bad ZP
 * slot, a wrong branch, an off-by-one in the copy loop). Reading the
 * decompressed WRAM back on the real core is the only way to prove the actual
 * silicon agrees.
 *
 * **Memory model (verified against snes9x memmap.c):** `lz_decode` writes the
 * decompressed bytes to absolute `$0200` (PHB=$00, 8-bit mode). MAP_SYSTEM
 * maps banks $00–$3F offset $0000–$1FFF → `Memory.RAM` (WRAM); MAP_WRAM maps
 * bank $7E → the SAME `Memory.RAM`. So the ROM writes WRAM[$0200] and the
 * test reads it back via `core.readMem(0x7e, 0x0200, n)` — identical RAM. The
 * ROM code (bank $00, offset $8000+) and the `.incbin` blob (bank $00, offset
 * $8xxx) are DISJOINT from WRAM, so neither is clobbered.
 *
 * Core-free section (always runs) asserts the mixed blob round-trips through
 * the reference decoder, compresses to SMALLER than raw (so the COPY path is
 * genuinely exercised — a run of repeats only a back-reference can encode),
 * and that the composed ROM assembles cleanly.
 */
import { describe, expect, it, beforeAll } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { WasmCore } from '../src/core/wasm-core';
import type { S9xModule } from '../src/core/wasm-core';
import { assemble } from '../src/asm/assembler';
import { buildRom } from '../src/asm/rom';
import { buildSpc } from '../src/spc/layout';
import {
  LZ_SCRATCH,
  lzDecodeCall,
  lzssCompress,
  lzssDecompress,
  lzssGlue,
} from '../src/asm/lzss';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const JS = resolve(root, 'public/core/build/snes9x.js');
const WASM = resolve(root, 'public/core/build/snes9x.wasm');
const haveBuild = existsSync(JS) && existsSync(WASM);

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * A deterministic blob that exercises BOTH decoder paths:
 *   - a slow ramp (unique bytes → forces LITERAL tokens),
 *   - a long run of one byte (→ forces COPY tokens, offset 1),
 *   - a repeating 4-byte pattern (→ forces COPY tokens, offset 4),
 *   - trailing unique bytes (literals right at the stream end).
 * The mix means a broken literal path, a broken copy path, OR a broken
 * boundary-crossing case would each produce a mismatch.
 */
function makeMixedBlob(): Uint8Array {
  const parts: number[] = [];
  for (let i = 0; i < 64; i++) parts.push(i & 0xff);            // ramp → literals
  for (let i = 0; i < 512; i++) parts.push(0xab);              // run → copies
  const pat = [0xde, 0xad, 0xbe, 0xef];                        // pattern → copies
  for (let i = 0; i < 1024; i++) parts.push(pat[i % 4]);
  for (let i = 0; i < 33; i++) parts.push((0x100 - i) & 0xff); // unique tail
  return Uint8Array.from(parts);
}

/**
 * Compose a ROM whose entry point decompresses `compressed` (the LZSS stream
 * of `known`) into the WRAM scratch, then idles. Layout:
 *   [preamble: set $40/$41=blob, $42/$43=LZ_SCRATCH, jsr lz_decode]
 *   idle: bra idle
 *   [lz_decode routine (lzssGlue)]
 *   lzblob: .incbin (the compressed bytes)
 */
function composeLzRom(compressed: Uint8Array): Uint8Array {
  const src =
    lzDecodeCall('lzblob') + '\n' +
    'idle:\n' +
    '  bra idle\n' +
    '\n' +
    lzssGlue() + '\n' +
    'lzblob:\n' +
    '  .incbin "lz.bin"\n';
  const r = assemble(src, 0x008000, { 'lz.bin': compressed });
  if (!r.ok) throw new Error('assemble failed: ' + r.errors.map((e) => e.message).join('; '));
  return buildRom(r.bytes, { title: 'LZSSCORE' });
}

// --- core-free: the blob round-trips, compresses, and the ROM assembles ----

describe('lzss — the mixed blob (core-free)', () => {
  const known = makeMixedBlob();
  const enc = lzssCompress(known);

  it('round-trips byte-identically through the reference decoder', () => {
    expect(bytesEqual(lzssDecompress(enc), known)).toBe(true);
  });

  it('compresses to SMALLER than raw (so the copy path is genuinely exercised)', () => {
    expect(enc.length).toBeLessThan(known.length);
  });

  it('the composed ROM assembles cleanly', () => {
    expect(() => composeLzRom(enc)).not.toThrow();
  });
});

// --- real core: the 65C816 decoder expands the blob into WRAM --------------

describe.skipIf(!haveBuild)('lz_decode on the REAL snes9x core', () => {
  let M: S9xModule;
  let core: WasmCore;

  beforeAll(async () => {
    const src = readFileSync(JS, 'utf8');
    const factory = new Function(`${src}\n;return snesWasm;`)() as unknown as (m: object) => Promise<S9xModule>;
    const wasmB64 = readFileSync(WASM, 'base64');
    M = await factory({
      locateFile: (f: string) => (f === 'snes9x.wasm' ? `data:application/wasm;base64,${wasmB64}` : f),
      print: () => {}, printErr: () => {}, out: () => {}, err: () => {},
    });
    core = new WasmCore(M, []);
  }, 60_000);

  /**
   * Load a ROM, let it run past `lz_decode` into the idle loop, and read the
   * decompressed WRAM scratch back. `expected` is the original uncompressed
   * bytes; the proof is that `core.readMem(0x7e, LZ_SCRATCH, len) === expected`.
   *
   * `lz_decode` is NOT fast: its copy loop is ~29 65C816 cycles per output
   * byte, so an N-byte blob costs roughly N×29 cycles ≈ N/1700 frames (a
   * 7454-byte `buildSpc()` blob is ~5 frames; the 1633-byte mixed blob ~1).
   * Reading a *fixed* frame count is fragile — it passes the small blob and
   * silently reads an UNFINISHED buffer (the core pre-fills WRAM with 0x55, so
   * the unwritten tail reads as a solid 0x55 run) for the large one. Instead,
   * wait on the routine's OWN done-condition: it decrements `out_total` (ZP
   * $48/$49) by the size of every literal/copy and reaches exactly 0 on the
   * final byte before `rts`. Before it starts, $48/$49 hold the core's initial
   * WRAM fill (0x5555, never 0), so `$48/$49 == 0` unambiguously means done.
   * The frame cap is only a safety valve so a genuinely stuck routine can't
   * hang CI — every real blob finishes far below it.
   */
  async function decompressAndRead(known: Uint8Array): Promise<Uint8Array> {
    const rom = composeLzRom(lzssCompress(known));
    await core.loadRom(rom);
    const maxFrames = 120; // safety cap; the largest real asset is ~8 KB ≈ 6 frames
    for (let f = 0; f < maxFrames; f++) {
      core.frame();
      const t = core.readMem(0x00, 0x0048, 2); // out_total, ZP $48/$49 (bank $00 low page = WRAM)
      if (t[0] === 0 && t[1] === 0) break;
    }
    const pc = M._core_reg_pc() & 0xffffff;
    if (process.env.LZ_DEBUG) {
      console.log(`[lzss-core] PC=$${pc.toString(16)} len=${known.length}`);
    }
    return core.readMem(0x7e, LZ_SCRATCH, known.length);
  }

  it('expands a mixed literal+copy blob byte-exactly into WRAM', async () => {
    const known = makeMixedBlob();
    const got = await decompressAndRead(known);
    expect(got.length).toBe(known.length);
    expect(bytesEqual(got, known)).toBe(true);
  }, 90_000);

  it('expands a real music asset (buildSpc()) byte-exactly into WRAM', async () => {
    const known = buildSpc();
    const got = await decompressAndRead(known);
    expect(got.length).toBe(known.length);
    expect(bytesEqual(got, known)).toBe(true);
  }, 90_000);
});

describe('harness availability', () => {
  it('records whether the wasm build is present (so CI degrades, not breaks)', () => {
    expect(haveBuild).toBeTypeOf('boolean');
    if (!haveBuild) console.warn('[lzss-core] snes9x.{js,wasm} absent — skipping real-core runs');
  });
});
