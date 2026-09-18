# Programmanual — “Programming the 65816” (markdown)

Processed from `snes_manual/Programmanual.pdf` (David Eyes & Ron Lichty,
Western Design Center — *“Programming the 65816, Including the 6502, 65C02 and
65802”*), a **469-page** programmer’s reference for the 6502 / 65C02 / 65C816
(“65816”) CPUs. This is **the** 65C816 instruction-set + addressing-mode
reference: it is the source the emulator and the **65C816 assembler’s opcode
table cross-check against** (Book I of the SNES dev manual — `../book1/` —
*omits* the 65C816 command set entirely; see that README).

Unlike `book1.pdf` (a scanned, image-only PDF that had to be OCR’d), this PDF
has a **clean text layer**. Every page below was produced with
`pdftotext -layout`, so **no OCR** was involved and the opcode/bytes/cycles
tables kept their columns. That makes this the most trustworthy reference in
`snes_manual/`.

## Files

One file per chapter (plus front matter), contiguous, covering **p1–p469** with
no gaps. Each page is tagged `<!-- programmanual pNNN -->`, and **printed page
number == PDF page number** (verified 1:1), so the book’s own TOC, the tags,
and the source PDF all line up.

| File | Chapter | PDF pages | Use |
| --- | --- | --- | --- |
| `00-front-matter.md` | Title / TOC / List of Figures & Tables / “Part 1” | p1–11 | The authoritative chapter→page map; confirms the 1:1 page mapping. |
| `01-basic-concepts.md` | 1 — Basic Assembly Concepts | p12–25 | Number systems / boolean logic. Low assembler relevance. |
| `02-6502-architecture.md` | 2 — Architecture of the 6502 | p26–40 | 8-bit baseline; the 6502 **P register** (p29–31) matters because the SNES boots in 6502 mode. |
| `03-65c02-architecture.md` | 3 — Architecture of the 65C02 | p41–43 | New 65C02 addressing modes + instructions (BRL, BIT A, etc.). |
| `04-65816-architecture.md` | 4 — Sixteen-Bit (65816/65802) | p44–63 | **CROWN**: registers, **DBR/DPR**, and the **m/v status bits** that `REP`/`SEP` drive. |
| `05-sep-rep.md` | 5 — SEP, REP & Details | p64–68 | **CROWN**: exactly what `SEP #$20` / `REP #$30` do to A,X,Y,S, and the assembler’s mode assumptions. |
| `06-moving-data.md` | 6 — Moving Data | p69–88 | Load/store, push/pull, the 65816-only transfers/exchanges (TAS/TSB/TCD/TCS/PEA/XBA/XYB…), block moves. |
| `07-simple-addressing.md` | 7 — Simple Addressing Modes | p89–110 | **CROWN**: the common modes with effective-address formulas + cycles (operand-decode core). |
| `08-flow-of-control.md` | 8 — Flow of Control | p111–121 | Branches: offsets, sign, wrap — for the assembler’s relative-target encoding. |
| `09-arithmetic.md` | 9 — Built-In Arithmetic | p122–138 | ADC/SBC/INC/DEC/CMP in 8/16-bit + BCD. |
| `10-logic-bitmanip.md` | 10 — Logic & Bit Manipulation | p139–153 | AND/OR/EOR + shifts/rotates; 8/16-bit A and 16-bit X variants. |
| `11-complex-addressing.md` | 11 — Complex Addressing Modes | p154–173 | **CROWN**: the tricky 65816 indirect/long/stack-relative modes + the **p156 assembler assumption rules**. |
| `12-subroutines.md` | 12 — The Subroutine | p174–191 | JSR/RTS + the 65816 **JSL/RTL** long pair (opcode table needs both). |
| `13-interrupts-sysctl.md` | 13 — Interrupts & System Control | p192–203 | Interrupt vectors, NMI, RTI, PLP/SEI/CLI, NOP/STP/WAI. |
| `14-code-samples-multdiv.md` | 14 — Mul/Div Code Samples | p204–229 | Mul/Div **library routines** (not HW instructions) + processor-type test. |
| `15-degbug16.md` | 15 — DEGBUG16 (a 65816 debugger) | p230–275 | A debugger’s commands; shows the register/state model. Peripheral. |
| `16-design-debugging.md` | 16 — Design & Debugging | p276–282 | **Relevant**: the *“Inconsistent Assembler Syntax”* + emulation/native gotchas are direct assembler-design concerns. |
| `17-addressing-modes.md` | 17 — The Addressing Modes (reference) | p283–325 | **CROWN**: the authoritative per-mode effective-address definitions (every mode, 8/16-bit, with cycles). |
| `18-instruction-sets.md` | 18 — The Instruction Sets (per-instruction) | p326–423 | **CROWN JEWEL**: one section per instruction, each with Opcode(hex) / Available-on(6502·65C02·65802/816) / Bytes / Cycles per addressing mode. |
| `19-instruction-matrix.md` | 19 — Instruction Lists (opcode table) | p424–469 | **CROWN JEWEL**: the flat **$00–$FF opcode table** (p424–429) — Hex / Mnemonic / Addressing Mode / 6502·65C02·65802-816 / Bytes / Cycles + footnotes. The single best cross-check for the assembler’s opcode→(mnemonic, addressing-mode) map. |

## Provenance & how to trust this

- **No OCR.** `pdftotext -layout` against a clean text layer; each page is
  fenced in a ``` block so the tables keep their spacing, and every page is
  tagged `<!-- programmanual pNNN -->` for in-place verification.
- **Page numbers are 1:1** with the PDF, so any `pNNN` you find in the body,
  the TOC, or this README points at the same physical page in `Programmanual.pdf`.
- **The tables are the trustworthy part**, not the prose. The
  `18-instruction-sets.md` per-instruction tables and the `19-instruction-matrix.md`
  $00–$FF table are the ones the assembler should consume; the surrounding prose
  is explanatory.

## ⚠ Cautions for cross-checking the assembler against this

- **This is the WDC “W65816” manual.** A few slots are **WDC-proprietary / not on
  standard SNES 65C816 silicon** and must be **excluded** from the opcode table:
  notably **`WDM` ($42)** — a variable-length WDC test/debug opcode (footnote 16
  on p429 says its byte/cycle counts “are subject to change… expand WDM into
  2-byte opcode portions”), and **`TSC` ($3B/$FB)** — a 65802/WDC instruction.
  Verify a slot against the SNES datasheet before trusting any WDC-only mnemonic.
- **The Cycles column mangles multi-value entries** in the text layer. Real cycle
  counts for many opcodes are *comma-separated sets* (e.g. the count at 8-bit vs
  16-bit width / different clock), but the text renders them as `210` (=`21`),
  `410` (=`41`), `51.4` (=`51,4`), `51.2.3.4` (=`51,2,3,4`). **Treat any cycle
  figure as a hypothesis** and confirm against the page image before the
  assembler emits it; the *opcode → mnemonic → addressing-mode → bytes* columns
  are the reliable ones.
- **Undefined / illegal 6502 slots:** a slot absent from both the 6502 and the
  65C816 columns stays **illegal / `??`** in the assembler (the repo’s
  “fail loudly, never mislabel” rule) — do not invent a mnemonic for it because
  a WDC manual listed a WDC-only variant there.

## Where the SNES-specific details are (not in this manual)

This book is a **generic 65x CPU** reference — it has **no SNES memory map, reset
flow, or ROM-header layout**. Those SNES-specific facts (WRAM `$7E0000–$7FFFFF`,
the 8K common bank, the register windows, the `$FFFC–$FFFD` reset vector and the
128-byte ROM header at bank `$00` `$FFC0–$FFDF`) are in the SNES dev manual
Book I — see `../book1/02b-cpu-memory-reset.md` (hand-verified extract). The two
references are complementary: **this one** for *what the 65C816 can do*;
**Book I** for *where things live on the SNES*.
