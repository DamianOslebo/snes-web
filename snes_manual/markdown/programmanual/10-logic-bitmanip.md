# Chapter 10 — Logic & Bit Manipulation

> Logic + shift/rotate ops; 8/16-bit A and 16-bit X variants.

## Contents (per the book's own TOC)

- Logical AND/OR/XOR (p140-143)
- Bit Manipulation (p145)
- Shifts & Rotates (ASL/LSR/ROL/ROR) (p146)

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

## Body (pages 139–153)


<!-- programmanual p139 -->

```
The Western Design Center


10) Chapter Ten
Logic and Bit Manipulation Operations
         The logical operations found in this chapter are the very essence of computer processing; even the
arithmetic functions, at the lowest level, are implemented as combinations of logic gates. Logic, or more
accurately, boolean logic, is concerned with the determination of “true” and “false”.
         Computers can represent simple logical propositions and relationships as binary states: the bit-value
used to represent “1” in a given computer is considered equivalent to true; the bit-value which stands for “0” is
considered equivalent to false. This designation is in fact arbitrary, and the values could easily be reversed.
What matters is the consistent application of the convention. Alternative terms are “set” and “reset” (or
“clear”), “on” and “off,” “high” and “low,” “asserted” and “negated.” There is a tendency to equate all of these
terms; this is generally acceptable except when you are concerned with the actual hardware implementation of
these values, in which case the issue of positive logic (“on” means “true”) vs. negative logic (“off” means
“true”) becomes a consideration. But the intuitive assumption of a positive logic system (“1” equals “on”
equals “true”) seems the most natural, and may be considered conventional, so the terms listed above as
equivalent will be used interchangeably, as appropriate for a given context.
         Before discussing these functions, it is important to remember the bit-numbering scheme described in
Chapter 1: bits are numbered right to left from least significant to most significant, starting with zero. So a
single byte contains bits zero through seven, and a double byte contains bits zero through fifteen. Bit zero
always stands for the “one’s place.” Bit seven stands for the “128ths place” and bit fifteen stands for the
“32768ths place,” except that the high bit of a signed number is, instead, the sign bit. A single bit (or string of
bits smaller than a byte or double byte) is sometimes called a bit-field, implying that the bits are just a part of a
larger data element like a byte or a double byte.
      You’ll find two types of instructions discussed in this chapter: the basic logic functions, and the
shifts and rotates. They’re listed in Table 10.1.

                                                    Available on:
                Mnemonic           6502         65C02    65802/816                Description
                           Logic Instruction:
                  AND                x            x           x       logical and
                  EOR                x            x           x       logical exclusive-or
                  ORA                x            x           x       logical or (inclusive or)

                    Bit Manipulation Instruction:
                  BIT              x              x           x       test bits
                  TRB                             x           x       test and reset bits
                  TSB                             x           x       test and set bits

                    Shift and Rotate Instructions:
                  ASL               x              x          x       shift bits left
                  LSR               x              x          x       shift bits right
                  ROL               x              x          x       rotate bits left
                  ROR               x              x          x       rotate bits right


                                            Table 10-1 Logic Instructions


Logic Functions

        The fundamental logical operations implemented on the 65x processor are and, inclusive or, and
exclusive or. These are implemented as the AND, ORA, and EOR machine instructions. These three logical
operators have two operands, one in the accumulator and the second in memory. All of the addressing modes

                                                                                                                 139
```

<!-- programmanual p140 -->

```
The Western Design Center

available for the LDA, STA, ADC, SBC, and CMP instructions are also available to the logical operations.
The truth tables for these operations are found in Chapter 1 and are repeated again in the descriptions of the
individual instructions in Chapter 18.
         In addition to these instructions, there are also bit testing instructions that perform logical operations;
these are the BIT (test memory bits), TSB (test and set bits), and TRB (test and reset bits) instructions. These
three instructions set status flags of memory values based on the result of logical operations, rather than
affecting the accumulator.
         The logical and bit manipulation instructions are broadly useful: for testing for a condition using
boolean logic (for example, if this is true and that is true then do this); for masking bit fields in a word, forcing
them to be on or off; for performing quick, simple multiplication and division functions, such as multiplying by
two or taking the modulus of a power of two (finding the remainder of a division by a power of two); for
controlling I/O devices; and for a number of other functions.
         The most typical usage of the boolean or logical operators is probably where one of the two operands is
an immediate value. Immediate values will generally be used in these examples. Additionally, operands will
usually be represented in binary form (prefixed by a percent sign - %), since it makes the bit-pattern more
obvious. All of the logical operations are performed bitwise; that is, the result is determined by applying the
logical operation to each of the respective bits of the operands.

Logical AND

        Consider, for example, the eight-bit AND operation illustrated in Figure 10.1.

                                             bit number
                                   7   6    5   4   3     2   1   0
                                   0   1    1   1   0     1   1   0            $76
                             and   1   1    0   0   1     0   1   1      and   $CB
                                   0   1    0   0   0     0   1   0            $42 result


                                           Figure 10-1 The AND Operation


The result, $42 or %0100 0010, is formed by ANDing bit zero of the first operand with bit zero of the second to
form bit zero of the result; bit one with bit one; and so on. In each bit, a one results only if there is a one in the
corresponding bit-fields of both the first operand and the second operand; otherwise zero results.
         An example of the use of the AND instruction would be to mask bits out of a double-byte word to
isolate a character (single-byte) value. A mask is a string of bits, typically a constant, used as an operand to a
logic instruction to single out of the second operand a given bit or bit-field by forcing the other bits to zeroes or
ones. Masking characters out of double bytes is common in 65802 and 65816 applications where a “default”
mode of sixteen-bit accumulator and sixteen-bit index registers has been selected by the programmer, but
character data needs to be accessed as well. For some types of character manipulation, it is quicker to simply
mask out the extraneous data in the high-order byte than to switch into eight-bit mode. The code in Listing 10.1
is fragmentary in the sense that it is assumed that the core routine is inserted in the middle of other code, with
the sixteen-bit accumulator size already selected.
         It may seem to be splitting hairs, but this routine, which compares the value in a string of characters
pointed to by the value in the memory variable CHARDEX to the letter ‘e’ is two machine cycles faster than
the alternative approach, which would be to switch the processor into the eight-bit accumulator mode, compare
the character, and then switch back into the sixteen-bit mode.




                                                                                                                  140
```

<!-- programmanual p141 -->

```
The Western Design Center

   0001    0000                              KEEP        KL.10.1
   0002    0000                              65816       ON
   0003    0000
   0004    0000                MAIN          START
   0005    0000                PTR           GEQU        $80
   0006    0000
   0007    0000    18                        CLC
   0008    0001    FB                        XCE
   0009    0002
   0010    0002    C230                      REP         #$30           assume operation in 16-bit modes
   0011    0004                              LONGA       ON
   0012    0004                              LONGI       ON
   0013    0004
   0014    0004    AC4C00                    LDY         CHARDEX        get index pointing to desired char
   0015    0007    B91A00      LOOP          LDA         STRING,Y       get the char & the one after it
                                                         #%000000001111
   0016    000A    29FF00                    AND                                  AND out the “next” char
                                                         111
   0017    000D    C96500                    CMP         #’e’           cmp low byte to ‘e’, high 0 byte to 0
   0018    0010    D004                      BNE         NOMATCH
   0019    0012
   0020    0012    38                        SEC                        return to emulation mode
   0021    0013    FB                        XCE
   0022    0014
   0023    0014    38                        SEC                        set carry indicates successful match
   0024    0015    60                        RTS
   0025    0016
   0026    0016    38          NOMATCH       SEC                        return to emulation mode
   0027    0017    FB                        XCE
   0028    0018
   0029    0018    18                        CLC                        clear carry indicates unsuccessful match
   0030    0019    60                        RTS
   0031    001A
   0032    001A    54686573    STRING        DC          C ‘These characters’
   0033    002A    61726520                  DC          C ‘are all packed next to’
   0034    0040    65616368                  DC          C ‘each other’
   0035    004A    0000                      DC          H ‘0000’
   0036    004C    0000        CHARDEX       DC          2             index to a particular char in STRING
   0037    004E                              END

                                                   Listing 10.1

         Each time the program is executed with a different value for CHARDEX, a different adjacent character
will also be loaded into the high byte of the accumulator. Suppose the value in CHARDEX were four; when
the LDA STRING,Y instruction is executed, the value in the low byte of the accumulator is $65, the ASCII
value for a lower-case ‘e’. The value in the high byte is $20, the ASCII value for the space character (the space
between “These” and “characters”). Even though the low bytes match, a comparison to ‘e’ would fail, because
the high byte of the CMP instruction’s immediate operand is zero, not $20 (the assembler having automatically
generated a zero as the high byte for the single-character operand ‘e’).
         However, by ANDing the value in the accumulator wit %0000000011111111 ($00FF), no matter what
the original value in the accumulator, the high byte of the accumulator is zeroed (since none of the
corresponding bits in the immediate operand are set). Therefore the comparison in this case will succeed, as it
will for CHARDEX values of 2, 13, 18, 28, 32, 38, and 46, even though their adjacent characters, automatically
loaded into the high byte of the accumulator, are different.
         The AND instruction is also useful in performing certain multiplication and division functions. For
example, it may be used to calculate the modulus of a power of two. (The modulus operation returns the
remainder of an integer division; for example, 13 mod 5 equals 3, which is the remainder of 13 divided by 5.)
This is done simply by ANDing with ones all of the bits to the right of the power of two you wish the modulus
                                                                                                                   141
```

<!-- programmanual p142 -->

```
The Western Design Center

of and masking out the rest. A program fragment illustrating this will be provided later in this chapter, where an
example of the use of the LSR instruction to perform division by powers of two will also be given.
        In general, the AND operation is found in two types of applications: selectively turning bits off (byte
ANDing with zero), and determining if two logical values are both true.

Logical OR

         The ORA instruction is used to selectively turn bits on by Oring them with ones, and to determine if
either (or both) of two logical values is true. A character-manipulation example (Listing 10.2) is used – this
time writing a string of characters, the high bit of each of which must be set, to the AppleII screen memory – to
demonstrate a typical use of the ORA instruction.
         Since the video screen is memory-mapped, outputting a string is basically a string move. Since normal
Apple video characters must be stored in memory with their high-order bit turned on, however, the ORA
#%10000000 instruction is required to do this if the character string, as in the example, was originally stored in
normal ASCII, with the high-order bit turned off. Note that it clearly does no harm to OR a character with $80
(%10000000) even if its high bit is already set, so the output routine does not check characters to see if they
need to have set high bit, but rather routinely Ors them all with $80 before writing them to the screen. When
each character is first loaded into the eight-bit accumulator from STRING, its high bit is off (zero); the ORA
instruction converts each of the values - $48, $65, $6C, $6C, $6F – into the corresponding high-bit-set ASCII
values - $C8, $E5, $EC, $EC, and $EF, before storing them to screen memory, where they will be displayed as
normal, non-inverse characters on the video screen. In this case, the same effect (the setting of the high-order
bit) could have been achieved if $80 had been added to each of the characters instead; however, the OR
operation differs from addition in that even if the high bit of the character already had a value of one, the result
would still be one, rather than zero plus a carry as would be the case if addition were used. (Further a CLC
operation would also have been required prior to the addition, making ORA a more efficient choice as well.)




                                                                                                                142
```

<!-- programmanual p143 -->

```
The Western Design Center

     0001    0000                               KEEP        KL.10.2
     0002    0000                               65816       ON
     0003    0000
     0004    0000                   L102        START
     0005    0000                               MSB         OFF
     0006    0000                   SCREEN      GEQU        $400            start of AppleII screen memory
     0007    0000
     0008    0000     18                        CLC
     0009    0001     FB                        XCE
     0010    0002
     0011    0002     C210                      REP         #$10            16-bit index register
     0012    0004                               LONGI       ON
     0013    0004
     0014    0004     E220                      SEP         #$20            8-bit accum
     0015    0006                               LONGA       OFF
     0016    0006
     0017    0006     A00000                    LDY         #0              starting index into string & screen = 0
     0018    0009
     0019    0009     B91900        TOP         LDA         STRING,Y        get char from string
     0020    000C     F008                      BEQ         DONE            branch if at 0 terminator
     0021    000E     0980                      ORA         #%10000000      set the high bit
     0022    0010     990004                    STA         SCREEN,Y        store the char into screen memory
     0023    0013
     0024    0013     C8                        INY
     0025    0014     80F3                      BRA         TOP
     0026    0016
     0027    0016     38            DONE        SEC
     0028    0017     FB                        XCE
     0029    0018     60                        RTS
     0030    0019
     0031    0019     48656C6C      STRING      DC          C ‘Hello’
     0032    001E     00                        DC          H ‘00’
     0033    001F
     0034    001F                               END

                                                      Listing 10.2

Logical Exclusive-Or

         The third logical operation, Exclusive-OR, is used to invert bits. Just as inclusive-OR (ORA) will
yield a true result if either or both of the operands are true, exclusive-or yields true only if one operand is true
and the other is false; if both are true or both are false, the result is false. This means that by setting a bit in the
memory operand of an EOR instruction, you can invert the corresponding bit of the accumulator operand
(where the result is stored). In the preceding example, where the character constants were stored with their high
bits off, an EOR #$80 instruction would have had the same effect as ORA #$80; but like addition, if some of
the characters to be converted already had their high-order bits set, the EOR operation would clear them.
         Two good examples of the application of the EOR operation apply to signed arithmetic. Consider the
multiplication of two signed numbers. As you know, the sign of the product is determined by the signs of the
multiplier and multiplicand according to the following rule: if both operands have the same sign, either positive
or negative, the result is always positive; if the two operands have different signs, the result is always negative.
You perform signed multiplication by determining the sign of the result, and then multiplying the absolute
values of both operands using the same technique as for unsigned arithmetic. Finally, you consider the sign of
the result: if it is positive, your unsigned result is the final result; if it is negative, you form the final result by
taking the two’s-complement of the unsigned result. Because the actual multiplication code is not included, this
example is given as two fragments, 10.1 and 10.2.
         Fragment 10.1 begins by clearing the memory location SIGN, which will be used to store the sign of
the result. Then the two values to be multiplied are exclusive-OR’d, and the sign of the result is tested with the
                                                                                                                      143
```

<!-- programmanual p144 -->

```
The Western Design Center

BPL instruction. If the sign bit of the result is negative, you know that the sign bits of the two operands were
different, and therefore the result will be negative; a negative result is preserved by decrementing the variable
SIGN, making its value $FFFF.
        Next, the two operands are converted to their absolute values by two’s complementing them if they are
negative. The technique for forming the two’s complement of a number is to invert it, and then add one. The
EOR operation is used again to perform the inversion; the instruction EOR #$FFFF will invert all of the bits in
the accumulator: ones become zeroes, and zeros become ones. An INC A instruction adds one. In the case of
NUM2, this result must be saved to memory before the accumulator is reloaded with NUM1, which is also
two’s complemented if negative.

        0000     0000       NUM1      DS           2
        0002     0000       NUM2      DS           2
        0004
        0004     C230                 REP          #$30        16-bit modes
        0006                          LONGA        ON
        0006                          LONGI        ON
        0006
        0006     9C0080               STZ          SIGN        clear the sign
        0009     AD0000               LDA          NUM1
        000C     4D0200               EOR          NUM2        exclusive-or: check sign
        000F     1003                 BPL          OK
        0011     CE0080               DEC          SIGN        negative: sign = $FFFF
        0014     AD0200     OK        LDA          NUM2
        0017     1007                 BPL          OK1
        0019     49FFFF               EOR          #$FFFF      minus: get absolute value
        001C     1A                   INC          A
        001D     8D0200               STA          NUM2
        0020     AD0000     OK1       LDA          NUM1
        0023     1004                 BPL          OK2
        0025     49FFFF               EOR          #$FFFF
        0028     1A                   INC          A
        0029                OK2       ANOP

                                                 Fragment 10.1

        At this point, the unsigned multiplication of the accumulator and NUM2 can be performed. The code
for the multiplication itself is omitted from these fragments; however, an example of unsigned multiplication is
found in Chapter 14. The important fact for the moment is that the multiplication code is assumed to return the
unsigned product in the accumulator.

         0000    AE0080               LDX     SIGN
         0003    1004                 BPL     DONE
         0005    49FFFF               EOR     #$FFFF          if should be neg,
         0008    1A                   INC     A                  two’s complement the result
         0009    60          DONE     RTS
         000A

                                                 Fragment 10.2




                                                                                                             144
```

<!-- programmanual p145 -->

```
The Western Design Center

       What remains is to adjust the sign of the result; this code is found in Fragment 10.2. By testing the sign
of SIGN, it can be determined whether or not the result is negative; if it is negative, the actual result is the two’s
complement of the unsigned product, which is formed as described above.

Bit Manipulation

          You have now been introduced to the three principal logical operators, AND, ORA, and EOR. In
addition there are three more specialized bit-manipulating instructions that use the same logical operations.
          The first of these is the BIT instruction. The BIT instruction really performs two distinct operations.
First, it directly transfers the highest and next to highest bits of the memory operand (that is, seven and six if m
= 1, or fifteen and fourteen if m = 0) to the n and v flags. It does this without modifying the value in the
accumulator, making it useful for testing the sign of a value in memory without loading it into one of the
registers. An exception to this is the case where the immediate addressing mode is used with the BIT
instruction: since it serves no purpose to test the bits of a constant value, the n and v flags are left unchanged in
this one case.
          BIT’s second operation is to logically AND the value of the memory operand with the value in the
accumulator, conditioning the z flag in the status register to reflect whether or not the result of the ANDing was
zero or not, but without storing the result in the accumulator (as is the case with the AND instruction) or saving
the result in any other way. This provides the ability to test if a given bit (or one or more bits in a bit-field) is
set by first loading the accumulator with a mask of the desired bit patterns, and then performing the BIT
operation. The result will be non-zero only if at least one of the bits set in the accumulator is likewise set in the
memory operand. Actually, you can write your programs to use either operand as the mask to test the other,
except when immediate addressing is used, in which case the immediate operand is the mask, and the value in
the accumulator is tested.
          A problem that remained from the previous chapter was sign extension, which is necessary when
mixed-precision arithmetic is performed – that is, when the operands are of different sizes. It might also be
used when converting to a higher precision due to overflow. The most typical example of this is the addition (or
subtraction) of a signed eight-bit and a signed sixteen-bit value. In order for the lesser-precision number to be
converted to a signed number of the same precision as the larger number, it must be sign-extended first, by
setting or clearing all of the high-order bits of the expanded-precision number to the same value as the sign bit
of the original, lesser-precision number.
          In other words, $7F would become $007F when sign-extended to sixteen bits, while $8F would become
$FF8F. A sign-extended number evaluates to the same number as its lesser precision form. For example, $FF
and $FFFF both evaluate to –1.
          You can use the BIT instruction to determine if the high-order bit of the low-order byte of the
accumulator is set, even while in the sixteen-bit accumulator mode. This is used to sign extend an eight-bit
value in the accumulator to a sixteen-bit one in Listing 10.3.




                                                                                                                  145
```

<!-- programmanual p146 -->

```
The Western Design Center

         0001       0000                            KEEP            KL.10.3
         0002       0000                            65816           ON
         0003       0000
         0004       0000                  L103      START
         0005       0000     18                     CLC
         0006       0001     FB                     XCE
         0007       0002
         0008       0002     C230                   REP             #$30         turn 16-bit modes on
         0009       0004                            LONGA           ON
         0010       0004                            LONGI           ON
         0011       0004
         0012       0004     A500                   LDA             0            get value to sign extend
         0013       0006
         0014       0006     29FF00                 AND             #$FF         zero out any garbage in high byte
         0015       0009     898000                 BIT             #$80         test high bit of low byte
         0016       000C     F003                   BEQ             OK           number is positive; leave as is
         0017       000E     0900FF                 ORA             #$FF00       turn on high bits
         0018       0011
         0019       0011     8500         OK        STA             0            save sign-extended value
         0020       0013
         0021       0013     38                     SEC
         0022       0014     FB                     XCE
         0023       0015     60                     RTS
         0024       0016                            END

                                                          Listing 10.3

        The pair of “test-and-set” instructions, TSB and TRB, are similar to the BIT instruction in that they set
the zero flag to represent the result of ANDing the two operands. They are dissimilar in that they do not affect
the n and v flags. Importantly, they also set (in the case of TSB) or reset (in the case of TRB) the bits of the
memory operand according to the bits that are set in the accumulator (the accumulator value is a mask). You
should recognize that the mechanics of this involve the logical functions described above: the TSB instruction
Ors the accumulator with the memory operand, and stores the result to memory; the TRB inverts the value in
the accumulator, and then ANDs it with the memory operand. Unlike the BIT instruction, both of the test-and-
set operations are read-modify-write instructions; that is, in addition to performing an operation on the memory
value specified in the operand field of the instruction, they also store a result to the same location.
        The test-and-set instructions are highly specialized instructions intended primarily for control of
memory-mapped I/O devices. This is evidenced by the availability of only two addressing modes, direct and
absolute, for these instructions; this is sufficient when dealing with memory-mapped I/O, since I/O devices are
always found at fixed memory locations.

Shifts and Rotates
           The second class of bit-manipulating instructions to be presented in this chapter are the shift and rotate
instructions: ASL, LSR, ROL, and ROR. These instructions copy each bit value of a given word into the adjacent bit to the
“left” or “right.” A shift t o the left means that the bits are shifted into the next-higher-order bit; a shift to the right means
that each is shifted into the next-lower-order bit. The bit shifted out of the end-that is, the orginal high-order bit for a left
shift, or the original low order bit for a right shift-is copied into the carry flag.
         Shift and rotate instructions differ in the value chosen for the origin bit of the shift or rotate. The shift
instructions write a zero into the origin bit of the shift – the low-order bit for a shift left of the high-order bit for
shift right. The rotates, on the other hand, copy the original value of the carry flag into the origin bit of the
shift. Figure 10.2. and Figure 10.3 illustrate the operation of the shift and rotate instructions.
         The carry flag, as Fragment 10.3 illustrates, is used by the combination of a shift followed by one or
more rotate instructions to allow multiple-precision shifts, much as it is used by ADC and SBC instructions to
enable multiple-precision arithmetic operations.


                                                                                                                              146
```

<!-- programmanual p147 -->

```
The Western Design Center

         In this code fragment, the high-order bit in LOC1 is shifted into the carry flag in the first ASL
instruction and a zero is shifted into the low-order bit of LOC1; its binary value changes from
         1010101010101010
to
         0101010101010100 carry = 1
The next instruction, ROL, shifts the value in the carry flag (the old high bit of LOC1) into the low bit of
LOC2. The high bit of LOC2 is shifted into the carry.




                                                                                                               147
```

<!-- programmanual p148 -->

```
The Western Design Center




                  ASL-Before                                                    ROL-Before
   1   0      1      1     0   0    1   1                         1     0   1     1    0     0    1    1

                                        X                                                              X
                                   CARRY FLAG                                                    CARRY FLAG




                     ASL                                                              ROL


   1   0      1      1     0   0    1   1             0           1     0   1     1    0     0    1    1

                                        X                                                              X
                                   CARRY FLAG                                                    CARRY FLAG




                  ASL-After                                                     ROL-After
   0   1      1      0     0   1    1   0                         0     1   1     0   0     1      1   X

                                        1                                                              1
                                   CARRY FLAG                                                    CARRY FLAG




                                        Figure 10-2 Shift and Rotate Left


       0000       A9AAAA                                  LDA         #%1010101010101010
       0003       8D0080                                  STA         LOC1
       0006       A9AAAA                                  LDA         #%1010101010101010
       0009       8D0080                                  STA         LOC2
       000C       0E0080                                  ASL         LOC1
       000F       2E0080                                  ROL         LOC2

                                                 Fragment 10.3




                                                                                                           148
```

<!-- programmanual p149 -->

```
    The Western Design Center




                    LSR-Before                                                     ROR-Before

       1   0    1      1     0   0    1   1                       1    0       1    1    0   0         1       1

                                          X                                                                    X
                                     CARRY FLAG                                                   CARRY FLAG


                           LSR                                                     ROR



0      1   0    1      1     0   0    1   1                       1   0    1       1     0   0     1       1

                                          X                                                                X
                                     CARRY FLAG                                                   CARRY FLAG



                    LSR-After                                                  ROR-After

       0   1    0      1     1   0    0   1                       X    1   0        1    1   0     0       1

                                          1                                                                1
                                     CARRY FLAG                                                  CARRY FLAG


                                          Figure 10-3 Shift and Rotate Right




                                                                                                                   149
```

<!-- programmanual p150 -->

```
The Western Design Center

        1010101010101010

    becomes

        0101010101010101           carry = 1

        A double-precision shift left has been performed.
        What is the application of the shift and rotate instructions? There are two distinct categories:
multiplication and division by powers of two, and generalized bit-manipulation.
      Left shifts multiply the original value by two. Right shifts divided the original value by two.
This principal is inherent in the concept of positional notation; when you multiply a value by ten by
adding a zero to the end of it, you are in effect shifting it left one position; likewise when you divide
by ten by taking away the right-most digit, which in this case is base two.
         Shifting is also useful, for the same reason, in a generalized multiply routine, where a combination of
shift and add operations are performed iteratively to accomplish the multiplication. Sometimes, however, it is
useful to have a dedicated multiplication routine, as when a quick multiplication by a constant value is needed.
If the constant value is a power of two – such as four, the constant multiplier in Fragment 10.4 – the solution is
simple: shift left a number of times equal to the constant’s power of two (four is two to the power, so two left
shifts are equivalent to multiplying by four).

        0000   A93423                          LDA        #$2334
        0003   0A                              ASL        A                 times 4 (2 to the 2nd power)
        0004   0A                              ASL        A

                                                   Fragment 10.4

The result in the accumulator is $2334 times four, or $8CD0. Other “quickie” multiply routines can be easily
devised for multiplication by constants that are not a power of two. Fragment 10.5 illustrates multiplication by
ten: the problem is reduced to a multiplication by eight plus a multiplication by two.

        0000     A9D204                      LDA          #1234
        0003     0A                          ASL          A               multiply by 2
        0004     8D0080                      STA          TEMP            save intermediate result
        0007     0A                          ASL          A               times 2 again = times 4
        0008     0A                          ASL          A               times 2 again = times 8
        0009     18                          CLC
        000A     6D0080                      ADC          TEMP            = times 10

                                                   Fragment 10.5

         After the first shift left, which multiplies the original value by two, the intermediate result (1234 * 2 =
2468) is stored at location TEMP. Two more shifts are applied to the value in the accumulator, which equals
9872 at the end of the third shift. This is added to the intermediate result of 1234 times 2, which was earlier
stored at location TEMP, to give the result 12,340, or 1234 * 10.
         Division using the shift right instructions is similar. Since bits are lost during a shift right operation,
just as there is often a remainder when an integer division is performed, it would be useful if there were an easy
way to calculate the remainder (or modulus) of a division by a power of two. This is where the use of the AND
instruction alluded to earlier comes into play.




                                                                                                                150
```

<!-- programmanual p151 -->

```
The Western Design Center


        0000     A91FE2                       LDA          #$E21F
        0003     48                           PHA                           save accumulator
        0004     4A                           LSR          A                divide by 2
        0005     4A                           LSR          A                divide by 2 again = divide
        0006     8D0080                       STA          QUO              save quotient
        0009     68                           PLA                           recover original value
        000A     290300                       AND          #$3
        000D     8D0080                       STA          MOD              save modulus

                                                    Fragment 10.6

          Consider Fragment 10.6. In this case, $E21F is to be divided by four. As with multiplication, so with
division: two shifts are applied, one for each power of two, this time to the right. By the end of the second shift,
the value in the accumulator is $3887, which is the correct answer. However, two bits have been shifted off to
the right. The original value in the accumulator is recovered from the stack and then ANDed with the divisor
minus one, or three. This masks out all but the bits that are shifted out during division by four, the bits which
correspond to the remainder or modulus the quotient times four, and then adding the remainder.
          The second use for the shift instructions is general bit manipulation. Since the bit shifted out of the
word always ends up in the carry flag, this is an easy way to quickly test the value of the high- or low-order bit
of a word. Listing 10.4 gives a particularly useful example: a short routine to display the value of each of the
flags in the status register. This routine will, one by one, print the letter-name of each of the status register flags
if the flag is set (as tested by the BCS instruction), or else print a dash if it is clear.




                                                                                                                   151
```

<!-- programmanual p152 -->

```
The Western Design Center


 0001   0000                KEEP     KL.10.4
 0002   0000                65816    ON
 0003   0000
 0004   0000
 0005   0000                PRINTP   START
 0006   0000                PREG     GEQU      $80
 0007   0000                PTR      GEQU      $82
 0008   0000
 0009   0000
 0010   0000   08                    PHP                       save (on the stack)
 0011   0001                ;                                  the status reg to be displayed
 0012   0001
 0013   0001   18                    CLC
 0014   0002   FB                    XCE
 0015   0003
 0016   0003   C2FF                  REP       #$FF            16-bit index regs; reset all flags
 0017   0005   E220                  SEP       #$20            8-bit accum
 0018   0007                         LONGI     ON
 0019   0007                         LONGA     OFF
 0020   0007
 0021   0007   68                    PLA                       pull status reg to display into accum
 0022   0008   8580                  STA       PREG               then store to memory location PREG
 0023   000A   A23000                LDX       #FLAGS          load 16-bit X with ptr to flag string
 0024   000D   8682                  STX       PTR                and store to PTR
 0025   000F   A20800                LDX       #8            load X with counter (# of flag bits)
 0026   0012
 0027   0012   0680         LOOP     ASL       PREG          shift high bit of PREG Õ carry
 0028   0014   B004                  BCS       DOFLAG        branch if set
 0029   0016   A92D                  LDA       #’-‘          if flag not set, output ‘-‘
 0030   0018   8002                  BRA       SKIP
 0031   001A   B282         DOFLAG   LDA       (PTR)         get flag letter from FLAGS
 0032   001C   200080       SKIP     JSR       COUT          output flag letter or ‘-‘
 0033   001F   E682                  INC       PTR           16-bit
 0034   0021   D002                  BNE       OK               increment
 0035   0023   E683                  INC       PTR+1            (incr hi byte if low rolls over)
 0036   0025   CA           OK       DEX                       decrement counter
 0037   0026   D0EA                  BNE       LOOP            continue thru all 8 bits of status reg
 0038   0028   A90D                  LDA       #$0D            output cr after all 8 flags
 0039   002A   200080                JSR       COUT
 0040   002D
 0041   002D   38                    SEC
 0042   002E   FB                    XCE
 0043   002F   60                    RTS
 0044   0030
 0045   0030   6E766D78     FLAGS    DC        c’nvmxdizc’
 0046   0038
 0047   0038                         END



 SKIP          00001C



 0048   0000
 0049   0000
 0050   0000                COUT     START
 0051   0000                ECOUT    GEQU      $FDED           COUT IN APPLE I I MONITOR
 0052   0000   48                    PHA
                                                                                                        152
```

<!-- programmanual p153 -->

```
The Western Design Center
 0053   0001   DA           PHX
 0054   0002   5A           PHY
 0055   0003   08           PHP
 0056   0004   38           SEC
 0057   0005   FB           XCE
 0058   0006   20EDFD       JSR        ECOUT
 0059   0009   18           CLC
 0060   000A   FB           XCE
 0061   000B   28           PLP
 0062   000C   7A           PLY
 0063   000D   FA           PLX
 0064   000E   68           PLA
 0065   000F   60           RTS
 0066   0010                END


                                  Listing 10.4




                                                 153
```
