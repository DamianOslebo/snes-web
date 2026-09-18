# Chapter 18 — The Instruction Sets (per-instruction)

> ⚠ CROWN JEWEL for the assembler: the full opcode / bytes / cycles / availability table for every instruction, by addressing mode. This is what the opcode table cross-checks against.

## Contents (per the book's own TOC)

- One section per instruction, each with Opcode(hex) / Available-on(6502·65C02·65802/816) / Bytes / Cycles per addressing mode. Covers the full mnemonic set (ADC, AND, ASL, branches, CMP/CPX/CPY, INC/DEC, EOR, JMP/JSR/JSL, LDA/LDX/LDY, ORA, PHx/PLx push-pull pairs, ROL/ROR, RTI/RTS/RTL, SBC, SEC/SED/SEI/SEP, STA/STX/STY/STZ, TAx/TAy/TxA/TyA/TCD/TCS/TDC/TXS, XBA/XCA/XYB). The body pages carry the authoritative list; this line is just an index.

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

## Body (pages 326–423)


<!-- programmanual p326 -->

```
The Western Design Center


18) Chapter Eighteen
The Instruction Sets
        This chapter devotes a page to each of the 94 different 65816 operations. Each operation may have
more than one addressing mode available to it; these are detailed for each instruction. The symbols in Table
18.1 are used to express the different kinds of values that instruction operands may have. The effect of each
operation on the status flags varies. The symbols in Table 18.2 are used to indicate the flags that are affected by
a given operation.


          addr               two-byte address
          addr / const       two-byte value: either an address or a constant
          const              one- or two-byte constant
          destbk             64K bank to which string will be moved
          dp                 one-byte direct page offset (6502/65C02: zero page)
          label              label of code in same 64 bank as instruction
          long               three-byte address (includes bank byte)
          nearlabel          label of code close enough to instruction to be reachable
                             by a one-byte signed offset
          sr                 one-byte stack relative offset
          srcebk             64K bank from which string will be moved


                                           Table 18-1 Operand Symbols


               Flags:


               bits:                               7 6 5 4 3 2 1 0


               6502/65C02/6502 emulation:          n v - b d i z c


               65802/65816 native:                 n v m x d i z c


                                                   n — negative result
                                                   v — overflow
                                                   m — 8-bit memory/accumulator
                                                   x — 8-bit index registers
                                                   b — BRK caused interrupt
                                                   d — decimal mode
                                                   i — IRQ interrupt disable
                                                   z — zero result
                                                   c — carry


                                                Table 18-2 65x Flags




                                                                                                               326
```

<!-- programmanual p327 -->

```
The Western Design Center

 Add With Carry                                                                                                          ADC

         Add the data located at the effective address specified by the operand to the contents of the
accumulator; add one to the result if the carry flag is set, and store the final result in the accumulator.
         The 65x processors have no add instruction that does not involve the carry. To avoid adding the carry
flag to the result, you must either be sure that it is already clear, or you must explicitly clear it (using CLC)
prior to executing the ADC instruction.
         In a multi-precision (multi-word) addition, the carry should be cleared before the low-order words are
added; the addition of the low word will generate a new carry flag value based on the addition. This new value
in the carry flag is added into the next (middle-order or high-order) addition; each intermediate result will
correctly reflect the carry from the previous addition.
         d flag clear: Binary addition is performed.
         d flag set: Binary coded decimal (BCD) addition is performed.
         8-bit accumulator (all processors): Data added from memory is eight-bit.
         16-bit accumulator (65802/65816 only, m = 0): Data added from memory is sixteen-bit: the low-order
eight bits are located at the effective address; the high-order eight bits are located at the effective address plus
one.

Flags Affected:              n v — — — — z c
                             n        Set if most significant bit of result is set; else cleared.
                             v        Set if signed overflow; cleared if valid signed result.
                             z        Set if result is zero; else cleared.
                             c        Set if unsigned overflow; cleared if valid unsigned result.

Codes:

                                                                Opcode                Available on:               # of    # of
  Addressing Mode + +                   Syntax                    (hex)      6502     65C02 65802/816            Bytes   Cycles
  Immediate                             ADC #const                 69         x         x           x             2*      21,4
  Absolute                              ADC addr                   6D         x         x           x             3       41,4
  Absolute Long                         ADC long                   6F                               x             4       51,4
  Direct Page (DP)                      ADC dp                     65          x        x           x             2       31,2,4
  DP Indirect                           ADC (dp)                   72                   x           x             2       51,2,4
  DP Indirect Long                      ADC [dp]                   67                               x             2       61,2,4
  Absolute Indexed, X                   ADC addr, X                7D          x        x           x             3       41,3,4
  Absolute Long Indexed, X              ADC long, X                7F                               x             4       51,4
  Absolute Indexed Y                    ADC addr, Y                79          x        x           x             3       41,3,4
  DP Indexed, X                         ADC dp, X                  75          x        x           x             2       41,2,4
  DP Indexed Indirect, X                ADC (dp, X)                61          x        x           x             2       61,2,4
  DP Indirect Indexed, Y                ADC (dp), Y                71          x        x           x             2       51,2,3,4
  DP Indirect Long Indexed, Y           ADC [dp], Y                77                               x             2       61,2,4
  Stack Relative (SR)                   ADC sr, S                  63                               x             2       41,4
  SR Indirect Indexed, Y                ADC (sr, S), Y             73                               x             2       71,4
+ + ADC, a Primary Group Instruction, has available all of the Primary Group addressing modes and bit patterns
* Add 1 byte if m = 0 (16-bit memory/accumulator)
1 Add 1 cycle if m = 0 (16-bit memory/accumulator)
2 Add 1 cycle if low byte of Direct Page register is other than zero (DL< >0)
3 Add 1 cycle if adding index crosses a page boundary
4 Add 1 cycle if 65C02 and d = 1 (decimal mode, 65C02)




                                                                                                                             327
```

<!-- programmanual p328 -->

```
The Western Design Center

 And Accumulator with Memory                                                                                             AND

         Bitwise logical AND the data located at the effective address specified by the operand with the contents
of the accumulator. Each bit in the accumulator is ANDed with the corresponding bit in memory, with the
result being stored in the respective accumulator bit.
         The truth table for the logical AND operation is:

                                                                          Second            Operand
                                                                                 0                1
                                              First Operand
                                                                  0              0                0
                                                                  1              0                1



                                                 Figure 18-1 AND Truth Table


        That is, a 1 or logical true results in given bit being true only if both elements of the respective bits
being ANDed are 1s, or logically true.
        8-bit accumulator (all processors): Data ANDed from memory is eight-bit.
        16-bit accumulator (65802/65816 only, m = 0): Data ANDed from memory is sixteen-bit: the low-
order byte is located at the effective address; the high-order byte is located at the effective address plus one.

Flags Affected: n - - - - - z -
                        n       Set if most significant bit of result is set; else cleared.
                        z       Set if result is zero; else cleared.

Codes:

                                                              Opcode      Available on:                           # of      # of
  Addressing Mode + +                Syntax                    (hex) 6502 65C02 65802/816                        Bytes    Cycles
  Immediate                          AND # const                29     x    x        x                           2*      21
  Absolute                           AND addr                   2D     x    x        x                           3       41
  Absolute Long                      AND long                   2F                   x                           4       51
  Direct Page (DP)                   AND dp                     25     x    x        x                           2       31,2
  DP Indirect                        AND(dp)                    32          x        x                           2       51,2
  DP Indirect Long                   AND [dp]                   27                   x                           2       61,2
  Absolute Indexed, X                AND addr, X                3D     x    x        x                           3       41,3
  Absolute Long Indexed, X           AND long, X                3F                   x                           4       51
  Absolute Indexed,Y                 AND addr, Y                39     x    x        x                           3       41,3
  DP Indexed, X                      AND dp, X                  35     x    x        x                           2       41,2
  DP Indexed Indirect, X             AND (dp, X)                21     x    x        x                           2       61,2
  DP Indirect Indexed, Y             AND (dp), Y                31     x    x        x                           2       51,2,3
  DP Indirect Long Indexed, Y        AND [dp], Y                37                   x                           2       61,2,0
  Stack Relative (SR)                AND sr, S                  23                   x                           2       41
  SR Indirect Indexed, Y             AND (sr, S), Y             33                   x                           2       71
+ + AND, a Primary Group Instruction, has available all of the Primary Group addressing modes and bit patterns
* Add 1 byte if m = 0 (16-bit memory/accumulator)
1 Add 1 cycle if m = 0 (16-bit memory/accumulator)
2 Add 1 cycle if low byte of Direct Page register is other than zero (DL< >0)
3 Add 1 cycle if adding index crosses a page boundary




                                                                                                                           328
```

<!-- programmanual p329 -->

```
The Western Design Center

    Shift Memory or Accumulator Left                                                                             ASL

        Shift the contents of the location specified by the operand left one bit. That is, bit one takes on the
value originally found in bit zero, bit two takes the value originally in bit one, and so on; the leftmost bit (bit 7
on the 6502 and 65C02 or if m = 1 on the 65802/65816, or bit 15 if m = 0) is transferred into the carry flag; the
rightmost bit, bit zero, is cleared. The arithmetic result of the operation is an unsigned multiplication by two.

                                                           ASL



                                  1     0   1    1    0    0    1   1              0



                                                                   X
                                                                 Carry Flag

                                                     Figure 18-2 ASL


        8-bit accumulator/memory (all processors): Data shifted is eight bits.
        16-bit accumulator/memory (65802/65816 only, m = 0): Data shifted is sixteen bits: if in memory, the
low-order eight bits are located at the effective address; the high-order eight bits are located at the effective
address plus one.

Flags Affected: n - - - - - z c
                         n            Set if most significant bit of result is set; else cleared.
                         z            Set if result is zero; else cleared.
                         c            High bit becomes carry: set if high bit was set; cleared if high bit was zero.

Codes:

                                                      Opcod
                                                                        Available on:               # of       # of
                                                         e
    Addressing Mode               Syntax               (hex)    6502     65C02      65802/816      Bytes      Cycles
    Accumulator                   ASL A                 0A        x        x            x         1          2
    Absolute                      ASL addr              0E        x        x            x         3          61
    Direct Page (DP)              ASL dp                06        x        x            x         2          51,2
    Absolute Indexed, X           ASL addr, X           1E        x        x            x         3          71,3
    DP Indexed, X                 ASL dp, X             16        x        x            x         2          61,2

1    Add 2 cycles if m = 0 (16-bit memory/accumulator)
2    Add 1 cycle if low byte of Direct Page register is other than zero (DL< >0)
3    Subtract 1 cycle if 65C02 and no page boundary crossed




                                                                                                                       329
```

<!-- programmanual p330 -->

```
The Western Design Center

    Branch if Carry Clear                                                                                        BCC

         The carry flag in the P status register is tested. If it is clear, a branch is taken; if it is set, the instruction
immediately following the two-byte BCC instruction is executed.
         If the branch is taken, a one-byte signed displacement, fetched from the second byte of the instruction,
is sign-extended to sixteen bits and added to the program counter. Once the branch address has been calculated,
the result is loaded into the program counter, transferring control to that location.
         The allowable range of the displacement is – 128 to + 127 (from the instruction immediately following
the branch).
         BCC may be used in several ways: to test the result of a shift into the carry; to determine if the result of
a comparison is either less than (in which case a branch will be taken), or greater than or equal (which causes
control to fall through the branch instruction); or to determine if further operations are needed in multi-precision
arithmetic.
         Because the BCC instruction causes a branch to be taken after a comparison or subtraction if the
accumulator is less than the memory operand (since the carry flag will always be cleared as a result), many
assemblers allow an alternate mnemonic for the BCC instruction: BLT, or Branch if Less Than.

Flags Affected :           - - - - - - - -

Codes:

                                                       Opcode               Available on:                # of        # of
    Addressing Mode +
                                     Syntax             (hex)      6502      65C02      65802/816       Bytes      Cycles
    +
    Program Counter
                                BCC nearlabel             90          x         x            x            2        21,2
    Relative
                                    (or BLT
                                   nearlabel)
1    Add 1 cycle if branch is taken.
2    Add 1 more cycle if branch taken crosses page boundary on 6502, 65C02, or 65816/65802’s 6502
     emulation mode (e = 1)




                                                                                                                          330
```

<!-- programmanual p331 -->

```
The Western Design Center

    Branch if Carry Set                                                                                           BCS

         The carry flag in the P status register is tested. If it is set, a branch is taken; if it is clear, the instruction
immediately following the two-byte BCS instruction is executed.
         If the branch is taken, a one-byte signed displacement, fetched from the second byte of the instruction,
is sign-extended to sixteen bits and added to the program counter. Once the branch address has been calculated,
the result is loaded into the program counter, transferring control to that location.
         The allowable range of the displacement is – 128 to + 127 (from the instruction immediately following
the branch).
         BCS is used in several ways: to test the result of a shift into the carry; to determine if the result of a
comparison is either greater than or equal (which causes the branch to be taken) or less than; or to determine if
further operations are needed in multi-precision arithmetic operations.
         Because the BCS instruction causes a branch to be taken after a comparison or subtraction if the
accumulator is greater than or equal to the memory operand (since the carry flag will always be set as a result),
many assemblers allow an alternate mnemonic for the BCS instruction: BGE or Branch if Greater or Equal.

Flags Affected:            - - - - - - - -

Codes:

                                                      Opcode      Available on:                        # of        # of
    Addressing Mode                   Syntax           (hex) 6502 65C02 65802/816                      Bytes      Cycles
    Program Counter                    BCS
                                                         B0          x         x            x             2         21,2
    Relative                        nearlabel
                                     (or BGE
                                    nearlabel)

1    Add 1 cycle if branch is taken
2    Add 1 more cycle if branch taken crosses page boundary on 6502, 65C02, or 65816/65802’s 6502
     emulation mode (e = 1).




                                                                                                                        331
```

<!-- programmanual p332 -->

```
The Western Design Center

    Branch if Equal                                                                                      BEQ

         The zero flag in the P status register is tested. If it is set, meaning that the last value tested (which
affected the zero flag) was zero, a branch is taken; if it is clear, meaning the value tested was non-zero, the
instruction immediately following the two-byte BEQ instruction is executed.
         If the branch is taken, a one-byte signed displacement, fetched from the second byte of the instruction,
is sign-extended to sixteen bits and added to the program counter. Once the branch address has been calculated,
the result is loaded into the program counter, transferring control to that location.
         The allowable range of the displacement is – 128 to + 127 (from the instruction immediately following
the branch).
         BEQ may be used in several ways: to determine if the result of a comparison is zero (the two values
compared are equal), for example, or if a value just loaded, pulled, shifted, incremented or decremented is zero;
or to determine if further operations are needed in multi-precision arithmetic operations. Because testing for
equality to zero does not require a previous comparison with zero, it is generally most efficient for loop counters
to count downwards, existing when zero is reached.

Flags Affected:          - - - - - - - -


Codes:

                                              Opcode               Available on:        # of          # of
                                                                                        Byte         Cycle
    Addressing Mode           Syntax            (hex)      6502     65C02     65802/816
                                                                                         s             s
    Program        Counter BEQ
                                                 F0          x         x           x           2      21,2
    Relative               nearlabel
1    Add 1 cycle if branch is taken
2    Add 1 more cycle if branch taken crosses page boundary on 6502, 65C02, or 65816/65802’s 6502
     emulation mode (e = 1).




                                                                                                               332
```

<!-- programmanual p333 -->

```
The Western Design Center


    Test Memory Bits against Accumulator                                                                      BIT

          BIT sets the P status register flags based on the result of two different operations, making it a dual-
purpose instruction:
          First, it sets or clears the n flag to reflect the value of the high bit of the data located at the effective
address specified by the operand, and sets or clears the v flag to reflect the contents of the next-to-highest bit of
the data addressed.
          Second, it logically ANDs the data located at the effective address with the contents of the accumulator;
it changes neither value, but sets the z flag if the result is zero, or clears it if the result is non-zero.
          BIT is usually used immediately preceding a conditional branch instruction: to test a memory value’s
highest or next-to-highest bits; with a mask in the accumulator, to test any bits of the memory operand; or with a
constant as the mask (using immediate addressing) or a mask in memory, to test any bits in the accumulator.
All of these tests are non-destructive of the data in the accumulator or in memory. When the BIT instruction is
used with the immediate addressing mode, the n and v flags are unaffected.
          8-bit accumulator/memory (all processors): Data in memory is eight-bit; bit 7 is moved into the n
flag; bit 6 is moved into the v flag.
          16-bit accumulator/memory (65802/65816 only, m = 0): Data in memory is sixteen-bit: the low-order
eight bits are located at the effective address; the high-order eight bits are located at the effective address plus
one. Bit 15 is moved into the n flag; bit 14 is moved into the v flag.

Flags Affected:          n v - - - - z - (Other than immediate addressing)
                         - - - - - - z - (Immediate addressing only)
                           n    Takes value of most significant bit of memory data.
                           v    Takes value of next-to-highest bit of memory data.
                           z    Set if logical AND of memory and accumulator is zero; else cleared.

Codes:

                                              Opcode               Available on:                 # of         # of
    Addressing Mode          Syntax            (hex) 6502          65C02 65802/816              Bytes       Cycles
    Immediate                BIT # const        89                   x           x               2*        21
    Absolute                 BIT addr           2C     x             x           x               3         41
    Direct Page (DP)         BIT dp             24     x             x           x               2         31,2
    Absolute Indexed,
                             BIT addr, X         3C                    x             x            3        41,3
    X
    DP Indexed, X            BIT dp, X           34                    x             x            2        41,2
*    Add 1 byte if m = 0 (16-bit memory/accumulator)
1    Add 1 cycle if m = 0 (16-bit memory/accumulator)
2    Add 1 cycle if low byte of Direct Page register is other than zero (DL< >0)
3    Add 1 cycle if adding index crosses a page boundary




                                                                                                                   333
```

<!-- programmanual p334 -->

```
The Western Design Center


 Branch if Minus                                                                                            BMI

         The negative flag in the P status register is tested. If it is set, the high bit of the value which most
recently affected the n flag was set, and a branch is taken. A number with its high bit set may be interpreted as
a negative two’s-complement numbers, so this instruction tests, among other things, for the sign of two’s-
complement numbers. If the negative flag is clear, the high bit of the value which most recently affected the
flag was clear, or, in the two’s-complement system, was a positive number, and the instruction immediately
following the two-byte BMI instruction is executed.
         If the branch is taken, a one-byte signed displacement, fetched from the second byte of the instruction,
is sign-extended to sixteen bits and added to the program counter. Once the branch address has been calculated,
the result is loaded into the program counter, transferring control to that location.
         The allowable range of the displacement is – 128 to + 127 (from the instruction immediately following
the branch).
         BMI is primarily used to either determine, in two’s-complement arithmetic, if a value is negative or, in
logic situations, if the high bit of the value is set. It can also be used when looping down through zero (the loop
counter must have a positive initial value) to determine if zero has been passed and to effect an exit from the
loop.


Flags Affected:          - - - - - - - -


Codes:


                                              Opcode             Available on:              # of     # of
                                                                                                    Cycle
    Addressing Mode            Syntax          (hex)     6502     65C02     65802/816      Bytes
                                                                                                      s
    Program         Counter BMI
                                                 30        x         x           x         2        21,2
    Relative                nearlabel
1    Add 1 cycle if branch is taken.
2    Add 1 more cycle if branch taken crosses page boundary on 6502, 65C02, or 65816/65802’s 6502
     emulation mode (e = 1)




                                                                                                               334
```

<!-- programmanual p335 -->

```
The Western Design Center


    Branch if Not Equal                                                                                         BNE

         The zero flag in the P status register is tested. If it is clear (meaning the value just tested is non-zero), a
branch is taken; if it is set (meaning the value tested is zero), the instruction immediately following the two-byte
BNE instruction is executed.
         If the branch is taken, a one-byte signed displacement, fetched from the second byte of the instruction,
is sign-extended to sixteen bits and added to the program counter. Once the branch address has been calculated,
the result is loaded into the program counter, transferring control to that location.
         The allowable range of the displacement is – 128 to + 127 (from the instruction immediately following
the branch).
         BNE may be used in several ways: to determine if the result of a comparison is non-zero (the two
values compared are not equal), for example, or if the value just loaded or pulled from the stack is non-zero, or
to determine if further operations are needed in multi-precision arithmetic operations.

Flags Affected:           - - - - - - - -

Codes:

                                                Opcode            Available on:                  # of       # of
    Addressing Mode           Syntax             (hex)       6502 65C02 65802/816                Bytes     Cycles
                              BNE
    Program           Counter
                              nearlabe             D0           x         x            x         2       21,2
    Relative
                              l
1    Add 1 cycle if branch is taken
2    Add 1 more cycle if branch taken crosses page boundary on 6502, 65C02, or 65816/65802’s 6502
     emulation mode (e = 1)




                                                                                                                    335
```

<!-- programmanual p336 -->

```
The Western Design Center

    Branch if Plus                                                                                            BPL

         The negative flag in the P status register is tested. If it is clear – meaning that the last value which
affected the zero flag had it’s high bit clear – a branch is taken. In the two’s complement system, values with
their high bit clear are interpreted as positive numbers. If the flag is set, meaning the high bit of the last value
was set, the branch is not taken; it is a two’s-complement negative number, and the instruction immediately
following the two-byte BPL instruction is executed.
         If the branch is taken, a one-byte signed displacement, fetched from the second byte of the instruction,
is sign-extended to sixteen bits and added to the program counter. Once the branch address has been calculated,
the result is loaded into the program counter, transferring control to that location.
         The allowable range of the displacement is – 128 to + 127 (from the instruction immediately following
the branch).
         BPL is used primarily to determine, in two’s-complement arithmetic, if a value is positive or not or, in
logic situations, if the high bit of the value is clear.

Flags Affected:          - - - - - - - -

Codes:

                                              Opcode           Available on:                  # of       # of
    Addressing Mode      Syntax                (hex)      6502 65C02 65802/816                Bytes     Cycles
    Program      Counter BPL
                                                 10         x         x             x         2        21,2
    Relative             nearlabel
1    Add 1 cycle if branch is taken
2    Add 1 more cycle if branch taken crosses page boundary on 6502, 65C02, or 65816/65802’s 6502
     emulation mode (e = 1)




                                                                                                                 336
```

<!-- programmanual p337 -->

```
The Western Design Center

 Branch Always                                                                                            BRA

          A branch is always taken, and no testing is done: in effect, an unconditional JMP is executed, but since
signed displacements are used, the instruction is only two bytes, rather than the three bytes of a JMP.
Additionally, using displacements from the program counter makes the BRA instruction relocatable. Unlike a
JMP instruction, the BRA is limited to targets that lie within the range of the one-byte signed displacement of
the conditional branches: - 128 to + 127 bytes from the first byte following the BRA instruction.
          To branch, a one-byte signed displacement, fetched from the second byte of the instruction, is sign-
extended to sixteen bits and added to the program counter. Once the branch address has been calculated, the
result is loaded into the program counter, transferring control to that location.

Flags Affected:         - - - - - - - -

Codes:

                                           Opcode           Available on:               # of      # of
    Addressing Mode      Syntax             (hex)      6502 65C02 65802/816             Bytes    Cycles
    Program Counter      BRA
                                              80                  x            x        2        31
    Relative             nearlabel
1    Add 1 cycle if branch crosses page boundary on 65C02 or in 65816/65802’s 6502 emulation mode (e = 1)




                                                                                                              337
```

<!-- programmanual p338 -->

```
The Western Design Center

 Software Break                                                                                              BRK

         Force a software interrupt. BRK is unaffected by the i interrupt disable flag.
         Although BRK is a one-byte instruction, the program counter (which is pushed onto the stack by the
instruction) is incremented by two; this lets you follow the break instruction with a one-byte signature byte
indicating which break caused the interrupt. Even if a signature byte is not needed, either the byte following the
BRK instruction must be padded with some value or the break-handling routine must decrement the return
address on the stack to let an RTI (return from interrupt) instruction executed correctly.
         6502, 65C02, and Emulation Mode (e = 1): The program counter is incremented by two, then pushed
onto the stack; the status register, with the b break flag set, is pushed onto the stack; the interrupt disable flag is
set; and the program counter is loaded from the interrupt vector at $FFFE-FFFF. It is up to the interrupt
handling routine at this address to check the b flag in the stacked status register to determine if the interrupt was
caused by a software interrupt (BRK) or by a hardware IRQ, which shares BRK vector but pushes the status
register onto the stack with the b break flag clear. For example,


                0000    68                   PLA                                       copy status from
                0001    48                   PHA                                          top of stack
                0002    2910                 AND                  #$10                 check BRK bit
                0004    D007                 BNE                  ISBRK                branch if set


                                                   Fragment 18.1

         65802/65816 Native Mode (e = 0): The program counter bank register is pushed onto the stack; the
program counter is incremented by two and pushed onto the stack; the status register is pushed onto the stack;
the interrupt disable flag is set; the program bank register is cleared to zero; and the program counter is loaded
from the break vector at $00FFE6-00FFE7.
         6502: The d decimal flag is not modified after a break is executed.
         65C02 and 65816/65802: The d decimal flag is reset to 0 after a break is executed.




                                                                                                                   338
```

<!-- programmanual p339 -->

```
The Western Design Center


                                                                  Stack



                                                              Bank Address

                                                              Address High

                                                              Address Low
                                                               Contents of
                                                             Status Register
                                  Stack Pointer

                                                                  Bank 0



                                 Figure 18-3 65802/65816 Stack After BRK


Flags Affected:       - - - b - i - -          (6502)
                      - - - b d i - -          (65C02, 65802/65816 emulation mode e = 1)
                      - - - - d i - -          (65802/65816 native mode e = 0)
                      b b in the P register value pushed onto the stack is set.
                      d d is reset to 0, for binary arithmetic.
                      i The interrupt disable flag is set, disabling hardware IRQ interrupts.

Codes:

                                Opcode            Available on:            # of       # of
   Addressing
                       Syntax     (hex)    6502   65C02     65802/816      Bytes     Cycles
   Mode
   Stack/Interrupt     BRK         00        x       x            x        2*        71
*    BRK is 1 byte, but program counter value pushed onto stack is incremented by 2 allowing for optional
signature
    byte.
1 Add 1 cycle for 65802/65816 native mode (e = 0)




                                                                                                     339
```

<!-- programmanual p340 -->

```
The Western Design Center


 Branch Always Long                                                                                        BRL

         A branch is always taken, similar to the BRA instruction. However, BRL is a three-byte instruction;
the two bytes immediately following the opcode form a sixteen-bit signed displacement from the program
counter. Once the branch address has been calculated, the result is loaded into the program counter, transferring
control to that location.
         The allowable range of the displacement is anywhere within the current 64K program bank.
         The long branch provides an unconditional transfer of control similar to the JMP instruction, with one
major advantage: the branch instruction is relocatable while jump instructions are not. However, the (non-
relocatable) jump absolute instruction executes one cycle faster.

Flags Affected:         - - - - - - - -

Codes:

                                               Opcode             Available on:             # of         # of
  Addressing Mode             Syntax            (hex)     6502    65C02 65802/816           Bytes       Cycles
  Program Counter
                              BRL label           82                              x        3        4
  Relative Long




                                                                                                                 340
```

<!-- programmanual p341 -->

```
The Western Design Center

 Branch if Overflow Clear                                                                                BVC

         The overflow flag in the P status register is tested. If it is clear, a branch is taken; if it is set, the
instruction immediately following the two-byte BVC instruction is executed.
         If the branch is taken, a one-byte signed displacement, fetched from the second byte of the instruction,
is sign-extended to sixteen bits and added to the program counter. Once the branch address has been calculated,
the result is loaded into the program counter, transferring control to that location.
         The allowable range of the displacement is – 128 to + 127 (from the instruction immediately following
the branch).
         The overflow flag is altered by only four instructions on the 6502 and 65C02 – addition, subtraction, the
CLV clear-the-flag instruction, and the BIT bit-testing instruction. In addition, all the flags are restored from
the stack by the PLP and RTI instructions. On the 65802/65816, however, the SEP and REP instructions can
also modify the v flag.
         BVC is used almost exclusively to check that a two’s-complement arithmetic calculation has not
overflowed, much as the carry is used to determine if an unsigned arithmetic calculation has overflowed. (Note,
however, that the compare instructions do not affect the overflow flag.) You can also use BVC to test the
second – highest bit in a value by using it after the BIT instruction, which moves the second – highest bit of the
tested value into the v flag.
         The overflow flag can also be set by the Set Overflow hardware signal on the 6502, 65C02, and 65802;
on many systems, however, there is no connection to this pin.

Flags Affected:          - - - - - - - -

Codes:

                                              Opcode             Available on:               # of       # of
    Addressing Mode           Syntax           (hex)      6502    65C02 65802/816            Bytes     Cycles
    Program Counter           BVC
                                                 50         x         x           x         2          21,2
    Relative                  nearlabel
1    Add 1 cycle if branch is taken
2    Add 1 more cycle if branch taken crosses page boundary on 6502, 65C02, or 65816/65802’s 6502
     emulation mode (e = 1)




                                                                                                                341
```

<!-- programmanual p342 -->

```
The Western Design Center

 Branch if Overflow Set                                                                                   BVS

         The overflow flag in the P status register is tested. If it is set, a branch is taken; if it is clear, the
instruction immediately following the two-byte BVS instruction is executed.
         If the branch is taken, a one-byte signed displacement, fetched from the second byte of the instruction,
is sign-extended to sixteen bits and added to the program counter. Once the branch address has been calculated,
the result is loaded into the program counter, transferring control to that location.
         The allowable range of the displacement is – 128 to + 127 (from the instruction immediately following
the branch).
         The overflow flag is altered by only four instructions on the 6502 and 65C02 – addition, subtraction, the
CLV clear-the-flag instruction and the BIT bit-testing instructions. In addition, all the flags are restored from
the stack by the PLP and RTI instruction. On the 65802/65816, the SEP and REP instructions can also modify
the v flag.
         BVS is used almost exclusively to determine if a two’s-complement arithmetic calculation has
overflowed, much as the carry is used to determine if an unsigned arithmetic calculation has overflowed. (Note,
however, that the compare instructions do not affect the overflow flag.) You can also use BVS to test the
second-highest bit in a value by using it after the BLT instruction, which moves the second-highest bit of the
tested value into the v flag.
         The overflow flag can also be set by the Set Overflow hardware signal on the 6502, 65C02, and 65802;
on many systems, however, there is no hardware connection to this signal.

Flags Affected:          - - - - - - - -

Codes:

                                           Opcode              Available on:               # of      # of
                                                                                                    Cycle
  Addressing Mode         Syntax            (hex)      6502     65C02     65802/816       Bytes
                                                                                                      s
 Program Counter      BVS
                                      70        x       x         x       2        21,2
 Relative             nearlabel
1 1 Add 1 cycle if branch is taken
2 Add 1 more cycle if branch taken crosses page boundary on 6502, 65C02, or 65816/65802’s 6502
  emulation mode (e = 1)




                                                                                                               342
```

<!-- programmanual p343 -->

```
The Western Design Center

 Clear Carry Flag                                                                                           CLC

        Clear the carry flag in the status register.
        CLC is used prior to addition (using the 65x’s ADC instruction) to keep the carry flag from affecting
the result; prior to a BCC (branch on carry clear) instruction on the 6502 to force a branch-always; and prior to
an XCE (exchange carry flag with emulation bit) instruction to put the 65802 or 65816 into native mode.

Flags Affected:         - - - - - - - c
                        c carry flag cleared always.

Codes:

                                 Opcode                Available on:                   # of          # of
  Addressing
                     Syntax        (hex)     6502      65C02        65802/816          Bytes      Cycles
  Mode
  Implied            CLC            18         x          x              x         1             2




                                                                                                              343
```

<!-- programmanual p344 -->

```
The Western Design Center

  Clear Decimal Mode Flag                                                                       CLD

       Clear the decimal mode flag in the status register.
       CLD is used to shift 65x processors back into binary mode from decimal mode, so that the ADC and
SBC instructions will correctly operate on binary rather than BCD data.

Flags Affected:       - - - - d - - -
                      d decimal mode flag cleared always.

Codes:

                              Opcode            Available on:               # of           # of
 Addressing
                    Syntax     (hex)    6502     65C02     65802/816       Bytes         Cycles
 Mode
 Implied            CLD         D8        x        x            x            1              2




                                                                                                   344
```

<!-- programmanual p345 -->

```
The Western Design Center

 Clear Interrupt Disable Flag                                                                                 CLI

         Clear the interrupt disable flag in the status register.
         CLI is used to re-enable hardware interrupt (IRQ) processing. (When the i bit is set, hardware
interrupts are ignored.) The processor itself sets the i flag when it begins servicing an interrupt, so interrupt
handling routines must re-enable interrupts with CLI if the interrupt-service routine is designed to service
interrupts that occur while a previous interrupt is still being handled; otherwise, the RTI instruction will restore
a clear i flag from the stack, and CLI is not necessary. CLI is also used to re-enable interrupts if they have
been disabled during execution of time-critical or other code which cannot be interrupted.

Flags Affected:          - - - - - i - -
                         i interrupt disable flag cleared always.

Codes:

                                 Opcode             Available on:                  # of           # of
  Addressing
                      Syntax      (hex)     6502     65C02      65802/816         Bytes         Cycles
  Mode
  Implied             CLI          58         x         x            x              1              2




                                                                                                                345
```

<!-- programmanual p346 -->

```
The Western Design Center

 Clear Overflow Flag                                                                               CLV

        Clear the overflow flag in the status register.
        CLV is sometimes used prior to a BVC (branch on overflow clear) to force a branch-always on the
6502. Unlike the other clear flag instructions, there is no complementary “set flag” instruction to set the
overflow flag, although the overflow flag can be set by hardware via the Set Overflow input pin on the
processor. This signal, however, is often unconnected. The 65802/65816 REP instruction can, of course, clear
the overflow flag; on the 6502 and 65C02, a BIT instruction with a mask in memory that has bit 6 set can be
used to set the overflow flag.

Flags Affected:        - v - - - - - -
                       v overflow flag cleared always.

Codes:

                              Opcode            Available on:              # of        # of
  Addressing
                  Syntax       (hex)     6502    65C02     65802/816      Bytes      Cycles
  Mode
  Implied         CLV           B8         x        x            x            1          2




                                                                                                        346
```

<!-- programmanual p347 -->

```
The Western Design Center

  Compare Accumulator with Memory                                                                            CMP

         Subtract the data located at the effective address specified by the operand from the contents of the
accumulator, setting the carry, zero, and negative flags based on the result, but without altering the contents of
either the memory location or the accumulator. That is, the result is not saved. The comparison is of unsigned
binary values only.
         The CMP instruction differs from the SBC instruction in several ways. First, the result is not saved.
Second, the value in the carry prior to the operation is irrelevant to the operation; that is, the carry does not have
to be set prior to a compare as it is with 65x subtractions. Third, the compare instruction does not set the
overflow flag, so it cannot be used for signed comparisons. Although decimal mode does not affect the CMP
instruction, decimal comparisons are effective, since the equivalent binary values maintain the same magnitude
relationships as the decimal values have, for example, $99 > $04 just as 99 > 4.
         The primary use for the compare instruction is to set the flags so that a conditional branch can then be
executed.
         8-bit accumulator (all processors): Data compared is eight-bit.
         16-bit accumulator (65802/65816 only, m = 0): Data compared is sixteen-bit: the low-order eight bits
of the data in memory are located at the effective address; the high-order eight bits are located at the effective
address plus one.

Flags Affective:         n — — — — — z c
                         n Set if most significant bit of result is set; else cleared.
                         z Set if result is zero; else cleared.
                         c Set if no borrow required (accumulator value higher or same);
                           cleared if borrow required (accumulator value lower).




                                                                                                                  347
```

<!-- programmanual p348 -->

```
The Western Design Center

Codes:

                                            Opcode              Available on:     # of    # of
 Addressing Mode + +         Syntax           (hex)      6502 65C02 65802/816 Bytes Cycles
                             CMP
  Immediate                                    C9          x        x         x  2*      21
                             #const
  Absolute                   CMP addr          CD          x        x         x  3       41
  Absolute Long              CMP long          CF                             x  4       51
  Direct Page (also DP)      CMP dp            C5          x        x         x  2       31, 2
  DP Indirect                CMP (dp)          D2                   x         x  2       51, 2
  DP Indirect Long           CMP [dp]          C7                             x  2       61, 2
                             CMP addr,
  Absolute Indexed, X                          DD          x        x         x  3       41, 3
                             X
  Absolute Long Indexed, CMP long,
                                               DF                             x  4       51
  X                          X
                             CMP addr,
  Absolute Indexed, Y                          D9          x        x         x  3       41, 3
                             Y
  DP Indexed, X              CMP dp, X         D5          x        x         x  2       41, 2
                             CMP (dp,
  DP Indexed Indirect, X                       C1          x        x         x  2       61, 2
                             X)
                             CMP (dp),
  DP Indirect Indexed, Y                       D1          x        x         x  2       51, 2, 3
                             Y
  DP      Indirect    Long CMP [dp],
                                               D7                             x  2       61, 2
  Indexed, Y                 Y
  Stack Relative (also SR) CMP sr, S           C3                             x  2       41
                             CMP (sr,
  SR Indirect Indexed, Y                       D3                             x  2       71
                             S), Y
+ + CMP, a Primary Group Instruction, has available all of the Primary Group addressing modes and
     bit patterns
* Add 1 byte if m = 0 (16-bit memory/accumulator)
1 Add 1 cycle if m = 0 (16-bit memory/accumulator)
2 Add 1 cycle if low byte of Direct Page register is other than zero (DL< >0)
3 Add 1 cycle if adding index crosses a page boundary




                                                                                              348
```

<!-- programmanual p349 -->

```
The Western Design Center

 Co-Processor Enable                                                                                           COP

         Execution of COP causes a software interrupt, similarly to BRK, but through the separate COP vector.
Alternatively, COP may be trapped by a co-processor, such as a floating point or graphics processor, to call a
co-processor function. COP is unaffected by the i interrupt disable flag.
         COP is much like BRK, with the program counter value pushed on the stack being incremented by
two; this lets you follow the co-processor instruction with a signature byte to indicate to the co-processor or co-
processor handling routine which operation to execute. Unlike the BRK instruction, 65816 assemblers require
you to follow the COP instruction with such a signature byte. Signature bytes in the range $80-$FF are
reserved by the Western Design Center for implementation of co-processor control; signatures in the range $00-
$7F are available for use with software-implemented COP handlers.
         6502 Emulation Mode (65802/65816, e=1): The program counter is incremented by two and pushed
onto the stack; the status register is pushed onto the stack; the interrupt disable flag is set; and the program
counter is loaded from the emulation mode co-processor vector at $FFF4-FFF5. The d decimal flag is cleared
after a COP is executed.
         65802/65816 Native Mode (e = 0): The program counter bank register is pushed onto the stack; the
program counter is incremented by two and pushed onto the stack; the status register is pushed onto the stack;
the interrupt disable flag is set; the program bank register is cleared to zero; and the program counter is loaded
from the native mode co-processor vector at $00FFE4-00FFE5. The d decimal flag is reset to 0 after a COP is
executed.
                                                                  Stack



                                                              Bank Address

                                                              Address High

                                                              Address Low
                                                            Contents of Status
                                                                Register


                                       Stack Pointer

                                                                 Bank 0


                                           Figure 18-4 Stack after COP


Flag Affected:           - - - - d i - -
                         d d is rest to 0.
                         i The interrupt disable flag is set, disabling hardware interrupts.

Codes:
                                       Opcode              Available on:                   # of         # of
    Addressing
                       Syntax           (hex)      6502     65C02         65802/816     Bytes       Cycles
    mode
    Stack/Interrupt    COP const         02                                  x        2*           71
*    COP is 1 byte, but program counter value pushed onto stack is incremented by 2 allowing for optional code
        byte
1    Add 1 cycle for 65816/65802 native mode (e = 0)



                                                                                                                 349
```

<!-- programmanual p350 -->

```
The Western Design Center

  Compare Index Register X with Memory                                                                         CPX

         Subtract the data located at the effective address specified by the operand from the contents of the X
register, setting the carry, zero, and negative flags based on the result, but without altering the contents of either
the memory location or the register. The result is not saved. The comparison is of unsigned values only (except
for signed comparison for equality).
         The primary use for the CPX instruction is to test the value of the X index register against loop
boundaries, setting the flags so that a conditional branch can be executed.
         8-bit index registers (all processors): Data compared is eight-bit.
         16-bit index registers (65802/65816 only, x = 0): Data compared is sixteen-bit: the low-order eight
bits of the data in memory are located at the effective address; the high-order eight bits are located at the
effective address plus one.

Flags Affected:          n - - - - - z c
                         n      Set if most significant bit of result is set; else cleared.
                         z      Set if result is zero; else cleared.
                         c      Set if no borrow required (X register value higher or same);
                                cleared if borrow required (X register value lower).

Codes:

                                          Opcode      Available on:                       # of         # of
  Addressing Mode          Syntax          (hex) 6502 65C02 65802/816                    Bytes        Cycles
                           CPX
  Immediate                                 E0          x        x            x         2*       21
                           #const
 Absolute                  CPX addr   EC        x        x          x      3                     41
 Direct Page (also
                      CPX dp          E4        x        x          x      2                     31, 2
 DP)
* Add 1 byte if x = 0 (16-bit index registers)
1 Add 1 cycle if x = 0 (16-bit index registers)
2 Add 1 cycle if low byte of Direct Page register is other than zero (DL< >0)




                                                                                                                  350
```

<!-- programmanual p351 -->

```
The Western Design Center

  Compare Index Register Y with Memory CPY                                                                   CPY

         Subtract the data located at the effective address specified by the operand from the contents of the Y
register, setting the carry, zero, and negative flags based on the result, but without altering the contents of either
the memory location or the register. The comparison is of unsigned values only (expect for signed comparison
for equality).
         The primary use for the CPY instruction is to test the value of the Y index register against loop
boundaries, setting the flags so that a conditional branch can be executed.
         8-bit index registers (all processors): Data compared is eight-bit.
         16-bit index registers (65802/65816 only, x = 0): Data compared is sixteen-bit: the low-order eight
bits of the data in memory is located at the effective address; the high-order eight bits are located at the effective
address plus one.


Flags Affected:          n - - - - - z c
                         n Set if most significant bit of result is set; else cleared.
                         z Set if result is zero; else cleared.
                         c Set if no borrow required (Y register value higher or same);
                           cleared if borrow required (Y register value lower).


Codes:

                                              Opcode              Available on:               # of        # of
 Addressing Mode +
                        Syntax           (hex)    6502 65C02 65802/816                        Bytes     Cycles
 +
 Immediate              CPY # const       C0        x         x         x                      2*          21
 Absolute               CPY addr          CC        x         x         x                       3          41
 Direct Page (also
                        CPY dp            C4        x         x         x                       2         31, 2
 DP)
* Add 1 byte if x = 0 (16-bit index registers)
1 Add 1 cycle if x = 0 (16-bit index registers)
2 Add 1 cycle if low byte of Direct Page register is other than zero (DL< >0)




                                                                                                                  351
```

<!-- programmanual p352 -->

```
The Western Design Center

 Decrement                                                                                                  DEC

         Decrement by one the contents of the location specified by the operand (subtract one from the value).
         Unlike subtracting a one using the SBC instruction, the decrement instruction is neither affected by nor
affected the carry flag. You can test for wraparound only by testing after every decrement to see if the value is
zero or negative. On the other hand, you don’t need to set the carry before decrementing.
         DEC is unaffected by the setting of the d (decimal) flag.
         8-bit accumulator/memory (all processors): Data decremented is eight-bit.
         16-bit accumulator/memory (65802/65816 only, m = 0): Data Decremented is sixteen-bit: if in
memory, the low-order eight bits are located at the effective address; the high-order eight bits are located at the
effective address plus one.

Flags Affected:          n - - - - - z -
                         n Set if most significant bit of result is set; else cleared.
                         z Set if result is zero; else cleared.
Codes:

                                           Opcode      Available on:                     # of      # of
 Addressing Mode Syntax                     (hex) 6502 65C02 65802/816                   Bytes    Cycles
 Accumulator          DEC A                  3A           x          x                    1         2
 Absolute             DEC addr               CE     x     x          x                    3         61
 Direct Page (also
                      DEC dp           C6         x        x          x                    2        51, 2
 DP)
 Absolute Indexed,
                      DEC addr, X      DE         x        x          x                    3        71, 3
 X
 DP Indexed, X        DEC dp, X        D6         x        x          x                    2        61,2
1 Add 2 cycles if m = 0 (16-bit memory/accumulator)
2 Add 1 cycle if low byte of Direct Page register is other than zero (DL<>0)
3 Subtract 1 cycle if 65C02 and no page boundary crossed




                                                                                                               352
```

<!-- programmanual p353 -->

```
The Western Design Center

  Decrement Index Register X                                                                           DEX

        Decrement by one the contents of index register X (subtract one from the value). This is a special
purpose, implied addressing form of the DEC instruction.
        Unlike using SBC to subtract a one from the value, the DEX instruction does not affect the carry flag;
you can test for wraparound only by testing after every decrement to see if the value is zero or negative. On the
other hand, you don’t need to set carry before decrementing.
        DEX is unaffected by the setting of the d (decimal) flag.
        8-bit index registers (all processors): Data decremented is eight-bit.
        16-bit index registers (65802/65816 only, x = 0): Data decremented is sixteen-bit.


Flags Affected:         n - - - - - z -
                        n Set if most significant bit of result is set; else cleared.
                        z Set if result is zero; else cleared.


Codes:

                                  Opcode              Available on:               # of      # of
  Addressing
                      Syntax       (hex)      6502     65C02     65802/816       Bytes    Cycles
  Mode
  Implied             DEX           CA          x         x             x         1        2




                                                                                                             353
```

<!-- programmanual p354 -->

```
The Western Design Center

  Decrement Index Register Y                                                                            DEY

        Decrement by one the contents of index register Y (subtract one from the value). This is a special
purpose, implied addressing form of the DEC instruction.
        Unlike using SBC to subtract a one from the value, the DEY instruction does not affect the carry flag;
you can test for wraparound only by testing after every decrement to see if the value is zero or negative. On the
other hand, you don’t need to set the carry before decrementing.
        DEY is unaffected by the setting of the d (decimal) flag.
        8-bit index registers (all processors): Data decremented is eight-bit.
        16-bit index registers (65802/65816 only, x = 0): Data decremented is sixteen-bit.

Flags Affected:         n - - - - - z -
                        n Set if most significant bit of result is set; else cleared.
                        z Set if result is zero; else clear.

Codes:

                                   Opcode             Available on:               # of      # of
  Addressing
                       Syntax       (hex)      6502    65C02     65802/816       Bytes    Cycles
  Mode
  Implied              DEY            88         x        x            x           1         2




                                                                                                             354
```

<!-- programmanual p355 -->

```
The Western Design Center

  Exclusive-OR Accumulator with Memory                                                                  EOR

        Bitwise logical Exclusive-OR the data located at the effective address specified by the operand with the
contents of the accumulator. Each bit in the accumulator is exclusive-ORed with the corresponding bit in
memory, and the result is stored into the same accumulator bit.
        The truth table for the logical exclusive-OR operation is:

                                                    Second     Operand
                                                       0          1
                                 First Operand
                                             0         0            1
                                             1         1            0


Figure 18-5Exclusive OR Truth Table


        A 1 or logical true results only if the two elements of the Exclusive-OR operation are different.
        8-bit accumulator (all processors): Data exclusive-ORed from memory is eight-bit.
        16-bit accumulator (65802/65816 only, m = 0): Data exclusive-ORed from memory is sixteen-bit: the
low-order eight bits are located at the effective address; the high-order eight bits are located at the effective
address plus one.

Flags Affected:         n - - - - - z -
                        n Set if most significant bit of result is set; else cleared.
                        z Set if result is zero; else cleared.




                                                                                                             355
```

<!-- programmanual p356 -->

```
The Western Design Center

Codes:

                                                            Opcode                Available on:           # of        # of
                                                                                                         Byte        Cycle
  Addressing Mode                     Syntax                  (hex)      6502      65C02       65802/816
                                                                                                           s            s
  Immediate                           EOR # const              49           x          x           x     2*          21
  Absolute                            EOR addr                 4D           x          x           x     3           41
  Absolute Long                       EOR long                 4F                                  x     4           51
  Direct Page (also DP)               EOR dp                   45           x          x           x     2           31, 2
  DP Indirect                         EOR (dp)                 52                      x           x     2           51, 2
  DP Indirect Long                    EOR [dp]                 47                                  x     2           61, 2
  Absolute Indexed, X                 EOR addr, X              5D           x          x           x     3           41, 3
  Absolute Long Indexed,
                                      EOR long, X              5F                                    x           4   51
  X
  Absolute Indexed, Y                 EOR addr, Y              59           x          x             x           3   41, 3
  DP Indexed, X                       EOR dp, X                55           x          x             x           2   41, 2
  DP Indexed Indirect, X              EOR (dp, X)              41           x          x             x           2   61, 2
  DP Indirect Indexed, Y              EOR (dp), Y              51           x          x             x           2   51, 2, 3
  DP     Indirect     Long
                                      EOR [dp], Y              57                                    x           2   61, 2
  Indexed, Y
  Stack Relative (also SR)            EOR sr, S                43                                    x           2   41
                                      EOR (sr, S),
  SR Indirect Indexed, Y                                       53                                    x           2   71
                                      Y
+ + EOR, a Primary Group Instruction, has available all of the Primary Group addressing modes and bit patterns
* Add 1 byte if m = 0 (16-bit memory/accumulator)
1 Add 1 cycle if m = 0 (16-bit memory/accumulator)
2 Add 1 cycle if low byte of Direct Page register is other than zero (DL<>0)
3 Add 1 cycle if adding index crosses a page boundary




                                                                                                                                356
```

<!-- programmanual p357 -->

```
The Western Design Center

  Increment                                                                                                INC

         Increment by one the contents of the location specified by the operand (add one to the value).
         Unlike adding a one with the ADC instruction, however, the increment instruction is neither affected by
nor affects the carry flag. You can test for wraparound only by testing after every increment to see if the result
is zero or positive. On the other hand, you don’t have to clear the carry before incrementing.
         The INC instruction is unaffected by the d (decimal) flag.
         8-bit accumulator/memory (all processors): Data incremented is eight-bit.
         16-bit accumulator/memory (65802/65816 only, m=0): Data incremented is sixteen-bit: if in
memory, the low-order eight bits are located at the effective address; the high-order eight-bits are located at the
effective address plus one.

Flags Affected:          n - - - - - z -
                         n Set if most significant bit of result is set; else cleared.
                         z Set if result is zero; else cleared.

Codes:

                                    Opcode             Available on:         # of                 # of
 Addressing Mode       Syntax        (hex)    6502 65C02 65802/816 Bytes                         Cycles
 Accumulator           INC A          1A                  x           x       1                    2
 Absolute              INC addr       EE        x         x           x       3                    61
 Direct Page (also
                       INC dp         E6        x         x           x       2                    51, 2
 DP)
 Absolute Indexed, INC addr,
                                      FE        x         x           x       3                    71, 3
 X                     X
 DP Indexed, X         INC dp, X      F6        x         x           x       2                    61, 2
1 Add 2 cycles if m = 0 (16-bit memory/accumulator)
2 Add 1 cycle if low byte of Direct Page register is other than zero (DL<>0)
3 Subtract 1 cycle if 65C02 and no page boundary crossed




                                                                                                               357
```

<!-- programmanual p358 -->

```
The Western Design Center

  Increment Index Register X                                                                              INX

         Increment by one the contents of index register X (add one to the value). This is a special purpose,
implied addressing form of the INC instruction.
         Unlike using ADC to add a one to the value, the INX instruction does not affect the carry flag. You can
execute it without first clearing the carry. But you can test for wraparound only by testing after every increment
to see if the result is zero or positive. The INX instruction is unaffected by the d (decimal) flag.
         8-bit index registers (all processors): Data incremented is eight-bit.
         16-bit index registers (65802/65816 only, x = 0): Data incremented is sixteen-bit.

Flags Affected:         n - - - - - z -
                        n Set if most significant bit of result is set; else cleared.
                        z Set if result is zero; else cleared.

Codes:

                                 Opcode               Available on:               # of        # of
  Addressing
                     Syntax       (hex)     6502      65C02       65802/816      Bytes       Cycles
  Mode
  Implied            INX            E8        x          x             x            1           2




                                                                                                              358
```

<!-- programmanual p359 -->

```
The Western Design Center

  Increment Index Register Y                                                                               INY

         Increment by one the contents of index register Y (add one to the value). This is a special purpose,
implied addressing form of the INC instruction.
         Unlike using ADC to add one to the value, the INY instruction does not affect the carry flag. You can
execute it without first clearing the carry. But you can test for wraparound only by testing after every increment
to see if the value is zero or positive. The INY instruction is unaffected by the d (decimal) flag.
         8-bit index registers (all processors): Data incremented is eight-bit.
         16-bit index registers (65802/65816 only, x = 0): Data incremented is sixteen-bit.

Flags Affected:         n - - - - - z -
                        n Set if most significant bit of result is set; else cleared.
                        z Set if result is zero; else cleared.

Codes:

                                  Opcode              Available on:               # of       # of
  Addressing
                     Syntax         (hex)    6502     65C02      65802/816       Bytes     Cycles
  Mode
  Implied            INY             C8        x         x            x            1          2




                                                                                                              359
```

<!-- programmanual p360 -->

```
The Western Design Center

  Jump                                                                                                    JMP

         Transfer control to the address specified by the operand field.
         The program counter is loaded with the target address. If a long JMP is executed, the program counter
bank is loaded from the third byte of the target address specified by the operand.

Flags Affected:        - - - - - - - -

Codes:

                                          Opcode           Available on:                 # of     # of
 Addressing Mode +
                         Syntax            (hex)    6502 65C02 65802/816                 Bytes    Cycles
 +
 Absolute                JMP addr           4C        x       x           x                3      3
 Absolute Indirect       JMP (addr)         6C        x       x           x                3      51, 2
 Absolute     Indexed JMP (addr,
                                            7C                x           x                3      6
 Indirect                X)
 Absolute Long           JMP long           5C                            x                4      4
                      (or JML long)
 Absolute      Indirect
                         JMP [addr]         DC                            x                3      6
 Long
                      (or       JML
                      [addr])
1 1 Add 1 cycle if 65C02
2 6502: If low byte of addr is $FF (i.e., addr is $xxFF): yields incorrect result




                                                                                                            360
```

<!-- programmanual p361 -->

```
The Western Design Center

 Jump to Subroutine Long (Inter-Bank)                                                                        JSL

         Jump-to-subroutine with long (24-bit) addressing: transfer control to the subroutine at the 24-bit address
which is the operand, after first pushing a 24-bit (long) return address onto the stack. This return address is the
address of the last instruction byte (the fourth instruction byte, or the third operand byte), not the address of the
next instruction; it is the return address minus one.
         The current program counter bank is pushed onto the stack first, then the high-order byte of the return
address and then the low-order byte of the address are pushed on the stack in standard 65x order (low byte in the
lowest address, bank byte in the highest address). The stack pointer is adjusted after each byte is pushed to
point to the next lower byte (the next available stack location). The program counter bank register and program
counter are then loaded with the operand values, and control is transferred to the specified location.

Flags Affected:          - - - - - - - -

Codes:

                                       Opcode                 Available on:                    # of        # of
  Addressing
                       Syntax           (hex)       6502         65C02       65802/816        Bytes      Cycles
  Mode
  Absolute Long        JSL long           22                                       x            4           8
                       (or JSR
                       long)




                                                                                                                  361
```

<!-- programmanual p362 -->

```
The Western Design Center

 Jump to Subroutine                                                                                          JSR

         Transfer control to the subroutine at the location specified by the operand, after first pushing onto the
stack, as a return address, the current program counter value, that is, the address of the last instruction byte (the
third byte of a three-byte instruction, the fourth byte of a four-byte instruction), not the address of the next
instruction.
         If an absolute operand is coded and is less than or equal to $FFFF, absolute addressing is assumed by
the assembler; if the value is greater than $FFFF, absolute long addressing is used.
         If long addressing is used, the current program counter bank is pushed onto the stack first. Next – or
first in the more normal case of intra-bank addressing – the high order byte of the return address is pushed,
followed by the low order byte. This leaves it on the stack in standard 65x order (lowest byte at the lowest
address, highest byte at the highest address). After the return address is pushed, the stack pointer points to the
next available location (next lower byte) on the stack. Finally, the program counter (and, in the case of long
addressing, the program counter bank register) is loaded with the values specified by the operand, and control is
transferred to the target location.

Flags Affected:          - - - - - - - -

Codes:

                                               Opcode      Available on:                      # of        # of
  Addressing Mode         Syntax                (hex) 6502 65C02 65802/816                    Bytes      Cycles
  Absolute                JSR addr               20     x     x          x                     3           6
  Absolute      Indexed JSR (addr,
                                                 FC                                 x            3          8
  Indirect                X)
  Absolute Long           JSR long                22                                x            4          8
                       (or JSL long)




                                                                                                                  362
```

<!-- programmanual p363 -->

```
The Western Design Center

    Load Accumulator from Memory                                                                                       LDA

        Load the accumulator with the data located at the effective address specified by the operand.
        8-bit accumulator (all processors): Data is eight-bit
        16-bit accumulator (65802/65816 only, m = 0): Data is sixteen-bit; the low-order eight bits are
located at the effective address; the high-order eight bits are located at the effective address plus one.

Flags Affected:             n - - - - - z -
                            n Set if most significant bit of loaded value is set; else cleared.
                            z Set if value loaded is zero; else cleared.

Codes:

                                                       Opcode                 Available on:                   # of     # of
    Addressing Mode + +      Syntax                     (hex)        6502     65C02 65802/816                Bytes    Cycles
                             LDA       #
    Immediate                                             A9           x          x             x                2*     21
                             const
    Absolute                 LDA addr                     AD           x          x             x                3      41
    Absolute Long            LDA long                     AF                                    x                4      51
    Direct Page (DP)         LDA dp                       A5           x          x             x                2     31, 2
    DP Indirect              LDA (dp)                     B2                      x             x                2     51, 2
    DP Indirect Long         LDA [dp]                     A7                                    x                2     61, 2
                             LDA addr,
    Absolute Indexed, X                                   BD           x          x             x                3     41, 3
                             X
    Absolute Long Indexed, LDA long,
                                                          BF                                    x                4      51
    X                        X
                             LDA addr,
    Absolute Indexed, Y                                    B9          x          x             x                3     41, 3
                             Y
    DP Indexed, X            LDA dp, X                     B5          x          x             x                2     41, 2
                             LDA (dp,
    DP Indexed Indirect, X                                A1           x          x             x                2     61, 2
                             X)
                             LDA (dp),
    DP Indirect Indexed, Y                                 B1          x          x             x                2    51, 2, 3
                             Y
    DP     Indirect     Long LDA [dp],
                                                           B7                                   x                2     61, 2
    Indexed, Y               Y
    Stack Relative (also SR) LDA sr, S                    A3                                    x                2      41
                             LDA (sr,
    SR Indirect Indexed, Y                                 B3                                   x                2      71
                             S), Y
+ + LDA, a Primary Group Instruction, has available all of the Primary Group addressing modes and bit patterns
*   Add 1 byte if m = 0 (16-bit memory/accumulator)
1    Add 1 cycle if m = 0 (16-bit memory/accumulator)
2    Add 1 cycle if low byte of Direct Page register is other than zero (DL< >0)
3    Add 1 cycle if adding index crosses a page boundary




                                                                                                                               363
```

<!-- programmanual p364 -->

```
The Western Design Center

 Load Index Register X from Memory                                                                  LDX

        Load index register X with the data located at the effective address specific by the operand.
        8-bit index registers (all processors): Data is eight-bit.
        16-bit index registers (65802/65816 only, x = 0): Data is sixteen-bit: the low-order eight bits are
located at the effective address; the high-order eight bits are located at the effective address plus one.

Flags Affected:        n - - - - - z -

                       n       Set if most significant bit of loaded value is set; else cleared.

                       z       Set if value loaded is zero; else cleared.

Codes:

                                       Opcode      Available on:                 # of      # of
  Addressing Mode          Syntax       (hex) 6502 65C02 65802/816               Bytes    Cycles
                           LDX #
  Immediate                              A2        x        x           x          2*        21
                           const
 Absolute                  LDX addr    AE       x         x           x            3         41
 Direct Page (also
                      LDX dp           A6       x         x           x            2        31, 2
 DP)
 Absolute Indexed, LDX addr,
                                       BE       x         x           x            3        41, 3
 Y                    Y
 DP Indexed, Y        LDX dp, Y        B6       x         x           x            2        41, 2
* Add 1 byte if x = 0 (16-bit index registers)
1 Add 1 cycle if x = 0 (16-bit index registers)
2 Add 1 cycle if low byte of Direct Page register is other than zero (DL< >0)
3 Add 1 cycle if adding index crosses a page boundary




                                                                                                       364
```

<!-- programmanual p365 -->

```
The Western Design Center

 Load Index Register Y from Memory                                                                  LDY

        Load index register Y with the data located at the effective address specified by the operand.
        8-bit index registers (all processors): Data is eight-bit.
        16-bit index registers (65802/65816 only, x = 0): Data is sixteen-bit: the low-order eight bits are
located at the effective address; the high-order eight bits are located at the effective address plus one.

Flags Affected:        n - - - - - z -
                       n Set if most significant bit of loaded value is set; else cleared.
                       z Set if value loaded is zero; else cleared.

Codes:

                                       Opcode               Available on:               # of      # of
  Addressing Mode       Syntax          (hex)       6502      65C02 65802/816           Bytes    Cycles
                        LDY     #
  Immediate                              A0           x           x            x         2*        21
                        const
 Absolute               LDY addr       AC          x           x          x                  3     41
 Direct Page (also
                      LDY dp           A4          x           x          x                  2    31, 2
 DP)
 Absolute Indexed, LDY addr,
                                       BC          x           x          x                  3    41, 3
 X                    X
 DP Indexed, X        LDY dp, X        B4          x           x          x                  2    41,2
* Add 1 byte if x = 0 (16-bit index registers)
1 Add 1 cycle if x = 0 (16-bit index registers)
2 Add 1 cycle if low byte of Direct Page register is other than zero (DL< >0)
3 Add 1 cycle if adding index crosses a page boundary




                                                                                                          365
```

<!-- programmanual p366 -->

```
The Western Design Center

 Logical Shift Memory or Accumulator Right                                                                      LSR

        Logical shift the contents of the location specified by the operand right one bit. That is, bit zero takes
on the value originally found in bit one, bit one takes the value originally found in bit two, and so on; the
leftmost bit (bit 7 if the m memory select flag is one when the instruction is executed or bit 15 if it is zero) is
cleared; the rightmost bit, bit zero, is transferred to the carry flag. This is the arithmetic equivalent of unsigned
division by two.



                        0             1      0      1     1     0      0     1      1


                                                                                   X
                                                                               Carry Flag

                                                 Figure 18-6 LSR


        8-bit accumulator/memory (all processors): Data shifted is eight-bit.
        16-bit accumulator/memory (65802/65816 only, m = 0): Data shifted is sixteen-bit: if in memory, the
low-order eight bits are located at the effective address; the high-order eight bits are located at the effective
address plus one.

Flags Affected:          n - - - - - z c

                         n Cleared.

                         z Set if result is zero; else cleared.

                         c Low bit becomes carry: set if low bit was set; cleared if low bit was zero.

Codes:

                                          Opcode            Available on:                 # of               # of
                                                        650 65C0 65802/8
 Addressing Mode         Syntax             (hex)                                        Bytes           Cycles
                                                         2     2        16
 Accumulator          LSR A           4A                 x     x          x1                            2
 Absolute             LSR addr        4E                 x     x          x3                            61
 Direct Page (also
                      LSR dp          46        x       x          x       2                            51, 2
 DP)
 Absolute Indexed, LSR addr,
                                      5E        x       x          x       3                            71, 3
 X                    X
 DP Indexed, X        LSR dp, X       56        x       x          x       2                            61, 2
1 Add 2 cycles if m = 0 (16-bit memory/accumulator)
2 Add 1 cycle if low byte of Direct Page register is other than zero (DL< >0)
3 Subtract 1 cycle if 65C02 and no page boundary crossed




                                                                                                                    366
```

<!-- programmanual p367 -->

```
The Western Design Center

  Block Move Next                                                                                        MVN

         Moves (copies) a block of memory to a new location. The source, destination and length operands of
this instruction are taken from the X, Y, and C (double accumulator) registers; these should be loaded with the
correct values before executing the MVN instruction.
         The source address for MVN, taken from the X register, should be the starting address (lowest in
memory) of the block to be moved. The destination address, in the Y register, should be the new starting
address for the moved block. The length, loaded into the double accumulator (the value in C is always used,
regardless of the setting of the m flag) should be the length of the block to be moved minus one; if C contains
$0005, six bytes will be moved. The two operand bytes of the MVN instruction specify the banks holding the
two blocks of memory: the first operand byte (of object code) specifies the destination bank; the second operand
byte specifies the source bank.
         The execution sequence is: the first byte is moved from the address in X to the address in Y; then X and
Y are incremented, C is decremented, and the next byte is moved; this process continues until the number of
bytes specified by the value in C plus one is moved. In other words, until the value in C is $FFFF.
         If the source and destination blocks do not overlap, then the source block remains intact after it has been
copied to the destination.
         If the source and destination blocks do overlap, then MVN should be used only if the destination is
lower than the source to avoid overwriting source bytes before they’ve been copied to the destination. If the
destination is higher, then the MVP instruction should be used instead.
         When execution is complete, the value in C is $FFFF, registers X and Y each point one byte past the
end of the blocks to which they were pointing, and the data bank register holds the destination bank value (the
first operand byte).
         Assembler syntax for the block move instruction calls for the operand field to be coded as two
addresses, source first, then destination – the move intuitive ordering, but the opposite of the actual operand
order in the object code. The assembler strips the bank bytes from the addresses (ignoring the rest) and reverses
them to object code order. If a block move instruction is interrupted, it may be resumed automatically via
execution of an RTI if all of the registers are restored or intact. The value pushed onto the stack when a block
move is interrupted is the address of the block move instruction. The current byte-move is completed before the
interrupt is serviced.
         If the index registers are in eight-bit mode (x = 1), or the processor is in 6502 emulation mode (e = 1),
then the blocks being specified must necessarily be in page zero since the high bytes of the index registers will
contain zeroes.

Flags Affected:          - - - - - - - -


Codes:

                                            Opcode             Available on:                # of         # of
  Addressing
                       Syntax                (hex)      6502    65C02      65802/816       Bytes       Cycles
  Mode
                    MVN
  Block Move                                   54                               x            3            *
                    srcbk,destbk
* 7 cycles per bye moved




                                                                                                                367
```

<!-- programmanual p368 -->

```
The Western Design Center

  Block Move Previous                                                                                      MVP

         Moves (copies) a block of memory to a new location. The source, destination and length operands of
this instruction are taken from the X, Y, and C (double accumulator) registers; these should be loaded with the
correct values before executing the MVP instruction.
         The source address for MVP, taken from the X register, should be the ending address (highest in
memory) of the block to be moved. The destination address, in the Y register, should be the new ending address
for the moved block. The length, loaded into the double accumulator (the value in C is always used, regardless
of the setting of the m flag) should be the length of the block to be moved minus one; if C contains $0005, six
bytes will be moved. The two operand bytes of the MVP instruction specify the banks holding the two blocks
of memory: the first operand byte (of object code) specifies the destination bank; the second operand byte
specifies the source bank.
         The execution sequence is: the first byte is moved from the address in X to the address in Y; then X and
Y are decremented, C is decremented, and the previous byte is moved; this process continues until the number
of bytes specified by the value in C plus one is moved. In other words, until the value in C is $FFFF.
         If the source and destination blocks do not overlap, then the source block remains intact after it has been
copied to the destination.

        If the index registers are in eight-bit mode (x = 1), or the processor is in 6502 emulation mode
(e = 1), then the blocks If the source and destination blocks do overlap, then MVP should be used only if the
destination is higher than the source to avoid overwriting source bytes before they’ve been copied to the
destination. If the destination is lower, then the MVN instruction should be used instead.
         When execution is complete, the value in C is $FFFF, registers X and Y each point one byte past the
beginning of the blocks to which they were pointing, and the data bank register holds the destination bank
value (the first operand byte).
         Assembler syntax for the block move instruction calls for the operand field to be coded as two
addresses, source first, then destination – the more intuitive ordering, but the opposite of the actual operand
order in the object code. The assembler strips the bank bytes from the addresses (ignoring the rest) and reverses
them to object code order. If a block move instruction is interrupted, it may be resumed automatically via
execution of an RTI if all of the registers are restored or intact. The value pushed onto the stack when a block
move is interrupted is the address of the block move instruction. The current byte-move is completed before the
interrupt is serviced.being specified must necessarily be in page zero since the high bytes of the index registers
will contain zeroes.

Flags Affected:          - - - - - - - -


Codes:


                                            Opcode              Available on:                # of         # of
   Addressing
                        Syntax               (hex)      6502    65C02      65802/816        Bytes        Cycles
   Mode
                     MVP
   Block Move                                  44                               x              3            *
                     srcbk,destbk
* 7 cycles per byte moved




                                                                                                                 368
```

<!-- programmanual p369 -->

```
The Western Design Center

  No Operation                                                                                       NOP

        Executing a NOP takes no action; it has no effect on any 65x registers or memory, except the program
counter, which is incremented once to point to the next instruction.
        Its primary uses are during debugging, where it is used to “patch out” unwanted code, or as a place-
holder, included in the assembler source, where you anticipate you may have to “patch in” instructions, and
want to leave a “hole” for the patch.
        NOP may also be used to expand timing loops – each NOP instruction takes two cycles to execute, so
adding one or more may help fine tune a timing loop.

Flags Affected:        - - - - - - - -

Codes:

                                  Opcode              Available on:              # of        # of
   Addressing
                       Syntax      (hex)     6502     65C02      65802/816       Bytes      Cycles
   Mode
   Implied             NOP          EA         x         x            x            1           2




                                                                                                        369
```

<!-- programmanual p370 -->

```
The Western Design Center

  OR Accumulator with Memory                                                                                ORA

         Bitwise logical OR the data located at the effective address specified by the operand with the contents
of the accumulator. Each bit in the accumulator is ORed with the corresponding bit in memory. The result is
stored into the same accumulator bit.
         The truth table for the logical OR operation is:

                                                           Second Operand
                                                             0       1
                                       First Operand
                                                   0          0           1
                                                   1          1           1


                                        Figure 18-7 Logical OR Truth Table


         A 1 or logical true results if either of the two operands of the OR operation is true.
         8-bit accumulator (all processors): Data ORed from memory is eight-bit.
         16-bit accumulator (65802/65816 only, m=0): Data ORed from memory is sixteen-bit: the low-order
eight bits are located at the effective address; the high-order eight bits are located at the effective address plus
one.

Flags Affected:          n - - - - - z -

                         n Set if most significant bit of result is set; else cleared.

                         z Set if result is zero; else cleared.




                                                                                                                370
```

<!-- programmanual p371 -->

```
The Western Design Center

Codes:

                                                      Opcode                  Available on:                  # of      # of
 Addressing Mode + +      Syntax                       (hex) 6502             65C02 65802/816                Bytes    Cycles
                          ORA      #
 Immediate                                                09          x          x               x               2*     21
                          const
 Absolute                 ORA addr                       0D           x          x               x               3      41
 Absolute Long            ORA long                       0F                                      x               4      51
 Direct Page (also DP)    ORA dp                         05           x          x               x               2     31, 2
 DP Indirect              ORA (dp)                       12                      x               x               2     51, 2
 DP Indirect Long         ORA [dp]                       07                                      x               2     61, 2
                          ORA addr,
 Absolute Indexed, X                                     1D           x          x               x               3     41, 3
                          X
 Absolute Long Indexed, ORA long,
                                                         1F                                      x               4      51
 X                        X
                          ORA,
 Absolute Indexed, Y                                      19          x          x               x               3     41, 3
                          addr, Y
                          ORA, dp,
 DP Indexed, X                                            15          x          x               x               2     41, 2
                          X
                          ORA (dp,
 DP Indexed Indirect, X                                   01          x          x               x               2     61, 2
                          X)
                          ORA, (dp),
 DP Indirect Indexed, Y                                   11          x          x               x               2    51, 2, 3
                          Y
 DP     Indirect     Long ORA [dp],
                                                          17                                     x               2     61, 2
 Indexed, Y               Y
 Stack Relative (also SR) ORA sr, S                       03                                     x               2      41
                          ORA (sr,
 SR Indirect Indexed, Y                                   13                                     x               2      71
                          S), Y
+ + ORA, a Primary Group Instruction, has available all of the Primary Group addressing modes and bit patterns
*   Add 1 byte if m = 0 (16-bit memory/accumulator)
1 Add 1 cycle if m = 0 (16-bit memory/accumulator)
2 Add 1 cycle if low byte of Direct Page register is other than zero (DL< >0)
3 Add 1 cycle if adding index crosses a page boundary




                                                                                                                               371
```

<!-- programmanual p372 -->

```
The Western Design Center

  Push Effective Absolute Address                                                                             PEA

         Push the sixteen-bit operand (typically an absolute address) onto the stack. The stack pointer is
decremented twice. This operation always pushes sixteen bits of data, irrespective of the settings of the m and x
mode select flags.
         Although the mnemonic suggests that the sixteen-bit value pushed on the stack be considered an
address, the instruction may also be considered a “push sixteen-bit immediate data” instruction, although the
syntax of immediate addressing is not used. The assembler syntax is that of the absolute addressing mode, that
is, a label or sixteen-bit value in the operand field. Unlike all other instructions that use this assembler syntax,
the effective address itself, rather than the data stored at the effective address, is what is accessed (and in this
case, pushed onto the stack).

Flags Affected:          - - - - - - - -

Codes:

                                       Opcode               Available on:                  # of        # of
   Addressing
                        Syntax          (hex)      6502      65C02      65802/816         Bytes      Cycles
   Mode
   Stack
                        PEA addr          F4                                  x             3           5
   (Absolute)




                                                                                                                372
```

<!-- programmanual p373 -->

```
The Western Design Center

  Push Effective Indirect Address                                                                 PEI

        Push the sixteen-bit value located at the address formed by adding the direct page offset
specified by the operand to the data page register. The mnemonic implies that the sixteen-bit data
pushed is considered an address, although it can be any sixteen-bit data. This operation always pushes
sixteen bits of data, irrespective of the settings of the m and x mode select flags.
        The first byte pushed is the byte at the direct page offset plus one (the high byte of the double
byte stored at the direct page offset). The byte at the direct page offset itself (the low byte) is pushed
next. The stack pointer now points to the next available stack location, directly below the last byte
pushed.
        The assembler syntax is that of direct page indirect; however, unlike other instructions which
use this assembler syntax, the effective indirect address, rather than the data stored at that address, is
what is accessed and pushed onto the stack.

Flags Affected:        - - - - - - - -

Codes:

                                         Opcode         Available on:                 # of      # of
                                                                    65802/81
   Addressing Mode            Syntax      (hex)    6502  65C02                       Bytes     Cycles
                                                                       6
  Stack (Direct Page       PEI
                                       D4                               x              2         61
  Indirect)                (dp)
1 Add 1 cycle if low byte of Direct Page register is other than zero (DL< >0)




                                                                                                        373
```

<!-- programmanual p374 -->

```
The Western Design Center

 Push Effective PC Relative Indirect Address                                                        PER

         Add the current value of the program counter to the sixteen-bit signed displacement in the operand, and
push the result on the stack. This operation always pushes sixteen bits of data, irrespective of the settings of the
m and x mode select flags.
         The high byte of the sum is pushed first, then the low byte is pushed. After the instruction is completed,
the stack pointer points to the next available stack location, immediately below the last by pushed.
         Because PER’s operand is a displacement relative to the current value of the program counter (as with
the branch instructions), this instruction is helpful in writing self-relocatable code in which an address within
the program (typically of a data area) must be accessed. The address pushed onto the stack will be the run-time
address of the data area, regardless of where the program was loaded in memory; it may be pulled into a
register, stored in an indirect pointer, or used on the stack with the stack relative indirect indexed addressing
mode to access the data at that location.
         As is the case with the branch instructions, the syntax used is to specify as the operand the label of the
data area you want to reference. This location must be in the program bank, since the displacement is relative
to the program counter. The assembler converts the assembly-time label into a displacement from the
assembly-time address of the next instruction.
         The value of the program counter used in the addition is the address of the next instruction, that is, the
instruction following the PER instruction.
         PER may also be used to push return addresses on the stack, either as part of a simulated branch-to-
subroutine or to place the return address beneath the stacked parameters to a subroutine call; always remember
that a pushed return address should be the desired return address minus one.

Flags Affected:          - - - - - - - -

Codes:

                                                      Opcode      Available on:                    # of      # of
  Addressing Mode                 Syntax               (hex) 6502 65C02 65802/816                  Bytes     Cycle
  Stack (Program Counter Relative PER
                                                         62                             x           3         6
  Long)                           label




                                                                                                                  374
```

<!-- programmanual p375 -->

```
The Western Design Center

  Push Accumulator                                                                           PHA

        Push the accumulator onto the stack. The accumulator itself is uncharged.
        8-bit accumulator (all processors): The single byte contents of the accumulator are pushed –
they are stored to the location pointed to by the stack pointer and the stack pointer is decremented.
        16-bit accumulator (65802/65816 only, m = 0): Both accumulator bytes are pushed. The
high byte is pushed first, then the low byte. The stack point now points to the next available stack
location, directly below the last byte pushed.

Flags Affected:       - - - - - - - -

Codes:

                           Opcode             Available on:                    # of        # of
 Addressing
                  Syntax     (hex)     6502      65C02     65802/816           Bytes     Cycles
 Mode
 Stack (Push)     PHA         48         x         x           x                 1          31
1 Add 1 cycle if m=0 (16-bit memory/accumulator)




                                                                                                  375
```

<!-- programmanual p376 -->

```
The Western Design Center

  Push Data Bank Register                                                                               PHB

        Push the contents of the data bank register onto the stack.
        The single-byte contents of the data bank registers are pushed onto the stack; the stack pointer now
points to the next available stack location, directly below the byte pushed. The data bank register itself is
unchanged. Since the data bank register is an eight-bit register, only one byte is pushed onto the stack,
regardless of the settings of the m and x mode select flags.
        While the 65816 always generates 24-bit addresses, most memory references are specified by a sixteen-
bit address. These addresses are concatenated with the contents of the data bank register to form a full 24-bit
address. This instruction lets the current value of the data bank register be saved prior to loading a new value.

Flags Affected:         - - - - - - - -

Codes:

                               Opcode                    Available on:                    # of        # of
  Address
                   Syntax        (hex)       6502        65C02         65802/816         Bytes       Cycles
  Mode
  Stack (Push)     PHB            8B                                        x              1            3




                                                                                                              376
```

<!-- programmanual p377 -->

```
The Western Design Center

  Push Direct Page Register                                                                              PHD

          Push the contents of the direct page register D onto the stack.
          Since the direct page register is always a sixteen-bit register, this is always a sixteen-bit operation,
regardless of the settings of the m and x mode select flags. The high byte of the direct page register is pushed
first, then the low byte. The direct page register itself is unchanged. The stack pointer now points to the next
available stack location, directly below the last byte pushed.
          By pushing the D register onto the stack, the local environment of a calling subroutine may easily be
saved a called subroutine before modifying the D register to provide itself with its own direct page memory.

Flags Affected:         - - - - - - - -

Codes:

                               Opcode               Available on:               # of        # of
  Address
                   Syntax        (hex)     6502     65C02       65802/816      Bytes      Cycles
  Mode
  Stack (Push)     PHD            0B                                 x            1          4




                                                                                                              377
```

<!-- programmanual p378 -->

```
The Western Design Center

  Push Program Bank Register                                                                              PHK

         Push the program bank register onto the stack.
         The single-byte contents of the program bank register are pushed. The program bank register itself is
unchanged. The stack pointer now points to the next available stack location, directly below the byte pushed.
Since the program bank register is an eight-bit register, only one byte is pushed onto the stack, regardless of the
settings of the m and x mode select flags.
         While the 65816 always generates 24-bit addresses, most jumps and branches specify only a sixteen-bit
address. These addresses are concatenated with the contents of the program bank register to form a full 24-bit
address. This instruction lets you determine the current value of the program bank register – for example, if you
want the data bank to be set to the same value as the program bank.

Flags Affected:          - - - - - - - -

Codes:

                                Opcode               Available on:                 # of      # of
   Address Mode       Syntax     (hex)      6502     65C02 65802/816              Bytes     Cycles
   Stack (Push)       PHK         4B                               x                1         3




                                                                                                               378
```

<!-- programmanual p379 -->

```
The Western Design Center

  Push Processor Status Register                                                                            PHP

         Push the contents of the processor status register P onto the stack.
         Since the status register is always an eight-bit register, this is always an eight-bit operation, regardless
of the settings of the m and x mode select flags on the 65802/65816. The status register contents are not
changed by the operation. The stack pointer now points to the next available stack location, directly below the
byte pushed.
         This provides the means for saving either the current mode settings or a particular set of status flags so
they may be restored or in some other way used later.
         Note, however, that the e bit (the 6502 emulation mode flag on the 65802/65816) is not pushed onto the
stack or otherwise accessed or saved. The only access to the e flag is via the XCE instruction.

Flags Affected:          - - - - - - - -

Codes:

                                     Opcode                Available on:                  # of         # of
   Address Mode       Syntax          (hex)      6502      65C02     65802/816            Bytes       Cycles
   Stack (Push)       PHP              08          x         x           x                 1            3




                                                                                                                 379
```

<!-- programmanual p380 -->

```
The Western Design Center

  Push Index Register                                                                                   PHX

        Push the contents of the X index register onto the stack. The register itself is unchanged.
        8-bit index registers (all processors): The eight-bit contents of the index register are pushed onto the
stack. The stack pointer now points to the next available stack location, directly below the byte pushed.
        16-bit index registers (65802/65816 only, x=0): The sixteen-bit contents of the index register are
pushed. The high byte is pushed first, then the low byte. The stack pointer now points to the next available
stack location, directly below the last byte pushed.

Flags Affected:         - - - - - - - -

Codes:

                              Opcode           Available on:                    # of      # of
 Address Mode Syntax           (hex)      6502 65C02 65802/816                  Bytes    Cycles
 Stack (Push)     PHX           DA                x          x                   1         31
1 Add 1 cycle if x=0 (16-bit index registers)




                                                                                                            380
```

<!-- programmanual p381 -->

```
The Western Design Center

  Push Index Register                                                                                   PHY

        Push the contents of the Y index register onto the stack. The register itself is unchanged.
        8-bit index registers (all processors): The eight-bit contents of the index register are pushed onto the
stack. The stack pointer now points to the next available stack location, directly below the byte pushed.
        16-bit index registers (65802/65816 only, x = 0): The sixteen-bit contents of the index register are
pushed. The high byte is pushed first, then the low byte. The stack pointer now points to the next available
stack location, directly below the last byte pushed.

Flags Affected:         - - - - - - - -

Codes:

                                Opcode                      Available on:                   # of       # of
 Address Mode Syntax             (hex)        6502         65C02       65802/816           Bytes      Cycles
 Stack (Push)     PHY             5A                         x             x                 1          31
1 Add 1 cycle if x=0 (16-bit index registers)




                                                                                                            381
```

<!-- programmanual p382 -->

```
The Western Design Center

  Pull Accumulator                                                                                     PLA

         Pull the value on the top of the stack into the accumulator. The previous contents of the accumulator
are destroyed.
         8-bit accumulator (all processors): The stack pointer is first incremented. Then the byte pointed to
by the stack pointer is loaded into the accumulator.
         16-bit accumulator (65802/65816 only, m = 0): Both accumulator bytes are pulled. The
accumulator’s low byte is pulled first, then the high byte is pulled.
         Note that unlike some other microprocessors, the 65x pull instructions set the negative and zero flags.

Flags Affected:         n - - - - - z -

                        n Set if most significant bit of pulled value is set; else cleared.
                        z Set if value pulled is zero; else cleared.

Codes:

                                Opcode            Available on:                     # of       # of
  Address Mode     Syntax        (hex)    6502 65C02 65802/816                      Bytes     Cycles
  Stack (Pull)     PLA            68        x        x          x                    1          41
a) Add 1 cycle if m=0 (16-bit memory/accumulator)




                                                                                                            382
```

<!-- programmanual p383 -->

```
The Western Design Center

  Pull Data Bank Register                                                                                    PLB

          Pull the eight-bit value on top of the stack into the data bank register B, switching the data bank to that
value. All instructions which reference data that specify only sixteen-bit addresses will get their bank address
from the value pulled into the data bank register. This is the only instruction that can modify the data bank
register.
          Since the bank register is an eight-bit register, only one byte is pulled from the stack, regardless of the
settings of the m and x mode select flags. The stack pointer is first incremented. Then the byte pointed to by
the stack pointer is loaded into the register.

Flags Affected:          n - - - - - z -
                         n Set if most significant bit of pulled value is set; else cleared.
                         z Set if value pulled is zero; else cleared.

Codes:

                                   Opcode               Available on:               # of      # of
   Address Mode       Syntax        (hex)       6502     65C02 65802/816           Bytes     Cycles
   Stack (Pull)       PLB            AB                               x              1         4




                                                                                                                 383
```

<!-- programmanual p384 -->

```
The Western Design Center

  Pull Direct Page Register                                                                                PLD

         Pull the sixteen-bit value on top of the stack into the direct page register D, switching the direct page to
that value.
         PLD is typically used to restore the direct page register to a previous value.
         Since the direct page register is a sixteen-bit register, two byte are pulled from the stack, regardless of
the settings of the m and x mode select flags. The low byte of the direct page register is pulled first, then the
high byte. The stack pointer now points to where the high byte just pulled was stored; this is now the next
available stack location.

Flags Affected:          n - - - - - z -

                         n Set if most significant bit of pulled value is set; else cleared.
                         z Set if value pulled is zero; else cleared.

Codes:

                                        Opcode              Available on:              # of    # of
                                                                                              Cycle
   Addressing Mode         Syntax        (hex)      6502     65C02     65802/816      Byte
                                                                                                s
   Stack (Pull)            PLD             2B                               x           1       5




                                                                                                                 384
```

<!-- programmanual p385 -->

```
The Western Design Center

  Pull Status Flags                                                                                           PLP

         Pull the eight-bit value on the top of the stack into the processor status register P, switching the status
byte to that value.
         Since the status register is an eight-bit register, only one byte is pulled from the stack, regardless of the
settings of the m and x mode select flags on the 65802/65816. The stack pointer is first incremented. Then the
byte pointed to by the stack pointer is loaded into the status register.
         This provides the means for restoring either previous mode settings or a particular set of status flags that
reflect the result of a previous operation.
         Note, however, that the e flag–the 6502 emulation mode flag on the 65802/65816–is not on the stack so
cannot be pulled from it. The only means of setting the e flag is the XCE instruction.


Flags Affected:          n v - b d i z c       (6502, 65C02,
                                                65802/65816 emulation mode e=1)
                         n v m x d i z c (65802/65816 native mode e=0)
                         All flags are replaced by the values in the byte pulled from the stack.

Codes:

                                  Opcode           Available on:                   # of        # of
   Address Mode       Syntax       (hex)      6502 65C02 65802/816                 Bytes      Cycles
   Stack (Pull)       PLP           28          x     x          x                  1           4




                                                                                                                  385
```

<!-- programmanual p386 -->

```
The Western Design Center

  Pull Index Register X from Stack                                                                          PLX

         Pull the value on the top of the stack into the X index register. The previous contents of the register are
destroyed.
         8-bit index registers (all processors): The stack pointer is first incremented. Then the byte pointed to
by the stack pointer is loaded into the register.
         16-bit index registers (65802/65816 only, x = 0): Both bytes of the index register are pulled. First the
low-order byte of the index register is pulled, then the high-order byte of the index register is pulled.
         Unlike some other microprocessors, the 65x instructions to pull an index register affect the negative and
zero flags.

Flags Affected:          n - - - - - z -

                         n Set if most significant bit of pulled value is set; else cleared.
                         z Set if value pulled is zero; else cleared.

Codes:

                                    Opcode                   Available on:                 # of         # of
  Address Mode      Syntax           (hex)     6502         65C02     65802/816            Bytes       Cycles
  Stack (Pull)      PLX               FA                      x            x                1            41
1. Add 1 cycle if x = 0 (16-bit index registers)




                                                                                                                386
```

<!-- programmanual p387 -->

```
The Western Design Center

 Pull Index Register Y from Stack                                                                            PLY

         Pull the value on the top of the stack into the Y index register. The previous contents of the register are
destroyed.
         8-bit index registers (all processors): The stack pointer is first incremented. Then the byte pointed to
by the stack pointer is loaded into the register.
         16-bit index registers (65802/65816 only, x = 0): Both bytes of the index register are pulled. First the
low-order byte of the index register is pulled, then the high-order byte of the index register is pulled.
         Unlike some other microprocessors, the 65x instructions to pull an index register affect the negative and
zero flags.

Flags Affected:          n - - - - - z -
                         n Set if most significant bit of pulled value is set; else cleared.
                         z Set if value pulled is zero; else cleared.

Codes:

                                  Opcode                   Available to:                 # of        # of
  Addressing Mode Syntax            (hex)    6502           65C02 65802/816             Bytes       Cycles
  Stack (Pull)        PLY            7A                       x          x                1           41
1. 1 Add 1 cycle if x = 0 (16-bit index registers)




                                                                                                                387
```

<!-- programmanual p388 -->

```
The Western Design Center

  Reset Status Bits                                                                                            REP

         For each bit set to one in the operand byte, reset the corresponding bit in the status register to zero. For
example, if bit three is set in the operand byte, bit three in the status register (the decimal flag) is reset to zero by
this instruction. Zeroes in the operand byte cause no change to their corresponding status register bits.
         This instruction lets you reset any flag or flags in the status register with a single two-byte instruction.
Further, it is the only direct means of resetting several of the flags, including the m and x mode select flags
(although instructions that pull the P status register affect the m and x mode select flags).
         6502 emulation mode (65802/65816, e=1): Neither the break flag nor bit five (the 6502’s undefined
flag bit) are affected by REP.

Flags Affected:           n v - - d i z c        (65802/65816 emulation mode e=1)
                          n v m x d i z c (65802/65816 native mode e=0)
                          All flags for which an operand bit is set are reset to zero.
                          All other flags are unaffected by the instruction.

Codes:

                                            Opcode      Available to:                       # of       # of
  Addressing Mode         Syntax             (hex) 6502 65C02 65802/816                     Bytes     Cycles
  Immediate               REP # const         C2                      x                      2          3




                                                                                                                     388
```

<!-- programmanual p389 -->

```
The Western Design Center

 Rotate Memory or Accumulator Left                                                                      ROL

         Rotate the contents of the location specified by the operand left one bit. Bit one takes on the
value originally found in bit zero, bit two takes the value originally in bit one, and so on; the rightmost
bit, bit zero, takes the value in the carry flag; the leftmost bit (bit 7 on the 6502 and 65C02 or if m = 1
on the 65802/65816, or bit 15 if m = 0) is transferred into the carry flag.


                                      1    0   1   1   0   0     1   1

                                                                    X
                                                                 Carry Flag

                                               Figure 18-8 ROL


         8-bit accumulator/memory (all processors): Data rotated is eight bits, plus carry.
         16-bit accumulator/memory (65802/65816 only, m=0): Data rotated is sixteen bits, plus carry: if in
memory, the low-order eight bits are located at the effective address; the high eight bits are located at the
effective address plus one.


Flags Affected:        n - - - - - z c
                       n Set if most significant bit of result is set; else cleared.
                       z Set if result is zero; else cleared.
                       c High bit becomes carry: set if high bit was set; cleared if high bit
                         was clear.


Codes:

                                     Opcode             Available to:         # of            # of
 Address Mode          Syntax         (hex)    6502 65C02 65802/816 Bytes                    Cycles
 Accumulator           ROL A           2A         x        x          x        1               2
 Absolute              ROL addr        2E         x        x          x        3               61
 Direct Page (also
                       ROL dp          26         x        x          x        2                51, 2
 DP)
 Absolute Indexed, ROL addr,
                                       3E         x        x          x        3                71, 3
 X                     X
 DP Indexed, X         ROL dp, X       36         x        x          x        2                61, 2
1 Add 2 cycles if m=0 (16-bit memory/accumulator)
2 Add 1 cycle if low byte of Direct Page register is other than zero (DL< >0)
3 Subtract 1 cycle if 65C02 and no page boundary crossed




                                                                                                          389
```

<!-- programmanual p390 -->

```
The Western Design Center

  Rotate Memory or Accumulator Right                                                                           ROR

         Rotate the contents of the location specified by the operand right one bit. Bit zero takes on the value
originally found in bit one, bit one takes the value originally in bit two, and so on; the leftmost bit (bit 7 on the
6502 and 65C02 or if m = 1 on the 65802/65816, or bit 15 if m = 0) takes the value in the carry flag; the
rightmost bit, bit zero, is transferred into the carry flag.



                          1     0     1      1     0     0     1     1


                                                                     X
                                                 Figure 18-9 ROR


         8-bit accumulator/memory (all processors): Data rotated is eight bits, plus carry.
         16-bit accumulator/memory (65802/65816 only, m=0): Data rotated is sixteen bits, plus carry: if in
memory, the low-order eight bits are located at the effective address; the high-order eight bits are located at the
effective address plus one.

Flags Affected:          n - - - - - z c
                         n Set if most significant bit of result is set; else cleared.
                         z Set if result is zero; else cleared.
                         c Low bit becomes carry: set if low bit was set; cleared if low
                           bit was clear.

Codes:

                                           Opcode      Available to:                      # of        # of
 Address Mode          Syntax               (hex) 6502 65C02 65802/816                    Bytes      Cycles
 Accumulator           ROR A                 6A     x    x           x                     1           2
 Absolute              ROR addr              6E     x    x           x                     3           61
 Direct Page (also
                       ROR dp          66         x        x          x                     2          51, 2
 DP)
 Absolute Indexed, ROR addr,
                                       7E         x        x          x                     3          71, 3
 X                     X
 DP Indexed, X         ROR dp, X       76         x        x          x                     2          61, 2
1 Add 2 cycles if m = 0 (16-bit memory/accumulator)
2 Add 1 cycle if low byte of Direct Page register is other than zero (DL< >0)
3 Subtract 1 cycle if 65C02 and no page boundary crossed




                                                                                                                 390
```

<!-- programmanual p391 -->

```
The Western Design Center

 Return from Interrupt                                                                               RTI

         Pull the status register and the program counter from the stack. If the 65802/65816 is set to
native mode (e = 0), also pull the program bank register from the stack.
         RTI pulls values off the stack in the reverse order they were pushed onto it by hardware or
software interrupts. The RTI instruction, however, has no way of knowing whether the values pulled
off the stack into the status register and the program counter are valid – or even, for that matter, that an
interrupt has ever occurred. It blindly pulls the first three (or four) bytes off the top of the stack and
stores them into the various registers.
         Unlike the RTS instruction, the program counter address pulled off the stack is the exact
address to return to; the value on the stack is the value loaded into the program counter. It does not
need to be incremented as a subroutine’s return address does.
         Pulling the status register gives the status flags the values they had immediately prior to the
start of interrupt-processing.
         One extra byte is pulled in the 65802/65816 native mode than in emulation mode, the same
extra byte that is pushed by interrupts in native mode, the program bank register. It is therefore
essential that the return from interrupt be executed in the same mode (emulation or native) as the
original interrupt.
         6502, 65C02, and Emulation Mode (e = 1): The status register is pulled from the stack, then
the program counter is pulled from the stack (three bytes are pulled).
         65802/65816 Native Mode (e = 0): The status register is pulled from the stack, then the
program counter is pulled from the stack, then the program bank register is pulled from the stack (four
bytes are pulled).

                                                                          Stack



                    (Stack Pointer After)                         Old Status Register

                                                                 Return Address Bank

                                                                 Return Address High

                                                                 Return Address Low

                    Stack Pointer Before



                                                                         Bank 0

                                  Figure 18-10Native Mode Stack before RTI.


Flags Affected:        n v - - d i z c         (6502, 65C02,
                                               65802/65816 emulation mode e = 1)
                       n v m x d i z c (65802/65816 native mode e = 0)
                       All flags are restored to their values prior to interrupt (each flag takes
                       the value of its corresponding bit in the stacked status byte, except that
                       the Break flag is ignored).
                                                                                                        391
```

<!-- programmanual p392 -->

```
The Western Design Center

Codes:

                              Opcode            Available to:          # of    # of
 Addressing Mode Syntax        (hex)    6502 65C02        65802/816   Bytes   Cycles
 Stack (RTI)        RTI          40       x      x            x         1       61
1 Add 1 cycle for 65802/65816 native mode (e=0)




                                                                                       392
```

<!-- programmanual p393 -->

```
The Western Design Center

 Return from Subroutine Long                                                                  RTL

        Pull the program counter (incrementing the stacked, sixteen-bit value by one before loading the
program counter with it), then the program bank register from the stack.
        When a subroutine in another bank is called (via a jump to subroutine long instruction), the
current bank address is pushed onto the stack along with the return address. To return to the calling
bank, a long return instruction must be executed, which first pulls the return address from the stack,
increments it, and loads the program counter with it, then pulls the calling bank from the stack and
loads the program bank register. This transfers control to the instruction immediately following the
original jump to subroutine long.

                                                                      Stack



                  (Stack Pointer After)                        Return Bank Address

                                                               Return Address High

                                                               Return Address Low

                  Stack Pointer Before



                                                                     Bank 0

                                     Figure 18-11 Stack before RTL
Flags Affected:       - - - - - - - -

Codes:

                                   Opcode          Available to:            # of    # of
                                                              65802/8              Cycle
  Address Mode      Syntax           (hex)    6502 65C02                   Bytes
                                                                 16                  s
  Stack (RTL)             RTL         6B                          x           1      6




                                                                                                   393
```

<!-- programmanual p394 -->

```
The Western Design Center

  Return from Subroutine                                                                         RTS

         Pull the program counter, incrementing the stacked, sixteen-bit value by one before loading the
program counter with it.
         When a subroutine is called (via a jump to subroutine instruction), the current return address is
pushed onto the stack. To return to the code following the subroutine call, a return instruction must be
executed, which pulls the return address from the stack, increments it, and loads the program counter
with it, transferring control to the instruction immediately following the jump to subroutine.

                                                                             Stack



                       (Stack Pointer After)                          Return Address High

                                                                      Return Address Low

                       Stack Pointer Before



                                                                            Bank 0

                                      Figure 18-12 Stack before RTS


Flags Affected:        - - - - - - - -

Codes:

                                  Opcode              Available to:               # of         # of
  Addressing
                      Syntax       (hex)       6502   65C02     65802/816        Bytes       Cycles
  Mode
  Stack (RTS)         RTS           60          x       x             x              1          6




                                                                                                      394
```

<!-- programmanual p395 -->

```
The Western Design Center

  Subtract with Borrow from Accumulator                                                                   SBC

         Subtract the data located at the effective address specified by the operand from the contents of the
accumulator; subtract one more if the carry flag is clear, and store the result in the accumulator.
         The 65x processors have no subtract instruction that does not involve the carry. To avoid subtracting
the carry flag from the result, either you must be sure it is set or you must explicitly set it (using SEC) prior to
executing the SBC instruction.
         In a multi-precision (multi-word) subtract, you set the carry before the low words are subtracted. The
low word subtraction generates a new carry flag value based on the subtraction. The carry is set if no borrow
was required and cleared if borrow was required. The complement of the new carry flag (one if the carry is
clear) is subtracted during the next subtraction, and so on. Each result thus correctly reflects the borrow from
the previous subtraction.
         Note that this use of the carry flag is the opposite of the way the borrow flag is used by some other
processors, which clear (not set) the carry if no borrow was required.
         d flag clear: Binary subtraction is performed.
         d flag set: Binary coded decimal (BCD) subtraction is performed.
         8-bit accumulator (all processors): Data subtracted from memory is eight-bit.
         16-bit accumulator (65802/65816 only, m=0): Data subtracted from memory is sixteen-bit: the low
eight bits is located at the effective address; the high eight bits is located at the effective address plus one.

Flags Affected:          n v - - - - z c
                         n Set if most significant bit of result is set; else cleared.
                         v Set if signed overflow; cleared if valid sign result.
                         z Set if result is zero; else cleared.
                         c Set if unsigned borrow not required; cleared if unsigned borrow.




                                                                                                                395
```

<!-- programmanual p396 -->

```
The Western Design Center

Codes:

                                                          Opcode      Available to:                              # of       # of
  Addressing Mode + +                 Syntax               (hex) 6502 65C02 65802/816                            Bytes    Cycles
  Immediate                           SBC # const           E9     x    x           x                             2*     21, 4
  Absolute                            SBC addr              ED     x    x           x                             3      41, 4
  Absolute Long                       SBC long              EF                      x                             4      51, 4
  Direct Page (also DP)               SBC dp                E5     x    x           x                             2      31, 2, 4
  DP Indirect                         SBC (dp)              F2          x           x                             2      51, 2, 4
  DP Indirect Long                    SBC [dp]              E7                      x                             2      61, 2, 4
                                      SBC addr,
  Absolute Indexed, X                                        FD          x          x              x              3      41, 3, 4
                                      X
  Absolute Long Indexed,
                           SBC long, X                       FF                                    x              4      51, 4
  X
                           SBC addr,
  Absolute Indexed, Y                                        F9          x          x              x              3      41, 3, 4
                           Y
  DP Indexed, X            SBC dp, X                         F5          x          x              x              2      41, 2, 3, 4
  DP Indexed Indirect, X   SBC (dp, X)                       E1          x          x              x              2      61, 2, 4
  DP Indirect Indexed, Y   SBC (dp), Y                       F1          x          x              x              2      51, 2, 3, 4
  DP Indirect Long
                           SBC [dp], Y                       F7                                    x              2      61, 2, 4
  Indexed, Y
  Stack Relative (also SR) SBC sr, S                         E3                                    x              2      41, 4
                           SBC (sr, S),
  SR Indirect Indexed, Y                                     F3                                    x              2      71, 4
                           Y
+ + SBC, a Primary Group Instruction, has available all of the Primary Group addressing modes and bit patterns
*   Add 1 byte if m=0 (16-bit memory/accumulator)
1 Add 1 cycle if m=0 (16-bit memory/accumulator)
2 Add 1 cycle if low byte of Direct Page register is other than zero (DL< >0)
3 Add 1 cycle if adding index crosses a page boundary
4 Add 1 cycle if 65C02 and d=1 (decimal mode, 65C02)




                                                                                                                                 396
```

<!-- programmanual p397 -->

```
The Western Design Center

 Set Carry Flag                                                                                         SEC

        Set the carry flag in the status register.
        SEC is used prior to subtraction (using the 65x’s SBC instruction) to keep the carry flag from affecting
the result, and prior to an XCE (exchange carry flag with emulation bit) instruction to put the 65802 or 65816
into 6502 emulation mode.

Flags Affected:         - - - - - - - c
                        c Carry flag set always.

Codes:

                                   Opcode              Available to:             # of        # of
  Addressing
                       Syntax       (hex)      6502     65C02     65802/816      Bytes     Cycles
  Mode
  Implied              SEC            38         x         x           x           1          2




                                                                                                            397
```

<!-- programmanual p398 -->

```
The Western Design Center

  Set Decimal Mode Flag                                                                          SED

         Set the decimal mode flag in the status register.
         SED is used to shift 65x processors into decimal mode from binary mode, so that the ADC and SBC
instructions will operate correctly on the BCD data, performing automatic decimal adjustment.

Flags Affected:       - - - - d - - -
                      d Decimal mode flag set always.

Codes:

                               Opcode             Available to:            # of      # of
  Addressing
                    Syntax      (hex)     6502    65C02     65802/816     Bytes    Cycles
  Mode
  Implied           SED          F8         x        x            x         1         2




                                                                                                    398
```

<!-- programmanual p399 -->

```
The Western Design Center

  Set Interrupt Disable Flag                                                                               SEI

         Set the interrupt disable flag in the status register.
         SEI is used to disable hardware interrupt processing. When the i bit is set, maskable hardware
interrupts (IRQ’) are ignored. The processor itself sets the i flag when it begins servicing an interrupt, so
interrupt handling routines that are intended to be interruptable must reenable interrupts with CLI. If interrupts
are to remain blocked during the interrupt service, exiting the routine via RTI will automatically restore the
status register with the i flag clear, re-enabling interrupts.

Flags Affected:         - - - - - i - -
                        i Interrupt disable flag set always.

Codes:

                                   Opcode                   Available to:                   # of        # of
  Addressing
                      Syntax        (hex)        6502          65C02        65802/816      Bytes      Cycles
  Mode
  Implied             SEI            78            x              x              x            1          2




                                                                                                               399
```

<!-- programmanual p400 -->

```
The Western Design Center

 Set Status Bits                                                                                              SEP

         For each one-bit in the operand byte, set the corresponding bit in the status register to one. For
example, if bit three is set in the operand byte, bit three in the status register (the decimal flag) is set to one by
this instruction. Zeroes in the operand byte cause no change to their corresponding status register bits.
         This instruction lets you set any flag or flags in the status register with a single two-byte instruction.
Furthermore, it is the only direct means of setting the m and x mode select flags. (Instructions that pull the P
status register indirectly affect the m and x mode select flags).
         6502 emulation mode (65802/65816, e=1): Neither the break flag nor bit five (the 6502’s non-flag bit)
is affected by SEP.

Flags Affected:          n v - - d i z c        (65802/65816 emulation e=1)
                         n v m x d i z c (65802/65816 native mode e=0)
                         All flags for which an operand bit is set are set to one.
                         All other flags are unaffected by the instruction.

Codes:

                                     Opcode                Available to:               # of        # of
  Addressing
                       Syntax          (hex)      6502     65C02      65802/816       Bytes      Cycles
  Mode
                       SEP #
  Immediate                             E2                                 x             2          3
                       const




                                                                                                                  400
```

<!-- programmanual p401 -->

```
The Western Design Center

    Store Accumulator to Memory                                                                                                STA

         Store the value in the accumulator to the effective address specified by the operand.
         8-bit accumulator (all processors): Value is eight-bit.
         16-bit accumulator (65802/65816 only, m=0): Value is sixteen-bit: the low-order eight bits are stored
to the effective address; the high-order eight bits are stored to the effective address plus one.
         The 65x flags are unaffected by store instructions.

Flags Affected:               - - - - - - - -

Codes:

                                                        Opcode      Available on::                                 # of      # of
 Addressing Mode + +      Syntax                         (hex) 6502 65C02 65802/816                               Bytes    Cycles
 Absolute                 STA addr                        8D     x     x           x                          3           41
 Absolute Long            STA long                        8F                       x                          4           51
 Direct Page (also DP)    STA dp                          85     x     x           x                          2           31,2
 DP Indirect              STA (dp)                        92           x           x                          2           51,2
 DP Indirect Long         STA [dp]                        87                       x                          2           61,2
                          STA addr,
 Absolute Indexed, X                                       9D           x          x              x           3           51
                          X
 Absolute Long Indexed, STA long,
                                                           9F                                     x           4           51
 X                        X
                          STA addr,
 Absolute Indexed, Y                                       99           x          x              x           3           51
                          Y
 DP Indexed, X            STA dp, X                        95           x          x              x           2           41,2
                          STA (dp,
 DP Indexed Indirect, X                                    81           x          x              x           2           61,2
                          X)
                          STA (dp),
 DP Indirect Indexed, Y                                    91           x          x              x           2           61,2
                          Y
 DP     Indirect     Long STA [dp],
                                                           97                                     x           2           61,2
 Indexed, Y               Y
 Stack Relative (also SR) STA sr, S                        83                                     x           2           41
                          STA (sr,
 SR Indirect Indexed, Y                                    93                                     x           2           71
                          S), Y
+ +
      STA, a Primary Group Instruction, has available all of the Primary Group addressing modes and bit patterns
1     Add 1 cycle if m=0 (16-bit memory/accumulator)
2     Add 1 cycle if low byte of Direct Page register is other than zero (DL< >0)




                                                                                                                                 401
```

<!-- programmanual p402 -->

```
The Western Design Center

  Stop the Processor                                                                                       STP

          During the processor’s next phase 2 clock cycle, stop the processor’s oscillator input; the processor is
effectively shut down until a reset occurs (until the RES’ pin is pulled low).
          STP is designed to put the processor to sleep while it’s not (actively) in use in order to reduce power
consumption. Since power consumption is a function of frequency with CMOS circuits, stopping the clock cuts
power to almost nil.
          Your reset handling routine (pointed to by the reset vector, $00:FFFC-FD) should be designed to either
reinitialize the system or resume control through a previously-installed reset handler.
          Remember that reset is an interrupt-like signal that causes the emulation bit to be set to one. It also
causes the direct page register to be reset to zero; stack high to be set to one (forcing the stack pointer to page
one); and the mode select flags to be set to one (eight-bit registers; a side effect is that the high bytes of the
index registers are zeroed). STP is useful only in hardware systems (such as battery-powered systems)
specifically designed to support a low-power mode.

Flags Affected:          - - - - - - - -

Codes:

                                Opcode          Available on:            # of      # of
 Addressing
                    Syntax       (hex)   6502 65C02 65802/816 Bytes Cycles
 Mode
 Implied            STP           DB                           x           1         31
1 Uses 3 cycles to shut the processor down; additional cycles are required by reset to restart it




                                                                                                               402
```

<!-- programmanual p403 -->

```
The Western Design Center

  Store Index Register X to Memory                                                                   STX

         Store the value in index register X to the effective address specified by the operand.
         8-bit index registers (all processors): Value is eight-bit.
         16-bit index registers (65802/65816 only, x = 0): Value is sixteen-bit: the low-order eight bits are
stored to the effective address; the high-order eight bits are stored to the effective address plus one.
         The 65x flags are unaffected by store instructions.

Flags Affected:        - - - - - - - -

Codes:

                                      Opcode          Available on:               # of      # of
                                                                65802/81
  Addressing Mode        Syntax          (hex)   6502 65C02                      Bytes     Cycles
                                                                    6
                      STX
  Absolute                           8E        x         x          x         3              41
                      addr
 Direct page          STX dp          86       x         x          x         2              31,2
 Direct        Page STX dp,
                                      96       x         x          x         2              41,2
 Indexed, Y           Y
1 Add 1 cycle if x=0 (16-bit index registers)
2 Add 1 cycle if low byte of Direct Page register is other than zero (DL< >0)




                                                                                                         403
```

<!-- programmanual p404 -->

```
The Western Design Center

  Store Index Register Y to Memory                                                                   STY

         Store the value in index register Y to the effective address specified by the operand.
         8-bit index registers (all processors): Value is eight-bit.
         16-bit index registers (65802/65816 only, x = 0): Value is sixteen-bit: the low-order eight bits are
stored to the effective address; the high-order eight bits are stored to the effective address plus one.
         The 65x flags are unaffected by store instructions.

Flags Affected:        - - - - - - - -

Codes:

                                      Opcode      Available on:                   # of       # of
  Addressing Mode      Syntax          (hex) 6502 65C02 65802/816                 Bytes     Cycles
                       STX
 Absolute                            8C        x         x          x         3               41
                       addr
 Direct page           STX dp         84       x         x          x         2              31,2
 Direct Page Indexed, STX dp,
                                      94       x         x          x         2              41,2
 X                     X
1 Add 1 cycle if x=0 (16-bit index registers)
2 Add 1 cycle if low byte of Direct Page register is other than zero (DL< >0)




                                                                                                         404
```

<!-- programmanual p405 -->

```
The Western Design Center

  Store Zero to Memory                                                                             STZ

         Store zero to the effective address specified by the operand.
         8-bit accumulator (all processors): Zero is stored at the effective address.
         16-bit accumulator/memory (65802/65816 only, m = 0): Zero is stored at the effective address and at
the effective address plus one.
         The 65x store zero instruction does not affect the flags.

Flags Affected:        - - - - - - - -

Codes:

                                    Opcode             Available on:           # of            # of
 Addressing Mode      Syntax         (hex)     6502 65C02 65802/816 Bytes                    Cycles
 Absolute             STZ addr        9C                   x           x      3             41
 Direct Page          STZ dp          64                   x           x      2             31,2
 Absolute Indexed, STZ addr,
                                      9E                   x           x      3             51
 X                    X
 Direct        Page
                      STZ dp, X       74                   x           x      2             41,2
 Indexed, X
1 Add 1 cycle if m=0 (16-bit memory/accumulator)
2 Add 1 cycle if low byte of Direct Page register is other than zero (DL< >0)




                                                                                                        405
```

<!-- programmanual p406 -->

```
The Western Design Center

  Transfer Accumulator to Index Register X                                                                 TAX

         Transfer the value in the accumulator to index register X. If the registers are different sizes, the nature
of the transfer is determined by the destination register. The value in the accumulator is not changed by the
operation.
         8-bit accumulator, 8-bit index registers (all processors): Value transferred is eight-bit.
         8-bit accumulator, 16-bit index registers (65802/65816 only, m = 1, x = 0): Value transferred is
sixteen-bit; the eight-bit A accumulator becomes the low byte of the index register; the hidden eight-bit B
accumulator becomes the high byte of the index register.
         16-bit accumulator, 8-bit index registers (65802/65816 only, m=0, x=1): Value transferred to the
eight-bit index register is eight-bit, the low byte of the accumulator.
         16-bit accumulator, 16-bit index registers (65802/65816 only, m=0, x=0): Value transferred to the
sixteen-bit index register is sixteen-bit, the full sixteen-bit accumulator.

Flags Affected:          n - - - - - z -
                         n Set if most significant bit of transferred value is set; else cleared.
                         z Set if value transferred is zero; else cleared.

Codes:

                               Opcode               Available to:                # of        # of
  Addressing
                     Syntax      (hex)     6502     65C02     65802/816         Bytes       Cycles
  Mode
  Implied            TAX          AA         x         x            x             1            2




                                                                                                                406
```

<!-- programmanual p407 -->

```
The Western Design Center

 Transfer Accumulator to Index Register Y                                                                 TAY

         Transfer the value in the accumulator to index register Y. If the registers are different sizes, the nature
of the transfer is determined by the destination register. The value in the accumulator is not changed by the
operation.
         8-bit accumulator, 8-bit index registers (all processors): Value transferred is eight-bit.
         8-bit accumulator, 16-bit index registers (65802/65816 only, m = 1, x = 0): Value transferred is
sixteen-bit; the eight-bit A accumulator becomes the low byte of the index register; the hidden eight-bit B
accumulator becomes the high byte of the index register.
         16-bit accumulator, 8-bit index registers (65802/65816 only, m=0, x=1): Value transferred to the
eight-bit index register is eight-bit, the low byte of the accumulator.
         16-bit accumulator, 16-bit index registers (65802/65816 only, m=0, x=0): Value transferred to the
sixteen-bit index register is sixteen-bit, the full sixteen-bit accumulator.

Flags Affected:          n - - - - - z -
                         n Set if most significant bit of transferred value is set; else cleared.
                         z Set if value transferred is zero; else cleared.

Codes:

                               Opcode               Available to:                # of        # of
  Addressing                    (hex)
                    Syntax                  6502     65C02      65802/816       Bytes       Cycles
  Mode
  Implied           TAX           AA          x         x            x            1            2




                                                                                                                407
```

<!-- programmanual p408 -->

```
The Western Design Center

  Transfer 16-Bit Accumulator to Direct Page Register                                                   TCD

         Transfer the value in the sixteen-bit accumulator C to the direct page register D, regardless of the
setting of the accumulator/memory mode flag.
         An alternate mnemonic is TAD, (transfer the value in the A accumulator to the direct page register).
         In TCD, the “C” is used to indicate that sixteen bits are transferred regardless of the m flag. If the A
accumulator is set to just eight bits (whether because the m flag is set, or because the processor is in 6502
emulation mode), then its value becomes the low byte of the direct page register and the value in the hidden B
accumulator becomes the high byte of the direct page register.
         The accumulator’s sixteen-bit value is unchanged by the operation.

Flags Affected:         n - - - - - z -
                        n Set if most significant bit of transferred value is set; else cleared.
                        z Set if value transferred is zero; else cleared.

Codes:

                                  Opcode              Available to:               # of      # of
  Addressing
                     Syntax        (hex)      6502     65C02     65802/816       Bytes    Cycles
  Mode
  Implied            TCD            5B                                 x           1         2
                     (or
                     TAD)




                                                                                                             408
```

<!-- programmanual p409 -->

```
The Western Design Center

  Transfer Accumulator to Stack Pointer                                                                      TCS

         Transfer the value in the accumulator to the stack pointer S. The accumulator’s value is unchanged by
the operation.
         An alternate mnemonic is TAS (transfer the value in the A accumulator to the stack pointer).
         In TCS, the “C” is used to indicate that, in native mode, sixteen bits are transferred regardless of the m
flag. If the A accumulator is set to just eight bits (because the m flag is set), then its value is transferred to the
low byte of the stack pointer and the value in the hidden B accumulator is transferred to the high byte of the
stack pointer. In emulation mode, only the eight-bit A accumulator is transferred, since the high stack pointer
byte is forced to one (the stack is confined to page one).
         TCS, along with TXS, are the only two instructions for changing the value in the stack pointer. The
two are also the only two transfer instructions not to alter the flags.

Flags Affected:          - - - - - - - -

Codes:

                                   Opcode              Available to:               # of        # of
  Addressing
                       Syntax        (hex)     6502     65C02     65802/816       Bytes       Cycles
  Mode
  Implied              TCS            1B                                x            1           2
                       (or
                       TAS)




                                                                                                                  409
```

<!-- programmanual p410 -->

```
The Western Design Center

  Transfer Direct Page Register to 16-Bit Accumulator                                                  TDC

         Transfer the value in the sixteen-bit direct page register D to the sixteen-bit accumulator C, regardless
of the setting of the accumulator/memory mode flag.
         An alternate mnemonic is TDA (transfer the value in the direct page register to the A accumulator).
         In TDC, the “C” is used to indicate that sixteen bits are transferred regardless of the m flag. If the A
accumulator is set to just eight bits (whether because the m flag is set, or because the processor is in 6502
emulation mode), then it takes the value of the low byte of the direct page register and the hidden B accumulator
takes the value of the high byte of the direct page register.
         The direct page register’s sixteen-bit value is unchanged by the operation.

Flags Affected:         n - - - - - z -
                        n Set if most significant bit of transferred value is set; else cleared.
                        z Set if value transferred is zero; else cleared.

Codes:

                                Opcode               Available to:              # of        # of
  Addressing
                     Syntax       (hex)     6502     65C02      65802/816      Bytes      Cycles
  Mode
  Implied            TDC           7B                                x            1          2
                     (or
                     TDA)




                                                                                                              410
```

<!-- programmanual p411 -->

```
The Western Design Center

  Test and Reset Memory Bits Against Accumulator                                                         TRB

         Logically AND together the complement of the value in the accumulator with the data at the effective
address specified by the operand. Store the result at the memory location.
         This has the effect of clearing each memory bit for which the corresponding accumulator bit is set,
while leaving unchanged all memory bits in which the corresponding accumulator bits are zeroes.
         Unlike the BIT instruction, TRB is a read-modify-write instruction, not only calculating a result and
modifying a flag, but also storing the result to memory as well.
         The z zero flag is set based on a second and different operation the ANDing of the accumulator value
(not its complement) with the memory value (the same way the BIT instruction affects the zero flag). The
result of this second operation is not saved; only the zero flag is affected by it.
         8-bit accumulator/memory (65C02;65802/65816, m=1): Values in accumulator and memory are
eight-bit.
         16-bit accumulator/memory(65C02;65802/65816, m=1): Values in accumulator and memory are
sixteen-bit: the low-order eight bits are located at the effective address; the high-order eight bits are at the
effective address plus one.

Flags Affected:         - - - - - - z -
                        z Set if memory value AND’ed with accumulator value is zero;
                          else cleared.

Codes:

                                  Opcode              Available on:              # of      # of
  Addressing                                                                              Cycle
                     Syntax         (hex)     6502     65C02     65802/816      Bytes
  Mode                                                                                      s
                  TRB
  Absolute                       1C                  x           x         3                 61
                  addr
 Direct Page      TRB dp         14                  x           x         2                51,2
1 Add 2 cycles if m = 0 (16-bit memory/accumulator)
2 Add 1 cycle if low byte of Direct Page register is other than zero (DL< >0)




                                                                                                            411
```

<!-- programmanual p412 -->

```
The Western Design Center

  Test and Set Memory Bits Against Accumulator                                                           TSB

         Logically OR together the value in the accumulator with the data at the effective address specified by
the operand. Store the result at the memory location.
         This has the effect of setting each memory bit for which the corresponding accumulator bit is set, while
leaving unchanged all memory bits in which the corresponding accumulator bits are zeroes.
         Unlike the BIT instruction, TSB is a read-modify-write instruction, not only calculating a result and
modifying a flag, but storing the result to memory as well.
         The z zero flag is set based on a second different operation, the ANDing of the accumulator value with
the memory value (the same way the BIT instruction affects the zero flag). The result of this second operation
is not saved; only the zero flag is affected by it.
         8-bit accumulator/memory(65C02;65802/65816, m = 1): Values in accumulator and memory are
eight-bit.
         16-bit accumulator/memory (65802/65816 only, m = 0): Values in accumulator and memory are
sixteen-bit: the low-order eight bits are located at the effective address; the high-order eight bits are at the
effective address plus one.

Flags Affected:         - - - - - - z -
                        z Set if memory value AND’ed with accumulator value is zero;
                           else cleared.

Codes:

                                    Opcode              Available on:              # of      # of
 Addressing
                   Syntax        (hex)     6502 65C02 65802/816 Bytes                      Cycles
 Mode
 Absolute          TSB addr       0C                   x           x       3                61
 Direct Page       TSB dp         04                   x           x       2                51,2
1 Add 2 cycles if m = 0 (16-bit memory/accumulator)
2 Add 1 cycle if low byte of Direct Page register is other than zero (DL< >0)




                                                                                                             412
```

<!-- programmanual p413 -->

```
The Western Design Center

 Transfer Stack Pointer to 16-Bit Accumulator                                                             TSC

         Transfer the value in the sixteen-bit stack pointer S to the sixteen-bit accumulator C, regardless of the
setting of the accumulator/memory mode flag.
         An alternate mnemonic is TSA (transfer the value in the stack pointer to the A accumulator).
         In TSC, the “C” is used to indicate that sixteen bits are transferred regardless of the m flag. If the A
accumulator is set to just eight bits (whether because the m flag is set, or because the processor is in 6502
emulation mode), then it takes the value of the low byte of the stack pointer and the hidden B accumulator takes
the value of the high byte of the stack pointer. (In emulation mode, B will always take a value of one, since the
stack is confined to page one.)
         The stack pointer’s value is unchanged by the operation.

Flags Affected:         n - - - - - z -
                        n Set if most significant bit of transferred value is set; else cleared.
                        z Set if value transferred is zero; else cleared.

Codes:
                                   Opcode              Available to:               # of      # of
  Addressing
                      Syntax        (hex)      6502      65C02     65802/816      Bytes    Cycles
  Mode
  Implied                 TSC         3B                                x           1         2
                      (or
                      TSA)




                                                                                                              413
```

<!-- programmanual p414 -->

```
The Western Design Center

  Transfer Stack Pointer to Index Register X                                                                 TSX

         Transfer the value in the stack pointer S to index register X. The stack pointer’s value is not changed
by the operation.
         8-bit index registers (all processors): Only the low byte of the value in the stack pointer is transferred
to the X register. In the 6502, the 65C02, and the 6502 emulation mode, the stack pointer and the index
registers are only a single byte each, so the byte in the stack pointer is transferred to the eight-bit X register. In
65802/65816 native mode, the stack pointer is sixteen bits, so its most significant byte is not transferred if the
index registers are in eight-bit mode.
         16-bit index registers (65802/65816 only, x=0): The full sixteen-bit value in the stack pointer is
transferred to the X register.

Flags Affected:          n - - - - - z -
                         n Set if most significant bit of transferred value is set; else cleared.
                         z Set if value transferred is zero; else cleared.

Codes:

                                     Opcode               Available to:               # of        # of
  Addressing
                        Syntax        (hex)       6502     65C02     65802/816       Bytes      Cycles
  Mode
  Implied               TSX            BA           x         x            x            1           2




                                                                                                                  414
```

<!-- programmanual p415 -->

```
The Western Design Center

  Transfer Index Register X to Accumulator                                                                 TXA

         Transfer the value in index register X to the accumulator. If the registers are different sizes, the nature
of the transfer is determined by the destination (the accumulator). The value in the index register is not changed
by the operation.
         8-bit index registers, 8-bit accumulator (all processors): Value transferred is eight-bit.
         16-bit index registers, 8-bit accumulator (65802/65816 only, x=0, m=1): Value transferred to the
eight-bit accumulator is eight-bit, the low byte of the index register; the hidden eight-bit accumulator B is not
affected by the transfer.
         8-bit index registers, 16-bit accumulator (65802/65816 only, x=1, m=0): The eight-bit index register
becomes of the low byte of the accumulator; the high accumulator byte is zeroed.
         16-bit index registers, 16-bit accumulator (65802/65816 only, x=0, m=0): Value transferred to the
sixteen-bit accumulator is sixteen-bit, the full sixteen-bit index register.

Flags Affected:          n - - - - - z -
                         n Set if most significant bit of transferred value is set; else cleared.
                         z Set if value transferred is zero; else cleared.

Codes:

                                 Opcode               Available to:                # of       # of
  Addressing
                      Syntax      (hex)      6502      65C02      65802/816       Bytes     Cycles
  Mode
  Implied             TXA          8A          x          x            x            1          2




                                                                                                                415
```

<!-- programmanual p416 -->

```
The Western Design Center

 Transfer Index Register X to Stack Pointer                                                               TXS

         Transfer the value in index register X to the stack pointer, S. The index register’s value is not changed
by the operation.
         TXS, along with TCS, are the only two instructions for changing the value in the stack pointer. The
two are also the only two transfer instructions that do not alter the flags.
         6502, 65C02, and 6502 emulation mode (65802/65816, e=1): The stack pointer is only eight bits (it is
concatenated to a high byte of one, confining the stack to page one), and the index registers are only eight bits.
The byte in X is transferred to the eight-bit stack pointer.
         8-bit index registers (65802/65816 native mode, x=1): The stack pointer is sixteen bits but the index
registers are only eight bits. A copy of the byte in X is transferred to the low stack pointer byte and the high
stack pointer byte is zeroed.
         16-bit index registers (65802/65816 native mode, x=0): The full sixteen-bit value in X is transferred
to the sixteen-bit stack pointer.

Flags Affected:         - - - - - - - -

Codes:

                                  Opcode              Available to:               # of       # of
  Addressing
                      Syntax        (hex)    6502     65C02      65802/816       Bytes     Cycles
  Mode
  Implied             TXS            9A        x         x            x            1          2




                                                                                                              416
```

<!-- programmanual p417 -->

```
The Western Design Center

 Transfer Index Register X to Y                                                                        TXY

        Transfer the value in index register X to index register Y. The value in index register X is not changed
by the operation. Note that the two registers are never different sizes.
        8-bit index registers (x=1): Value transferred is eight-bit.
        16-bit index registers (x=0): Value transferred is sixteen-bit.

Flags Affected:         n - - - - - z -
                        n Set if most significant bit of transferred value is set; else cleared.
                        z Set if value transferred is zero; else cleared.

Codes:

                                Opcode              Available to:               # of       # of
  Addressing
                      Syntax      (hex)     6502     65C02      65802/816      Bytes     Cycles
  Mode
  Implied             TXY          9B                                x            1         2




                                                                                                            417
```

<!-- programmanual p418 -->

```
The Western Design Center

  Transfer Index Register Y to Accumulator                                                                 TYA

         Transfer the value in index register Y to the accumulator. If the registers are different sizes, the nature
of the transfer is determined by the destination (the accumulator). The value in the index register is not changed
by the operation.
         8-bit index registers, 8-bit accumulator (all processors): Value transferred is eight-bit.
         16-bit index registers, 8-bit accumulator (65802/65816 only, x=0, m=1): Value transferred to the
eight-bit accumulator is eight-bit, the low byte of the index register; the hidden eight-bit accumulator B is not
affected by the transfer.
         8-bit index registers, 16-bit accumulator (65802/65816 only, x=1, m=0): The eight-bit index register
becomes of the low byte of the accumulator; the high accumulator byte is zeroed.
         16-bit index registers, 16-bit accumulator (65802/65816 only, x=0, m=0): Value transferred to the
sixteen-bit accumulator is sixteen-bit, the full sixteen-bit index register.

Flags Affected:          n - - - - - z -
                         n Set if most significant bit of transferred value is set; else cleared.
                         z Set if value transferred is zero; else cleared.

Codes:

                                 Opcod
                                                     Available to:                 # of       # of
                                   e
 Addressing
                      Syntax       (hex)     6502     65C02      65802/816        Bytes      Cycles
 Mode
 Implied              TYA           98         x         x            x             1           2




                                                                                                                418
```

<!-- programmanual p419 -->

```
The Western Design Center

  Transfer Index register Y to X                                                                       TYX

        Transfer the value in index register Y to index register X. The value in index register Y is not changed
by the operation. Note that the two registers are never different sizes.
        8-bit index registers (x=1): Value transferred is eight-bit.
        16-bit index registers (x=0): Value transferred is sixteen-bit.

Flags Affected:         n - - - - - z -
                        n Set if most significant bit of transferred value is set; else cleared.
                        z Set if value transferred is zero; else cleared.

Codes:

                                 Opcode              Available to:              # of       # of
  Addressing
                      Syntax      (hex)      6502    65C02      65802/816      Bytes     Cycles
  Mode
  Implied             TYX          BB                                x           1          2




                                                                                                            419
```

<!-- programmanual p420 -->

```
The Western Design Center

  Wait for Interrupt                                                                                    WAI

         Pull the RDY pin low. Power consumption is reduced and RDY remains low until an external
hardware interrupt (NMI, IRQ, ABORT, or RESET) is received.
         WAI is designed to put the processor to sleep during an external event to reduce its power
consumption, to allow it to be synchronized with an external event, and/or to reduce interrupt latency (an
interrupt occurring during execution of an instruction is not acted upon until execution of the instruction is
complete, perhaps many cycles later; WAI ensures that an interrupt is recognized immediately).
         Once an interrupt is received, control is vectored through one of the hardware interrupt vectors; an RTI
from the interrupt handling routine will return control to the instruction following the original WAI. However,
if by setting the i flag, interrupt have been disabled prior to the execution of the WAI instruction, and IRQ’ is
asserted, the “wait” condition is terminated and control resumes with the next instruction, rather than through
the interrupt vectors. This provides the quickest response to an interrupt, allowing synchronization with
external events. WAI also frees up the bus; since RDY is pulled low in the third instruction cycle, the
processor may be disconnected from the bus if BE is also pulled low.

Flags Affected:         - - - - - - - -

Codes:

                            Opcode           Available to:            # of        # of
 Addressing
                 Syntax      (hex)    6502 65C02 65802/816            Bytes      Cycles
 Mode
 Implied         WAI          CB                           x            1          31
1 Uses 3 cycles to shut the processor down; additional cycles are required by interrupt to restart it




                                                                                                             420
```

<!-- programmanual p421 -->

```
The Western Design Center

  Reserved for Future Expansion                                                                      WDM

         The 65802 and 65816 use 255 of the 256 possible eight-bit opcodes. One was reserved; it provides an
“escape hatch” for future 65x processors to expand their instruction set to sixteen bit opcodes; this opcode
would signal that the next byte is an opcode in the expanded instruction set. This reserved byte for future two-
byte opcodes was given a temporary mnemonic, WDM, which happen to be the initials of the processors’
designer – William D. Mensch, Jr.
         WDM should never be used in a program, since it would render the object program incompatible with
any future 65x processors.
         If the 65802/65816 WDM instruction is accidentally executed, it will act like a two-byte NOP
instruction.

Flags Affected*:        - - - - - - - -
                        * Flags will be affected variously by future two-byte instructions.

Codes:

                                Opcode              Available to:               # of       # of
 Addressing
                     Syntax      (hex)      6502    65C02      65802/816       Bytes      Cycles
 Mode
                    WDM          42                       x         2*       *
* Byte and cycle counts subject to change in future processors which expand WDM into 2-byte
opcode portions of instructions of varying lengths




                                                                                                            421
```

<!-- programmanual p422 -->

```
The Western Design Center

 Exchange the B and A Accumulators                                                                      XBA

        B represents the high-order byte of the sixteen-bit C accumulator, and A in this case represents the low-
order byte. XBA swaps the contents of the low-order and high-order bytes of C.
        An alternate mnemonic is SWA (swap the high and low bytes of the sixteen-bit A accumulator).
        XBA can be used to invert the low-order, high-order arrangement of a sixteen-bit value, or to
temporarily store an eight-bit value from the A accumulator into B. Since it is an exchange, the previous
contents of both accumulators are changed, replaced by the previous contents of the other.
        Neither the mode select flags nor the emulation mode flag affects this operation.
        The flags are changed based on the new value of the low byte, the A accumulator (that is, on the former
value of the high byte, the B accumulator), even in sixteen-bit accumulator mode.

Flags Affected:         n - - - - - z -
                        n Set if most significant bit of new 8-bit value A accumulator is
                          set; else cleared.
                        z Set if new 8-bit value in A accumulator is zero; else cleared.

Codes:

                                  Opcode             Available to:              # of       # of
 Addressing
                    Syntax         (hex)      6502    65C02     65802/816      Bytes      Cycles
 Mode
 Implied                XBA         EB                                x           1          3
                    (or SWA)




                                                                                                             422
```

<!-- programmanual p423 -->

```
The Western Design Center

 Exchange Carry and Emulation Bits                                                                         XCE

         This instruction is the only means provided by the 65802 and 65816 to shift between 6502 emulation
mode and the full, sixteen-bit native mode.
         The emulation mode is used to provide hardware and software compatibility between the 6502 and
65802/65816.
         If the processor is in emulation mode, then to switch to native mode, first clear the carry bit, then
execute an XCE. Since it is an exchange operation, the carry flag will reflect the previous state of the
emulation bit. Switching to native mode causes bit five to stop functioning as the break flag, and function
instead as the x mode select flag. A second mode select flag, m, uses bit six, which was unused in emulation
mode. Both mode select flags are initially set to one (eight-bit modes). There are also other differences
described in the text.
         If the processor is in native mode, then to switch to emulation mode, you first set the carry bit, then
execute an XCE. Switching to emulation mode causes the mode select flags (m and x) to be lost from the status
register, with x replaced by the b break flag. This forces the accumulator to eight bits, but the high accumulator
byte is preserved in the hidden B accumulator. It also forces the index registers to eight bits, causing the loss of
values in their high bytes, and the stack to page one, causing the loss of the high byte of the previous stack
address. There are also other differences described in the text.

                                           e
Flags Affected:          - - m b/x - - - c
                         e Takes carry’s previous value: set if carry was set; else cleared.
                         c Takes emulation’s pervious value: set if previous mode was emulation; else
                            cleared.
                         m m is a native mode flag only; switching to native mode sets it to 1.
                         x x is a native mode flag only; it becomes the b flag in emulation.
                         b b is an emulation mode flag only; it is set to 1 to become the x flag in native.

Codes:

                                     Opcode              Available to:              # of      # of
  Addressing
                       Syntax         (hex)      6502     65C02     65802/816      Bytes     Cycles
  Mode
  Implied              XCE             FB                                 x           1         2




                                                                                                                423
```
