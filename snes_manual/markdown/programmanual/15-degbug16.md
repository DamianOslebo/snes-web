# Chapter 15 — DEGBUG16 (65816 Programming Tool)

> A 65816 debugger's commands; peripheral to the assembler but shows register/state model.

## Contents (per the book's own TOC)

- Declarations (p232)
- LIST (p234)
- FLIST (p236)
- POB (p243)
- STEP (p244)
- PUTHEX (p246)
- TRACE (p252)
- DUMPREGS (p263)
- TABLES (p266)

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

## Body (pages 230–275)


<!-- programmanual p230 -->

```
The Western Design Center



15) Chapter Fifteen
DEGUG16 – A 65816 Programming Tool
         This chapter consists of a complete 65816 application example and a detailed discussion of its dozen or
so routines. Where possible, different programming techniques have been employed in an effect to illustrate
some of the different methods of coding that are available.
         The program, DEBUG16, is a rudimentary step-and-trace debugger. A debugger is a tool used during
software development to isolate and reveal sources of error in the program being tested. In other words, it helps
the programmer eliminate the bugs in a program, hence the name. A step-and-trace function lets the program
be halted after the execution of each single instruction and the registers and possibly other memory locations to
be examined. This effectively provides a “view” into the otherwise invisible internals of the processor.
         The ability to trace programs in this manner can be extremely useful: uninitialized variables, wild
branches, infinite loops – all of the common flaws that normally result in your program going away to never-
never land with little clue to their reasons for departure – are made visible. In addition to display the register
contents, a tracer will also list the opcode mnemonic and display the operand using the same syntax as
originally specified in the source program. This process is called disassembly. Although the tracing program
can accurately regenerate an approximation of the source line that resulted in a given instruction, it cannot
determine any of the symbolic labels that might have been given to the address found by the tracer in the
assembler source program. More sophisticated debuggers called symbolic debuggers let you load a program’s
symbol table created by either the link editor or assembler; the debugger’s disassembly routine looks up each
address in a disassembly in the symbol table and insert labels in place of addresses wherever a correspondence
is found.
         DEBUG16 also has a LIST entry point, at which its disassembler can be used apart from its tracer; this
lets you re-create a listing of a program without having the source code available. Again, there is no symbolic
information (labels) available. Additionally, the disassembler in its current form does not deal with variable
lengths of immediate operands when in the LIST mode.
         The tracer can display the dissembled instruction and register values either one instruction at a time, or
allow the trace to execute in free-running mode. When only one instruction is disassembled at a time, the tracer
is said to be single-stepping; pressing a key lets the next instruction be executed. Pressing RETURN toggles
the tracer into free-running mode. While free-running, a single key press will pause the trace. Pressing any key
except RETURN resumes tracing ; RETURN switches back to single-stepping.
         The basic theory of operation of the tracer is simple. Starting with the first program instruction, the
tracer calculates the length of the instruction by first determining the addressing mode associated with the
opcode, and then referring to a table that gives the instruction lengths for the different addressing modes. It can
therefore determine the location of the next instruction that follows the current one. It places a BRK instruction
at that location, having first saved the original value stored there. Next, it executes (via a JMP instruction) the
current instruction. As soon as that instruction completes, the program counter increments to the next
instruction, where it encounters the insert BRK. BRK initiates an interrupt cycle that returns control back to
the tracer, saves copies of all of the processor’s register contents to memory, then calls a routine which displays
them, along with the disassembled instruction.
         When the next step (next instruction) is to be executed, the BRK instruction is replaced with its original
value, and the cycle is repeated. In this way the program is able to gain control of the processor “in between”
the execution of each instruction.
         The exception to this method is whenever an instruction (such as a branch or jump) is encountered
which can change the flow of control; in these cases, the target location must be determined (by examining the
operand of the instruction), and a BRK inserted at that location instead.
         The disassembly output looks like Figure 15.1.




                                                                                                               230
```

<!-- programmanual p231 -->

```
The Western Design Center

           00:2000     4CCB22      JMP       $22CB
           00:2003     08          PHP
           00:2004     18          CLC
           00:2005     FB          XCE
           00:2006     08          PHP
           00:2007     08          PHD
           00:2008     F40003      PEA       $0300
           00:200B     2B          PLD
           00:200C     C220        REP       #$20
           00:200E     E210        SEP       #$10


                                         Figure 15-1 Disassembly Output


        And the tracer output looks like Figure 15.2.

           00:5000    A905      LDA     #$05
           A= 15 05 X= 00 11 Y= 00 13 S= 01 AA D= 00 00 B= 00 P= 7D E:1
           00:5002    AB        TAY
           A= 15 05 X= 00 11 Y= 00 05 S= 01 AA D= 00 00 B= 00 P= 7D E: 1
           00:5003    90060     STA     $600,Y
           A= 15 05 X= 00 11 Y= 00 05 S= 01 AA D= 00 00 B= 00 P= 7D E: 1
           00:5006    88        DEY
           A= 15 05 X= 00 11 Y= 00 04 S= 01 AA D= 00 00 B= 00 P=7D E:1
           00:5007    D0FA      BNE     $5003
           A= 15 05 X= 00 11 Y= 00 04 S= 01 AA D= 00 00 B= 00 P= 7D E:1
           00:5003    990060 STA        $600,Y
           A= 15 05 X= 00 11 Y= 00 04 S= 01 AA D= 00 00 B= 00 P= 7D E:1
           00:5006    88        DEY     $5003
           A= 15 05 X= 00 11 Y= 00 03 S= 01 AA D= 00 00 B= 00 P= 7D E:1
           00:5007    D0FA      BNE     $6000,Y
           A= 15 05 X= 00 11 Y= 00 03 S= 01 AA D= 00 00 B= 00 P= 7D E:1
           00:5003    990060 STA
           A= 15 05 X= 00 11 Y= 00 03 S= 01 AA D= 00 00 B= 00 P= 7D E:1
           00:5006    88        DEY
           A= 15 05 X= 00 11 Y= 00 02 S= 01 AA D= 00 00 B= 00 P= 7D E: 1


                                           Figure 15-2 Tracer Output


         This example was developed and tested using an AppleIIe with a 65816 processor card installed; the
calls to machine-dependent locations have been isolated and are clearly as such. DEBUG16 uses the native
BRK vector. On the AppleII, this location ($FFE6, FFE7) normally contains ROM data, which varies between
monitor ROM versions. Since there is no way to patch ROM, the solution opted for here is for DEBUG16 to
try to patch the location pointed to by the data that is stored there. For current ROMs, these are RAM locations
that happen to be more or less livable. Check the location pointed to by your ROMs, and make sure that neither
your own code nor the debugger are loaded into that area. DEBUG16 will automatically read whatever value is
stored there and store a vector to that address to regain control after a BRK.
         Both programs are executed by putting the starting address of the routine to list or trace (which has been
loaded into memory) at DPAGE+80.82 ($380.82) in low – high – bank order, and then calling either the
TRACE entry point at $2000, or the LIST entry at $2003.




                                                                                                               231
```

<!-- programmanual p232 -->

```
The Western Design Center

Declarations

        The listing begins with the declaration of global values by way of GEQU statements. Almost all of
these are addresses of direct page memory locations that will be used; one notable exception is the label
DPAGE, a sixteen-bit value that defines the beginning of the direct page memory to be used by this program.
Because a 65816 debugger is by definition a 6502 debugger, it is wise to relocate the direct page out of the
default zero page, since it will be used by 65802 programs, and you program being debugged. In the listing, a
value of $300 is used; on an Apple I I , this relocates the direct page to page three, which is a convenient page to
use.
        Many of the direct page locations are used to store the register contents of the user program when the
debugger is executing. All of the registers are represented. As you will see in the code, the adjacent positioning
of some of the registers is important and must be maintained.
        In addition to the direct page location used for register storage, one general-purpose temporary variable
is used, called TEMP. Three other variables – ADDRMODE, MNX, and OPLEN (for address mode,
mnemonic index, and operation length, respectively) – are used primarily to access the tables used in
disassembling an instruction.
        The variable CODE contains the instruction opcode currently being executed in the user program. The
variable NCODE contains the next instruction opcode to be executed, saved there before being replaced with
the BRK instruction inserted in the code. OPRNDL, OPRNDH, and OPRNDB contain the three (possible)
values of the operand of a given instruction.

   0001    0000
   0002    0000                           KEEP       DEBUG16
   0003    0000
   0004    0000                           65816      ON
   0005    0000                           MSB        ON
   0006    0000                           LONGA      OFF
   0007    0000                           LONGI      OFF
   0008    0000
   0009    0000            ***********************************************
   0010    0000            *                                             *
   0011    0000            *     DEBUG16                                 *
   0012    0000            *     A 65816 DEBUGGER                        *
   0013    0000            *                                             *
   0014    0000            *                                             *
   0015    0000            ***********************************************
   0016    0000
   0017    0000                           ORG        $8000
   0018    0000
   0019    0000            MAIN           START
   0020    0000
   0021    0000                           USING      MN
   0022    0000                           USING      ATRIBL
   0023    0000
   0024    0000
   0025    0000            DPAGE          GEQU       $300              LOCATION OF THIS APPLICATION’S
   0026    0000            ;                                           DIRECT PAGE
   0027    0000
   0028    0000            ;              DIRECT PAGE STORAGE
   0029    0000            ;              TRACE REGISTERS
   0030    0000            ;
   0031    0000
   0032    0000            PCREG          GEQU       $80               PROGRAM COUNTER
   0033    0000            PCREGH         GEQU       PCREG+1
   0034    0000            PCREGB         GEQU       PCREGH+1          INCLUDING BANK
   0035    0000
   0036    0000            NCODE          GEQU       PCREGB+1          NEXT CODE TO BE TRACED
   0037    0000
   0038    0000            OPCREG         GEQU       NCODE+1           OLD PROGRAM COUNTER VALUE
   0039    0000            OPCREGH        GEQU       OPCREG+1
   0040    0000            OPCREGB        GEQU       OPCREGH+1

                                                                                                                232
```

<!-- programmanual p233 -->

```
The Western Design Center
   0041   0000
   0042   0000           CODE       GEQU   OPCREGB+1    CURRENT CODE TO BE TRACED
   0043   0000
   0044   0000           OPRNDL     GEQU   CODE+1       OPERANDS OF CURRENT
   0045   0000           OPRNDH     GEQU   OPRNDL+1     INSTRUCTION
   0046   0000           OPRNDB     GEQU   OPRNDH+1
   0047   0000
   0048   0000
   0049   0000           XREG       GEQU   OPRNDB+1     X REGISTER
   0050   0000           XREGH      GEQU   XREG+1
   0051   0000
   0052   0000           YREG       GEQU   XREGH+1      Y REGISTER
   0053   0000           YREGH      GEQU   YREG+1
   0054   0000
   0055   0000           AREG       GEQU   YREGH+1      ACCUMULATOR
   0056   0000           AREGH      GEQU   AREG+1
   0057   0000
   0058   0000           STACK      GEQU   AREGH+1      STACK POINTER
   0059   0000           STACKH     GEQU   STACK+1
   0060   0000
   0061   0000
   0062   0000           DIRREG     GEQU   STACKH+1     DIRECT PAGE REGISTER
   0063   0000           DIRREGH    GEQU   DIRREG+1
   0064   0000
   0065   0000           DBREG      GEQU   DIRREGH+1    DATA BANK REGISTER
   0066   0000
   0067   0000           PREG       GEQU   DBREG+1      P STATUS REGISTER
   0068   0000
   0069   0000           EBIT       GEQU   PREG+1       E BIT
   0070   0000
   0071   0000           TEMP       GEQU   EBIT+2       TEMPORARY
   0072   0000           TEMPH      GEQU   TEMP+1
   0073   0000           TEMPB      GEQU   TEMPH+1
   0074   0000
   0075   0000
   0076   0000           ADDRMODE   GEQU   TEMPB+1      ADDRESS MODE OF CURRENT OPCODE
   0077   0000
   0078   0000           MNX        GEQU   ADDRMODE+1   MNEMONIC INDEX
   0079   0000           ;                                 FROM ATTRIBUTE TABLE
   0080   0000
   0081   0000           OPLEN      GEQU   MNX+2        LENGTH OF OPERATION,
   0082   0000           ;                                 INCLUDING INSTRUCTION
   0083   0000
   0084   0000           CR         GEQU   $8D          CARRIAGE RETURN
   0085   0000
   0086   0000
   0087   0000           M          GEQU   $20          SYBOLIC NAMES FOR
   0088   0000           X          GEQU   $10             STATUS REGISTER BITS
   0089   0000           C          GEQU   $01
   0090   0000
   0091   0000
   0092   0000
                 4C008
   0093   0000                      JMP    TRACE
                 0




                                                                                         233
```

<!-- programmanual p234 -->

```
The Western Design Center

LIST

         The program has two entry points, defined in the first routine. One is for listing (disassembling) a
program, the other for tracing. The first entry point, at the program’s origin (default $8000), is jump to the
actual entry point of the trace routine; the second, immediately past it (at $8003), is the beginning of the code
for the disassembler.
         Since this is a bare-bone disassembler, intended to be expanded and perhaps integrated with a general
purpose machine language monitor, parameters such as the start address of the program to be traced are entered
by modifying the values of the register variables; for example, to begin disassembly of a program stored at
$800, the values $00 $08, and $00 are stored staring at PCREG. Since the direct page is relocated to page
three, the absolute location of this variable is $380.
         Starting at the LIST entry, some basic initialization is performed: saving the status register, switching
to native mode, and then saving the previous operating mode (emulation/native) by pushing the status register a
second time (the carry flag now containing the previous contents of the e bit). Thus this program may be called
from either native or emulation mode.
         The current value of the direct page is saved in program memory, and then the new value – DPAGE –
is stored to the direct page register. The native mode is entered.
         Control now continues at TOP, the beginning of the main loop of the disassembler. The mode is set to
long accumulator, short index. This combination allows simple manipulation of both byte and double-byte
values. The value of PCREG is copied to OPCREG (old pcreg). OPCREG will contain the starting location
of the current instruction throughout the loop; PCREG will be modified to point to the next instruction.
However, it hasn’t been modified yet, so it is used to load the accumulator with the opcode byte. Indirect long
addressing is used, so code anywhere within the sixteen-megabyte address space may be disassembled. Since
the accumulator is sixteen bits, a second byte is fetched as well, but ignored; the next instruction transfers the
opcode to the X register and then stores it at the location CODE.
         The utility routine UPDATE is called next. This is common to both the disassembler and the tracer,
and determines the attributes of this instruction by looking the instruction up in a table; it also increments the
program counter to point to the next instruction.
         The routines FLIST, FRMOPRND, and PRINTLN form the disassembled line and display it. After
each line is printed, the routine PAUSE is called to check the keyboard to see if a key has been pressed,
signalling a pause. If PAUSE returns with the carry clear, it means the user has signalled to quit, and control
falls through to QUIT; otherwise, the program loops to TOP again, where it repeats the process for the next
instruction.




                                                                                                              234
```

<!-- programmanual p235 -->

```
The Western Design Center

   0094   0003
   0095   0003               ; LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL
   0096   0003               ;
   0097   0003               ;   LIST
   0098   0003               ;   MAIN LOOP OF DISASSEMBLER FUNCTION
   0099   0003               ;
   0100   0003               ; LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL
   0101   0003               ;
   0102   0003
   0103   0003
   0104   0003               LIST   ENTRY
   0105   0003     08               PHP                        SAVE ORIGINAL FLAGS
   0106   0004     18               CLC
   0107   0005     FB               XCE                        SET NATIVE MODE
   0108   0006     08               PHP                        SAVE PREVIOUS MODE
   0109   0007
   0110   0007     0B               PHD                        SAVE CURRENT DP
   0111   0008     F40003           PEA            DPAGE
   0112   000B     2B               PLD                        SET TO NEW DP
   0113   000C
   0114   000C               TOP    ANOP
   0115   000C
   0116   000C     C220             REP            #M
   0117   000E     E210             SEP            #X
   0118   0010                      LONGA          ON
   0119   0010                      LONGI          OFF
   0120   0010
   0121   0010     649D             STZ            MNX         CLEAR MNEMONIC INDEX
   0122   0012     A580             LDA            PCREG       MOVE PROGRAM COUNTER
   0123   0014     8584             STA            OPCREG        TO ‘OLD PROGRAM COUNTER’
   0124   0016     A682             LDX            PCREGB        INCLUDING BANK
   0125   0018     8686             STX            OPCREGB
   0126   001A     A780             LDA            [PCREG]     GET NEXT INSTRUCTION
   0127   001C     AA               TAX
   0128   001D     8687             STX            CODE        SAVE AS ‘CODE’
   0129   001F
   0130   001F     200080           JSR            UPDATE      UPDATE ATTRIBUTE VARIABLES
   0131   0022
   0132   0022     200080           JSR            FLIST       FORM OBJECT CODE, MNEMONIC
   0133   0025     200080           JSR            FRMOPRNND   FORM OPERAND FIELD
   0134   0028     200080           JSR            PAUSE       CHECK FOR USER PAUSE
   0135   002B     9005             BCC            QUIT
   0136   002D     200080           JSR            PRINTLN     PRINT IT
   0137   0030
   0138   0030     80DA             BRA            TOP         LOOP TIL END
   0139   0032
   0140   0032     2B        QUIT   PLD                        RESTORE ENVIRONMET,
   0141   0033     28               PLP                        RETURN TO CALLER
   0142   0034     FB               XCE
   0143   0035     28               PLP
   0144   0036     60               RTS
   0145   0037                      END
   0146   0037


   Local Symbols

   LIST            00003    QUIT          000032    TOP        0000C




                                                                                            235
```

<!-- programmanual p236 -->

```
The Western Design Center

FLIST

         FLIST is called by both the disassembler and the tracer. This routine displays the current program
counter value, the object code of the instruction being disassembled in hexadecimal, and the mnemonic for the
opcode. The code required to do this is basically the same for any instruction, the only difference being the
length of the instruction, which has already been determined by UPDATE.
         The first thing the code does is to blank the output buffer by calling CLRLN. Particularly since 6502
emulation-mode I/O routines are used, it is more efficient to build an output line first, then display it all at once,
rather than output the line “on the fly.” Characters are stored in the output buffer LINE via indexed absolute
addressing; the Y register contains a pointer to the current character position within the line, and is incremented
every time a character is stored. Since character manipulation is the primary activity in this routine, the
accumulator is set to eight bits for most of the routine.
         The flow of the program proceeds to generate the line from left to right, as it is printed; the first
characters stored are therefore the current program counter values. Since UPDATE has already modified the
program counter variable to load the operands of the instruction, the value in the variable OPCREG is used.
The hex conversion routine, PUTHEX, converts the data in the accumulator into the ASCII characters that
represents the number’s two hexadecimal digits, storing each character at the location pointed to by LINE,Y,
and then incrementing Y to point to the next character. A colon is printed between the bank byte and the
sixteen-bit program counter display to aid readability.
         Next, some spaces are skipped by loading the Y register with a higher value, and the object code bytes
are displayed in hexadecimal. These values have already been stored in direct page memory locations CODE
and OPRNDL, OPRNDH, and OPNDB by the UPDATE routine, which also determined the length of the
instruction and stored it at OPLEN, The length of the operand controls a loop that outputs the bytes; note that a
negative displacement of one is calculated by the assembler so that the loop is not executed when OPLEN is
equal to one.
         All that remains is to print the instruction mnemonic. The characters for all of the mnemonics are
stored in a table called MN; at three characters per mnemonic (which as you may have noticed is the standard
length for all 65x mnemonics), the mnemonic index (MNX) determined by UPDATE from the instruction
attribute table must be multiplied by three. This is done by shifting left once (to multiply by two), and adding
the result to the original value of MNX. Note that this type of “custom” multiplication routine is much more
efficient than the generalized multiplication routines described in the previous chapter. The characters in the
mnemonic table are copied into the output line using the MVN instruction; the result just calculated is
transferred into the X register as the source of the move. It is the line-buffered output that allows use of the
block-move instruction; on-the-fly output would have required each character to be copied out of the mnemonic
table in a loop.




                                                                                                                  236
```

<!-- programmanual p237 -->

```
The Western Design Center

      0147                       ;
      0148                       ;   FLIST – FORM IMAGE OF PROGRAM COUNTER,
      0149                       ;   OBJECT CODE, AND MNEMONIC IN ‘LINE’
      0150                       ;
      0151                       ;   REQUIRES ATTRIBUTE VARIABLES TO BE PREVIOUSLY INITIALIZED
      0152                       ; LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL
      0153                       ;
      0154
      0155                       FLIST   START
      0156                               USING    MN
      0157
      0158            200080             JSR      CLRLN        BLANK ‘LINE’ VARIABLE
      0159   0003
      0160   0003     E230               SEP      #M+X         SHORT REGISTERS
      0161   0005                        LONGA    OFF
      0162   0005                        LONGI    OFF
      0163   0005
      0164   0005     A000               LDY      #0
      0165   0007     A586               LDA      OPCREGB      GET BANK BYTE, FORM AS HEX
      0166   0009     200080             JSR      PUTHEX           STRING
      0167   000C     A9BA               LDA      #’:’         BANK DELIMITER
      0168   000E     990080             STA      LINE,Y
      0169   0011     C8                 INY
      0170   0012     A585               LDA      OPCREGH      GET BYTES OF PROGRAM COUNTER
      0171   0014     200080             JSR      PUTHEX           FORM AS HEX STRING IN
      0172   0017     A584               LDA      OPCREG           LINE
      0173   0019     200080             JSR      PUTHEX
      0174   001C
      0175   001C     A00A               LDY      #10
      0176   001E     A587               LDA      CODE         STORE OPCODE AS HEX STRING
      0177   0020     20080              JSR      PUTHEX
      0178   0023     A201               LDX      #1
      0179   0025
      0180   0025     E49F       MORE    CPX      OPLEN        LIST OPERANDS, IF ANY
      0181   0027     F008               BEQ      DONE
      0182   0029     B587               LDA      OPRNDL-1,X
      0183   002B     200080             JSR      PUTHEX
      0184   002E     E8                 INX
      0185   002F     80F4               BRA      MORE
      0186   0031
      0187   0031     C23        DONE    REP      #M+X
      0188   0033                        LONGA    ON
      0189   0033                        LONGI    ON
      0190   0033
      0191   0033     A59D               LDA      MNX          GET MNEMONIC INDEX,
      0192   0035     0A                 ASL      A            MULTIPLY BY THREE
      0193   0036     18                 CLC                   (TIMES TWO PLUS SELF)
      0194   0037     659D               ADC      MNX
      0195   0039     18                 CLC
      0196   003A     690080             ADC      #MN
      0197   003D     AA                 TAX                   INDEX INTO MNEMONIC TABLE
      0198   003E     A01480             LDY      #LINE+20     COPY INTO ‘LINE’
      0199   0041     A90200             LDA      #2
      0200   0044                MOVE    ENTRY
      0201   0044     540000             MVN      0,0
      0202   0047
      0203   0047     60                 RTS
      0204   0048                        END



      Local Symbols

      DONE              000031   MORE          000025   MOVE      000044



                                                                                                 237
```

<!-- programmanual p238 -->

```
The Western Design Center

FRMOPRND

        This is the second part of the line-disassembly pair. It performs the address-mode specific generation of
the disassembled operand field; the result is similar to the address mode specification syntax of a line of 65x
source code.
        The Y register is loaded with the starting destination in LINE, and the attribute stored at ADDRMODE
is multiplied by two to form an index into a jump table. There is a separate routine for each addressing mode;
the address of that routine is stored in a table called MODES in the order that corresponds to the attributes
given them from the attribute table.
        The JMP indirect indexed instruction is used to transfer control through the jump table MODES to the
appropriate routine, whose index, times two, has been loaded into the X register.
        Each of the routines is basically similar; they output any special characters and print the address of the
operand found in the instruction stream. There are three relative routines, POB, PODB, and POTB (for put
operand byte, put operand double byte, and put operand triple byte) which output direct page, absolute, and
absolute long addresses.
        The two routines FPCR and FPCRL, which handle the program counter relative instructions, however,
must first calculate the destination address (which is how an assembler would specify the operand, so this is
how they are disassembled) by adding the actual operand, a displacement, to the current program counter. The
operand of a short program counter relative instruction is sign-extended before adding, resulting in a sixteen-bit
signed displacement which is added to the program counter to find the destination address.




                                                                                                              238
```

<!-- programmanual p239 -->

```
The Western Design Center

   0205   0000
   0206   0000              ; LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL
   0207   0000              ;
   0208   0000              ;    FRMOPRND – –
   0209   0000              ;    FORMS OPERAND FIELD OF DISASSEMBLED INSTRUCTION
   0210   0000              ;
   0211   0000              ;    OPLEN, ADDRMODE, AND OPRND MUST HAVE BEEN
   0212   0000              ;    INITIALIZED BY ‘UPDATE’
   0213   0000              ; LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL
   0214   0000              ;
   0215   0000
   0216   0000              FRMOPRND   START
   0217   0000                         USING   MODES
   0218   0000   E230                  SEP     #M+X
   0219   0002                         LONGA   OFF
   0220   0002                         LONGI   OFF
   0221   0002
   0222   0002   A01C                  LDY     #28         OFF SET INTO ‘LINE’ FOR OPERAND
   0223   0004              ;                                    TO BEGIN
                                               ADDRMOD
   0224   0004   A59C                  LDA                 GET ADDRESS MODE, MULTIPLY BY
                                               E
   0225   0006   0A                    ASL     A                TWO, JUMP THROUGHT ADDRESS
   0226   0007   AA                    TAX                      MODE JUMP TABLE TO PROPER
   0227   0008   7C0080                JMP     (MODES,X)        HANDLER
   0228   000B
   0229   000B
   0230   000B              FIMM       ENTRY               IMMEDIATE MODE – –
   0231   000B   A9A3                  LDA     #’#’        OUTPUT POUND SIGN,
   0232   000D   990080                STA     LINE,Y           ONE OR TWO
   0233   0010   C8                    INY                      OPERAND BYTES, DEPENDING
   0234   0011   A59F                  LDA     OPLEN            ON OPLEN
   0235   0013   C902                  CMP     #2
   0236   0015   F003                  BEQ     GOSHORT
   0237   0017   4C0080                JMP     PODB
   0238   001A   4C0080     GOSHORT    JMP     POB
   0239   001D
   0240   001D              FABS       ENTRY               ABSOLUTE MODE – –
   0241   001D   4C0080                JMP     PODB             JUST OUTPUT A DOUBLE BYTE
   0242   0020
   0243   0020              FABSL      ENTRY               ABSOLUTEW LONG – –
   0244   0020   4C0080                JMP     POTB             OUTPUT A TRIPLE BYTE
   0245   0023
   0246   0023              FDIR       ENTRY               DIRECT MODE – –
   0247   0023   4C0080                JMP     POB              OUTPUT A SINGLE BYTE
   0248   0026
   0249   0026              FACC       ENTRY               ACCUMULATOR – –
   0250   0026   A9C1                  LDA     #’A’            JUST AN A
   0251   0028   990080                STA     LINE,Y
   0252   002B   60                    RTS
   0253   002C
   0254   002C              FIMP       ENTRY               IMPLIED – –
   0255   002C   60                    RTS                      NO OPERAND
   0256   002D
   0257   002D              FINDINX    ENTRY               INDIRECT INDEXED – –
   0258   002D   20B600                JSR     FIND             CALL ‘INDIRECT’, THEN FALL
   0259   0030              ;                                   THROUGH TO INDEXED BY Y
   0260   0030
   0261   0030              FINY       ENRTY               INDEXED BY Y MODES – –
   0262   0030   A9AC                  LDA     #’,’             TACK ON A ‘COMMA,Y’
   0263   0032   990080                STA     LINE,Y
   0264   0035   C8                    INY
   0265   0038   A9D9                  LDA     #’Y’
   0266   003B   990080                STA     LINE,Y




                                                                                             239
```

<!-- programmanual p240 -->

```
The Western Design Center

   0267   003B   60                    RTS
   0268   003C
   0269   003C              FINDINXL   ENTRY            INDIRECT INDEXED LONG – –
   0270   003C   20C600                JSR     FINDL    CALL ‘INDIRECT LONG’, THEN
   0271   003F   4C3000                JMP     FINY          EXIT THROUGH INDEXED BY Y
   0272   0042
   0273   0042              FINXIND    ENTRY            INDEX INDIRECT – –
   0274   0042   A9A8                  LDA     #’(’     PARENTHESIS
   0275   0044   990080                STA     LINE,Y
   0276   0047   C8                    INY
   0277   0048   200080                JSR     POB      A SINGLE BYTE – –
   0278   004B   206000                JSR     FINX     COMMA, X
   0279   004E   A9A9                  LDA     #’)’     CLOSE.
   0280   0050   990080                STA     LINE,Y
   0281   0053   60                    RTS
   0282   0054
   0283   0054              FDIRINXX   ENTRY            DIRECT INDEXED BY X – –
   0284   0054   200080                JSR     POB      OUTPUT A BYTE,
   0285   0057   4C6000                JMP     FINX          TACK ON COMMA, X
   0286   005A
   0287   005A              FDIRINXY   ENTRY            DIRECT INDEXED BY Y – –
   0288   005A   200080                JSR     POB      OUTPUT A BYTE,
   0289   005D   4C3000                JMP     FINY          TACK ON COMMA, Y
   0290   0060
   0291   0060              FINX       ENTRY            INDEXED BY X – –
   0292   0060   A9AC                  LDA     #’,’          TACK ON A
   0293   0062   990080                STA     LINE,Y        COMMA, X
   0294   0065   C8                    INY              (USED BY SEVERAL
   0295   0066   A9D8                  LDA     #’X’           MODES)
   0296   0068   990080                STA     LINE,Y
   0297   006B   C8                    INY
   0298   006C   60                    RTS
   0299   006D
   0300   006D              FABSX      ENTRY            ABSOLUTE INDEXED BY X – –
   0301   006D   200080                JSR     PODB     OUTPUT A DOUBLE BYTE,
   0302   0070   4C6000                JMP     FINX          TACK ON A COMMA, X
   0303   0073
   0304   0073              FABSLX     ENTRY            ABSOLUTE LONG BY X – –
   0305   0073   200080                JSR     POTB     OUTPUT A TRIPLE BYTE,
   0306   0076   4C6000                JMP     FINX          TACK ON COMMA, X
   0307   0079
   0308   0079              FABSY      ENTRY            ABSOLUTE Y – –
   0309   0079   200080                JSR     PODB     OUTPUT A DOUBLE BYTE,
   0310   007C   4C3000                JMP     FINY          TACK ON COMMA,Y
   0311   007F
   0312   007F              FPCR       ENTRY            PROGRAM COUNTER RELATIVE – –
   0313   007F   A9FF                  LDA     #$FF     SIGN EXTEND OPERAND
   0314   0081   EB                    XBA
   0315   0082   A588                  LDA     OPRNDL
   0316   0084   C221                  REP     #M+C
   0317   0086                         LONGA   ON
   0318   0086   3003                  BMI     OK
   0319   0088   297F00                AND     #$7F
   0320   008B   6584       OK         ADC     OPCREG   ADD TO PROGRAM COUNTER
   0321   008D   1A                    INC     A        ADD TWO, WITHOUT CARRY
   0322   008E   1A                    INC     A
   0323   008F   8588                  STA     OPRNDL   STORE AS NEW ‘OPERAND’
   0324   0091
   0325   0091   E220                  SEP     #M
   0326   0093                         LONGA   OFF
   0327   0093
   0328   0093   4C0080                JMP     PODB     NOW JUST DISPLAY A DOUBLE BYTE
   0329   0096
   0330   0096              FCPRL      ENTRY            PROGRAM COUNTER RELATIVE LONG
   0331   0096


                                                                                         240
```

<!-- programmanual p241 -->

```
The Western Design Center

   0332   0096   C221                   REP     #M+C
   0333   0098                          LONGA   ON
   0334   0098
   0335   0098   A588                   LDA     OPRNDL   JUST ADD THE OPERAND
   0336   009A   6584                   ADC     OPCREG
   0337   009C   18                     CLC              BUMP BY THREE, PAST INSTRCTION
   0338   009D   690300                 ADC     #3
   0339   00A0   8588                   STA     OPRNDL   STORE AS NEW ‘OPERAND’
   0340   00A2
   0341   00A2   E220                   SEP     #M
   0342   00A4                          LONGA   OFF
   0343   00A4
   0344   00A4   4C0080                 JMP     PODB     PRINT A DOUBLE BYTE
   0345   00A7
   0346   00A7              FABSIND     ENTRY            ABSOLUTE INDIRECT
   0347   00A7   A9A8                   LDA     #’(‘     SURROUND A DOUBLE BYTE
   0348   00A9   990080                 STA     LINE,Y        WITH PARENTHESES
   0349   00AC   C8                     INY
   0350   00AD   200080                 JSR     PODB
   0351   00B0   A9A9                   LDA     #’)’
   0352   00B2   990080                 STA     LINE,Y
   0353   00B5   60                     RTS
   0354   00B6
   0355   00B6              FIND        ENTRY            INDIRECT – –
   0356   00B6   A9A8                   LDA     #’(‘     SURROUND A SINGLE BYTE
   0357   00B8   990080                 STA     LINE,Y        WITH PARENTESES
   0358   00BB   C8                     INY
   0359   00BC   200080                 JSR     POB
   0360   00BF   A9A9                   LDA     #’)’
   0361   00C1   990080                 STA     LINE,Y
   0362   00C4   C8                     INY
   0363   00C5   60                     RTS
   0364   00C6
   0365   00C6              FINDL       ENTRY            INDIRECT LONG – –
   0366   00C6   A9DB                   LDA     #’[‘     SURROUND A SINGLE BYTE
   0367   00C8   990080                 STA     LINE,Y        WITH SQUARE BRACKTS
   0368   00CB   C8                     INY
   0369   00CC   200080                 JSR     POB
   0370   00CF   A9DD                   LDA     #’ ]’
   0371   00D1   990080                 STA     LINE,Y
   0372   00D4   C8                     INY
   0373   00D5   60                     RTS
   0374   00D6
                            FABSINXIN
   0375   00D6                          ENTRY            ABSOLUTE INDIRECT INDEXED
                            D
   0376   00D6   A9A8                   LDA     #’(‘
   0377   00D8   990080                 ST5A    LINE,Y   SURROUND A CALL TO ‘ABSOLUTE
   0378   00DB   C8                     INY                   INDEXED’ WITH PARENTESES
   0379   00DC   206D00                 JSR     FABSX
   0380   00DF   A9A9                   LDA     #’)’
   0381   00E1   990080                 STA     LINE,Y
   0382   00E4   60                     RTS
   0383   00E5
   0384   00E5              FSTACK      ENTRY            STACK – – IMPLIED
   0385   00E5   60                     RTS
   0386   00E6
   0387   00E6              FSTACKREL   ENTRY            STACK RELATIVE
   0388   00E6   202300                 JSR              JUST LIKE
   0389   00E9   A9AC                   LDA              DIRECT INDEXED, BUT WITH
   0390   00EB   990080                 STA                    AN ‘S’
   0391   00EE   C8                     INY
   0392   00EF   A9D3                   LDA     #’S”
   0393   00F1   990080                 STA     LINE,Y
   0394   00F4   C8                     INY
   0395   00F5   60                     RTS


                                                                                          241
```

<!-- programmanual p242 -->

```
The Western Design Center

   0396    00F6
   0397    00F6
   0398    00F6                   FSRINDINX         ENTRY                     STACK RELATIVE INDIRECT INDEX
   0399    00F6      A9A8                           LDA     #’(‘
   0400    00F8      990080                         STA     LINE,Y            SURROUND STACK RELATIVE WITH
   0401    00FB      C8                             INY                            PARENTHESES, THEN
   0402    00FC      20E600                         JSR     FSTACKREL
   0403    00FF      A9A9                           LDA     #’)’
   0404    0101      990080                         STA     LINE,Y
   0405    0104      C8                             INY
   0406    0105      4C3000                         JMP     FINY                   TACK ON A COMMA,Y
   0407    0108
   0408    0108
   0409    0108                   FBLOCK            ENTRY                     BLOCK MOVE
   0410    0108
   0411    0108      C220                           REP     #M
   0412    010A      A588                           LDA     OPRNDL            MAKE HUMAN-READABLE:
   0413    010C      EB                             XBA                       SWAP SOURCE, DEST
   0414    010D      8588                           STA     OPRNDL
   0415    010F      E220                           SEP     #M
   0416    0111
   0417    0111      200080                         JSR     POB               OUTPUT THE SOURCE
   0418    0114      A9AC                           LDA     #’,’              THEN COMMA
   0419    0116      990080                         STA     LINE,Y
   0420    0119      C8                             INY
   0421    011A      EB                             XBA                       SWAP DEST INTO OPRNDL
   0422    011B      8588                           STA     OPRNDL                 THEN PRINT ONE BYTE
   0423    011D      4C0080                         JMP     POB
   0424    0120
   0425    0120
   0426    0120                                     END


   Local Symbols

   FABS            00001D     FABSIND      0000A7     FABSINXIND     0000D6     FABBSL      000020
   FABSLX          000073     FABSX        00006D     FABSY          000079     FACC        000026
   FBLOCK          000108     FDIR         000023     FDIRINXX       000054     FDIRINXY    00005A
   FIMM            00000B     FIMP         00002C     FIND           000086     FINDINX     00002D
   FINDINXL        00003C     FINDL        0000C6     FINX           000060     FINXIND     000042
   FINY            000030     FPCR         00007F     FPCRL          000096     FSRINDINX   0000F6
   FSTACK          0000E5     FSTACKREL    0000E6     GOSHORT        00001A     OK          00008B




                                                                                                              242
```

<!-- programmanual p243 -->

```
The Western Design Center

POB

         This routine (put operand byte), with three entry points, outputs a dollar sign, followed by either one,
two, or three operand bytes in hexadecimal form; it calls the routine PUTHEX to output the operand bytes. It is
called by FRMOPRND.
         Depending on the entry point, the X register is loaded with 0, 1, or 2, controlling the number of times
the loop at MORE is executed; on each iteration of the loop, an operand byte is loaded by indexing into
OPRNDL and then printed by PUTHEX.

    0427    0000
    0428    0000              ;LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL
    0429    0000              ;
    0430    0000              ; POB, PODB, POTB
    0431    0000              ; PUT OPERAND (DOUBLE, TRIPLE) BYTE
    0432    0000              ;
    0433    0000              ; PUTS OPRNDL (OPRNDH, OPRNDB) IN LINE AS HEX VALUE
    0434    0000              ; WITH ‘$’ PREFIX
    0435    0000              ;
    0436    0000              ; ASSUMES SHORT ACCUMULATOR AND INSEX REGISTERS
    0437    0000              ; (CALLED BY FOPRND)
    0438    0000              ;LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL
    0439    0000              ;
    0440    0000
    0441    0000
    0442    0000
    0443    0000              POB    START
    0444    0000                     LONGA     OFF
    0445    0000                     LONGI     OFF
    0446    0000
    0447    0000              ;                               PRINT:
    0448    0000     A200            LDX       #0             ONE OPERAND BYTE
    0449    0002     8006            BRA       IN                 SKIP
    0450    0004              PODB   ENTRY
    0451    0004     A201            LDX       #1             TWO OPERAND BYTES
    0452    0006     8002            BRA       IN                SKIP
    0453    0008              POTB   ENTRY
    0454    0008     A202            LDX       #2             THREE OPERAND BYTES
    0455    000A              ;                                   FALL THROUGH
    0456    000A     A9A4     IN     LDA       #’$’           PRINT LEAD-IN
    0457    000C     990080          STA       LINE,Y
    0458    000F     C8              INY
    0459    0010
    0460    0010     B588     MORE   LDA       OPRNDL,X       LOOP THROUGH OPERAND
    0461    0012     200080          JSR       PUTHEX         HIGH TO LOW
    0462    0015     CA              DEX
    0463    0016     10F8            BPL       MORE
    0464    0018     60              RTS
    0465    0019                     END



    Local Symbols

    IN              00000A    MORE           000010   PODB             000004   POTB                000008




                                                                                                             243
```

<!-- programmanual p244 -->

```
The Western Design Center

STEP

          This routine also contains the PAUSE entry point called by LIST; STEP waits until a keypress,
PAUSE simply checks to see if a key has been pressed, and waits only if there has been an initial keypress. In
both cases, the wait loop continues until the next keypress. If the keypress that exits the wait loop was the
ESCAPE key, the carry is cleared, signalling the calling program that the user wants to quit rather than
continue. If it was RETURN, the overflow flag is cleared; the tracer uses this toggle between tracing and single
stepping. Any other keypress causes the routine to return with both flags set.
          The code in this listing is machine-dependent; it checks the keyboard locations of the AppleII. Since
this is a relatively trivial task, in-line code is used rather than a call to one of the existing 6502 monitor routines;
therefore, the processor remains in the native mode while it performs this I/O operation.
          Like all utility routines, STEP saves and restores the status on entry and exit.

        0466    0000
        0467    0000
        0468    0000
        0464    0000
        0465    0000                            APPEND DB. UTILITY
        0466    0000
        0467    0000
        0468    0000
        0469    0000
        0470    0000
        0471    0000
        0472    0000               ; LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL
        0473    0000               ;
        0474    0000               ; STEP - - CHECKS FOR USER PAUSE SIGNAL
        0475    0000               ; (KEYSTROKE)
        0476    0000               ;
        0477    0000               ; CONTAINS MACHINE-DEPENDENT CODE
        0478    0000               ; FOR APPLE I I
        0479    0000               ; LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL
        0480    0000               ;
        0481    0000
        0482    0000               STEP         START
        0483    0000               KEYBD        EQU        $C000
        0484    0000               KEYYSTB      EQU        $C010
        0485    0000               ESC          EQU        $9B          ESCAPE KEY (HIGH BIT SET)
        0486    0000               V            EQU        $40          MASK FOR OVERFLOW FLAG
        0487    0000                            LONGA      OFF
        0488    0000                            LONGI      OFF
        0489    0000
        0490    0000    08                      PHP                     SAVE MODES
        0491    0001    E230                    SEP        #M+X
        0492    0003    800B                    BRA        WAIT
        0493    0005
        0494    0005               PAUSE        ENTRY                   ENTRY FOR ‘PAUSE’ CALL
        0495    0005    08                      PHP
        0496    0006    E230                    SEP        #M+X
        0497    0008    AD00C0                  LDA        KEYBD             CHECK FOR KEYPRESS

        0498    000B    101B                    BPL        RETNCR            NONE; DON’T PAUSE
        0499    000D    8D10C0                  STA        KEYSTB            CLEAR STROBE
        0500    0010               ;                                            IF KEYSTROKE
        0501    0010    AD00C0     WAIT         LDA        KEYBD             LOOP FOR NEXT KEY
        0502    0013    10FB                    BPL        WAIT
        0503    0015    8D10C0                  STA        KEYSTB            CLEAR STROBE
        0504    0018    C998                    CMP        #ESC              IF ESC RETURN WITH

        0505    001A    D004                    BNE        RETNESC




                                                                                                                    244
```

<!-- programmanual p245 -->

```
The Western Design Center

       0506    001C
       0507    001C    28       RETEQ     PLP                   CARRY CLEAR (QUIT)

       0508    001D    EA                 NOP
       0509    001E    18                 CLC
       0510    001F    60                 RTS
       0511    0020
       0512    0020    C98D     RETNESC   CMP      #CR
       0513    0022    D004               BNE      RETNCR
       0514    0024    28                 PLP
       0515    0025    E241               SEP      #C+V
       0516    0027    60                 RTS
       0517    0028
       0518    0028    8D10C0   RETNCR    STA      KEYSTB
       0519    002B    28                 PLP                   ELSE SET
       0520    002C    38                 SEC
       0521    002D    B8                 CLV
       0522    002E    60                 RTS                          (CONTINUE)
       0523    002F                       END


       Local Symbols

       ESC            00009B    KEYBD     00C000    KEYSTB    00C010       PAUSE     000005
       RETEQ          00001C    RETNCR    000028    RETNESC   000020       V         000040
       WAIT           000010




                                                                                              245
```

<!-- programmanual p246 -->

```
The Western Design Center

PUTHEX

         This utility routine, already referred to in several descriptions, is called whenever a hexadecimal value
needs to be output. It converts the character in the low byte of the accumulator into two hexadecimal
characters, and stores them in the buffer LINE at the position pointed to by the Y register.
         PUTHEX calls and internal subroutine, MAKEHEX, which does the actual conversion. This call
(rather than in-line code) allows MAKEHEX to first call, then fall through into, an internal routine,
FORMNIB.
         When MAKEHEX returns, it contains the two characters to be printed in the high and low bytes of the
accumulator; MAKEHEX was processed with the accumulator eight bits wide, so the sixteen-bit mode is
switched to, letting both bytes be stored in one instruction. The Y register is incremented twice, pointing it to
the space immediately past the second character printed.
         FORMNB is both called (for processing the first nibble) and fallen into (for processing the second).
Thus the RTS that exist exits FORMNIB returns variously to either MAKEHEX or PUTHEX. This technique
results in more compact code than if FORMNIB were called twice.
         The conversion itself is done by isolating the respective bits, and then adding the appropriate offset to
form either the correct decimal or alphabetic (A-F) hexadecimal character.
         Like all utility routines, the status is saved and restored on entry and exit.

        0524    0000
        0525    0000
        0526    0000            ;
        0527    0000            ; LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL
        0528    0000            ; PUTHEX
        0529    0000            ;
        0530    0000            ; CONVERTS NUMBER IN ACCUMULATOR TO HEX STRING
        0531    0000            ; STORED AT LINE,Y
        0532    0000            ;
        0533    0000            ; SAVE AND RESTORED MODE FLAGS
        0534    0000            ; LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL
        0535    0000            ;
        0536    0000
        0537    0000
        0538    0000
        0539    0000            PUTHEX        START
        0540    0000   08                     PHP                     SAVE MODE FLAGS
        0541    0001   200D00                 JSR       MAKEHEX       GET ASCII CODES A, B
        0542    0004   C220                   REP       #M
        0543    0006                          LONGA     ON
        0544    0006   990080                 STA       LINE,Y        PUT TWO BYTES AT LINE
        0545    0009   C8                     INY                     INCREMENT Y PAST THEM
        0546    000A   C8                     INY
        0547    000B   28                     PLP                     RESTORE MODE
        0548    000C   60                     RTS                     RETURN
        0549    000D
        0550    000D   E230     MAKEHEX       SEP       $M+X          ALL EIGHT BIT
        0551    000F                          LONGA     OFF
        0552    000F                          LONGI     OFF
        0553    000F
        0554    000F   48                     PHA                     SAVE VALUE TO BE CONVERTED
        0555    0010   290F                   AND       #$OF          MASK OFF LOW NIBBLE
        0556    0012   201B00                 JSR       FORMNIB       CONVERT TO HEX
        0557    0015   EB                     XBA                     STORE IN B
        0558    0016   68                     PLA                     RESTORE VALUE
        0559    0017   4A                     LSR       A             SHIFT HIGH NIBBLE
        0560    0018   4A                     LSR       A                 TO LOW NIBBLE
        0561    0019   4A                     LSR       A
        0562    001A   4A                     LSR       A
        0563    001B            ;                                     FALL THROUGH TO CONVERT
        0564    001B
        0565    001B   C90A     FORMNIB       CMP       #$A           IF GREATER THAN OR EQUAL TO
        0566    001D   B004                   BGE       HEXDIG        10, USE DIGITS A . . F
                                                                                                              246
```

<!-- programmanual p247 -->

```
The Western Design Center
       0567   001F     18                 CLC               ELSE SIMPLY ADD ‘0’ TO
       0568   0020     69B0               ADC     #’0’         CONVERT TO ASCII
       0569   0022     60                 RTS
       0570   0023
       0571   0023     69B6     HEXDIG    ADC     $’A’-11   SUBTRACT 11, ADD ‘A’
       0572   0025     60                 RTS               (SORT OF)
       0573   0026
       0574   0026                        END



       Local Symbols

       FORMNIB         00001B            HEXDIG    000023      MAKEHEX      00000D




                                                                                     247
```

<!-- programmanual p248 -->

```
The Western Design Center

CLRLN

        CLRLN performs the very straightforward task of clearing the output buffer, LINE, to blanks. It also
contains the global storage reserved for LINE.
        Like the other utility routines, CLRLN saves and restores the status.

        0575   0000
        0576   0000                  ; LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL
        0577   0000                  ;
        0578   0000                  ; CLRLN
        0579   0000                  ;
        0580   0000                  ; CLEARS ‘LINE’ WITH BLANKS
        0581   0000                  ;
        0582   0000                  ; SAVES AND RESTORES MODE FLAGS
        0583   0000                  ;
        0584   0000                  ; LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL
        0585   0000                  ;
        0586   0000
        0587   0000
        0588   0000                  CLRLN   START
        0589   0000     08                   PHP
        0590   0001     C230                 REP       #M+X
        0591   0003                          LONGA     ON
        0592   0003                          LONGI     ON
        0593   0003
        0594   0003     A9A0A0               LDA       #’ ‘
        0595   0006     A24400               LDX       #68
        0596   0009
        0597   0009     9D1200       LOOP    STA       LINE,X
        0598   000C     CA                   DEX
        0599   000D     CA                   DEX
        0600   000E     10F9                 BPL       LOOP
        0601   0010     28                   PLP
        0602   0011     60                   RTS
        0603   0012
        0604   0012
        0605   0012                  LINE    ENTRY
        0606   0012     A0A0A0A0             DC        70C’ ‘
        0607   0058     8D00                 DC        H’8D00’
        0608   005A                          END



        Local Symbols

        LINE       000012          LOOP       000009




                                                                                                        248
```

<!-- programmanual p249 -->

```
The Western Design Center

UPDATE

         This routine, common to both the disassembler and the tracer, updates the program counter and other
direct page variables – the address mode attribute (ADDRMODE) and the length (OPLEN) – and, using the
length, reads the instruction operands into direct page memory.
         The address mode and length attributes are stored in a table called ATRIBL, two bytes per instruction.
Since there are 256 different codes, the table size is 512 bytes. The current opcode itself, fetched previously, is
used as the index into the table. Since the table entries are two bytes each, the index is first multiplied by two
by shifting left. Since the sixteen-bit accumulator was used to calculate the index, both attribute bytes can be
loaded in a single operation; since their location in direct page memory is adjacent, they can be stored in a
single operation as well.
         Normally, the value of OPLEN loaded from the attribute table is the correct one; in the case of the
immediate addressing mode, however, the length varies with the setting of the m and x flags. The opcode for
the immediate instructions are trapped using just three comparisons, an AND, and four branches to test the
opcode bits. Note that the immediate operands are multiplied times two because the opcode already happens to
be shifted left once. If the current instruction uses immediate addressing, the stored value of the status register
is checked for the relevant flag setting; if m or x, as appropriate, is clear, then OPLEN is incremented. The
routines that output the immediate operand now know the correct number of operand bytes to print, and the
tracer knows where the next instruction begins.
         The status is saved on entry and restored on exit.

     0609   0000
     0610   0000
     0611   0000              ; LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL
     0612   0000              ;
     0613   0000              ; UPDATE
     0614   0000              ;
     0615   0000              ; UPDATES ATTRIBUTE VARIABLES BASED ON OPCODE
     0616   0000              ; PASSED IN ACCUMULATOR BY LOOKING IN ATTRIBUTE
     0617   0000              ; TABLES
     0618   0000              ;
     0619   0000              ; SAVES AND RESTORES MODE FLAGS
     0620   0000               ; LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL
     0621   0000              ;
     0622   0000
     0623   0000
     0624   0000              UPDATE      START
     0625   0000                          USING ATRIBL
     0626   0000
     0627   0000
     0628   0000              LDYI        EQU        $A0+2           OPCODE VALUE TIMES TWO
     0629   0000              LDXI        EQU        $A2+2
     0630   0000
     0631   0000    08                    PHP                                 SAVE STATE
     0632   0001    C230                  REP        #M+X
     0633   0003                          LONGA      ON
     0634   0003                          LONGI      ON
     0635   0003
     0636   0003    29FF00                AND        #$FF                     MASK HIGH BYTE
     0637   0006    0A                    ASL        A                        TIMES TWO
     0638   0007
     0639   0007    AS                    TAY
     0640   0008    B90080                LDA        ATRIBL,Y        INDEX INTO ATTRIBUTE TABLE
     0641   000B    EB                    XBA                        SWAP ORDER OF ENTRIES
     0642   000C    859C                  STA        ADDRMODE        SAVE ADDRMODE, MNEMONIC INDEX
     0643   000E
     0644   000E    AA                    TAX                        ADDRMODE TO X (LOW)
     0645   000F    98                    TYA                        OPCODE * 2 TO ACCUM
     0646   0010    E210                  SEP        #X
     0647   0012                          LONGI      OFF
     0648   0012

                                                                                                               249
```

<!-- programmanual p250 -->

```
The Western Design Center
    0649    0012    BCFF7F             LDY        LENS-1,X       GET LENGTH OF OPERATION
    0650    0015    849F               STY        OPLEN
    0651    0017
    0652    0017
    0653    0017    A697               LDX        EBIT           EMULATION MODE?
    0654    0019    E001               CPX        #1             TEST BIT ZERO
    0655    001B    F02E               BEQ        SHORT          YES - - ALL IMMEDIATE ARE
    0656    001D              ;                                            SHORT
    0657    001D    892000             BIT        #$20           IS MSD+2 EVEN?
    0658    0020    D029               BNE        SHORT          NO, CAN’T BE IMMEDIATE
    0659    0022    C94401             CMP        #LDXI          IS IT LDX #?
    0660    0025    F00A               BEQ        CHKX
    0661    0027    891E00             BIT        #$F+2          IS LSD+2 ZERO?
    0662    002A    D00E               BNE        CHKA           CHECK ACCUMULATOR OPCODES
    0663    002C    C94001             CMP        PREG           MUST = LDY# OR GREATER
    0664    002F    9009               BLT        CHKA           NO, MAYBE ACCUMULATOR
    0665    0031    A596               LDA        PREG           IF IT IS, WHAT IS FLAG SETTING?
    0666    0033    291000             AND        #X
    0667    0036    F011               BEQ        LONG           CLEAR – 16 BIT MODE
    0668    0038    D011               BNE        SHORT          SET – 8 BIT MODE
    0669    003A
    0670    003A    291E00    CHKA     AND        #$0F+2         MASK OUT MSD
    0671    003D    C91200             CMP        #$9+2          IS LSD = 9?
    0672    0040    D009               BNE        SHORT
    0673    0042    A596               LDA        PREG           WHAT IS FLAG SETTING?
    0674    0044    292000             AND        #M
    0675    0047    D002               BNE        SHORT          NO, 8 BIT MODE
    0676    0049
    0677    0049    E69F      LONG     INC        OPLEN          LONG IMMEDIATE - - LENGTH IS
    0678    004B              ;                                  ONE MORE THEN FOUND IN TABLE
    0679    004B
    0680    004B    A000      SHORT    LDY        #0
    0681    004D    8005               BRA        LOOPIN
    0682    004F
    0683    004F    A780      LOOP     [PCREG]                   LOAD 16 BITS - - 16 BIT MODE
    0684    0051              ;                                          USED TO BUMP PCREG EASILY
    0685    0051    AA                 TAX                       TRUNCATE TO EIGHT BITS
    0686    0052    9687               STX        ORPNDL-1,Y             SAVE
    0687    0054
    0688    0054    E680      LOOPIN   INC        PCREG          MOVE PC PAST NEXT INSTRUCTION

    0689    0056    C8                 INY                       BYTE
    0690    0057    C49F               CPY        OPLEN          MOVED ALL OPERAND BYTES?
    0691    0059    D0F4               BNE        LOOP                  NO, CONTINUE
    0692    005B
    0693    005B    28        DONE     PLP
    0694    005C    60                 RTS
    0695    005D                       END

    Local Symbols

    CHKA            00003A   CHKX      000031    DONE          00005B   LDXI        000144
    LDYI            000140   LONG      000049    LOOP          00004F   LOOPIN      000054
    SHORT           000048




                                                                                                     250
```

<!-- programmanual p251 -->

```
The Western Design Center

PRINTLN

         This is the output routine. In this version, an existing 6502 output routine is called, necessitating a
reversion to the emulation mode. Since this is the only place a 6502 routine is called, a simpler mode-switching
routine than the generalized one of the previous chapter is used. The user registers do not need to be preserved,
but zero needs to be swapped into the direct page to make it address page zero.
         The main loop is in the emulation mode until the null terminal byte of LINE is encountered; on exit, the
native mode, direct page, and status are restored.

        0696    0000
        0697    0000
        0698    0000             ; LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL
        0699    0000             ;
        0700    0000             ; PRINTLN
        0701    0000             ;
        0702    0000             ; MACHINE-DEPENDENT CODE TO OUTPUT
        0703    0000             ; THE STRING STORED AT ‘LINE’
        0704    0000             ;
        0705    0000             ; SAVES AND RESTORED MODE FLAGS
        0706    0000             ; LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL
        0707    0000             ;
        0708    0000
        0709    0000
        0710    0000
        0711    0000             PRINTLN     START
        0712    0000             COUT        EQU         $FDED     APPLE CHARACTER OUTPUT ROUTINE
        0713    0000
        0714    0000    08                   PHP                   SAVE STATUS
        0715    0001    0B                   PHD                   SAVE DIRECT PAGE
        0716    0002    F40000               PEA         0         SWITCH TO PAGE ZERO
        0717    0005    2B                   PLD                        FOR EMULATION
        0718    0006
        0719    0006                         LONGA       OFF
        0720    0006                         LONGI       OFF
        0721    0006    38                   SEC                   SWITCH TO EMULATION
        0722    0007    FB                   XCE
        0723    0008
        0724    0008    A000                 LDY         #0
        0725    000A
        0726    000A    B90080   LOOP        LDA         LINE,Y    LOOP UNTIL STRING TERMINATOR
        0727    000D    F006                 BEQ         DONE           REACHED
        0728    000F    20EDFD               JSR         COUT
        0729    0012    C8                   INY
        0730    0013    80F5                 BRA         LOOP
        0731    0015
        0732    0015    18       DONE        CLC                   RESTORE NATIVE MODE
        0733    0016    FB                   XCE
        0734    0017    2B                   PLD                   RESTORE DIRECT PAGE
        0735    0018    28                   PLP                   RESTORE MODE FLAGS
        0736    0019    60                   RTS
        0737    001A
        0738    001A                         END



        Local Symbols

        COUT        00FDED        DONE          000015            LOOP       0000DA




                                                                                                             251
```

<!-- programmanual p252 -->

```
The Western Design Center

TRACE

         This is the actual entry to the trace routine. It performs initialization similar to LIST, and additionally
sets up the BRK vectors, so they can point to locations within the tracer.
         The e flag, direct page register and data bank register are all given initial values of zero. The program
counter and program counter bank are presumed to have been initialized by the user. The first byte of the
program to be traced is loaded; since indirect long addressing is used, this program can be used with the 65816
to debug programs located in any bank. It can, of course, also be used with the 65802.
         The jump to TBEGIN enters the main loop of the trace routine in the middle – in other words,
“between instructions.”

      0739   0000
      0740   0000                             APPEND DB. TRACE
      0741   0000
      0742   0000
      0743   0000              ;
      0744   0000              ; TRACE
      0745   0000              ;
      0746   0000              ; ENTRY POINT FOR TRACER
      0747   0000              ; LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL
      0748   0000
      0749   0000
      0750   0000              TRACE          START
      0751   0000              USRBRKV        GEQU       $3F0          USER BRK VECTOR FOR APPLE / /
      0752   0000              BRKN           GEQU       $FFE6         NATIVE MODE BRK VECTOR
      0753   0000
      0754   0000    08                       PHP                      SAVE CALLING STATE
      0755   0001    18                       CLC
      0756   0002    FB                       XCE
      0757   0003    08                       PHP
      0758   0004
      0759   0004    C210                     REP        #$10
      0760   0006                             LONGI      ON
      0761   0006    F40000                   PEA        0             OLD STACK BOUNDARY
      0762   0009
      0763   0009    BA                       TSX
      0764   000A    8E3D00                   STX        SAVSTACK
      0765   000D
      0766   000D    F40003                   PEA        DPAGE                    INITIALIZE DIRECT PAGE
      0767   0010    2B                       PLD
      0768   0011
      0769   0011    8691                     STX        STACK
      0770   0013
      0771   0013    E220                     SEP        #$20
      0772   0015                             LONGA      OFF
      0773   0015
      0774   0014    A901                     LDA        #1
      0775   0017    8597                     STA        EBIT
      0776   0019    6493                     STZ        DIRREG        DIRECT PAGE, DATA BANK
      0777   001B    6494                     STZ        DIRREGH          TO POWER-UP DEFAULTS
      0778   001D    6495                     STZ        DBREG
      0779   001F    649E                     STZ        MNX+1
      0780   0021
      0781   0021    9C0080                   STZ        STEPCNTRL
      0782   0024
      0783   0024    A20080                   LDX        #EBRKN        PATCH BRK VECTORS
      0784   0027    8EF003                   STX        USRBRKV          TO POINT TO TRACE CODE
      0785   002A
      0786   002A    AEE6FF                   LDX        BRKN          FIND OUT WHERE BRKN POINTS TO

      0787   002D    E000C0                   CPX        #$C000        MAKE SURE IT’S RAM ON AN APPLE
      0788   0030    9003                     BLT        OK


                                                                                                                252
```

<!-- programmanual p253 -->

```
The Western Design Center

     0789   0032     4C0080                JMP       QUIT      MIGHT AS WELL GIVE UP NOW . . .

     0790   0035     8E3F00   OK           STX       USRBRKN
     0791   0038
     0792   0038     A780                  LDA       [PCREG]   GET FIRST OPCODE
     0793   003A     4C0080                JMP       TBEGIN       BEGIN !
     0794   003D
     0795   003D              SAVSTACK     ENTRY
     0796   003D     0000                  DS        2
     0797   003F              USRBRKN      ENTRY
     0798   003F     0000                  DS        2
     0799   0041              SAVRAM       ENTRY



     0800   0041     0000                  DS        2
     0801   0043                           END


     Local Symbols

     OK       000035    SAVRAM           000041    SAVSTACK    00003D   USRBRKN    00003F




                                                                                                 253
```

<!-- programmanual p254 -->

```
The Western Design Center

EBRKIN

         This is the main loop of the tracer. It has three entry points: one each for the emulation and native
mode BRK vectors to point top, and a third (TBEGIN) which is entered when then program starts tracing and
there is no “last instruction.” This entry provides the logical point to begin examining the tracing process.
         TRACE has performed some initialization, having loaded the opcode of the first instruction to be
traced into the accumulator. As with FLIST, UPDATE is called to update the program counter and copy the
instruction attributes and operand into direct page memory. The routine CHKSPLC is then called to handle the
flow-altering instructions' in these cases, it will modify PCREG to reflect the target address. In either case, the
opcode of the next instruction is loaded, and a BRK instruction (a zero) is stored in its place, providing a means
to regain control immediately after the execution of the current instruction.
         The contents of the RAM pointed to by the (arbitrary) ROM values in the native mode BRK vector are
temporarily saved, and the location is patched with a jump to the NBRKIN entry point.
         The registers are then loaded with their user program values: these will have been preinitialized by
TRACE, or will contain the values saved at the end of the execution of the previous instruction. Note the order
in which the registers are loaded; some with direct page locations, others pushed onto the stack directly from
direct page locations; then pull into the various registers. Once the user registers have been loaded with their
values, they cannot be used for data movement. The P status register must be pulled last, to prevent any other
instructions from modifying the flags.
         The e bit is restored by loading the P register with a mask reflecting the value it should have; e is
exchanged with the carry, and a second PLP instruction restores the correct status register values.
         The routine exists via a jump indirect long through the “old” pcreg variable, which points to the current
instruction. It will be reentered (at either EBRKIN or NBRKIN) when the BRK instruction that immediately
follows the current instruction is executed.
         Before this, however, the single instruction will be executed by the processor; any memory to be loaded
or stored, or any registers to be changed by the instruction, will be modified.
         After the BRK is executed, control returns to the tracer either at EBRKIN, if the user program was in
emulation mode, or at NBRKIN if the user program was in native mode. The first thing that must be done is
preserve the state of the machine as it was at the end of the instruction.
         The BRK instruction has put the program counter bank (only in native mode), the program counter, and
the status register on the stack. The program already knows the address of the next instruction, so the value on
the stack can be disregarded. The status register is needed, however.
         Entry to EBRKIN is from the Apple I I monitor user vector at $3F0 and $3F1. The Apple II monitor
handles emulation mode BRK instructions by storing the register values to its own zero page locations; it pulls
the program counter and status register from the stack and stores them, too. The code at EBRKIN dummies up
a native mode post-BRK stack by first pushing three place-holder bytes, then loading the status register the
form where the Apple Monitor stored it, and pushing it. The accumulator and X registers are re-loaded from
monitor locations; Y has been left intact. A one is stored to variable EBIT, which will be used to restore the
emulation mode when EBRKIN exists. The processor switches to native mode, and control falls through into
NBRKIN, the native mode break handler.
         With the stack in the correct state for both emulation mode and native mode entries, the routine
proceeds to save the entire machine context. The register sizes are extended to sixteen bits to provide a standard
size which encompasses the maximum size possible. The data bank and direct page registers are pushed onto
the stack; the DPAGE value is pushed on immediately after, and pulled into the direct page, establishing the
local direct page. With this in place, the A, X, and Y registers can be stored at their direct page locations. The
register values pushed on the stack are picked off using stack-relative addressing. Since control is not returned
by execution of an RTI (as is usual for interrupt processing), but instead is returned by means of a JMP, the
stack must be cleaned up. Since seven bytes have been pushed, seven is added to the current stack pointer, and
then saved at the direct page variable STACK. This being done, a small local stack region $140 can be
allocated.
         The memory borrowed as a RAM native-mode BRK vector is restored.
         The current line is then disassembled in the same manner as LIST. The register values just stored into
memory are also displayed via the routine DUMPREGS.


                                                                                                               254
```

<!-- programmanual p255 -->

```
The Western Design Center

         Once this is done, the effect has been achieved and the contents of the registers between instructions has
been made visible. Before resuming execution of the program being traced, a check is made to see if the user
wishes to quit, pause or step, or toggle between tracing and stepping.
         Before returning to the TBEGIN entry, the BRK instruction stored at the location of the new “current”
instruction is replaced with the saved opcode, the current program counter is moved to the old program counter,
and the cycle begins again at TBEGIN.




                                                                                                               255
```

<!-- programmanual p256 -->

```
The Western Design Center

 0802   0000
 0803   0000            ; LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL
 0804   0000            ;
 0805   0000            ; EBRKIN, NBRKIN, TBGIN
 0806   0000            ;
 0807   0000            ; ENTRY POINTS FOR TRACER MAIN LOOP
 0808   0000            ; EBKIN AND NBKIN RECOVER CONTROL AFTER
 0809   0000            ; ‘BRK’ INSTRUCTION EXECUTED
 0810   0000            ; TBEGIN IS INITIAL ENTRY FROM ‘TRACE’
 0811   0000            ;
 0812   0000            ; LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL
 0813   0000            ;
 0814   0000
 0815   0000
 0816   0000            EBRKIN   START                                   ENTRY FROM EMULATION MODE
 0817   0000            ;                                                   FOR TRACER
 0818   0000
                                 LONG
 0819   0000                                OFF
                                 A
 0820   0000                     LONGI      OFF
 0821   0000
 0822   0000   F40000            PEA        0
 0823   0003   4848              PHA
 0824   0004   A548              LDA        $48                          APPLE I I MONITOR
 0825   0006   48                PHA                                          LOCATIONS
 0826   0007   A545              LDA        $45                             FOR P, AA
 0827   0009   A646              LDX        $46                             AND X
 0828   000B
 0829   000B            ;        note that if direct page is relocated
 0830   000B            ;        in emulation mode, these locations
 0831   000B            ;        will be used by monitor brk handler
 0832   000B
 0833   000B   EE9703            INC         EBIT+DPAGE                  MARK AS EMULATION MODE
 0834   000E
 0835   000E   18                CLC                                     GO NATIVE
 0836   000F   FB                XCE
 0837   0010
 0838   0010            NBRKIN   ENTRY                                   ENTRY FROM NATIVE MODE
 0839   0010            ;                                                   FOR TRACER
 0840   0010
 0841   0010   C230              REP         #M+X
 0842   0012                     LONGA       ON
 0843   0012                     LONGI       ON
 0844   0012
 0845   0012   8B                PHB                                     SAVE DATA BANK
 0846   0013   0B                PHD                                     DIRECT PAGE
 0847   0014   F40003            PEA         DPAGE                       SWITCH TO APPLICATION
 0848   0017   2B                PLD                                        DIRECT PAGE
 0849   0018
 0850   0018   858F              STA         AREG                        STASH USER REGISTERS
 0851   001A   868B              STX         XREG
 0852   001C   848D              STY         YREG
 0853   001E
 0854   001E   A301              LDA         1,S                         GET DIRECT PAGE VALUE
 0855   0020   8593              STA         DIRREG                         SAVED
 0856   0022
 0857   0022   3B                TSC                                     CALCULATE TRUE STACK
 0858   0023   18                CLC                                        (BEFORE BRK)
 0859   0024   690700            ADC         #7
 0860   0027   8595              STA         STACK                       SAVE AS STACK
 0861   0029
 0862   0029   A303              LDA         3,S                         SAVE DATA BANK, STATUS
 0863   002B   8595              STA         DBREG                          STATUS REGISTER
 0864   002D
 0865   002D   A94001            LDA         #$140                       SET UP SMALL STACK
 0866   0030   1B                TCS
                                                                                                     256
```

<!-- programmanual p257 -->

```
The Western Design Center
 0867   0031
 0868   0031   4B                 PHK                 MAKE DATA BANK = PROGRAM BANK
 0869   0032   AB                 PLB
 0870   0033   AE0080             LDX     USRBRKN     RESTORE BORROWED RAM
 0871   0036   AD0180             LDA     SAVRAM+1
 0872   0039   9D0100             STA     !1,X
 0873   003C   AD0080             LDA     SAVRAM
 0874   003F   9D0100             STA     !0,X
 0875   0042   200080             JSR     FLIST       FORMAT DISASSEMBLY LINE
 0876   0045   200080             JSR     FRMOPRND
 0877   0048
 0878   0048   200080             JSR     PRINTLN     PRINT IT
 0879   004B
 0880   004B   200080             JSR     CLRLN
 0881   004E   200080             JSR     DUMPREGS    OUPUT REGISTER VALUES
 0882   0051   200080             JSR     PRINTLN
 0883   0054
 0884   0054   E220               SEP     #M
 0885   0056                      LONGA   ON
 0886   0056
 0887   0056   C210               REP     STEPCNTRL
 0888   0058                      LONGI   DOPAUSE
 0889   0058
 0890   0058   2CE000             BIT
 0891   005B   300E               BMI
 0892   005D
 0893   005D   200080             JSR     STEP        STEP ONE AT A TIME
 0894   0060   9068               BCC     QUIT        USER WANTS TO QUIT
 0895   0062   5011               BVC     RESUME      WANTS TO KEEP STEPPING
 0896   0064   A980               LDA     #$80        HIT CR; WANTS TO TRACE, NOT
 0897   0066   8DE000             STA     STEPCNTRL       STEP - - SET FLAG
 0898   0069   800A               BRA     RESUME
 0899   006B
 0900   006B   200080   DOPAUSE   JSR     PAUSE       TRACING; ONLY WAIT IF USER
 0901   006E   905A               BCC     QUIT            HITS KEY
 0902   0070   5003               BVC     RESUME      WANTS TO KEEP TRACING
 0903   0072   9CE000             STZ     STEPCNTRL   HIT CR; WANTS TO STEP, NOT
 0904   0075            ;                                 TRACE - - CLEAR FLAG
 0905   0075
 0906   0075   A583     RESUME    LDA     NCODE       RESTORE ONLD ‘NEXT’; IT’S ABOUT
 0907   0077   8780               STA     [PCREG]        TO BE EXECUTED
 0908   0079
 0909   0079            TBEGIN    ENTRY
 0910   0079   AB                 TAY                 SAVE THE CURRENT (ABOUT TO BE
 0911   007A            ;                                EXECUTED) OPCODE
 0912   007A
 0913   007A   A680               LDX     PCREG       REMEMBER WHERE YOU GOT IT FROM
 0914   007C   8684               STX     OPCREG         PCREG POINTED TO IT AFTER
 0915   007E   A582               LDA     PCREGB         PREVIOUS CALL TO UPDATE
 0916   0080   8586               STA     OPCREGB
 0917   0082
 0918   0082   98                 TYA
 0919   0083
 0920   0083   8587               STA     CODE        SAVE CURRENT OPCODE
 0921   0085   200080             JSR     UPDATE      UPDATE PC TO POINT PAST THIS
 0922   0088            ;                                INSTRUCTION
 0923   0088            ;                                UPDATE ATTRIBUTE VARIABLES
 0924   0088
 0925   0088   200080             JSR     CHKSPCL     CHECK TO SEE IF THIS CAUSES A
 0926   008B            ;                                TRANSFER
 0927   008B   A780               LDA     [PCREG]     GET NEXT OPCODE TO BE EXECUTED
 0928   008D            ;                                (ON NEXT LOOP THROUGH)
 0929   008D   8583               STA     NCODE          SAVE IT
 0930   008F   A900               LDA     #0          PUT A BREAK ($00) THERE TO
 0931   0091            ;                                REGAIN CONTROL
 0932   0091   8780               STA     [PCREG]
 0933   0093
 0934   0093            GO        ENTRY
                                                                                        257
```

<!-- programmanual p258 -->

```
The Western Design Center
 0935   0093     C230                 REP        #M+X
 0936   0095                          LONGA      ON
 0937   0095                          LONGI      ON
 0938   0095     AE0080               LDX        USRBRKIN         BORROW THIS RAM FOT A SECOND
 0939   0098     BD0000               LDA        !0,X
 0940   009B     8D0080               STA        SAVRAM
 0941   009E     BD0100               LDA        !1,X
 0942   00A1     8D0180               STA        SAVRAM+1
 0943   00A4     A94C00               LDA        #$4C
 0944   00A7     9D0000               STA        !0,X
 0945   00AA     A91000               LDA        #NBRKIN
 0946   00AD     9D0100               STA        !1,X
 0947   00B0     A561                 LDA        STACK            RESTORE STACK
 0948   00B2     1B                   TCS
 0949   00B3     D495                 PEI        (DBREG)          GET THIS STUFF ON STACK
 0950   00B5     D496                 PEI        (EBIT-1)
 0951   00B7     D493                 PEI        (DIRREG)
 0952   00B9
 0953   00B9     6497                 STZ        EBIT             ASSUME NATIVE MODE ON RETURN
 0954   00BB
 0955   00BB     A58F                 LDA        AREG             RESTORE USER REGISTERS
 0956   00BD     A48D                 LDY        YREG
 0957   00BF     A68B                 LDX        XREG
 0958   00C1
 0959   00C1     2B                   PLD                         POP IT AWAY!
 0960   00C2
 0961   00C2     28                   PLP
 0962   00C3     28                   PLP
 0963   00C4     FB                   XCE
 0964   00C5
 0965   00C5     AB                   PLB
 0966   00C6     28                   PLP
 0967   00C7
 0968   00C7     DC8403               JMP        [DPAGE+OPCREG]      ON TO THE NEXT!
 0969   00CA
 0970   00CA              QUIT        ENTRY
 0971   00CA     E220                 SEP        #$20
 0972   00CC                          LONGA      OFF
 0973   00CC
 0974   00CC     A583                 LDA        NCODE            CLEAN UP OLD PATCH
 0975   00CE     8780                 STA        [PCREG]
 0976   00D0
 0977   00D0     C210                 REP        #$10
 0978   00D2                          LONGI      ON
 0979   00D2
 0980   00D2     AE0080               LDX        SAVSTACK         GET ORIGINAL STACK POINTER
 0981   00D5     E8                   INX
 0982   00D6     E8                   INX
 0983   00D7     9A                   TXS
 0984   00D8
 0985   00D8     F40000               PEA        0                RESTORE ZERO PAGE
 0986   00DB     2B                   PLD
 0987   00DC
 0988   00DC     28                   PLP
 0989   00DD     FB                   XCE
 0990   00DE     28                   PLP
 0991   00DF     60                   RTS
 0992   00E0
 0993   00E0              STEPCNTRL   ENTRY
 0994   00E0     00                   DS         1
 0995   00E1                          END

 Local Symbols

 DOPAUSE         00006B   GO            000093          NBRKIN     000010        QUIT       0000CA
 RESUME          000075   STEPCNTRL     0000E0          TBEGIN     000079



                                                                                                     258
```

<!-- programmanual p259 -->

```
The Western Design Center

CHKSPCL

         This routine checks the opcode about to be executed to see if it will cause a transfer of control. Is it a
branch, a jump, or a call? If it is any of the three, the destination of the transfer must be calculated and stored at
PCREG so that a BRK instruction can be stored there to maintain control after the current instruction is
executed.
         A table that contains all of the opcodes which can cause a branch or jump (SCODES) is scanned. If a
match with the current instruction is not found, the routine exists and tracing resumes.
         If a match is found, the value of the index into the table is checked. The opcodes for all the branches
are stored at the beginning of SCODES, so if the value of the index is less than 9, the opcode was a branch and
can be handled by the same general routine.
         The first thing that must be determined if the opcode is a branch is whether or not the branch will be
taken. By shifting the index right (dividing by two) an index for each pair of different types of branches is
obtained. This index is used to get a mask for the bit in the status register to be checked. The value shifted into
the carry determines whether the branch is taken if the status bit is set or clear.
         If a branch is not taken, the routine exits. If, however, a branch is taken, the new program counter value
must be calculated by sign extending the operand and adding it to the current program counter.
         Each of the other opcodes (jumps and calls) are dispatched to handler routines through a jump table.
Since only the new program counter values must be calculated, jumps and calls with the same addressing mode
can be handled by the same routine.
         Breaks, co-processor calls, and RTIs are not handled at all; a more robust tracer would handle BRKs by
letting breakpoints be set and cleared. Since the software interrupts are not implemented, and software tracing
of hardware interrupts is impractical, RTI is left unimplemented. The program counter is incremented by one,
causing these instructions to be bypassed completely.
         All of the jumps and calls are straightforward. Long addressing is used to force the stack and indirect
addressing modes to access bank zero. Also notice the way the data bank register is copied to the program
counter bank for indirect indexed addressing. Finally, note how the long addressing modes call their absolute
analogs as subroutines, then handle the bank byte.




                                                                                                                  259
```

<!-- programmanual p260 -->

```
The Western Design Center

  0996   0000
  0997   0000
  0998   0000            ; LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL
  0999   0000            ; CHKSPCL
  1000   0000            ;
  1001   0000            ; CHECK CURRENT OPCODE (IN CODE) FOR SPECIAL CASES
  1002   0000            ; - - INSTRUCTIONS WHICH TRANSFER CONTROL (JMP, BRA, ETC.)
                         ;
  1003   0000            ;
  1004   0000            ; ASSUMES SHORTA, LONGI - -CALLED BY EBRKIN
  1005   0000            ; LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL
  1006   0000            ;
  1007   0000
  1008   0000
  1009   0000            CHKSPCL    START
  1010   0000                       LONGA   OFF
  1011   0000                       LONGI   ON
  1012   0000
  1013   0000   A20000              LDX     #SCX-SCODES
  1014   0003   A587                LDA     CODE
  1015   0005
  1016   0005   DD0080   LOOP       CMP     SCODES,X       CHECK TO SEE IF CURRENT OPCODE
  1017   0008   F004                BEQ     HIT                IS IN EXCEPTION TABLE
  1018   000A   CA                  DEX
  1019   000B   10F8                BPL     LOOP
  1020   000D   60                  RTS                    EXIT IF NOT
  1021   000E
  1022   0003
  1023   0003   E210     HIT        SEP     #X
  1024   0010                       LONGI   OFF
  1025   0010
  1026   0010   8A                  TXA                    IF INDEX WAS LESS THAN 9, IT’S
  1027   0011   C909                CMP     #9                  A BRANCH
  1028   0013   B00F                BGE     NOTBR
  1029   0015
  1030   0015   4A                  LSR     A              SEE IF ‘ODD OR EVEN’
  1031   0016   AA                  TAX
  1032   0017   BD0080              LDA     PHASK,X        GET MASK TO SELECT CORRECT
  1033   001A            ;                                       PREG BIT
  1034   001A   2596                AND     PREG           IS IT SET?
  1035   001C
  1036   001C   B003                BCS     BBS            IF INDEX WAS ODD, BRANCH IF
  1037   001E            ;                                      PREG BIT IS SET
  1038   001E   F00B                BEQ     DOBRANCH       ELSE IF EVEN, BRANCH IF CLEAR

  1039   0020   60                  RTS
  1040   0021
  1041   0021   D008     BBS        BNE     DOBRANCH       “BRANCH IF BIT SET”
  1042   0023   60                  RTS
  1043   0024
  1044   0024   0A       NOTBR      ASL     A              NOT A BRANCH INSTRUCTION;
  1045   0025            ;                                     MULTIPLY BY TWO
  1046   0025   AA                  TAX                    AND INDEX INTO HANDLER JUMP
  1047   0026                                                  TABLE
  1048   0026   C210                REP     #X
  1049   0028   7CEE7F              JMP     (SPJMP-18,X)       BIAS JUMP TABLE BY 9
  1050   0028
  1051   0028            DOBRANCH   ENTRY
  1052   002B   A9FF                LDA     #$FF           SET ACCUMULATOR BYTE HIGH
  1053   002D            ;                                      (ANTICIPATE NEGATIVE)
  1054   002D   EB                  XBA                         AND SIGN EXTEND INTO X
  1055   002E


  1056   002E   A588                LDA     OPRNDL
  1057   0030

                                                                                            260
```

<!-- programmanual p261 -->

```
The Western Design Center
  1058    0030    C231                    REP      #M+X+C      MAKE REGS LONG; CLEAR CARRY
  1059    0032                            LONGA    ON             (ANTICIPATE ADC)
  1060    0032                            LONGI    ON
  1061    0032
  1062    0032    3003                    BMI      OK          NUMBER WAS NEGATIVE; ALL IS OK
  1063    0034
  1064    0034    297F00                  AND      #$7F        CLEAR HIGH BYTE OF ACCUM
  1065    0037               ;                                     (POSITIVE NUMBER)
  1066    0037    6580       OK           ADC      PCREG
  1067    0039    8580                    STA      PCREG
  1068    003B    E220                    SEP      #M          RETURN WITH ACCUM SHORT
  1069    003D    60                      RTS
  1070    003E                            END


  Local Symbols

  BBS             000021   DOBRANCH     00002B    HIT         00000E   LOOP       000005
  NOTBR           000024   OK           000037


  1071    0000
  1072    0000               SBRK         START                THESE ARE NOT IMPLEMENTED!
  1073    0000               SRTI         ENTRY                (AN EXERCISE FOR READER)
  1074    0000               SCOP         ENTRY
  1075    0000    60                      RTS
  1076    0001
  1077    0001               SJSRABS      ENTRY                ABSOLUTES - -
  1078    0001               SJMPABS      ENTRY
  1079    0001    A688                    LDX      OPRNDL      MOVE OPERAND TO PC
  1080    0003    8680                    STX      PCREG
  1081    0005    60                      RTS
  1082    0006
  1083    0006               SBRL         ENTRY                LONG BRANCH
  1084    0006    C221                    REP      #M+C        LONG ACCUM AND CLEAR CARRY
  1085    0008                            LONGA    ON
  1086    0008    A588                    LDA      OPRNDL      ADD DISPLACMENT TO
  1087    000A    6580                    ADC      PCREG       PROGRAM COUNTER
  1088    000C    8580                    STA      PCREG
  1089    000E    E220                    SEP      #M
  1090    0010                            LONGA    OFF
  1091    0010    60                      RTS
  1092    0011
  1093    0011               SJSRABSL     ENTRY                ABSOLUTE LONGS
  1094    0011               SJMPABSL     ENTRY
  1095    0011    A688                    LDX      OPRNDL      MOVE OPERAND, INCLUDING BANK,
  1096    0013    8680                    STX      PCREG          TO PROGRAM COUNTER
  1097    0015    A58A                    LDA      OPRNDB
  1098    0017    8582                    STA      PCREGB
  1099    0019    60                      RTS
  1100    001A
  1101    001A               SRTS         ENTRY                RETURN
  1102    001A    A691                    LDX      STACK       PEEK ON STACK
  1103    001C    EC0080                  CPX      SAVSTACK    IF ORIGINAL STACK . . .
  1104    001F    D003                    BNE      CONT
  1105    0021    4C0080                  JMP      QUIT        RETURN TO MONITOR
  1106    0024    E8         CONT         INX
  1107    0025
  1108    0025    C220                    REP      #M
  1109    0027    BF000000                LDA      >0,X        ALWAYS IN BANK ZERO
  1110    002B    1A                      INC      A           ADD ONE TO GET TRUE RETURN
  1111    002C    8580                    STA      PCREG           VALUE
  1112    002E    E220                    SEP      #M
  1113    0030
  1114    0030    60                      RTS
  1115    0031
  1116    0031
  1117    0031               SRTL         ENTRY                RETURN LONG
                                                                                                261
```

<!-- programmanual p262 -->

```
The Western Design Center
  1118   0031     201A00                JSR      SRTS       DO NORMAL RETURN,
  1119   0034
  1120   0034     E8                    INX                 THEN GET BANK BYTE
  1121   0035     E8                    INX
  1122   0036     BF000000              LDA      >0,X       A IS NOW SHORT FOR BANK BYTE
  1123   003A     8582                  STA      PCREGB
  1124   003C     60                    RTS
  1125   003D
  1126   003D
  1127   003D                SJMPIND    ENTRY               INDIRECT
  1128   003D     A688                  LDX      OPRNDL     GET OPERAND
  1129   003F
  1130   003F     C220                  REP      #M


  1131   0041     BF000000              LDA      >0,X       JMP IND ALWAYS IN BANK ZERO
  1132   0045     8580                  STA      PCREG
  1133   0047     E220                  SEP      #M
  1134   0049     60                    RTS
  1135   004A
  1136   004A
  1137   004A                SJMPINDL   ENTRY
  1138   004A     203D00                JSR      SJMPIND    SAME AS JMP INDIRECT,
  1139   004D     E8                    INX                     PLUS BANK BYTE
  1140   004E     E8                    IJNX
  1141   004F     BF000000              LDA      >0,X       ACCUM IS SHORT NOW
  1142   0053     8582                  STA      PCREGB
  1143   0055     60                    RTS
  1144   0056
  1145   0056
  1146   0056                SJMPINDX   ENTRY               INDEX JUMPS
  1147   0056                SJSRINDX   ENTRY
  1148   0056     A48B                  LDY      XREG       LET CPU DO ADDITION
  1149   0058     A688                  LDX      OPRNDL     GET INSIRECT POINTER
  1150   005A     8699                  STX      TEMP
  1151   005C     A582                  LDA      RCREGB     INDEXED JUMPS ARE IN PROGRAM
  1152   005E     859B                  STA      TEMP+2         BANK
  1153   0060
  1154   0060     C220                  REP      #M
  1155   0062     B799                  LDA      [TEMP],Y   ‘Y IS X’
  1156   0064     8680                  STA      PCREG
  1157   0066     E220                  SEP      #M
  1158   0068
  1159   0068     60                    RTS
  1160   0069
  1161   0069
  1162   0069                           END


  Local Symbols
  CONT            000024     SBRL       000006   SCOP       000000     SJMPABS      000001
  SJMPABSL        000011     SJMPIND    00003D   SJMPINDL   00004A     SJMPINDX     000056
  SJJSRABS        000001     SJSRABSL   000011   SJSRINDX   000056     SRTI         000000
  SRTL            000031     SRTS       00001A




                                                                                             262
```

<!-- programmanual p263 -->

```
The Western Design Center

DUMPREGS

         This routine forms an output line that will display the contents of the various registers. The routine is
driven in a loop by a table containing single-character register names (“A,” “X,” and so on) and the address of
the direct page variable that contains the corresponding register value. It is interesting in that a direct page
pointer to a direct page address is used, since the two index registers are occupied with accessing the table
entries and pointing to the next available location in the output buffer.


   1163   0000
   1164   0000
   1165   0000              ; LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL
   1166   0000              ;
   1167   0000              ; DUMPREGS
   1168   0000              ;
   1169   0000              ; DISPLAYS CONTENTS OF REGISTER VARIABLES IN ‘LINE’
   1170   0000              ;
   1171   0000              ; SAVES AND RESTORES MODE
   1172   0000              ; LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL
   1173   0000              ;
   1174   0000
   1175   0000              DUMPREGS      START
   1176   0000   08                       PHP
   1177   0001   E230                     SEP        #M+X
   1178   0003                            LONGA      OFF
   1179   0003                            LONGI      OFF
   1180   0003
   1181   0003   A000                     LDY        #0
   1182   0005
   1183   0005   A903                     LDA        #>DPAGE               STOE DPAGE HIGH IN TEMP HIGH

   1184   0007   859A                     STA        TEMPH
   1185   0009
   1186   0009   A209                     LDX        #ENDTABLE-TABLE       LENGTH OF COMMAND TABLE
   1187   000B
   1188   000B   BD4400     LOOP          LDA        TABLE,X               GET ADDRESS OF NEXT REGISTER
   1189   000E   8599                     STA        TEMP
   1190   0010   CA                       DEX
   1191   0011   BD4400                   LDA        TABLE,X               GET REGISTER ‘NAME’
   1192   0014   200080                   JSR        PUTREG16
   1193   0017   CA                       DEX
   1194   0018   10F1                     BPL        LOOP
   1195   001A
   1196   001A   1995                     LDA        #DBREG                NOW ALL THE 8-BIT REGISTERS
   1197   001C   8599                     STA        TEMP
   1198   001E   A9C2                     LDA        #’B’
   1199   0020   200080                   JSR        PUTREG8
   1200   0023   A996                     LDA        #PREG
   1201   0025   8599                     STA        TEMP
   1202   0027   A9D0                     LDA        #’P’
   1203   0029   200080                   JSR        PUTREG8
   1204   002C   A9C5                     LDA        #’E’
   1205   002E   990080                   STA        LINE,Y
   1206   0031   C8                       INY
   1207   0032   A9BA                     LDA        #’:’
   1208   0034   990080                   STA        LINE,Y
   1209   0037   C8                       INY
   1210   0038
   1211   0038   A9B0                     LDA        #’0’
   1212   003A   A697                     LDX        EBIT
   1213   003C   F001                     BEQ        OK
   1214   003E   1A                       INC        A                     ‘0’ BECOMES ‘1’
   1215   003F   990080     OK            STA        LINE,Y
   1216   0042
                                                                                                              263
```

<!-- programmanual p264 -->

```
The Western Design Center
  1217   0042
  1218   0042     28                    PLP
  1219   0043     60                    RTS
  1220   0044
  1221   0044     C494      TABLE       DC      C’D’,I1’DIRREGH’    DIRECT PAGE
  1222   0046     D392                  DC      C’S’,I1’STACKH’     ADDRESS OF
  1223   0048     D98E                  DC      C’Y’,I1’YREGH’      REGISTER
  1224   004A     D88C                  DC      C’X’,I1’XREGH’      VARIABLES
  1225   004C     C1                    DC      C’A’
  1226   004D     90        ENDTABLE    DC      I1’AREGH’
  1227   004E                           END


  Local Symbols

  ENDTABLE         00004D   LOOP       00000B    OK        00003F   TABLE         000044




                                                                                           264
```

<!-- programmanual p265 -->

```
The Western Design Center

PUTRTEG8

         This routine, along with PUTREG16, is called by DUMPREGS to actually output a register value
once its label and storage location have been loaded from the table. Naturally, it calls PUTREX to convert the
register values to hexadecimal.

   1228   0000
   1229   0000
   1230   0000              ; LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL
   1231   0000              ;
   1232   0000              ; PUTREGS
   1233   0000              ;
   1234   0000              ; LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL
   1235   0000              ;
   1236   0000
   1237   0000
   1238   0000
   1239   0000              PUTREG8    START
   1240   0000     990080              STA       LINE,Y      A CONTAINS REGISTER ‘NAME’
   1241   0003     C8                  INY
   1242   0004     A9BC                LDA       #’=’        EQUALS . .
   1243   0006     990080              STA       LINE,Y
   1244   0009     C8                  INY
   1245   000A     8012                BRA       PRIN        USE PUTREG16 CODE
   1246   000C
   1247   000C              PUTREG16   ENTRY
   1248   000C     990080              STA       LINE,Y      A CONTAINS REGISTER ‘NAME’
   1249   000F     C8                  INY
   1250   0010     A9BD                LDA       #’=’        EQUALS . .
   1251   0012     990080              STA       LINE,Y
   1252   0015     C8                  INY
   1253   0016     C8                  INY
   1254   0017     B299                LDA       (TEMP)      TEMP POINTS TO REGISTER
   1255   0019     C699                DEC       TEMP           VARIABLE HIGH
   1256   001B     200080              JSR       PUTHEX
   1257   001E
   1258   001E     C8       PRIN       INY
   1259   001F     B299                LDA       (TEMP)      TEMP POINTS TO REGISTER
   1260   0021     20080               JSR       PUTHEX         VARIABLE LOW (OR 8 BIT)
   1261   0024     C8                  INY
   1262   0025     60                  RTS
   1263   0026                         END

   Local Symbols

   PRIN          0000IE            PUTREG16      00000C




                                                                                                          265
```

<!-- programmanual p266 -->

```
The Western Design Center

TABLES

        The next several pages list the tables used by the program – SPJMP, PMASK, SCODES, MN,
MODES, LENS, and ATRIBL.
        SPJMP is a jump table of entry points to the trace handlers for those instructions which modify the
flow of control.
        PMASK contains the masks used to check the status of individual flag bits to determine if a branch will
be taken.
        SCODS is a table containing the opcodes of the special (flow-altering) instructions.
        ATRBL is the attribute table for all 256 opcodes. Each table entry is two bytes, one is an index into the
mnemonic table, the other the address mode. This information is the key to the other tables, all used by the
UPDATE routine, which puts a description of the current instruction’s attributes into the respective direct page
variables. MN is the table of instruction mnemonics that the ‘mnemonic index’ attribute points into. MODES
is a jump table with addresses of the disassembly routine for each addressing mode, and LENS contains the
length of instructions for each addressing mode. Both of these tables are indexed into directly with the ‘address
mode’ attribute.




                                                                                                             266
```

<!-- programmanual p267 -->

```
The Western Design Center

   1264   0000
   1265   0000              ; LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL
   1266   0000              ;
   1267   0000              ; SP JMP
   1268   0000              ; JUMP TABLE FOR ‘SPECIAL’ OPCODE HANDLERS
   1269   0000              ; LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL
   1270   0000              ;
   1271   0000
   1272   0000              SPJMP    START                 JUMP TABLE FOR
   1273   0000      0080             DC      A’SBRK’       NON-BRANCH HANDLERS
   1274   0002      0080             DC      A’SJSRABS’
   1275   0004      0080             DC      A’SRTI’
   1276   0006      0080             DC      A’SRTS’
   1277   0008      0080             DC      A’SCOP’
   1278   000A      0080             DC      A’SJSRABSL’
   1279   000C      0080             DC      A’SBRL’
   1280   000E      0080             DC      A’SRTL’
   1281   0010      0080             DC      A’SJMPABS’
   1282   0012      0080             DC      A’SJMPABSL’
   1283   0014      0080             DC      A’SJMPIND’
   1284   0016      0080             DC      A’SJMPINDX’
   1285   0018      0080             DC      A’SJMPINDL’
   1286   001A      0080    SCT      DC      A’SJSRINDX’
   1287   001C
   1288   001C              END


   Local Symbols

   SCT             00001A


   1289   0000
   1290   0000
   1291   0000
   1292   0000              ; LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL
   1293   0000              ;
   1294   0000              ; PMASK
   1295   0000              ; STATUS REGISTER MASKS FOR BRANCH HANDLING CODE
   1296   0000              ; LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL
   1297   0000              ;
   1298   0000
   1299   0000              PMASK    START                   MASKS FOR STATUS REGISTER
   1300   0000      80               DC      H’80’           N FLAG
   1301   0001      40               DC      H’40’           V FLAG
   1302   0002      01               DC      H’01’           C FLAG
   1303   0003      02               DC      H’02’           Z FLAG
   1304   0004      00               DC      H’00’           BRA
   1305   0005                       END


   1306   0000
   1307   0000
   1308   0000
   1309   0000
   1310   0000
   1311   0000              SCODES   START                   SPECIAL OPCODES
   1312   0000
   1313   0000      10               DC      H’10’           BPL
   1314   0001      30               DC      H’30’           BMI
   1315   0002      50               DC      H’50’           BVC
   1316   0003      70               DC      H’70’           BVS
   1317   0004      90               DC      H’90’           BCC
   1318   0005      B0               DC      H’B0’           BCS
   1319   0006      D0               DC      H’D0’           BNE
   1320   0007      F0               DC      H’F0’           BEQ
                                                                                         267
```

<!-- programmanual p268 -->

```
The Western Design Center
   1321   0008      80              DC      H’80’      BRA
   1322   0009      00              DC      H’00’      BRK
   1323   000A      20              DC      H’20’      JSR
   1324   000B      40              DC      H’40’      RTI
   1325   000C      60              DC      H’60’      RTS
   1326   000D      02              DC      H’02’      COP
   1327   000E      22              DC      H’22’      JSR   ABSL
   1328   000F      82              DC      H’82’      BRL
   1329   0010      6B              DC      H’6B’      RTL
   1330   0011      4C              DC      H’4C’      JMP   ABS
   1331   0012      5C              DC      H’5C’      JMP   ABSL
   1332   0013      6C              DC      H’6C’      JMP   ()
   1333   0014      7C              DC      H’7C’      JMP   (,X)
   1334   0015      DC              DC      H’DC’      JMP   []
   1335   0016                SCX   ENTRY
   1336   0016      FC              DC      H’FC’      JSR   (,X)
   1337   0017                      END



   Local Symbols

   SCX             000016



   1138   0000                      APPEND DB. TABLE
   1139   0000
   1340   0000
   1341   0000                MN    DATA
   1342   0000       000000         DX      3
   1343   0003       C1C4C3         DC      C’ADC’     1
   1344   0006       C1C3C4         DC      C’AND’     2
   1345   0009       C1D3CC         DC      C’ASL’     3
   1346   000C       C2C3C3         DC      C’BCC’     4
   1347   000F       C2C3D3         DC      C’BCS’     5
   1348   0012       C2C5D1         DC      C’BEQ’     6
   1349   0015       C2C9D4         DC      C’BIT’     7
   1350   0018       C2CDC9         DC      C’BMI’     8
   1351   001B       C2C3C5         DC      C’BNE’     9
   1352   001E       C2D0CC         DC      C’BPL’     10
   1353   0021       C2D2CB         DC      C’BRK’     11
   1354   0024       C2D6C3         DC      C’BVC’     12
   1355   0027       C2D6D3         DC      C’BVS’     13
   1356   002A       C3CCC3         DC      C’CLC’     14
   1357   002D       C3CCC4         DC      C’CLD’     15
   1358   0030       C3CCC9         DC      C’CLI’     16
   1359   0033       C3CCD6         DC      C’CLV’     17
   1360   0036       C3CDD0         DC      C’CMP’     18
   1361   0039       C3D0D8         DC      C’CPX’     19
   1362   003C       C3D0D9         DC      C’CPY’     20
   1363   003F       C4C5C3         DC      C’DEC’     21
   1364   0042       C4C5D8         DC      C’DEX’     22
   1365   0045       C4C5D9         DC      C’DEY’     23
   1366   0048       C5CFD2         DC      C’EOR’     24
   1367   004B       C9CEC3         DC      C’INC’     25
   1368   004E       C9C3D8         DC      C’INX’     26
   1369   0051       C9C3D9         DC      C’INY’     27
   1370   0054       CACDD0         DC      C’JMP’     28
   1371   0057       CAD3D2         DC      C’JSR’     29
   1372   005A       CCC4C1         DC      C’LDA’     30
   1373   005D       CCC4D8         DC      C’LDX’     31
   1374   0060       CCC9D9         DC      C’LDY’     32
   1375   0063       CDC3D2         DC      C’LSR’     33
   1376   0066       CECFD0         DC      C’NOP’     34
   1377   0069       CFD2C1         DC      C’ORA’     35
   1378   006C       D0C8C1         DC      C’PHA’     36
   1379   006F       D0C8D0         DC      C’PHP’     37
                                                                    268
```

<!-- programmanual p269 -->

```
The Western Design Center
   1380   0072   D0CCC1             DC     C’PLA’     38
   1381   0075   D0CCD0             DC     C’PLP’     39
   1382   0078   D2CFCC             DC     C’ROL’     40
   1383   007B   D2CFD2             DC     C’ROR’     41
   1384   007E   D2D4C9             DC     C’RIT’     42
   1385   0081   D2D4D3             DC     C’RTS’     43
   1386   0084   D3C2C3             DC     C’SBC’     44
   1387   0087   D3C5C3             DC     C’SEC’     45
   1388   008A   D3C5C4             DC     C’SED’     46
   1389   008D   D3C5C9             DC     C’SEI’     47
   1390   0090   D3D4C1             DC     C’STA’     48
   1391   0093   D3D4D8             DC     C’STX’     49
   1392   0096   D3D4D9             DC     C’STY’     50
   1393   0099   D4C1D8             DC     C’TAX’     51
   1394   009C   D4C1D9             DC     C’TAY’     52
   1395   009F   D4D3D8             DC     C’TSX’     53
   1396   00A2   D4D8C1             DC     C’TXA’     54
   1397   00A5   D4D8D3             DC     C’TXS’     55
   1398   00A8   D4D9C1             DC     C’TYA’     56
   1399   00AB   C2D2C1             DC     C’BRA’     57
   1400   00AE   D0CCD8             DC     C’PLX’     58
   1401   00B1   D0CCD9             DC     C’PLY’     59
   1402   00B4   D0C8D8             DC     C’PHX’     60
   1403   00B7   D0D8D0             DC     C’PHY’     61
   1404   00BA   D3D4DA             DC     C’STZ’     62
   1405   00BD   D4D3C2             DC     C’TRB’     63
   1406   00C0   D4D3C2             DC     C’TSB’     64
   1407   00C3
   1408   00C3   D0C5C1             DC     C’PEA’     65
   1409   00C6   D0C5C9             DC     C’PEI’     66
   1410   00C9   D0C5D2             DC     C’PER’     67
   1411   00CC   D0CCC2             DC     C’PLB’     68
   1412   00CF   D0CCC4             DC     C’PLD’     69
   1413   00D2   D0C8C2             DC     C’PHB’     70
   1414   00D5   D0C8C4             DC     C’PHD’     71
   1415   00D8   D0C8CB             DC     C’PHK’     72
   1416   00DB
   1417   00DB   D2C5D0             DC     C’REP’     73
   1418   00DE   D3C5D0             DC     C’SEP’     74
   1419   00E1
   1420   00E1   D4C3C4             DC     C’TCD’     75
   1421   00E4   D4C4C3             DC     C’TDC’     76
   1422   00E7   D4C3D3             DC     C’TCS’     77
   1423   00EA   D4D3C3             DC     C’TSC’     78
   1424   00ED   D4D8D9             DC     C’TXY’     79
   1425   00F0   D4D9D8             DC     C’TYX’     80
   1426   00F3   D8C2C1             DC     C’XBA’     81
   1427   00F6   D8C3C5             DC     C’XCE’     82
   1428   00F9
   1429   00F9   C2D2CC             DC     C’BRL’     83
   1430   00FC   CAD3CC             DC     C’JSL’     84
   1431   00FF   D2D4CC             DC     C’RTL’     85
   1432   0102   CDD6CE             DC     C’MVN’     86
   1433   0105   CDD6D0             DC     C’MVP’     87
   1434   0108   C3CFD0             DC     C’COP’     88
   1435   010B   D7C1C9             DC     C’WAI’     89
   1436   010E   D3D4D0             DC     C’STP’     100
   1437   0111   D7C4CD             DC     C’WDM’     101
   1438   0114                      END



   1439   0000
   1440   0000              MODES   DATA
   1441   0000   0000               DS     2
   1442   0002   0080               DC     A’FIMM’    1
   1443   0004   0080               DC     A’FABS’    2
   1444   0006   0080               DC     A’FABSL’   3
                                                            269
```

<!-- programmanual p270 -->

```
The Western Design Center
   1445   0008   0080                DC      A’FDIR’         4
   1446   000A   0080                DC      A’FACC’         5
   1447   000C   0080                DC      A’FIMP’         6
   1448   000E   0080                DC      A’FINDINX’      7
   1449   0010   0080                DC      A’FINDINXL’     8
   1450   0012   0080                DC      A’FINXIND’      9
   1451   0014   0080                DC      A’FDIRINXX’     10
   1452   0016   0080                DC      A’FDIRINXY’     11
   1453   0018   0080                DC      A’FABSX’        12
   1454   001A   0080                DC      A’FABSLX’       13
   1455   001C   0080                DC      A’FABSY’        14
   1456   001E   0080                DC      A’FPCR’         15
   1457   0020   0080                DC      A’FPCRL’        16
   1458   0022   0080                DC      A’FABSIND’      17
   1459   0024   0080                DC      A’FIND’         18
   1460   0026   0080                DC      A’FINDL’        19
   1461   0028   0080                DC      A’FABSINXIND’   20
   1462   002A   0080                DC      A’FSTACK’       21
   1463   002C   0080                DC      A’FSTACKREL’    22
   1464   002E   0080                DC      A’FSRINDINX’    23
   1465   0030   0080                DC      A’FBLOCK’       24
   1466   0032
   1467   0032                       END



   1468   0000
   1469   0000              LENS     START
   1470   0000   02                  DC      H’02’           IMM
   1471   0001   03                  DC      H’03’           ABS
   1472   0002   04                  DC      H’04’           ABS LONG
   1473   0003   02                  DC      H’02’           DIRECT
   1474   0004   01                  DC      H’01’           ACC
   1475   0005   01                  DC      H’01’           IMPLIED
   1476   0006   02                  DC      H’02’           DIR IND INX
   1477   0007   02                  DC      H’02’           DIR IND INX L
   1478   0008   02                  DC      H’02’           DIR INX IND
   1479   0009   02                  DC      H’02’           DIR INX X
   1480   000A   02                  DC      H’02’           DIR INX Y
   1481   000B   03                  DC      H’03’           ABS X
   1482   000C   04                  DC      H’04’           ABS L X
   1483   000D   03                  DC      H’03’           ABS Y
   1484   000E   02                  DC      H’02’           PCR
   1485   000F   03                  DC      H’03’           PCR L
   1486   0010   03                  DC      H’03’           ABS IND
   1487   0011   02                  DC      H’02’           DIR IND
   1488   0012   02                  DC      H’02’           DIR IND L
   1489   0013   03                  DC      H’03’           ABS INX IND
   1490   0014   01                  DC      H’01’           STACK
   1491   0015   02                  DC      H’02’           SR
   1492   0016   02                  DC      H’02’           SR INX
   1493   0017   03                  DC      H’03’           MOV
   1494   0018                       END
   1495   0000
   1496   0000                       APPEND DB. ATRIB
   1497   0000
   1498   0000              ATRIBL   DATA
   1499   0000
   1500   0000   0B06                DC      I1’11,6’        BRK              00
   1501   0002   2309                DC      I1’35,9’        ORA D,X          01
   1502   0004   5804                DC      I1’88,4’        COP (REALLY 2)   02
   1503   0006   2316                DC      I1’35,22’       ORA-,X           03
   1504   0008   4004                DC      I1’64,4’        TSB D            04
   1505   000A   2304                DC      I1’34,4’        ORA D            05
   1506   000C   0304                DC      I1’3,4’         ASL D            06
   1507   000E   2313                DC      I1’35,19’       ORA [D]          07
   1508   0010   2515                DC      I1’37,21’       PHP              08
   1509   0012   2301                DC      I1’35,1’        ORA IMM          09
                                                                                   270
```

<!-- programmanual p271 -->

```
The Western Design Center
   1510   0014   0305       DC   I1’3,5’     ASL ACC      0A
   1511   0016   4715       DC   I1’71,21’   PHD          0B
   1512   0018   4002       DC   I1’64,2’    TSB ABS      0C
   1513   001A   2302       DC   I1’35,2’    ORA ABS      0D
   1514   001C   0302       DC   I1’3,2’     ASL ABS      0E
   1515   001E   2303       DC   I1’35,3’    ORA ABS L    0F
   1516   0020   0A0F       DC   I1’10,15’   BPL          10
   1517   0022   2307       DC   I1’35,7’    ORA (D),Y    11
   1518   0024   2312       DC   I1’35,18’   ORA (D)      12
   1519   0026   2317       DC   I1’35,23’   ORA S,Y      13
   1520   0028   3FO4       DC   I1’63,4’    TRB D        14
   1521   002A   230A       DC   I1’35,10’   ORA D,X      15
   1522   002C   030A       DC   I1’3,10’    ASL D,X      16
   1523   002E   2308       DC   I1’35,8’    ORA (DL),Y   17
   1524   0030   0E06       DC   I1’14,6’    CLC          18
   1525   0032   230E       DC   I1’35,14’   ORA ABS,Y    19
   1526   0034   1905       DC   I1’25,5’    NC ACC       1A
   1527   0036   4D06       DC   I1’77,6’    TCS          1B
   1528   0038   3F02       DC   I1’63,2’    TRB ABS,X    1C
   1529   003A   230C       DC   I1’35,12’   ORA ABS,X    1D
   1530   003C   030C       DC   I1’3,12’    ASL ABS,X    1E
   1531   003E   230D       DC   I1’35,13’   ORA ABSL,X   1F
   1532   0040   1D02       DC   I1’29,2’    JSR ABS      20
   1533   0042   0207       DC   I1’2,7’     AND (D, X)   21
   1534   0044   1D03       DC   I1’29,3’    JSL ABS L    22
   1535   0046   0216       DC   I1’2,22’    AND SR       23
   1536   0048   0704       DC   I1’7,4’     BIT D        24
   1537   004A   0204       DC   I1’2,4’     AND D        25
   1538   004C   2804       DC   I1’40,4’    ROL D        26
   1539   004E   0213       DC   I1’2,19’    AND (DL)     27
   1540   0050   2706       DC   I1’39,6’    PLP          28
   1541   0052   0201       DC   I1’2,1’     AND IMM      29
   1542   0054   2805       DC   I1’40,5’    ROL ACC      2A
   1543   0056   4515       DC   I1’69,21’   PLD          2B
   1544   0058   0705       DC   I1’7,2’     BIT ABS      2C
   1545   005A   0202       DC   I1’2,2’     AND ABS      2D
   1546   005C   28005      DC   I1’40,5’    ROL A        2E
   1547   005E   0203       DC   I1’2,3’     AND ABS L    2F
   1548   0060   080F       DC   I1’8,15’    BMI          30
   1549   0062   020B       DC   I1’2,11’    AND D,Y      31
   1550   0064   0212       DC   I1’2,18’    AND (D)      32
   1551   0066   0217       DC   I1’2,23’    AND (SR),Y   33
   1552   0068   070A       DC   I1’7,10’    BIT D,X      34
   1553   006A   020A       DC   I1’2,10’    AND D,X      35
   1554   006C   280A       DC   I1’40,10’   ROL D,X      36
   1555   006E   0208       DC   I1’2,8’     AND (DL),Y   37
   1556   0070   2D06       DC   I1’45,6’    SEC          38
   1557   0072   020E       DC   I1’25,14’   AND ABS,Y    39
   1558   0074   1505       DC   I1’21,5’    DEC          3A
   1559   0076   4E06       DC   I1’78,6’    TSC          3B
   1560   0078   070C       DC   I1’7,12’    BIT A,X      3C
   1561   007A   020C       DC   I1’2,12’    AND ABS,X    3D
   1562   007C   280C       DC   I1’40,12’   ROL A,X      3E
   1563   007E   020D       DC   I1’2,13’    AND AL,X     3F
   1564   0080   2A06       DC   I1’42,6’    RTI          40
   1565   0082   1809       DC   I1’24,9’    EOR (D,X)    41
   1566   0084   6506       DC   I1’101,6’   WDM          42
   1567   0086   1816       DC   I1’24,22’   EOR (D,X)    43
   1568   0088   5718       DC   I1’87,24’   MVP          44
   1569   008A   1804       DC   I1’24,4’    EOR D        45
   1570   008C   2104       DC   I1’33,4’    LSR D        46
   1571   008E   1813       DC   I1’24,19’   EOR (DL)     47
   1572   0090   2406       DC   I1’36,6’    PHA          48
   1573   0092   1801       DC   I1’24,1’    EOR IMM      49
   1574   0094   2105       DC   I1’33,5’    LSR ABS L    4A
   1575   0096   4806       DC   I1’72,6’    PHK          4B
   1576   0098   1C02       DC   I1’28,2’    JMP ABS      4C
   1577   009A   1802       DC   I1’24,2’    EOR ABS      4D
                                                               271
```

<!-- programmanual p272 -->

```
The Western Design Center
   1578   009C   2102                DC      I1’33,2’    LSR ABS      4E
   1579   009E   1805                DC      I1’24,5’    EOR ABS L    4F
   1580   00A0   0C0F                DC      I1’12,15’   BVC          50
   1581   00A2   1807                DC      I1’24,7’    EOR (D),Y    51
   1582   00A4   1812                DC      I1’24,18’   EOR (D)      52
   1583   00A6   1817                DC      I1’24,23’   EOR (SR),Y   53
   1584   00A8   56148               DC      I1’86,24’   MVN          54
   1585   00AA   180A                DC      I1’24,10’   EOR D,X      55
   1586   00AC   210A                DC      I1’33,10’   LSR D,X      56
   1587   00AE   1808                DC      I1’24,8’    EOR (DL),Y   57
   1588   00B0   1006                DC      I1’16,6’    CLI          58
   1589   00B2   180E                DC      I1’24,14’   EOR          59
   1590   00B4   3D15                DC      I1’61,21’   PHY          5A
   1591   00B6   4B06                DC      I1’75,6’    TCD          5B
   1592   00B8   1C03                DC      I1’28,3’    JMP ABSL     5C
   1593   00BA   180C                DC      I1’24,12’   EOR ABS,X    5D
   1594   00BC   210C                DC      I1’33,12’   LSR ABS,X    5E
   1595   00BE   180D                DC      I1’24,13’   EOR ABSL,X   5F
   1596   00C0   2B06                DC      I1’43,6’    RTS          60
   1597   00C2   0109                DC      I1’1,9’     ADC (D, X)   61
   1598   00C4   4340                DC      I1’67,16’   PER          62
   1599   00C6   0116                DC      I1’1,22’    ADC SR       63
   1600   00C8   3E04                DC      I1’62,4’    STZ D        64
   1601   00CA   0104                DC      I1’1,4’     ADC D        65
   1602   00CC   2904                DC      I1’41,4’    ROR D        66
   1603   00CE   0113                DC      I1’1,19’    ADC (DL)     67
   1604   00D0   2615                DC      I1’38,21’   PLA          68
   1605   00D2   0101                DC      I1’1,1’     ADC          69
   1606   00D4   2905                DC      I1’41,5’    ROR ABSL     6A
   1607   00D6   5506                DC      I1’85,6’    RTL          6B
   1608   00D8   1C11                DC      I1’28,17’   JMP (A)      6C
   1609   00DA   0102                DC      I1’1,2’     ADC ABS      6D
   1610   00DC   2902                DC      I1’41,2’    ROR ABS      6E
   1611   00DE   0103                DC      I1’1,3’     ADC ABSL     6F
   1612   00E0   0D0F                DC      I1’13,15’   BVS          70
   1613   00E2   0108                DC      I1’1,8’     ADC (D),Y    71
   1614   00E4   0112                DC      I1’1,18’    ADC (D)      72
   1615   00E6   0117                DC      I1’1,23’    ADC (SR),Y   73
   1616   00E8   3E0A                DC      I1’62,10’   STZ D,X      74
   1617   00EA   010A                DC      I1’1,10’    ADC D,X      75
   1618   00EC   290A                DC      I1’41,10’   ROR D,X      76
   1619   00EE   0108                DC      I1’1,8’     ADC (DL),Y   77
   1620   00F0   2F06                DC      I1’47,6’    SEI          78
   1621   00F2   010E                DC      I1’1,14’    ADC ABS,Y    79
   1622   00F4   3B15                DC      I1’59,21’   PLY          7A
   1623   00F6   4C06                DC      I1’76,6’    TDC          7B
   1624   00F8   1C14                DC      I1’28,20’   JMP (A, X)   7C
   1625   00FA   010C                DC      I1’1,12’    ADC ABS,X    7D
   1626   00FC   290C                DC      I1’41,12’   ROR ABS,X    7E
   1627   00FE   010D                DC      I1’1,13’    ADC ABSL,X   7F
   1628   0100
   1629   0100                       END


   1630   0000
   1631   0000              ATRIBH   START
   1632   0000   390F                DC      I1’57,15’   BRA          80
   1633   0002   3009                DC      I1’48,9’    STA (D, X)   81
   1634   0004   5310                DC      I1’83,16’   BRL          82
   1635   0006   3016                DC      I1’48,22’   STA-,S       83
   1636   0008   3204                DC      I1’50,4’    STY D        84
   1637   000A   3004                DC      I1’48,4’    STA D        85
   1638   000C   3104                DC      I1’49,4’    STX D        86
   1639   000E   3013                DC      I1’48,19’   STA [ D ]    87
   1640   0010   1706                DC      I1’23,6’    DEY          88
   1641   0012   0701                DC      I1’7,1’     BIT IMM      89
   1642   0014   3606                DC      I1’54,6’    TXA          8A
   1643   0016   4615                DC      I1’70,21’   PHB          8B
                                                                           272
```

<!-- programmanual p273 -->

```
The Western Design Center
   1644   0018   3203       DC   I1’50,2’    STY ABS      8C
   1645   001A   3002       DC   I1’48,2’    STA ABS      8D
   1646   001C   3102       DC   I1’49,2’    STX ABS      8E
   1647   001E   3003       DC   I1’48,3’    STA ABS L    8F
   1648   0020   040F       DC   I1’4,15’    BC           90
   1649   0022   3007       DC   I1’48,7’    STA (D),Y    91
   1650   0024   3012       DC   I1’48,18’   STA (D)      92
   1651   0026   3017       DC   I1’48,23’   STA (SR),Y   93
   1652   0028   320A       DC   I1’50,10’   STY D,X      94
   1653   002A   300A       DC   I1’48,10’   STA D,X      95
   1654   002C   310B       DC   I1’49,11’   STX D,Y      96
   1655   002E   3008       DC   I1’48,8’    STA (DL),Y   97
   1656   0030   3806       DC   I1’56,6’    TYA          98
   1657   0032   300E       DC   I1’48,14’   STA ABS,Y    99
   1658   0034   3706       DC   I1’55,6’    TXS D        9A
   1659   0036   4F06       DC   I1’79,6’    TXY          9B
   1660   0038   3E02       DC   I1’62,2’    STZ ABS      9C
   1661   003A   300C       DC   I1’48,12’   STA ABS,X    9D
   1662   003C   3E0C       DC   I1’62,12’   STZ ABS,X    9E
   1663   003E   300D       DC   I1’48,13’   STA ABSL,X   9F
   1664   0040   2001       DC   I1’32,1’    LDY IMM      A0
   1665   0042   1E09       DC   I1’30,9’    LDA (D,X)    A1
   1666   0044   1F01       DC   I1’31,1’    LDX IMM      A2
   1667   0046   1E16       DC   I1’30,22’   LDA SR       A3
   1668   0048   2004       DC   I1’32,4’    LDY D        A4
   1669   004A   1E04       DC   I1’30,4’    LDA D        A5
   1670   004C   1F04       DC   I1’31,4’    LDX D        A6
   1671   004E   1E13       DC   I1’30,19’   LDA (DL)     A7
   1672   0050   3406       DC   I1’52,6’    TAY          A8
   1673   0052   1E01       DC   I1’31,1’    LDA IMM      A9
   1674   0054   3306       DC   I1’51,6’    TAX          AA
   1675   0056   4415       DC   I1’68,21’   PLB          AB
   1676   0058   2002       DC   I1’32,2’    LDY ABS      AC
   1677   005A   1E02       DC   I1’30,2’    LDA ABS      AD
   1678   005C   1F02       DC   I1’31,2’    LDX ABS      AE
   1679   005E   1E03       DC   I1’30,3’    LDA ABS L    AF
   1680   0060   050F       DC   I1’5,15’    BCS          B0
   1681   0062   1E07       DC   I1’30,7’    LDA (D),Y    B1
   1682   0064   1E12       DC   I1’30,18’   LDA (D)      B2
   1683   0066   1E17       DC   I1’30,23’   LDA (SR),Y   B3
   1684   0068   200A       DC   I1’32,10’   LDY D,X      B4
   1685   006A   1E0A       DC   I1’30,10’   LDA D,X      B5
   1686   006C   1E0B       DC   I1’30,11’   LDX D,Y      B6
   1687   006E   1E08       DC   I1’30,8’    LDA (DL),Y   B7
   1688   0070   1106       DC   I1’17,6’    CLV          B8
   1689   0072   1E0E       DC   I1’30,14’   LDA ABS,Y    B9
   1690   0074   3506       DC   I1’53,6’    TSX          BA
   1691   0076   5006       DC   I1’80,6’    TYX          BB
   1692   0078   200C       DC   I1’32,12’   LDY ABS,X    BC
   1693   007A   1E0C       DC   I1’30,12’   LDA ABS,X    BD
   1694   007C   1F0E       DC   I1’31,14’   LDX ABS,Y    BE
   1695   007E   1E0D       DC   I1’30,13’   LDA ABSL,X   BF
   1696   0080   1401       DC   I1’30,13’   CPY          C0
   1697   0082   1209       DC   I1’18,9’    CMP (D,X)    C1
   1698   0084   4901       DC   I1’73,1’    REP          C2
   1699   0086   1216       DC   I1’18,22’   CMP          C3
   1700   0088   1404       DC   I1’20,4’    CPY D        C4
   1701   008A   1204       DC   I1’18,4’    CMP D        C5
   1702   008C   1504       DC   I1’21,4’    DEC D        C6
   1703   008E   1213       DC   I1’18,19’   CMP (DL)     C7
   1704   0090   1B06       DC   I1’27,6’    INY          C8
   1705   0092   1201       DC   I1’18,1’    CMP IMM      C9
   1706   0094   1606       DC   I1’22,6’    DEX          CA
   1707   0096   5906       DC   I1’89,6’    WAI          CB
   1708   0098   1402       DC   I1’20,2’    CPY ABS      CC
   1709   009A   1202       DC   I1’18,2’    CMP ABS      CD
   1710   009C   1502       DC   I1’21,2’    DEC ABS      CE
   1711   009E   1203       DC   I1’18,3’    CMP ABSL     CF
                                                               273
```

<!-- programmanual p274 -->

```
The Western Design Center
   1712   00A0      090F              DC        I1’9,15’       BNE               D0
   1713   00A2      1207              DC        I1’18,7’       CMP (D0,Y         D1
   1714   00A4      1212              DC        I1’18,18’      CMP (D)           D2
   1715   00A6      1217              DC        I1’18,23’      CMP               D3
   1716   00A8      4204              DC        I1’66,4’       PEI D             D4
   1717   00AA      120A              DC        I1’18,10’      CMP D,X           D5
   1718   00AC      150A              DC        I1’21,10’      DEC D,X           D6
   1719   00AE      1208              DC        I1’18,8’       CMP (DL),Y        D7
   1720   00B0      0F06              DC        I1’15,6’       CLD               D8
   1721   00B2      120E              DC        I1’18,14’      CMP ABS,Y         D9
   1722   00B4      3C15              DC        I1’60,21’      PHX               DA
   1723   00B6      6406              DC        I1’100,6’      STP               DB
   1724   00B8      1C11              DC        I1’28,17’      JMP (A)           DC
   1725   00BA      120C              DC        I1’18,12’      CMP ABS,X         DD
   1726   00BC      150C              DC        I1’21,12’      DEC ABS,X         DE
   1727   00BE      120D              DC        I1’18,13’      CMP ABSL,X        DF
   1728   00C0      1301              DC        I1’19,1’       CPX IMM           E0
   1729   00C2      2C09              DC        I1’44,9’       SBC (D,X)         E1
   1730   00C4      4A01              DC        I1’74,1’       SEP IMM           E2
   1731   00C6      2C16              DC        I1’44,22’      SBC SR            E3
   1732   00C8      1F04              DC        I1’31,4’       LDX D             E4
   1733   00CA      2C04              DC        I1’44,4’       SBC D             E5
   1734   00CC      1904              DC        I1’25,4’       INC D             E6
   1735   00CE      2C13              DC        I1’44,19’      SBD (DL)          E7
   1736   00D0      1A06              DC        I1’26,6’       INX D             E8
   1737   00D2      2C01              DC        I1’44,1’       SBC IMM           E9
   1738   00D4      2206              DC        I1’34,6’       NOP               EA
   1739   00D6      5106              DC        I1’81,6’       XBA               EB
   1740   00D8      1302              DC        I1’19,2’       CPX ABS           EC
   1741   00DA      2C02              DC        I1’44,2’       SBC ABS           ED
   1742   00DC      1902              DC        I1’25,2’       INC ABS           EE
   1743   00DE      2C03              DC        I1’44,3’       SBC ABSL          EF
   1744   00E0      060F              DC        I1’6,15’       BEQ               F0
   1745   00E2      2C07              DC        I1’44,7’       SBC (D),Y         F1
   1746   00E4      2C12              DC        I1’44,18’      SBC (D)           F2
   1747   00E6      2C17              DC        I1’44,23’      SBC (SR),Y        F3
   1748   00E8      4102              DC        I1’65,2’       PEA               F4
   1749   00EA      2C0A              DC        I1’44,10’      SBC D,X           F5
   1750   00EC      190A              DC        I1’25,10’      INC D,X           F6
   1751   00EE      2C08              DC        I1’44,8’       SBC (DL),Y        F7
   1752   00F0      2E06              DC        I1’46,6’       SED               F8
   1753   00F2      2C0E              DC        I1’44,14’      SBC ABS,Y         F9
   1754   00F4      3A15              DC        I1’58,21’      PLX               FA
   1755   00F6      5206              DC        I1’82,6’       XCE               FB
   1756   00F8      1D14              DC        I1’29,20’      JSR (A,X)         FC
   1757   00FA      2C0C              DC        I1’44,12’      SBC ABS,X         FD
   1758   00FC      190C              DC        I1’25,12’      INC ABS,X         FE
   1759   00FE      2C0D              DC        I1’44,13’      SBC ABSL,X        FF
   1760   0100                        END

   Global Symbols

   ADDRMODE            00009C   AREG        00008F     AREGH     000090     BRKN      00FFE6
   C                   000001   CODE        000087     CR        00008D     DBREG     000095
   DIRREG              000093   DIRREGH     000094     DPAGE     000300     EBIT      000097
   M                   000020   MNX         00009D     NCODE     000083     OPCREG    000084
   OPCREGB             000086   OPCREGH     000085     OPLEN     00009F     OPRNDB    00008A
   OPRNDH              000089   OPRNDL      000088     PCREG     000080     PCREGB    000082
   PCREGH              000081   PREG        000096     STACK     000091     STACKH    000092
   TEMP                000099   TEMPB       00009B     TEMPH     00009A     USRBRKV   003F0
   X                   000010   XREG        00008B     XREGH     00008C     YREG      00008D
   YREGH               00008E

   1760 source lines
   0 macros expanded
   0 lines generated
   0 page faults

                                                                                               274
```

<!-- programmanual p275 -->

```
The Western Design Center
   Link Editor 4.0

   00008000          00000037    Code:   MAIN
   00008037          000000CF    Code:   EBRKIN
   00008106          00000048    Code:   FLIST
   0000814E          00000120    Code:   FRMOPRND
   0000826E          00000019    Code:   POB
   00008287          0000002F    Code:   STEP
   00008286          00000026    Code:   PUTHEX
   000082DC          0000005A    Code:   CLRLN
   000088336         0000005D    Code:   UPDATE
   00008393          0000001A    Code:   PRINTLN
   000083AD          00000043    Code:   TRACE
   000083FO          0000003E    Code:   CHKSPCL
   0000842E          00000069    Code:   SBRK
   00008497          0000004E    Code:   DUMPREGS
   000084E5          00000026    Code:   PUTREG8
   000085OB          0000001C    Code:   SPJMP
   00008527          00000005    Code:   PMASK
   0000852C          00000017    Code:   SCODES
   00008543          00000114    Data:   MN
   00008657          00000032    Data:   MODES
   00008689          00000018    Code:   LENS
   000086A1          00000100    Data:   ATRIBL
   000087A1          00000100    Code:   ATRIBH


   Global symbol table:

   ADDRMODE          0000009C   00   AREG        0000008F   00   AREGH       00000090   00
   ATRIBH            000087A1   00   ATRIBL      000086A1   03   BRKN        0000FFE6   00
   C                 00000001   00   CHKSPCL     00008DF0   00   CLRLN       000082DC   00
   CODE              00000087   00   CR          0000008D   00   DBREG       00000095   00
   DIRREG            00000093   00   DIRREGH     00000094   00   DOBRANCH    0000841B   00
   DPAGE             00000300   00   DUMPREGS    00008497   00   EBIT        00000097   00
   EBRXIN            00008037   00   FABS        0000816B   00   FABSIND     000081F5   00
   FABSINXIND        00008224   00   FABSL       0000816E   00   FABSLX      000081C1   00
   FABSX             000081BB   00   FABSY       000081C7   00   FACC        00008174   00
   FBLOCK            00008526   00   FDIR        00008171   00   FDIRINXX    000081A2   00
   FDIRINXY          000081A8   00   FIMM        00008159   00   FIMP        0000817A   00
   FIND              00008204   00   FINDINX     0000817B   00   FINDINXL    0000818A   00
   FINDL             00008214   00   FINX        000081AE   00   FINXIND     00008190   00
   FINY              0000817E   00   FLIST       00008106   00   FPCR        000081CD   00
   FPCRL             000081E4   00   FRMOPRND    0000814E   00   FSRINDINX   00008244   00
   FSTACK            00008233   00   FSTACKREL   00008234   00   GO          000080C4   00
   LENS              00008689   00   LINE        000082EE   00   LIST        00008003   00
   M                 00000020   00   MAIN        00008000   00   MN          00008543   01
   MNX               0000009D   00   MODES       00008657   02   MOVE        0000814A   00
   NBRKIN            00008047   00   NCODE       00000083   00   OPCREG      00000084   00
   OPCREGB           00000086   00   OPCREGH     00000085   00   OPLEN       0000009F   00




                                                                                             275
```
