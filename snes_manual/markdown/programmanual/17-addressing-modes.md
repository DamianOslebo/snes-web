# Chapter 17 — The Addressing Modes (detailed reference)

> ⚠ CROWN: the authoritative per-mode effective-address definitions (every mode, 8/16-bit, with cycles).

## Contents (per the book's own TOC)

- 6502/65C02 Programming Model (p284)
- Absolute (p288)
- Abs Indexed X/Y (p289/290)
- Abs Indexed Indirect (p291)
- Abs Indirect (p292)
- Abs Indirect Long / JMP (p293)
- Absolute Long (p294)
- Abs Long Indexed X (p295)
- Accumulator (p296)
- Block Move (p297)
- Direct Page (p298)
- DP Indexed X/Y (p299/300)
- DP Indexed Indirect (p301)
- DP Indirect (p302)
- DP Indirect Long (p303)
- DP Indirect Indexed Y (p304)
- DP Indirect Long Indexed Y (p305)
- Immediate (p306)
- Implied (p307)
- PC Relative (p308)
- PC Relative Long (p309)
- Stack variants (p310-323)
- Stack Relative (p324)
- SR Indirect Indexed Y (p325)

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

## Body (pages 283–325)


<!-- programmanual p283 -->

```
The Western Design Center



17) Chapter Seventeen
The Addressing Modes
          There are fourteen addressing modes available to the 6502, all of those plus two more on the 65C02,
and another nine categories available on the 65802 and 65816. Each mode allows the location of the data being
referenced by a given instruction to be specified in a different manner. The availability of many different
addressing modes on the 65x processors is one key to their power.
          The data found in operand bytes of an instruction is only one part of the effective address specification;
the addressing modes, expressed using the correct address-mode syntax in the operand field of an assembly-
language statement, cause the assembler to choose from among the instruction’s possible opcodes to one
specific to the addressing mode. Not all addressing modes are available for all instructions; but there is one
unique opcode for each combination of addressing mode and operation.
          The addressing mode is the determinant of the effective address for an operation – the memory address
that the instruction will access for data or to transfer control within the program. For a few of the 65x
addressing modes, the effective address is provided in the operand field of the instruction. But for most of
them, formation of the effective address involves an address calculation, that is, the addition of two or more
values. The addressing mode used with a given instruction indicates where these values are to come from and
how they are to be added together to form the effective address. This effective address calculation has as many
forms as there are addressing modes.
          An important aspect of effective address calculation on the 65802 and 65816, to be considered in
addition to the addressing modes themselves, is the state of the x index-register select flag and, to a lesser
extent, the m memory/accumulator select flag, both in the status register. In a sense, the x flag, for example,
extends the addressing mode specification part of an instruction, which uses an indexed addressing mode, by
determining whether or not an eight-bit or sixteen-bit index register is to be used. For every one of the indexed
addressing modes, there are two similar methods of forming an effective address, depending on the setting of
the index-register select flag. Pay special attention to the status and effects of the select flags.
          In the following pages are graphic and written presentations of each of the addressing modes,
illustrating the effective address formation, complete with a listing of the processors on which, and the
instructions to which, each addressing mode is available. A sample of the assembler syntax used to invoke each
one is included as well.
          The descriptions are the complete set available on the 65816. The differences between the four
processors, with their various modes, are graphically noted whenever possible.
          The 65816’s native mode features index registers and an accumulator which may be either eight bits or
sixteen, depending on the settings of two mode select flags (x sets the index registers to eight or sixteen bits; m
sets the accumulator and memory to eight or sixteen).
          The 65802’s native mode differs in that, while the bank registers are part of effective address formation,
bank values are not propagated to the bus, so long addressing modes have no bank effect. The bank accessed is
always bank zero, so there is, essentially, no bank portion to the effective address generated.
          The 6502 emulation mode on the 65802 and 65816 processors (e = 1) differs in that the stack pointer’s
high byte is always $01; direct page indexed addressing always wraps around to remain in the direct page rather
than crossing over into the next page (so the high direct page byte remains the high byte of all direct page
addresses formed). The exception to this is that zero page stack wrapping is only enforced for 6502 and 65C02
instructions, and only when DP = 0 in the case of page zero wrapping. New opcodes will cause effective
addresses to be generated outside of the zero page or the emulation mode stack page if an effective address
calculation overflows the low byte.
          Additionally, the index registers and the A accumulator are limited to eight bits. (There remains,
however, a hidden eight-bit B accumulator, as well as a 16-bit C accumulator which is the concatenation of B
and A but which is generally not accessible except to special instructions.)
          The 65C02 and 6502 differ from 6502 emulation in that there are no bank registers whatsoever; direct
page addressing is, instead, zero page addressing ($0000 is the zero page base to which offsets and, sometimes,

                                                                                                                283
```

<!-- programmanual p284 -->

```
The Western Design Center

index values are added; there is no direct page register); and there is no hidden B accumulator nor concatenated
C accumulator.
        The symbols in Table 17.1 are used to describe the kinds of operands that are used with the various
addressing modes.
        Figures 17.1 through 17.4 repeat the illustrations of the programming models for the four possible
processor configurations: 6502/65C02, 65802 native mode, 65816 native mode, and 65816 emulation mode.
The programming model for the native mode 65816 is used in the addressing mode figures that follow; for
different processors or modes, compare the addressing mode figure with the processor-mode programming
model for clarification of the operation of the addressing mode for that model.

                       addr            two-byte address
                       addr/const      two-byte value: either an address or a constant
                       const           one- or two-byte constant
                       destbk          64K bank to which string will be moved
                       dp              one-byte direct page offset (6502/65C02: zero page)
                       label           label of code in same 64K bank as instruction
                       long            three-byte address (includes bank byte)
                       nearlabel       label of code close enough to instruction to be reachable
                                       by a one-byte signed offset
                       sr              one-byte stack relative offset
                       srcebk          64K bank from which string will be moved

                                              Table 17-1 Operand Symbols




                                          6502/65C02 Programming Model
                                            7                      0
                                                  Accumulator (A)

                                                  X Index Register (X)

                                                  Y Index Register (Y)
                   15
                     0 0 0 0 0 0 0 1               Stack Pointer (S)

                                Program       Counter (PC)


                                               Processor Status Register (P)
                                          n      v        b d i          z c

                                                                                  Carry    1= Carry
                                                                                   Zero    1= Result Zero
                                                                           IRQ Disable     1= Disabled
                                                                         Decimal Mode      1= Decimal Mode
                                                                       Break Instruction   1= Break caused
                                                                                           interrupt
                                                                              Overflow     1= Overflow
                                                                              Negative     1= Negative



                                    Figure 17-1 6502/65C02 Programming Model


                                                                                                             284
```

<!-- programmanual p285 -->

```
The Western Design Center

                                              65802 Native Mode Programming Model
                                     (16-bit accumulator & index register modes: m = 0 &x = 0)
                                  15                             7                             0
                                   Accumulator (B)           (A or C)           Accumulator (A)

                                                       X Index     Register (X)

                                                       Y Index     Register (Y)

                                                         Direct    Page Register (D)

                                                         Stack     Pointer (S)

                                                       Program     Counter (PC)

                                                                   Data Bank Register (DBR)

                                                                  Program Bank Register (PBR)


         Processor Status Register (P)
 7                                            0
                                                                    0= Native
                                          e        Emulation
                                                                    Mode
     n     v   m    x    d    i      z    c

                                                      Carry         1= Carry
                                                       Zero         1= Result Zero
                                               IRQ Disable          1= Disabled
                                             Decimal Mode           1= Decimal, 0= Binary
                                       Index Register Select        1= 8-bit, 0= 16-bit
                                  Memory/Accumulator Select         1= 8-bit, 0= 16-bit
                                                  Overflow          1= Overflow
                                                   Negative         1= Negative


                                     Figure 17-2. 65802 Native Mode Programming Model




                                                                                                   285
```

<!-- programmanual p286 -->

```
The Western Design Center


  65816 Native Mode Programming Model
                          (16-bit accumulator & index register modes: m = 0 & x = 0)
  23                                           15                            7                                  0
                                                 Accumulator (B)        (A or C)              Accumulator (A)

            Data Bank Register (DBR)

                                                                         X Index    Register (X)

                                                                         Y Index    Register (Y)

    0       0   0    0      0       0       0       0                      Direct   Page Register (D)

    0       0   0    0      0       0       0       0                      Stack    Pointer (S)

        Program Bank Register (PBR)                                      Program    Counter (PC)


                 Processor Status Register (P)
        7                                                       0
                                                            e               Emulation        0= Native Mode
            n   v     m         x       d       i       z   c

                                                                                Carry        1= Carry
                                                                                 Zero        1= Result Zero
                                                                         IRQ Disable         1= Disabled
                                                                       Decimal Mode          1= Decimal, 0= Binary
                                                                 Index Register Select       1= 8-bit, 0= 16-bit
                                                            Memory/Accumulator Select        1= 8-bit, 0= 16-bit
                                                                            Overflow         1= Overflow
                                                                             Negative        1= Negative


                                    Figure 17-3 65816 Native Mode Programming Model




                                                                                                                     286
```

<!-- programmanual p287 -->

```
The Western Design Center


       65816 Emulation Mode Programming Model

      23                                                15                                  7                              0
                                                                 Accumulator (B)            (C)    Accumulator (A)

              Data Bank Register (DBR)

                                                                                                  X Index Register (X)

                                                                                                    Y Index Register (Y)

       0        0   0   0       0       0       0   0                              Direct   Page Register (D)

       0        0   0   0       0       0       0   0    0   0    0   0   0   0    0   1           Stack Pointer (S)

          Program Bank Register (PBR)                                          Program      Counter (PC)




              Processor Status Register (P)

      7                                                  0
                                                         e                Emulation         1= 6502 Emulation Mode
          n     v           b       d       i       z    c

                                                                             Carry          1= Carry
                                                                              Zero          1= Result Zero
                                                                      IRQ Disable           1= Disabled
                                                                    Decimal Mode            1= Decimal, 0= Binary
                                                                  Break Instruction         1= Break caused
                                                                                            interrupt
                                                                          Overflow          1= Overflow
                                                                          Negative          1= Negative


                                        Figure 17-4 65816 Emulation Mode Programming Model




                                                                                                                               287
```

<!-- programmanual p288 -->

```
The Western Design Center

Absolute Addressing

Effective Address:
        Bank: Data Bank Register (DBR) if locating data: Program Bank Register (PBR) if transferring
control.
High: Second operand byte.
Low: First operand byte.

Sample Syntax:
      LDA addr                                                   Effective Address:
                                                                    23              15          7         0
                                                                          Bank           High       Low



   Instruction:
           Opcode             Operand Low                Operand High



   65816 Register:
            Bank                 High                            Low
  23                     15                       7                         0
      Data Bank (DBR)
                                          if locating data

                                        X Index       Register (X)

                                        Y Index       Register (Y)

                                 Accumulator          (A or C)

        0000 0000                        Direct       Page Register (D)

        0000 0000                         Stack       Pointer (S)

    Program Bank (PBR)               Program          Counter (PC)
                                                          of transferring control


                                                            Status (P)

                                                  Instructions Using It:

                                                  Effective Address Locates Data
                                                  ADC              CPY                   LDY        STA
                                                  AND              DEC                   LSR        STX
                                                  ASL              EOR                   ORA        STY
                                                  BIT              INC                   ROL        STZ
                                                  CMP              LDA                   ROR        TRB
                                                  CPX              LDX                   SBC        TSB

                                                  Transfer Control to Effective Address
                                                  JMP               JSR

                                                  1 65C02 and 65802/65816 only.




                                                                                                              288
```

<!-- programmanual p289 -->

```
The Western Design Center

Absolute Indexed, X Addressing

       Effective Address: The Data Bank Register is concatenated with the 16-bit Operand: the 24 bit
       result is added to X (16 bits if 65802/65816 native mode, x = 0; else 8).


       Sample Syntax:
          LDA addr, X

                                                                 Effective Address:
                                                                23                  15                7          0
                                                                         Bank                High         Low


   Instruction:
           Opcode             Operand Low              Operand High


   65816 Registers:
           Bank                  High                       Low
                         15                      7                       0
      Data Bank (DBR)
                                                                                         +

                                    X Index          Register (X)
                                                                             x-1
                                                                             x 0
                                    Y Index          Register (Y)

                                Accumulator          (A or C)

         0000 0000                      Direct       Page Register (D)

         0000 0000                      Stack        Pointer (S)

    Program Bank (PBR)             Program           Counter (PC)


                                                         Status (P)

                                                       Instructions Using It:

                                                       Effective Address Locates Data
                                                       ADC              DEC                     LSR        STA
                                                       AND              EOR                     ORA        STZ
                                                       ASL              INC                     ROL
                                                       BIT              LDA                     ROR
                                                       CMP              LDY                     SBC

                                                       1 65C02 and 65802/65816 only.




                                                                                                                     289
```

<!-- programmanual p290 -->

```
The Western Design Center

Absolute Indexed, Y Addressing

      Effective Address: The Data Bank Register is concatenated to the 16-bit Operand: the 24-bit
      result is added to Y (16 bits if 65802/65816 native mode, x = 0; else 8).

      Sample Syntax:
       LDA addr, Y


                                                                                Effective Address:
                                                                                23        15                    7         0
                                                                                        Bank             High       Low


      Instruction:
              Opcode             Operand Low              Operand High


      65816 Registers:
               Bank                 High                       Low
      23                    15                      7                       0
         Data Bank (DBR)


                                       X Index          Register (X)
                                                                                                     +
                                       Y Index          Register (Y)
                                                                                x1
                                                                                x0
                                   Accumulator          (A or C)

           0000 0000                       Direct       Page Register (D)

           0000 0000                       Stack        Pointer (S)

       Program Bank (PBR)             Program           Counter (PC)


                                                             Status (P)

                                                    Instructions Using It:

                                                    Effective Address Locates Data
                                                    ADC              EOR                         ORA
                                                    AND              LDA                         SBC
                                                    CMP              LDX                         STA




                                                                                                                              290
```

<!-- programmanual p291 -->

```
The Western Design Center

Absolute Indexed Indirect Addressing

Effective Address:
Bank:               Program Bank Register (PBR).
High/Low:           The Indirect Address.
Indirect Address: Located in the Program Bank at the sum of the Operand double byte and X (16 bits
                   if 65802/65816 native mode, x = 0; else 8 bits).

Sample Syntax:
      JMP (addr, X)


                                                                     Effective Address:
                                                                     23                 15                    7                  0
                                                                             Bank                 High                 Low


 Instruction:
         Opcode             Operand Low                Operand High


 65816 Registers:
          Bank                 High                            Low
 23                    15                       7                         0
    Data Bank (DBR)
                                                                                             +1          High Indirect Address
                                                                                    +                    Low Indirect Address
                                   X Index          Register (X)                                             Program Bank
                                                                                                                Memory
                                                                              x=1
                                                                              x=0
                                   Y Index          Register (Y)

                               Accumulator          (A or C)

      0000 0000                        Direct       Page Register (D)

      0000 0000                        Stack        Pointer (S)

  Program Bank (PBR)                  Program       Counter (PC)



                                                          Stack (P)


                                                                      Instructions Using It:

                                                                      Transfer Control to Effective Address
                                                                      JMP1              JSR2

                                                                      1 65C02 and 65802/65816 only.
                                                                      2 65802/65816 only.




                                                                                                                                     291
```

<!-- programmanual p292 -->

```
The Western Design Center

Absolute Indirect Addressing

Effective Address:
Bank:              Program Bank Register (PBR).
High/Low:          The Indirect Address.
Indirect Address: Located in Bank Zero, at the Operand double byte.

Sample Syntax:
   JMP (addr)


                                                              Effective Address:
                                                              23                 15                    7                0
                                                                      Bank                 High                   Low



 Instruction:
         Opcode          Operand Low                Operand High                              High Indirect Address
                                                                                      +1
                                                                                              Low Indirect Address
 65816 Registers:
          Bank              High                           Low
 23                 15                      7                          0                          Bank 0 Memory
    Data Bank (DBR)

                                X Index         Register (X)

                                Y Index         Register (Y)

                            Accumulator         (A or C)

      0000 0000                    Direct       Page Register (D)

      0000 0000                    Stack        Pointer (S)

  Program Bank (PBR)           Program          Counter (PC)



                                                      Status (P)



                                                                 Instructions Using It:

                                                                 Transfer Control to Effective Address
                                                                 JMP




                                                                                                                            292
```

<!-- programmanual p293 -->

```
The Western Design Center

Absolute Indirect Long Addressing

Effective Address:
Bank/High/Low: The 24-bit Indirect Address.
Indirect Address: Located in Bank Zero, at the Operand double byte.


Sample Syntax:
  JMP [addr]


                                                                     Effective Address:
                                                                     23                 15                 7                0
                                                                              Bank             High                   Low

 Instruction:
         Opcode             Operand Low               Operand High                           Bank Indirect Address
                                                                                  +2
                                                                                              High Indirect Address
                                                                                  +1
 65816 Registers:                                                                             Low Indirect Address
          Bank                 High                           Low
 23                    15                      7                          0                      Bank 0 Memory
    Data Bank (DBR)

                                   X Index         Register (X)

                                   Y Index         Register (Y)

                               Accumulator         (A or C)

      0000 0000                       Direct       Page Register (D)

      0000 0000                       Stack        Pointer (S)

  Program Bank (PBR)               Program         Counter (PC)



                                                        Status (P)



                                                                    Instructions Using It:

                                                                    Transfer Control to Effective Address
                                                                    JMP/JML

                                                                    Note: 65802/65816 only;
                                                                    65802: Data bank value is not propagated to the bus
                                                                    (bank accessed is always bank 0).




                                                                                                                                293
```

<!-- programmanual p294 -->

```
The Western Design Center

Absolute Long Addressing

Effective Address:

Bank:       Third operand byte.
High:       Second operand byte.
Low:        First operand byte.


Sample Syntax:
                                                                  LDA long


                                                     Effective Address:
                                                     23                      15                   7            0
                                                                Bank                     High           Low


 Instruction:
         Opcode          Operand Low            Operand High              Operand Bank


 65816 Register:
         Bank                High                   Low
 23                 15                    7                       0
    Data Bank (DBR)

                                    X Index   Register (X)

                                    Y Index   Register (Y)

                             Accumulator      (A or C)

        0000 0000                    Direct   Page Register (D)

        0000 0000                     Stack   Pointer (S)

    Program Bank (PBR)              Program   Counter (PC)


                                                   Status (P)



                                                Instruction Using It:

                                                Effective Address Locates Data
                                                ADC              CMP                        LDA          SBC
                                                AND              EOR                        ORA          STA

                                                Transfer Control to Effective Address
                                                JMP(JML)                                          JSR(JSL)

                                                Note: All are 65802/65816 only;
                                                65802: Data bank value is not propagated to the bus
                                                (bank accessed is always bank 0).




                                                                                                                   294
```

<!-- programmanual p295 -->

```
The Western Design Center

Absolute Long Indexed, X Addressing

Effective Address:         The 24-bit Operand is added to (16 bits if 65802/65816 native mode, x = 0; else
                           8 bits)

Sample Syntax:
  LDA long, X


                                                    Effective Address:
                                                    23                         15               7                 0
                                                               Bank                    High            Low


 Instruction:
          Opcode         Operand Low            Operand High            Operand Bank


 65816 Registers:
          Bank               High                     Low
 23                 15                      7                       0
    Data Bank (DBR)                                                                    +

                               X Index          Register (X)
                                                                        x 1
                                                                        x 0
                               Y Index          Register (Y)

                           Accumulator          (A or C)

        0000 0000               Direct          Page Register (D)

        0000 0000                   Stack       Pointer (S)

   Program Bank (PBR)         Program           Counter (PC)


                                                      Stack



                                                      Instructions Using It:

                                                      Effective Address Locates Data
                                                      ADC              CMP                    LDA           SBC
                                                      AND              EOR                    ORA           STA

                                                      Note: All are 65802/65816 only;
                                                      65802: Data bank value is not propagated to the bus
                                                      (bank accessed is always bank 0).




                                                                                                                      295
```

<!-- programmanual p296 -->

```
The Western Design Center

Accumulator Addressing

8-Bit Data (all processors): Data: Byte in accumulator A.                                                 Data
                                                                                                  7                   0
                                                                                  Accumulator B       Accumulator A


16-Bit Data (65802/65816, native mode. 16-bit accumulator (m = 0):
Data High: High byte in accumulator A.
Data Low: Low byte in accumulator A.                                                                       Data
                                                                                    Accumulator       (A or C)


Sample Syntax:
    ASLA


 Instruction:
          Opcode

 65816 Registers:
           Bank             High                         Low
 23                    15                   7                       0
     Data Bank (DBR)

                                X Index         Register (X)

                                Y Index         Register (Y)

                            Accumulator         (A or C)
                                                                        m 1
                                                                        m 0
       0000 0000                   Direct       Page Register (D)

       0000 0000                   Stack        Pointer (S)

  Program Bank (PBR)          Program           Counter (PC)


                                                     Status (P)



                                                  Instructions Using It:

                                                  ASL                   INC1       ROL
                                                  DEC1                  LSR        ROR

                                                  1 65C02 and 65802/65816 only.




                                                                                                                          296
```

<!-- programmanual p297 -->

```
The Western Design Center

Block Move Addressing

Source Effective Address:
Bank:                                       Second operand byte.
         High/Low:            The 16-bit value in X; if X is only 8 bits (mode flag x = 1), the high byte is 0.
Destination Effective Address:
Bank:                      First operand byte.
High/Low:                  The 16-bit value in Y; if Y is only 8 bits (mode flag x = 1), the high byte
                           is 0.
Count:
Number of bytes to be moved: 16-bit value in Accumulator C plus 1.
Sample Syntax:
 MVN srcebk,destbk

                                                                     Source Effective Address:
                                                                     23              15                        7             0
                                                                           Bank                High                    Low


 Instruction:
       Opcode          Destination Bank        Source Bank


 65816 Registers:
        Bank                High                   Low                        Destination Effective Address:
 23               15                   7                       0         23               15                       7         0
  Data Bank (DBR)                                                                Bank               High               Low


                              X Index       Register (X)
                                                                   x 0
                            00000000                               x 1
                              Y Index       Register (Y)
                                                                   x 0
                          00000000                                 x 1
                         Accumulator        (A or C)

                                                                     1                              16 bit count
    0000 0000                 Direct       Page Register (D)

    0000 0000                   Stack      Pointer (S)

  Program Bank (PBR          Program       Counter (PC)


                                               Status (P)

                                                                                 Instructions Using It:

                                                                                 Effective Address Locates Data
                                                                                 MVN              MVP

                                                                                 Note: Both are 65802/65816 only;
                                                                                 65802: Data bank values are not propagated
                                                                                 to the bus (bank accessed is always bank 0).




                                                                                                                                 297
```

<!-- programmanual p298 -->

```
The Western Design Center

Direct Page Addressing

Effective Address:
Bank:
High/Low              Direct Page Register plus Operand byte.

Sample Syntax:
  LDA dp

                                                         Effective Address:
                                                         23                    15                    7            0
                                                                    Bank                High             Low

                                                                    00000000
    Instruction:
             Opcode            Operand


    65816 Registers:
             Bank               High                         Low
    23                 15                        7                         0
       Data Bank (DBR)

                                    X Index          Register (X)
                                                                                    +
                                    Y Index          Register (Y)

                                Accumulator          (A or C)

          0000 0000                    Direct        Page (D)

          0000 0000                      Stack       Pointer (S)

       Program Bank (PBR)          Program           Counter (PC)


                                                          Status (P)



                                                       Instructions Using It:

                                                       Effective Address Locates Data
                                                       ADC              CPY                    LDY         STA
                                                       AND              DEC                    LSR         STX
                                                       ASL              EOR                    ORA         STY
                                                       BIT              INC                    ROL         STZ1
                                                       CMP              LDA                    ROR         TRB1
                                                       CPX              LDX                    SBC         TSB1
1
    65C02 and 65802/65816 only.




                                                                                                                      298
```

<!-- programmanual p299 -->

```
The Western Design Center

Direct Page Indexed, X Addressing

Effective Address:

Bank:                  Zero
High/Low:              Direct Page Register plus Operand byte plus X (16 bits if 65802/65816 native mode, x =
                       0; else 8 bits).

Sample Syntax:
   LDA dp, X

                                                                         Effective Address:
                                                                         23                 15          7           0
                                                                                  Bank           High       Low

                                                                              00000000
    Instruction:
            Opcode                Operand


    65816 Registers:
            Bank                   High               Low
    23                     15                 7                    0
        Data Bank (DBR)                                                                  +

                                                                                                 +
                                    X Index   Register (X)
                                                                       x 1
                                                                       x 0
                                    Y Index   Register (Y)

                                Accumulator   (A or C)

          0000 0000                  Direct   Page (D)

          0000 0000                   Stack   Pointer (S)

      Program Bank (PBR)           Program    Counter (PC)


                                                  Status (P)



                                                            Instruction Using It:

                                                            Effective Address Locates Data
                                                            ADC              DEC                 LSR         STA
                                                            AND              EOR                 ORA         STY
                                                            ASL              INC                 ROL         STZ1
                                                            BIT1             LDA                 ROR
                                                            CMP              LDY                 SBC
1
    65C02 and 65802/65816 only.




                                                                                                                        299
```

<!-- programmanual p300 -->

```
The Western Design Center

Direct Page Indexed, Y Addressing

Effective Address:
Bank:        Zero
High/Low: Direct Page Register plus Operand byte plus Y (16 bits if 65802/65816 native mode, x =
             0; else 8 bits).

Sample Syntax:
   LDA dp, Y

                                                                Effective Address:
                                                                23                 15              7         0
                                                                         Bank           High           Low

                                                                          00000000
 Instruction:
          Opcode         Operand


 65816 Registers:
          Bank            High                       Low
 23                 15                    7                     0
    Data Bank (DBR)

                                                                                 +
                             X Index          Register (X)

                                                                                               +

                             Y Index          Register (Y)
                                                                    x 1
                                                                    x 0
       0000 0000                 Direct       Page (D)


       0000 0000                 Stack        Pointer (S)


   Program Bank (PBR)        Program          Counter (PC)


                                                   Status (P)



                                                  Instruction Using It:

                                                  Effective Address Locates Data
                                                  LDX              STX




                                                                                                                 300
```

<!-- programmanual p301 -->

```
The Western Design Center

Direct Page Indexed Indirect, X Addressing

Effective Address:
Bank:                          Data bank register.
High/Low:                      The indirect address.
Indirect Address:              Located in the direct page at the sum of the direct page register, the operand
                               byte, and X (16 bits if 65802/65816 native mode, x = 0; else 8), in bank 0.

Sample Syntax:
  LDA (dp, X)

                                                                   Effective Address:
                                                                   23                 15               7                  0
                                                                            Bank            High                Low


 Instruction:
            Opcode              Operand


 65816 Registers:
            Bank                 High                    Low
 23                       15                  7                    0
      Data Bank (DBR)


                                    X Index        Register (X)
                                                                       x 1                          High Indirect
                                                                       x 0                            Address
                                                                                           +1
                                    Y Index        Register (Y)                                     Low Indirect
                                                                                      +
                                                                                                      Address

                                Accumulator        (A or C)                                        Bank 0 Memory
                                                                             +

         0000 0000                   Direct        Page (D)


         0000 0000                   Stack        Pointer (PC)


     Program Bank (PBR)           Program         Counter (PC)


                                                      Status (P)

                                                      Instructions Using It:

                                                      Effective Address Locates Data
                                                      ADC              CMP                  LDA                     SBC
                                                      AND              EOR                  ORA                     STA




                                                                                                                              301
```

<!-- programmanual p302 -->

```
The Western Design Center

Direct Page Indirect Addressing

Effective Address:
Bank:                          Data Bank Register (DBR)
High/Low:                      The 16-bit Indirect Address
Indirect Address:              The Operand byte plus the Direct Page Register, in Bank Zero.

Sample Syntax:
   LDA (dp)

                                                                Effective Address:
                                                                23                   15                      7                0
                                                                          Bank                 High                    Low


 Instruction:
         Opcode               Operand


 65816 Registers:
         Bank                  High                   Low
 23                      15                 7                      0
   Data Bank (DBR)

                                                                                                       High Indirect
                                  X Index       Register (X)                                             Address
                                                                                          +1
                                                                                                       Low Indirect
                                                                            +
                                                                                                         Address
                                  Y Index       Register (Y)
                                                                                                      Bank 0 Memory

                               Accumulator       (A or C)


       0000 0000                      Direct     Page (D)


       0000 0000                        Stack    Pointer (S)


    Program Bank (PBR)            Program        Counter (PC)


                                                     Status (P)



                                                       Instructions Using It:

                                                       Effective Address Located Data
                                                       ADC              CMP                       LDA                   SBC
                                                       AND              EOR                       ORA                   STA

Note: All are 65C02 and 65802/65816 only.




                                                                                                                                  302
```

<!-- programmanual p303 -->

```
The Western Design Center

Direct Page Indirect Long Addressing

Effective Address:
Bank/High/Low:                The 24-bit Indirect Address.
Indirect Address:             The Operand byte plus the Direct Page Register, in Bank Zero.

Sample Syntax:
  LDA [dp]

                                                                       Effective Address:
                                                                       23                 15                7                0
                                                                                Bank           High                   Low


 Instruction:
         Opcode              Operand


 65816 Registers:
         Bank                 High                      Low
 23                     15                    7                    0
     Data Bank (DBR)

                                                                                                      Bank Indirect
                                 X Index          Register (X)                                          Address
                                                                                        +2
                                                                                                      High Indirect
                                                                                                        Address
                                                                                        +1
                                 Y Index          Register (Y)                                        Low Indirect
                                                                              +
                                                                                                        Address

                             Accumulator          (A or C)                                        Bank 0 Memory


       0000 0000                     Direct       Page (D)


       0000 0000                     Stack        Pointer (S)


   Program Bank (PBR)           Program           Counter (PC)


                                                      Status (P)

                                                          Instruction Using It:

                                                          Effective Address Locates Data
                                                          ADC              CMP                 LDA                     SBC
                                                          AND              EOR                 ORA                     STA

                                                          Note: All are 65802/65816 only;
                                                          65802: Data bank value is not propagated to the bus
                                                          (bank accessed is always bank 0).




                                                                                                                                 303
```

<!-- programmanual p304 -->

```
The Western Design Center

Direct Page Indirect Indexed, Y Addressing

Effective Address:            Found by concatenating the data bank to the double-byte indirect address, then
                              adding Y (16 bits if 65802/65816 native mode, x = 0; else 8).
Indirect Address:             Located in the Direct Page at the sum of the direct page register and the operand
                              byte, in bank zero.

Sample Syntax:
   LDA (dp), Y

                                                                        Effective Address:
                                                                        23                 15             7               0
                                                                                 Bank           High               Low


 Instruction:
       Opcode               Operand


 65816 Registers:
        Bank                 High                       Low
 23                    15                    7                     0
   Data Bank (DBR)




                                X Index          Register (X)                                      High Indirect
                                                                                                     Address
                                                                                         +1
                                                                                                   Low Indirect
                                                                                 +                                        +
                                Y Index          Register (Y)                                        Address
                                                                                                 Bank 0 Memory
                                                                  x=1
                                                                  x=0
                            Accumulator          (A or C)


     0000 0000                      Direct       Page (D)


     0000 0000                      Stack        Pointer (S)


  Program Bank (PBR)            Program          Counter (PC)


                                                     Status (P)

                                                         Instruction Using It:

                                                         Effective Address Locates Data
                                                         ADC              CMP                   LDA                 SBC
                                                         AND              EOR                   ORA                 STA




                                                                                                                              304
```

<!-- programmanual p305 -->

```
The Western Design Center

Direct Page Indirect Long Indexed, Y Addressing

Effective Address:         Found by adding to the triple-byte indirect address Y (16 bits if 65802/65816
                           native mode, x = 0; else 8 bits).
Indirect Address:          Located in the Direct Page at the sum of the direct page register and the operand
                           byte in bank zero.
Sample Syntax:
   LDA (dp), Y

                                                             Effective Address:
                                                             23                   15                    7                      0
                                                                       Bank                 High                    Low


 Instruction:
         Opcode           Operand


 65816 Registers:
          Bank             High                    Low
 23                 15                 7                        0
    Data Bank (DBR)                                                                                 Bank Indirect
                                                                                                      Address
                                                                                       +2
                                                                                                    High Indirect
                             X Index       Register (X)                                               Address
                                                                                       +1
                                                                                                    Low Indirect
                                                                            +
                                                                                                      Address
                                                                                                                           +
                             Y Index       Register (Y)
                                                                                                   Bank 0 Memory
                                                                x 1
                                                                x 0
                         Accumulator       (A or C)


      0000 0000               Direct       Page (D)


      0000 0000                Stack       Pointer (S)


   Program Bank (PBR)       Program        Counter (PC)


                                                Status (P)

                                                      Instructions Using It:

                                                      Effective Address Locates Data
                                                      ADC              CMP                    LDA                    SBC
                                                      AND              EOR                    ORA                    STA

                                                      Note: All are 65802/65816 only;
                                                      65802: Data bank value is not propagated to the bus
                                                      (bank accessed is always bank 0).




                                                                                                                                   305
```

<!-- programmanual p306 -->

```
The Western Design Center

Immediate Addressing

8-Bit Data (all processors): Data Operand byte.
16-Bit Data (65802/65816, native mode, applicable mode flag m or x = 0):
Data High:            Second Operand byte.
Data Low:             First Operand byte.

Sample Syntax:
 LDA const.

               Instruction:
                              Opcode           Data Low = Operand Low            Data High = Operand High


               Instruction:
                              Opcode               Data = Operand


               65816 Registers:
                            Bank                       High                                    Low
               23                         15                                 7                              0
                      Data Bank (DBR)


                                                               X Index           Register (X)


                                                               Y Index           Register (Y)


                                                           Accumulator           (A or C)


                         0000 0000                                  Direct       Page Register (D)


                         0000 0000                                  Stack        Pointer (S)


                     Program Bank (PBR)                        Program           Counter (PC)


                                                                                            Status (P)



                                               Instructions Using It:
                                               ADC              CPX                             LDX             SBC
                                               AND              CPY                             LDY             SEP1
                                               BIT1             EOR                             ORA
                                               CMP              LDA                             REP1
1.
     65C02 and 65802/65816 only.
2.
     65802/65816 only.




                                                                                                                       306
```

<!-- programmanual p307 -->

```
The Western Design Center

Implied Addressing

Type 1: Mnemonic specifies register(s) to be operated on
Type 2: Mnemonic specifies flag bit(s) to be operated on
Type 3: Mnemonic specifies operation; no data involved

Sample Syntax:
   NOP

                 Instruction:
                           Opcode

                 65816 Registers:
                           Bank                   High                            Low
                 23                  15                            7                         0
                     Data Bank (DBR)

                                                         X Index       Register (X)

                                                         Y Index       Register (Y)

                                                   Accumulator         (A or C)

                         0000 0000                        Direct       Page Register (D)

                         0000 0000                         Stack       Pointer (S)

                     Program Bank (PBR)                  Program       Counter (PC)


                                                                             Status (P)

                                          Instructions Using It:

                                          Mnemonic Specifies Register(s)
                                          DEX            TAY                               TSX   TYX
                                          DEY            TCD                               TXA   XBA
                                          INX            TCS                               TXS
                                          INY            TDC                               TXY
                                          TAX            TSC                               TYA

                                          Mnemonics Specifies Flag Bit(s)
                                          CLC            CLI                               SEC   SEI
                                          CLD            CLV                               SED   XCE

                                          Mnemonics Specifies Operation
                                          NOP            STP                               WAP
                                          1
                                              65802/65816 only.




                                                                                                       307
```

<!-- programmanual p308 -->

```
The Western Design Center

Program Counter Relative Addressing

Effective Address:
Bank:        Program Bank Register (PBR).
High/Low     The Operand byte, a two’s complement signed value, is sign-extended to 16 bits, then
             added to the Program Counter (its value is the address of the opcode following this
             one).

Sample Syntax:
   BRA nearlabel

                                                                     Effective Address:
                                                                     23                   15                 7         0
                                                                              Bank                    High       Low


 Instruction:
         Opcode              Operand
                                                                           sign extended to 16 bits
 65816 Registers:
          Bank                  High                           Low
 23                     15                       7                         0
     Data Bank (DBR)

                                                                                    +
                                       X Index       Register (X)


                                       Y Index       Register (Y)


                                 Accumulator         (A or C)


       0000 0000                        Direct       Page Register (D)


       0000 0000                         Stack       Pointer (S)


   Program Bank (PBR)                  Program       Counter (PC)



                                                            Status (PC)

                                                        Instructions Using It:

                                                        Transfer Control to Effective Address
                                                        BCC               BMI              BRA1
                                                        BCS               BNE              BVC
                                                        BEQ               BPL              BVS
                                                        1
                                                            65C02 and 65802/65816 only.




                                                                                                                           308
```

<!-- programmanual p309 -->

```
The Western Design Center

Program Counter Relative Long Address

Effective Address:
Bank:        Program Bank Register (PBR).
High/Low: The Operand double byte, a two’s complement signed value, is added to the Program
             Counter (its value is the address of the opcode following this one).

Sample Syntax:
  BRL label

                                                                    Effective Address:
                                                                    23                 15          7         0
                                                                             Bank           High       Low


 Instruction:
           Opcode            Operand Low                Operand High


 65816 Registers:
           Bank                 High                            Low
 23                     15                       7                           0
     Data Bank (DBR)

                                                                                        +
                                       X Index       Register (X)


                                       Y Index       Register (Y)


                                Accumulator          (A or C)


        0000 0000                       Direct       Page Register (D)


        0000 0000                        Stack       Pointer (S)


   Program Bank (PBR)               Program          Counter (PC)



                                                           Status (P)

                                                     Instructions Using It:

                                                     Transfer Control to Effective Address
                                                     BRL

                                                     Note: 65802/65816 only.




                                                                                                                 309
```

<!-- programmanual p310 -->

```
The Western Design Center

Stack (Absolute) Addressing

Source of data to be pushed:            The 16-bit operand, which can be either an absolute address or
immediate data.

Destination effective address: Provided by Stack Pointer.

Sample Syntax:
 PEA addr/const

             Instruction:
                            Opcode           Data Low = Operand Low            Data High = Operand High

                                                                      (Data)
             65816 Registers:
                           Bank                      High                                   Low
             23                         15                               7                                0
                    Data Bank (DBR)


                                                             X Index         Register (X)


                                                             Y Index         Register (Y)


                                                         Accumulator         (A or C)


                        0000 0000                              Direct        Page Register (D)


                        0000 0000                               Stack        Pointer (S)


                   Program Bank (PBR)                        Program         Counter (PC)


                                                                                        Status (P)

                                                                        Instruction Using It:
                                                                        PEA
                                                                        Note: 65802/65816 only.




                                                                                                              310
```

<!-- programmanual p311 -->

```
The Western Design Center




                                       Stack
                              before
                                        Data High
                                                    Data
          Stack Pointer (S)            Data Low
                              after




                                          Bank 0




                                                           311
```

<!-- programmanual p312 -->

```
The Western Design Center

Stack (Direct Page Indirect) Addressing

Source of data to be pushed: The 16-bit indirect address (or double-byte data) located at the sum of
the Operand byte plus the Direct Page Register, in Bank Zero.

Destination effective address: Provided by Stack Pointer.


Sample Syntax:
  PEI dp

                                                              Effective Address:
                                                              23              15      7         0
                                                                        Bank       High   Low
  Instruction:
           Opcode         Operand


  65816 Registers:
           Bank            High                       Low
  23                 15                    7                       0
                                                                              +
     Data Bank (DBR)


                              X Index          Register (X)


                              Y Index          Register (Y)


                          Accumulator          (A or C)


        0000 0000                 Direct       Page Register (D)


        0000 0000                 Stack        Pointer (S)


    Program Bank (PBR)       Program           Counter (PC)


                                                   Status (P)

                                                  Instruction Using It:

                                                  Effective Address Locates Data
                                                  PEI

                                                  Note: 65802/65816 only.




                                                                                                    312
```

<!-- programmanual p313 -->

```
The Western Design Center




                    Source
                    Effective Address + 1
                                                 High Indirect Address
                    Source
                    Effective Address:
                                                 Low Indirect Address

                                                        Bank 0


                                                        Stack
                                        before
                                                 High Indirect Address

            Stack   Pointer (S)                  Low Indirect Address
                                        after



                                                        Bank 0




                                                                         313
```

<!-- programmanual p314 -->

```
The Western Design Center

Stack (Interrupt) Addressing

Effective Address: After pushing the Program Bank (65802/816 native mode only), followed by the
Program Counter and the Status Register, the Effective Address is loaded into the Program Counter
and Program Bank Register, transferring control there.

Bank:                     Zero

High/Low:                 The contents of the instruction- and processor-specific interrupt vector.

Data: Source:        Program Bank, Program Counter, and Status Register.
       Destination Effective Address: Provided by Stack Pointer.

Sample Syntax:
      BRK

                                                                                       Effective Address:
                                                                                       23                 15                           7                   0
                                                                                                Bank                  High                      Low

                                                                                            00000000
 Instruction:
                                       Optimal Signature
              Opcode                          Byte
      Note: Hardware interrupt addressing differs only
           in that there is no instruction involved                                                    Interrupt Vector
                                                                                                       Address +1
                                                                                                                            Contents of
 65816 Registers:
                                                                                                       Interrupt Vector     Vector High
               Bank                       High                        Low                              Address              Contents of
 23                             15                         7                       0                                        Vector Low
        Data Bank (DBR)
                                                                                                                            Bank 0 Memory
                                              X Index          Register (X)
                                                                                                        Vectors           6502/C02/emulation    Native
                                              Y Index          Register (Y)
                                                                                                        IRQ               00FFFE.F (with BRK)   00FFEE.F
                                         Accumulator           (A or C)                                 RESET             00FFFC.D
                                                                                                        NMI               00FFFA.B              00FFEA.B
           0000 0000                             Direct        Page Register (D)                        ABORT             00FFF8.9              00FFE8.9
                                                                                                        BRK               00FFFE.F              00FFE6.7
           0000 0000                             Stack         Pointer (S)                              COP               00FFF4.5              00FFE4.5


      Program Bank (PBR)                      Program          Counter (PC)
                                                                                                               Instructions Using It:

                                                                   Status (P)                                  Transfer Control to Effective Address
                                                                                                               BRK                     COP




                                                                                                                                                               314
```

<!-- programmanual p315 -->

```
The Western Design Center




  Stack (Interrupt) Addressing
                                                6502/65C02/Emulation Mode

                                                   Stack
                                       before
                                                           PC High
                                                                                        Program   Counter (PC)
                                                            PC Low
                Stack    Pointer (S)
                                                           Status (P)            Status (P)
                                       after

                                                            Bank 0


                                                65802/65816 Native Mode

                                                          Stack
                                       before
                                                   Program Bank (PBR)       Program Bank (PBR)
                                                         PC High
                Stack    Pointer (S)                                                    Program   Counter (PC)
                                                         PC Low
                                                        Status (P)               Status (P)
                                       after

                                                            Bank 0




                                                                                                                 315
```

<!-- programmanual p316 -->

```
The Western Design Center

Stack (Program Counter Relative) Addressing

Source of data to be pushed: The 16-bit sum of the 16-bit Operand plus the 16-bit Program Counter.
(Note that the 16-bit Operand which is added is the object code operand; the operand used in the
instruction’s syntax required by most assemblers is a label which is converted to the object operand.)

Destination Effective Address: Provided by Stack Pointer.

Sample Syntax:
      PER label

 Instruction:
           Opcode                Operand Low                      Operand High


 65816 Registers:
           Bank                       High                               Low
 23                  15                                   7                       0
     Data Bank (DBR)


                                              X Index         Register (X)            +              Data


                                              Y Index         Register (Y)


                                          Accumulator         (A or C)


        0000 0000                              Direct         Page Register (D)


        0000 0000                               Stack         Pointer (S)


    Program Bank (PBR)                       Program          Counter (PC)

                                                                                            Instructions Using It:
                                                                                            PER
                                                                    Status (P)              Note: 65802/65816 only.




                                                                     Stack
                                                 before
                                                                    Data High
                    Stack   Pointer (S)                                                   Data
                                                                    Data Low
                                                 after


                                                                      Bank 0




                                                                                                                      316
```

<!-- programmanual p317 -->

```
The Western Design Center

Stack (Pull) Addressing

Source Effective Address: Provided by Stack Pointer.

Destination of data to be pulled: Register specified by the opcode. The Stack Pointer (S) is
incremented, specifying the location from which an 8-bit register – or the low byte of a 16-bit register
– will be loaded. If the register is 16 bits, the Stack Pointer will be incremented a second time, and the
register’s high byte will be loaded from this second new Stack Pointer location.

Sampler Syntax:
      PLA

     Instruction:
                         Opcode

     65816 Registers:
                           Bank                     High                                         Low
     23                                  15                              7                               0
                     Data Bank (DBR)
                       (also called B)
                                                               X Index       Register (X)

                                                               Y Index       Register (Y)

                                                           Accumulator       (A or C)

                       0000 0000                                Direct       Page Register (D)

                       0000     0000                             Stack       Pointer (S)

                    Program Bank (PBR)                        Program        Counter (PC)


                                                                                            Status (P)


Instruction Using It:

Effective Address Locates Data
PLA           PLD           PLX
PLB           PLP           `PLY
1.
          65802/65816 only.
2.
          8 bit register, except on 65802/816 may either 8 or 16 bits, dependent on flag m.
3.
          8 bit register, except on 65802/816 may be either 8 or 16 bits, dependent on flag x.
4.
          16 bits always.
5.
          8 bits always.




                                                                                                             317
```

<!-- programmanual p318 -->

```
The Western Design Center




                                         Pull 8-bit Register


                                                                             Stack
                                                                 after
                                                                            Register
                            Stack Pointer (S)
                                                                 before




                                                                             Bank 0



                                          Pull 16-bit Register


                                                                             Stack
                                                                 after
                                                                          Register High
                            Stack Pointer (S)
                                                                          Register Low
                                                                 before



                                                                             Bank 0




                                                                                          318
```

<!-- programmanual p319 -->

```
The Western Design Center

Stack (Push) Addressing

Source of data to be pushed: Register specified by the opcode.

Destination Effective Address: Provided b Stack Pointer.
The Stack Pointer (S) specifies the location to which an 8-bit register – or the high byte of a 16-bit
register – will be stored. The low byte of a 16-bit register will be stored to the Stack Pointer location
minus one. After storage of an 8-bit register, S is decremented by 1; after a 16-bit register, S is
decremented by 2.

Sample Syntax:
          PHA

  Instructions:
                        Opcode

  65816 Registers:
                         Bank                             High                                           Low
  23                                        15                                 7                                    0
                   Data Bank (DBR)
                     (also called B)


                                                                     X Index       Register (X)

                                                                     Y Index       Register (Y)

                                                                 Accumulator       (A or C)

                      0000 0000                                       Direct       Page Register (D)

                      0000 0000                                        Stack       Pointer (S)

                  Program Bank (PBR)                                Program        Counter (PC)
                     (also called K)


                                                                                                       Status (P)




                       Instruction Using It:

                       Effective Address Locates Data
                       PHA              PHD               PHP
                       PHB              PHK               PHX

                       1
                                65802/65816 only.
                       2
                                8 bit register, except on 65802/816, may be either 8 or 16 bits, dependent on flag m.
                       3
                                8 bit register, except on 65802/816, may be either 8 or 16 bits, dependent on flag x.
                       4
                                16 bit always.
                       5
                                8 bit always.




                                                                                                                        319
```

<!-- programmanual p320 -->

```
The Western Design Center


                                        Push 8-bit Register


                                                                     Stack
                                                         before
                            Stack Pointer (S)
                                                                    Register
                                                         after




                                                                     Bank 0



                                       Push 16-bit Register


                                                                     Stack
                                                         before
                                                                  Register High
                             Stack Pointer (S)
                                                                  Register Low
                                                         after



                                                                     Bank 0




                                                                                  320
```

<!-- programmanual p321 -->

```
The Western Design Center

Stack (RTI) Addressing

Source Effective Address: Provided by Stack Pointer.

Destination of values to be pulled: First the Status Register, then the Program Counter is pulled,
followed (65802/65816 native mode only) by the Program Bank.

Control is transferred to the new Program Counter (and Program Bank) value(s).

Sample Syntax:
      RTI

 Instruction:
                    Opcode

 65816 Registers:
                     Bank                                       High                                             Low
 23                                       15                                              7                                               0
                Data Bank (DBR)

                                                                                X Index       Register (X)

                                                                                Y Index       Register (Y)

                                                                            Accumulator       (A or C)

                  0000 0000                                                      Direct       Page Register (D)

                  0000 0000                                                       Stack       Pointer (S)

            Program Bank (PBR)                                                 Program        Counter (PC)

                                                                                                              Status (P)




                                                                                          Instructions Using It:

                                                                                          RTI

                                                          Stack (RTI) Addressing
                                                        6502/65C02/Emulation Mode

                                                                 Stack
                                               after
                                                               PC High
                                                                                                             Program       Counter (PC)
                                                                PC Low
                  Stack     Pointer (S)
                                                               Status (P)                             Status (P)
                                               before
                                                                Bank 0



                                                        65802/65816 Native Mode


                                                                 Stack
                                           after
                                                          Program Bank (PBR)                      Program Bank (PBR)
                                                                PC High
                  Stack     Pointer (S)                                                                         Program       Counter (PC)
                                                                PC Low
                                                               Status (P)                                Status (P)
                                           before
                                                                Bank 0




                                                                                                                                              321
```

<!-- programmanual p322 -->

```
The Western Design Center

Stack (RTL) Addressing

Source Effective Address: Provided by Stack Pointer.

Destination of values to be pulled: First the Program Counter is pulled and incremented by one.
Then the Program Bank is pulled back.

Sample Syntax:
      RTL

  Instruction:
                     Opcode

  65816 Registers:
                      Bank                                  High                                          Low
  23                                    15                                          7                                          0
                 Data Bank (DBR)

                                                                          X Index        Register (X)

                                                                          Y Index        Register (Y)

                                                                      Accumulator        (A or C)

                   0000 0000                                               Direct        Page Register (D)

                   0000 0000                                                Stack        Pointer (S)

            Program Bank (PBR)                                           Program         Counter (PC)


                                                                                                        Status (P)




                                                      Stack (RTL) Addressing

                                                              Stack
                                             after
                                                       Program Bank (PBR)                     Program Bank (PBR)
                  Stack   Pointer (S)                        PC High
                                                                                    +1                       Program   Counter (PC)
                                                             PC Low
                                             before
                                                             Bank 0




                                                                                                                                      322
```

<!-- programmanual p323 -->

```
The Western Design Center

Stack (RTS) Addressing

Source Effective Address: Provided by Stack Pointer.

Destination of values to be pulled: The Program Counter is pulled and incremented by one. The
Program Bank remains unchanged.

Control is transferred to the new Program Counter value.

Sample Syntax:
      RTS

  Instruction:
                      Opcode

  65816 Registers:
                       Bank                      High                                        Low
  23                                15                                 7                                          0
                 Data Bank (DBR)

                                                             X Index       Register (X)

                                                             Y Index       Register (Y)

                                                         Accumulator       (A or C)

                    0000 0000                                 Direct       Page Register (D)

                    0000 0000                                  Stack       Pointer (S)

               Program Bank (PBR)                           Program        Counter (PC)

       Instruction Using It:
       RTS                                                                                 Status (P)




                                         Stack (RTS) Addressing


                                                Stack
                                    after
                                               PC High                                                  Counter
               Stack Pointer (S)                                  +1                     Program
                                    befor      PC Low                                                   (PC)
                                    e
                                                Bank 0




                                                                                                                      323
```

<!-- programmanual p324 -->

```
The Western Design Center

Stack Relative Addressing

Effective Address:
Bank:        Zero.

High/Low: The 16-bit sum of the 8-bit Operand and the 16-bit Stack Pointer.

Sample Syntax:
      LDA sr,S

                                                               Effective:
                                                               23               15          7         0
                                                                        Bank             High   Low

                                                                     00000000


 Instruction:
           Opcode         Operand


 65816 Registers:
           Bank             High                            Low
 23                  15                      7                           0
     Data Bank (DBR)


                                   X Index       Register (X)                        +


                                   Y Index       Register (Y)


                            Accumulator          (A or C)


        0000 0000                   Direct       Page Register (D)


        0000 0000                    Stack       Pointer (S)


    Program Bank (PBR)             Program       Counter (PC)


                                                       Status (P)




                                             Instruction Using It:

                                             Effective Address Locates Data
                                             ADC           CMP
                                             AND           EOR

                                             Note: All are 65802/65816 only.




                                                                                                          324
```

<!-- programmanual p325 -->

```
The Western Design Center

Stack Relative Indirect Indexed, Y Addressing

Effective Address: The Data Bank Register is concatenated to the Indirect Address; the 24-bit result
is added to Y (16 bits if 65802/65816 native mode, x = 0; else 8 bits).

Indirect Address: Located at the 16-bit sum of the 8-bit Operand and the 16-bit Stack Pointer.

Sample Syntax:
      LDA (sr,S),Y

                                                                         Effective Address:
                                                                         23                    15               7                     0
                                                                                   Bank             High                    Low

  Instruction:
            Opcode            Operand


  65816 Registers:
            Bank               High                             Low
  23                     15                      7                         0
      Data Bank (DBR)

                                                                                                            Stack
                                                                                                    High Indirect Address
                                      X Index        Register (X)                                                                 +
                                                                                          +1
                                                                                      +             Low Indirect Address
                                      Y Index        Register (Y)                                          Bank 0
                                                                               x-1                         Memory
                                                                               x-0
                               Accumulator           (A or C)


         0000 0000                      Direct       Page Register (D)


         0000 0000                      Stack        Pointer (S)


    Program Bank (PBR)             Program           Counter (PC)


                                                           Status (P)




                                                     Instructions Using It:

                                                     Effective Address Locates Data
                                                     ADC           CMP           LDA                                SBC
                                                     AND           EOR           ORA                                STA

                                                     Note: All are 65802/65816 only;
                                                     65802: Data bank value is not propagated to the bus
                                                     (bank accessed is always bank 0).




                                                                                                                                          325
```
