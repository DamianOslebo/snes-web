# Chapter 9 — Built-In Arithmetic

> ADC/SBC/INC/DEC/CMP in 8/16-bit — flag behavior the assembler documents.

## Contents (per the book's own TOC)

- Increment/Decrement (p123)
- Add/Subtract unsigned (p127)
- Comparison (p130)
- Signed arithmetic (p134)
- Signed compares (p136)
- Decimal mode (BCD) (p137)

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

## Body (pages 122–138)


<!-- programmanual p122 -->

```
The Western Design Center



9) Chapter Nine
Built-In Arithmetic Functions
         With this chapter you make your first approach to the heart of the beast: the computer as an automated
calculator. Although their applications cover a broad range of functions, computers are generally associated
first and foremost with their prodigious calculating abilities. Not without reason, for even in chapter oriented
applications such as word processing, the computer is constantly calculating. At the level of the word processor
itself, everything from instructions decoding to effective address generation is permeated by arithmetic or
arithmetic-like operations. At the software implementation level, the program is constantly calculating
horizontal and vertical cursor location, buffer pointer locations, indents, page numbers, and more.
         But unlike dedicated machines, such as desk-top or pocket calculators, which are merely calculators, a
computer is a flexible and generalized system which can be programmed and reprogrammed to perform an
unlimited variety of functions. One of the keys to this ability lies in the computer’s ability to implement control
structures, such as loops, and to perform comparisons and select an action based on the result. Because this
chapter introduces comparison, the elements necessary to demonstrate these features are complete. The other
key element, the ability to branch on condition, was presented in the previous chapter. This chapter therefore
contains the first examples of these control structures, as they are implemented on the 65x processor.
         Armed with the material presented in Chapter 1 about positional notation as it applies to the binary and
hexadecimal number systems, as well as the facts concerning two’s-complement binary numbers and binary
arithmetic, you should posses the background required to study the arithmetic instructions available on the 65x
series of processors.
         Consistent with the simple design approach of the 65x family, only elementary arithmetic functions are
provided, as listed in Table 9.1, leaving the rest to be synthesized in software. There are, for example, no built-
in integer multiply or divide. More advanced examples presented in later chapters will show how to synthesize
these more complex operations.

                                   Available on:
         Mnemonic        6502       65C02        65802/816    Description
        Increment Instructions:
            DEC             x          x              x       decrement
            DEX             x          x              x       decrement index register X
            DEY             x          x              x       decrement index register Y
            INC             x          x              x       increment
            INX             x          x              x       increment index register X
            INY             x          x              x       increment index register Y

        Arithmetic Instructions:
            ADC             x          x              x       add with carry
            SBC             x          x              x       subtract with borrow

        Compare with Memory Instructions:
           CMP          x            x                x       compare accumulator
           CPX          x            x                x       compare index register X
           CPY          x            x                x       compare index register Y


                                           Table 9-1 Arithmetic Instructions




                                                                                                               122
```

<!-- programmanual p123 -->

```
The Western Design Center

Increment and Decrement
         The simplest of the 65x arithmetic instructions are increment and decrement. In the case of the 65x
processors, all of the increment and decrement operations add or subtract one to a number. (Some other
processors allow you to increment or decrement by one, two, or more.)
         There are several reasons for having special instructions to add or subtract one to a number, but the
most general explanation says it all: the number one tends to be, by far, the most frequently added number in
virtually any computer application. One reason for this is that indexing is used so frequently to access multi-
byte data structures, such as address tables, character strings, multiple-precision numbers, and most forms of
record structures. Since the items in a great percentage of such data structures are byte or double-byte wide, the
index counter step value (the number of bytes from one array item to the next) is usually one or two. The 65x
processors, in particular, have many addressing modes that feature indexing; that is, they use a value in one of
the index registers as part of the effective address.
         All 65x processors have four instructions to increment and decrement the index registers: INX, INY,
DEX, and DEY. They are single-byte implied operand instructions and either add one to, or subtract one from,
the X or Y register. They execute quite quickly – in two cycles – because they access no memory and affect
only a single register.
         All 65x processors also have a set of instructions for incrementing and decrementing memory, the INC
and DEC instructions, which operate similarly. They too are unary operations, the operand being the data
stored at the effective address specified in the operand field of the instruction. There are several addressing
modes available to these two instructions. Note that, unlike the register increment and decrement instructions,
the INC and DEC instructions are among the slowest-executing 65x instructions. That is because they are
Read-Modify-Write operations: the number to be incremented or decremented must first be fetched from
memory; then it is operated upon within the processor; and, finally, the modified value is written back to
memory. Compare this with some of the more typical operations, where the result is left in the accumulator.
Although read-modify-write instructions require many cycles to execute, each is much more efficient, both
byte- and cycle-wise, than the three instructions it replaces – load, modify, and store.
         In Chapter 6, you saw how the load operations affected the n and z flags depending on whether the
loaded number was negative (that is, had its high bit set), or was zero. The 65x arithmetic functions, including
the increment and decrement operations, also set the n and z status flags to reflect the result of the operation.
         In Fragment 9.1, one is added to the value in the Y register, $7FFF. The result is $8000, which, since
the high-order bit is turned on, may be interpreted as a negative two’s-complement number. Therefore the n
flag is set.

        0000    C230              REP          #$30                16-bit registers
        0002                      LONGA        ON
        0002                      LONGI        ON
        0002    A0FF7F            LDY          #$7FFF              $7FFF is a positive number
        0005    C8                INY                              $8000 is a negative number;n=1

                                                  Fragment 9.1

        In a similar example, Fragment 9.2, the Y register is loaded with the highest possible value which can
be represented in sixteen bits (all bits turned on).

         0000    C230                REP          #$30
         0002                        LONGA        ON
         0002                        LONGI        ON
         0002    A0FFFF              LDY          #$FFFF
         0005    C8                  INY                             z = 1 in status register

                                                  Fragment 9.2




                                                                                                              123
```

<!-- programmanual p124 -->

```
The Western Design Center

If one is added to the unsigned value $FFFF, the result is $10000:

                                              1           one to be added
       +   1111       1111      1111       1111           binary equivalent of $FFFF
       1   0000       0000      0000       0000           result is $10000

         Since there are no longer any extra bits available in the sixteen-bit register, however, the low-order
sixteen bits of the number in Y (that is, zero) does not represent the actual result. As you will see later, addition
and subtraction instructions use the carry flag to reflect a carry out of the register, indicating that a number
larger than can be represented using the current word size (sixteen bits in the above example) has been
generated. While increment and decrement instructions do not affect the carry, a zero result in the Y register
after an increment (indicated by the z status flag being set) shows that a carry has been generated, even though
the carry flag itself does not indicate this.
         A classic example of this usage is found in Fragment 9.3, which shows the technique commonly used
on the eight-bit 6502 and 65C02 to increment a sixteen-bit value in memory. Note the branch-on-condition
instruction, BNE, which was introduced in the previous chapter, is being used to indicate if any overflow from
the low byte requires the high byte to be incremented, too. As long as the value stored at the direct page
location ABC is non-zero following the increment operation, processing continues at the location SKIP. If
ABC is zero as a result of the increment operation, a page boundary has been crossed, and the high order byte of
the value must be incremented, the sixteen-bit value would “wrap around” within the low byte.

        0000      EE0080       TOP      INC       ABC             increment low byte
        0003      D0FB                  BNE       SKIP            if no overflow, done
        0005      EE0180                INC       ABC+1           if overflow: increment high byte, too
        0008                   SKIP     .                         continue
        0008                            .
        0008                            .
        0008                            .

                                                   Fragment 9.3

         Such use of the z flag to detect carry (or borrow) is peculiar to the increment and decrement operations:
if you could increment or decrement by values other than one, this technique would not work consistently, since
it would be possible to cross the “threshold” (zero) without actually “landing” on it (you might, for example, go
from $FFFF to $0001 if the step value was 2).
         A zero result following a decrement operation, on the other hand, indicates that the next decrement
operation will cause a borrow to be generated. In Fragment 9.4, the Y register is loaded with one, and then one
is subtracted from it by the DEY instruction. The result is clearly zero; however, if Y is decremented again,
$FFFF will result. If you are treating the number as a signed, two’s-complement number, this is just fine, as
$FFFF is equivalent to a sixteen-bit, negative one. But if it is an unsigned number, a borrow exists.

        0000      C230                 REP            #$30                  16-bit registers
        0002                           LONGA          ON
        0002                           LONGI          ON
        0002      A00100               LDY            #$0001                z = 0 in the status register
        0005      88                   DEY                                  z = 1 in the status register

                                                   Fragment 9.4

         Together with the branch-on-condition instructions introduced in the previous chapter, you can now
efficiently implement one of the most commonly used control structures in computer programming,, the
program loop.
         A rudimentary loop would be a zero-fill loop; that is, a piece of code to fill a range of memory with
zeroes. Suppose, as in Listing 9.1, the memory area from $4000 to $5FFF was to be zeroed (for example, to
clear hi-res page two graphics memory in the AppleII). By loading an index register with the size of the area to
be cleared, the memory can be easily accessed by indexing from an absolute base of $4000.
                                                                                                                 124
```

<!-- programmanual p125 -->

```
The Western Design Center

         The two lines at BASE and COUNT assign symbolic names to the starting address and length of the fill
area. The REP instruction puts the processor into the long index/long accumulator mode. The long index
allows the range of memory being zeroed to be greater than 256 bytes; the long accumulator provides for faster
zeroing of memory, by clearing two bytes with a single instruction.
         The loop is initialized by loading the X register with the value COUNT, which is the number of bytes
to be zeroed. The assembler is instructed to subtract two from the total to allow for the fact that the array starts
at zero, rather than one, and for the fact that two bytes are cleared at a time.




                                                                                                                125
```

<!-- programmanual p126 -->

```
The Western Design Center

     0001     0000
     0002     0000                           KEEP       KL.9.1
     0003     0000                           65816      ON
     0004     0000                L91        START
     0005     0000
     0006     0000    18                     CLC
     0007     0001    FB                     XCE
     0008     0002
     0009     0002
     0010     0002                BASE       GEQU       $4000          starting address of fill area
     0011     0002                COUNT      GEQU       $2000          number of bytes to clear
     0012     0002
     0013     0002    C230                   REP        #$30           turn 16-bit modes on
     0014     0004
     0015     0004                           LONGA      ON
     0016     0004                           LONGI      ON
     0017     0004
     0018     0004    A2FE1F                 LDX        #COUNT-2       get the number of bytes to clear into x
     0019     0007                ;                                    minus two
     0020     0007
     0021     0007    9E0040      LOOP       STZ        BASE,X         store zero to memory
     0022     000A    CA                     DEX
     0023     000B    CA                     DEX
     0024     000C    10F9                   BPL        LOOP           repeat loop again if not done
     0025     000E
     0026     000E    38          DONE       SEC
     0027     000F    FB                     XCE
     0028     0010    60                     RTS
     0029     0011
     0030     0011                           END

                                                   Listing 9.1

        The loop itself is then entered for the first time, and the STZ instruction is used to clear the memory
location formed by adding the index register to the constant BASE. Next come two decrement instructions; two
are needed because the STZ instruction stored a double-byte zero. By starting at the end of the memory range
and indexing down, it is possible to use a single register for both address generation and loop control. A simple
comparison, checking to see that the index register is still positive, is all that is needed to control the loop.
        Another concrete example of a program loop is provided in Listing 9.2, which toggles the built-in
speaker in an AppleII computer with increasing frequency, resulting in a tone of increasing pitch. It features an
outer driving loop (TOP), an inner loop that produces a tone of a given pitch, and an inner-most delay loop.
The pitch of the tone can be varied by using different initial values for the loop indices.




                                                                                                                 126
```

<!-- programmanual p127 -->

```
The Western Design Center

      0001   0000                         KEEP        KL.9.2
      0002   0000                         65816       ON
      0003   0000
      0004   0000               L92       START
      0005   0000    18                   CLC
      0006   0001    FB                   XCE
      0007   0002    E230                 SEP         #$30            set 8-bit mode
      0008   0004                         LONGA       OFF
      0009   0004                         LONGI       OFF
      0010   0004               BELL      GEQU        $C030
      0011   0004
      0012   0004    A200                 LDX         #0
      0013   0006    8A                   TXA                         X, now in A, initializes the delay loop
      0014   0007
      0015   0007    9B         TOP       TXY                         initialize X & Y to 0
      0016   0008
      0017   0008    8D30C0     LOOP      STA         BELL            accessing the tone generator pulses it
      0018   000B
      0019   000B    8A                   TXA                         diminishing delay loop
      0020   000C
      0021   000C    3A         DELAY     DEC         A
      0022   000D    D0FD                 BNE         DELAY           loop 256 times before continuing
      0023   000F
      0024   000F
      0025   000F    88                   DEY
      0026   0010    D0F6                 BNE         LOOP
      0027   0012
      0028   0012    CA                   DEX
      0029   0013    D0F2                 BNE         TOP
      0030   0015
      0031   0015    38                   SEC
      0032   0016    FB                   XCE
      0033   0017    60                   RTS
      0034   0018                         END

                                                   Listing 9.2

Addition and Subtraction: Unsigned Arithmetic
         The 65x processors have only two dedicated general purpose arithmetic instructions: add with carry,
ADC, and subtract with carry, SBC. As will be seen later, it is possible to synthesize all other arithmetic
functions using these and other 65x instructions.
         As the names of these instructions indicate, the carry flag from the status register is involved with the
two operations. The role of the carry flag is to “link” the individual additions and subtractions that make up
multiple-precision arithmetic operations. The earlier example of the 6502 sixteen-bit increment was a special
case of the multiple-precision arithmetic technique used on the 65x processors, the link provided in that case by
the BNE instruction.
         Consider the addition of two decimal numbers, 56 and 72. You begin your calculation by adding six to
two. If you are working the calculation out on paper, you place the result, eight, in the right-most column, the
one’s place:

       56
       72
        8




                                                                                                                127
```

<!-- programmanual p128 -->

```
The Western Design Center

Next you add the ten’s column; 5 plus 7 equals 12. The two is placed in the tens place of the sum, and the one
is a carry into the 100’s place. Normally, since you have plenty of room on your worksheet, you simply pencil
in the one to the left of the two, and you have the answer.
         The situation within the processor when it adds two numbers is basically similar, but with a few
differences. First, the numbers added and subtracted in a 65x processor are normally binary numbers (although
there is also a special on-the-fly decimal adjust mode for adding and subtracting numbers in binary-coded
decimal format). Just as you began adding, the processor starts in the right-most column, or one’s place, and
continues adding columns to the left. The augend (the number added to) is always in the accumulator; the
location of the addend is specified in the operand field of the instruction. Since a binary digit can only be a zero
or a one, the addition of 2 ones results in a zero in the current column and a carry into the next column. This
process of addition continues until the highest bit of the accumulator has been added (the highest bit being
either bit seven or, alternatively on the 65802 / 65816, bit fifteen, if the m flag is cleared). But suppose that $82
is added to $AB in the eight-bit accumulator:

           1           1       carry digits from previous addition to right
               1000   0010     binary equivalent of $82
       +       1010   1011     binary equivalent of $AB
               0010   1101

         If you begin by adding the binary digits from the right and marking the sum in the proper column, and
then placing any carry that results at the top of the next column to the left, you will find that a carry results
when the ones in column seven are added together. However, since the accumulator is only eight bits wide,
there is no place to store this value; the result has “overflowed” the space allocated to it. In this case, the final
carry is stored in the carry flag after the operation. If there had been no carry, the carry flag would be reset to
zero.
         The automatic generation of a carry flag at the end of an addition is complemented by a second feature
of this instruction that is executed at the beginning of the instruction: the ADC instruction itself always adds the
previously generated one-bit carry flag value with the right-most column of binary digits. Therefore, it is
always necessary to explicitly clear the carry flag before adding two numbers together, unless the numbers
being added are succeeding words of a multi-word arithmetic operation. By adding in a previous value held in
the carry flag, and storing a resulting carry there, it is possible to chain together several limited-precision (each
only eight or sixteen bits) arithmetic operations.
         First, consider how you would represent an unsigned binary number greater than $FFFF (decimal
65,536) – that is, one that cannot be stored in a single double-byte cell. Suppose the number is $023A8EF1.
This would simply be stored in memory in four successive bytes, from low to high order, as follows, beginning
at $1000:

        1000      -   F1
        1001      -   8E
        1002      -   3A
        1003      -   02

Since the number is greater than the largest available word size of the processor (double byte), any arithmetic
operations performed on this number will have to be treated as multiple-precision operations, where only one
part of a number is added to the corresponding part of another number at a time. As each part is added, and so
on, until all of the parts of the number have been added.
          Multiple-precision operations always proceed from low-order part to high-order part because the carry
is generated from low to high, as seen in our original addition of decimal 56 to 72.
          Listing 9.3 is an assembly language example of the addition of multi-precision numbers $023A8EF1 to
$0000A2C1. This example begins by setting the accumulator word size to sixteen bits, which lets you process
half of the four-byte addition in a single operation. The carry flag is then cleared because there must be no
initial carry when an add operation begins. The two bytes stored at BIGNUM and BIGNUM+1 are loaded into
the double-byte accumulator. Note that the DC 14 assembler directive automatically stores the four-byte
integer constant value in memory in low-to-high order. The ADC instruction is then executed, adding $8EF1 to
$A2C1.
                                                                                                                 128
```

<!-- programmanual p129 -->

```
The Western Design Center

 0001    0000                                 KEEP         KL.9.3
 0002    0000                                 65816        ON
 0003    0000
 0004    0000                    L93          START
 0005    0000    18                           CLC
 0006    0001    FB                           XCE
 0007    0002    S220                         REP          #$20                 use sixteen-bit accumulator
 0008    0004                                 LONGA        ON
 0009    0004    18                           CLC                               make sure carry is clear to start
 0010    0005    AD1A00                       LDA          BIGNUM               load low-order two bytes
 0011    0008    6D1E00                       ADC          NEXTNUM              add to low-order two bytes of NEXTNUM
 0012    000B    8D2200                       STA          RESULT               save low-order result
 0013    000E    AD1C00                       LDA          BIGNUM+2             now load high-order two bytes
 0014    0011    6D2000                       ADC          NEXTNUM+2            add to high order of NEXTNUM with carry
 0015    0014    8D2400                       STA          RESULT+2             save result
 0016    0017    38                           SEC
 0017    0018    FB                           XCE
 0018    0019    60                           RTS
 0019    001A    F18E3A02        BIGNUM       DC           I4’$023A8EF1’
 0020    001E    C1A20000        NEXTNUM      DC           I4’$0000A2C1’
 0021    0022    00000000        RESULT       DS           4
 0022    0026                                 END

                                                      Listing 9.3

Examine the equivalent binary addition:
   1      1   11 1   1         1       carry from addition of column to right
       1000   1110   1111    0001      $8EF1
       1010   0010   1100    0001      $A2C1
       0011   0001   1011    0010      $31B2

The sixteen-bit result found in the accumulator after the ADC is executed is $31B2; however, this is clearly
incorrect. The correct answer, $13B2, requires seventeen bits to represent it, so an additional result of the ADC
operation in this case is that the carry flag in the status register is set. Meanwhile, since the value in the
accumulator consists of the correct low-order sixteen bits, the accumulator is stored at RESULT and
RESULT+1.
        With the partial sum of the last operation saved, the high-order sixteen bits of BIGNUM are loaded
(from BIGNUM+2) into the accumulator, followed immediately by the ADC NEXTNUM + 2 instruction,
which is not preceded by CLC this time. For all but the first addition of a multiple-precision operation, the
carry flag is not cleared; rather, the setting of the carry flag from the previous addition is allowed to be
automatically added into the next addition. You will note in the present example that the high-order sixteen bits
of NEXTNUM are zero; it almost seems unnecessary to add them. At the same time, remember that there was
a carry left over from the first addition; when the ADC NEXTNUM + 2 instruction is executed, this carry is
automatically added in; that is, the resulting value in the accumulator is equal to the carry flag (1) plus the
original value in the accumulator ($023A) plus the value at the address NEXTNUM + 2 ($0000), or $023B.
This is then stored in the high-order bytes of RESULT, which leaves the complete, correct value stored in
locations RESULT through RESULT + 3 in low-high order:

        RESULT          - B2
        RESULT + 1      -   31
        RESULT + 2      -   3B
        RESULT + 3      -   02

Reading from high to low, the sum is $023B31B2.
        This type of multiple precision addition is required constantly on the eight-bit 6502 and 65C02
processors in order to manipulate addresses, which are sixteen-bit quantities. Since the 65816 and 65802
provide sixteen-bit arithmetic operations when the m flag is cleared, this burden is greatly reduced. If you wish,
                                                                                                                   129
```

<!-- programmanual p130 -->

```
The Western Design Center

however, to manipulate long addresses on the 65816, that is , 24-bit addresses, you will similarly have to resort
to multiple precision. Otherwise, it is likely that multiple-precision arithmetic generally will only be required
on the 65802 or 65816 in math routines to perform number-crunching on user data, rather than for internal
address manipulation.
         An interesting footnote to the multiple-precision arithmetic comparison between the 6502 and the
65816 is to observe that since the 6502 only has an eight-bit adder, even those instructions that automatically
perform sixteen-bit arithmetic (such as branch calculation and affective address generation) require an
additional cycle to perform the addition of the high-order byte of the address. The presence of a sixteen-bit
adder within the 65802 and 65816 explains how it is able to shave cycles off certain operations while in native
mode, such as branching across page boundaries, where an eight-bit quantity is added to a sixteen-bit value. On
the 6502, if a page boundary isn’t crossed, the high byte of the sixteen-bit operand is used as-is; if a carry is
generated by adding the two low bytes, a second eight-bit add must be performed, requiring an additional
machine cycle. On the 65816, the addition is treated as a single operation.
         Subtraction on the 65x processors is analogous to addition, with the borrow serving a similar role in
handling multiple-precision subtractions. On the 65x processors, the carry flag is also used to store a
subtraction’s borrow. In the case of the addition operation, a one stored in the carry flag indicates that a carry
exists, and the value in the carry flag will be added into the next add operation. The borrow stored in the carry
flag is actually an inverted borrow: that is, the carry flag cleared to zero means that there is a borrow, while
carry set means that there is none. Thus prior to beginning a subtraction, the carry flag should be set so that no
borrow is subtracted by the SBC instruction.
         Although you can simply accept this rule at face value, the explanation is interesting, The simple way to
understand the inverted borrow of the 65x series is to realize that, like most computers, a 65x processor has no
separate subtraction circuits as such; all it has is an adder, which serves for both addition and subtraction.
Obviously, addition of a negative number is the same as subtraction of a positive. To subtract a number, then,
the value which is being subtracted is inverted, yielding a one’s-complement negative number. This is then
added to the other value and, as is usual with addition on the 65x machines, the carry is added in as well.
         Since the add operation automatically adds in the carry, if the carry is set prior to subtraction, this
simply converts the inverted value to two’s complement form. (Remember, two’s complement is formed by
inverting a number and adding one; in this case the added one is the carry flag.) If, on the other hand, the carry
was clear, this has the effect of subtracting one by creating a two’s-complement number which is one greater
than if the carry had been presented. (Assuming a negative number is being formed, remember that the more
negative a number is, the greater its value as an unsigned number, for example, $FFFF = -1, $8000 = -32767.)
Thus, if a borrow exists, a value which is more negative by one is created, which is added to the other operand,
effectively subtracting a carry.

Comparison
          The comparison operation – is VALUE1 equal to VALUE2, for example – is implemented on the 65x,
as on most processors, as an implied subtraction. In order to compare VALUE1 to VALUE2, one of the values
is subtracted from the other. Clearly, if the result is zero, then the numbers are equal.
          This kind of comparison can be made using the instructions you already know, as Fragment 9.5
illustrates. In this fragment, you can see that the branch to TRUE will be taken, and the INC VAL instruction
never executed, because $1234 minus 1234 equals zero. Since the results of subtractions condition the z flag,
the BEQ instruction (which literally means “branch if result equal to zero”), in this case, means “branch if the
compared values are equal.”




                                                                                                              130
```

<!-- programmanual p131 -->

```
The Western Design Center

           0000       C230              REP        #$30       16-bit registers
           0002                         LONGA      ON
           0002                         LONGI      ON
           0002
           0002       9C1200            STZ        VAL        clear double-byte at VAL
           0005       A93412            LDA        #$1234     get one value
           0008       38                SEC
           0009       E93412            SBC        #$1234     subtract another
           000C       F003              BEQ        TRUE       if they are the same, leave VAL zero
           000E       EE1200            INC        VAL        if they are different, set VAL
           0011       60       TRUE     RTS
           0012       0000     VAL      DS         2

                                                  Fragment 9.5

         There are two undesirable aspects of this technique, however, if comparison is all that is desired rather
than actual subtraction. First, because the 65x subtraction instruction expects the carry flag to be set for single
precision subtractions, the SBC instruction must be executed before each comparison using SBC. Second, it is
not always desirable to have the original value in the accumulator lost when the result of the subtraction is
stored there.
         Because comparison is such a common programming operation, there is a separate compare instruction,
CMP. Compare subtracts the value specified in the operand field of the instruction from the value in the
accumulator without storing the result; the original accumulator value remains intact. Status flags normally
affected by a subtraction – z, n, and c – are set to reflect the result of the subtraction just performed.
Additionally, the carry flag is automatically set before the instruction is executed, as it should be for a single-
precision subtraction. (Unlike the ADC and SBC instructions, CMP does not set the overflow flag,
complicating signed comparisons somewhat, a problem which will be covered later in this chapter.)
         Given the flags that are set by the CMP instruction, and the set of branch-on-condition instructions, the
relations shown in Table 9.2 can be easily tested for. A represents the value in the accumulator, DATA is the
value specified in the operand field of the instruction, and Bxx is the branch-on-condition instruction that causes
a branch to be taken (to the code labelled TRUE) if the indicated relationship is true after a comparison.
         Because the action taken after a comparison by the BCC and BCS is not immediately obvious from
their mnemonic names, the recommended assembler syntax standard allows the alternate mnemonics BLT, for
“branch on less than,” and BGE, for

                               BEQ        TRUE               branch if A = DATA
                               BNE        TRUE               branch if A < > DATA
                               BCC        TRUE               branch if A < DATA
                               BCS        TRUE               branch if A > = DATA

                                               Table 9-2. Equalities


“branch if greater of equal,” respectively, which generate the identical object code.
      Other comparisons can be synthesized using combinations of branch-on-condition instructions.
Fragment 9.6 shows how the operation “branch on greater than” can be synthesized.

               0000     F002                  BEQ                  SKIP           branch to TRUE if
               0002     B0FC                  BGE                  TRUE               A > DATA
               0004                   SKIP    ANOP

                                                  Fragment 9.6

        Fragment 9.7 shows “branch on less or equal.”



                                                                                                               131
```

<!-- programmanual p132 -->

```
The Western Design Center

  0000   F0FE                    BEQ                 TRUE           branch if
  0002   90FC                    BCC                 TRUE              A <= DATA

                                                  Fragment 9.7

         Listing 9.4 features the use of the compare instruction to count the number of elements in a list which
are less than, equal to, and greater than a given value. While of little utility by itself, this type of comparison
operation is just a few steps away from a simple sort routine. The value the list will be compared against is
assumed to be stored in memory locations $88.89, which are given the symbolic name VALUE in the example.
The list, called TABLE, uses the DC I directive, which stores each number as a sixteen-bit integer.




                                                                                                               132
```

<!-- programmanual p133 -->

```
The Western Design Center

  0001   0000                           KEEP      KL.9.4
  0002   0000                           65816     ON
  0003   0000
  0004   0000                L94        START
  0005   0000
  0006   0000
  0007   0000                LESS       GEQU      $82                counter
  0008   0000                SAME       GEQU      $84                counter
  0009   0000                MORE       GEQU      $86                counter
  0010   0000
  0011   0000                VALUE      GEQU      $88                value for list to be compared against
  0012   0000
  0013   0000   18                      CLC
  0014   0001   FB                      XCE
  0015   0002   C230                    REP       #$30               turn on both 16-bit modes
  0016   0004
  0017   0004                           LONGA     ON
  0018   0004                           LONGI     ON
  0019   0004
  0020   0004
  0021   0004   6482                    STZ       LESS               zero the counters
  0022   0006   6484                    STZ       SAME
  0023   0008   6486                    STZ       MORE
  0024   000A
  0025   000A
  0026   000A   A588                    LDA       VALUE              get the comparison value
  0027   000C   A01A00                  LDY       #LAST-TABLE        get a counter to # of list items
  0028   000F
  0029   000F
  0030   000F   D92700       TOP        CMP       TABLE,Y            compare accum to first list item
  0031   0012   F006                    BEQ       ISEQ
  0032   0014   9008                    BLT       ISMORE
  0033   0016   E682                    INC       LESS               VALUE is less, bump LESS
  0034   0018   8006                    BRA       LOOP
  0035   001A   E684         ISEQ       INC       SAME               value is same; bump SAME
  0036   001C   8002                    BRA       LOOP
  0037   001E   E686         ISMORE     INC       MORE               VALUE is greater; bump MORE
  0038   0020
  0039   0020   88           LOOP       DEY                          move pointer to next list item
  0040   0021   88                      DEY
  0041   0022   10EB                    BPL       TOP                continue if there are any list items
  0042   0024                ;                                       left to compare
  0043   0024
  0044   0024   38                      SEC
  0045   0025   FB                      XCE
  0046   0026   60                      RTS
  0047   0027
  0048   0027   0C00009000              DC        I’12,9,302,956,123,1234,98’
  0049   0035   04116300                DC        I’4356,99,11,40000,23145,562’
  0050   0041   0F27         LAST       DC        I’9999”
  0051   0043
  0052   0043                           END

                                                   Listing 9.4.

         After setting the mode to sixteen-bit word/index size, the locations that will hold the number of
occurrences of each of the three possible relationships are zeroed. The length of the list is loaded into the Y
register. The accumulator is loaded with the comparison value.
         The loop itself is entered, with a comparison to the first item in the list; in this and each succeeding
case, control is transferred to counter-incrementing code depending on the relationship that exists. Note that
equality and less-than are tested first, and greater-than is assumed if control falls through. This is necessary
since there is no branch on greater-than (only branch on greater-than-or-equal). Following the incrementing of
the selected relation-counter, control passes either via an unconditional branch, or by falling through, to the
loop-control code, which decrements Y twice (since double-byte integers are being compared). Control
                                                                                                             133
```

<!-- programmanual p134 -->

```
The Western Design Center

resumes at the top of the loop unless all of the elements have been compared, at which point Y is negative, and
the routine ends.
         In addition to comparing the accumulator with memory, there are instructions for comparing the values
in the two index registers with memory, CPX and CPY. These instructions come in especially handy when it is
not convenient or possible to decrement an index to zero – if instead you must increment or decrement it until a
particular value is reached. The appropriate compare index register instruction is inserted before the branch-on-
condition instruction either loops or breaks out of the loop. Fragment 9.8 shows a loop that continues until the
value in X reaches $A0.

  0000                 LOOP          ANOP                          work to be done in the loop goes here
  0000                               .
  0000                               .
  0000                               .
  0000    E8                         INX
  0001    E0A000                     CPX          #$A0
  0004    D0FA                       BNE          LOOP             continue incrementing X until
  0006                               ANOP                          X = $A0, so loop ended

                                                    Fragment 9.8

Signed Arithmetic

        The examples so far have dealt with unsigned arithmetic – that is, addition and subtraction of binary
numbers of the same sign. What about signed numbers?
        As you saw in Chapter 1, signed numbers can be represented using two’s-complement notation. The
two’s complement of a number is formed by inverting it (one bits become zeroes, zeroes become ones) and then
adding one. For example, a negative one is represented by forming the two’s complement of one:
   0000     0000    0000     0001      -binary one in sixteen-bit word
   1111     1111    1111     1110      -complement word
   0000     0000    0000     0001      -add one to complement
   1111     1111    1111     1111      -result is two’s-complement
                                        representation of minus one

         Minus one is therefore equivalent to a hexadecimal $FFFF. But as far as the processor is concerned, the
unsigned value $FFFF (65,535 decimal) and the signed value minus-one are equivalent. They both amount to
the same stream of bits stored in a register. It’s the interpretation of them given by the programmer which is
significant – an interpretation that must be consistently applied across each of the steps that perform a multi-step
function.
         Consider all of the possible signed and unsigned numbers that can be represented using a sixteen-bit
register. The two’s complement of $0002 is $FFFE – as the positive numbers increase, the two’s-complement
(negative) numbers decrease (in the unsigned sense). Increasing the positive value to $7FFF (%0111 1111 1111
1111), the two’s complement is $8001 (%1000 0000 0000 0001); except for $8000, all of the possible values
have been used to represent the respective positive and negative numbers between $0001 and $7FFF.
         Since their point of intersection, $8000, determines the maximum range of a signed number, the high-
order bit (bit fifteen will always be one if the number is negative, and zero if the number is positive. Thus the
range of possible binary values (%0000 0000 0000 0000 through %1111 1111 1111 1111, or $0000 . . $FFFF),
using two’s-complement form, is divided evenly between representations of positive numbers, and
representations of the corresponding range of negative numbers. Since $8000 is also negative, there seems to
be one more possible negative number than positive; for the purpose here, however, zero is considered positive.
         The high-order bit is therefore referred to as the sign bit. On the 6502, with its eight-bit word size (or
the 65816 in an eight-bit register mode), bit seven is the sign bit. With sixteen-bit registers, bit fifteen is the
sign bit. The n or negative flag in the status register reflects whether or not the high-order bit of a given register
is set or clear after execution of operations which affect that register, allowing easy determination of the sign of
a signed number by using either the BPL (branch on plus) or BMI (branch if minus) instructions introduced in
the last chapter.

                                                                                                                  134
```

<!-- programmanual p135 -->

```
The Western Design Center

          Using the high-order bit as the sign bit sacrifices the carry flag’s normal (unsigned) function. If the
high-order bit is used to represent the sign, then the addition or subtraction of the sign bits (plus a possible carry
out of the next-to-highest bit) results in a sign bit that may be invalid and that will erroneously affect the carry
flag.
          To deal with this situation, the status register provides another flag bit, the v or overflow flag, which is
set or rest as the result of the ADC and SBC operations. The overflow bit indicates whether a signed result is
too large (or too small) to be represented in the precision available, just as the carry flag does for unsigned
arithmetic.
          Since the high-order bit is used to store the sign, the penultimate bit (the next highest bit) is the high-
order bit as far as magnitude representation is concerned. If you knew if there was a carry out of this bit, it
would obviously be helpful in determining overflow or underflow.
          However, the overflow flag is not simply the carry out bit six (if m = 1 for eight-bit mode) or bit
fourteen (if m = 0 for sixteen-bit mode). Signed generation of the v flag is not as straightforward as unsigned
generation of the carry flag. It is not automatically true that if there is a carry out of the penultimate bits that
overflow has occurred, because it could also mean that the sign has changed. This is because of the circular or
wraparound nature of two’s-complement representation.
          Consider Fragment 9.9. Decimal values with sign prefixes are used for emphasis (and convenience) as
the immediate operands in the source program; their hexadecimal values appear in the left-hand column which
interlists the generated object code (opcode first, low byte, high byte). You can see that –10 is equivalent to
$FFF6 hexadecimal, while 20 is hexadecimal $0014. Examine this addition operation in binary:

   0000     C230                      REP         #$30                   16-bit registers
   0002                               LONGA       ON
   0002                               LONGI       ON
   0002
   0002     A9F6FF                    LDA         #-10
   0005     18                        CLC
   0006     691400                    ADC         #20

                                                    Fragment 9.9

Two things should become clear: that the magnitude of the result (10 decimal) is such that it will easily
fit within the number of bits available for its representation, and that there is a carry out of bit fourteen:

       1   1111    1111      111      1        carry from previous bit
           1111    1111      1111     0110     -10 decimal
           0000    0000      0001     0100     +20 decimal
       1   0000    0000      0000     1010     result is +10 decimal

In this case, the overflow flag is not set, because the carry out of the penultimate bit indicates wraparound
rather than overflow (or underflow). Whenever the two operands are different signs, carry out of the next-to-
highest bit indicates wraparound; the addition of a positive and a negative number (or vice versa) can result in a
number too large (try it), but it may result in wraparound.
         Conversely, overflow exists in the addition of two negative numbers if no carry results from the
addition of the next-to-highest (penultimate) bits. If two negative numbers are added without overflow, they
will always wrap around, resulting in a carry out of the next-to-highest bit. When wraparound has occurred, the
sign bit is set due to the carry out of the penultimate bit. In the case of the two negative numbers being added
(which always produces a negative result), this setting of the sign bit results in the correct sign. In the case of
the addition of two positive numbers, wraparound never occurs, so a carry out of the penultimate bit always
means that the overflow flag will be set.
         These rules likewise apply for subtraction; however, you must consider that subtraction is really an
addition with the sign of the addend inverted, and apply them in this sense.
         In order for the processor to determine the correct overflow flag value, it exclusive-or’s the carry out of
the penultimate bit with the carry out of the high-order bit (the value that winds up in the carry flag), and sets or


                                                                                                                  135
```

<!-- programmanual p136 -->

```
The Western Design Center
resets the overflow according to the result. By taking the exclusive-or of these two values, the overflow flag is
set according to the rules above.
         Consider the possible results:
         • If both values are positive, the carry will be clear; if there is no penultimate carry, the overflow flag,
             too, will be clear, because 0 XOR 0 equals 0; the value in the sign bit is zero, which is correct
             because a positive number plus a positive number always equals a positive number. On the other
             hand, if there is a penultimate carry, the sign bit will change. While there is still no final carry,
             overflow is set. The final carry (clear) xor penultimate carry (set) equals one. Whenever overflow
             is set, the sign bit of the result has the wrong value.
         • If the signs are different, and there is a penultimate carry (which means wraparound in this case),
             there will be a final carry. But when this is exlusive-or’d with the penultimate carry, it is canceled
             out, resulting in overflow being cleared. If, though, there were no penultimate carry, there would be
             no final carry; again, 0 XOR 0 = 0, or overflow clear. If the sign bit is cleared by the addition of a
             penultimate carry and the single negative sign bit, since wraparound in this case implies the
             translation from a negative to a positive number, the sign (clear) is correct. If there was no
             wraparound, the result is negative, and the sign bit is also correct (set).
         • Finally, if both signs are negative, there will always be a carry out of the sign bit. A carry out of
             the penultimate bit means wraparound (with a correctly negative result), so carry (set) XOR
             penultimate carry (set) equals zero and the overflow flag is clear. If, however, there is no carry,
             overflow (or rather, underflow) has occurred, and the overflow is set because XOR no carry equals
             one.
         The net result of this analysis is that, with the exception of overflow detection, signed arithmetic is
performed in the same way as unsigned arithmetic. Multiple-precision signed arithmetic is also done in the
same way as unsigned multiple-precision arithmetic; the sign of the two numbers is only significant when the
high-order word is added.
          When overflow is detected, it can be handled in three ways: treated as an error, and reported; ignored; or
responded to by attempting to extend the precision of the result. Although this latter case is not generally practical, you
must remember that, in this case, the value in the sign bit will have been inverted. Having determined the correct sign, the
precision may be expanded using sign extension, if there is an extra byte of storage available and your arithmetic routines
can work with a higher-precision variable. The method for extending the sign of a number involves the bit manipulation
instructions described in the next chapter; an example of it is found there.

Signed Comparisons

         The principle of signed comparisons is similar to that of unsigned comparisons: the relation of one
operand to another is determined by subtracting one from the other. However, the 65x CMP instruction, unlike
SBC, does not affect the v flag, so does not reflect signed overflow/underflow. Therefore, signed comparisons
must be performed using the SBC instruction. This means that the carry flag must be set prior to the
comparison (subtraction), and that the original value in the accumulator will be replaced by the difference.
Although the value of the difference is not relevant to the comparison operation, the sign is. If the sign of the
result (now in the accumulator) is positive (as determined according to rules outlined above for proper
determination of the sign of the result of a signed operation), then the value in memory is less than the original
value in the accumulator; if the sign is negative, it is greater. If, though, the result of the subtraction is zero,
then the values were equal, so this should be checked for first.
         The code for signed comparisons is similar to that for signed subtraction. Since a correct result need
not be completely formed, however, overflow can be tolerated since the goal of the subtraction is not to
generate a result that can be represented in a given precision, but only to determine the relationship of one value
to another. Overflow must still be taken into account in correctly determining the sign. The value of the sign
bit (the high-order bit) will be the correct sign of the result unless overflow has occurred. In that case, it is the
inverted sign.
         Listing 9.5 does a signed comparison of the number stored in VAL1 with the number stored in VAL2,
and sets RELATION to minus one, zero, or one, depending on whether VAL1 < VAL2, VAL1 = VAL2 or
VAL1 > VAL2, respectively:



                                                                                                                        136
```

<!-- programmanual p137 -->

```
The Western Design Center

 0001   0000                              KEEP       KL.9.5
 0002   0000                              65816      ON
 0003   0000
 0004   0000               COMPARE        START
 0005   0000
 0006   0000    18                        CLC
 0007   0001    FB                        XCE
 0008   0002    C230                      REP        #$30          turn 16-bit modes on
 0009   0004
 0010   0004                              LONGA      ON
 0011   0004                              LONGI      ON
 0012   0004
 0013   0004    9C2500                    STZ        RELATION      clear result cell
 0014   0007    AD2100                    LDA        VAL1
 0015   000A    38                        SEC
 0016   000B    ED2300                    SBC        VAL2
 0017   000E    F00E                      BEQ        SAME
 0018   0010    7007                      BVS        INVERT        if v set, invert meaning of sign
 0019   0012    3007                      BMI        LESS          bra if VAL1 is less than VAL2
 0020   0014    EE2500     GREATER        INC        RELATION      VAL1 is greater than VAL2
 0021   0017    8005                      BRA        SAME
 0022   0019    30F9       INVERT         BMI        GREATER       invert: bra if minus: minus = greater
 0023   001B    CE2500     LESS           DEC        RELATION
 0024   001E    38         SAME           CLC
 0025   001F    FB                        XCE
 0026   0020    60                        RTS
 0027   0021
 0028   0021    0000       VAL1           DS         2
 0029   0023    0000       VAL2           DS         2
 0030   0025    0000       RELATION       DS         2
 0031   0027
 0032   0027                              END

                                                   Listing 9.5

Decimal Mode

          All of the examples in this chapter have dealt with binary numbers. In certain applications, however,
such as numeric I/O programming, where conversion between ASCII and binary representation of decimal
strings is inconvenient, and business applications, in which conversion of binary fractions to decimal fractions
results in approximation errors, it is convenient to represent numbers in decimal form and, if possible, perform
arithmetic operations on them directly in this form.
          Like most processors, the 65x series provides a way to handle decimal representations of numbers.
Unlike most processors, it does this providing a special decimal mode that causes the processor to use decimal
arithmetic for ADC, SBC, and CMP operations, with automatic “on the fly” decimal adjustment. Most other
microprocessors, on the other hand, do all arithmetic the same, requiring a second “decimal adjust” operation to
convert back to decimal form the binary result of arithmetic performed on decimal numbers. As you remember
from Chapter 1, binary-coded-decimal (BCD) digits are represented in four bits as binary values from zero to
nine. Although values from $A to $F (ten to fifteen) may also be represented in four bits, these bit patterns are
illegal in decimal mode. So when $03 is added to $09, the result is $12, not $0C as in binary mode.
Each four-bit field in a BCD number is a binary representation of a single decimal digit, the rightmost being the
one’s place, the second the ten’s, and so on. Thus, the eight-bit accumulator can represent numbers in the range
0 through 99 decimal, and the sixteen-bit accumulator can represent numbers in the range 0 through 9999.
Larger decimal numbers can be represented in multiple-precision, using memory variables to store the partial
results and the carry flag to link the component fields of the number together, just as multiple-precision binary
numbers are.


                                                                                                             137
```

<!-- programmanual p138 -->

```
The Western Design Center

         Decimal mode is set via execution of the SED instruction (or a SEP instruction with bit three set). This
sets the d or decimal flag in the status register, causing all future additions and subtractions to be performed in
decimal mode until the flag is cleared.
         The default mode of the 65x processors is the binary mode with the decimal flag clear. It is important
to remember that the decimal flag may accidentally be set by a wild branch, and on the NMOS 6502, it is not
cleared on reset. The 65C02, 65802, and 65816 do clear the decimal flag on reset, so this is of slightly less
concern. Arithmetic operations intended to be executed in binary mode, such as address calculations, can
produce totally unpredictable results if they are accidentally executed in decimal mode.
         Finally, although the carry flag is set correctly in the decimal mode allowing unsigned multiple-
precision operations, the overflow flag is not, making signed decimal arithmetic, while possible, difficult. You
must create your own sign representation and logic for handling arithmetic based on the signs of the operands.
Borrowing from the binary two’s-complement representation, you could represent negative numbers as those
(unsigned) values which, when added to a positive number result in zero if overflow is ignored. For example,
99 would equal –1, since 1 plus 99 equals 100, or zero within a two-digit precision. 98 would be –2, and so on.
The different nature of decimal representation, however, does not lead itself to signed operation quite as
conveniently as does the binary two’s-complement form.




                                                                                                               138
```
