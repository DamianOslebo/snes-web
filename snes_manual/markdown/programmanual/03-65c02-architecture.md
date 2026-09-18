# Chapter 3 — Architecture of the 65C02

> New 65C02 addressing modes + instructions (BRL/JSR variations, BIT A).

## Contents (per the book's own TOC)

- The 65C02 Architecture (p41)
- Addressing Modes / TABLE 3-1 (p41)
- New 65C02 Instructions / TABLE 3-2 (p42)
- CMOS & Bugs (p42)

## Provenance

```
Source: `snes_manual/Programmanual.pdf` ("Programming the 65816, Including the 6502, 65C02 and 65802",
David Eyes & Ron Lichty, Western Design Center). The PDF has a **clean text layer**, so the per-page text
below was produced with `pdftotext -layout` — **no OCR**. `-layout` preserves the column layout of the
opcode/bytes/cycles tables, so those tables are the most trustworthy content in this directory.
Printed page number == PDF page number (verified 1:1), so `<!-- programmanual pNNN -->` tags line up with
both the book's own TOC and the source PDF. Still, treat any single hex opcode / cycle figure as a
hypothesis until the assembler has cross-checked it against the matrix in `19-instruction-matrix.md`.
```

## Body (pages 41–43)


<!-- programmanual p041 -->

```
The Western Design Center


3) Chapter Three
Architecture of the 65C02
         The 65C02 microprocessor is an enhanced version of the 6502, implemented using a silicon-gate
CMOS process. The 65C02 was designed primarily as a CMOS replacement for the 6502. As a result, the
significant differences between the two products are few. While the 65C02 adds 27 new opcodes and two new
addressing modes (in addition to implementing the original 151 opcodes of the 6502), its register set, memory
model, and types of operations remain the same.
         The 65C02 is used in the AppleIIc and, since early 1985, in the AppleIIe, ands it has been provided as
an enhancement kit for earlier IIe’s.
         Remember that even as the 65C02 is a superset of the 6502, the 65802 and 65816, described in the next
chapter, are supersets of the 65C02. All of the enhancements found in the 65C02 are additionally significant in
that they are intermediate to the full 65816 architecture. The next chapter will continue to borrow from the
material covered in the previous ones, and generally what is covered in the earlier of these three architecture
chapters is not repeated in the subsequent ones, since it is true for all 65x processors.

The 65C02 Architecture

         Both the 65C02 and the 6502 are eight-bit processors, with a 64K address space and exactly the same
register set.
         The 65C02 features some small but highly desirable improvements in the use of the status register flags:
it gives valid negative, overflow, and zero flags while in decimal mode, unlike the 6502; and it resets the
decimal flag to zero after reset and interrupt.
         The 65C02 has slightly different cycle counts on a number of operations from the 6502, some shorter
and a few longer. The longer cycle counts are generally necessary to correct or improve operations from the
6502.

Addressing Modes
        The 65C02 introduces the two new addressing modes shown in table 3.1, as well as supporting all the
6502 addressing modes. All of them will be explained in detail in Chapters 7 and 11, and will be reviewed in
the Reference Section.

                     Addressing Mode                                  Syntax Example
                                                                   Opcode    Operand
                 Zero Page Indirect                                  LDA      ($55)
                 Absolute Indexed Indirect                           JMP      ($2000,X)

                                 Table 3-1 The 65C02’s New Addressing Modes.
        Zero page indirect provides an indirect addressing mode for accessing data which requires no indexing
(the 6502’s absolute indirect mode is available only to the jump instructions). 6502 programmers commonly
simulate indirection by loading an index register with zero (losing its contents and taking extra steps), then
using the preindexed or postindexed addressing modes to indirectly reference the data.
        On the other hand, combining indexing and indirection proved so powerful for accessing data on the
6502 that programmers wanted to see this combination made available for tables of jump vectors. Absolute
indexed indirect, available for jump instruction only, provides this multi-directional branching capability,
which can be very useful for case or switch statements common to many languages.




                                                                                                              41
```

<!-- programmanual p042 -->

```
The Western Design Center

Instructions

         While the 65C02 provides 27 new opcodes, there are only eight new operations. The 27 opcodes result
from providing four different addressing modes for one on the new mnemonics and two for two others, and also
from expanding the addressing modes for twelve 6502 instructions. The most significant expansion of a 6502
instruction by combining it with a 6502 addressing mode it did not previously use is probably the addition of
accumulator addressing for the increment and decrement instructions.
         The new 65C02 operations, shown in Table 3.2, answer many programmer’s prayers: an unconditional
branch instruction, instructions to push and pull the index registers, and instructions to zero out memory cells.
These may be small enhancements, but they make programming the 65C02 easier, more straightforward, and
clearer to document. Two more operations allow the 65C02 to set or clear any or all of the bits in a memory
cell with a single instruction.

                       Instruction
                       Mnemonic       Description
                          BRA         Branch always (unconditional)
                          PHX         Push index register X onto stack
                          PHY         Push index register Y onto stack
                          PLX         Pull index register X form stack
                          PLY         Pull index register Y from stack
                          STZ         Store zero to memory
                          TRB         Test and reset memory bits against accumulator
                          TSB         Test and set memory bits against accumulator
                                       Table 3-2. New 65C02 Instructions


CMOS Process

        Unlike the 6502, which is fabricated in NMOS, the 65C02 is a CMOS (pronounced “SEE
moss”) part. CMOS stands for Complementary Metal-Oxide Semiconductor.
        The most exciting feature of CMOS is its low power consumption, which has made portable,
battery-operated computers possible. Its low power needs also result in lower heat generation, which
means parts can be placed closer together and heat-dissipating air space minimized in CMOS-based
computer designs.
        CMOS technology is not a new process. It’s been around for about as long as other MOS
technologies. But higher manufacturing costs during the early days of the technology made CMOS
impractical for the highly competitive microcomputer market until the mid 1980s, so process
development efforts were concentrated on NMOS and not applied to CMOS until 1980 or 1981.
         CMOS technology has reached a new threshold in that most of its negative qualities, such as the
difficulty with which smaller geometries are achieved relative to the NMOS process, have been overcome.
Price has become competitive with the more established NMOS as well.

Bugs and Quirks

         The 65C02 fixes all of the known bugs and quirks in the 6502. The result of executing unused opcodes
is now predictable-they do nothing (that is, they act like no-operation instructions). An interesting footnote is
that, depending on the unimplemented instruction that is executed, the number of cycles consumed by the no-
operation is variable between one and eight cycles. Also, the number of bytes the program counter is
incremented by is variable. It is strongly recommended that this feature not be exploited, as its use will produce
code incompatible with the next-generation 65802 and 65816.
         The jump indirect instruction has been fixed to work correctly when its operand crosses a page
boundary (although at the cost of an execution cycle). The negative overflow, and zero flags have been
implemented to work in decimal mode (also at the cost of an execution cycle). The decimal mode is now reset
to binary after a hardware reset or an interrupt.
                                                                                                                42
```

<!-- programmanual p043 -->

```
The Western Design Center

          Finally, a fix which is generally transparent to the programmer, but which eliminates a possible cause of
interference with memory-mapped I/O devices on the 6502, is the elimination of an invalid address read while
generating an indexed effective address when a page boundary is crossed.
          The quirk unique to the 65C02 results from trying to eliminate the quirks of the 6502. The timing
improvements of a number of instructions and the bug fixes from the 6502 make the 65c02 an improvement
over the 6502, but not quite fully compatible on a cycle-by-cycle basis. This is only a consideration during the
execution of time-critical code, such as software timing loops. As a practical example, this has affected very
little software being ported from the Apple IIe to the IIc.




                                                                                                                43
```
