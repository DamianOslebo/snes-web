# Chapter 8 — The Flow of Control

> Branches: offsets, sign, wrap — relevant to the assembler's relative-target encoding.

## Contents (per the book's own TOC)

- Jump Instructions (p112)
- Conditional Branching (p114)
- Branch on N/V/Z/C (p115-119)
- Limitations of Branches (p119)
- Unconditional Branching (BRL) (p119)

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

## Body (pages 111–121)


<!-- programmanual p111 -->

```
The Western Design Center


8) Chapter Eight
The Flow of Control
         Flow of control refers to the way in which a processor, as it executes a program, makes its way through
the various sections of code. Chapter 1 discussed four basic types of execution: straight-line, selection between
paths, looping, and subroutines. This chapter deals with those instructions that cause the processor to jump or
branch to other areas of code, rather than continuing the default straight-line flow of execution. Such
instructions are essential to selection and looping.
         The jump and branch instructions alter the default flow of control by causing the program counter to
be loaded with an entirely new value. In sequential execution, on the other hand, the program counter is
incremented as each byte from the code stream – opcode or operand – is fetched.
         The 65x processors have a variety of branch and jump instructions, as shown in Table 8.1. Of these,
when coding in the larger-than-64K environment of the 65816, only the three jumping-long instructions (jump
indirect long, jump absolute long, and jump subroutine long) and the return from subroutine long instruction are
capable of changing the program bank register – that is, of jumping to a segment of code in another bank. All
of the other branch or jump instructions simply transfer within the current bank. In fact, the interrupt
instructions (break, return from interrupt, and coprocessor instructions) are the only others which can change the
program bank; there is no direct way to modify the program counter bank without at the same time modifying
the program counter register because the program counter would still point to the next instruction in the old
bank.

                                    Available on:
           Mnemonic        6502      65C02      65802/816                     Description
             BEQ            x          x            x        branch on condition instruction
                                                             (eight)
             JMP             x         x            x        jump absolute
             JMP             x         x            x        jump indirect
             JSR             x         x            x        jump subroutine absolute
             RTS             x         x            x        return from subroutine
             BRA                       x            x        branch always (unconditional)
             JMP                       x            x        jump absolute indexed indirect
             BRL                                    x        branch long always
                                                             (unconditional, 64K range)
              JSR                                   x        jump to subroutine absolute
                                                             indexed indirect
              JMP                                   x        jump indirect long (interbank)
              JMP                                   x        jump absolute long (interbank)
              JSL                                   x        jump subroutine long
                                                             (interbank)
              RTL                                   x        return from subroutine long
                                                             (interbank)


                                    Table 8-1. Branch and Jump Instructions

        As you many have noticed, all of the flow-of-control instructions (except the return instructions) can be
divided into two categories: jump-type instructions and branch-type instructions. This division is based on
addressing modes: branch instructions use program counter relative addressing modes; jump instructions don’t.
        Jump instruction can be further split into two groups: those which transfer control to another section of
code, irreversibly, and those which transfer control to a subroutine, a section of code which is meant to
eventually return control to the original (calling) section of code, at the instruction following the jump-to-
subroutine instruction.


                                                                                                              111
```

<!-- programmanual p112 -->

```
The Western Design Center

         The jump instructions will be covered in this chapter first, then the branches; jump-to-subroutine
instructions will be discussed in Chapter 12, which deals with subroutines.

Jump Instructions

        The jump inst
ruction (JMP) can be used with any one of five different 65816 addressing modes (only two of these are
available on the 6502, a third is available on the 65C02) to form an effective address; control then passes to that
address when the processor loads the program counter with it. For example,

 4C0020                     JMP         $2000        jump absolute to the code at location $2000

uses absolute addressing, a mode available to all 65x processors, to pass control to the code located at $2000 in
the current program bank. (Notice that using absolute addressing to access data in the last chapter used the data
bank in place of the program bank.)
         In addition to absolute addressing, all of the 65x processors provide a jump instruction with absolute
indirect addressing. While this form of indirect addressing is unique to the jump instruction, it is quite similar
to the direct page indirect addressing mode described in Chapter 7. In this case, the sixteen-bit operand is the
address of a double-byte variable located in bank zero containing the effective address; the effective address is
loaded into the program counter. As with absolute addressing, the program bank remains unchanged (Figure
8.1).
         For example, the jump instruction in Fragment 8.1 causes the processor to load the program counter
with the value in the double-byte variable located at $00:2000. Unlike direct page indirect addressing, the
operand is an absolute address rather than a direct page offset. Furthermore, this form of absolute addressing is
unusual in that it always references a location in bank zero, not the current data bank.

          0000                        LONGA      ON
          0000   C220                 REP        #$20       set 16-bit accumulator
          0002   A93412               LDA        #$1234     load sixteen-bit accumulator with$1234
          0005   8F002000             STA        >$2000     store long to location $00:2000
          0009   6C0020               JMP        ($2000)    jump to location $1234 in program bank

                                                  Fragment 8.1

         The 65C02 added the absolute indexed indirect addressing mode to those available to the jump
instruction. This mode is discussed further in Chapter 12, The Complex Addressing Modes. Although its
effective address calculation is not as simple as the jump absolute or jump absolute indirect, its result is the
same: a transfer of control to a new location.
         The 65802 and 65816 added long (24-bit) versions of the absolute and indirect addressing modes. The
absolute long addressing mode has a three-byte operand; the first two bytes are loaded into the program counter
as before, while the third byte is loaded into the program bank register, giving the jump instruction a full 24-bit
absolute addressing mode. For example,

 5C4423FF               JMP           $FF2344

causes the program counter to be loaded with $2344 and the program bank counter with $FF. Note
that on that 65802, even though the bank address is effectively ignored; the jump is to the same
location as the equivalent (sixteen-bit) absolute jump.




                                                                                                               112
```

<!-- programmanual p113 -->

```
The Western Design Center

                                              Effective Address:
                                              23                    15                     7             0
                                                      Bank                 High                    Low


                         Program Bank (PBR)




Instruction:
      Opcode           Operand Low          Operand High
                                                                         High Indirect Address
                                                               +1
                                                                         Low Indirect Address

                                                                                  Bank 0


                               Figure 8-1 Jump’s Absolute Indirect Addressing Mode

         When the target of a long jump is in bank zero, say to $00A030, then the assembler has a problem. It
assumes a jump to any address between zero and $FFFF (regardless of whether it’s written as $A030 or
$00A030) is a jump within the current program bank, not to another bank, so it will generate an absolute jump,
not a long jump. There are two solutions. One is to use the greater-than sign (>) in front of the operand, which
forces the assembler to override its assumptions and use long addressing:

 5C30A000                JMP        >$A030         long jump from current program bank to $00:A030

The alternative is to use the JML alias, or alternate mnemonic, which also forces a jump to be long, even if the
value of the operand is less than $10000:

 5C30A000                JML        $A030          jump from current bank to $00:A030

         The final form of the jump instruction is a 24-bit (long) jump using absolute indirect addressing. In the
instruction,

 DC0020                  JMP        [$2000]        jump to the 24-bit address stored at $00:2000

the operand is the bank zero double-byte address $2000, which locates a triple-byte value; the program counter
low is loaded with the byte at $2000 and the program counter high with the byte at $2001; the program bank
register is loaded with the byte at $2002. A standard assembler will allow the JML (jump long) alias here as
well.
         Notice that absolute indirect long jumps are differentiated from absolute indirect jumps within the same
bank by using parentheses for absolute indirect jumps within the same bank by using parentheses for absolute
direct and square brackets for absolute indirect long. In both cases the operand, an absolute address, points to a
location in bank zero.
         The jump instructions change no flags and affect no registers other than the program counter.




                                                                                                              113
```

<!-- programmanual p114 -->

```
The Western Design Center

Conditional Branching
          While the jump instructions provide the tools for executing a program made up of disjoined code
segments or for looping, they provide no way to conditionally break out of a loop or to select between paths.
These are the jobs of the conditional branch instructions.
          The jump instruction requires a minimum three bytes to transfer control anywhere in a 64K range. But
selection between paths is needed so frequently and for the most part for short hops that using three bytes would
tend to be unnecessarily costly in memory usage. To save memory, branches use an addressing mode called
program counter relative, which requires just two bytes; the branch opcode is followed by a one-byte operand –
a signed, two’s-complement offset from the current program location.
          When a conditional branch instruction is encountered, the processor first tests the value of a status
register flag for the condition specified by the branch opcode. If the branch condition is false, the processor
ignores the branch instruction and goes on to fetch and execute the next instruction from the next sequential
program location. If, on the other hand, the branch condition is true, then the processor transfers control to the
effective address formed by adding the one-byte signed operand to the value currently in the program counter
(Figure 8.2).
          As Chapter 1 notes, positive numbers are indicated by a zero in the high bit (bit seven), negative
numbers by a one in the high bit. Branching is limited by the signed one-byte operands to 127 bytes forward or
128 bytes backward, counting from the end of the instruction. Because a new value for the program counter
must be calculated if the branch is taken, an extra execution cycle is required. Further, the 6502 and 65C02
(and 65802 and 65816 in emulation mode) require an additional cycle if the branch crosses a page boundary.
The native mode 65802 and 65816 do not require the second additional cycle, because they use a sixteen-bit
(rather than eight-bit) adder to make the calculation.
          The program counter value to which the operand is added is not the address of the branch instruction
but rather the address of the opcode following the branch instruction. Thus, measured from the branch opcode
itself, branching is limited to 129 bytes forward and 126 bytes backward. A conditional branch instruction with
an operand of zero will continue with the next instruction regardless of whether the condition tested is true or
false. A branch with an operand of zero is thus a two-byte no-operation instruction, with a variable (by one
cycle) execution time, depending on whether the branch is or isn’t taken.
          The 65x processors have eight instructions which let your programs branch based on the settings of four
of the condition code flag bits in the status register: the zero flag, the carry flag, the negative flag, and the
overflow flag.
          None of the conditional branch instructions change any of the flags, nor do they affect any registers
other than the program counter, which they affect only if the condition being tested for is true. The most recent
flag value always remains valid until the next flag-modifying instruction is executed.




                                                                                                              114
```

<!-- programmanual p115 -->

```
The Western Design Center

                                                      Effective Address:
                                                      23                   15                  7             0
                                                              Bank                      High       Low




 Instruction:
        Opcode                   Operand


 65816 Registers:                          sign extended to 16 bits
         Bank                    High                         Low
 23                      15                       7                             0

  Program Bank (PBR)                    Program       Counter (PC)                  +




                                        Figure 8-2. Relative Branch Calculation
Branching Based on the Zero Flag

         The zero bit in the status register indicates whether or not the result of an arithmetic, logical, load, pull,
or transfer operation is zero. A zero result causes the bit to be set; a non-zero result causes the bit to be reset.
         The BEQ instruction is used to branch when a result is zero – that is, when the zero bit is set. Its
mnemonic meaning, that of branch if equal (to zero), describes what the processor does. Alternatively, it may
be considered a mnemonic for branch if (comparison) equal because it is often used after two values are
compared or subtracted; if the two values are equal, then the result of the comparison (subtraction) is zero (no
difference), and the branch is taken.
         The BNE instruction is used to branch when a result is not zero. Also, any non-zero value which is
loaded into a register will clear the zero flag. It is a mnemonic for branch if not equal; it too is used to branch
after a comparison or subtraction if the two values are not equal.
         Zero is often used as a terminator, indicating the end list, or that a loop counter has counted down to the
end of the loop. Fragment 8.2 is a short routine to search for the end of a linked list of records, and then insert a
new element at the end. Each element in the list contains a pointer to the next element in the chain. The last
element in the chain contains a zero in its link field, indicating that the end of the list has been reached.




                                                                                                                   115
```

<!-- programmanual p116 -->

```
The Western Design Center

                        ;          traverse linked list searching for end of chain
      0000
      0000
      0000    AC0080               LDY         NEXTNODE                nextnode contains address of next
      0003              ;                                                data element to be inserted.
      0003    A90080               LDA         #ROOT                   ROOT contains the address of
      0006              ;                                                the link field of the first
      0006              ;                                                record in the chain.
      0006    AA        LOOP       TAX                                 use fetched address to bet next link
      0007    B500                 LDA         0,x
      0009    D0FB                 BNE         LOOP                    if not zero, use value to go to next
      000B              ;                                                 record
      000B    98                   TYA
      000C    6500                 STA         0,x                     store address of next record
      000E              ;                                                in link field of current record
      000E    AA                   TAX
      000F    7400                 STZ         0,x                     now store zero to link field of
      0011              ;                                                new record, which is now end

                                                  Fragment 8.2

         The routine hinges on the BNE instruction found half-way through the code; until the zero element is
reached. the processor continues looping through as many linked records as exist. Notice that the routine has
no need to know how many elements there are or to count them as it adds a new element. Figure 8.3 pictures
such a linked list.




                                                                                                              116
```

<!-- programmanual p117 -->

```
The Western Design Center



                     $1204       X                    $1254       -
       Data          $1203       X                    $1253       -
                     $1202       X                    $1252       -
                     $1201      $12                   $1251      $00      End
     Link Field                                                            of
                     $1200      $50                   $1250      $00      List




                                                      $1254       Y                  $1304       -
                        Inserted Data                 $1253       Y                  $1303       -
                                                      $1252       Y                  $1302       -
                                                      $1251      $13                 $1301     $00       New End
                      New Link Field
                                                      $1250      $00                 $1300     $00       of List




                                               Figure 8-3. Linked List
        The two conditional branch instructions that check the zero flag are also frequently used following a
subtraction or comparison to evaluate the equality or inequality of two values. Their use in arithmetic, logical,
and relational expressions will be covered in more detail, with examples, in the next few chapters.

Branching Based on the Carry Flag
         The carry flag in the status register is affected by addition, subtraction, and shift instructions, as well as
by two implied-addressing instructions that explicitly set or clear the carry (SEC and CLC) and, on the
65802/65816, by the emulation and carry swapping XCE instruction, and the SEP and REP instructions.
         The BCC instruction (branch on carry clear) is used to branch when the carry flag is a zero. The BCS
instruction (branch on carry set) is used to branch when the carry flag is a one.
         The carry flag bit is the only condition code flag for which there are explicit instructions both to clear
and to set it. (The decimal flag, which can also be set and cleared explicitly, is a mode-setting flag; there are no
instructions to branch on the status of the decimal flag.) This can come in handy on the 6502, which has no
branch-always instruction (only the non-relocatable absolute jump): branch-always can be faked by setting the
carry, then branching on carry set:

  38                 SEC                       set carry bit in status register
  B0EB               BCS        NEWCODE        always document a BCS being used as branch-always

Since the code which follows this use of the BCS instruction will never be executed due to failure of the
condition test, it should be documented as acting like a branch-always instruction.
        The 6502 emulation mode of the 65802 and 65816 can be toggled on or off only by exchanging the
carry bit with the emulation bit; so the only means of testing whether the processor is in emulation mode or
native mode is to exchange the emulation flag with the carry flag and test the carry flag, as in Fragment 8.3.
Note that CLC, XCE, and BCS instructions themselves always behave the same regardless of mode.



                                                                                                                   117
```

<!-- programmanual p118 -->

```
The Western Design Center

       0000                      .
       0000                      .
       0000    18                CLC                            shift to native mode
       0001    FB                XCE                            swap previous emulation bit value into carry
       0002    B0FC              BCS            EMHAND          if was emulation, branch to emulation handler
       0004                      .
       0004                      .                              else processor in native mode
       0004                      .
       0004

                                                     Fragment 8.3

     Arithmetic and logical uses of branching based on the carry flag will be discussed in the next two
chapters.

Branching Based on the Negative Flag

          The negative flag bit in the status register indicates whether the result of arithmetic, logical, load, pull,
or transfer operation is negative or positive when considered as a two’s-complement number. A negative result
causes the flag to be set; a zero or positive result causes the flag to be cleared. The processor determines the
sign of a result by checking to see if the high-order bit is set or not. A two’s-complement negative number will
always have its high-order bit set, a positive number always has it clear.
          The BMI (branch-minus) instruction is used to branch when a result is negative, or whenever a specific
action needs to be taken if the high-order (sign) bit of a value is set. Execution of the BPL (branch-plus)
instruction will cause a branch whenever a result is positive or zero – that is, when the high-order bit is clear.
          The ease with which these instructions can check the status of the high order-bit has not been lost on
hardware designers. For example, the AppleII keyboard is read by checking a specific memory location
(remember, the 65x processor use memory-mapped I/O). Like most computer I/O devices, the keyboard
generates ASCII codes in response to key presses. The code returned by the keyboard only uses the low-order
seven bits; this leaves the eight bit free to be used as a special flag to determine if a key has been pressed since
the last time a key was retrieved. To wait for a keypress, a routine (see Fragment 8.4) loops until the high-order
bit of the keyboard I/O location is set.

        0000                 KEYBD       GEQU      $C000
        0000                 KSTRB       GEQU      $C010
        0000
        0000                 ;           wait until a character is pressed at the keyboard
        0000
        0000     E230                    SEP       #$30         eight-bit words are used for I/O
        0002
        0002     AD00C0      LOOP        LDA       KEYBD
        0005     10FB                    BPL       LOOP         loop until high order bit is set
        0007     8D10C0                  STA       KSTRB        got one; reset keyboard
        000A                             .
        000A                             .                      continue execution having fetched key
        000A                             .                      from keyboard
        000A

                                                     Fragment 8.4

        The STA KSTRB instruction that follows a successful fetch is necessary to tell the hardware that a key
has been read; it clears the high-order bit at the KEYBD location so that the next time the routine is called, it
will again loop until the next key is pressed.
        Remember that the high-order or sign bit is always bit seven on a 6502 or 65C02 or, on the 65802 and
65816, if the register loaded is set to an eight-bit mode. If a register being used an the 65802 or 65816 is set to
sixteen-bit mode, however, then the high bit – the bit that affects the negative flag – is bit fifteen.

                                                                                                                   118
```

<!-- programmanual p119 -->

```
The Western Design Center

Branching Based on the Overflow Flag

         Only four instructions affect the overflow (v) flag on the 6502 and 65C02: adding, subtracting, bit-
testing, and an instruction dedicated to explicitly clearing it. The 65802/65816’s SEP and REP instructions can
set and clear the overflow flag as well. The next chapter will discuss the conditions under which the flag is set
or cleared.
         The BVS instruction is used to branch when a result sets the overflow flag. The BVC instruction is
used to branch when a result clears the overflow flag.
         Additionally, there is a hardware input on the 6502, 65C02, and 65802 that causes the overflow flag to
be set in response to a hardware signal. This input pin is generally left unconnected in most personal computer
systems. It is more likely to be useful in dedicated control applications.

Limitations of Conditional Branches

        If you attempt to exceed the limits (+127 and –128) of the conditional branches by coding a target
operand that is out of range, an error will result when you try to assemble it. If you should need a conditional
branch with a longer reach, one solution is to use the inverse branch; if you would have used BNE, test it
instead for equal to zero using BEQ. If the condition is true, target the next location past a jump to your real
target. For example, Fragment 8.5 shows the end of a fairly large section of code, at the point at which it is
necessary to loop back to the top (TOP) of the section if the value in location CONTROL is not equal to zero.
You would use the code like Fragment 8.5 if TOP is more than 128 bytes back.


        0000   AD0080                LDA        CONTROL
        0003   F003                  BEQ        DONE             done processing; skip over loop back
        0005   4C0080                JMP        TOP              control not equal to zero; loop again
        0008               DONE      ANOP                        go on to next phase of processing
        0008                         .
        0008                         .

                                                 Fragment 8.5

        The price of having efficient two-byte short branches is that you must use five bytes to simulate a long
conditional branch.
      Many times it is possible and sensible to branch to another nearby flow of control statement and
use it to puddle-jump to your final target. Sometimes you will find the branch or jump statement you
need for puddle jumping already within your code because it’s not unusual for two or more segments
of code to conditionally branch to the same place. This method costs you no additional code, but you
should document the intermediate branch, nothing that it’s being used as a puddle-jump. Should you
change it later, you won’t inadvertently alter its use by the other branch.
         Each of the 65x branch instructions is based on a single status bit. Some arithmetic conditions,
however, are based on more than one flag being changed. There are no branch instructions available for the
relations of unsigned greater than and unsigned less than or equal to, these relations can only be determined by
examining more than one flag bit. There are also no branch instructions available for signed comparisons, other
than equal and not equal. How to synthesize these options is described in the following chapter.

Unconditional Branching

        The 65C02 introduced the BRA branch always (or unconditional branch) instruction, to the relief of
6502 programmers; they had found that a good percentage of the jump instructions coded were for short
distance within the range of a branch instruction.
        Having an unconditional branch available makes creating relocatable code easier. Every program must
have a starting address, or origin, specified, which tells the assembler where in memory the program will be


                                                                                                             119
```

<!-- programmanual p120 -->

```
The Western Design Center

loaded. This is necessary so that the assembler will be able to generate the correct values for locations defined
by labels in the source code.
        Consider Fragment 8.6, the beginning of a program that specifies an origin of $2000. In order to make
patching certain variables easier, they have been located right at the beginning of the program. When this
program is assembled, location $2000 holds a jump instruction, and the assembler gives its operand the value of
the location of BEGCODE, that is, $2005. If this program were then loaded at $2200, instead of $2000 as was
“promised” by the ORG directive, it would fail because the very first instruction executed, at $2200, would be
the jump to $2005. since the program has now been loaded at $2200, the contents of $2005 are no longer as
expected, and the program is in deep trouble.
        By substituting an unconditional branch instruction for the jump, as in Fragment 8.7, the operand of the
branch is now a relative displacement (the value two), and the branch instruction will cause two to be added to
the current value of the counter program counter, whatever it may be. The result is that execution continues at
BEGCODE, the same relative location the jump instruction transferred control to in the fixed-position version.

        The code is now one byte shorter. Most importantly, though, this section of the
        0000                            ORG       $2000
        0000              MAIN          START
        0000    4C0500                  JMP       BEGCODE       jump around data to beginning code
        0003    77        DATA1         DC        H’77’
        0004    88        DATA2         DC        H’88’
        0005              BEGCODE       ANOP
        0005                            .
        0005                            .
        0005                            .

                                                 Fragment 8.6

program is now position-independent. If executed at $2000, the branch is located at $2000; the program counter
value before the branch’s operand is added is $2002; the result of the addition is $2004, the location of
BEGCODE. Load and execute the program instead at $2200, and the branch is located at $2200; the program
counter value before the branch operand is added is $2202; the result of the addition is $2204, which is the new
location of BEGCODE.

        0000                            ORG       $2000
        0000              MAIN          START
        0000   8002                     BRA       BEGCODE       branch around data to beginning code
        0002   77         DATA1         DC        H’77’
        0003   88         DATA2         DC        H’88’
        0004   AD0200     BEGCODE       LDA       DATA1
        0007                            .
        0007                            .
        0007                            .
        0007

                                                 Fragment 8.7

        Because the operand of a branch instruction is always relative to the program counter, its effective
address can only be formed by using the program counter. Programs that use branches rather than jump may be
located anywhere in memory.
        6502 programmers in need of relocatability get around the lack of an unconditional branch instruction
by using the technique described earlier of setting a flag to a known value prior to executing a branch-on-that-
condition instruction.
        Even with the unconditional branch instruction, however, relocatability can still be a problem if the
need for branching extends beyond the limits imposed by its eight-bit operand. There is some help available on
the 6502 and 65C02 in the form of the absolute indirect jump, which can be loaded with a target that is
calculated at run time.

                                                                                                             120
```

<!-- programmanual p121 -->

```
The Western Design Center

         The 65802 and 65816 introduce the BRL unconditional branch long instruction. This is the only 65x
branch instruction which does not take an eight-bit operand: its operand, being sixteen bits, lets it specify a
target anywhere within the current 64K program bank. It is coded like any other branch, except that the target
label can be outside the range of the other branches. Obviously, a two-byte displacement is generated by the
assembler, making this branch a three-byte instruction. If the effective address that results when the sixteen-bit
displacement is added to the current program counter would extend beyond the 64K limit of the current program
bank.
         The BRL instruction can replace entirely the absolute JMP instruction in a relocatable program; the
price is an extra execution cycle per branch.




                                                                                                              121
```
