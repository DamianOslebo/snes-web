/**
 * `layout` — where the SPU content lives, and how it gets there.
 *
 * Three things are laid down:
 *   1. **The SPC-RAM image** — what the SPU's own 64 KB RAM must contain:
 *      the driver blob @ $0000, the looping BRR note @ $0080, and the
 *      source-directory entry @ $2000. (The S-DSP reads the directory at
 *      page `DIR` — the driver sets `DIR=$20` — and the entry is a
 *      `SA,LSA` pair, little-endian, for source 0.)
 *   2. **`spc.bin`** — the *transfer* stream, in the SNES manual's Appendix D
 *      block-list form: `2B quantity + 2B SPC address + <that many bytes>`,
 *      repeated, terminated by `dw $0000, <start address>`. The main CPU walks
 *      this and feeds the SPU through the $2140–$2143 ports.
 *   3. **The loader glue** — a self-contained, pure-8-bit 65C816 routine
 *      (`spc_load`) the game calls once at startup. It embeds its own
 *      `spc.bin` (so it is label-referable and needs no lo/hi — `PEA label`
 *      hands it the 16-bit address) and streams the whole list to the SPU.
 *
 * EXPERIMENTAL, like the rest of `src/spc/*`: the byte-level port handshake
 * follows the (OCR-garbled) Appendix D text and can only be confirmed on real
 * hardware / the user's phone. What IS pinned by tests: the SPC-RAM placement,
 * the block-list byte structure, the driver blob, and that the glue assembles
 * cleanly under `src/asm/assembler.ts` (proving it stays in 8-bit mode, where
 * the repo's opcode table and the core trivially agree).
 *
 * Pure + node-testable: no DOM, no AudioContext, no fetch.
 */

import { encodeBrr, BRR_SAMPLES_PER_BLOCK } from './brr';
import { buildDriver, DRIVER_BYTE_LENGTH } from './driver';

// --- SPC-RAM placement -------------------------------------------------------
export const SPC_RAM_SIZE = 0x10000;        // the SPU's own 64 KB
export const SPC_DRIVER_OFF = 0x0000;       // driver must live here (IPL ROM ends JMP $0000)
export const SPC_SAMPLE_OFF = 0x0080;       // looping BRR note
export const SPC_DIR_OFF = 0x2000;          // source directory (DIR register = page $20)
export const SPC_START_ADDR = 0x0000;       // where the SPU jumps at the end of the transfer
export const SPC_DIR_PAGE = 0x20;           // DIR register value → directory @ $2000

/**
 * The transfer loop keeps a 1-byte PORT0 byte-counter (0..N-1), so a single
 * block must be ≤ 255 bytes. Longer payloads are split into this many-byte
 * chunks, each an independent block (its own address + count).
 */
export const SPC_MAX_BLOCK = 0xff;

/** Length of the looping note, in BRR blocks. */
export const SPC_SAMPLE_BLOCKS = 800;

/** One entry of the Appendix D block list. */
export interface SpcBlock {
  quantity: number;   // bytes to move (1..255; the terminator is 0)
  address: number;    // destination in SPC RAM
}

function lo16(v: number): number { return v & 0xff; }
function hi16(v: number): number { return (v >> 8) & 0xff; }

// --- the SPC-RAM contents ----------------------------------------------------

/**
 * The looping BRR note: a full-scale sine, 8 clean cycles across the sample,
 * BRR-encoded with the LOOP bit set so the S-DSP repeats it. (The exact pitch
 * is a bonus — the by-ear test is "a sustained tone comes out," which is what
 * proves the whole SPU path works.)
 */
export function buildSample(): Uint8Array {
  const n = SPC_SAMPLE_BLOCKS * BRR_SAMPLES_PER_BLOCK;
  const pcm = new Int16Array(n);
  const cycles = 8;
  for (let i = 0; i < n; i++) {
    pcm[i] = Math.round(Math.sin((2 * Math.PI * cycles * i) / n) * 30000);
  }
  return encodeBrr(pcm, { loop: true });
}

/**
 * The source-directory for source 0: `SA,LSA` little-endian, both pointing at
 * the sample start ($0080 → `80 00 80 00`). SA = source start, LSA = the loop
 * start (same here, since the note loops back to its beginning).
 */
export function buildDirectory(): Uint8Array {
  return Uint8Array.from([lo16(SPC_SAMPLE_OFF), hi16(SPC_SAMPLE_OFF), lo16(SPC_SAMPLE_OFF), hi16(SPC_SAMPLE_OFF)]);
}

// --- the SPC-RAM image -------------------------------------------------------

/**
 * The full 64 KB SPC-RAM image with the driver, sample, and directory placed.
 * (What the SPU RAM "should" hold after the transfer — a reference for the
 * tests and the by-ear debug, not itself streamed.)
 */
export function spcRamImage(): Uint8Array {
  const img = new Uint8Array(SPC_RAM_SIZE);
  img.set(buildDriver(), SPC_DRIVER_OFF);
  img.set(buildSample(), SPC_SAMPLE_OFF);
  img.set(buildDirectory(), SPC_DIR_OFF);
  return img;
}

// --- the transfer stream (spc.bin) -------------------------------------------

/**
 * The Appendix D block list that moves the SPC-RAM contents: one block for the
 * driver, the sample split into ≤255-byte chunks, then the directory, then the
 * `dw 0, START` terminator. Order = the order the glue streams them.
 */
export function spcBlocks(): SpcBlock[] {
  const sample = buildSample();
  const blocks: SpcBlock[] = [
    { quantity: DRIVER_BYTE_LENGTH, address: SPC_DRIVER_OFF },
  ];
  let off = 0;
  while (off < sample.length) {
    const qty = Math.min(SPC_MAX_BLOCK, sample.length - off);
    blocks.push({ quantity: qty, address: SPC_SAMPLE_OFF + off });
    off += qty;
  }
  blocks.push({ quantity: buildDirectory().length, address: SPC_DIR_OFF });
  blocks.push({ quantity: 0, address: SPC_START_ADDR }); // terminator
  return blocks;
}

/**
 * `spc.bin` — the byte stream the main CPU transfers. Each block is
 * `quantity:2B (LE) | address:2B (LE) | <quantity data bytes>`; the terminator
 * is `quantity:2B = 0 | address:2B = START` with no payload.
 */
export function buildSpc(): Uint8Array {
  const blocks = spcBlocks();
  const driver = buildDriver();
  const sample = buildSample();
  const dir = buildDirectory();

  const out: number[] = [];
  let sampleOff = 0;
  for (const b of blocks) {
    out.push(b.quantity & 0xff, (b.quantity >> 8) & 0xff); // quantity, LE
    out.push(b.address & 0xff, (b.address >> 8) & 0xff);   // address, LE
    if (b.quantity === 0) continue;                          // terminator: no payload
    if (b.address === SPC_DRIVER_OFF) {
      for (let i = 0; i < b.quantity; i++) out.push(driver[i]);
    } else if (b.address === SPC_DIR_OFF) {
      for (let i = 0; i < b.quantity; i++) out.push(dir[i]);
    } else {
      for (let i = 0; i < b.quantity; i++) out.push(sample[sampleOff++]);
    }
  }
  return Uint8Array.from(out);
}

/** Total length of `spc.bin` (every `4 + quantity` block; the terminator adds just 4). */
export function spcBinLength(): number {
  return spcBlocks().reduce((sum, b) => sum + 4 + b.quantity, 0);
}

// --- the 65C816 loader glue --------------------------------------------------

/**
 * The self-contained 65C816 routine that moves `spc.bin` to the SPU.
 *
 * Pure 8-bit mode — **no REP/SEP, no 16-bit A/X/Y** — so the repo assembler's
 * (swapped) REP/SEP table never matters: repo and core agree on every opcode
 * used here. It gets the embedded data's 16-bit address with `PEA spc_data`
 * (label-capable) + two `PLA`s into a zero-page pointer, then walks the block
 * list with `LDA (zp),Y` + a 16-bit pointer increment, streaming each block
 * per Appendix D.
 *
 * Scratch lives in WRAM $10–$17 (the routine runs once at startup, before the
 * game's main loop, so this is transient).
 */
export function spcGlue(dataName = 'spc.bin'): string {
  return `; --- SPC700 data-transfer glue (generated; EXPERIMENTAL) -------------
; Moves the embedded ${dataName} (Appendix D block list) into the SPU via the
; $2140-$2143 ports, then hands the SPU its start address. Pure 8-bit mode.
spc_load:
  pea spc_data          ; push the 16-bit address of the embedded data
  pla                   ; A = high byte
  sta $11               ; ptr_hi
  pla                   ; A = low byte
  sta $10               ; ptr_lo
  ldy #0                ; (zp),Y with Y=0 reads *ptr
spc_rdy:
  lda $2140             ; wait for SPU ready: PORT0 = $AA
  cmp #$aa
  bne spc_rdy
  lda $2141             ; and PORT1 = $BB
  cmp #$bb
  bne spc_rdy
spc_blk:
  ; --- read the 2-byte quantity (low then high) ---
  lda ($10),Y
  inc $10
  bne spc_n1
  inc $11
spc_n1:
  sta $12               ; qty_lo
  lda ($10),Y
  inc $10
  bne spc_n2
  inc $11
spc_n2:
  sta $13               ; qty_hi
  ; --- read the 2-byte SPC address (low then high) ---
  lda ($10),Y
  inc $10
  bne spc_n3
  inc $11
spc_n3:
  sta $14               ; addr_lo
  lda ($10),Y
  inc $10
  bne spc_n4
  inc $11
spc_n4:
  sta $15               ; addr_hi
  ; --- terminator (qty == 0): set the start address, signal the end ---
  lda $12
  ora $13
  beq spc_term
  ; --- start the block: PORT2=addr_lo, PORT3=addr_hi, PORT1=qty, PORT0=$CC ---
  lda $14
  sta $2142
  lda $15
  sta $2143
  lda $12
  sta $2141
  lda #$cc
  sta $2140
spc_sw:
  lda $2140             ; wait for the SPU to accept the start ($CC echo)
  cmp #$cc
  bne spc_sw
  ; --- stream the block's data: PORT1=data, PORT0=byte counter ---
  lda #0
  sta $17
spc_by:
  lda ($10),Y
  inc $10
  bne spc_n5
  inc $11
spc_n5:
  sta $2141             ; data byte out
  lda $17
  sta $2140             ; counter out
  inc $17
  lda $17
  cmp $12               ; counter < qty_lo?
  bcc spc_by
  bra spc_blk
spc_term:
  lda $14
  sta $2142             ; PORT2 = start_lo
  lda $15
  sta $2143             ; PORT3 = start_hi
  lda #0
  sta $2141             ; PORT1 = 0 -> terminate (the SPU jumps to the start)
  rts
spc_data:
  .incbin "${dataName}"
`;
}

// --- metadata (for the tools / panel) ----------------------------------------

/**
 * A summary of the SPC-RAM layout + the block list, for the tools' `layout`
 * field and the by-ear debug surface.
 */
export function spcLayout(): Record<string, unknown> {
  const sample = buildSample();
  return {
    ramSize: SPC_RAM_SIZE,
    driver: { offset: SPC_DRIVER_OFF, size: DRIVER_BYTE_LENGTH },
    sample: { offset: SPC_SAMPLE_OFF, size: sample.length, blocks: SPC_SAMPLE_BLOCKS, loop: true },
    directory: { offset: SPC_DIR_OFF, page: SPC_DIR_PAGE, bytes: Array.from(buildDirectory()) },
    startAddr: SPC_START_ADDR,
    maxBlock: SPC_MAX_BLOCK,
    spcBinBytes: spcBinLength(),
    blocks: spcBlocks(),
  };
}
