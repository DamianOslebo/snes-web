# Chapter 12 — The Subroutine

> Call/return in 8/16-bit incl. the 65816 JSL/RTL long pair (opcode table needs both).

## Contents (per the book's own TOC)

- JSR (p175)
- RTS (p175)
- JRS (p177)
- JSL (p178)
- RTL (p178)
- Branch to Subroutine (p179)
- Parameter Passing (p182)

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

## Body (pages 174–191)


<!-- programmanual p174 -->

```
The Western Design Center



12) Chapter Twelve
The Basic Building Block:
The Subroutine

         The feature essential to any processor to support efficient, compact code, as well as modular or top-
down programming methods, is a means of defining a subroutine. A subroutine is a block of code that can be
entered (called) repeatedly from various parts of a main program, and that can automatically return control to
the instruction following the calling instruction, wherever it may be. The 65x jump-to-subroutine instruction
provides just such a capability.
         When a jump-to-subroutine, or JSR, instruction is encountered, the processor first pushes its current
location onto the stack for purposes of returning, then jumps to the beginning of the subroutine code. At the end
of the subroutine code, a return-from-subroutine (RTS) instruction tells the processor to return from the
subroutine to the instruction after the subroutine call, which it locates by pulling the previously saved return
location from the stack.
         Because subroutines let you write a recurring section of program code just once and call it from each
place that it’s needed, they are the basis of top-down, structured programming. Common subroutines are often
collected together by programmers to form a library, from which they can be selected and reused as needed.
         Chapter 8, Flow of Control, introduced the 65x jump instructions – those flow-of-control instructions
which do not use the stack for return purposes. But discussion of the jump-to-subroutine instructions was put
off to this chapter.
         Table 12.1 lists the instructions to be explained in this chapter. In addition, this chapter will use the
simple example of a negation routine to illustrate how library routines (and routines in general) are written and
documented, and it examines the question of when to code a subroutine and when to use in-line code. Finally,
methods of passing information (or parameters) to and from subroutines are compared and illustrated.


                     Available on:
 Mnemonic            6502       65C02     65802/816      Description
 65x Subroutine Instructions:
    JSR                 x          x           x         jump to subroutine
    RTS                 x          x           x         return from subroutine
    JSL                                        x         long jump to subroutine
    RTL                                        x         long return from subroutine


                                        Table 12-1 Subroutine Instructions




                                                                                                              174
```

<!-- programmanual p175 -->

```
The Western Design Center

The Jump-To-Subroutine Instruction

        There is just one addressing mode available to the JSR instruction on the 6502 and 65C02 – absolute
addressing. This mode lets you code a subroutine call to a known location. When used on the 65816, that
location must be within the current program bank. It uses the absolute addressing syntax introduced earlier:

200020          JSR                $2000                jump to subroutine located at pb:$2000

or

200080          JSR                SUBR1                jump to subroutine SUBR1 in program bank

In the second case, the assembler determines the address of subroutine SUBR1.
         The processor, upon encountering a jump-to-subroutine instruction, first saves a return address. The
address saved is the address of the last byte of the JSR instruction (the address of the last byte of the operand),
not the address of the next instruction as is the case with some other processors. The address is pushed onto the
stack in standard 65x order – the low byte in the lower address, the high byte in the higher address – and done in
standard 65x fashion – the first byte is stored at the location pointed to by the stack pointer, the stack pointer is
decremented, the second byte is stored, and the stack pointer is decremented again. Once the return address has
been saved onto the stack, the processor loads the program counter with the operand value, thus jumping to the
operand location, as shown in Figure 12.1. Jumping to a subroutine has no effect on the status register flags.

The Return-from-Subroutine Instruction

        At the end of each subroutine you write, the one-byte RTS, or return-from-subroutine, instruction
must be coded. When the return-from-subroutine instruction is executed, the processor pulls the stored address
from the stack, incrementing the stack




                                                                                                                 175
```

<!-- programmanual p176 -->

```
The Western Design Center

                                                       Effective Address: New Program Counter Value
                                                       23             15              7             0
                                                                 Bank            High             Low

         Instruction:
                 Opcode        Operand Low             Operand High

         65816 Registers:
         23     Bank      15       High            7           Low      0
         Program Bank (PBR)



                           Program Counter (PC)                                           Stack   before
                                          Address of last JSR               Return Address High
                                            instruction byte                Return Address Low    Stack Pointer
                                                                                                  after

                                                                                 Bank 0




                                                       Figure 12-1 JSR


pointer by one before retrieving each of the two bytes to which it points. But the return address that was stored
on the stack was the address of the third byte of the JSR instruction. When the processor pulls the return
address off the stack, it automatically increments the address by one so that it points to the instruction following
the JSR instruction which should be executed when the subroutine is done. The processor loads this
incremented return address into the program counter and continues execution from the instruction following the
original JSR instruction, as Figure 12.2 shows.
         The processor assumes that the two bytes at the top of the stack are a return address stored by a JSR
instruction and that these bytes got there as the result of a previous LSR. But as a result, if the subroutine used
the stack and left it pointing to data other than the return address, the RTS instruction will pull two irrelevant
data bytes as the address to return to. Cleaning up the stack after using it within a subroutine is therefore
imperative.
         The useful side of the processor’s inability to discern whether the address at the top of the stack was
pushed there by a JSR instruction is that you can write a reentrant indirect jump using the RTS instruction.
First formulate the address to be jumped to, then decrement it by one (or better, start with an already-
decremented address), push it onto the stack (pushing first high byte, then low byte, so that it is in correct 65x
order on the stack) and, finally, code an RTS instruction. The return-from-subroutine pulls the address back off
the stack, increments it, and loads the result into the program counter to cause a jump to the location, as
Fragment 12.1 illustrates.

  0000           ;   16-bit accumulator holds address of code to jump to
  0000     3A        DEC         A     DEST – 1: address of byte before target
  0001     48        PHA               push it; now address is stacked as tho JSR
  0002     60        RTS               pull address; increment it; transfer control

                                                        Fragment 12.1

         Reentrancy is the ability of a section of code to be interrupted, then executed by the interrupting
routine, and still execute properly both for the interrupting routine and for the original routine when control is
returned to it. The interruption may be a result of a hardware interrupt (as described in the next chapter), or the
                                                                                                                  176
```

<!-- programmanual p177 -->

```
The Western Design Center

result of the routine calling itself, in which case the routine is said to be recursive. The keys to reentrancy are,
first, to be sure you save all important registers before reentering and, second to use no fixed memory locations
in the reentrant code. (There will be more on interrupts and reentrancy in the next chapters.)


                                                     Stack
                                         after      PC High
                                                                     +1         Program   Counter (PC)
                    Stack Pointer (S)               PC Low
                                        before

                                                     Bank 0



                                                 Figure 12-2 RTS


        The indirect jump using RTS qualifies for reentrancy: While normally you would code an indirect jump
by forming the address to jump to and storing it to an absolute address, then jumping indirect through the
address, this jump by use of RTS uses only registers and stack.
        A subroutine can have more than one RTS instruction. It’s common for subroutine from internal loops
upon certain error conditions, in addition to returning normally from one or more locations. Some structured
programming purists would object to this practice, but the efficiency of having multiple exit points is
unquestionable.
        Returning from a subroutine does not affect the status flags.

JRS Using Absolute Indexed Indirect Addressing
         The 65802/65816 gives JSR another addressing mode – absolute indexed indirect (covered in the last
chapter) which lets your program select, on the basis of the index in the register, a subroutine location from a
table of such locations and call it:

  FC0080           JSR              (TABLE,X)           JSR to indirect address in (TABLE at X)

The array Table must be located in the program bank. The addressing mode assumes that a table of locations of
routines would be part of the program itself and would be loaded, right along with the routines, into the bank
holding the program. The indirect address (the address with which the program counter will be loaded), a
sixteen-bit value, is concatenated with the program bank register, resulting in a transfer within the current
program bank. If the addition of X causes a result greater than $FFFF, the effective address will wrap,
remaining in the current program bank, unlike the indexing across banks that occurs for data accesses.
         This addressing mode also lets you do an indirect jump-to-subroutine through a single double-byte cell
by first loading the X register with zero. You must remember in coding this use for the 65816, however, that
the cell holding the indirect address is in the program bank, not bank zero as with absolute indirect jumps.
         The indexed indirect jump-to-subroutine is executed in virtually the same manner as the absolute jump-
to-subroutine: the processor pushes the address of the final byte of the instruction onto the stack as a return
address; then the address in the double-byte cell pointed to by the sum of the operand and the X index register is
loaded into the program counter.
         There is no difference between returning from a subroutine called by this instruction and returning from
a subroutine called by an absolute JSR. You code an RTS instruction which, when executed, causes the
address on the top of the stack to be pulled and incremented to point to the instruction following the JSR, then
to be loaded into the program counter to give control to that instruction.




                                                                                                                177
```

<!-- programmanual p178 -->

```
The Western Design Center

The Long Jump to Subroutine

        A third jump-to-subroutine addressing mode is provided for programming in the 16-megabyte address
space of the 65816 – absolute long addressing. Jump-to-subroutine absolute long is a four-byte instruction, the
operand a 24-bit address in standard 65x order (the low byte of the 24-bit address is in the lowest memory
location immediately following the opcode and the high byte is next, followed by the bank byte):

  22563412          JSR              $123456           jump to subroutine at $3456 in bank $12

         This time a three-byte (long) return address is pushed onto the stack. Again it is not the address of the
next instruction but rather the address of the last byte of the JSR instruction which pushed onto the stack (the
address of the fourth byte the JSR instruction in this case). As Figure 12.3 shows, the address is pushed onto
the stack in standard 65x order: low byte in the lower address, high byte in the higher address, bank byte in the
highest address (which also means the bank byte is the first of the three pushed, the low byte last).
         Jumping long to a bank zero subroutine requires the greater-than (>) sign, as explained in the last
chapter:

  22563400          JSR              >$3456            long jump to subroutine at $3456 in bank 0

The greater-than sign forces long addressing to bank zero, voiding the assembler’s normal assumption to use
absolute addressing to jump to a subroutine at $3456 in the current program bank.
        To avoid this confusion altogether, there is an equivalent standard mnemonic for jump-to-subroutine
long – JSL:

22563400            JSL              $3456             long jump to subroutine at $3456 in bank 0

or

22563402            JSL              $023456           long jump to subroutine at $3456 in bank 2

         Using an alternate mnemonic is particularly appropriate for jump-to-subroutine long, since this
instruction requires you to use an entirely different return-from-subroutine instruction – RTL, or return-from-
subroutine long.

                                             Stack
                                                                         before
             Return Address           Return Address Bank
                                      Return Address High                         Stack   Pointer (S)
       (last JSR instruction byte)    Return Address Low
                                                                          after

                                              Bank 0


                                                   Figure 12-3 JSL


Return from Subroutine Long

         The return from subroutine instruction pops two bytes off the stack as an absolute address, increments
it, and jumps there. But the jump to subroutine long instruction pushes a three-byte address onto the stack – a
long return address that points to the original code, and is typically in a bank different from the subroutine bank.
         So the 65816 provides a return from subroutine long instruction, RTL. This return instruction first
pulls, increments, and loads the program counter, just as RTS does; then it pulls and loads a third byte, the
program bank register, to jump long to the return address. This is illustrated in Figure 12.4.

                                                                                                                178
```

<!-- programmanual p179 -->

```
The Western Design Center

Branch to Subroutine

        One of the glaring deficiencies of the 6502 was its lack of support for writing relocatable code;
the 65802 and 65816 address this deficiency, but still lack the branch-to-subroutine instruction some
other processors provide. There is no instruction that lets you call a subroutine with an operand that is
program counter relative, not an absolute address. Yet, to write relocatable code easily, a BSR
instruction is required: suppose a relocatable program assembled at $0 has an often-called multiply
subroutine at $07FE; if the program is later loaded at $7000, that subroutine is at $77FE; obviously, a
JSR to $07FE will fail.


                               after         Stack
                                        Program Bank (PBR)           Program Bank (PBR)
        Stack   Pointer (S)                   PC High
                                              PC Low          +1                 Program    Counter (PC)
                               before


                                             Bank 0


                                                  Figure 12-4 RTL


        The 65802 and 65816 can synthesize the BSR function using their PER instruction. You use PER to
compute and push the current run-time return address; since its operand is the return address’ relative offset
(from the current address of the PER instruction), PER provides relocatability. As Fragment 12.2 shows, once
the correct return address is on the stack, a BRA or BRL completes the synthesized BSR operation.

       0000                              .
       0000                              .
       0000
       0000     62FC7F                   PER      RETURN-1    push run-time return address
       0003     82FA7F                   BRL      SUBR1       intra-bank relative branch is BSR
       0006                   RETURN     .                    continue processing here
       0006                              .
       0006                              .
       0006
       0006
       0006                   SUBR1      .
       0006                              .                    execute subroutine function
       0006                              .
       0006                              .
       0006     60                       RTS                  return from subroutine

                                                   Fragment 12.2

         In this case, you specify as the assembler operand the symbolic location of the routine you want to
return to minus one. Remember that the return address on the stack is pulled, then incremented, before control
is passed to it. The assembler transforms the source code operand, RETURN – 1, into the instruction’s object
code operand, a relative displacement from the next instruction to RETURN – 1. In this case, the displacement
is $0002, the difference between the first byte of the BRL instruction and its last byte. (Remember, PER works
the same as the BRL instruction; in both cases, the assembler turns the location you specify into a relative
displacement from the program counter.) When the instruction is executed, the processor adds the displacement
($0002, in this case) to the current program counter address (the address of the BRL instruction); the resulting
sum is the current absolute address of RETURN – 1, which is what is pushed onto the stack.

                                                                                                            179
```

<!-- programmanual p180 -->

```
The Western Design Center

        If at run-time the PER instruction is at $1000, then the BRL instruction will be at $1003, and
RETURN at $1006. Execution of PER pushes $1005 onto the stack, and the program branches to SUBR1.
The RTS at the end of the subroutine causes the $1005 to be pulled from the stack, incremented to $1006 (the
address of RETURN), and loaded into the program counter.
        If, on the other hand, the instructions are at $2000, $2003, and $2006, then $2005 is pushed onto the
stack by execution of PER, then pulled off again when RTS is encountered, incremented to $2006 (the current
run-time address of RETURN), and loaded into the program counter.
        If a macro assembler is available, synthetic instructions such as this are best dealt with by burying this
code in a single macro call.

Coding a Subroutine: How and When

         The uses of subroutines are many. At the simplest level, they let you compact in a single location
instructions that would otherwise be repeated if coded in-line. Programmers often build up libraries of general
subroutines from which they can pluck the routine they want for use in a particular program; even if the routine
is only called once, this allows quick coding of commonly used functions.
         The next few pages will look at a simple logic function for the 65x processors – forming the negation
(two’s complement) of eight- and sixteen-bit numbers – and how such a routine is written. Also covered is how
subroutines in general (and library routines in particular) should be documented.
         The 65x processors have no negate instruction, so the two’s complement is formed by complementing
the number (one’s complement) and adding one.

6502 Eight-Bit Negation – A Library Example

         If the value to be negated is an eight-bit value, the routine in Listing 12.1 will yield the desired result.

  0001     0000                             KEEP      KL.12.1
  0002     0000
  0003     0000             ; NEGACC - -
  0004     0000             ;
  0005     0000             ; Negate the 8-bit value in the accumulator
  0006     0000             ; On entry: Value to be negated is in accumulator
  0007     0000             ; On exit: Value now negated is in accumulator
  0008     0000
  0009     0000             NEGACC          START
  0010     0000     46FF                    EOR       #$11111111        form one’s complement
  0011     0002     18                      CLC                         prepare to add one
  0012     0003     6901                    ADC       #1                add one
  0013     0005     60                      RTS                         return
  0014     0006                             END

                                                      Listing 12.1

        It is extremely important to clearly document library routines. Perhaps the best approach is to begin
with a block comment at the head of the routine, describing its name, what the routine does, what it expects as
input, what direct page locations it uses during execution, if the contents of any registers or any memory special
locations are modified during execution, and how and where results are returned.
        By documenting the entry and exit conditions as part of the header, as in the example, when the routine
is used from a library you won’t have to read the code to get this information. Although this example is quite
simple, when applied to larger, more complex subroutines, the principle is the same: document the entry and
exit conditions, the function performed, and any side effects.
        As a subroutine, this code to negate the accumulator takes six bytes. Each JSR instruction takes three.
So calling it twice from a single program requires 12 bytes of code; if called three times, 15 bytes; if four, 18
bytes.

                                                                                                                    180
```

<!-- programmanual p181 -->

```
The Western Design Center

         On the other hand, if this code were in-line once, it would take only five bytes, but each additional time
it is needed would require another five bytes, so using it twice takes 10 bytes, three times takes 15, and four
times takes 20. You can see that only if you need to negate the accumulator four or more times does calling as a
subroutine make sense in view of object byte economy.

65C02, 65802, and 65816 Eight-Bit Negation

      The addition of the accumulator addressing mode for the INC increment instruction on the
65C02, 65802, and 65816 means no subroutine is required for negating an eight-bit value in the
accumulator on these processors: the in-line code in Fragment 12.3 takes only three bytes.

  0000     49FF            EOR    #%11111111           form one’s complement of accum
  0002     1A              INC    A                    increment the accum by one

                                                   Fragment 12.3.

Since the in-line code takes the same number of bytes as the JSR instruction, you would lose four bytes (the
number in the subroutine itself) by calling it as a subroutine.

6502 Sixteen-Bit Negation

        Negating sixteen-bit values makes even more sense as a subroutine on the 6502. One method, given the
previously-coded routine NEGACC, is shown in Listing 12.2.

   0001      0000                         KEEP        KL.12.2
   0002      0000
   0003      0000
   0004      0000             ; Negate the 16-bit value in registers X – A (hi-lo)
   0005      0000             ; On entry: Value to be negated is in X – A (hi-lo)
   0006      0000             ; On exit:    Value now negated is in A – Y (hi-lo)
   0007      0000             ;             X is unchanged
   0008      0000             ;             must be linked with NEGACC
   0009      0000
   0010      0000             NEGXA START
   0011      0000             ; first call the 8-bit negation routine defined a few pages back
   0012      0000   200080                   JSR         NEGACC           negate the low 8 bits in the accum
   0013      0003             ; then get and negate the high 8 bits
   0014      0003   A8                       TAY
   0015      0004   8A                       TXA                          get high 8 bits into accum
   0016      0005   49FF                     EOR         #%11111111 form one’s complement
   0017      0007   6900                     ADC                          add carry from adding 1 to low byte
   0018      0009   60                       RTS                          return
   0019      000A                            END

                                                     Listing 12.2

          Here, one subroutine (NEGXA) calls another (the subroutine described previously that negates eight
bits).

65802 and 65816 Sixteen-Bit Negation

         Fragment 12.4 shows that on the 65802 and 65816, the sixteen-bit accumulator can be negated in-line in
only four bytes. As a result, a subroutine to negate the sixteen-bit accumulator would be inefficient, requiring
five calls to catch up with the on-byte difference; in addition, you should note that there is a speed penalty
associated with calling a subroutine – the time required to executed the JSR and RTS instructions.
                                                                                                                181
```

<!-- programmanual p182 -->

```
The Western Design Center

   0000    49FFFF           EOR          #$FFFF             form one’s complement of accum
   0003    1A               INC          A                  increment the accum by one

                                                  Fragment 12.4

Parameter Passing

         When dealing with subroutines, which by definition are generalized pieces of code used over and over
again, the question of how to give the subroutine the information needed to perform its function must be
considered. Values passed to or from subroutines are referred to as the parameters of the subroutine.
Parameters can include values to be acted upon, such as two numbers to be multiplied, or may be information
that defines the context or range of activity of the subroutine. For example, a subroutine parameter could be the
address of a region of memory to work on or in, rather than the actual data itself.
         The preceding examples demonstrated one of the simplest methods of parameter-passing, by using the
registers. Since many of the operations that are coded are subroutines in assembly language are primitives that
operate on a single element, like “print a character on the output device” or “convert this character from binary
to hexadecimal,” passing parameters in registers is probably the approach most commonly found.
         A natural extension of this approach, which is particularly appropriate for the 65802 and 65816, but
also possible on the 6502 and 65C02, is to pass the address of a parameter list in a register (or, on the 6502 and
65C02, in two registers). Listing 12.3 gives example.




                                                                                                              182
```

<!-- programmanual p183 -->

```
The Western Design Center

   0001   0000                               KEEP          KL.12.3
   0002   0000                               65816         ON
   0003   0000
   0004   0000              L123             START
   0005   0000   18                          CLC
   0006   0001   FB                          XCE
   0007   0002
   0008   0002   E220                        SEP           #$20             8-bit accumulator
   0009   0004                               LONGA         OFF
   0010   0004
   0011   0004   C210                        REP           #$10             16-bit index register
   0012   0006                               LONGI         ON
   0013   0006
   0014   0006   A21500                      LDX           #STRING1         pass the address of STRING1 to PRSTRNG
   0015   0009   2000080                     JSR           PRSTRNG          print STRING1
   0016   000C
   0017   000C   A22800                      LDX           #STRING2         pass the address of STRING2 to PRSTRNG
   0018   000F   200080                      JSR           PRSTRNG          print STRING2
   0019   0012
   0020   0012   38                          SEC
   0021   0013   FB                          XCE
   0022   0014   60                          RTS
   0023   0015
   0024   0015   54686973   STRING1          DC            C ’This is string one’, H ‘00’
   0025   0028   54686973   STRING2          DC            C ‘This is string two’, H ‘00’
   0026   003B
   0027   003B                               END
   0028   0000
   0029   0000              ; print a string of characters terminated by a 0 byte
   0030   0000              ; on entry: X register holds location of string
   0031   0000
   0032   0000              PRSTRNG          START
   0033   0000   BD0000     TOP              LDA           !0,X             get char at index position in string
   0034   0003   F006                        BEQ           DONE             if character is 0, return
   0035   0005   200080                      JSR           COUT             print character in accum
   0036   0008   E8                          INX
   0037   0009   80F5                        BRA           TOP
   0038   000B   60         DONE             RTS
   0039   000C
   0040   000C                               END
   0041   0000
   0042   0000              ;                COUT
   0043   0000              ;                machine-dependent routine to output a character
   0044   0000              ;
   0045   0000              COUT             START
   0046   0000              ECOUT            GEQU          $FDED            Apple / / COUT
   0047   0000   48                          PHA                            Save registers
   0048   0001   DA                          PHX
   0049   0002   5A                          PHY
   0050   0003   08                          PHP                            and status,
   0051   0004   38                          SEC                            switch to emulation
   0052   0005   FB                          XCE
   0053   0006   20EDFD                      JSR           ECOUT            call 6502 routine
   0054   0009   18                          CLC
   0055   000A   FB                          XCE                            restore native mode
   0056   000B   28                          PLP                            restore status
   0057   000C   7A                          PLY                            restore register
   0058   000D   FA                          PLX                            return
   0059   000E   68                          PLA
   0060   000F   60                          RTS
   0061   0010                               END

                                                   Listing 12.3



                                                                                                                     183
```

<!-- programmanual p184 -->

```
The Western Design Center

         By loading the X register with the address of a string constant, the subroutine PRSTRNG has all the
information it needs to print the string at that address each time it is called. The data at the address passed in a
register could also be a more complex data structure than a string constant.
         On the 6502 and 65C02, a sixteen-bit address has to be passed in two registers. Because of this,
parameters are often passed in fixed memory locations. Typically, these might be direct page addresses.
Listing 12.4 gives an example of this method.

  0001    0000                               KEEP        KL.12.4
  0002    0000
  0003    0000
  0004    0000                 ;             6502/65C02 example
  0005    0000
  0006    0000                 PEX           START
  0007    0000
  0008    0000                 PARAM         GEQU        $80
  0009    0000
  0010    0000     A200                      LDX         #>STRING1        load high byte of STRING1’s address
  0011    0002     8681                      STX         PARAM+1          store the high byte of direct page cell
  0012    0004     A20C                      LDX         #<STRING1        load low byte of STRING1’s address
  0013    0006     8680                      STX         PARAM            store to low byte of direct page cell
  0014    0008     2000080                   JSR         PRSTRNG          print STRING1
  0015    0008     60                        RTS
  0016    000C
  0017    000C     54686973    STRING1       DC          C ‘This is string one’, H’00’
  0018    001F
  0019    001F                               END
  0020    0000
  0021    0000                 ; print a string of characters terminated by a 0 byte
  0022    0000                 ; on entry: direct page location PARAM holds address of string
  0023    0000
  0024    0000                 PRSTRNG       START
  0025    0000                 COUT          GEQU        $FDED            Apple / / output routine
  0026    0000
  0027    0000     A000                      LDY         #0               start at string position zero
  0028    0002     B180        LOOP          LDA         (PARAM),Y        get char at index position in string
  0029    0004     F006                      BEQ         DONE             if character is 0, return
  0030    0006     20EDFD                    JSR         COUT             print character in accum
  0031    0009     C8                        INY                          point to next char
  0032    000A     D0F6                      BNE         LOOP             loop thru string: must be < 256
  0033    000C     60          DONE          RTS
  0034    000D
  0035    000D
  0036    000D                               END

                                                    Listing 12.4

        Unfortunately, it takes eight bytes to set up PARAM each time PRSTRNG is called. As a result, a
frequently used method of passing parameters to a subroutine is to code the data in-line, immediately following
the subroutine call. This technique (see Fragment 12.5) uses no registers and no data memory, only program
memory.




                                                                                                                    184
```

<!-- programmanual p185 -->

```
The Western Design Center

   0000                             .
   0000                             .
   0000    2000080                  JSR     PRSTRNG print the following string
   0003    54686520                 DC      C ‘The string to be printed’, H ‘00’
   001C                 REUTRN      .                      execution continues here
   001C                             .
   001C                             .
   001C                             .
   001C

                                                  Fragment 12.5

         This method looks, at first glance, bizarre. Normally, when a subroutine returns to the calling section of
code, the instruction immediately following the JSR is executed. Obviously, in this example, the data stored at
that location is not executable code, but string data. Execution should resume instead at the label RETURN,
which is exactly what happens using the PRSTRNG coded in Listing 12.5. The return address pushed onto the
stack by the JSR is not a return address at all; it is, rather, the parameter to PRSTRNG.




                                                                                                               185
```

<!-- programmanual p186 -->

```
The Western Design Center

 0001   0000                               KEEP         KL.12.5
 0002   0000                               65816        ON
 0003   0000
 0004   0000                PRSTRNG        START
 0005   0000
 0006   0000    18                         CLC
 0007   0001    FB                         XCE
 0008   0002
 0009   0002    E220                       SEP          #$20         8-bit accum
 0010   0004                               LONGA        OFF
 0011   0004
 0012   0004    C210                       REP          #$10         16-bit index regs
 0013   0006                               LONGI        ON
 0014   0006
 0015   0006    FA                         PLX                       pull return address
 0016   0007    E8                         INX                       and increment to point JSR to string
 0017   0008    BD0000      LOOP           LDA          !0,X         get char at index position in string
 0018   000B    F006                       BEQ          DONE         if character is 0, return
 0019   000D    200080                     JSR          COUT         print char in accum
 0020   0010    E8                         INX                       point to next char
 0021   0011    80F5                       BRA          LOOP         loop thru string
 0022   0013
 0023   0013                ; push pointer to zero-terminator as return addr (RETURN-1)
 0024   0013
 0025   0013    DA          DONE           PHX
 0026   0014    60                         RTS                       return to label RETURN
 0027   0015                               END
 0028   0000
 0029   0000
 0030   0000                ;              COUT
 0031   0000                ;              machine-dependent routine to output a character
 0032   0000                ;
 0033   0000                COUT           START
 0034   0000                ECOUT          GEQU         $FDED        Apple / / COUT
 0035   000     48                         PHA                       Save registers
 0036   0001    DA                         PHX
 0037   0002    5A                         PHY
 0038   0003    08                         PHP                       and status,
 0039   0004    38                         SEC                       switch to emulation
 0040   0005    FB                         XCE
 0041   0006    20EDFD                     JSR          ECOUT        call 6502 routine
 0042   0009    18                         CLC
 0043   000A    FB                         XCE                       restore native mode
 0044   000B    28                         PLP                       restore status
 0045   000C    7A                         PLY                       restore registers
 0046   000D    FA                         PLX                       return
 0047   000E    68                         PLA
 0048   000F    60                         RTS
 0049   0010                               END

                                                      Listing 12.5

        The parameter address on the stack need only be pulled and incremented once, and the data can then be
accessed in the same manner as in the foregoing example. Since the loop terminates when the zero end-of-
string marker is reached, pushing its address in the X register onto the stack gives RTS a correct return, value –
RETURN-1 – the byte before the location where execution should resume. Note that the data bank is assumed
to equal the program bank.
        The advantage of this method is in bytes used: there is no need for any explicit parameter-passing by
the calling code, and the JSR mechanism makes the required information available to the subroutine
automatically. In fact, for most applications on all four 65x microprocessors, this method uses fewer bytes for
passing a single parameter than any other.
        One slight disadvantage of this method is that if the string is to be output more than once, it and its
preceding JSR must be made into a subroutine that is called to output the string.
                                                                                                              186
```

<!-- programmanual p187 -->

```
The Western Design Center

        A second disadvantage to this method comes in calling routines to which more than one parameter must
be passed. This last example demonstrated how a parameter (the address of the string) can be implicitly passed
on the stack. But there is no way to extend the principle so two parameters could be implicitly passed, for
instance, to a routine that compares two strings. On the other hand, parameter can also be explicitly passed on
the stack. The push effective address instructions and stack-relative addressing modes make this all the easier,
as Fragment 12.6 and Listing 12.6 show.

  0000    F40080        PEA       STRING1           push address of STRING1 onto stack
  0003    F40080        PEA       STRING2           push address of STRING2 onto stack
  0006    200080        JSR       COMPARE           compare the two
  0009                  .                           return and continue processing
  0009                  .
  0009                  .

                                                         Fragment 12.6

  0001   0000                                   KEEP          KL.12.6
  0002   0000                                   65816         ON
  0003   0000
  0004   0000                 ; compare two strings of characters, each terminated by a 0 byte
  0005   0000                 ; on entry: locs of strings are stacked just below the return addr
  0006   0000                 ; on exit : carry clear if chars match up to len of shortest string
  0007   0000                 ;                     else carry set for no match
  0008   0000
  0009   0000                 COMPARE           START
  0010   0000
  0011   0000      08                           PHP                        assume native mode; save status
  0012   0001
  0013   0001      C210                         REP           #$10
  0014   0003                                   LONGI         ON
  0015   0003                                   SEP           #$20
  0016   0005                                   LONGA         OFF
  0017   0005
  0018   0005      A00000                       LDY           #0
  0019   0008      B303       LOOP              LDA           (3,S),Y      get character from first string
  0020   000A      F007                         BEQ           PASS         if zero, end of string: match
  0021   000C      D305                         CMP           (5,S),Y      compare to corresponding char in 2nd string
  0022   000E      D006                         BNE           FAIL         branch if not equal; probably failure
  0023   0010      C8                           INY                        else do next pair
  0024   0011      80F5                         BRA           LOOP
  0025   0013
  0026   0013
  0027   0013                 ;                 matches shortest string: ok
  0028   0013
  0029   0013      28         PASS              PLP                        restore previous status
  0030   0014      18                           CLC                        but clear carry
  0031   0015      60                           RTS
  0032   0016      B305
  0033   0016      F0F9       FAIL              LDA           (5,S),Y      was last failure due to end of string2?
  0034   0018      F0F9                         BEQ           PASS         yes; let it pass
  0035   001A
  0036   001A      28                           PLP                        restore previous status
  0037   001B      38                           SEC                        sorry, no good
  0038   001C      60                           RTS
  0039   001D
  0040   001D                                   END

                                                           Listing 12.6

        This example, which compares two strings to see if they are equal up to the length of the shorter of the
two strings, uses parameters that have been explicitly passed on the stack. This approach, since it explicitly
passes the address of the strings, lets them be located anywhere and referred to any number of times. Its

                                                                                                                         187
```

<!-- programmanual p188 -->

```
The Western Design Center

problem is that when the subroutine returns, the parameters are left on the stack. Clearly, the subroutine should
clean up the stack before returning; however, it can’t simply pull the parameters off, because the return address
is sitting on top of the stack (which explains why stack offsets of three and five, rather than one and three, are
used).
          Perhaps the cleanest way to pass parameters on the stack prior to a subroutine call is to decompose the
JSR instruction into two: one to push the return address, the other to transfer to the subroutine. The push
effective address instructions again come in handy. Fragment 12.7 shows how the parameters to the routine in
Listing 12.7 are passed.

 0000                            .
 0000                            .
 0000    F4FF7F                  PEA    RETURN-1       push return addr before parameters
 0003    F40080                  PEA    STRING1        push address of STRING1 onto stack
 0006    F40080                  PEA    STRING2        push address of STRING2 onto stack
 0009    4C0080                  JMP    COMPARE        compare them
 000C              RETURN        .                     continue processing
 000C                            .
 000C                            .
 000C

                                                 Fragment 12.7




                                                                                                              188
```

<!-- programmanual p189 -->

```
The Western Design Center


 0001    0000                              KEEP         KL.12.7
 0002    0000                              65816        ON
 0003    0000
 0004    0000              ; compare two strings of characters, each terminated by a 0 byte
 0005    0000              ; on entry: locs of strings are at top of stack
 0006    0000              ;                      return address is stacked just beneath
 0007    0000              ; on exit: carry clear if chars match up to len of shortest string
 0008    0000              ;                      else carry set for no match
 0009    0000
 0010    0000              COMPARE         START
 0011    0000
 0012    0000    08                        PHP                       assume native mode; save status
 0013    0000
 0014    0001    C210                      REP          #$10
 0015    0003                              LONGI        ON
 0016    0003
 0017    0003    E220                      SEP          #$20
 0018    0005                              LONGA        OFF
 0019    0005
 0020    0005    A00000                    LDY          #0
 0021    0008    B301      LOOP            LDA          (1,S),Y      get character from first string
 0022    000A    F007                      BEQ          PASS         if zero, end of string: match
 0023    000C    D303                      CMP          (3,S),Y      compare to corresponding char in 2nd string
 0024    000E    D007                      BNE          FAIL         bra if not equal; probably failure
 0025    0010    C8                        INY                       else do next pair
 0026    0011    80F5                      BRA          LOOP
 0027    0013
 0028    0013              ;               matches shortest string
 0029    0013
 0030    0013    28        PASS            PLP                       they match up to shortest string;
 0031    0014    18                        CLC                       restore status, but clear carry
 0032    0015    8006                      BRA          EXIT
 0033    0017
 0034    0017    B303      FAIL            LDA          (3,S),Y      was last failure due to end of string2?
 0035    0019    F0F8                      BEQ          PASS         yes, let it pass
 0036    001B    28                        PLP                       restore status, but set carry (no match)
 0037    001C    38                        SEC
 0038    001D
 0039    001D    FA        EXIT            PLX                       clean up stack: remove both 16-bit params
 0040    001E    FA                        PLX
 0041    001F    60                        RTS                       now return
 0042    0020
 0043    0020                              END

                                                    Listing 12.7

       Since the return address was pushed first, the parameter addresses on the stack are accessed via offsets
of one and three. Before returning, two pull instructions pop the parameters off the stack, then the RTS is
executed, which returns control to the main program with the stack in order.
      Passing parameters on the stack is particularly well suited for both recursive routines (routines
that call themselves) and reentrant routines (routines that can be interrupted and used successfully both
by the interrupting code and the original call) because new memory is automatically allocated for
parameters for each invocation of the subroutine. This is the method generally used by most high-
level languages that support recursion.
        Fragment 12.8 sets up multiple parameters implicitly passed on the stack by coding after the JSR, not
data, but pointers to data. The routine called is in Listing 12.8.

                                                                                                                   189
```

<!-- programmanual p190 -->

```
The Western Design Center

  0000                          .
  0000                          .
  0000   200080                 JSR    COMPARE           compare two strings; addresses follow
  0003   0080                   DC     A ‘STRING1’       address of STRING1
  0005   0080                   DC     A ‘STRING2’       address of STRING2
  0007              RETURN      .                        continue processing
  0007                          .
  0007                          .
  0007

                                                  Fragment 12.8

        While this subroutine, unlike the previous one, uses a dozen bytes just getting itself ready to start, each
call requires only seven bytes (three for the JSR, and two each for the parameters), while each call to the
previous routine required twelve bytes (three PERs at three bytes each plus three for the JMP).
        Apple Computer’s ProDOS operating system takes this method a step further: all operating system
routines are called via a JSR to a single ProDOS entry point. One of the parameters that follow the JSR
specifies the routine to be called, the second parameter specifies the address of the routine’s parameter block.
This method allows the entry points of the internal ProDOS routines to “float” from one version of ProDOS to
the next; user programs don’t need to know where any given routine is located.




                                                                                                               190
```

<!-- programmanual p191 -->

```
The Western Design Center

 0001   0000                                KEEP         KL.12.8
 0002   0000                                65816        ON
 0003   0000
 0004   0000                ; compare two strings of characters, each terminated by a 0 byte
 0005   0000                ; on entry: increment address at top of stack: pts to loc of 1st str
 0006   0000                ;            incr twice more to point to loc of 2nd str
 0007   0000
 0008   0000                COMPARE         START
 0009   0000
 0010   0000   C210                         REP          #$10        caller must save and
 0011   0002                                LONGI        ON          restore mode status
 0012   0002
 0013   0002   E220                         SEP          #$20
 0014   0004                                LONGA        OFF
 0015   0004
 0016   0004   7A                           PLY
 0017   0005   C8                           INY                      points to indirect address of 1st str
 0018   0006   B90000                       LDA          !0,Y        load accum with address of 1st string
 0019   0009   C8                           INY
 0020   000A   C8                           INY                      point Y to indirect addr of 2nd string
 0021   000B   BE0000                       LDX          !0,Y        load X with address of 2nd string
 0022   000E   C8                           INY                      point Y to RETURN-1 for RTS
 0023   000F   5A                           PHY                      and push it onto stack for RTS
 0024   0010   A8                           TAY                      load Y with address of 1st string
 0025   0011
 0026   0011   B90000       LOOP            LDA          !0,Y        get character from first string
 0027   0014   F009                         BEQ          PASS        if zero, end of string: match
 0028   0016   DD0000                       CMP          !0,X        compare to corresponding char in 2nd string
 0029   0019   D006                         BNE          FAIL        bra if not equal; probably failure
 0030   001B   C8                           INY                      else do next pair
 0031   001C   E8                           INX
 0032   001D   80F2                         BRA          LOOP
 0033   001F   18           PASS            CLC                      they match up to shortest string;
 0034   0020   60                           RTS
 0035   0021   BD0000       FAIL            LDA          !0,X        was last failure due to end of string2?
 0036   0024   F0F9                         BEQ          PASS        yes; let it pass
 0037   0026   38                           SEC                      sorry, no good
 0038   0027   60           EXIT            RTS                      now return!
 0039   0028
 0040   0028                                END

                                                    Listing 12.8




                                                                                                                   191
```
