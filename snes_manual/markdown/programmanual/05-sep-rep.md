# Chapter 5 — SEP, REP, and Other Details

> ⚠ CROWN: exactly what SEP #$20 / REP #$30 do to A,X,Y,S, and how the assembler should assume modes.

## Contents (per the book's own TOC)

- SEP / REP semantics (p64)
- The Assembler Used in This Book (p66)
- Address Notation (p68)

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

## Body (pages 64–68)


<!-- programmanual p064 -->

```
The Western Design Center


5) Chapter Five
SEP, REP, and Other Details
         Part Three is devoted to a step by step survey of all 92 different 65816 instructions and the 25 different
types of addressing modes which, together, account for the 256 operation codes of the 65802 and 65816. As a
matter of course, this survey naturally embraces the instruction sets of the 6502 and 65C02 as well.
         The instructions are grouped into six categories: data movement, flow of control, arithmetic, logical and
bit manipulation, subroutine calls, and system control instructions. A separate chapter is devoted to each group,
and all of the instructions in a group are presented in their respective chapter.
         The addressing modes are divided into two classes, simple and complex. The simple addressing modes
are those that form their effective address directly - that is, without requiring any, or only minimal, combination
or addition of partial addresses from several sources. The complex addressing modes are those that combine
two or more of the basic addressing concepts, such as indirection and indexing, as part of the effective address
calculation.
         Almost all of the examples found in this book are intended to be executed on a system with either a
65802 or 65816 processor, and most include 65816 instructions, although there are some examples that are
intentionally restricted to either the 6502 or 65C02 instructions set for purpose of comparison.
         Because of the easy availability of the pin-compatible 65802, there is a good chance that you may, in
fact, be executing your first sample programs on a system originally designed as a 6502-based system, with
system software such as machine-level monitors and operating systems that naturally support 6502 code only.
All of the software in this book was developed and tested on just such systems (AppleII computers with either
65802s replacing the 6502, or with 65816 processor cards installed).
         It is assumed that you will have some kind of support environment allowing you to develop programs
and load them into memory, as well as a monitor program that lets you examine and modify memory, such as
that found in the Apple II firmware. Since such programs were originally designed to support 6502 code, the
case of calling a 65816 program from a 6502-based system program must be given special attention.
        A 65802 or 65816 system is in the 6502 emulation mode when first initialized at power-up.
This is quite appropriate if the system software you are using to load and execute the sample programs
is 6502-based, as it would probably not execute correctly in the native 65816 mode.
        Even though almost all of the examples are for the 65816 native mode of operation, the early examples
assume that the direct page register, program counter bank register, and data register are all in their default
condition - set to zero - in which case they provide an environment that corresponds to the 64K programming
space and zero page addressing of the 6502 and 65C02. Aside from keeping the examples simple, it permits
easy switching between the native mode and the emulation mode. If you have just powered up your 65816 or
65802 system, nothing needs be done to alter these default values.
        The one initialization you must do is switch from the emulation to the native mode. To switch out of
the 6502 emulation mode, which is the default condition upon powering up a system, the code in Fragment 5.1
must be executed once.

         0000     18            CLC          clear carry flag
         0001     FB            XCE          exchange carry with e bit (clears e bit)

                                                  Fragment 5.1.

        This clears the special e flag, putting the processor into the 65816 native mode.
        If you are using a 65802 processor in an old 6502 system, the above code needs to be executed each
time an example is called. Further, before exiting a 65816 program to return to a 6502 calling program, the
opposite sequence in Fragment 5.2 must be executed.



                                                                                                                64
```

<!-- programmanual p065 -->

```
The Western Design Center

         0000     38           SEC           set carry flag
         0001     FB           XCE           exchange carry with e bit (set e bit)

                                                  Fragment 5.2.

         Even if you are running your test programs from a fully supported 65816 or 65802 environment, you
should include the first mode-switching fragment, since the operating mode may be undefined on entry to a
program. Execution of the second should be acceptable since the system program should reinitialize itself to the
native mode upon return from a called program.
         A further requirement to successfully execute the example programs is to provide a means for returning
control to the calling monitor program. In the examples, the RTS (return from subroutine) instruction is used.
The RTS instruction is not explained in detail until Chapter 12; however, by coding it at the end of each
example, control will normally return to the system program that called the example program. So to exit a
program, you will always code the sequence in Fragment 5.3.

         0000     38           SEC           set carry flag
         0001     FB           XCE           exchange carry with e bit (sets e bit)
         0002     60           RTS

                                                  Fragment 5.3.

         Some systems may have a mechanism other than RTS to return control to the system; consult your
system documentation.
         In addition to these two details, a final pair of housekeeping instructions must be mastered early in
order to understand the examples.
         These two instructions are SEP and REP (set P and reset P). Although they are not formally
introduced until Chapter 13, their use is essential to effective use of the 65802 and 65816. The SEP and REP
instructions have many uses, but their primary use is to change the value of the m and x flags in the status
register. As you recall from Chapter 4, the m and x registers determine the size of the accumulator and index
registers, respectively. When a flag is set (has a value of one), the corresponding register is eight bits; when a
flag is clear, the corresponding register is sixteen bits. SEP, which sets bits in the status register, is used to
change either accumulator, or index registers, or both, to eight bits; REP, which clears bits, is used to change
either or both to sixteen bits. Whenever a register changes size, all of the operations that move data in and out
of the register are affected as well. In this sense, the flag bits are extensions to the opcode, changing their
interpretation by the processor.
         The operand following the SEP and REP instructions is a “mask” of the flags to be modified. Since bit
five of the status register is the m memory/accumulator select flag, an instruction of the form:

                                      REP            #%00100000

makes the accumulator size sixteen bits; a SEP instruction with the same argument (or its hexadecimal
equivalent, $20) would make it eight bits. The binary value for modifying the x flag is %00010000, or $10; the
value for modifying both flags at once is %00110000, or $30. The sharp (#) preceding the operand signifies the
operand is immediate data, stored in the byte following the opcode in program memory; the percent (%) and
dollar ($) signs are special symbols signifying either binary or hexadecimal number representation, respectively,
as explained in Chapter 1.
         Understanding the basic operation of SEP and REP is relatively simple. What takes more skill is to
develop a sense of their appropriate use, since there is always more than one way to do things. Although there
is an immediate impulse to want to use the sixteen-bit modes for everything, it should be fairly obvious that the
eight-bit accumulator mode will, for example, be more appropriate to applications such as character
manipulation. Old 6502 programmers should resist the feeling that if they’re not using the sixteen-bit modes
“all the time” they’re not getting full advantage from their 65802 or 65816. The eight-bit accumulator and
index register size modes, which correspond to the 6502 architecture, can be used to do some of the kinds of

                                                                                                               65
```

<!-- programmanual p066 -->

```
The Western Design Center

things the 6502 was doing successfully before the option of using sixteen-bit registers was provided by the
65816. Even in eight-bit mode, the 65802 or 65816 will provide numerous advantages over the 6502.
         What is most important is to develop a sense of rhythm; it is undesirable to be constantly switching
modes. Since the exact order in which a short sequence of loosely related instructions is executed is somewhat
arbitrary, try to do as many operations in a single mode as possible before switching modes. At the same time,
you should be aware that the point at which an efficiency gain is made by switching to a more appropriate mode
is reached very quickly. By examining the various possibilities, and experimenting with them, a sense that
translates into an effective rhythm in coding can be developed.
         Finally, a word about the examples as they appear in this book. Two different styles are used: Code
Fragments, and complete Code Listings.
         Code Fragments are the kinds of examples used so far in this chapter. Code Listings, on the other hand,
are self-contained programs, ready to be executed. Both appear in boxes, and are listed with the generated
object code as produced by the assembler. Single-line listings are included in the text.

The Assembler Used in This Book
        The assembly syntax used in this book is that recommended by the Western Design Center in their data
sheet (see Appendix F). The assembler actually used in the ProDOS ORCA / M assembler for the Apple II
computer, by Byteworks, Inc. Before learning how to code the 65816, a few details about some of the
assembler directives need to be explained.
        Full-line comments are indicated by starting a line with an asterisk or a semicolon.
        If no starting address is specified, programs begin by default at $2000. That address can be changed by
using the origin directive, ORG. The statement

                              ORG                      $7000

When included in a source program, will cause the next byte of code generated to be located at memory location
$7000, with subsequently generated bytes following it.
        Values can be assigned labels with the global equate directive, GEQU. For example, in a card-playing
program, spades might be represented by the value $7F; the program is much easier to code (and read) if you
can use label SPADE instead of remembering which of four values goes with which of the four suits, as seen in
Fragment 5.4.

                0000                    SPADE                 GEQU    $7F
                0000                    HEART                 GEQU    $FF
                0000                    CLUB                  GEQU    $3F
                0000                    DIAMOND               GEQU    $1F

                                                 Fragment 5.4.

        Now rather than loading the A accumulator by specifying a hard-to-remember value,

               A97F                           LDA                #$7F

You can load it by specifying the easier-to-remember label:

               A900                           LDA                #SPADE

Once you have defined a label using GEQU, the assembler automatically substitutes the value assigned
whenever the label is encountered.
        The # sharp or pound sign is used to indicate that the accumulator is to be loaded with an immediate
constant.



                                                                                                             66
```

<!-- programmanual p067 -->

```
The Western Design Center

         In addition to being defined by GEQU statements, labels are also defined by coded in the label field -
starting in the first column of a source line, right in front of an instruction or storage-defining directive. When
coded in front of an instruction:

                          A905             BEGIN           LDA               #5

The label defines an entry point for a branch or jump to go to; when an instruction such as is assembled,

                          4C0400           JMP             BEGIN

the assembler automatically calculates the value of BEGIN and uses that value as the operand of the JMP
instruction.
         Variable and array space can be set aside and optionally labelled with the define storage directive, DS
directive sets aside one byte at $1000 for the variable FLAG1; the second DS directive sets aside 20 bytes
starting at $1001 for ARRAY1.

           0000                                              ORG                  $1000
           0000                            MAIN              START
           0000        00                  FLAG1             DS                   1
           0001        00000000            ARRAY1            DS                   20
           0015                                              END

                                                    Fragment 5.5

       The value stored at FLAG1 can be loaded into the accumulator by specifying FLAG1 as the operand of
the LDA instruction:
                              AD0010                LDA             FLAG1

Program constants, primarily default values for initializing variables, prompts, and messages, are located in
memory and optionally given a label by the declare constant directive, DC. The first character(s) of its operand
specifies a type (A for two-byte addresses, I1 for one-byte integers, H for hex bytes and C for character strings,
for example) followed by the value or values to be stored, which are delimited by single quotes.
         Fragment 5.6 gives an example. The first constant, DFLAG1, is a default value for code in the
program to assign to the variable FLAG1. You may realize that DFLAG1 could be used as a variable; with a
label, later values of the flag could be stored here and then there would be no need for any initialization code.
But good programming practice suggests otherwise: once another value is stored into DFLAG1, its initial value
is lost, which keeps the program from being restarted from memory. On the other hand, using a GEQU to set
up DFLAG1 would prevent you from patching the location with a different value should you change your mind
about its initial value after the code has been assembled.

        0000        FE                 DFLAG1             DC         I1 ‘ $FE ‘
        0001        0010               COUNT              DC         A ‘ $1000 ‘
        0003        496E7365           PROMPT             DC         C ’ Insert disk into drive 1 ’
        001B        00                                    DC         I1 ‘ 0 ‘

                                                    Fragment 5.6

         Defining COUNT as a declared constant allows it, too, to patched in object as well as edited in source.
         PROMPT is a message to be written to the screen when the program is running. The assembler lists
only the first four object bytes generated (‘496E7365‘) to save room, but generates them all. The zero on the
next line acts as a string terminator.
         Sometimes it is useful to define a label at a given point in the code, but not associate it with a particular
source line; the ANOP (assembler no-operation) instruction does this. The value of the label will be the

                                                                                                                   67
```

<!-- programmanual p068 -->

```
The Western Design Center

location of the code resulting from the next code-generating source line. One use of this feature is to define two
labels with the same value, as shown in Fragment 5.7.

        0000                        BLACK                   ANOP
        0000     0000               WHITE                   DS           2

                                                   Fragment 5.7

The two bytes of variable storage reserved may now be referred to as either BLACK or WHITE; their value is
the same.

Address Notation

         The 16-megabyte address space of the 65816 is divided into 256 64K banks. Although it is possible to
treat the address space in a linear fashion - the range of bytes from $000000 to $FFFFFF - it is often desirable
and almost always easier to read if you distinguish the bank component of a 24-bit address by separating it with
a colon:

$00:FFF0
$xx:1234
$01:XXXX

         In these examples, the X characters indicate that that address component can be any legal value; the
thing of interest is the specified component.
         Similarly, when specifying direct page addresses, remember that a direct page address is only an offset;
it must be added to the value in the direct page register:

dp:$30
$1000:30

        The dp in the first example is used to simply indicate the contents of the direct page register, whatever
it may be; in the second case, the value in the direct page register is given as $1000. Note that this notation is
distinguished from the previous one by the fact that the address to the left of the colon is a sixteen-bit value, the
address on the right is eight. Twenty-four-bit addresses are the other way around.
        A third notation used in this book describes ranges of address. Whenever two addresses appear together
seperated by a single dot, the entire range of memory location between and including the two addresses is being
referred to. For example, $2000.2001 refers to the double-byte starting at $2000. If high bytes of the second
address are omitted, they are assumed to have the same value as the first address. Thus, $2000.03 refers to the
addresses between $2000 and $2003 inclusive.




                                                                                                                  68
```
