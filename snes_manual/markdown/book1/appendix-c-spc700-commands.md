# Appendix C — SPC700 Commands

> These are SPC700 (sound) instructions, not 65C816.

## Contents (per the manual's own TOC)

- SPC700 command tables C-4 … C-19 (the SOUND CPU's instructions)

## Provenance

```
Source: `snes_manual/book1.pdf` (Nintendo Super NES Development Manual, Book I),
scanned 240-page image-only PDF (no text layer). Per-page text below is produced by
RapidOCR (ONNX) at 300 DPI. **Prose is a usable baseline; hex / disassembly / tables
carry OCR noise (dropped inter-word spaces, 0/O, S/s, l/I confusion) and must be
verified against the page image before being treated as fact.** Each page is tagged
with `<!-- book1 pNNN -->` so a specific page can be re-verified and corrected.
```

## Body (pages 227–236)


<!-- book1 p227 -->

```
SNESDEVELOPMENTMANUAL
Appendix C SPC7oo Commands
C.1 SUMMARY OF SPC7O0 COMMANDS
and sleep modes cannot be used. The command set operand notation and expla-
nation of command activity are indicated in the table below. The upper portion of
the table contains symbols necessary to operand description. These are symbols
necessary for assembler description. In the lower portion of the table, the values
of the various operands are expressed as symbols. Assembler descriptions are
given as numerical values or labels.
TableC-1CommandOperandSymbolsandMeaning
Symbol Meaning
A A Register
X X Register
Y Y Register
PSW Program Status Word
YA Y, A paired 16-bit register
PC Program Counter
SP Stack Pointer
() Indirect Expression
()+ Indirect Auto-increment Expression
# Immediate Data
1 Absolute Address
Bit Reversal
Bit Position Indicator
[] Indexed Indirect Expression
H Hexadecimal Notation
imm 8-bit Immediate Data
dp Offset Address within Direct Page
abs 16-bit Absolute Address
rel RelativeOfset 2's Complement
mem BooleanBitOperationAddress
bit Bit Location
MSB
0
×一
MSB
y
0
y
abedn Offset Within U Page
n Vector Call Number
(NCL PG 35)
C-1
```

<!-- book1 p228 -->

```
SPC700COMMANDS
The following symbols are used, in addition to those on the previous page, for the
purpose of explaining operational functions.
TableC-2SymbolsandMeaningforOperational Description
Symboll Meaning
N Negative Flag
V Overflow Flag
P Direct Page Flag
B Break Flag
H Half Carry Flag
IndirectMasterEnableFlag
Z Zero Flag
C Carry Flag
+ Addition
Subtraction
Comparison
AND Logic Product
OR Logic Sum
EOR Exclusive LogicSum
Multiplication
/ Division
Q Division Quotient
R DivisionRemainder
<d> Destination
<S> Source
}↓→ Direction of Data Transmission
Data Decrement
++ Data Increment
>> 1 Bit Shift Left
>> 1 Bit Shift Right
Note: The number of cycles of conditional branching commands are appropriate
to cases when there is no branching to the left side and there is branching to the
right side.
TableC-3ExplainationofSymbols in theStatusFlagColumn
Symbol Meaning
No Change
0 Cleared to “0"
1 Set to "1"
Flag Name|Set or Cleared Depending on Result
(NCL PG 36)
C-2
```

<!-- book1 p229 -->

```
SNESDEVELOPMENTMANUAL
Table C-4 8-bit Data Transmission Commands, Group 1
Mnemonic Operand Code Bytes Cycles Operation NVPBHIZC
MOV A, #imm E8 2 2 A←imm N..z
MOV A. (X) E6 1 3 A← (X) N....
MOV A, (X)+ BF 1 4 A ← (X) with auto increment N....
MOV A, dp E4 2 3 A ← (dp) N....
MOV A, dp+X F4 2 4 A← (dp+X) N....Z
MOV A, !abs E5 3 4 A← (abs) N....
MOV A,!abs+X F5 3 5 A ← (abs+X) N....
MOV A,!abs+Y F6 3 5 A ← (abs+Y) N....
MOV A, [dp+X] E7 2 6 A ←(dp+X+1)(dp+X)) N....
MOV A, [dp]+Y F7 2 6 A ←(dp+1)(dp)+Y) N....Z
MOV X,#imm CD 2 2 ww! → X N...Z
MOV X, dp F8 2 3 (dp) →X N....Z
MOV X, dp+Y F9 2 4 ×← (dp+Y) N....
MOV X, !abs E9 3 4 ×← (abs) N....
MOV Y, #imm 8D 2 2 丫←imm N...
MOV Y, dp EB 2 3 ←(dp) N....
MOV x+dp人 FB 2 4 ←(dp+x) N....
MOV Y, !abs EC 4 Y← (abs) N...Z
Table C-5 8-bit Data Transmission Commands, Group 2
Mnemonic Operand Code Bytes Cycles Operation NVPBHIZC
MOV (X), A C6 1 4 A→(X)
MOV (X)+, A AF 1 4 A → (X) with auto increment
MOV dp, A C4 2 4 A →(dp)
MOV dp+X, A D4 2 5 A → (dp+X)
MOV !abs, A C5 3 5 A → (abs)
MOV labs+X, A D5 3 9 A → (abs+X)
MOV !abs+Y, A D6 3 6 A → (abs+Y)
MOV [dp+X], A C7 2 7 A →(dp+X+1)(dp+X))
MOV [dp]+Y, A D7 2 7 A → ((dp+1)(dp)+Y)
MOV dp, x D8 2 4 × →(dp)
MOV ×'+dp D9 2 5 × →(dp+Y)
MOV !abs, X C9 3 5 × → (abs)
MOV dp, Y CB 2 4 Y →(dp)
MOV dp+X, Y DB 2 5 Y→ (dp+x)
MOV !abs, Y CC 3 5 Y→ (abs)
(NCL PG 37)
C-3
```

<!-- book1 p230 -->

```
SPC700COMMANDS
Table C-6 8-bit Data Transmission Commands, Group 3
Mnemonic Operand Code Bytes Cycles Operation NVPBHIZC
MOV A,X 7D 1 2 A←X N....Z
MOV A, Y DD 1 2 A←Y N....
MOV X, A 5D 1 2 X←A N.....
MOV Y, A FD 1 2 Y←A N...
MOV X, SP 9D 1 2 X← SP N.....
MOV SP, X BD 1 2 SP←- x
MOV dp<d>,dp<s> FA 3 5 (<s>dp)→(<p>dp)
MOV dp,#imm 8F 3 5 ww! →(dp)
(NCL PG 38)
C-4
```

<!-- book1 p231 -->

```
SNESDEVELOPMENTMANUAL
Table C-7 8-bit Arithmetic Operation Commands
Mnemonic COperand Code Bytes Cycles Operation NVPBHIZC
ADC A, #imm 88 2 2 A 个 A+ imm + C NV..H.ZC
ADC A, (X) 86 1 3 A A+ (X)+C NV..H.ZC
ADC A, dp 84 2 3 A → A + (dp)+C NV.H.ZC
ADC A, dp+X 94 2 4 A 个 A + (dp+X)+C NV..H.ZC
ADC A, labs 85 3 4 A A + (abs) + C NV..H.ZC
ADC A,!abs+X 95 3 5 A 个 A + (abs +X)+ C NV.H.ZC
ADC A, labs+Y 96 3 5 A 个 A + (abs + Y) + C NV..H.ZC
ADC A, [dp+X] 87 2 6 A ↑ A + (dp+X+1)(dp+X) + C NV..H.ZC
ADC A, [dp]+Y 97 2 6 A → A + ((dp+1)(dp)+Y) + C NV..H.ZC
ADC (X), (Y) 66 1 5 (X)← (X)+()+C NV..H.ZC
ADC dp<d>,dp<s> 89 3 6 (dp<d>)(dp<d>) + (dp<s>) + C NV.H.zC
ADC dp, #imm 98 3 5 (dp)< (dp) + imm + C NV..H.ZC
SBC A, #imm A8 2 2 A 个 A-imm-C NV..H.ZC
SBC A, (X) A6 1 3 A → A- (X)-C NV..H.ZC
SBC A, dp A4 2 3 A → A- (dp)-C NV..H.ZC
SBC A, dp+X B4 2 4 A ↑ A- (dp+x)-C NV..H.ZC
SBC A, labs A5 3 4 A ↑ A- (abs)-C NV.H.ZC
SBC A,labs+X B5 3 5 A → A - (abs + X)-C NV..H.ZC
SBC A, labs+Y B6 3 5 A → A-( (abs + Y)- C NV.H.ZC
SBC A, [dp+X] A7 2 6 A ↑ A- (dp+X+1)(dp+X) - C NV.H.ZC
SBC A, [dp]+Y B7 2 6 A → A- ((dp+1)(dp)+Y)- C NV.H.ZC
SBC (X), (Y) B9 1 5 →(x) (X)- (Y)- C NV.H.ZC
SBC dp<d>.dp<s> A9 3 6 (dp<d>)/← (dp<d>)-(dp<s>)- C NV..H.ZC
SBC dp, #imm B8 3 5 (dp)< (dp) - imm - C NV..H.ZC
CMP A,#imm 68 2 2 A - imm N....C
CMP A. (X) 66 1 3 A-(X) N...C
CMP A, dp 64 2 3 A -(dp) N....ZC
CMP A, dp+X 74 2 4 A -(dp+X) N....ZC
CMP A,labs 65 3 4 A -(abs) N...C
CMP A,labs+X 75 3 5 A - (abs+X) N....ZC
CMP A, labs+Y 76 3 5 A - (abs+Y) N....ZC
CMP A,[dp+X] 67 2 6 A -((dp+X+1)(dp+X)) N....ZC
CMP A, [dp]+Y 77 2 6 A - ((dp+1)(dp)+Y) N...C
CMP (X), (M) 79 1 5 (X)- (Y) N....ZC
CMP dp<dv,dp<s> 69 3 9 (<s>dp)-(<p>dp) N....ZC
CMP dp, #imm 78 3 5 (dp) - imm N....ZC
CMP X,#imm C8 2 2 ww!-X N....ZC
CMP X, dp 3E 2 3 ×-(dp) N....ZC
CMP X, labs 1E 3 4 X - (abs) N....ZC
CMP Y, #imm AD 2 2 Y-imm N....ZC
CMP Y. dp 7E 2 3 Y-(dp) N....ZC
CMP Y, labs 5E 3 4 Y -(abs) N...ZC
(NCL PG 39)
C-5
```

<!-- book1 p232 -->

```
SPC700COMMANDS
Table C-8 8-bit Logic Operation Commands
Mnemonic Operand Code Bytes Cycles Operation NVPBHIZC
AND A, #imm 28 2 2 A←A AND imm N....Z..
AND A, (X) 26 1 3 A←A AND (X) N...Z..
AND A, dp 24 2 3 A←A AND (dp) N.....
AND A, dp+X 34 2 4 A←A AND (dp+X) N.....
AND A, labs 25 3 4 AA AND (abs) N.....
AND A, labs+X 35 3 5 A←A AND (abs+X) N.....
AND A, labs+Y 36 3 5 A←A AND (abs+Y) N....Z.
AND A, [dp+x] 27 2 6 A ←A AND ((dp+X+1)(dp+X) N.....
AND A, [dp]+Y 37 2 6 A ←A AND ((dp+1)(dp)+Y) N....
AND (X). (Y) 39 1 5 (X) (X)AND (Y) N.....
AND dp<dv,dp<s> 29 3 6 (dp<d>)← (dp<d>) AND(dp<s>) N....
AND dp,#imm 38 3 5 (dp)→(dp) )AND imm N.....
A, #imm 08 2 2 A←A OR imm
OR N...Z..
A, (X) 06 1 3 A←A OR (X)
OR N....Z..
A, dp 04 2 3 A←A OR (dp)
OR N.....
A, dp+X 14 2 4 A←A OR (x+dp)
OR N.....
A, labs 05 3 4 A←A OR (abs)
OR N....
A, labs+X 15 3 5 A<A OR (abs+X)
OR N...Z..
A, labs+Y 16 3 5 A←A OR (abs+Y)
OR N....
A, [dp+X] 07 2 6 A←A OR ((dp+X+1)(dp+x)
OR N...Z.
A, [dp]+Y 17 2 6 A←A( OR (dp+1)(dp)+Y)
OR N....
(X). (Y) 19 1 5 (X)←(X)OR (Y)
OR N.....
<s>`<p>dp 60 3 6 (dp<d>) < (dp<d>) OR (dp<s>) N...Z.
OR
dp,#imm 18 3 5 (dp)← (dp) OR imm
OR N...Z.
EOR A, #imm 48 2 2 A←A EOR imm N....
EOR A, (X) 46 1 3 A←AE EOR (X) N....
EOR A, dp 44 2 3 A←A EOR (dp) N....
EOR A, dp+X 54 2 4 A←A EOR (dp+X) N....
EOR A,labs 45 3 4 AA EOR (abs) N...Z.
EOR A, labs+X 55 3 5 A←A EOR (abs+X) N....
EOR A, !abs+Y 56 3 5 A←A EOR (abs+Y) N...Z.
EOR A, [dp+X] 47 2 9 A←AB EOR ((dp+X+1)(dp+X)) N...Z.
EOR A, [dp]+Y 57 2 6 A A EOR (dp+1)(dp)+Y) N.....
EOR (X), (Y) 59 1 5 (X)←(X) EOR (Y) N....Z.
EOR dp<dv,dp<s> 49 3 6 (dp<d>)← (dp<d>) EOR(dp<s>) N....
EOR dp, #imm 58 3 5 (dp)← (dp) EOR imm N....Z.
(NCL PG 40)
C-6
```

<!-- book1 p233 -->

```
SNESDEVELOPMENTMANUAL
TableC-9 9Addition and Subtraction Commands
Mnemonic  Operand Code Bytes Cycles Operation NVPBHIZC
INC A BC 1 2 ++A N...Z..
INC dp AB 2 4 ++ (dp) N...Z.
INC x+dp BB 2 5 (x+dp) ++ N....Z.
INC !abs AC 3 5 ++ (abs) N.....
INC 3D 1 2 x++ N.....
INC Y FC 1 2 人++ N......
DEC A 9C 1 2 --A N.....
DEC dp 8B 2 4 "(dp) N.....Z..
DEC x+dp 9B 2 5 (x+dp) N....
DEC !abs 8C 3 5 --(abs) N......
DEC X 1D 1 2 --x N...Z.
DEC Y DC 1 2 -Y N....Z..
Table C-10 Shift Rotation Commands
Mnemonic Operand Code Bytes Cycles Operation NVPBHIZC
ASL A 1C 1 2 C<A << N....zC
ASL dp OB 2 4 C << (dp) N....ZC
ASL x+dp 1B 2 5 (x+dp) v N....ZC
ASL !abs OC 3 5 C<< (abs) N...ZC
LSR A 5C 1 2 C<A ovv N....C
LSR dp 4B 2 4 C<< (dp) <<C N...ZC
LSR x+dp 5B 2 5 (x+dp)>> <<C
N....C
LSR !abs 4C 3 5 C<< (abs) <<℃
N....ZC
ROL A 3C 1 2 C<<A <<C N....zc
ROL dp 2B 2 4 (dp)v> <<C N....ZC
ROL x+dp 3B 2 5 (x+dp)>> <<C
N....C
ROL !abs 2C E 5 C<< (abs) <<C
N...C
ROR A 7C 1 2 C<<A <<C N....ZC
ROR dp 6B 2 4 C<< (dp) <<C N....ZC
ROR x+dp 7B 2 5 (x+dpv> <<C N...ZC
ROR !abs 6C 3 5 C << (abs) <<C
N....ZC
XCN A 9F 1 5 A (7 ~ 4)<>A (3 ~ 0) N...Z.
(NCL PG 41)
C-7
```

<!-- book1 p234 -->

```
SPC700COMMANDS
Table C-11 16-bit Data Transmission Commands
Mnemonic Operand Code Bytes Cycles Operation NVPBHIZC
MOVW YA,dp BA 2 5 YA <(dp+1)(dp) N....Z.
MOVW dp, YA DA 2 4 (dp+1)(dp) < YA
Table C-1216-bit Operation Commands
Mnemonic Operand Code Bytes Cycles Operation NVPBHIZC
INCW dp 3A 2 6 increment dp memory pair N....
DECW dp 1A 2 6 decrementdpmemorypair N.....
ADDW YA, dp 7A 2 5 YA <- YA+(dp+1)(dp) NV..H.ZC
SUBW YA, dp 9A 2 5 YA < YA-(dp+1)(dp) NV..H.ZC
CMPW YA, dp 5A 2 4 YA-(dp+1)(dp) N....ZC
Table  C-13 Multiplication and Division Commands
Mnemonic Operand Code Bytes Cycles Operation NVPBHIZC
MUL YA CF 1 9 YA(16bits)<Y *A N.....
DIV YA, X 9E 1 12 Q:A R:Y<YA/ X NV..H.Z.
Table C-14 Decimal Compensation Commands
Mnemonic Operand Code Bytes Cycles Operation NVPBHIZC
DAA A DF 1 3 decimal adjustfor addition N...ZC
DAS A BE 1 3 decimal adjust for subtraction N....ZC
Table C-15 Branching Commands
Mnemonic Operand Code Bytes Cycles Operation NVPBHIZC
BRA rel 2F 2 4 branch always
BEQ rel FO 2 2/4 branch on Z=1
BNE rel DO 2 2/4 branch on Z=0
BCS rel B0 2 2/4 branch on C=1
BCC rel 90 2 2/4 branch on C=0
BVS rel 70 2 2/4 branch on V=1
BVC rel 50 2 2/4 branch on V=0
BMI rel 30 2 2/4 branch on N=1
BPL rel 10 2 2/4 branch on N=0
BBS dp,bit, rel x3 3 5/7 branch on dp, bit=1
BBC dp,bit, rel y3 3 5/7 branch on dp, bit=0
CBNE dp,rel 2E 3 5/7 compare A with (dp) then BNE
CBNE dp+X, rel DE 3 6/8 compare A with (dp+X) then BNE
DBNZ dp,rel 6E 3 5/7 decrement memory (dp) then JNZ
DBNZ Y,rel FE 2 4/6 decrementY then JNZ
JMP !abs 5F 3 3 jump to new location
JMP [!abs+X] 1F 3 6 PC < (abs+X+1)(abs+X)
(NCL PG 42)
C-8
```

<!-- book1 p235 -->

```
SNESDEVELOPMENTMANUAL
Table C-16 Subroutine Call, Return Commands
Mnemonic Operand Code Bytes Cycles Operation NVPBHIZC
CALL !abs 3F 3 8 subroutine call
PCALL upage 4F 2 6 upage call
TCALL n n1 1 8 table call
BRK OF 1 8 software interrupt ...1.0..
RET 6F 1 5 return from subroutine
RETI 7F 1 6 return from interrupt (Restored)
Table C-17 Stack Operation Commands
Mnemonic Operand Code Bytes Cycles Operation NVPBHIZC
PUSH A 2D 1 4 push A to stack
PUSH X 4D 1 4 push X to stack
PUSH Y 6D 1 4 push Y to stack
PUSH PSW OD 1 4 push PSW to stack
POP A AE 1 4 pop A from stack
POP X CE 1 4 pop X from stack
POP Y EE 1 4 pop Y from stack
POP PSW 8E 1 4 pop PSw from stack (Restored)
Table C-18 Bit Operation Commands
Mnemonic Operand Code Bytes Cycles Operation NVPBHIZC
SET1 dip. bit x2 2 4 set direct page bit
CLR1 dip. bit y2 2 4 clear direct page bit
TSET1 !abs OE 3 6 test and set bits with A N.......
TCLR1 !abs 4E 3 9 testandclearbitswithA N......
AND1 C, mem. bit 4A 3 4 C < C AND (mem.bit) ..
AND1 C, /mem. bit 6A 3 4 C → C AND (mem. bit) ..C.
OR1 C, mem. bit OA 3 5 C < C OR (mem. bit) ..
OR1 C, /mem. bit 2A 3 5 C <- C OR (mem. bit) ....
EOR1 C, mem. bit 8A 3 5 C< C EOR (mem. bit)
NOT1 mem. bit EA 3 5 complement (mem. bit)
MOV1 C, mem. bit  AA 3 4 C< (mem.bit)
MOV1 mem. bit, C CA 3 6 C > (mem. bit)
(NCL PG 43)
C-9
```

<!-- book1 p236 -->

```
SPC700COMMANDS
Table C-19 Program Status Flag Operation Commands
Mnemonic Operand Code Bytes Cycles Operation NVPBHIZC
CLRC 60 1 2 clearcarryflag
SETC 80 1 2 set carry flag
NOTC ED 1 3 complement carry flag
CLRV EO 1 2 clear V and II .0..0...
CLRP 20 1 2 clear direct page flag ......
SETP 40 1 2 set direct page flag ..1....
EI A0 1 3 set interrupt enable flag .....1.
DI Co 1 3 clear interruptenableflag ....
TableC-20 Other Commands
Mnemonic Operand Code Bytes Cycles Operation NVPBHIZC
NOP 00 1 2 no operation
SLEEP EF 1 3 standby SLEEP mode
STOP FF 1 3 standby STOP mode
(NCL PG 44)
C-10
```
