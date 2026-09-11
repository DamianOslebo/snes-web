/**
 * Build a runnable SNES (SFC) ROM image from assembled 65C816 code.
 *
 * The goal is to turn `assemble()` output into something the emulator *reads
 * and executes* through its existing ROM pipeline (`looksLikeSnesRom` →
 * `core.loadRom` → render/audio), rather than `core.writeMem` into RAM (a dead
 * end, since the core ABI exposes the PC read-only and there is no PC setter).
 *
 * Layout (256 KB LoROM — the size and shape this emulator's reference ROM uses):
 *
 *   $0000–$00FF   standard SFC header (Mapper 0, no S-RAM, clean checksums)
 *   $7FC0         12-byte ASCII game title
 *   $7FFC         reset vector → $8000 (bytes 00 80) — the CPU jumps here on
 *   $7FFE         NMI vector   → $8000 (bytes 00 80) reset; the reset vector
 *                                                     is what `looksLikeSnesRom`
 *                                                     checks for (00 80 at $7FFC)
 *   $8000         entry point — the assembled code is copied here
 *
 * `$7FFC` holds the 16-bit reset vector in little-endian order, so the value
 * `$8000` is stored as the byte pair `00 80`. Under LoROM mapping the ROM bank
 * `$00` maps 1:1 to file offsets `$00000–$0FFFF`, so address `$8000` is file
 * offset `$8000` — where the code lives. This is exactly the shape of the
 * working reference ROM in `test/cpu_test/` (reset vector `00 80` at `$7FFC`,
 * code at `$8000`), so the emitted image goes through the same path.
 *
 * The reference ROM carries a non-standard header (`$07`=`$a2`) yet still
 * loads, so snes9x is lenient about the header bytes. A clean, checksum-
 * correct standard header is the safe subset and makes the emitted `.sfc` a
 * portable, well-formed image.
 *
 * Pure TS, no DOM — unit-testable in the node env like the rest of `src/asm/`.
 */

/** ROM size: 256 KB LoROM. */
export const ROM_SIZE = 0x40000;
/** Entry point: code is placed at file offset $8000 (= 24-bit address $008000). */
export const ROM_ENTRY = 0x8000;
/** 16-bit entry address the reset/NMI vectors point at (== ROM_ENTRY under LoROM). */
const ENTRY_ADDR = ROM_ENTRY;
/** Title slot (12 ASCII bytes). */
const TITLE_ADDR = 0x7fc0;
/** Reset-vector slot (bytes 00 80 → $8000). */
const RESET_VECTOR_ADDR = 0x7ffc;
/** NMI-vector slot. */
const NMI_VECTOR_ADDR = 0x7ffe;
/**
 * The code runs from the entry ($8000) to the end of the ROM; the header,
 * title, and vectors all sit before $8000, so nothing is clobbered.
 */
const MAX_CODE = ROM_SIZE - ROM_ENTRY;
/** sessionStorage key the assembler page uses to hand a built ROM to the app. */
export const ASM_ROM_KEY = 'snes-asm-rom';
/** SFC header: fixed identification bytes. */
const SFC_M1 = 0x33;
const SFC_M2 = 0xff;

export interface BuildRomOptions {
  /** 12-byte ASCII game title (padded/truncated to fit the header slot). */
  title?: string;
}

/**
 * Wrap `code` in a 256 KB LoROM SFC image: clean header, code at $8000,
 * reset/NMI vectors ($8000), title, and correct ROM + header checksums. The
 * result satisfies `looksLikeSnesRom` (the app's pre-load gate).
 */
export function buildRom(code: Uint8Array, opts: BuildRomOptions = {}): Uint8Array {
  if (code.length === 0) throw new Error('buildRom: empty program');
  if (code.length > MAX_CODE) {
    throw new Error(
      `buildRom: program is ${code.length} bytes but the entry region is ` +
      `$${ROM_ENTRY.toString(16).padStart(4, '0')}–$${ROM_SIZE.toString(16).padStart(4, '0')} (max ${MAX_CODE} bytes)`,
    );
  }

  const rom = new Uint8Array(ROM_SIZE);

  // --- SFC header ($0000–$00FF) ------------------------------------------
  rom[0x00] = 0x00; // S-RAM size: 00 = none (Mapper 0)
  const code4 = 'ASM1'; // game code (informational)
  for (let i = 0; i < 4; i++) rom[0x01 + i] = code4.charCodeAt(i);
  rom[0x05] = 0x21; // maker code '!'
  rom[0x06] = 0x21; // (unofficial / no maker)
  rom[0x07] = SFC_M1;
  rom[0x08] = SFC_M2;
  // $0009 ROM checksum and $000A header checksum are computed at the end.
  rom[0x0b] = ENTRY_ADDR & 0xff;       // entry point $8000, low byte
  rom[0x0c] = (ENTRY_ADDR >> 8) & 0xff; // high byte
  rom[0x0d] = 0x01; // version 1 (LoROM, normal)
  rom[0x0e] = 0x00; // target system: normal LoROM
  rom[0x0f] = 0x00;

  // --- title ($7FC0, 12 ASCII bytes, null-padded) ------------------------
  const title = (opts.title ?? 'ASM 65C816').slice(0, 12);
  for (let i = 0; i < title.length; i++) rom[TITLE_ADDR + i] = title.charCodeAt(i) & 0xff;

  // --- vectors ($7FFC reset → $8000, $7FFE NMI → $8000) ------------------
  rom[RESET_VECTOR_ADDR] = ENTRY_ADDR & 0xff;       // low byte  → 00
  rom[RESET_VECTOR_ADDR + 1] = (ENTRY_ADDR >> 8) & 0xff; // high byte → 80
  rom[NMI_VECTOR_ADDR] = ENTRY_ADDR & 0xff;
  rom[NMI_VECTOR_ADDR + 1] = (ENTRY_ADDR >> 8) & 0xff;

  // --- entry code ($8000) -------------------------------------------------
  rom.set(code, ROM_ENTRY);

  // --- checksums (written last, once the rest of the image is final) -----
  // Standard order: header checksum first (with the ROM-checksum byte still
  // zero), then the ROM checksum (which includes the final header byte).
  rom[0x0a] = headerChecksum(rom);
  rom[0x09] = romChecksum(rom);

  return rom;
}

/** SFC ROM checksum: 0xFF − (sum of all image bytes except $0009), mod 256. */
function romChecksum(rom: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < rom.length; i++) {
    if (i !== 0x09) sum = (sum + rom[i]) & 0xffffff;
  }
  return (0xff - (sum & 0xff)) & 0xff;
}

/** SFC header checksum: 0xFF − (sum of header bytes $0000–$007F except $000A). */
function headerChecksum(rom: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < 0x80; i++) {
    if (i !== 0x0a) sum = (sum + rom[i]) & 0xffffff;
  }
  return (0xff - (sum & 0xff)) & 0xff;
}

// --- base64 helpers: the ROM→app handoff channel --------------------------
// A 256 KB ROM is far too large for a URL, so the assembler page serializes it
// into sessionStorage (base64) and the app decodes it back on boot.

/**
 * Encode bytes as base64. The binary string is assembled in bounded chunks so
 * we never call `String.fromCharCode` with one enormous argument list (which
 * has an engine-dependent cap), then encoded with a single `btoa` call — that
 * yields one valid base64 string with padding only at the end (splitting the
 * *base64* into independently-encoded chunks would leave `=` mid-string and
 * `atob` would reject it).
 */
export function bytesToBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000; // 32 KB per fromCharCode group
  let bin = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const slice = bytes.subarray(i, Math.min(i + CHUNK, bytes.length));
    for (let j = 0; j < slice.length; j += 1024) {
      bin += String.fromCharCode(...slice.subarray(j, j + 1024));
    }
  }
  return btoa(bin);
}

/** Decode base64 back to the original bytes (inverse of `bytesToBase64`). */
export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
