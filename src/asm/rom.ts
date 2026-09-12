/**
 * Build a runnable SNES (SFC) ROM image from assembled 65C816 code.
 *
 * The goal is to turn `assemble()` output into something the emulator *reads
 * and executes* through its existing ROM pipeline (`looksLikeSnesRom` →
 * `core.loadRom` → render/audio), rather than `core.writeMem` into RAM (a dead
 * end, since the core ABI exposes the PC read-only and there is no PC setter).
 *
 * Layout (256 KB LoROM — the size and shape this emulator's reference ROM in
 * `test/cpu_test/` uses). The SNES cart header does NOT start at file offset
 * $0000 — snes9x reads it at file offset **$7FB0** (`core/memmap.c`:
 * `RomHeader = Memory.ROM + 0x7FB0`), and its load gate (memmap.c:1949) rejects
 * a ROM whose `ROMSize` byte — `RomHeader[0x27]` = file **$7FD7** — is outside
 * $07–$1E, or whose `SRAMSize` (`RomHeader[0x28]` = file $7FD8) exceeds 16. So
 * the header bytes below are placed at their real file offsets, mirroring the
 * known-working reference ROM field-for-field:
 *
 *   $7FB0         cart header base (RomHeader[0x00])
 *   $7FB2         ROM id (4 ASCII bytes, informational)
 *   $7FC0         ROM name / 12-byte ASCII title (RomHeader[0x10])
 *   $7FD5         ROMSpeed  (RomHeader[0x25]) = $30
 *   $7FD6         ROMType   (RomHeader[0x26]) = $00
 *   $7FD7         ROMSize   (RomHeader[0x27]) = $08  — MUST be in $07–$1E
 *   $7FD8         SRAMSize  (RomHeader[0x28]) = $00  — MUST be ≤ $10
 *   $7FD9         ROMRegion (RomHeader[0x29]) = $00
 *   $7FDA         CompanyId (RomHeader[0x2A]) = $00
 *   $7FDC–$7FDF   16-bit complement + ROM checksums (RomHeader[0x2C..0x2F])
 *   $7FFC         reset vector → $008000 (bytes 00 80) — what `looksLikeSnesRom`
 *                 checks for and where the CPU starts on a cold boot
 *   $7FFE         NMI vector   → $008000 (bytes 00 80)
 *   $0000         entry point — the assembled code is copied here (file $0000
 *                 == CPU $008000 under LoROM)
 *
 * `$7FFC` holds the 16-bit reset vector little-endian, so `$008000` is stored
 * as the byte pair `00 80`. Under LoROM the file is mirrored in 32 KB blocks
 * and the reset target CPU `$008000` (bank `$00`) reads file offset `$0000` —
 * so the code lives at file `$0000`, NOT `$8000` (file `$8000` is a separate
 * 32 KB block). That is exactly the reference ROM's shape (reset vector at
 * file `$7FFC` → CPU `$008000`; entry code at file `$0000`), so the emitted
 * image passes both the app's gate and snes9x's InitROM gate.
 *
 * snes9x does not verify the checksums (the reference ROM's are 0x0000/0xFFFF
 * yet it loads), but a well-formed image carries correct ones, so we compute
 * the standard 16-bit pair for portability.
 *
 * Pure TS, no DOM — unit-testable in the node env like the rest of `src/asm/`.
 */

/** ROM size: 256 KB LoROM. */
export const ROM_SIZE = 0x40000;
/**
 * Entry ADDRESS: the CPU reset-vector address the code runs from, in bank `$00`
 * (== `$008000`). This is the assembly ORIGIN — code is assembled as if it sits
 * at this address, so branch labels and absolute addresses resolve correctly.
 * It is an address, NOT a file offset (see `CODE_OFFSET` below).
 */
export const ROM_ENTRY = 0x8000;
/**
 * FILE offset where the assembled code is copied. Under SNES LoROM the file is
 * mirrored in 32 KB blocks and the reset target CPU `$008000` (bank `$00`) reads
 * file offset `$0000` — so the code lives at file `$0000`, NOT `$8000` (file
 * `$8000` is a separate 32 KB block). This is the reference ROM's shape: its
 * reset vector at file `$7FFC` points at CPU `$008000` and its entry code is at
 * file `$0000`. An earlier revision wrongly placed the code at file `$8000`.
 */
export const CODE_OFFSET = 0x0000;
/** 16-bit entry address the reset/NMI vectors point at (== ROM_ENTRY under LoROM). */
const ENTRY_ADDR = ROM_ENTRY;

// SNES cart-header field addresses (absolute file offsets, header base $7FB0).
const HDR_ROM_ID = 0x7fb2; // 4 ASCII bytes (informational)
const HDR_ROM_NAME = 0x7fc0; // 12 ASCII bytes (the title)
const HDR_ROM_SPEED = 0x7fd5; // RomHeader[0x25]
const HDR_ROM_TYPE = 0x7fd6; // RomHeader[0x26]
const HDR_ROM_SIZE = 0x7fd7; // RomHeader[0x27] — the InitROM gate byte
const HDR_SRAM_SIZE = 0x7fd8; // RomHeader[0x28]
const HDR_ROM_REGION = 0x7fd9; // RomHeader[0x29]
const HDR_COMPANY_ID = 0x7fda; // RomHeader[0x2A]
const HDR_COMP_CHKSUM = 0x7fdc; // RomHeader[0x2C..0x2D], low byte first
const HDR_ROM_CHKSUM = 0x7fde; // RomHeader[0x2E..0x2F], low byte first
const RESET_VECTOR_ADDR = 0x7ffc; // reset vector → $8000
const NMI_VECTOR_ADDR = 0x7ffe; // NMI vector → $8000

// Header field values mirroring the known-working reference ROM
// (test/cpu_test/cputest-basic.sfc). ROMSize $08 is inside the $07–$1E range
// InitROM requires and SRAMSize $00 is ≤ $10, so the corrupt-ROM gate passes.
const ROM_SPEED = 0x30;
const ROM_TYPE = 0x00;
const ROM_SIZE_FIELD = 0x08;
const SRAM_SIZE_FIELD = 0x00;
const ROM_REGION_FIELD = 0x00;
const COMPANY_ID_FIELD = 0x00;

/**
 * The code lives at file $0000 and must not run into the cart header (which
 * starts at file $7FB0 — title at $7FC0, vectors at $7FFC–$7FFF). So the
 * largest code that fits without clobbering the header is 0x7FB0 bytes
 * (file $0000–$7FAF).
 */
const MAX_CODE = 0x7fb0;
/** sessionStorage key the assembler page uses to hand a built ROM to the app. */
export const ASM_ROM_KEY = 'snes-asm-rom';

export interface BuildRomOptions {
  /** 12-byte ASCII game title (padded/truncated to fit the header slot). */
  title?: string;
}

/**
 * Wrap `code` in a 256 KB LoROM SFC image: a cart header at its real $7FB0
 * location (with a valid ROMSize byte at $7FD7 so snes9x's InitROM gate passes),
 * the code at file $0000 (== CPU $008000 under LoROM), reset/NMI vectors →
 * $008000, a 12-byte title at $7FC0, and standard 16-bit checksums at
 * $7FDC–$7FDF. The result satisfies both
 * `looksLikeSnesRom` (the app's pre-load gate) and snes9x's own corrupt-ROM
 * check (memmap.c:1949).
 */
export function buildRom(code: Uint8Array, opts: BuildRomOptions = {}): Uint8Array {
  if (code.length === 0) throw new Error('buildRom: empty program');
  if (code.length > MAX_CODE) {
    throw new Error(
      `buildRom: program is ${code.length} bytes but the entry region is ` +
      `$${CODE_OFFSET.toString(16).padStart(4, '0')}–$${MAX_CODE.toString(16).padStart(4, '0')} (max ${MAX_CODE} bytes)`,
    );
  }

  const rom = new Uint8Array(ROM_SIZE);

  // --- cart header, at its real location (file offset $7FB0) -------------
  // snes9x reads these fields relative to $7FB0; the ROMSize byte at $7FD7 is
  // the load gate, so it is set to a valid value rather than left zero.
  const id4 = 'ASM1'; // ROM id (4 ASCII bytes, informational)
  for (let i = 0; i < 4; i++) rom[HDR_ROM_ID + i] = id4.charCodeAt(i);
  const title = (opts.title ?? 'ASM 65C816').slice(0, 12); // ROM name, null-padded
  for (let i = 0; i < title.length; i++) rom[HDR_ROM_NAME + i] = title.charCodeAt(i) & 0xff;
  rom[HDR_ROM_SPEED] = ROM_SPEED;
  rom[HDR_ROM_TYPE] = ROM_TYPE;
  rom[HDR_ROM_SIZE] = ROM_SIZE_FIELD; // $08 — inside the required $07–$1E
  rom[HDR_SRAM_SIZE] = SRAM_SIZE_FIELD; // $00 — no S-RAM, ≤ $10
  rom[HDR_ROM_REGION] = ROM_REGION_FIELD;
  rom[HDR_COMPANY_ID] = COMPANY_ID_FIELD;
  // Checksum bytes ($7FDC–$7FDF) are computed at the end, below.

  // --- vectors ($7FFC reset → $8000, $7FFE NMI → $8000) ------------------
  rom[RESET_VECTOR_ADDR] = ENTRY_ADDR & 0xff; // low byte  → 00
  rom[RESET_VECTOR_ADDR + 1] = (ENTRY_ADDR >> 8) & 0xff; // high byte → 80
  rom[NMI_VECTOR_ADDR] = ENTRY_ADDR & 0xff;
  rom[NMI_VECTOR_ADDR + 1] = (ENTRY_ADDR >> 8) & 0xff;

  // --- entry code (file $0000 == CPU $008000 under LoROM) -----------------
  rom.set(code, CODE_OFFSET);

  // --- 16-bit checksums, written last once the rest of the image is final -
  writeChecksums(rom);

  return rom;
}

/**
 * Standard 16-bit SNES ROM checksum pair, written to $7FDC–$7FDF.
 *
 * `sum` is the sum of every byte in the image EXCEPT the four checksum bytes;
 *   ROMChecksum           = (0x0000 − sum) & 0xFFFF
 *   ROMComplementChecksum = (0xFFFF − sum) & 0xFFFF
 * Both are stored little-endian (low byte at the lower address), matching
 * snes9x's read order: `RomHeader[0x2C] + (RomHeader[0x2D] << 8)`.
 */
function writeChecksums(rom: Uint8Array): void {
  let sum = 0;
  for (let i = 0; i < rom.length; i++) {
    if (i >= HDR_COMP_CHKSUM && i <= HDR_ROM_CHKSUM + 1) continue; // exclude the 4
    sum = (sum + rom[i]) & 0xffff;
  }
  const romChk = (0x0000 - sum) & 0xffff;
  const compChk = (0xffff - sum) & 0xffff;
  rom[HDR_COMP_CHKSUM] = compChk & 0xff;
  rom[HDR_COMP_CHKSUM + 1] = (compChk >> 8) & 0xff;
  rom[HDR_ROM_CHKSUM] = romChk & 0xff;
  rom[HDR_ROM_CHKSUM + 1] = (romChk >> 8) & 0xff;
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
