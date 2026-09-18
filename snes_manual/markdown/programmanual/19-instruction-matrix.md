# Chapter 19 — Instruction Lists (opcode matrix)

> ⚠ CROWN JEWEL: the complete 256-opcode matrix — the single best cross-check for the assembler's opcode→(mnemonic, addressing-mode) mapping and the safe-?? policy for undefined slots.

## Contents (per the book's own TOC)

- Processor legend (p434)
- Op Code Matrix Legend (p437)
- The 256-slot opcode matrix (opcode → mnemonic + addressing mode + bytes + cycles)

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

## Body (pages 424–469)


<!-- programmanual p424 -->

```
The Western Design Center


19) Chapter Nineteen
Instruction Lists
          Opcode                                            Available on:      # of       # of
    Hex     Mnemonic   Addressing Mode               6502   65C02 65802/816   Bytes     Cycles
    00      BRK        Stack/Interrupt                x        x          x     2**     79
    01      ORA        DP Indexed Indirect, X         x        x          x     2       61,2
    02      COP        Stack/Interrupt                                    x     2**     79
    03      ORA        Stack Relative                                     x     2       41
    04      TSB        Direct Page                             x          x     2       52,5
    05      ORA        Direct Page                    x        x          x     2       31,2
    06      ASL        Direct Page                    x        x          x     2       52,5
    07      ORA        DP Indirect Long                                   x     2       61,2
    08      PHP        Stack (Push)                   x        x          x     1       3
    09      ORA        Immediate                      x        x          x     2*      21
    0A      ASL        Accumulator                    x        x          x     1       2
    0B      PHD        Stack (Push)                                       x     1       4
    0C      TSB        Absolute                                x          x     3       65
    0D      ORA        Absolute                       x        x          x     3       41
    0E      ASL        Absolute                       x        x          x     3       65
    0F      ORA        Absolute Long                                      x     4       51
    10      BLP        Program Counter Relative       x        x          x     2       27,8
    11      ORA        DP Indirect Indexed, Y         x        x          x     2       51,2,3
    12      ORA        DP Indirect                             x          x     2       51,2
    13      ORA        SR Indirect Indexed, Y                             x     2       71
    14      TRB        Direct Page                             x          x     2       52,5
    15      ORA        DP Indexed, X                  x        x          x     2       41,2
    16      ASL        DP Indexed, X                  x        x          x     2       62,5
    17      ORA        DP Indirect Long Indexed, Y                        x     2       61,2
    18      CLC        Implied                        x        x          x     1       2
    19      ORA        Absolute Indexed, Y            x        x          x     3       41,3
    1A      INC        Accumulator                             x          x     1       2
    1B      TCS        Implied                                            x     1       2
    1C      TRB        Absolute                                x          x     3       65
    1D      ORA        Absolute Indexed, X            x        x          x     3       41,3
    1E      ASL        Absolute Indexed, X            x        x          x     3       75,6
    1F      ORA        Absolute Long Indexed, X                           x     4       51
    20      JSR        Absolute                       x        x          x     3       6
    21      AND        DP Indexed Indirect, X         x        x          x     2       61,2
    22      JSR        Absolute Long                                      x     4       8
    23      AND        Stack Relative                                     x     2       41
    24      BIT        Direct Page                    x        x          x     2       31,2
    25      AND        Direct Page                    x        x          x     2       31,2
    26      ROL        Direct Page                    x        x          x     2       52,5
    27      AND        DP Indirect Long                                   x     2       61,2
    28      PLP        Stack (Pull)                   x        x          x     1       4
    29      AND        Immediate                      x        x          x     2*      21
    2A      ROL        Accumulator                    x        x          x     1       2
    2B      PLD        Stack (Pull)                                       x     1       5
    2C      BIT        Absolute                       x        x          x     3       41
    2D      AND        Absolute                       x        x          x     3       41
                                                                                      Continued.




                                                                                                   424
```

<!-- programmanual p425 -->

```
The Western Design Center

           Opcode                                           Available on:      # of       # of
     Hex    Mnemonic   Addressing Mode               6502   65C02 65802/816   Bytes     Cycles
     2E     ROL        Absolute                       x        x          x     3       65
     2F     AND        Absolute Long                                      x     4       51
     30     BMI        Program Counter Relative       x        x          x     2       27,8
     31     AND        DP Indirect Indexed, Y         x        x          x     2       51,2,3
     32     AND        DP Indirect                             x          x     2       51,2
     33     AND        SR Indirect Indexed, Y                             x     2       71
     34     BIT        DP Indexed, X                           x          x     2       41,2
     35     AND        DP Indexed, X                  x        x          x     2       41,2
     36     ROL        DP Indexed, X                  x        x          x     2       62,5
     37     AND        DP Indirect Long Indexed, Y                        x     2       61,2
     38     SEC        Implied                        x        x          x     1       2
     39     AND        Absolute Indexed, Y            x        x          x     3       41,3
     3A     DEC        Accumulator                             x          x     1       2
     3B     TSC        Implied                                            x     1       2
     3C     BIT        Absolute Indexed, X                     x          x     3       41,3
     3D     AND        Absolute Indexed, X            x        x          x     3       41,3
     3E     ROL        Absolute Indexed, x            x        x          x     3       75,6
     3F     AND        Absolute Long Indexed, X                           x     4       51
     40     RTI        Stack/RTI                      x        x          x     1       69
     41     EOR        DP Indexed Indirect, X         x        x          x     2       61,2
     42     WDM                                                           x     216     16

     43     EOR        Stack Relative                                     x     2       41
                                                                                        13
     44     MVP        Block Move                                         x     3
     45     EOR        Direct Page                    x        x          x     2       31,2
     46     LSR        Direct Page                    x        x          x     2       52,5
     47     EOR        DP Indirect Long                                   x     2       61,2
     48     PHA        Stack (Push)                   x        x          x     1       31
     49     EOR        Immediate                      x        x          x     2*      21
     4A     LSR        Accumulator                    x        x          x     1       2
     4B     PHK        Stack (Push)                                       x     1       3
     4C     JMP        Absolute                       x        x          x     3       3
     4D     EOR        Absolute                       x        x          x     3       41
     4E     LSR        Absolute                       x        x          x     3       65
     4F     EOR        Absolute Long                                      x     4       51
     50     BVC        Program Counter Relative       x        x          x     2       27,8
     51     EOR        DP Indirect Indexed, Y         x        x          x     2       51,2,3,
     52     EOR        DP Indirect                             x          x     2       51,2
     53     EOR        SR Indirect Indexed, Y                             x     2       71
                                                                                        13
     54     MVN        Block Move                                         x     3
     55     EOR        DP Indexed, X                  x        x          x     2       41,2
     56     LSR        DP Indexed, X                  x        x          x     2       62,5
     57     EOR        DP Indirect Long Indexed, Y                        x     2       61,2
     58     CLI        Implied                        x        x          x     1       2
     59     EOR        Absolute Indexed, Y            x        x          x     3       41,3
     5A     PHY        Stack (Push)                            x          x     1       310
     5B     TCD        Implied                                            x     1       2
     5C     JMP        Absolute Long                                      x     4       4
     5D     EOR        Absolute Indexed, X            x        x          x     3       41,3
     5E     LSR        Absolute Indexed, X            x        x          x     3       75,6
     5F     EOR        Absolute Long Indexed, X                           x     4       51
                                                                                      Continued.




                                                                                                   425
```

<!-- programmanual p426 -->

```
The Western Design Center

           Opcode                                             Available on:      # of       # of
     Hex    Mnemonic   Addressing Mode                 6502   65C02 65802/816   Bytes     Cycles
     60     RTS        Stack (RTS)                      x        x          x     1       6
     61     ADC        DP Indexed Indirect, X           x        x          x     2       61,2,4
     62     PER        Stack (PC Relative Long)                             x     3       6
     63     ADC        Stack Relative                                       x     2       41,4
     64     STZ        Direct Page                               x          x     2       31,2
     65     ADC        Direct Page                      x        x          x     2       31,2,4
     66     ROR        Direct Page                      x        x          x     2       52,5
     67     ADC        DP Indirect Long                                     x     2       61,2,4
     68     PLA        Stack (Pull)                     x        x          x     1       41
     69     ADC        Immediate                        x        x          x     2*      21,4
     6A     ROR        Accumulator                      x        x          x     1       2
     6B     RTL        Stack (RTL)                                          x     1       6
     6C     JMP        Absolute Indirect                x        x          x     3       511,12
     6D     ADC        Absolute                         x        x          x     3       41,4
     6E     ROR        Absolute                         x        x          x     3       65
     6F     ADC        Absolute Long                                        x     4       51,4
     70     BVS        Program Counter Relative         x        x          x     2       27,8
     71     ADC        DP Indirect Indexed, Y           x        x          x     2       51,2,3,4
     72     ADC        DP Indirect                               x          x     2       51,2,4
     73     ADC        SR Indirect Indexed, Y                               x     2       71,4
     74     STZ        Direct Page Indexed, X                    x          x     2       41,2
     75     ADC        DP Indexed, X                    x        x          x     2       41,2,4
     76     ROR        DP Indexed, X                    x        x          x     2       62,5
     77     ADC        DP Indirect Long Indexed, Y                          x     2       61,2,4
     78     SEI        Implied                          x        x          x     1       2
     79     ADC        Absolute Indexed, Y              x        x          x     3       41,3,4
     7A     PLY        Stack/Pull                                x          x     1       410
     7B     TDC        Implied                                              x     1       2
     7C     JMP        Absolute Indexed Indirect                 x          x     3       6
     7D     ADC        Absolute Indexed, X              x        x          x     3       41,3,4
     7E     ROR        Absolute Indexed, X              x        x          x     3       75,6
     7F     ADC        Absolute Long Indexed, X                             x     4       51,4
     80     BRA        Program Counter Relative                  x          x     2       38
     81     STA        DP Indexed Indirect, X           x        x          x     2       61,2
     82     BRL        Program Counter Relative Long                        x     3       4
     83     STA        Stack Relative                                       x     2       41
     84     STY        Direct Page                      x        x          x     2       32,10
     85     STA        Direct Page                      x        x          x     2       31,2
     86     STX        Direct Page                      x        x          x     2       32,10
     87     STA        DP Indirect Long                                     x     2       61,2
     88     DEY        Implied                          x        x          x     1       2
     89     BIT        Immediate                                 x          x     2*      21
     8A     TXA        Implied                          x        x          x     1       2
     8B     PHB        Stack (Push)                                         x     1       3
     8C     STY        Absolute                         x        x          x     3       410
     8D     STA        Absolute                         x        x          x     3       41
     8E     STX        Absolute                         x        x          x     3       410
     8F     STA        Absolute Long                                        x     4       51
     90     BCC        Program Counter Relative         x        x          x     2       27,8
     91     STA        DP Indirect Indexed, Y           x        x          x     2       61,2
                                                                                        Continued.




                                                                                                     426
```

<!-- programmanual p427 -->

```
The Western Design Center

           Opcode                                           Available on:      # of       # of
     Hex    Mnemonic   Addressing Mode               6502   65C02 65802/816   Bytes     Cycles
     92     STA        DP Indirect                             x          x     2       51,2
     93     STA        SR Indirect Indexed, Y                             x     2       71
     94     STY        Direct Page Indexed, X         x        x          x     2       42,10
     95     STA        DP Indexed, X                  x        x          x     2       41,2
     96     STX        Direct Page Indexed, Y         x        x          x     2       42,10
     97     STA        DP Indirect Long Indexed, Y                        x     2       61,2
     98     TYA        Implied                        x        x          x     1       2
     99     STA        Absolute Indexed, Y            x        x          x     3       51
     9A     TXS        Implied                        x        x          x     1       2
     9B     TXY        Implied                                            x     1       2
     9C     STZ        Absolute                                x          x     3       41
     9D     STA        Absolute Indexed, X            x        x          x     3       51
     9E     STZ        Absolute Indexed, X                     x          x     3       51
     9F     STA        Absolute Long Indexed, X                           x     4       51
     A0     LDY        Immediate                      x        x          x     2+      210
     A1     LDA        DP Indexed Indirect, X         x        x          x     2       61,2
     A2     LDX        Immediate                      x        x          x     2+      210
     A3     LDA        Stack Relative                                     x     2       41
     A4     LDY        Direct Page                    x        x          x     2       32,10
     A5     LDA        Direct Page                    x        x          x     2       31,2
     A6     LDX        Direct Page                    x        x          x     2       32,10
     A7     LDA        DP Indirect Long                                   x     2       61,2
     A8     TAY        Implied                        x        x          x     1       2
     A9     LDA        Immediate                      x        x          x     2*      21
     AA     TAX        Implied                        x        x          x     1       2
     AB     PLB        Stack (Pull)                                       x     1       4
     AC     LDY        Absolute                       x        x          x     3       410
     AD     LDA        Absolute                       x        x          x     3       41
     AE     LDX        Absolute                       x        x          x     3       410
     AF     LDA        Absolute Long                                      x     4       51
     B0     BCS        Program Counter Relative       x        x          x     2       27,8
     B1     LDA        DP Indirect Indexed, Y         x        x          x     2       51,2,3
     B2     LDA        DP Indirect                             x          x     2       51,2
     B3     LDA        SR Indirect Indexed, Y                             x     2       71
     B4     LDY        DP Indexed, X                  x        x          x     2       42,10
     B5     LDA        DP Indexed, X                  x        x          x     2       41,2
     B6     LDX        DP Indexed, Y                  x        x          x     2       42,10
     B7     LDA        DP Indirect Long Indexed, Y                        x     2       61,2
     B8     CLV        Implied                        x        x          x     1       2
     B9     LDA        Absolute Indexed, Y            x        x          x     3       41,3
     BA     TSX        Implied                        x        x          x     1       2
     BB     TYX        Implied                                            x     1       2
     BC     LDY        Absolute Indexed, X            x        x          x     3       43,10
     BD     LDA        Absolute Indexed, X            x        x          x     3       41,3
     BE     LDX        Absolute Indexed, Y            x        x          x     3       43,10
     BF     LDA        Absolute Long Indexed, X                           x     4       51
     C0     CPY        Immediate                      x        x          x     2+      210
     C1     CMP        DP Indexed Indirect, X         x        x          x     2       61,2
     C2     REP        Immediate                                          x     2       3
     C3     CMP        Stack Relative                                     x     2       41
                                                                                      Continued.




                                                                                                   427
```

<!-- programmanual p428 -->

```
The Western Design Center

           Opcode                                            Available on:      # of       # of
     Hex    Mnemonic   Addressing Mode                6502   65C02 65802/816   Bytes     Cycles
     C4     CPY        Direct Page                     x        x          x     2       32,10
     C5     CMP        Direct Page                     x        x          x     2       31,2
     C6     DEC        Direct Page                     x        x          x     2       52,5
     C7     CMP        DP Indirect Long                                    x     2       61,2
     C8     INY        Implied                         x        x          x     1       2
     C9     CMP        Immediate                       x        x          x     2*      21
     CA     DEX        Implied                         x        x          x     1       2
     CB     WAI        Implied                                             x     1       315
     CC     CPY        Absolute                        x        x          x     3       410
     CD     CMP        Absolute                        x        x          x     3       41
     CE     DEC        Absolute                        x        x          x     3       65
     CF     CMP        Absolute Long                                       x     4       51
     D0     BNE        Program Counter Relative        x        x          x     2       27,8
     D1     CMP        DP Indirect Indexed, Y          x        x          x     2       51,2,3
     D2     CMP        DP Indirect                              x          x     2       51,2
     D3     CMP        SR Indirect Indexed, Y                              x     2       71
     D4     PEI        Stack (Direct Page Indirect)                        x     2       62
     D5     CMP        DP Indexed, X                   x        x          x     2       41,2
     D6     DEC        DP Indexed, X                   x        x          x     2       62,5
     D7     CMP        DP Indirect Long Indexed, Y                         x     2       61,2
     D8     CLD        Implied                         x        x          x     1       2
     D9     CMP        Absolute Indexed, Y             x        x          x     3       41,3
     DA     PHX        Stack (Push)                             x          x     1       310
     DB     STP        Implied                                             x     1       314
     DC     JMP        Absolute Indirect Long                              x     3       6
     DD     CMP        Absolute Indexed, X             x        x          x     3       41,3
     DE     DEC        Absolute Indexed, X             x        x          x     3       75,6
     DF     CMP        Absolute Long Indexed, X                            x     4       51
     E0     CPX        Immediate                       x        x          x     2+      210
     E1     SBC        DP Indexed Indirect, X          x        x          x     2       61,2,4
     E2     CPX        Immediate                                           x     2       3,
     E3     SBC        Stack Relative                                      x     2       41,4
     E4     INX        Direct Page                     x        x          x     2       32,10
     E5     SBC        Direct Page                     x        x          x     2       31,2,4
     E6     INC        Direct Page                     x        x          x     2       52,5
     E7     SBC        DP Indirect Long                                    x     2       61,2,4
     E8     INX        Implied                         x        x          x     1       2
     E9     SBC        Immediate                       x        x          x     2*      21,4
     EA     NOP        Implied                         x        x          x     1       2
     EB     XBA        Implied                                             x     1       3
     EC     CPX        Absolute                        x        x          x     3       410
     ED     SBC        Absolute                        x        x          x     3       41,4
     EE     INC        Absolute                        x        x          x     3       65
     EF     SBC        Absolute Long                                       x     4       51.4
     F0     BEQ        Program Counter Relative        x        x          x     2       27.8
     F1     SBC        DP Indirect Indexed, Y          x        x          x     2       51.2.3.4
     F2     SBC        DP Indirect                              x          x     2       51.2.4
     F3     SBC        SR Indirect Indexed, Y                              x     2       71,4
     F4     PEA        Stack (absolute)                                    x     3       5
     F5     SBC        DP Indexed, X                   x        x          x     2       41,2,4
                                                                                       Continued.




                                                                                                    428
```

<!-- programmanual p429 -->

```
The Western Design Center

             Opcode                                                      Available on:                # of   # of
        Hex Mnemonic Addressing Mode                            6502 65C02          65802/816        Bytes Cycles
        F6     INC          DP Indexed, X                         x         x           x              2   62,5
        F7     SBC          DP Indirect Long Indexed, Y                                 x              2   61,2,4
        F8     SED          Implied                               x         x           x              1   2
        F9     SBC          Absolute Indexed, Y                   x         x           x              3   41,3,4
        FA PLX              Stack /Pull                                     x           x              1   410
        FB XCE              Implied                                                     x              1   2
        FC JSR              Absolute Indexed Indirect                                   x              3   8
        FD SBC              Absolute Indexed, X                   x         x           x              3   41,3,4
        FE     INC          Absolute Indexed, X                   x         x           x              3   75,6
        FF     SBC          Absolute Long Indexed, X                                    x              4   51,4
+
     Add 1 byte if m=0 (16-bit memory/accumulator)
++
     opcode is 1 byte, but program counter value pushed onto stack is incremented by 2 allowing for optional
    signature byte
+ Add 1 byte if x=0 (16-bit index register)
1.
     Add 1 cycle if m=0 (16-bit memory/accumulator)
2.
     Add 1 cycle if low byte of Direct Page register is other than zero (DL< >0)
3.
     Add 1 cycle if adding index crosses a page boundary
4.
     Add 1 cycle if 65C02 and d=1 (decimal mode, 65C02)
5.
     Add 2 cycles if m=0 (16-bit memory/accumulator)
6.
     Subtract 1 cycle if 65C02 and no page boundary crossed
7.
     Add 1 cycle if branch is taken
8.
     Add 1 more cycle if branch taken crosses page boundary on 6502, 65C02, or 65816/65802’s 6502 emulation mode
     (e=1)
9.
     Add 1 cycle for 65802/65816 native mode (e=0)
10.
     Add 1 cycle if x=0 (16-bit index register)
11.
     Add 1 cycle if 65C02
12.
     6502: If low byte of operand is $FF (i.e., operand is $xxFF): yields incorrect result
13.
     7 cycles per byte moved
14.
     Uses 3 cycles to shut the processor down; additional cycles are required by reset to restart it
15.
     Uses 3 cycles to shut the processor down; additional cycles are required by interrupt to restart it
16.
     Bytes and cycle counts subject to change in future processors which expand WDM into 2-byte opcode portions of
     instructions of varying lengths.




                                                                                                              429
```

<!-- programmanual p430 -->

```
The Western Design Center




                            430
```

<!-- programmanual p431 -->

```
The Western Design Center




                            431
```

<!-- programmanual p432 -->

```
The Western Design Center




                            432
```

<!-- programmanual p433 -->

```
The Western Design Center




                            433
```

<!-- programmanual p434 -->

```
The Western Design Center

Processor
„Opcode or instruction first introduced on the 65C02
j Opcode or instruction first introduced on the 65816/65802
   (not marked: first introduced on the NMOS 6502)

Addressing mode box:

        Immediate       Addressing Mode
         # const        Assembler operand syntax
  1        ~        #
                        Number of bytes
                        Number of cycles
                        Key to detailed instruction operation chart (see Appendix E: 65816 Data Sheet)

Operation column:
A        Accumulator
X        Index register X
Y        Index register Y
M        Contents of memory location specified by effective address
M(d)     Contents of direct page memory location pointed to by operand
M(s)     Contents of memory location pointed to by stack pointer
M(pc)    Current opcode pointed to by the program counter
PC       Memory location of current opcode pointed to by the program counter
rl       Two-byte operand of relative long addressing mode instruction
+        Add
-        Subtract
∧        And
∨        Or
∨        Exclusive Or
         Logical complement of a value or status bit (A indicates the complement of the value in the
         accumulator)
o2       Phase 2 clock (hardware signal)
RDY      Ready (hardware signal)




                                                                                                         434
```

<!-- programmanual p435 -->

```
The Western Design Center

Bytes, cycles, and status codes:
*
       Add 1 byte if M = 0 (16-bit memory/accumulator)
**
       opcode is one byte, but program counter value pushed onto stack is incremented by 2 allowing for
       optional signature byte
+      Add 1 byte if x = 0 (16-bit index registers)
n      number of bytes moved
1
       Add 1 cycle if m = 0 (16-bit memory/accumulator)
2
       Add 1 cycle if low byte of Direct Page register is other than zero (DL< >0)
3
       Add 1 cycle if adding index crosses a page boundary
4
       Add 1 cycle if 65C02 and d = 1 (decimal mode, 65C02)
5
       Add 2 cycles if m = 0 (16-bit memory/accumulator)
6
       Subtract 1 cycle if 65C02 and no page boundary crossed
7
       Add 1 cycle if branch is taken
8
       Add 1 more cycle if branch taken crosses page boundary on 6502, 655C02, or 65816/65802’s 6502
       emulation mode (e = 1)
9
       Add 1 cycle for 65802/65816 native mode (e = 0)
10
       Add 1 cycle if x = 0 (16-bit index registers)
11
       Add 1 cycle if 65C02
12
       6502: If low byte of addr is $FF (i.e., addr is $xxFF): yields incorrect result
13
       7 cycles per byte moved
14
       Uses 3 cycles to shut the processor down; additional cycles are required by reset to restart it
15
       Uses 3 cycles to shut the processor down; additional cycles are required by interrupt to restart it
16
       Bytes and cycle counts subject to change in future processors which expand WDM into 2-byte opcode
       portions of instructions of varying lengths
17
       BIT: immediate n and v flags not affected; if m = 0, m(15) → n and M(14) → V; if m = 1, m(7) → n
       and M(6) → v
18
       BRK: if b = 1 in pushed status register (6502, 65C02 and emulation mode e = 1), then interrupt was
       caused by software BRK:
       if 6502, d is unaffected by BRK; if 65C02 or 65816/65802, d is 0 after BRK




                                                                                                      435
```

<!-- programmanual p436 -->

```
The Western Design Center




                            436
```

<!-- programmanual p437 -->

```
The Western Design Center



Op Code Matrix Legend

         INSTRUCTION                                                           ADDRESSING
          MNEMONIC                      « = New W65C816/802 Opcodes              MODE
                                        l = New W65C02 Opcodes
             BASE                       Blank = NMOS 6502 Opcodes                 BASE
          NO. BYTES                                                            NO CYCLES




       symbol     addressing mode                  symbol      addressing mode
       #          immediate                        [d]         direct indirect long
       A          accumulator                      [d],y       direct indirect long indexed
       r          program counter relative         a           absolute
       rl         program counter relative long    a,x         absolute indexed (with x)
       i          implied                          a,y         absolute indexed (with y)
       s          stack                            al          absolute long
       d          direct                           al,x        absolute long indexed
       d,x        direct indexed (with x)          d,s         stack relative
       d,y        direct indexed (with y)          (d,s),y     stack relative indirect indexed
       (d)        direct indirect                  (a)         absolute indirect
       (d,x)      direct indexed indirect          (a,x)       absolute indexed indirect
       (d),y      direct indirect indexed          xyc         block move




                                                                                                 437
```

<!-- programmanual p438 -->

```
The Western Design Center

accumulators, 19            BASIC, 19
address, 12                 Binary arithmetic, 19
AND, 15                     binary digit, 11
arithmetic., 19             binary-coded decimal, 11, 18
   multiple-precision, 19   bit, 11
ASCII, 11, 14               bitwise, 15
assembler, 19               branch, 23
assembler directives, 21       conditional, 23
Assembly Language, 21       macro assemblers, 21
back space, 14              number systems, 11




                                                           438
```

<!-- programmanual p439 -->

```
Western Design Center
                                                                         Table of Contents
                                                                           Appendices
A. 65x Signal Description ........................................................................4
   6502 Signals .............................................................................................................................................................................. 6
     Address Bus ........................................................................................................................................................................... 6
     Clock Signals ......................................................................................................................................................................... 6
     Data Bus................................................................................................................................................................................. 6
     Data Bus Enable ..................................................................................................................................................................... 6
     Read/Write ............................................................................................................................................................................. 6
     Ready ..................................................................................................................................................................................... 6
     Interrupt Request .................................................................................................................................................................... 6
     Sync ....................................................................................................................................................................................... 7
     Reset ...................................................................................................................................................................................... 7
   65C02 Signals ........................................................................................................................................................................... 7
     Memory Lock......................................................................................................................................................................... 7
     Notes...................................................................................................................................................................................... 7
   65802 Signals ............................................................................................................................................................................ 7
   65816 Signals ............................................................................................................................................................................ 7
     Bank Address ......................................................................................................................................................................... 8
     Vector Pull ............................................................................................................................................................................. 8
     Abort...................................................................................................................................................................................... 8
     Valid Program Address and Valid Data Address...................................................................................................................... 8
     Memory and Index ................................................................................................................................................................. 8
     Emulation............................................................................................................................................................................... 9
     Bus Enable ............................................................................................................................................................................. 9
B. 65x Series Support Chips ..................................................................10
     The 6551 Serial Chip............................................................................................................................................................ 10
   STATUS.................................................................................................................................................................................. 11
     COMMAND REGISTER ..................................................................................................................................................... 12
   BIT .......................................................................................................................................................................................... 12
   OPERATION........................................................................................................................................................................... 12
     The 6521 Parallel Chip ......................................................................................................................................................... 15
C. The Rockwell 65C02 .........................................................................18
   BBR ........................................................................................................................................................................................ 19
     Branch on Bit Reset .............................................................................................................................................................. 19
   BBS ......................................................................................................................................................................................... 20
     Branch on Bit Set ................................................................................................................................................................. 20
   RMB ....................................................................................................................................................................................... 21
   Reset Memory Bit................................................................................................................................................................... 21
   SMB ........................................................................................................................................................................................ 22
   Set Memory Bit....................................................................................................................................................................... 22
D. Instruction Groups ............................................................................23
   Group I Instructions............................................................................................................................................................... 23
   Group II Instructions ............................................................................................................................................................. 24
    Loading the Index Registers.................................................................................................................................................. 25
    Index Register Compares ...................................................................................................................................................... 25
    Test-and-Change-Bits Instructions ........................................................................................................................................ 25
E. The ASCII Character Set.................................................................26
                                                                          Table of Figures
Figure A-1 65x Pinouts ................................................................................................................................................................. 5
Figure B-1. 6551 Status Register .................................................................................................................................................. 11
Figure B-2. 6551 Control Register................................................................................................................................................ 12
Figure B-3Control Register .......................................................................................................................................................... 13
                                                                                                                                                                                         1
```

<!-- programmanual p440 -->

```
Western Design Center


                                                                     Table of Tables
Table D-1 Group I Instructions Opcode Patterns .......................................................................................................................... 23
Table D-2 Address Mode Patterns for Group I Instructions .......................................................................................................... 23
Table D-3 65802/65816 Group I Addressing Mode Patterns......................................................................................................... 23
Table D-4 Group II Opcode Patterns............................................................................................................................................ 24
Table D-5 Address Mode Patterns for Group II Instruction .......................................................................................................... 24
Table D-6 Address Mode Patterns for Load Index Register Instruction......................................................................................... 25
Table D-7 Address Mode Patterns for Compare Index Register Instructions ................................................................................. 25




                                                                                                                                                                               2
```

<!-- programmanual p441 -->

```
Western Design Center




                        Appendices




                                     3
```

<!-- programmanual p442 -->

```
Western Design Center



A. 65x Signal Description
        The four standard 65x parts considered in this book – the 6502, 65C02, 65802, and 65816 – are each housed in
a 40-pin dual in-line package. There are also a number of special versions of the basic parts, versions with external
clocks, fewer address pins, one-chip computers with on-board RAM and ROM, and with quadrature clocks. These are
not considered here; refer to the appropriate manufacturer’s literature for details about these special chips.
        This appendix describes the pin signals found on the four standard parts – the pins that connect the processor to
the external system. Many of them are common to all processors, some are unique to each.
        The descriptions are meant to satisfy the programmer with a general interest in the system implementation; the
engineer implementing a 65x system should consult the manufacturer’s data sheets for more detailed information.
        To begin with, refer to Figure A.1, which illustrates the pin configurations of the four different processors.




                                                                                                                       4
```

<!-- programmanual p443 -->

```
Western Design Center



              VSS    1              40     RESB         VSS       1               40   RESB
              RDY    2              39     PHI2O        RDY       2               39   PHI2O
            PHI1O    3              38     SOB        PHI1O       3               38   SOB
             IRQB    4              37     PHI2I       IRQB       4               37   PHI2I
               NC    5              36     NC           MLB       5               36   NC
            NMIB     6              35     NC         NMIB        6               35   NC
            SYNC     7              34     RWB        SYNC        7               34   RWB
              VDD    8              33     D0           VDD       8               33   D0
                A0   9              32     D1             A0      9               32   D1
                A1   10             31     D2             A1      10              31   D2
                A2   11             30     D3             A2      11              30   D3
                A3   12     6502    29     D4             A3      12    65C02     29   D4
                A4   13             28     D5             A4      13              28   D5
                A5   14             27     D6             A5      14              27   D6
                A6   15             26     D7                                     26   D7
                                                          A6      15
                A7   16             25     A15                                    25   A15
                                                          A7      16
                A8   17             24     A14                                    24   A14
                                                          A8      17
                A9   18             23     A13                                    23   A13
                                                          A9      18
               A10   19             22     A12                                    22   A12
                                                         A10      19
               A11   20             21     VSS                                    21   VSS
                                                         A11      20




            VPB      1              40     RESB           VSS      1                40   RESB
            RDY      2              39     VDA            RDY      2                39   PHI2O
         ABORTB      3              38     M/X          PHI1O      3                38   SOB
           IRQB      4              37     PHI2I         IRQB      4                37   PHI2I
            MLB      5              36     BE              NC      5                36   NC
           NMIB      6              35     E            NMIB       6                35   NC
            VPA      7              34     RWB          SYNC       7                34   RWB
            VDD      8              33     D0/BA0         VDD      8                33   D0
                          W65C816                                       W65C802
              A0     9              32     D1/BA1           A0     9                32   D1
              A1     10             31     D2/BA2           A1     10               31   D2
              A2     11             30     D3/BA3           A2     11               30   D3
              A3     12             29     D4/BA4           A3     12               29   D4
              A4     13             28     D5/BA5           A4     13               28   D5
              A5     14             27     D6/BA6           A5     14               27   D6
              A6     15             26     D7/BA7           A6     15               26   D7
              A7     16             25     A15              A7     16               25   A15
              A8     17             24     A14              A8     17               24   A14
              A9     18             23     A13              A9     18               23   A13
             A10     19             22     A12             A10     19               22   A12
             A11     20             21     VSS             A11     20               21   VSS


                                         Figure A-1 65x Pinouts




                                                                                                 5
```

<!-- programmanual p444 -->

```
Western Design Center

6502 Signals
         The 6502 defines the basic set of signals.

         Address Bus

         Pins A0 – A15 are the address lines. Every time an address is generated – opcodes fetch, operand read, intermediate
address, or effective address of a read or write operation – the binary value of the address appears on these pins, A0 representing the
low-order bit of the address, and A15 representing the high-order bit. These outputs are TTL compatible.

         Clock Signals

         All of the 65x series processors operate on a two-phase external cycle; a 65, processor’s frequency, expressed in
Megahertz, or millions of cycles per second, is also its memory-access cycle time. The 6502 has an internal clock generator based
on the phase zero input signal, a time base typically provided by a crystal oscillator. The two output signals, phase one and phase
two, are derived from this signal. Phase one goes high when phase zero is low; phase two goes low on the rising edge of phase one.

         Data Bus

       Pins D0-D7 are the data lines; these eight pins form a bi-directional data bus to read and write data between the processor
and memory and the peripheral devices. Like the address lines, the outputs can drive one standard TTL load.

         Data Bus Enable

         This controls the three-state output buffers of the processors; it normally is enabled by the phase two output, effectively
disabling the output buffers during phase one; this frees the bus for access by other devices during phase one. By pulling DBE low,
the buffers may be disabled externally.

         Read/Write

        R/W’ is high when data is being read from memory or peripherals into the processor, low when the processor is writing
data. When in the low state, data and address lines have valid data and addresses.

         Ready

         The RDY signal enables the processor to be single-stepped on all cycles except write cycles. When enabled during phase
one, the processor is halted and the address lines maintain the current address; this lets the processor interface with lower-speed
read-only memory devices, and can also be used in direct memory access implementations.

         Interrupt Request

          The IRQ’ signal requests that an interrupt-service cycle be initiated. This signal is connected to peripheral devices that are
designed to be interrupt-driven. This is the maskable interrupt signal, so the interrupt disable flag in the status register must be zero
for the interrupt to be effective. The RDY signal must be high for an interrupt to be recognized. IRQ’ is sampled during phase 2.

         Non-maskable Interrupt

        NMI’ is basically identical to IRQ’, except that it causes an unconditional interrupt when it is asserted, and
control vectors through the NMI’ vector rather than IRQ’.




                                                                                                                                       6
```

<!-- programmanual p445 -->

```
Western Design Center

         Set Overflow

         When this line goes low on the trailing edge of phase one, the overflow flag in the processor status register is set.

         Sync

        This line goes high during phase one of those cycles that are opcode fetches. When used with the RDY signal, this allows
hardware implementation of a single-step debugging capability.

         Reset

         RESET’ reinitializes the processor, either at power-up or to restart the system from a known state. RESET’ must be held
low for at least two cycles after a power down. When it is asserted, an interrupt-like service routine begins (although the status and
program counter are not stacked), with the result that control is transferred through the RESET’ vector.

65C02 Signals
         The 65C02 pinout is identical to the 6502, with the exception of memory lock and notes described below.

         Memory Lock

         The ML’ output signal assures the integrity of read-modify-write instructions by signaling other devices, for example,
other processors in a multiprocessor environment, that the bus may not be claimed until completion of the read-modify-write
operation. This signal goes low during the execution of the memory-referencing (non-register operand) ASL, DEC, INC, LSR,
ROL, ROR, TRB, and TSB instructions.

         Notes

         The 65C02, unlike the 6502, responds to RDY during a write cycle as well as a read, halting the processor.
         Response of the 65C02 to a reset is different from the 6502 in that the 65C02’s program counter and status register are
written to the stack. Additionally, the 65C02 decimal flag is cleared after reset or interrupt; its value is indeterminate after reset and
not modified after interrupt on the 6502.
         When an interrupt occurs immediately after the fetch of a BRK instruction on the 6502, the BRK is ignored; on the 65C02,
the BRK is executed, then the interrupt is executed.
         Finally, the 65C02 R/W’ line is high during the modify (internal operation) cycle of the read-modify-write operations; on
the 6502, it is low.


65802 Signals

          The 65802 signals are by definition 6502 pin-compatible. The 65C02 ML’ (memory lock) signal is not on the standard pin-
out, although it is available as a special-order mask option. Like the 6502, and unlike the 65C02, the 65802 does not write to the
stack during a reset.
          Some of the enhancement of the 65C02 are available on the 65802 in the native mode, while in emulation mode the system
behaves as a 6502. R/W’ is low during the modify cycle of read-modify-write cycles in the emulation mode; high in the native
mode.

65816 Signals
         Most of the signals behave as on the 65802, with the following additions and changes:




                                                                                                                                        7
```

<!-- programmanual p446 -->

```
Western Design Center

         Bank Address

        The most important difference on the 65816 is the multiplexing of the bank address (BA0-BA7) with the data pins (D0-
D7). During phase two low, the bank address is valid; during phase two high, data is read or written on the same pins. The bank
address must be latched during phase one to provide a valid twenty-four bit address when concatenated with A0-A15.

         Vector Pull
         The VP’ signal is asserted whenever any of the vector addresses ($00:FFE4-FFEF, $00:FFF4-FFFF) are being accessed as
part of an interrupt-type service cycle. This lets external hardware modify the interrupt vector, eliminating the need for software
polling for interrupt sources.

         Abort

          The ABORT’ input pin, when it is asserted, causes the current instruction to be aborted. Unlike an interrupt, none of the
registers are updated and the instruction quits execution from the cycle where the ABORT’ signal was received. No registers are
modified. In other words, the processor is left in the state it was in before the instruction that was aborted. Control is shifted to the
ABORT’ vector after an interrupt-like context-saving cycle.
          The ABORT’ signal lets external hardware abort instructions on the basis of undesirable address bus conditions; memory
protection and page virtual memory systems can be fully implemented using this signal.
          ABORT’ should be held low for only one cycle; if held low during the ABORT interrupt sequence, the ABORT interrupt
will be aborted.

         Valid Program Address and Valid Data Address

          The VPA and VDA signals extend the concept of the SYNC signal. Together, these two pins encode one of four possible
internal processor states, based on the type of memory being accessed:

               VPA               VDA
               0                 0                   -Internal operation
               0                 1                   -Valid program address
               1                 0                   -Valid data address
               1                 1                   -Opcode fetch

         During internal operations, the output buffers may be disabled by external logic, making address bus available for
transparent direct memory access. Also, since the 65816 sometimes generates a false read during instructions that cross page
boundaries, these may be trapped via these two signals if this is desirable. Note, however, that addresses should not be qualified in
emulation mode if hardware such as the Apple II disk controller is used, which requires false read to operate.
         The other states may be used for virtual memory implementation and high-speed data or instruction cache control. VPA
and VDA high together are equivalent to the 6502 SYNC output.

         Memory and Index

         These two signals are multiplexed on pin 38. M is available during phase zero, X during phase one. These signals reflect
the contents of the status register m and x flags, allowing (along with E described below) external logic to fully decode opcode
fetches.
         As a mask option, the 65816 may be specified with the 6502 SET OVERFLOW signal instead of the M/X signal.
         M and X are invalid for the instruction cycle following the REP, SEP, and PLP instruction execution; this cycle is the
opcode fetch cycle of the next instruction.




                                                                                                                                       8
```

<!-- programmanual p447 -->

```
Western Design Center

         Emulation

         The E signal reflects the state of the processor’s e flag; depending on whether or not the processor is in emulation mode or
not, external system compatibility feature (such as memory mapping or system speed) could be enabled or disabled.

         Bus Enable

         This signal replaces the data bus enable signal of the 6502; when asserted, it disables the address buffers and R/W’ as well
as the data buffers




                                                                                                                                   9
```

<!-- programmanual p448 -->

```
Western Design Center



B. 65x Series Support Chips
          There are a plethora of companion chips for the 65x processors. The ones every assembly language programmers runs into
eventually are serial and parallel input/output (I/O) chips. The 65x family serial I/O controller is the 6551 Asynchronous
Communication Interface Adapter (ACIA), while the simplest parallel I/O controller is the 6521 Peripheral Interface Adapter (PIA).
          As the architecture section of this book has already noted, the 65x microprocessors have memory-mapped I/O, not special
I/O opcodes. That is, they assign each input and each output device one or more memory locations. An output device’s status
registers can be tested to determine if the device is ready to send a unit of data. Conversely, an input device’s status registers can be
tested to determine if a unit of data has arrived and can be read. Writing data is accomplished by storing it to one of the output
device’s memory locations; reading it is accomplished with a load-register instruction, with its operand one of the input device’s
memory locations.
          One caution: Don’t attempt to use any peripheral chips without calling or writing the chip’s manufacturer for a data sheet,
usually provided for little or no charge. While data sheets are no joy to read, they contain enough information to sooner or later
explain the programming problems you will run into, if not on your current project, then on the next one.

The 6551 Serial Chip
         You may already be familiar with the 6551 ACIA. There is one controlling the serial port on every Apple II c, and one on
the plug-in Apple II e Super Serial Card.
         The 6551 features an on-chip baud-rate generator, which lets your program set any of fifteen baud rates from 50 to 19,200.
Like most other serial chips, word length, number of stop bits, and parity bit generation and detection can also be set under program
control.
         As an example, if the Super Serial Card were located, as it commonly is, in the Apple IIe’s port two, four consecutive
memory locations are allocated to the 6551 beginning at $C0A8. The 6511’s Transmit/Receive Data Register is located at $C0A8.
The current status of the chip (for example, indicating it has received a byte of data) is indicated in the Status Register, located at
$C0A9 (see Figure B.1). Two registers are used to initialize the chip. The Command Register, located at $C0AA, is used to set up
parity and several other parameters. As Figure B.2 indicates, writing $0B to the Command Register sets up a commonly used set of
parameters – no parity, and both the RTS and the DTR lines enabled. The Control Register, located at $C0AB, is used to set up stop
bits, word length, and baud rate; as Figure B.3 indicates, writing $1E to the Control Register sets up a commonly used set of
parameters – one stop bit, eight-bit data, and communications running at 9600 baud.
         So the 6511 is initialized by the 65816 code shown in Fragment B.1.

        0000                      COMPORT         GEQU              $C0A8             6551 located at $C0A8, 9, A, B
        0000
        0000      E220                            SEP               #$20              use 8-bit accumulator
        0002                                      LONGA             OFF
        0002
        0002      A900                            LDA               #0
        0004      8DA9C0                          STA               COMPORT+1         StatusReg: programmed reset first
        0007      A91E                            LDA               #$1E
        0009      8DABC0                          STA               COMPORT+3         CtrlReg: 1 stop bit/8-bit data/960
        000C      A90B                            LDA               #$0B
        000E      8DAAC0                          STA               COMPORT+2         CmdReg: no parity/RTS, DTR enabled
        0011      60                              RTS

                                                            Fragment B.1

         Actually, any value can be written to the status register to cause a programmed reset; this operation is done to reinitialize
the I/O registers – the three figures each show the effects on the non-data registers on each of their status bits.




                                                                                                                                     10
```

<!-- programmanual p449 -->

```
Western Design Center

 7   6   5   4   3   2   1   0

                                    STATUS             SET BY              CLEARED BY
                                                   0 = No Error                               *NO INTERRUPT GENERATED FOR THESE CONDITIONS
                                 Parity Error *                           Self Clearing * *
                                                   1 = Error                                  **CLEARED AUTOMATICALLY AFTER A READ OF RDR
                                                                                                 AND THE NEXT ERROR-FREE RECEIPT OF DATA
                                                   0 = No Error
                                 Framing Error *                          Self Clearing * *
                                                   1 = Error                                                7    6   5   4    3   2    1     0
                                                                                               HARDWARE
                                                   0 = No Error                                             0    -   -   1    0   0    0     0
                                                                                                   RESET
                                 Overrun *                                Self Clearing * *     PROGRAM
                                                   1 = Error                                                 -   -   -    -   -   0    -     -
                                                                                                   RESET

                                 Receive Data      0 = Not Full           Read Receive
                                 Register Full     1 = Full               Data Register
                                 Transmit Data     0 = Not Full           Write Transmit
                                 Register Empty    1 = Full               Data Register
                                                                          Not Resettable
                                                   0 = DCD Low
                                 DCD                                      Reflects DCD
                                                   1 = DCD High
                                                                          State
                                                                          Not Resettable
                                                   0 = DSR Low
                                 DSR                                      Reflects    DSR
                                                   1 = DSR High
                                                                          State
                                                   0 = No Interrupt       Read
                                 IRQ
                                                   1 = Interrupt          Status Register



                                                   Figure B-1. 6551 Status Register




                                                                                                                                      11
```

<!-- programmanual p450 -->

```
Western Design Center

                                                                     COMMAND REGISTER
                                                   7       6    5        4         3          2         1         0



                                                                                                                                      DATA TERMINAL READY
     PARITY CHECK CONTROLS                                                                                                         0 = Disable Receiver and All
                                                                                                                                        Interrupts (DTR high)
                                                                                                                                   1 = Enable Receiver and All
  BIT                                                                                                                                  Interrupts (DTR low)
                            OPERATION
 7 6 5
              Parity Disabled-No Parity Bit Generated-
 -    -   0
              No Parity Bit Received                                                                                       RECEIVER INTERRUPT ENABLE
 0 0 1        Odd Parity Receiver and Transmitter                                                               0 = IRQ Interrupt Enabled from Bit 3 of Status
 0 1 1        Even Parity Receiver and Transmitter                                                                  Register
              Mark Parity Bit Transmitted, Parity Check                                                         1 = IRQ Interrupt Disabled
 1 0 1
              Disabled
              Space Parity Bit Transmitted, Parity Check
 1 1 1
              Disabled
                                                                                                                                  TRANSMITTER CONTROLS
                                                                                              BIT
                                                                                                             TRANSMIT             RTS           TRANSMITTER
                                                                                          3         2       INTERRUPT            LEVEL
NORMAL/ECHO MODE                                                                          0         0         Disabled            High                 Off
FOR RECEIVER                                                                              0         1         Enabled             Low                  On
                                                                                          1         0         Disabled            Low                  On
 0 = Normal                                                                               1         1         Disabled            Low             Transmit BRK
 1 = Echo (Bit 2 and 3
     must be “0”)



                                                   7       6    5        4         3          2         1         0
                    HARDWARE RESET                 0       0    0        0         0          0         0         0
                         PROGRAM RESET             -       -     -       0         0          0         0         0


                                                               Figure B-2. 6551 Control Register




                                                                                                                                                                  12
```

<!-- programmanual p451 -->

```
Western Design Center

                                                   CONTROL REGISTER
                                       7   6   5      4        3       2    1   0


 STOP BITS                                                                                     BAUD RATE
  0 = 1 Stop Bit                                                                                  GENERATOR
  1 = 2 Stop Bits                                             0        0    0   0   16x EXTERNAL CLOCK
      1 Stop Bit if Word Length                               0        0    0   1         50 BAUD
      = 8 Bits and Parity                                     0        0    1   0             75
      11/2 Stop Bits if Word Length                           0        0    1   1          109.92
      = 5 Bits and No Parity                                  0        1    0   0          134.58
                                                              0        1    0   1            150
 WORD LENGTH                                                  0        1    1   0            300
                                                              0        1    1   1            600
     BIT           DATA WORD                                  1        0    0   0           1200
 6      5           LENGTH                                    1        0    0   1           1800
 0      0              8                                      1        0    1   0           2400
 0      1              7                                      1        0    1   1           3600
 1      0              6                                      1        1    0   0           4800
 1      1              5                                      1        1    0   1           7200
                                                              1        1    1   0           9600
 RECEIVER CLOCK SOURCE                                        1        1    1   1          19,200
  0 = External Receiver Clock
  1 = Baud Rate Generator
* This allows for 9-bit transmission
  (8 data bits plus parity).

                                       7   6   5      4        3       2    1   0
                      HARDWARE RESET   0   0   0      0        0       0    0   0
                       PROGRAM RESET   -   -   -      -        -       -    -   -


                                               Figure B-3Control Register




                                                                                                              13
```

<!-- programmanual p452 -->

```

```

<!-- programmanual p453 -->

```
Western Design Center
          When the 6551 connects a computer to a communications line-whether twisted-pair wire at 9600 baud or a modem at 300-
baud-reading a byte from the communications line is a matter of (once the 6551 has initialized waiting until the status register bit
three (receiver data register full) is set, then reading the byte from the data register, as shown in Fragment B.2.

            0000                     ; code to read a byte from the communications line (6551)
            0000                     ; returns byte in 8-bit A
            0000
            0000                     COMPORT         GEQU          $C0A8              6551 located at $C0A8,9,A,B
            0000
            0000     E220                            SEP           #$20               use 8-bit accumulator
            0002                                     LONGA         OFF
            0002
            0002     ADA9C0          AWAITCH         LDA           COMPORT+1          read Status Reg
            0005     2908                            AND           #8                 single out bit 3 (revr data reg full)
            0007     F0F9                            BEQ           AWAITCH            loop until bit 3 set
            0009
            0009     ADA8C0                          LDA           COMPORT            read the byte from Receive Data Reg
            000C     60                              RTS                                  and return with it

                                                              Fragment B.2

          Similarly, as Fragment B.3 shows, writing a byte out to the communications line is a matter of (once the 6551 has been
initialized) waiting until the status register bit four (transmitter data register empty) is set, the writing the byte to the data register.
          Neither routine does any error checking using the other status register bits.

The 6521 Parallel Chip

           The 6521 parallel I/O peripheral interface adapter is used to interface 65x microprocessors with printers, matrix-type
keyboards, and other devices. It features two programmable eight-bit bidirectional parallel I/O ports (Ports A and B), any lines of
which can be individually set for either reading or writing via a Data Direction Register. Provided all eight lines are set one way,
you can either read or write a byte at a time (as opposed to a bit at a time via a serial chip) through the port. For fancy I/O, the 6521
has several “handshake” lines for greater control of I/O.
           Like the 6551, the 6521 occupies four address locations (those dependent on the hardwiring of the two Register Select
lines). But it has six registers, three for each port: a control register, a data register, and a data direct register. Each port’s data
register and data direction register are addressed at the same location. Bit two of the port’s control register determines which register
is connected to that address at any one time: if control register bit two is set, the data register is connected; if control register bit two
is clear, the data direction register is connected.


           0000                      ; routine to write a byte to the communications line (6551)
           0000                      ; enter with byte in 8-bit A
           0000
           0000                      COMPORT            GEQU        $C0A8                  6551 located at $C0A8,9,A,B
           0000
           0000      48                                 PHA                                save byte to write; free accum
           0001
           0001      ADA9C0          WAITRDY            LDA         COMPORT+1              read Status Reg
           0004      291000                             AND         #$10                   get bit 4 (trnsmt data reg empty)
           0007      F0F8                               BEQ         WAITRDY                loop until bit 4 set
           0009
           0009      68                                 PLA                                retrieve byte to write
           000A      8DA8C0                             STA         COMPORT                write the byte to Transmit Data Reg
           000D      60                                 RTS

                                                              Fragment B.3

          The data direction register is generally initialized for an application just once; then the data register is selected. Each data
direction register bit controls the same-numbered bit in the data register: if a data direction register bit is set, the corresponding data
register bit becomes an output line; if a data direction register bit is clear, the corresponding data register bit becomes an input line.

                                                                                                                                         15
```

<!-- programmanual p454 -->

```
Western Design Center
         Imagine an application in which a printer is wired through a Centronics-compatible printer port to a 6521’s port A: the
6521’s eight Port A bits are connected to Centronics pins two through none. Port B is used to control the interface between
computer and printer: the 6521’s Port B bit zero is connected to the printer’s Data Strobe (Centronics pin one); the 6521’s Port B bit
seven is connected to the printer Busy Line (Centronics pin 11).
         The 6521 PIA is automatically initialed on power-up and reset to all be inputs (all registers are cleared). So every program
should initialize all the lines it will use, either as inputs or as outputs, every time it is run. In the case, setting up output to the printer
means al of Port A needs to be set up as inputs, while Port B bit zero must be initialized as an output and bit seven as an input.
Setting up the rest of Port B as inputs is a good habit to protect peripherals, as seen in Fragment B.4.

              0000      E220                SEP          #$20               use 8-bit accumulator
              0002                          LONGA        OFF
              0002
              0002                   ; set up Port A as entirely output
              0002
              0002      AD0080              LDA          PORTACTRL          get byte in Port A Control Reg
              0005      29FB                AND          #%11111011         clear bit 2: select Data Direction Reg
              0007      8D0080              STA          PORTACTRL          and store it back
              000A
              000A      A9FF                LDA          #$FF
              000C      8D0080              STA          PORTA              store all 1’s to make Port A an output
              000F
              000F      AD0080              LDA          PORTACTRL          get byte in Port A Control Reg
              0012      0904                ORA          #%00000100         set bit 2: select Data Reg
              0014      8D0080              STA          PORTACTRL          and store it back
              0017
              0017                   ; set up Port B: bit 0 as output; bit 7 as input
              0017
              0017      AD0080              LDA          PORTBCTRL          get byte in Port B Control Reg
              001A      29FB                AND          #%11111011         clear bit 2: select Data Direction Reg
              001C      8D0080              STA          PORTBCTRL          and store it back
              001F
              001F      A901                LDA          #1
              0021      8D0080              STA          PORTB              store 1 to bit 0 (output); 0 to bit 7
              0024
              0024      AD0080              LDA          PORTBCTRL          get byte in Port B Control Reg
              0027      0904                ORA          #%00000100         set bit 2: select Data Reg
              0029      8D0080              STA          PORTBCTRL          and store it back
              002C
              002C      A901                LDA          #1                 write 1 to printer’s Data Strobe
              002E      8D0080              STA          PORTB              to initialize Data Strobe to 1 (high)
              0031
              0031      60                  RTS

                                                                Fragment B.4

PORTACTRL, PORTA, PORTBCTRL, and PORTB must be elsewhere equated to the addresses at which each is located. The
value in the control register is loaded and bit two is ANDed out with the mask, then stored back to choose the data direction register
as the chosen register in each port. All ones are stored to Port A’s data direction register, selecting all eight lines as outputs. One is
stored to Port B’s data direction register, selecting bit zero as an output and the rest of the port as inputs. Then the control registers
are loaded again, this time ORing bit two back on before re-storing them, to choose the data register as the chosen register in each
port. Finally, one is written out Port B to the printer’s Data Strobe to initialize the line.
         Now bytes can be written to the printer by waiting for a zero on the Printer Busy Line (bit seven of Port B was chosen so
that a positive/negative test could be made to test the nit), then storing the byte to be written to Port A, and finally toggling the Data
Strobe to zero and then back to one to inform the printer that a new character is ready to be printed.




                                                                                                                                            16
```

<!-- programmanual p455 -->

```
Western Design Center

             0000                 ; write character in eight-bit accumulator to the printer
             0000
             0000      2C0080     POUT      BIT       PORTB       move Port B bit 7 (Busy Line) to n flag
             0003      30FB                 BMI       POUT        wait until printer is not busy
             0005
             0005      8D0080               STA       PORTA       write char in accum to printer
             0008
             0008      A90000               LDA       #0          tell the printer to get and print it:
             000B      8D0080               STA       PORTB       strobe the printer: write a 0 to bit 0
             000E      EA                   NOP                   allow a wait cycle
             000F      A90100               LDA       #1
             0012      8D0080               STA       PORTB       then toggle Strobe back to high (normal)
             0015
             0015      60                   RTS

                                                            Fragment B.5

          You must be sure, in toggling the Strobe by writing to it, that the zero written to bit seven (zeroes are written to bits one
through seven during both writes to Port B) not be read back as though it is a value being sent by the printer’s Busy Line indicating
the printer is not busy.
          Remember that it is always important to have a data sheet for each peripheral support chip you attempt to write code for.




                                                                                                                                   17
```

<!-- programmanual p456 -->

```
Western Design Center


C. The Rockwell 65C02
         Rockwell International Corporation has a family of CPUs which it calls the R65C00 family. It includes their
R65C02; while the designation would lead you to believe it is the 65C02 to which a part of this book is devoted, in fact
its instruction set is a superset of the 65C02 instruction set discussed earlier. It is the 65C02 described earlier, not the
Rockwell part, which Apple employed in its IIc computer and the 1985 upgrade to its IIe computer.
         Furthermore, the R65C02’s superset adds 32 instructions with opcodes that are the same as 32 very different
instructions on the 65816, making the Rockwell R65C02 incompatible with the 65802 and 65816. For this reason, the
R65C02 has been regulated to this appendix. If these additional instructions are disregarded and left unused, the
remaining available instructions correspond to the standard 65C02 instruction set.
         This is not to say the additional instructions are without merit. Rockwell’s R65C02 has two additional
operations for manipulating a single zero page bit at a time, Reset Memory Bit (RMB) and Set Memory Bit (SMB), and
two additional operations for testing a single zero page bit and branching if it is clear or set, Branch on Bit Reset (BBR)
and Branch on Bit Set (BBS).All four have eight versions – one for each bit – which are specified by adding a bit
number (0 through 7) to the mnemonic. So there are 32 total additional instructions.
         The operand to the bit-manipulating instructions is a zero page address (specified as dp, for “direct page”, in the
following pages to be consistent with the instructions chapter, although the direct page is actually limited to the zero
page). The operand to the bit-testing instructions is a compound operand: a zero page address to test, a comma, and a
nearby label to which to branch (which an assembler turns into a program counter relative offset).
         While incompatible with the 65802/65816 family expansion, the Rockwell 65C02’s bit manipulation and testing
instructions can be valuable for control applications, in which single bits are used to store boolean true/false values and
to send signals to external devices.




                                                                                                                         18
```

<!-- programmanual p457 -->

```
Western Design Center

 BBR                                                                                                           Branch on Bit Reset

         The specified bit in the zero page location specified in the operand is tested. If it is clear (reset), a branch is
taken; if it is set, the instruction immediately following the two-byte BBRx instruction is executed. The bit is specified
by a number (0 through 7) concatenated to the end of the mnemonic.
         If the branch is performed, the third byte of the instruction is used as a signed displacement from the program
counter; that is, it is added to the program counter: a positive value (numbers less than or equal to $80; that is, numbers
with the high-order bit clear) results in a branch to a higher location; a negative value (greater than $80, with the high-
order bit set) results in a branch to a lower location. Once the branch address is calculated, the result is loaded into the
program counter, transferring control to that location.
         Most assemblers calculate the displacement for you: you must specify as the operand, not the displacement but
rather the label to which you wish to branch. The assembler then calculates the correct offset.

Flags Affected:      – – – – – – – –

Codes:


                                                                Opcode     Available to:                     # of    # of
  Addressing Modes:                        Syntax                (hex)   6502     65C02    R65C02   65802   Bytes   Cycles
  Direct Page / Program Counter Relative   BBR0 dp, nearlabel     0F                          x               3       5
  Direct Page / Program Counter Relative   BBR1 dp, nearlabel     1F                          x               3       5
  Direct Page / Program Counter Relative   BBR2 dp, nearlabel     2F                          x               3       5
  Direct Page / Program Counter Relative   BBR3 dp, nearlabel     3F                          x               3       5
  Direct Page / Program Counter Relative   BBR4 dp, nearlabel     4F                          x               3       5
  Direct Page / Program Counter Relative   BBR5 dp, nearlabel     5F                          x               3       5
  Direct Page / Program Counter Relative   BBR6 dp, nearlabel     6F                          x               3       5
  Direct Page / Program Counter Relative   BBR7 dp, nearlabel     7F                          x               3       5




                                                                                                                                19
```

<!-- programmanual p458 -->

```
Western Design Center

 BBS                                                                                                    Branch on Bit Set

         The specified bit in the zero page location specified in the operand is tested. If it is set, a branch is taken; if it is
clear (reset), the instructions immediately following the two-byte BBSx instruction is executed. The bit is specified by a
number (0 through 7) concatenated to the end of the mnemonic.
         If the branch is performed, the third byte of the instruction is used as a signed displacement from the program
counter; that is, it is added to the program counter: a positive value (numbers less than or equal to $80; that is, numbers
with the high order bit clear) results in a branch to a higher location; a negative value (greater than $80, with the high-
order bit set) results in a branch to a lower location. Once the branch address is calculated, the result is loaded into the
program counter, transferring control to that location.
         Most assemblers calculate the displacement for you: you must specify as the operand, not the displacement but
rather the label to which you wish to branch. The assembler then calculates the correct offset.

Flags Affected:      d – – – – – – –


Codes:


                                                                          Available to :                    # of     # of
                                                                Opcode
  Addressing Mode                          Syntax                (hex)   6502     65C02    R65C02   65802   Bytes
                                                                                                                    ycles
  Direct Page / Program Counter Relative   BBS0 dp, nearlabel     8F                         x               3         5
  Direct Page / Program Counter Relative   BBS1 dp, nearlabel     9F                         x               3         5
  Direct Page / Program Counter Relative   BBS2 dp, nearlabel     AF                         x               3         5
  Direct Page / Program Counter Relative   BBS3 dp, nearlabel     BF                         x               3         5
  Direct Page / Program Counter Relative   BBS4 dp, nearlabel     CF                         x               3         5
  Direct Page / Program Counter Relative   BBS5 dp, nearlabel     DF                         x               3         5
  Direct Page / Program Counter Relative   BBS6 dp, nearlabel     EF                         x               3         5
  Direct Page / Program Counter Relative   BBS7 dp, nearlabel     FF                         x               3         5




                                                                                                                               20
```

<!-- programmanual p459 -->

```
Western Design Center

 RMB                                                                                        Reset Memory Bit

       Clear the specified bit in the zero page memory location specified in the operand. The bit to clear is specified by
a number (0 through 7) concatenated to the end of the mnemonic.

Flags Affected:      – – – – – – – –



Codes:


                                           Opcode       Available to:                     # of     # of
   Addressing Mode           Syntax          (hex)     6502      65C02   R65C02   65802   Bytes   Cycles
   Direct Page               RMB0 dp          07                            x               2       5
   Direct Page               RMB1 dp          17                            x               2       5
   Direct Page               RMB2 dp          27                            x               2       5
   Direct Page               RMB3 dp          37                            x               2       5
   Direct Page               RMB4 dp          47                            x               2       5
   Direct Page               RMB5 dp          57                            x               2       5
   Direct Page               RMB6 dp          67                            x               2       5
   Direct Page               RMB7 dp          77                            x               2       5




                                                                                                                       21
```

<!-- programmanual p460 -->

```
Western Design Center

  SMB                                                                                         Set Memory Bit

        Set the specified bit in the zero page memory location specified in the operand. The bit to set is
specified by a number (0 through 7) concatenated to the end of the mnemonic.

Flags Affected:      – – – – – – – –


Codes:


                                              Opcode    Available to:                     # of     # of
          Addressing Mode     Syntax           (hex)   6502      65C02   R65C02   65802   Bytes   Cycles
          Direct Page         SMB0 dp           87                          x              2        5
          Direct Page         SMB1 dp           97                          x              2        5
          Direct Page         SMB2 dp           A7                          x              2        5
          Direct Page         SMB3 dp           B7                          x              2        5
          Direct Page         SMB4 dp           C7                          x              2        5
          Direct Page         SMB5 dp           D7                          x              2        5
          Direct Page         SMB6 dp           E7                          x              2        5
          Direct Page         SMB7 dp           F7                          x              2        5




                                                                                                           22
```

<!-- programmanual p461 -->

```
Western Design Center

D. Instruction Groups
         The 65x instructions can be divided into three groups, on the basis of both the types of actions of each
instruction and the addressing modes each can use. The opcodes in the first group and some in the second have similar
bit patterns, the same addressing modes available, and regularity which can make remembering the capabilities of a
particular instruction – or creating a compiler generator – much easier.
         Group I instructions are the most commonly used load, store, logic, and arithmetic instructions, and have by far
the most addressing modes available to them. Group II instructions are mostly read-modify-write instructions, such as
increment, decrement, shift, and rotate, which both access and change one and only one register or memory location.
         Group III is a catch-all for the remaining instructions, such as index register comparisons and stack operations.

Group I Instructions
        The 65x Group I instructions, with their opcode’s bit patterns, are shown in Table D.1. The ‘aaaaa’s are filled
with addressing mode bit patterns – there is one pattern for each addressing mode available to Group I instruction.

            Add with Carry to the Accumulator (ADC)                                                 011a    aaaa
            And the Accumulator (AND)                                                               001a    aaaa
            Compare the Accumulator (CMP)                                                           110a    aaaa
            Exclusive Or the Accumulator (EOR)                                                      010a    aaaa
            Load the Accumulator (LDA)                                                              101a    aaaa
            Or the Accumulator (ORA)                                                                000a    aaaa
            Subtract with Borrow from the Accumulator (SBC)                                         111a    aaaa
            Store the Accumulator (STA)                                                             100a    aaaa

                                           Table D-1 Group I Instructions Opcode Patterns

        The 6502 addressing modes available to the Group I instructions have bit patterns that all end in ‘01’. These bit
patterns are found in Table D.2. The exception to this scheme is STA immediate; since it is not possible to use
immediate addressing with a store instruction, its logical opcode 1000 1001 is used by a non-Group-I instruction.

               Immediate                                                                             0     1001
               Direct (Zero) Page                                                                    0     0101
               Absolute                                                                              0     1101
               Direct (Zero) Page Indexed by X                                                       1     0101
               Absolute Indexed by X                                                                 1     1101
               Absolute Indexed by Y                                                                 1     1001
               Direct (Zero) Page Indexed Indirect with X (pre-indexed)                              0     0001
               Direct (Zero) Page Indirect Indexed with Y (post-indexed)                             1     0001

                                 Table D-2 Address Mode Patterns for Group I Instructions

       The 65C02 adds one more addressing mode for Group I instructions; it has the only Group I
addressing mode bit pattern to end in a zero:
         Direct (Zero) Page Indirect                                                        10010

        The 65802 and 65816 add the six addressing modes for Group I instructions found in Table D.3.

            Direct Page Indirect Long Indexed with Y (post-indexed long)                             1     0111
            Direct Page Indirect Long                                                                0     0111
            Absolute Long                                                                            0     1111
            Absolute Long Indexed with X                                                             1     1111
            Stack Relative                                                                           0     0011
            Stack Relative Indirect Indexed with Y                                                   1     0011

                                       Table D-3 65802/65816 Group I Addressing Mode Patterns
                                                                                                                       23
```

<!-- programmanual p462 -->

```
Western Design Center

Group II Instructions

         Group II instructions are an amalgam of mostly read-modify-write instructions with very similar addressing
modes (differing only whether the have accumulator addressing to them on the 6502). The instructions, with their
opcode bit patterns, are listing in Table D.4.
         There are either four or five addressing modes available to these instructions on the 6502 – five if the missing
bits are ‘bbc’ rather than just ‘bb’, the fifth addressing mode being accumulator addressing.
         Table D.5 shows the five addressing modes with their bit patterns. All three bits in this table are filled into the
‘bbc’ missing bits in Table D.4; only the first two bits of each Table D.5 set are filled into ‘bb’ missing bits in Table
D.4.

                   Arithmetic Shift Left (ASL)                                                000b    bc10
                   Decrement (DEC)                                                            110b    b110
                   Increment (INC)                                                            111b    b110
                   Logical Shift Right (LSR)                                                  010b    bc10
                   Rotate Left through Carry (ROL)                                            001b    bc10
                   Rotate Right through Carry (ROR)                                           011b    bc10
                   Store Index Register X (STX)                                               100b    b110
                   Store Index Register Y (STY)                                               100b    b100

                                           Table D-4 Group II Opcode Patterns

                   Accumulator                                                                 0     10
                   Direct (Zero) Page                                                          0     01
                   Absolute                                                                    0     11
                   Direct (Zero) Page Indexed by X                                             1     01
                   Absolute Indexed by X                                                       1     11

                                   Table D-5 Address Mode Patterns for Group II Instruction

          Notice how the four ‘bb1’ addressing modes have the same bit patterns as the first three bits of their
corresponding bit patterns for the Group I instruction addressing mode.
          There are a few exceptions.
          Absolute indexing is not available for storing either index register. Furthermore, since the register cannot use
itself, the STX instruction can’t use direct page, X; instead, direct page, Y substitutes for this instruction’s direct page,
indexed store.
          The two 65C02 instructions to increment and decrement the accumulator do not follow this scheme at all;
giving these instructions that addressing mode clearly was not planned when the 6502 was designed, since their opcodes
were assigned to other instructions. Nor does the 65C02’s STZ (store zero memory) instruction, which uses the main
four addressing modes, follow the scheme, even though it seems clearly to be a Group II instruction of this type. But
four of the five addressing modes of the BIT instruction on the 65C02, 65802, and 65816 (the 6502 has only two
addressing modes for this instruction)-the four ‘bb1’ addressing modes above-follow this scheme (its bit pattern is 001b
b100). It also has an immediate addressing mode, however, which is in no way regular.




                                                                                                                          24
```

<!-- programmanual p463 -->

```
Western Design Center

Loading the Index Registers

      The two index registers can be loaded with regular opcodes:

       Load Index Register X (LDX)                      101d    dd10
       Load Index Register Y (LDY)                      101d    dd00

      Available to them are the five addressing modes in table D.6.

             Immediate                                                                          0   00
             Direct Page                                                                        0   01
             Absolute                                                                           0   11
             Direct Page Indexed                                                                1   01
             Absolute Indexed                                                                   1   11

                           Table D-6 Address Mode Patterns for Load Index Register Instruction

      The two indexed modes use the Y index register for indexing when loading the X register and vice versa.

Index Register Compares

      The two instructions to compare an index register to memory have three addressing modes available to them.
      The instructions are:

                           Compare Index Register X with Memory (CPX)           1110     ee00
                           Compare Index Register Y with Memory (CPY)           1100     ee00

      Table D.7 lists the three addressing modes available.

                      Immediate                                                                     00
                      Direct Page                                                                   01
                      Absolute                                                                      11

                        Table D-7 Address Mode Patterns for Compare Index Register Instructions

Test-and-Change-Bits Instructions

      The two test-and-change-bits instructions each have two addressing modes that they use in a regular manner.
      The two instructions are:

                      Test and Reset Memory Bits (TRB)                            0001    x100
                      Test and Set Memory Bits (TSB)                              0000    x100

      The two addressing modes are:

                       Direct Page                                               x=0
                       Absolute                                                  x=1




                                                                                                                    25
```

<!-- programmanual p464 -->

```
Western Design Center


E. The ASCII Character Set
    Low Bit Set:         High Bit Set:
     Decimal       Hex     Decimal       Hex    Character           Names
        0          00         128        80    Control-@    NUL, null
        1          01         129        81    Control-A
        2          02         130        82    Control-B
        3          03         131        83    Control-C    Break
        4          04         132        84    Control-D
        5          05         133        85    Control-E
        6          06         134        86    Control-F
        7          07         135        87    Control-G    BEL, bell
        8          08         136        88    Control-H    BS, backspace
        9          09         137        89    Control-I    HT, horizontal tab
       10          0A         138        8A    Control-J    LF, line feed
       11          0B         139        8B    Control-K    VT, vertical tab
       12          0C         140        8C    Control-L    FF, form feed, Page
       13          0D         141        8D    Control-M    CR, carriage return
       14          0E         142        8E    Control-N
       15          0F         143        8F    Control-O
       16          10         144        90    Control-P
       17          11         145        91    Control-Q    XON, resume
       18          12         146        92    Control-R
       19          13         147        93    Control-S    XOFF, screen pause
       20          14         148        94    Control-T
       21          15         149        95    Control-U
       22          16         150        96    Control-V
       23          17         151        97    Control-W
       24          18         152        98    Control-X    CAN, cancel line
       25          19         153        99    Control-Y
       26          1A         154        9A    Control-Z    End of file
       27          1B         155        9B    Control-[    ESC, escape
       28          1C         156        9C    Control-\
       29          1D         157        9D    Control-]
       30          1E         158        9E    Control-^
       31          1F         159        9F    Control-_
       32          20         160        A0                 Space
       33          21         161        A1    !            Exclamation point
       34          22         162        A2    "            Quote
       35          23         163        A3    #            Pound sign
       36          24         164        A4    $            Dollar sign
       37          25         165        A5    %            Percent sign
       38          26         166        A6    &            Ampersand
       39          27         167        A7    '            Apostrophe
       40          28         168        A8    (            Left parenthesis
       41          29         169        A9    )            Right parenthesis
       42          2A         170        AA    *            Asterisk
       43          2B         171        AB    +            Plus sign
       44          2C         172        AC    ,            Comma
       45          2D         173        AD    -            Minus sign, dash
       46          2E         174        AE    .            Period
       47          2F         175        AF    \            Backlash
       48          30         176        B0    0
       49          31         177        B1    1
       50          32         178        B2    2
       51          33         179        B3    3
       52          34         180        B4    4
       53          35         181        B5    5
       54          36         182        B6    6
                                                                                  26
```

<!-- programmanual p465 -->

```
Western Design Center
    Low Bit Set:         High Bit Set:
     Decimal       Hex     Decimal       Hex       Character               Names
      55           37         183        B7    7
      56           38         184        B8    8
      57           39         185        B9    9
      58           3A         186        BA    :               Colon
      59           3B         187        BB    ;               Semicolon
      60           3C         188        BC    <               Less than
      61           3D         189        BD    =               Equal
      62           3E         190        BE    >               Greater than
      63           3F         191        BF    ?               Question mark
      64           40         192        C0    @               At sign
      65           41         193        C1    A
      66           42         194        C2    B
      67           43         195        C3    C
      68           44         196        C4    D
      69           45         197        C5    E
      70           46         198        C6    F
      71           47         199        C7    G
      72           48         200        C8    H
      73           49         201        C9    I
      74           4A         202        CA    J
      75           4B         203        CB    K
      76           4C         204        CC    L
      77           4D         205        CD    M
      78           4E         206        CE    N
      79           4F         207        CF    O
      80           50         208        D0    P
      81           51         209        D1    Q
      82           52         210        D2    R
      83           53         211        D3    S
      84           54         212        D4    T
      85           55         213        D5    U
      86           56         214        D6    V
      87           57         215        D7    W
      88           58         216        D8    X
      89           59         217        D9    Y
      90           5A         218        DA    Z
      91           5B         219        DB    [               Left bracket
      92           5C         220        DC    \               Backlash
      93           5D         221        DD    ]               Right bracket
      94           5E         222        DE    ^               Caret
      95           5F         223        DF    _               Underscore
      96           60         224        E0    `               Accent grave
      97           61         225        E1    a
      98           62         226        E2    b
      99           63         227        E3    c
     100           64         228        E4    d
     101           65         229        E5    e
     102           66         230        E6    f
     103           67         231        E7    g
     104           68         232        E8    h
     105           69         233        E9    i
     106           6A         234        EA    j
     107           6B         235        EB    k
     108           6C         236        EC    l
     109           6D         237        ED    m




                                                                                   27
```

<!-- programmanual p466 -->

```
Western Design Center
    Low Bit Set:         High Bit Set:
     Decimal       Hex     Decimal       Hex      Character               Names
     110           6E         238        EE    n
     111           6F         239        EF    o
     112           70         240        F0    p
     113           71         241        F1    q
     114           72         242        F2    r
     115           73         243        F3    s
     116           74         244        F4    t
     117           75         245        F5    u
     118           76         246        F6    v
     119           77         247        F7    w
     120           78         248        F8    x
     121           79         249        F9    y
     122           7A         250        FA    z
     123           7B         251        FB    {              Left brace
     124           7C         252        FC    |              Vertical line
     125           7D         253        FD    }              Right brace
     126           7E         254        FE    ~              Tilde
     127           7F         255        FF    DEL            delete, rubout




                                                                                  28
```

<!-- programmanual p467 -->

```
Western Design Center
    Low Bit Set:         High Bit Set:
     Decimal       Hex     Decimal       Hex    Character           Names
        0          00         128        80    Control-@    NUL, null
        1          01         129        81    Control-A
        2          02         130        82    Control-B
        3          03         131        83    Control-C    Break
        4          04         132        84    Control-D
        5          05         133        85    Control-E
        6          06         134        86    Control-F
        7          07         135        87    Control-G    BEL, bell
        8          08         136        88    Control-H    BS, backspace
        9          09         137        89    Control-I    HT, horizontal tab
       10          0A         138        8A    Control-J    LF, line feed
       11          0B         139        8B    Control-K    VT, vertical tab
       12          0C         140        8C    Control-L    FF, form feed, Page
       13          0D         141        8D    Control-M    CR, carriage return
       14          0E         142        8E    Control-N
       15          0F         143        8F    Control-O
       16          10         144        90    Control-P
       17          11         145        91    Control-Q    XON, resume
       18          12         146        92    Control-R
       19          13         147        93    Control-S    XOFF, screen pause
       20          14         148        94    Control-T
       21          15         149        95    Control-U
       22          16         150        96    Control-V
       23          17         151        97    Control-W
       24          18         152        98    Control-X    CAN, cancel line
       25          19         153        99    Control-Y
       26          1A         154        9A    Control-Z    End of file
       27          1B         155        9B    Control-[    ESC, escape
       28          1C         156        9C    Control-\
       29          1D         157        9D    Control-]
       30          1E         158        9E    Control-^
       31          1F         159        9F    Control-_
       32          20         160        A0                 Space
       33          21         161        A1    !            Exclamation point
       34          22         162        A2    "            Quote
       35          23         163        A3    #            Pound sign
       36          24         164        A4    $            Dollar sign
       37          25         165        A5    %            Percent sign
       38          26         166        A6    &            Ampersand
       39          27         167        A7    '            Apostrophe
       40          28         168        A8    (            Left parenthesis
       41          29         169        A9    )            Right parenthesis
       42          2A         170        AA    *            Asterisk
       43          2B         171        AB    +            Plus sign
       44          2C         172        AC    ,            Comma
       45          2D         173        AD    -            Minus sign, dash
       46          2E         174        AE    .            Period
       47          2F         175        AF    \            Backlash
       48          30         176        B0    0
       49          31         177        B1    1
       50          32         178        B2    2
       51          33         179        B3    3
       52          34         180        B4    4
       53          35         181        B5    5
       54          36         182        B6    6




                                                                                  29
```

<!-- programmanual p468 -->

```
Western Design Center
    Low Bit Set:         High Bit Set:
     Decimal       Hex     Decimal       Hex       Character               Names
      55           37         183        B7    7
      56           38         184        B8    8
      57           39         185        B9    9
      58           3A         186        BA    :               Colon
      59           3B         187        BB    ;               Semicolon
      60           3C         188        BC    <               Less than
      61           3D         189        BD    =               Equal
      62           3E         190        BE    >               Greater than
      63           3F         191        BF    ?               Question mark
      64           40         192        C0    @               At sign
      65           41         193        C1    A
      66           42         194        C2    B
      67           43         195        C3    C
      68           44         196        C4    D
      69           45         197        C5    E
      70           46         198        C6    F
      71           47         199        C7    G
      72           48         200        C8    H
      73           49         201        C9    I
      74           4A         202        CA    J
      75           4B         203        CB    K
      76           4C         204        CC    L
      77           4D         205        CD    M
      78           4E         206        CE    N
      79           4F         207        CF    O
      80           50         208        D0    P
      81           51         209        D1    Q
      82           52         210        D2    R
      83           53         211        D3    S
      84           54         212        D4    T
      85           55         213        D5    U
      86           56         214        D6    V
      87           57         215        D7    W
      88           58         216        D8    X
      89           59         217        D9    Y
      90           5A         218        DA    Z
      91           5B         219        DB    [               Left bracket
      92           5C         220        DC    \               Backlash
      93           5D         221        DD    ]               Right bracket
      94           5E         222        DE    ^               Caret
      95           5F         223        DF    _               Underscore
      96           60         224        E0    `               Accent grave
      97           61         225        E1    a
      98           62         226        E2    b
      99           63         227        E3    c
     100           64         228        E4    d
     101           65         229        E5    e
     102           66         230        E6    f
     103           67         231        E7    g
     104           68         232        E8    h
     105           69         233        E9    i
     106           6A         234        EA    j
     107           6B         235        EB    k
     108           6C         236        EC    l
     109           6D         237        ED    m




                                                                                   30
```

<!-- programmanual p469 -->

```
Western Design Center
    Low Bit Set:         High Bit Set:
     Decimal       Hex     Decimal       Hex      Character               Names
     110           6E         238        EE    n
     111           6F         239        EF    o
     112           70         240        F0    p
     113           71         241        F1    q
     114           72         242        F2    r
     115           73         243        F3    s
     116           74         244        F4    t
     117           75         245        F5    u
     118           76         246        F6    v
     119           77         247        F7    w
     120           78         248        F8    x
     121           79         249        F9    y
     122           7A         250        FA    z
     123           7B         251        FB    {              Left brace
     124           7C         252        FC    |              Vertical line
     125           7D         253        FD    }              Right brace
     126           7E         254        FE    ~              Tilde
     127           7F         255        FF    DEL            delete, rubout




                                                                                  31
```
