# Chapter 6 — First Examples: Moving Data

> Data movement + the 65816-only transfers/exchanges (TAS/TSB/PHD/PLD/TCD/TCS/PEA/PHB/PHPB/...).

## Contents (per the book's own TOC)

- Load/Store (p71)
- Effect on Status Flags (p73)
- Push (p74)
- Pull (p76)
- Push/Pull 65816 regs (p78)
- Transfers (TAX/TAY/TXA/TXY) (p79)
- Exchanges (XBA/XCA/XYB) (p86)
- Store Zero (p86)
- Block Moves (MVN/MVP) (p87)

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

## Body (pages 69–88)


<!-- programmanual p069 -->

```
The Western Design Center


6) Chapter Six
First Examples: Moving Data
         Most people associate what a computer does with arithmetic calculations and computations. That is
only part of the story. A great deal of compute time in any application is devoted to simply moving data around
the system: from here to there in memory, from memory into the processor to perform some operation, and from
the processor to memory to store a result or to temporarily save an intermediate value. Data movement is one of
the easiest computer operations to grasp and is ideal for learning the various addressing modes (there are more
addressing modes available to the data movement operations than to any other class of instructions). It,
therefore, presents a natural point of entry for learning to program the 65x instruction set.
         On the 65x series of processors - the eight-bit 6502 and 65C02 and their sixteen-bit successors, the
65802 and 65816 - you move data almost entirely using the microprocessor registers.
         This chapter discusses how to load the registers with data and store data from the registers to memory
(using one of the simple addressing modes as an example), how to transfer and exchange data between registers,
how to move information onto and off of the stack, and how to move blocks (or strings) of data from one
memory location to another (see Table 6-1).




                                                                                                            69
```

<!-- programmanual p070 -->

```
The Western Design Center


                                 Available on:
 Mnemonic                 6502    65C02          65802/816       Description
 Load/Store Instructions:
      LDA                   x       x               x        load the accumulator
      LDX                   x       x               x        load the X index register
      LDY                   x       x               x        load the Y index register
      STA                   x       x               x        store the accumulator
      STX                   x       x               x        store the X index register
      STY                   x       x               x        store the Y index register

 Push Instructions:
       PHA                 x        x               x        push the accumulator
       PHP                 x        x               x        push status register (flags)
       PHX                          x               x        push X index register
       PHY                          x               x        push Y index register
       PHB                                          x        push data bank register
       PHK                                          x        push program bank register
       PHD                                          x        push direct page register

 Push Instructions Introduced:
       PEA                                          x        push effective absolute address
       PEI                                          x        push effective indirect address
       PER                                          x        push effective relative address

 Pull Instructions:
        PLA                x        x               x        pull the accumulator
        PLP                x        x               x        pull status register (flags)
        PLX                         x               x        pull X index register
        PLY                         x               x        pull Y index register
        PLB                                         x        pull data bank register
        PLD                                         x        pull direct page register

 Transfer Instructions:
       TAX                 x        x               x        transfer A to X
       TAY                 x        x               x        transfer A to Y
       TSX                 x        x               x        transfer S to X
       TXS                 x        x               x        transfer X to S
       TXA                 x        x               x        transfer X to A
       TYA                 x        x               x        transfer Y to A
       TCD                                          x        transfer C accumulator to D
       TDC                                          x        transfer D to C accumulator
       TCS                                          x        transfer C accumulator to S
                                                             (Continued)
       TSC                                          x        transfer S to C accumulator
       TXY                                          x        transfer X to Y
       TYX                                          x        transfer Y to X

 Exchange Instructions:
      XBA                                           x        exchange B & A accumulator
      XCE                                           x        exchange carry & emulation bits

 Store Zero to Memory:
       STZ                          x               x        store zero to memory

 Block Moves:
       MVN                                          x        move block in negative direction
       MVP                                          x        move block in positive direction


                                        Table 6-1 Data Movement Instruction




                                                                                                70
```

<!-- programmanual p071 -->

```
The Western Design Center


         When programming the 6502, whether you’re storing a constant value to memory or moving data from
one memory location to another, one of the registers is always intermediate. The same is generally true for the
other 65x processors, with a few exceptions: the 65816’s two block move instructions, three of its push
instructions, and an instruction first introduced on the 65C02 to store zero to memory.
         As a result, two instructions are required for most data movement: one to load a register either with a
constant value from program memory or with a variable value from data memory; the second to store the value
to a new memory location.
         Most data is moved via the accumulator. This is true for several reasons. First, the accumulator can
access memory using more addressing modes than any of the other registers. Second, with a few exceptions,
it’s only in the accumulator that you can arithmetically or logically operate on data (although the index
registers, in keeping with their role as loop counters and array pointers, can be incremented, decremented, and
compared). Third, data movement often takes places inside of loops, program structures in which the index
registers are often dedicated to serving as counters and pointers.

Loading and Storing Registers

         To provide examples of the six basic data-movement instructions - LDA, LDX, LDY (load
accumulator or index registers) and STA, STX, and STY (store accumulator or index registers) - requires
introducing at least one of the 65x addressing modes. Except for certain instructions - such as push and pull,
which use forms of stack addressing - the absolute addressing mode will generally be used in this chapter.
Absolute addressing, available on all four 65x processors, is one of the simplest modes to understand. It
accesses data at a known, fixed memory location.
         For example, to move a byte from one absolute memory location to another, load a register from the
first location, then store that register to the other location. In Listing 6.1, the eight-bit value $77 stored at the
absolute location identified by the label SOURCE is first loaded into the accumulator, then saved to the
absolute location DEST. Note the inclusion of the mode-switching code described in the previous chapter.
         The code generated by the assembler, when linked, will begin at the default origin location, $2000. The
example generates 13 ($0D) bytes of actual code (the address of the RTS instruction is at memory location
$200C). The assembler then automatically assigns the next available memory location, $200D, to the label on
the following line, SOURCE. This line contains a DC (define constant) assembler directive, which causes the
hexadecimal value $77 to be stored at that location in the code file ($200D). Since only one byte of storage is
used, the data storage location reserved for the label DEST on the next line is $200E.
         The syntax for absolute addressing lets you code, as an instruction’s operand, either a symbolic label or
an actual value. The assembler converts a symbolic operand to its correct absolute value, determined from its
context that absolute addressing is intended, and generates the correct opcode for the instruction using absolute
addressing. The assembler-generated hexadecimal object code listed to the left of the source code shows that
the assembler filled in addresses $000D and $000E as the operands for the LDA and STA instructions,
respectively (they are, of course, in the 65x’s standard low-high order and relative to the $0000 start address the
assembler assigns to its relocatable modules; the linker will modify these addresses to $200D and $200E when
creating the final loadable object).
         As Chapter 4 explained, the 65816’s accumulator can be toggled to deal with either eight-bit or sixteen-
bit quantities, as can its index registers, by setting or resetting the m (memory/accumulator select) or x (index
register select) flag bits of the status register. You don’t need to execute a SEP or REP instruction before every
instruction or every memory move, provided you know the register you intend to use is already set correctly.
But always be careful to avoid making invalid assumptions about the modes currently in force, particularly
when transferring control from code in one location to code in another.
         The load and store instructions in Listing 6.1 will as easily move a double byte as they did a
byte, if the register you use is in sixteen-bit mode, as in Listing 6.2.




                                                                                                                  71
```

<!-- programmanual p072 -->

```
The Western Design Center

 0001     0000                              KEEP KL.6.1
 0002     0000                              65816 ON
 0003     0000
 0004     0000                 MAIN         START
 0005     0000
 0006     0000                 ;            code to switch from 6502 emulation to native mode
 0007     0000
 0008     0000    18                        CLC                       clear carry flag
 0009     0001    FB                        XCE                       exchange carry with E bits (clear E bit)
 0010     0002
 0011     0002                 ;            main example code
 0012     0002
 0013     0002    E220                      SEP #%00100000            set 8-bit data mode
 0014     0004    AD0D00                    LDA SOURCE                load byte from memory location SOURCE
 0015     0007    8D0E00                    STA DEST                  store byte to memory location DEST
 0016     000A
 0017     000A                 ;            code to return to 6502 emulation mode
 0018     000A
 0019     000A    38                        SEC                       set carry flag
 0020     000B    FB                        XCE                       exchange carry with E bit (set E bit)
 0021     000C                 ;
 0022     000C    60                        RTS
 0023     000D
 0024     000D    77           SOURCE       DC            H’77’
 0025     000E    00           DEST         DS            1
 0026     000F
 0027     000F                              END

                                                    Listing 6.1.

         Note that the source data in the define constant statement is now two bytes long, as is storage reserved
by the define storage statement that follows. If you look at the interlisted hexadecimal code generated by the
assembler, you will see that the address of the label DEST is now $200F. The assembler has automatically
adjusted for the increase in the size of the data at SOURCE, which is the great advantage of using symbolic
labels rather than fixed addresses in writing assembler programs.
         The load and store instructions are paired here to demonstrate that, when using identical addressing
modes, the load and store operations are symmetrical. In case, though, a value loaded into a register will be
stored many instructions later, or never at all, or stored using an addressing mode different from that of the load
instruction.




                                                                                                                 72
```

<!-- programmanual p073 -->

```
The Western Design Center

 0001    0000                              KEEP KL.6.2
 0002    0000                              65816 ON
 0003    0000
 0004    0000                 MAIN         START
 0005    0000
 0006    0000                 ;            switch from 6502 emulation to native mode
 0007    0000    18                        CLC
 0008    0001    FB                        XCE
 0009    0002                 ;
 0010    0002    C220                      REP        #%00100000       reset accumulator to 16-bit mode
 0011    0004    AD0D00                    LDA        SOURCE           load double byte from memory location SOURCE
 0012    0007    8D0F00                    STA        DEST             store double byte to memory location DEST
 0013    000A
 0014    000A                 ;            switch back to emulation mode
 0015    000A    38                        SEC
 0016    000B    FB                        XCE
 0017    000C                 ;
 0018    000C    60                        RTS
 0019    000D                 ;
 0020    000D    7F7F         SOURCE       DC         A’$7F7F’
 0021    000F    0000         DEST         DS         2
 0022    0011                              END

                                                    Listing 6.2.

Effect of Load and Store Operations on Status Flags

        One of the results of the register load operations - LDA, LDY, and LDX - is their effect on certain
status flags in the status register. When a register is loaded, the n and z flags are changed to reflect two
conditions: whether the value loaded has its high bit set (is negative when considered as a signed, two’s-
complement number); and whether the number is equal to zero. The n flag is set when the value loaded is
negative and cleared otherwise. The z flag is set when the value loaded is zero and cleared otherwise. How you
use these status flags will be covered in detail in Chapter 8, Flow of Control.
        The store operation does not change any flags, unlike the Motorola 68xx store instructions. On the
other hand, Intel 808x programmers will discover the 65x processors use load and store instructions instead of
the 808x’s all-encompassing MOV instruction. The 808x move instruction changes no flags whatsoever, unlike
the 65x load instruction, which does.

Moving Data Using the Stack
         All of the 65x processors have a single stack pointer. (This is a typical processor design, although there
are designs that feature other stack implementations, such as providing separate stack pointers for the system
supervisor and the user.) This single stack is therefore used both by the system for automatic storage of address
information during subroutine calls and of address and register information during interrupts, and by user
programs for temporary storage of data. Stack use by the system will be covered in later chapters.
         As the architecture chapters in Part II discussed. The S register (stack pointer) points to the next
available stack location; that is, S holds the address of the next available stack location. Instructions using stack
addressing locate their data storage either at or relative to the next available stack location.
         The stack pointers of the 6502 and 65C02 are only eight bits wide; the eight-bit value in the stack
pointer is added to an implied base of $100, giving the actual stack memory of $100 to $1FF; the stack is
confined to page one. The 65816’s native mode stack pointer, on the other hand, is sixteen bits wide, and may
point to any location in bank zero (the first 64K of memory). The difference is illustrated in Figure 6.1.




                                                                                                                  73
```

<!-- programmanual p074 -->

```
The Western Design Center

Push

         Push instructions store data, generally located in a register, onto the stack. Regardless of a register’s
size, the instruction that pushes it takes only a single byte.
         When a byte is pushed onto the stack, it is stored to the location pointed to by the stack pointer, after
which the stack pointer is automatically decremented to point to the next available location.
         When double-byte data or a sixteen-bit address is pushed onto the stack, first its high-order byte is
stored to the location pointed to by the stack pointer, the stack pointer is decremented, the low byte is stored to
the new location pointed to by the stack pointer, and finally the stack pointer is decremented once again,
pointing past both bytes of pushed data. The sixteen-bit value ends up on the stack in the usual 65x memory
order: low byte in the lower address, high byte in the higher address.
         In both cases, the stack grows downward, and the stack pointer points to the next available (unused)
location at the end of the operation.




                                                                                                                74
```

<!-- programmanual p075 -->

```
The Western Design Center

                              $ffff




                            MEMORY
                                                      65816/65802
                                                      native mode stack pointer:
                                                      16-bit range
                                                      $0000-$FFFF




 6502/65C02
 and
 65816/65802
 emulation mode
 stack pointer:               $0200
 8-bit range
 $0100-$01FF
                              $0100




                              $0000


                            Figure 6-1 Stack Memory




                                                                              75
```

<!-- programmanual p076 -->

```
The Western Design Center

Pushing the Basic 65x Registers
         On the 6502, only the contents of the accumulator and the status register can be pushed directly onto the
stack in a single operation, using the PHA and PHP instructions, respectively. The 65C02 adds instructions to
push the index registers onto the stack: PHX and PHY.
         The 65816 and 65802 let double-byte data as well as single bytes be pushed onto the stack. Figure 6.2
shows the results of both. In the case of the accumulator and index registers, the size of the data pushed onto
the stack depends on the settings of the m memory/accumulator select and x index register select flags. Since
the accumulator and index registers are of variable size (eight bits or sixteen), the PHA, PHX, and PHY
instructions have correspondingly variable effects.

Pull
         Pull instructions reverse the effects of the path instructions, but there are fewer pull instructions, all of them
single-bit instructions that pull a value off the stack into a register. Unlike the Motorola and Intel processors (68xx and
808x), the 65x pull instructions set the n and z flags. So programmers used to using pull instructions between a test and a
branch on the other processors should exercise caution with the 65x pull instructions.

Pulling the Basic 65x Registers

         The 6502 pull instructions completely complement its push instructions. PLP increments the stack
pointer, then loads the processor status register (the flags) from the page one address pointed to by the offset in
the stack pointer (of course, this destroys the previous contents of the status register). PLA pulls a byte from
the stack into the accumulator, which affects the n and z flags in the status register just as a load accumulator
instruction does.
         As instructions for pushing the index registers were added to the 65C02, complementary pull
instructions were added, too - that is, PLX and PLY. The pull index register instructions also affect the n and z
flags.
         On the 65802 and 65816, the push and pull instructions for the primary user registers - A, X, and Y -
have been augmented to handle sixteen-bit data when the appropriate select flag (memory/accumulator or index
register) is clear. Code these three pull instructions carefully since the stack pointer will be incremented one or
two bytes per pull depending on the current settings of the m and x flags.




                                                                                                                        76
```

<!-- programmanual p077 -->

```
The Western Design Center
                                        8-Bit or Low Byte
                                        of 16-Bit Register
                       High                                  Low




                                             ·
                                             ·
           Old Stack Pointer                 ·
                                        8 Bit Data
                                    Next Stack Location
        New Stack Pointer
                                            ·
                                            ·
                                            ·
                                          Stack
                                         Memory

                                         16-Bit Register
                       High                                  Low




                                                ·
                                                ·
                Old Stack Pointer               ·
                                           Data High
                                            Data Low
                                       Next Stack Location
               New Stack Pointer                ·
                                                ·
                                                ·
                                              Stack
                                            Memory



                                        Figure 6-2. Push




                                                                   77
```

<!-- programmanual p078 -->

```
The Western Design Center

Pushing and Pulling the 65816’s Additional Registers
        The 65816 adds one-byte push instructions for all its new registers, and pull instructions for all but one
of them. In fact, the bank registers can only be accessed using the stack. PHB pushes the contents of the data
bank register, an eight-bit register, onto the stack. PLB pulls an eight-bit value from the stack into the data
bank register. Two most common uses for PHB are, first, to let a program determine the currently active data
bank, and second, to save the current data bank prior to switching to another bank.
        Fragment 6.1 is a 65816 code fragment which switches between two data banks. While OTHBNK is
declared just once, it represents two different memory cells, both with the same sixteen-bit address of $FFF3,
but in two different 64K banks: one is in the data bank that is current when the code fragment is entered; the
second is in the data bank switched to by the code fragment. The code fragment could be executed a second
time and the data bank would be switched back to the original bank.

 0000                OTHBNK       GEQU      $FFF3           location of other bank stored here
 0000
 0000                             .
 0000                             .
 0000                             .
 0000     E220                    SEP       #%00100000      set accumulator to 8-bit mode
 0002
 0002     ADF3FF                  LDA       OTHBNK          get location of bank to switch to
 0005
 0005     8B                      PHB                       push current data bank onto stack
 0006     48                      PHA                       push other data bank onto stack
 0007
 0007     AB                      PLB                       pull data bank: make other data bank current
 0008     68                      PLA                       get original data bank into accum
 0009
 0009     8DF3FF                  STA       OTHBNK          store it in 2nd bank so can be restored
 000C                             .
 000C                             .
 000C                             .
 000C

                                                  Fragment 6.1.

         Similar to PHB, the PHK instruction pushes the value in the eight-bit program counter bank register
onto the stack. Again, the instruction can be used to let you locate the current bank; this is useful in writing
bank-independent code, which can be executed out of any arbitrarily assigned bank.
         You’re less likely to use PHK to preserve the current bank prior to changing banks (as in the case of
PHB above) because the jump to subroutine long instruction automatically pushes the program counter bank
as it changes it, and because there is no complementary pull instruction. The only way to change the value in
the program counter bank register is to execute a long jump instruction, and interrupt, or a return from
subroutine or interrupt. However, you can use PHK to synthesize more complex call and return sequences, or
to set the data bank equal to the program bank.
         Finally, the PHD instruction pushes the sixteen-bit direct page register onto the stack, and PLD pulls a
sixteen-bit value from the stack into the direct page register. PHD is useful primarily for preserving the direct
page location before changing it, while PLD is an easy way to change or restore it. Note that PLB and PLD
also affect the n and z flags.




                                                                                                               78
```

<!-- programmanual p079 -->

```
The Western Design Center

Pushing Effective Addresses
         The 65816 also provides three instructions which can push data onto the stack without altering any
registers. These three push effective address instructions - PEA, PEI, and PER - push absolute, indirect, and
relative sixteen-bit addresses or data directly onto the stack from memory. Their use will be explained when
their addressing modes are presented in detail in Chapter 11 (Complex Addressing Modes).

Other Attributes of Push and Pull
         The types of data that can be pushed but not pulled are effective addresses and the K (or more
commonly PBR) program bank register.
         PLD and PLB are typically used to restore values from a previous state.
         Finally, you should note that even though the push and pull operations are largely symmetrical, data
that is pushed onto the stack from one register does not need to be pulled off the stack into the same register.
As far as the processor is concerned, data pulled off the stack does not have to be the same size as was pushed
onto it. But needless to say, the stack can quickly become garbled if you are not extremely careful.

Moving Data Between Registers

Transfers

        The accumulator is the most powerful of the user registers, both in the addressing modes available to
accumulator operations and in its arithmetic and logic capabilities. As a result, addresses and indexes that must
be used in one of the index registers must often be calculated in the accumulator. A typical problem on the
6502 and 65C02, since their registers are only eight bits wide, is that sixteen-bit values such as addresses must
be added or otherwise manipulated eight bits at a time. The other half of the value, the high or low byte, must
meanwhile be stored away for easy retrieval and quick temporary storage of register contents in a currently
unused register is desirable.
        For these reasons as well as to transfer a value to a register where a different operation or addressing
mode is available, all 65x processors implement a set of one-byte implied operand instructions which transfer
data from one register to another:

         TAX         transfers the contents of the accumulator to the X index register
         TAY         transfers the contents of the accumulator to the Y index register
         TSX         transfers the contents of the stack pointer to the X index register
         TXS         transfers the contents of the X index register to the stack pointer
         TXA         transfers the contents of the X index register to the accumulator
         TYA         transfers the contents of the Y index register to the accumulator

         Like the load instructions, all of these transfer operations except TXS set both the n and z flags. (TXS
does not affect the flags because setting the stack is considered an operation in which the data transferred is
fully known and will not be further manipulated.)
         The availability of these instructions on the 65802/65816, with its dual-word-size architecture, naturally
leads to some questions when you consider transfer of data between registers of different sizes. For example,
you may have set the accumulator word size to sixteen bits, and the index register size to eight. What happens
when you execute a TAY (transfer A to Y) instruction?
         The first rule to remember is that the nature of the transfer is determined by the destination register. In
this case, only the low-order eight bits of the accumulator will be transferred to the eight-bit Y register. A
second rule also applies here: when the index registers are eight bits (because the index register select flag is
set), the high byte of each index register is always forced to zero upon return to sixteen-bit size, and the low-
order value of each sixteen-bit index register contains its previous eight-bit value.
         Listing 6.3 illustrates these rules with TAY. In this example, the value stored at the location DATA2 is
$0033; only the low order byte has been transferred from the accumulator, while the high byte has been zeroed.
         The accumulator, on the other hand, operates differently. When the accumulator word size is switched
from sixteen bits to eight, the high-order byte is preserved in a “hidden” accumulator, B. It can even be
                                                                                                                 79
```

<!-- programmanual p080 -->

```
The Western Design Center

accessed without changing modes back to the sixteen-bit accumulator size by executing the XBA (exchange B
with A) instructions, described in the following section. Listing 6.4 illustrates this persistence of the
accumulator’s high byte. After running it, the contents of locations RESULT. RESULT+1 will be $7F33, or
33 7F, in low-high memory order. In other words, the value in the high byte of the sixteen-bit accumulator,
$7F, was preserved across the mode switch to eight-bit word size.
         Now consider the case where the sixteen-bit Y register is transferred to an eight-bit accumulator, as
shown in Listing 6.5. The result in this case is $33FF, making it clear that the high byte of the Y register has
not been transferred into the inactive high-order byte of the accumulator. The rule is that operations on the
eight-bit A accumulator affect only the low-order byte in A, not the hidden high byte in B. Transfers into the A
accumulator fall within the rule.
         Figure 6.3 summarizes the effects of transfers between registers of different sizes.

   0001    0000                               KEEP         KL.6.3
   0002    0000
   0003    0000                               65816        ON
   0004    0000
   0005    0000
   0006    0000                  MAIN         START
   0007    0000                  ;            switch-to-native-mode code
   0008    0000      18                       CLC                        clear carry flag
   0009    0001      FB                       XCE                        exchange carry with e bit (clear e bit)
   0010    0002
   0011    0002      C220                     REP          #$20           set accum to 16
   0012    0004      E210                     SEP          #$10           set index to 8
   0013    0006      AD1200                   LDA          DATA
   0014    0009      A8                       TAY
   0015    000A      C210                     REP          #$10           set index to 16
   0016    000C      8C1400                   STY          DATA2
   0017    000F
   0018    000F                  ;            return to 6502 emulation mode
   0019    000F      38                       SEC                        set carry flag
   0020    0010      FB                       XCE                        exchange carry with e bit (set e bit)
   0021    0011
   0022    0011      60                       RTS
   0023    0012
   0024    0012      33FF        DATA         DC           A’$FF33’
   0025    0014      0000        DATA2        DS           2
   0026    0016
   0027    0016                               END

                                                    Listing 6.3.

         There are also rules for transfers from eight-bit to a sixteen-bit register. Transfers out of the eight-bit
accumulator into a sixteen-bit index register transfer both eight-bit accumulators.
         In Listing 6.6, the value saved to RESULT is $7FFF, showing that not only is the eight-bit A
accumulator transferred to become the low byte of the sixteen-bit index register, but the hidden B accumulator
is transferred to become the high byte of the index register. This means you can form a sixteen-bit index in the
eight-bit accumulator one byte at a time, then transfer the whole thing to the index register without having to
then transfer the whole thing without having to switch the accumulator to sixteen bits first. However, take care
not to inadvertently transfer an unknown hidden value when doing transfers from the eight-bit accumulator to a
sixteen-bit index register.




                                                                                                                   80
```

<!-- programmanual p081 -->

```
The Western Design Center

      0001   0000                     KEEP
      0002   0000                     65816
      0003   0000
      0004   0000            MAIN     START
      0005   0000
      0006   0000            ;        switch-to-native-mode code
      0007   0000   18                CLC                    clear carry flag
      0008   0001   FB                XCE                    exchange carry with e bit (clear e bit)
      0009   0002
      0010   0002   C230              REP         #$30         set accum and index size to 16
      0011   0004   AD1400            LDA         DATA16       load accum with 16-bit value at DATA16
      0012   0007   E220              SEP         #$20         set accum to eight bits
      0013   0009   AD1600            LDA         DATA8        load 8-bit value at DATA8
      0014   000C   C220              REP         #$20         make accum 16 again
      0015   000E   8D1700            STA         RESULT       save accum lo.hi in RESULT.RESULT+1
      0016   0011
      0017   0011            ;        return to 6502 emulation mode
      0018   0011   38                SEC                     set carry flag
      0019   0012   FB                XCE                     exchange carry with e bit (set e bit)
      0020   0013
      0021   0013   60                RTS
      0022   0014
      0023   0014   FF7F     DATA16   DC          A’$7FFF’
      0024   0016   33       DATA8    DC          H’33’
      0025   0017   0000     RESULT   DS          2
      0026   0019
      0027   0019                     END

                                              Listing 6.4




                                                                                                        81
```

<!-- programmanual p082 -->

```
The Western Design Center

        Transfers from eight-bit index register to the sixteen-bit accumulator result in the index register
being transferred into the accumulator’s low byte while the accumulator’s high byte is zeroed. This is
consistent with the zeroing of the high byte when eight-bit index registers are switched to sixteen bits.
         In Listing 6.7, the result is $0033, demonstrating that when an eight-bit index register is transferred to
the sixteen-bit accumulator, a zero is concatenated as the high byte of the new accumulator value.

  0001     0000                                    KEEP         KL.6.5
  0002     0000                                    65816        ON
  0003     0000
  0004     0000                     MAIN           START
  0005     0000
  0006     0000                     ;              switch to native mode
  0007     0000
  0008     0000       18                           CLC                           clear carry flag
  0009     0001       FB                           XCE                           exchange carry with e bit (clear e bit)
  0010     0002
  0011     0002       C230                         REP          #$30             set accum, index size to 16
  0012     0004       AC1500                       LDY          DATA16           load Y-reg with 16-bit value at DATA16
  0013     0007       AD1700                       LDA          DATA2            load accum with 16-bit value at DATA2
  0014     000A       E220                         SEP          #$20             set accum to eight bits
  0015     000C       98                           TYA                           transfer Y register’s value to A
  0016     000D       C220                         REP          #$20             make accum 16 again
  0017     000F       8D1900                       STA          RESULT           save accum lo.hi in RESULT>RESULT+1
  0018     0012
  0019     0012                     ;              return to 6502 emulation mode
  0020     0012
  0021     0012       38                           SEC                           set carry flag
  0022     0013       FB                           XCE                           exchange carry with e bit (set e bit)
  0023     0014
  0024     0014       60                           RTS
  0025     0015
  0026     0015       FF7F          DATA16         DC           A’$7FFF’
  0027     0017       4433          DATA2          DC           A’$3344’
  0028     0019       0000          RESULT         DS           2
  0029     001B
  0030     001B                                    END

                                                          Listing 6.5.

         In the 65816, transfers between index registers and the stack also depend on the setting of the destination register.
For example, transferring the sixteen-bit stack to an eight-bit register, as in Fragment 6.2, results in the transfer of just the
low byte. Obviously, though, you’ll find few reasons to transfer only the low byte of the sixteen-bit stack pointer. As
always, you need to be watchful of the current modes in force in each of your routines.
         The 65816 also adds new transfer operations to accommodate direct transfer of data to and from the new 65816
environment-setting registers (the direct page register and the sixteen-bit stack register), and also to complete the set of
possible register transfer instructions for the basic 65x user register set:




                                                                                                                              82
```

<!-- programmanual p083 -->

```
The Western Design Center

 (L = bits in low byte; H = bits in high byte; P = previous bits unmodified by transfer)
                    16-Bit Index Register-------------------to-------------------8-Bit Accumulator A
                                                          1 byte
   HHHH HHHH                 LLLL LLLL                                          PPPP PPPP           LLLL LLLL
                     X or Y                                                          B                  A
                 only transfer low byte (hidden B accumulator not affected)

             16-Bit Accumulator A-----------------to-------------------8-Bit Index Register
                                                1 byte
    HHHH HHHH        LLLL LLLL                                         0000 0000            LLLL LLLL
               A                                                                              X or Y
                                      only transfer low byte

           16-Bit Stack Pointer----------------------to-------------------8-Bit Index Register X
                                                    1 byte
    HHHH HHHH        LLLL LLLL                                            0000 0000            LLLL LLLL
               S                                                                                   X
                               of little use: only transfers address-low

                  8-Bit Register----------------------------to-------------------16-Bit Accumulator A
                                                           2 bytes
      0000 0000            LLLL LLLL                                             0000 0000           LLLL LLLL
                               X or Y                                                          A
                                              high byte transferred is 0

            8-Bit Accumulator A------------------to-------------------16-Bit index Register
                                                2 bytes
    HHHH HHHH       LLLL LLLL                                       HHHH HHHH               LLLL LLLL
        B               A                                                          X or Y
                                 transfer both accumulators

                    8-Bit index Register X----------------to-------------------16-Bit Stack Pointer
                                                        2 bytes
      0000 0000             LLLL LLLL                                          0000 0000            LLLL LLLL
                                 X                                                             S
                                          sets stack to page 0 value

                          Figure 6-3 Register Transfers Between Different-Sized Registers




                                                                                                                 83
```

<!-- programmanual p084 -->

```
The Western Design Center

 0001   0000                         KEEP        KL.6.6
 0002   0000                         65816       ON
 0003   0000
 0004   0000                MAIN     START
 0005   0000
 0006   0000                ;        switch to native mode
 0007   0000
 0008   0000   18                    CLC                       clear carry flag
 0009   0001   FB                    XCE                       exchange carry with e bit (clear e bit)
 0010   0002
 0011   0002   C230                  REP         #$30          set accum, index size to 16 bits
 0012   0004   AD1300                LDA         DATA16        load accum with 16-bit value at DATA16
 0013   0007   AC1500                LDY         DATA2         load Y-reg with 16-bit value at DATA2
 0014   000A   E220                  SEP         #$20          set accum to eight bits
 0015   000C   A8                    TAY                       transfer accum to Y
 0016   000D   8C1700                STY         RESULT        save 16-bit index into RESULT.RESULT+1
 0017   0010
 0018   0010                ;        return to 6502 emulation mode
 0019   0010
 0020   0010   38                    SEC                       set carry flag
 0021   0011   FB                    XCE                       exchange carry with e bit (set e bit)
 0022   0012
 0023   0012   60                    RTS
 0024   0013
 0025   0013
 0026   0013   FF7F         DATA16   DC          A’$7FFF’
 0027   0015   4433         DATA2    DC          A’$3344’
 0028   0017   0000         RESULT   DS          2
 0029   0019
 0030   0019                         END

                                             Listing 6.6




                                                                                                         84
```

<!-- programmanual p085 -->

```
The Western Design Center

  0001    0000                                   KEEP         KL.6.7
  0002    0000                                   65816        ON
  0003    0000
  0004    0000
  0005    0000                  MAIN             START
  0006    0000
  0007    0000                  ;                switch-to-native-mode code
  0008    0000
  0009    0000      18                           CLC                           clear carry flag
  0010    0001      FB                           XCE                           exchange carry with e bit (clear e bit)
  0011    0002
  0012    0002      E210                         SEP          #$10             set index size to 8 bits
  0013    0004      C220                         REP          #$20             set accum to 16 bits
  0014    0006      AD1300                       LDA          DATA16           load accum with 16-bit value at DATA16
  0015    0009      AC1500                       LDY          DATA8            load Y-reg with 8-bit value at DATA8
  0016    000C      98                           TYA                           transfer Y to accumulator
  0017    000D      8D1600                       STA          RESULT           save 16-bit accum into RESULT.RESULT+1
  0018    0010
  0019    0010                  ;                return to 6502 emulation mode
  0020    0010
  0021    0010      38                           SEC                           set carry flag
  0022    0011      FB                           XCE                           exchange carry with e bit (set e bit)
  0023    0012
  0024    0012      60                           RTS
  0025    0013
  0026    0013
  0027    0013      FF7F        DATA16           DC           A’$7FFF’
  0028    0015      33          DATA8            DC           H’33’
  0029    0016      0000        RESULT           DS           2
  0030    0018
  0031    0018                                   END

                                                         Listing 6.7

  0000     E210          SEP        #%00010000        set index mode to 8 bits
  0002     BA            TSX                          transfer low byte of stack ptr to 8-bit x

                                                       Fragment 6.2

         TCD      transfers the contents of the sixteen-bit accumulator C to the D direct page register. The use of
                  the letter C in this instruction’s mnemonic to refer to the accumulator indicates that this
                  operation is always is a sixteen-bit transfer, regardless of the setting of the memory select flag.
                  For such a transfer to be meaningful, of course, the high-order byte of the accumulator must
                  contain a valid value.
         TDC     transfer the contents of the D direct page register to the sixteen-bit accumulator. Again, the use
                 of the letter C in the mnemonic to name the accumulator indicates that the sixteen-bit
                 accumulator is always used, regardless of the setting of the memory select flag. Thus, sixteen
                 bits are always transferred, even if the accumulator size is eight bits, in which case the high
                 byte is stored to the hidden B accumulator.
         TCS     transfers the contents of the sixteen-bit C accumulator to the S stacker pointer register, thereby
                 relocating the stack. Since sixteen bits will be transferred regardless of the accumulator word
                 size, the high byte of the accumulator must contain valid data.
         TSC     transfer the contents of the sixteen-bit S stacker pointer register to the sixteen-bit accumulator,
                 C, regardless of the accumulator word size.
         TXY     transfers the contents of the X index register to the Y index register. Since X and Y will always
                 have the same register size, there is no ambiguity.
         TYX     transfers the contents of the Y index register to the X index register. Both will always be the
                 same size.
                                                                                                                         85
```

<!-- programmanual p086 -->

```
The Western Design Center

          Transfer instructions take only one byte, with the source and destination both specified in the opcode
itself. In all transfers, the data remains intact in the original register as well as being copied into the new
register.
          Using TCS and TCD can be dangerous when the accumulator is in eight-bit mode, unless the
accumulator was recently loaded in sixteen-bit mode so that the high byte, hidden when the switch was made to
eight-bit mode, is still known. Transferring an indeterminate hidden high byte of the accumulator along with its
known low byte into a sixteen-bit environment register such as the stack pointer will generally result in disaster.
          As always, you need to be watchful of the modes currently in force in each of your routines.

Exchanges
         The 65802 and 65816 also implement two exchange instructions, neither available on the 6502 or
65C02. An exchange differs from a transfer in the two values are swapped, rather than one value being copied
to a new location.
         The first of the two exchange instructions, XBA, swaps the high and low bytes of the sixteen-bit
accumulator (the C accumulator).
         The terminology used to describe the various components of the eight-or-sixteen bit accumulator is: to
use A to name the accumulator as a register that may be optionally eight or sixteen bits wide (depending on the
m memory/accumulator select flag); to use C when the accumulator is considered to be sixteen bits regardless
of the setting of the m flag; and, when A is used in eight-bit mode to describe the low byte only, to use B to
describe the hidden high byte of the sixteen-bit accumulator. In the latter case, when the accumulator size is set
to eight bits, only the XBA instruction can directly access the high byte of the sixteen-bit “double accumulator”,
B. This replacement of A for B and B for A can be used to simulate two eight-bit accumulators, each of which,
by swapping, “shares” the actual A accumulator. It can also be used in the sixteen-bit mode for inverting a
double-byte value. The XBA instruction is exceptional in that the n flag is always set on the basis of bit seven
of the resulting accumulator A, even if the accumulator is sixteen bits.
         The second exchange instruction, XCE, is the 65816’s only, method for toggling between 6502
emulation mode and 65816 native mode. Rather than exchange register values, it exchanges two-bits - the carry
flag, which is bit zero of the status register, and the e bit, which should be considered a kind of appendage to the
status register and which determines the use of several of the other flags.
         Fragment 6.3 sets the processor to 6502 emulation mode. Conversely, native mode can be set by
replacing the SEC with a CLC clear carry instruction.

                                    0010 38                     SEC
                                    0011 FB                     XCE

                                                   Fragment 6.3

        Because the exchange stores the previous emulation flag setting into the carry, it can be saved and
restored later. It can also be evaluated with the branch-on-condition instructions to be discussed in Chapter 8
(Flow of Control) to determine which mode the processor was just in. A device driver routine that needs to set
the emulation bit, for example, can save its previous value for restoration before returning.
        The selection of the carry flag for the e bit exchange instruction is in no way connected to the normal
use of the carry flag in arithmetic operations. It was selected because it is easy to set and reset, it is less
frequently used than the sign and zero flags, and there are branch-on-conditions instructions which test it. The
primary use of the SEC and CLC instructions for arithmetic will be covered in upcoming chapters.

Storing Zero to Memory
        The STZ instructions, introduced on the 65C02, lets you clear either a single or double byte memory
word zero, depending, as usual, on the current memory/accumulator select flag word size. Zero has long been
recognized as one of the most commonly stored values, so a “dedicated” instruction to store zero to memory can
improve the efficiency of many 65x programs. Furthermore, the STZ instruction lets you clear memory without
having to first load one of the registers with zero. Using STZ results in fewer bytes of code, faster execution,
and undisturbed registers.
                                                                                                                 86
```

<!-- programmanual p087 -->

```
The Western Design Center

Block Moves

          The two block move instructions, available only on the 65802 and the 65816, let entire blocks (or
strings) of memory be moved at once.
          Before using either instruction, all three user registers (C,X, and Y) must be set up with values which
serve as parameters.
          The C accumulator holds the count of the number of bytes to be moved, minus one. It may take some
getting used to, but this “count” is numbered from zero rather than one. The C accumulator is always sixteen
bits: if the m mode flag is set to eight bits, the count is still the sixteen-bit value in C, the concatenation of B
and A.
          X and Y specify either the top or the bottom addresses of the two blocks, depending on which of the
two versions of the instruction you choose. In Listing 6.8, $2000 bytes of data are moved from location $2000
to $4000.

  0001     0000                               KEEP          KL.6.8
  0002     0000                               65816         ON
  0003     0000
  0004     0000                 MAIN          START
  0005     0000
  0006     0000     18                        CLC
  0007     0001     FB                        XCE
  0008     0002
  0009     0002     C230                      REP           #$30        reset data and index mode to 16 bits
  0010     0004                               LONGA         ON
  0011     0004                               LONGI         ON
  0012     0004
  0013     0004     AD1300                    LDA           COUNT       load 16-bit C accum with # bytes to be moved
  0014     0007     AE1500                    LDX           SOURCE      load 16-bit X reg with address of source
  0015     000A     AC1700                    LDY           DEST        load 16-bit Y reg with address of destination
  0016     000D
  0017     000D     540000                    MVN           0,0
  0018     0010
  0019     0010     38                        SEC
  0020     0011     FB                        XCE
  0021     0012     60                        RTS
  0022     0013
  0023     0013     FF1F        COUNT         DC            A’$1FFF’
  0024     0015     0020        SOURCE        DC            A’$2000’
  0025     0017     0040        DEST          DC            A’$4000’
  0026     0019
  0027     0019                               END

                                                      Listing 6.8.

        The MVN instruction uses X and Y to specify the bottom (or beginning) addresses of the two blocks of
memory. The first byte is moved from the address in X to the address in Y; then X and Y are incremented, C is
decremented, and the next byte is moved, and so on, until the number of bytes specified by the value in C is
moved (that is, until C reaches $FFFF). If C is zero, a single first byte is moved, X and Y are each incremented
once, and C is decremented to $FFFF.
        The MVP instruction assumes X and Y specify the top (or ending) addresses of the two blocks of
memory. The first byte is moved from the address in X to the address in Y; the X, Y and C are decremented,
the next byte is moved , and so on, until the number of bytes specified by the value in C is moved (until C
reaches $FFFF).
        The need for two distinct block move instructions becomes apparent when the problem of memory
overlap is considered. Typically, when a block of memory starting at location X is to be moved to location Y,
the intention is to replace the memory locations from Y to Y + C with the identical contents of the range X
through X + C. However, if these two ranges overlap, it is possible that as the processor blindly transfers
memory one byte at a time, it may overwrite a value in the source range before that value has been transferred.
        The rule of thumb is, when the destination range is a lower memory address than the source range, the
MVN instruction should be used (thus “Move Next”) to avoid overwriting source bytes before they have been
copied to the destination. When the destination range is a higher memory location than the source range, the
MVP instruction should be used (“Move Previous”).
                                                                                                                        87
```

<!-- programmanual p088 -->

```
The Western Design Center

         While you could conceivably move blocks with the index registers set to eight bits (your only option in
emulation mode), you could only move blocks in page zero to other page zero location. For all practical
purposes, you must reset the x mode flag to sixteen bits before setting up and executing a block move.
         Notice that assembling an MVN or MVP instruction generates not only an opcode, but also two bytes
of operand. The operand bytes specify the 64K bank from which and to which data is moved. When operating
in the 65816’s sixteen-megabyte memory space, this supports the transfer of up to 64K of memory from one
bank to another. In the object code, the first byte following the opcode is the bank address of the destination
and the second byte is the bank address of the source.
         But while this order provides microprocessor efficiency, assembler syntax has always been the more
logical left to right, source to destination (TAY, for example, transfers the accumulator to the Y index register).
As a result, the recommended assembler syntax is to follow the mnemonic first with a 24-bit source address
then with a 24-bit destination address - or more commonly with labels representing code or data addresses. The
assembler strips the bank byte from each address (ignoring the rest) and inserts them in the correct object code
sequence. (Destination bank, source bank.) For example:

 440102         MVP SOURCE, DEST                   move from bank of source(02) to bank of dest(01)

The bank byte of the label SOURCE is 02 while the bank byte of the label DEST is 01. As always, the
assembler does the work of converting the more human-friendly assembly code to the correct object code
format for the processor.
         If the source and destination banks are not specified, some assemblers will provide a user-specified
default bank value.
         The assembler will translate the opcode to object code, then supply its bank value for both of the
operand bytes:

 440000                      MVP

          If either bank is different from the default value, both must be specified.




                                                                                                                88
```
