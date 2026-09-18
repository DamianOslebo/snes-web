# Chapter 16 — Design and Debugging

> ⚠ Relevant: the 'Inconsistent Assembler Syntax' and emulation/native gotchas are direct assembler-design concerns.

## Contents (per the book's own TOC)

- Debugging Checklist (p276)
- Decimal Flag (p276)
- Branches (p277)
- 6502 Jump Bug (p277)
- Emulation vs Native (p277)
- 8/16-bit regs (p278)
- The Direct Page (p278)
- Stack Overruns (p278)
- JSR/JSL·RTS/RTL (p278)
- Inconsistent Assembler Syntax (p279)

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

## Body (pages 276–282)


<!-- programmanual p276 -->

```
The Western Design Center




16) Chapter Sixteen
Design and Debugging
        Design and debugging stand on either side of the central coding phase of the development cycle. Good
techniques for both are as important as skill in actual coding. This chapter provides a checklist of some
commonly encountered bugs – ones you should immediately suspect – as well as some words of advice about
program design and good coding practice, which may help you avoid some of the bugs to begin with.

Debugging Checklist

        Program bugs fall into two categories: those specific to the particular processor you’re writing assembly
code for, and those that are generic problems which can crop up in any assembly program for almost any
processor. This chapter will primarily consider bugs specific to the 65x processors, but will also discuss some
generic bugs as they specifically apply in 65x assembly programs.
        You may want to put a checkmark beside the bugs listed here each time you find them in your
programs, giving you a personalized checklist of problems to look for. You may also want to add to the list
other bugs that you write frequently.

Decimal Flag

        Seldom does the d decimal flag get miss set, but when it does, arithmetic results may seem to
inexplicably go south. This can be the result of a typo, attempting to execute data, or some other execution
error. Or it can result from coding errors in which the decimal flag is set to enable decimal arithmetic, then
never reset. If branching occurs before the decimal flag is reset, be sure all paths ultimately result in the flag
being cleared. Branching while in decimal mode is almost as dangerous as branching after temporarily pushing
a value onto the stack; equal care must be taken to clear d and clean the stack.
        This bug may be doubly hard to find on the 6502, which does not clear d on interrupt or, worse, on
reset. An instruction inadvertently or mistakenly executed which sets d (only SED, RTI, or PLP have the
capability on the 6502) would require you to specifically reclear the decimal flag or to power off and power
back on again. As a result, it is always a good idea to clear the decimal flag at the beginning of every 6502
program.

Adjusting Carry Prior to Add / Subtract

        If you’re not used to 65x processors (and even for many programmers who are), you may tend to write
an ADC instruction without first writing a CLC, or an SBC without first an SEC. After all, other processors
have add and subtract instructions that do not involve the carry. But the 65x processors do not; so notice the
“C” in each of the instructions each time you code them and be sure the carry has the appropriate value.

65x Left-to-Right Syntax

       Unlike some other processors’ instructions, 65x mnemonics read from left to right, just like English:
TAX, for example, means to transfer the A accumulator to the X index register, not the opposite.




                                                                                                              276
```

<!-- programmanual p277 -->

```
The Western Design Center

65x Branches

         There are eight 65x conditional branches, each based on one of the two states of four condition code
flags. Remembering how to use them for arithmetic is necessary to code branches that work.
         Keep in mind that compare instructions cannot be used for signed comparisons: they don’t affect the
overflow flag. Only the subtract instruction can be used to compare two signed numbers directly (except for the
relationships equal and not equal).
         Remember that if the z flag is set (one), then the result was zero; and if the zero flag is clear (zero), then
the result was other than zero – the opposite of most first guesses about it.
         A common code sequence is to test a value, then branch on the basis of the result of the test. A
common mistake is to code an instruction between the test and the branch that also affects the very flag your
branch is based on (often because an instruction you don’t expect to affect the flags does indeed do so).
         Note that 65x pull instructions set the negative and zero flags, unlike 68xx and 8088/8086 processors;
that store instructions do not set any flags, unlike 68xx processors; that transfer and exchange instructions do set
flags, unlike Motorola and Intel processors; that load instructions do set flags, unlike the 8088; and increment
and decrement instructions do not affect the carry flag.
         Also, in decimal mode on the 6502, the negative, overflow and zero flags are not valid.

6502 Jump Bug

       There’s hardware bug on the 6502 that causes jump indirect, with an operand which ends in $FF (such
as $11FF), to bomb; the new high program counter value is taken incorrectly from $1100, not the correct $1200.

Interrupt-Handling Code

        To correctly handle 65x interrupts, you should generally, at the outset, save all registers and, on the
6502 and in emulation mode, clear the decimal flag (to provide a consistent binary approach to arithmetic in the
interrupt handler). Returning from the interrupt restores the status register, including the previous state of the
decimal flag.
        During interrupt handling, once the previous environment has been saved and the new one is solid,
interrupts may be enabled.
        At the end of handling interrupts, restore the registers in the correct order. RTI will pull the program
counter and status register from the stack, finishing the return to the previous environment, except that in
65802/65816 native mode it also pulls the program bank register from the stack. This means you must restore
the mode in which the interrupt occurred (native or emulation) before executing an RTI.

65802/65816: Emulation Versus Native Mode

         Emulation mode has been provided on the 65802 and 65816 to provide continuity with existing
applications. Native mode provides the powerful sixteen-bit data handling registers. But mixing emulation and
native modes requires careful attention to detail. You should deal with modes systematically.
         Will you limit subroutines to be called only from a certain mode? All subroutines? You must carefully
document each for which mode it expects.
         You must be in emulation mode on the Apple II or other 6502-based system to use the monitor and
operating system 6502 routines. Furthermore, you must put 0000 into D (the direct page register) before return
to the monitor or operating system, because zero page addressing now addresses the direct page, but the 6502
firmware left its variables in page zero before your program switched to native mode.
         Any high bytes in the index registers are lost in the switch to emulation mode.
         While native mode lets you set the stack anywhere, a non-page-one stack location is lost on return to
emulation mode (the high byte is thrown away, replaced by the obligatory page one high byte emulation mode).
Furthermore, when setting the stack with the TCS instruction, only the low accumulator byte is transferred to
the stack pointer in emulation mode, but in native mode, the high accumulator byte, even if it is hidden, is
transferred to the high stack pointer byte.

                                                                                                                   277
```

<!-- programmanual p278 -->

```
The Western Design Center

65802/65816: Eight-Bit Versus Sixteen-Bit Registers

         Almost as potentially confusing as mixing emulation and native modes is mixing eight-bit and sixteen-
bit modes. Again, you should deal with modes systematically.
         Will you limit subroutines to be called only from a certain mode setting? You must carefully document
each for the mode it expects.
         Because instructions using immediate addressing are different lengths in eight- and sixteen-bit modes,
being in the wrong mode will cause the processor to grab the wrong number of operand bytes, followed by a
fetch for the next opcode which will miss by one and cause it to execute, as though it were an opcode, either the
last operand byte of the immediate instruction, or the first operand byte of the next instruction. Either way is
sure program failure.

65802/65816: The Direct Page

         Avoid inadvertently branching from code written to access one direct page code written to access
another without executing an instruction to reset the direct page register to the second location first (and
resetting it to the original location before returning). Remember, too, that programs run faster when the direct
page register is set to a page boundary.
         Pay particular attention to the peculiarities of the direct page in the emulation mode: as with the 6502
and 65C02, instructions which use direct page addressing modes will “wrap” to stay within the zero page, but
only when the direct page register is equal to zero. Opcodes which are not found on the 6502 or 65C02 will not
wrap at all, even when the direct page is equal to zero in the emulation mode.

65802/65816: Stack Overruns Program or Data

        No longer limited to a single page, the native-mode stack will grow downward as far as your program
pushes bytes onto it. Large programs should either retrieve every byte pushed on or reset the stack periodically
(using TCS or TXS). The potential danger is when a stack grows uncontrollably until it overwrites variables,
your program, or the operating system.
        In this connection it is important to be aware that, although the high byte of the stack register is
consistently forced to one, new 65816 opcodes executed in the emulation mode will not wrap the stack if the
low byte over- or underflowed in the middle of an instruction. For example, if the stack pointer is equal to
$101, and a JSL is executed, the final byte of the three bytes pushed on the stack will be at $FF, not $1FF; but
the stack pointer at the end of the instruction will point to $1FE. However, if JSR (a 6502 instruction) is
executed in the emulation mode with the stack pointer equal to $100, the second of the two bytes pushed will be
stored at $1FF.

65802/65816: JSR/JSL and RTS/RTL

        RTL pulls one more byte off the stack than RTS: it requires that a long jump-to-subroutine (JSL) or its
equivalent pushed a full 24-bit return address, not just a sixteen-bit one. Equally important is that a JSL not be
made to a subroutine ended by an RTS, which pulls only sixteen of the 24 bits of return address pushed.

65802/65816: MVN/MVP

        MVN and MVP require two operands, usually code or data labels from which the assembler strips the
bank bytes, in sourcebank,destbank order (opposite of object code order). Eight-bit index registers will cause
these two instructions to move only zero page memory. But eight-bit accumulator mode is irrelevant to the
count value; the accumulator is expanded to sixteen bits using hidden B accumulator as the high byte of the
count. Finally, the count in the accumulator is one less than the count of bytes to be moved: five in the
accumulator means six bytes will be moved.



                                                                                                              278
```

<!-- programmanual p279 -->

```
The Western Design Center

Return Address

        If your program removes the return address from the stack in order to use it in some fashion
other than using an RTS or RTL instruction to return, remember that you must add one to the stacked
value to form the true return address (an operation the return-from-subroutine instructions execute
automatically).

Inconsistent Assembler Syntax

        6502 assemblers have been wildly inconsistent in their syntax, and early 65802 assemblers
have not set standard either. This book describes syntax recommended by the designers of the 65816,
the Western Design Center, as implemented in the ORCA/M assembler. Others, however, do and will
differ. For example, while many assemblers use the syntax of a pound sign (#) in front of a sixteen-bit
immediate value to specify that the low byte be accessed, with the greater-then sign (>) being used to
represent the high byte, at least one 6502 assembler uses the same two signs to mean just the opposite.
Syntax for the new block move instructions will undoubtedly vary from the recommended standard in
many assemblers. Beware and keep you assembler’s manual handy.

Generic Bugs: They Can Happen Anywhere

Uninitialized Variables

       Failing to initialize variables may be the most common bug committed by
programmers. Its symptom is often a program which operates strangely only the first time it is
run (after which the variable has at some point been given a suitable value which remains in
memory for the program’s second try), or only after running a certain other program.
Sometimes the symptom appears only on computers with one brand of memory chips, and not
another; they happen to power up with different initial values.

Missing Code

       The code you wrote on paper is perfect. The problem is one or more lines that never
got typed in, or were typed in wrong. The solution is to compare your original handwritten
code with the typed-in version, or compare a disassembly with your original code.
         More enigmatically, a line may be accidentally deleted or an opcode or operand inadvertently
changed by a keypress during a subsequent edit (usually in a section of code which has just been
proven to work flawlessly). Regular source backups and a program that can compare text to spot
changes will often solve the problem. Or you can compare a disassembly with the previous source
listing.

Failure to Increment the Index in a Loop

      The symptoms are: everything stops, and typing at the keyboard has no effect. The
problem is an endless loop – your branch out of the loop is waiting for an index to reach to
some specified value, but the index is never decremented or incremented and thus never
reaches the target value.



                                                                                                   279
```

<!-- programmanual p280 -->

```
The Western Design Center

Failure to Clean Up Stack

        This problem is typically found in code in which first a value is pushed, then there is a
conditional branch, but all paths do not pull the value still on the stack. It may result in a
return address being pulled off the stack which is not really a return address (one or more bytes
of it are really previously pushed data bytes).

Immediate Data Versus Memory Location

       Failure to use the ‘#’ sign to signify a constant (or whatever other syntax a particular assembler
requires) will instruct the assembler to load, not the constant, but data from a memory location that it
assumes the constant specifies. That is, #VAR means access a constant (or the address of a variable);
VAR, on the other hand, means access its contents.

Initializing the Stack Pointer from a Subroutine

       It won’t take much thought to realize that you can’t just reset the stack pointer from
within a subroutine and expect the return-from-subroutine instruction to work. The return
address was pointed to by the previous stack pointer. Who knows where it is in relation to the
newly set one?

Top-Down Design and Structured Programming

        It’s wise to carefully consider the design of a program before beginning to write any of it. The
goals of design are to minimize program errors, or bugs; to reduce complexity; to maximize
readability; and to increase the speed and ease of coding and testing and thus the productivity of
programmers.
        The top-down approach to structured programming combines two major design concepts. This
approach is generally recognized as the method of design which best achieves these goals, particularly
when coding large programs. Top-down design suggests that programs should be broken into levels:
at the top level is a statement of the goal of the program; beneath it are second-level modules, which
are the main control sections of the program; the sections can be broken into their parts; and so on.
        A blackjack game (twenty-one), for example, might be broken down into four second-level
modules, the goals of which are to deal the cards, take and place bets on the hands dealt, respond to
requests for more cards, and finally compare each player’s hand with the dealer’s to determine
winnings. The dealing module might be broken down into two third-level modules, the goals of which
are to shuffle the cards, and to deliver a card to each player (executed twice so that each player gets
two cards). The shuffling module might be broken into two fourth-level modules which assign a
number to each card and then create a random order to the numbers.
        The makeup of each level is clear. At the top level, the makeup describes the program itself.
At lower levels, the makeup describes the subprocess. At the lowest levels, the work is actually done.
        A top-down design is then implemented using subroutines. The top level of the program is a
very short straight-line execution routine (or loop in the case of programs that start over when they
reach the end), that does nothing more than call a set of subroutines, one for each second-level module
of the program. The second-level subroutines may call third-level subroutines which may call fourth-
level subroutines, and so on.
        Structure programming is a design concept which calls for modules to have only one entry
point; jumping into the middle of a module is not permitted. (A structured approach to the problem of
needing an entry point to the middle of a module is to make that portion of the module a sub-module
                                                                                                     280
```

<!-- programmanual p281 -->

```
The Western Design Center

with its own single entry and exit points.) A second rule is that all exits return control to the calling
module; all branches (selections) are internal; no branches are permitted to code outside the module.
        One of the side benefits of modular programming is the ability to reuse previously coded
modules in other programs: the dealing module could be dropped into any card game program that
calls for shuffling followed by the dealing of one card at a time to each player. And its shuffling sub-
module could be borrowed for other card game programs which only need shuffling. This use of the
modularity principle should not be confused with the top-down structured design; they are distinct but
related concepts. Modular programming in itself is not the same as top-down design.
        A software development team could, using top-down design, readily assign one programmer
the task of coding the deck-shuffling routine, another programmer the betting module, another
responsibility for the dealing routines, and a fourth with writing the code for the end-of-game
comparison of hands and determination of the winner.
        A new programmer trying to understand a top-down program avoids becoming mired in detail
while trying to get an understanding of the structure, yet can very easily figure how to get to the degree
of detail which interests him.
        Finally, debugging, the process of finding and removing programming mistakes, is
exceptionally straightforward with top-down design: on seeing that, after shuffling, one of the 52 cards
seems to be missing, the programmer can go directly to the shuffling subroutines to fix the problem.
        Top-down design sometimes seems like a waste of time to programmers anxious to get the
bytes flying; complex programs can take days or weeks of concerted thinking to break down into the
subparts which fit together most logically and efficiently. But the savings in time spent coding – and
recoding – and in being able to understand, debug, and modify the program later well justify the time
spent on design.

Documentation

        One of the most important elements of good programming practice is documentation. It is
remarkable how little one can recall about the nitty-gritty details of a program written just last month
(or sometimes even yesterday) – the names of the key variables, their various settings and what each
means and how each interacts with other variables in various routines, and so on. “Clever”
programmers, those who bend programming principles to ends never anticipated, too often find they
(not to mention their co-workers) can no longer discover the meaning behind their cleverness when it
comes time to debug or modify that code.
        The first principle of documentation is to make the program document itself. Choose labels
which are meaningful: DELLOOP is a much better label for the beginning of a loop which deals cards
in a card game than is LAB137. Substitute a label for all constants: branching if there’s a 1 in some
register after writing a byte to disk is, by itself, meaningless; branching because there’s a constant
named DISKFULL in the register provides clear documentation. When your program needs to
determine if an ASCII value is an upper-case letter, it’s much clearer to compare with “greater than or
equal to ‘A’” than with “greater than ‘@’”. Who remembers that ‘@’ precedes ‘A’ in the ASCII
chart?
        Variables should be commented when they’re declared with a description of their purpose,
their potential settings, and any default states. And if any of that information changes during the
development of the program, the comment should be changed to match.
        Routines should be commented when they’re written: Note the purpose of the routine, the
variables or parameters which need to be set before entry into the routine, and the variables or
parameters which will be passed back. If other data structures will be affected by the routine, this, too,
should be commented.
        Nothing is as important both to debugging of code and to continuing development of programs
as documentation: self-documentation; a comment on every important line of code that explains and
                                                                                                      281
```

<!-- programmanual p282 -->

```
The Western Design Center

expands it; a comment header on every routine; and a comment on every variable. While some
languages are said to be automatically “self-documenting,” no language can create documentation
which is half adequate compared to what the original programmer can provide while the program is
being written.




                                                                                             282
```
