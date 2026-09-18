# Book I — Super NES Development Manual (markdown)

Processed from `snes_manual/book1.pdf` (Nintendo Super NES Development Manual, **Book I**).
The PDF is a **scanned, image-only** 240-page file (no text layer), so each page was
rendered at 300 DPI and run through RapidOCR (ONNX). This directory is the result,
split into section files that can be consulted while working on the emulator and
the 65C816 assembler.

## Files

| File | Manual section | PDF pages | Use |
| --- | --- | --- | --- |
| `00-front-matter.md` | TOC / List of Figures / List of Tables / Preface | p1–13 | Authoritative TOC for Book I **and** Book II |
| `01-approval-process.md` | Section 1 — Approval Process | p14–58 | NOA approval + **ROM/cartridge submission requirements** |
| `02a-graphics-features.md` | Section 2 (a) — Graphics feature set | p59–92 | PPU features: OBJ, BG, Mosaic, Rotation, Window, DMA, Interlace, H-512, OBJ33 |
| `02b-cpu-memory-reset.md` | Section 2 (b) — CPU, memory map, reset | p93–152 | **CPU clock, memory map, boot flow, register clear, PPU/CPU registers** — reset-PC work |
| `03-sound-spc700.md` | Section 3 — Sound (SPC700) | p153–195 | The **sound** coprocessor (BRR, V/O, timers, DSP, SPC700 org) — *not* the 65C816 |
| `appendix-a-ppu-registers.md` | Appendix A — PPU Registers | p196–218 | VRAM/CG-RAM register tables |
| `appendix-b-cpu-registers.md` | Appendix B — CPU Registers | p219–226 | **65C816 (main CPU)** register definitions |
| `appendix-c-spc700-commands.md` | Appendix C — SPC700 Commands | p227–236 | **SPC700** instruction tables C-4…C-19 (sound CPU, not 65C816) |
| `appendix-d-data-transfer.md` | Appendix D — Data Transfer | p237–240 | Data transfer + Sound Boot Loader (has `rep` 65816 snippets) |

## Provenance & how to trust this

- **Every page** in the section files is tagged `<!-- book1 pNNN -->` so any page can be
  re-verified against the source image and corrected in place.
- The body text is a **raw-OCR baseline**: prose reads fine, but it drops inter-word spaces,
  and confuses `0/O`, `S/s`, `l/I`, and `|/1`. **Hex addresses, disassembly, and tables are
  the least reliable** — treat any `$…`/hex value as a hypothesis until checked against the
  page image.
- Pages already **hand-verified from the images** carry a `HAND-VERIFIED` header block
  (currently: `02b-cpu-memory-reset.md`, the CPU clock / memory map / ROM-reset extract).
  When you rely on a number from another page, do the same: read that page image, then add
  a `HAND-VERIFIED` note so future-you knows it was checked.
- Re-run the assembly after re-OCR'ing any page:
  `python3 <this-job-tmp>/snes-ocr/assemble_md.py` (rewrites all files, keeps the
  `HAND-VERIFIED` blocks you append **above** the `## Body` line — so keep them there).

## ⚠ Section 4 — 65C816 CPU Data — is MISSING from this scan

Book I's **own table of contents (p2)** and List-of-Tables (p9) promise:

> **SECTION 4 – SUPER NES CPU DATA**
> Outline · CPU Terminal Functions · Functions · **Addressing Mode** ·
> **Command Set (Alphabetical)** · **Command Set (Matrix Display)** ·
> Cycles and Bytes of Addressing Modes · **Differences Among 65C816, 65C02, and 6502** ·
> Restrictions · **Details of Command Functions** · **Description of Commands** · AC Characteristics

…but the scanned body **jumps straight from Section 3 (Sound, ends p195) to Appendix A
(p196)**. There is no `PEA/PEI/PER`, no opcode matrix, no 65C816 instruction table in the
240 scanned pages. So the 65C816 command set that the **assembler's opcode table** would
normally be cross-checked against is **not available from book1.pdf**.

**Where the 65C816 reference actually is:** `snes_manual/Programmanual.pdf` (469 pp),
now processed to markdown at **`snes_manual/markdown/programmanual/`** (sibling of this
directory — see its `README.md`). It is the WDC “Programming the 65816” manual: 65C02
architecture, new 65816 addressing modes, the per-instruction Opcode/Bytes/Cycles
tables (Ch 18), the flat **$00–$FF opcode table** (Ch 19, p424–429), PEA, complex
addressing modes, and the assembler assumption rules. It has a clean text layer
(`pdftotext -layout`, **no OCR**), so it is the **recommended source for the assembler
opcode table**. (Book II = `book2.pdf` is SA-1 / Super FX / DSP1 / accessories — all
out of v1 scope, so not needed for the core 65C816 work.)

## What book1.pdf *does* give us (useful for the emulator)

- **CPU memory map + clock** (p93–95): WRAM 128K layout, the `$0000–$1FFF` common 8K bank,
  register windows (PPU `$2000…`, CPU/DMA `$4200–$5EFF`, Controller `$4000–$41FF`,
  EXPAND/coprocessor `$6000–$7EFF`). → in `02b-cpu-memory-reset.md`
- **Boot/reset & ROM header** (Figure 2-21-2, p95): start vector + registration area at
  **bank `$00`, `$FFC0–$FFDF`**; <8M ROMs put the DSP/Sound area at banks `$30–$3F`.
- **Register clear / initial settings** (p114) — the reset register state.
- **PPU register maps** (p115–152, Appendix A p196–218) and **CPU register definitions**
  (p140–152, Appendix B p219–226).
- **SPC700** sound-CPU details (Section 3 + Appendix C) — only if sound emulation grows.
