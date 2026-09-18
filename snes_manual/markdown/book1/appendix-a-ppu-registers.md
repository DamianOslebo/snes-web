# Appendix A — PPU Registers

> Big register tables; OCR hex is noisy — verify digits from images when used.

## Contents (per the manual's own TOC)

- Register maps / VRAM & CG-RAM tables

## Provenance

```
Source: `snes_manual/book1.pdf` (Nintendo Super NES Development Manual, Book I),
scanned 240-page image-only PDF (no text layer). Per-page text below is produced by
RapidOCR (ONNX) at 300 DPI. **Prose is a usable baseline; hex / disassembly / tables
carry OCR noise (dropped inter-word spaces, 0/O, S/s, l/I confusion) and must be
verified against the page image before being treated as fact.** Each page is tagged
with `<!-- book1 pNNN -->` so a specific page can be re-verified and corrected.
```

## Body (pages 196–218)


<!-- book1 p196 -->

```
PPUREGISTERS
Appendix A. PPU Registers
V-RAM
8 BIT (HIGH) 8 BIT (LOW)
ADDRESSWORD
0000H 0 8K-WORD: This is an area which is designated
by“OBJNAMEBASEADDRESS"of the
register<2101H>.(32K-WORD/4-Partition.)
[TheBA2of theregister<2101H>"OBJ NAME
BASEADDRESS"isused forexpansionpur-
2000H poses, and it will normally be ignored.]
8K
4000H 16K
[In case BA1=1 and BA0=1 are set by "OBJ
NAME BASE ADDRESS"]
6000H 24K
4K-WORD: This is. a lower 4K-WORD of the
area(8K-WORD) designated by“OBJ NAME
BASEADDRESS"of theregister<2101H>.
Thecombinationof this4K-WORDand the
4K-WORDremainingwill be determined by
"OBJ NAME SELECT"of theregister
<2101H>.
1
7FFFH
32K
0000H
2000H
OBJ NameSelect
N1 JNO COMBINATION
0 0 4K-WORD+①
4000H
0 1 4K -WORD+②
1 0 4K-WORD+③
4K - WORD + ④
(NCL PG 68)
A-1
```

<!-- book1 p197 -->

```
SNESDEVELOPMENTMANUAL
OBJECTDATATOBESTORED
4 BIT CONSTRUCTION [8 x 8 x 4 Bit (16 WORD) / CHARACTER] (Refer to page A-12)
8x8(CharacterSize)x4(BitConstruction)x512(Numberofcharacter) 16K-BYTE
[In case BA1=1 and BAO=0 are setby"OBJ NAMEBASEADDRESS"and also N1=0and N0=0
aresetby“OBJNAMESELECT")
D15 <V-RAM> DO
0000H V-RAMADDRESS CHARACTER CODE
n=4000H
D15 DO
n DATA OF 1ST LINE (000)
n+1 DATA OF 2ND LINE (000)
+
2000H
C
H
n+7 DATA OF 8TH LINE (000)
R
n+8 DATA OF 1ST LINE (000)
D
6+u DATA OF 2ND LINE (000)
AT
4000H
A
4K-WORD
BKWORD n+ 15 DATA OF 8TH LINE (000)
n+16 DATA OF 1ST LINE (001)
6000H n + 17 DATA OF 2ND LINE (001)
LINE
n+8183 DATA OF8THLINE(1FF)
2
n+8184 DATA OF 1ST LINE (1FF)
3
4 n+ 8185 DATA OF 2ND LINE (1FF)
5
6
7
8 (See page A-12)
n+8191 DATA OF 8TH LINE (1FF)
<CHaRACTER (8 X 8)>
(NCL PG 69)
A-2
```

<!-- book1 p198 -->

```
PPUREGISTERS
OBJECT DATA
OAM
ADDRESS
(Decimal) D15 DO 15141312111098765432100
000
OBJO OBJ V-POSITION OBJ H-POSITION Low
001
6|5|4|3|2|1|0
002
OBJ1 FLIP OBJ COLOR NAME (000H - 1FFH) High
003
H 2110 8|7|6|5|4|3|2|1|00
CHARACTER
CODE
NUMBER
(Page A-4)
252
OBJ126 COLOR PALETTE SELECT:
Designate palette for 1 character
253
 OBJ PRIORITY:
Determine the display priority when OBJ is com-
254 bined with BG1 ~ BG4 (per character). [Refer to
OBJ 127 page A-19 for priority.]
255 H/V FLIP:
X-direction Flip (H-Flip), Y-direction (V-Flip)
256 OBJ7.OBJ0 [The character is flipped,but H/V position does not
change.]
257 OBJ 15 - OBJ8
15141312 1110 9 8 7 6 5 4 3 2 1 00
OBJ7 OBJ 6 OBJ5 OBJ 4 OBJ3 OBJ2 OBJ 1 OBJO
! ■
1
Size Large/Small H-Position MSB
270 OBJ 119-0BJ 112|The base position of the OBJ on the H-direction will be determined by
both H-position (8-bit) and the H-position MSB.
271 OBJ127-0BJ120
Size Large/Small:Determine the size tobeused eitherof 2OBJ'sby
register <2101H>.
H/V FLIP
<H-FLIP = 0, V FLIP =0> Turns on this axis <H-FLIP = 1, V FLIP =0>
H/V POSITION H/V POSITION
H-FLIP
Turns on this axis V-FLIP
H/v pOSITION H/VPOSITION-
<H-FLIP = 0, V FLIP =1>' (NCL PG 70) <H-FLIP =1,V FLIP =1>
A-3
```

<!-- book1 p199 -->

```
SNESDEVELOPMENTMANUAL
H-POSITION (9-BIT)(RANGE-256~255)
OBJECT DISPLAY
V-POSITION (8-BIT)
ORIGINAL POSITION (0, 0)
(RANGE 0~255)
OBJ
DISPLAY AREA
H-POSITION
-256 ~-1(100H~1FFH) 0~255(000H~0FFH)
(NOTE-1) The H-position is a complementary expression of 2 (9-bit).
(NOTE-2)Thecoordinate of the OBJ displayed is shifted down compared to the coordinate
must becounted asOBJquantitydisplayed even if it isnotdisplayedonthe
screen.)
OBJECT CHARACTER DATA CONSTRUCTION (VRAM)
00 01 02 03 04 05 06 07 08 309 OF
10 CHARACTERNAME(8X8SIZE) EXAMPLE
① Write 33 to“NAME"of
20
the OAM
30 ②Write"001"(Size8or32)
to"OBJ SIZE SELECT"
33 34 35 36
of register<2101H>
40
43 44 45 46
32-DOT ③ Write “1" (Size 32 x 32) to
50 53 54 55 56
"SIZELARGE/SMALL"
of the OAM (Refer to
60 63 64 65 66
page A-3)
70
32 DOT
80
1F0 1FF
Incasethecharactercodeis000 through0FF,theV-RAMaddresspercharacterdata(16-word)
will be"n (Name Base Address) + N (Name) x 16~n + N x 16 + 15."If the character code is 100
through 1FF, it will be “n + Ns (Name Select) x 4K + N x 16 ~ n + Ns x 4K + N x 16 + 15."
(NCL PG 71)
A-4
```

<!-- book1 p200 -->

```
PPUREGISTERS
OBJECT
# OF CELLS DISPLAYED 128
CELL SIZE 8X8 16X16 32X32 64X64
32-pcs (converted to 8x8 size)
#OF LINES DISPLAYED
#OF CELL-COLOR 16
#OF PALETTE 8
#OFCOLOR ON SCREEN 128
H-FLIP,V-FLIP FUNCTION
DISPLAYPRIORITY
ATTRIBUTE (Select priority against BG)
BG
#OF #OF
SCREENS #OF 1# OF COLORS
DIS- CELL CELL #OF PER
MODE PLAYED SCREEN DOT COLORPALETTESSCREEN FUNCTION
BG1 8X8 4 8 32 ①② ③
BG2 4 8 32 ④② ③
0 MAX 4 OR
BG3 4 8 32 ①2③
BG4 16X16 4 8 32 ①②③
BG1 16 8 128 ①② ③
1 MAX3 BG2 16 8 128 ①②③
BG3 4 8 32 ①②③
BG1 16 8 128 ③ ? 7
2 MAX2
BG2 16 8 128 ①②③ ? ⑧
BG1 256 1 256 ①② ③ ⑧ 90
3 MAX2
BG2 16 8 128 ①②③
BG1 256 1 256 ③ ⑧
4 MAX2
BG2 4 8 32 ①②③ ? ?
BG1 16 8 128 ② ?
5 MAX2
BG2 4 8 32
6 1 BG1 16 8 128 ③
16X8 ② ⑧
7 1 BG1 8X8 256 1 256 5
EXTBG 1 BG2 8X8 128 1 128
(NCL PG 72)
A-5
```

<!-- book1 p201 -->

```
SNESDEVELOPMENTMANUAL
[MainFunction of BG]
1. HV Scroll (each screen)
2. HV Flip (each character)
3. Mosaic (Refer to Chapter 4)
4. Rotate, Enlarge, Reduce (Refer to Chapter 5)
5. Window Mask (Refer to Chapter 6)
6. Screen Addition and Subtraction (Refer to 7.1)
7. Fixed Color Addition and Subtraction (Refer to 7.2)
8. Color Window (Refer to 7.2)
9. CG Direct Select (Refer to Chapter 8)
10. Horizontal Pseudo 512 (Refer to Chapter 9)
11. Offset Change (Refer to Chapter 12)
12. Horizontal 512 Mode (Refer toChapter 19)
[Other Function]
Priority (each character/mode 0 ~ 6)
Screen HV Rotate (mode 7)
(NCL PG 72)
A-6
```

<!-- book1 p202 -->

```
PPUREGISTERS
MOSAIC SCREEN
In case of H-256 In case of H-512
16 DOT 32 DOT
Designated the size
by"MOSAICSIZE"of
register<2106H>
4DOT 8DOT
3 DOT 6 DOT
2DOT 4 DOT
DOT 2DOT
BAＳIＣ
BAＳIＣ
070
COLOＲ
R
*All dots of the size designated become In case of theH-Pseudo512 mode,
this color. 2 x 2-dot mosaic canbemade in size-0.
(Refer to page A-3)
MOSAICSCREENDISPLAYEXAMPLE(BGSCREEN)
(When the mosaic size is 2 x 2-dot in the 256-mode)
256 DOT
① 1 ③ 3 7 5
1 1 3 3 7 7 5 5
? 6 ? 2
6 6 2 2
5 5
224 5 5
D
④ 4
4 4
①isthebasiccolor data
(NCL PG 73)
A-7
```

<!-- book1 p203 -->

```
SNESDEVELOPMENTMANUAL
ADDRESS INCREMENT ORDER
JNCREMENT by 8,(32-TIMES) INCREMENT by 8, (64-TImES) INCREMENT by 8, (128-TIMES)
V-RAM (G0 = 1, G1 =0) (G0 = 0, G1 = 1) (G0 = 1, G1 = 1)
ADDRESS
XX00 0 00XX XX00 0 X000 XX00 0 X000
XX01 32 XX20 XX01 64 X040 XX01 128 X080
·
·
·
·
XX08 1 XX01 XX08 1 X001 XX08 1 X001
60XX 33 XX21 60XX S9 X041 60XX 129 X081
XX10 2 XX02 XX10 2 X002 XX10 2 X002
XX11 34 XX22 XX11 66 X042 XX11 130 X082
XXF8 31 XX1F X1F8 63 X03F X3F8 127 X07F
XXF9 63 XX3F X1F9 127 X07F X3F9 255 XOFF
·
V-RAM
ADDRESS
V-RAM addressisincreasedby8for32-times
(        
(NCL PG 74)
A-8
```

<!-- book1 p204 -->

```
PPUREGISTERS
000H 001H 002H 003H 01DH 01EH 01FH
020H 021H 022H 03EH 03FH
040H 041H 05FH
224
SC Data
Dots
(Name)
340H 35FH
360H 361H 37DH 37EH 37FH
aei aui ui patsuoap se g ~ o apon bg buunp as s! (en) eep os uaum
of register <2115H>.
2 Bit/Dot (G0 = 1, G1 = 0)
> Access Order (1 Frame is 8 - bit x 2)
0 1 2 29 30 31
32 63
4 Bit/Dot (G0 = 0, G1 = 1)
(1 Frame is 8 - bit x 4)
0,1 2,3 4.5 58,59 60,61 62,63
64,65 126,127
8 Bit/Dot (G0 = 1, G1 = 1)
(1 Frame is 8 - bit x 8)
0~3 4~7 8~11 116~119120~123124~127
128~131 252~255
(NCL PG 74a)
A-9
```

<!-- book1 p205 -->

```
SNESDEVELOPMENTMANUAL
BG SC DATA (MODE 0 ~ 6)
D15 D14 D13 D12 D11 D10 D9 D8 D7 D6 D5 D4 D3 D2 D1 DO
FLIP BG COLOR NAME (000H~3FFH)
V H Pri. 2 1 9 8 7|6|5|4|312|1
CHARACTER CODE
NUMBER
COLORPALETTESELECT:Palettedesignationpercharacter
<8-Palettes>
BG1 ~ BG4 are combined on the same screen.
H/V FLIP: X-Directional Flip (H-FLIP), Y-Directional Flip (V-FLIP)
BGSCREENH/VSCROLL RANGEOFH-SCROLL
0～1023DOT
REGISTER<210DH><210FH>
RANGE OF V-SCROLL
<2111H> <2113H>
0 ~ 1023 DOT
H/Vscroll range may be changed and 2-dot scroll
98
maybepossible,depending onthecombination of
the modes (512,16-size,interlace,etc.).Also,SC
BGH-OFFSET
size may be changed against the screen.(Page A-21
7|61514|31211|0
and A-22)
REGISTER<210EH><2110H>
<2112H><2114H>
SCO SC1
9 8
BGV-OFFSET
7]6|514131211]0
BG OBJ
2２4
0
L-
NE
OISPLAYARE
（23g
SC2 SC3
L-
ZW
224 223 V coordinate of BG and OBJ has one - line gap.
(239) (238)
COORDINATE
(NCL PG 75)
A-10
```

<!-- book1 p206 -->

```
PPUREGISTERS
BG SC DATA (MODE 7)
D15 D14 D13 D12D11D10 D9 D8 D7 D6 D5 D4 D3 D2 D1 DO
CHARACTERDATA NAME (O0H~FFH)
7 6 5|4131２1１| 71615141312|11
<V-RAM>
WORD D15 D8 D7 Do 32-CHRX4-SCREENX8-DOT/CHR=1024-DOT
CHARACTER DATA SCDATA 32CHR
3
2 1K
256-CHRx8-DOT 32-CHRX32-CHR
1024 BYTE
X8-DOT X16AREA
CHR
SCREEN
DOT
16K-BYTE 16K-BYTE
16K
RANGEOFH-SCROLL:-4096~4095DOT
RANGEOFV-SCROLL:-4096~4095DOT
32K
In,case of EXTBG mode, D15 willbe BG order(Display Priority Order).
DATA FORMAT
FORA
CHARACTER
d15
d14
d13
d12
d11
d10
d9
d8
m m+1m+2m+3m+4m+5m+6m+7
m+8 "m" is the multiple of 64
m+16
V-RAm addressfor a character
m+24
data(64-byte) is as follows
m+32
Nx64~Nx64+63
m+40
(N: NAME)
m+48
EXTBG MODE
m+56
D15 D14 D13 D12D11 D10 D9 D8
Priority Equivalent toCGAddress
Order
6 5
(NCL PG 76)
A-11
```

<!-- book1 p207 -->

```
SNESDEVELOPMENTMANUAL
CHR DATA CONSTRUCTION
<8-BIT/DOT>
Address which data is stored
n=Name Base Address
d8
d15d14d13d12d11 d1d d9 d8
ido
d8
d8
do
p d6 d5 d4 d3 d2 d1 do d8
d8
dor
do d8
d8
d15d14d13d12d11 d10 d9 d8
Op d8
d8
d8 'oP
do
d7 d6 d5 d4 d3 d2 d1 do
8p
d8
do
do d8
d8
d15d14d13d12 d11 d10 d9 d8 Op
do d8
d8
8p op
do
d6 d5 d4 d3 d2 d1 do d8
d8 do
n+1 do
d6 d5 d4 d3 d2 d1 do d8
8p
n+2 do
d7 d5 d4 d3 d2 do d8 V-RAM address for a CHR data
d6 d1
d8
n+3 do (32word)isasfollows:
dz d6 d5 d4 d3 d2 d1 do
d8 n+N(Name)x 32~n+Nx32+31
n+4 op
d6 d5 d4 d3 d2 d1 do
d8 12d11d10d9d8
g+u
d6 d5 d4 d3 d2 d1 do
d8
n+6
d6 d3 d2 d1 do
n+7
2
d15d14d13d12d11d10 d9 d8
<4-BIT/DOT> d8
d0
d7 d6 d5 d4 d3 d2 d1 do
d8
+U do
d7 d6 d5 d4 d3 d2 d1 do
d8
n+2 Op
d7 d6 d5 d4 d3 d2 d1 do
d8
n+3 do
d6 d5 d4 d3 d2 d1 do
d8
n+4 id0
d7 d6 d5 d4 d3 d2 d1 do
d8
n+5
d7 d6 d5 d4 d3 d2 d1 do
d8
9+u
d7 d6 d5 d4 d3 d2 d1 do
V-RAM address for a CHR data
n+7
d7 d6 d5 d4 d3 d2 d1 do (16 word) is as follows:
n+N(Name)x16~n+Nx16+15
d15 d13 d12 d11 d10 6p d8
d8
<2-BIT/DOT>
d7 d6 d5 d4 d3 d2 d1 do
d8
n+1
d7 d6 d5 d4 d3 d2 d1 do
8P
n+2
Z d6 d5 d4 d3 d2 d1 do
d7
d8
n+3
Z
d7 d6 d5 d4 d3 d2 d1 do
d8
n+4
Z d3 d2 d1
d7 d4 op
d8
s+u
Z
d7 d4 d3 d2 d1 do
d8
9+u
Z
d6 d4 d3 d2 d1 do
V-RAM address for a CHR data
n+7
d4 d3 d2 d1 do (8 word) is as follows:
n+N(Name)x8~n+Nx8+7
(NCL PG 77)
A-12
```

<!-- book1 p208 -->

```
PPUREGISTERS
OFFSET CHANGE MODE
The offset change mode can be used in the BG mode 2, 4 and 6, and the following data is
required in this mode.
d15 d14 d13 d12 d11 d10 6p d8 d7 9p SP tp d3 d2 d1 op
H BG2 BG1
OFFSETDATA
V EN EN
H, V OFFSET VALUE (in
the change mode)
In case of the H-OFFSET, the data (D0 ~ D2) will be invalid.
In case of the character (16 x 16),“D3" is effective every 3rd.
OFFSETMODEENABLE 0: Disable
-1:Enable
Designate either H-OFFSET or V-OFFSET for the OFFSET data dO ~ d9.(Only BG MODE
4 is effective.)
0: H-OFFSET
1 :V-OFFSET
Write this data to VRAM of address designated at (1) and (2), using the BG Mode.
(See below.)
<MODE 2,6> <MODE 4>
(1)+(2)+0 H-OFFSET 1 (1)+(2)+0
OFFSET 1
(1)+(2)+1 OFFSET 2
●
-
(1)+(2)+1F H-OFFSET32
(1)+(2)+20 V-OFFSET1 (1)+(2)+1F
OFFSET32
In case BG3SC size is S1=0,S0=0
0 p, ~ p, Aa es anal) ssapp aseg s ea :(t)
<2109H>]x1024)
(1)+(2)+3F V-OFFSET32 (2): BG3 SC Offset Address ([value set by "d3"~ "d7" of 
([<H1L1> 10 P, ~ 8p, Aq las ane]) + (Zex[<HZ112>
-OEESET1
8 DOT
(OFFSEF 1) YOPFsEF522
DISPLAY AREA
32 CHARACTERS
The offset value can be changed by each column (character unit).
(Upto3rdcharactercanbeseenhorizontallyonthescreenbysettingtheoffsetvalueof
theentire screen,but the offset can not be changed for 1st character (0 character).
(NCL PG 78)
A-13
```

<!-- book1 p209 -->

```
SNESDEVELOPMENTMANUAL
BG SCREEN (BG Mode 0 ~ 6)
32 CHR
When SC size is “0""
ORIGINAL
POSITION
n+000Hn+001H|n+002Hn+003H n+01DH|n+01EH|n+01FH
n+020Hn+021Hn+022H n+023H n+03DHn+03EH n+03FH
n+040Hn+041H|n+042H n+05EH n+05FH
n+060Hn+061H VRAM Address
3２
SCO
H
R
n+3A0Hn+3A1H n+3BEHn+3BFH
n+3C0Hn+3C1Hn+3C2H n+3DDH|n+3DEHl n+3DFH
n+3E0HIn+3E1Hn+3E2H n+3FDHn+3FEH n+3FFH
(n = SC Base Address (6-bit) x 400H)
· When SC size is “f" ·When SC size is “2" ·When SC size is “3"
H000+U n+400H n+00OH n+400H
n+3FFH
n+7FFH
SCO SC1 n+000H SCO SCO SCO
n+800H
n+3FFH
n+C0OH
n+3FFH n+7FFH
n+400H SC1 SC1 SC1
n+7FFH n+BFFH n+FFFH
(NCL PG 79)
A-14
```

<!-- book1 p210 -->

```
PPUREGISTERS
BG Screen (BG Mode 7)
ScreenSizeandAreaareFixed
128 CHR
·When SC size is “0"
ORIGINAL
POSITION
0000H 0001H 0002H 0003H 007DH 007EH007FH
0080H 0081H 0082H 0083H 00FDH 00FEH 00FFH
0100H 0101H 0102H 017EH 017FH
0180H 0181H VRAMAddress
１２８ＣHＲ
3E80H|3E81H 3EFEH 3EFFH
3F00H 3F01H 3F02H 3F7DH 3F7EH 3F7FH
3F80H 3F81H 3F82H 3FFDH 3FFEH 3FFFH
(NCL PG 79a)
A-15
```

<!-- book1 p211 -->

```
SNESDEVELOPMENTMANUAL
OPERATION(ROTATION/ENLARGEMENT/REDUCTION)
1024 DOT (128 CHR)
V-POSITION
H-POSITION V-COUNTER
024
(X 1, Y 1)
DOT
H-COUNTER
（128
OIR
(X 2, Y 2)
(Xo, Y o)
ROTATIONALTRANSFORMFORMULA
cosYsinY
-siny cos
X1·Y 1: Display Coordinate
Xo·Yo: Center Coordinate
X 2·Y2:Coordinate beforecalculation of displaycoordinate
If the reduction rates for X-dir (a) and the reduction rates for Y-dir (β) are considered, the formula
described abovewillbeasfollows:
A=cos Y x (1/a), B=sin Y x (1/a),
C=-sinY x (1/ β), D=cos x(1/ β),
(NCL PG 80)
A-16
```

<!-- book1 p212 -->

```
PPUREGISTERS
CG-RAM
<MODE-0> <MODE-1 & 2>
D15 DO
00 BG1 BG3(MODE-1)
4-COLORS 4-COLORS
X 8-PALETTES X8-PALETTES
20 <MODE-1>
BG2 · 4-Screens for BG
·3-Screens for BG
4-COLORS
V. BG 1,2
X8-PALETTES
40 ·BG1 & 2 color data are
BG3
held in common in the
4-COLORS 16-COLORS
20 Color Data range of 0~7F
X 8-PALETTES x8-PALETTES
60 21 Color Data
BG4 >Pallete0
22 Color Data
4-COLORS
X8-PALETTES 23 Color Data
80
24 Color Data
-Pallete 1
OBJ OBJ <MODE-2>
2-Screens for BG
1
16-COLORS 16-COLORS
3E ColorData
x 8-PALETTES Pallete 7
x8-PALETTES ·BG1&2colordataare
3F Color Data
40 held in common in the
Color  Data
-Pallete0
range of 0~7F
FF
<MODE-5&6> <MODE-3,4&7> <MODE-3>
D15 DO D15 DO
00 ·2-Screens for BG
BG2 (MODE-5) BG2 (MODE-4)
4-COLORS 4-COLORS
<MODE-5> ·BG2 color data areheld in
X8-PALETTES
20 X8-PALETTES common in the range of
·2-Screens for BG
0 ~ 7F
(CG Direct select is excluded)
BG1 ·BG1&2color dataare BG 2(MODE-3)
40 held in common in the
<MODE-4>
range of 0 ~ 1F
16-COLORS 16-COLORS
2-ScreensforBG
60 X8-PALETTES X 8-PALETTES
·BG2 color data are in
common in the range of
<MODE-6> BG1
80 0~1F
256-COLORS
·1-Screen for BG <MODE-7>
OBJ (CG Direct select is excluded)
·0 ~ 7F are used just for OBJ
·1-Screen for BG (CG Direct
BG1color data
selectis excluded)
16-COLORS 16-COLORS
X8-PALETTES X8-PALETTES <EXTBG ON MODE-7>
·1-Screen for BG
0~7F areused just forBG2
FF color data
*OBJ is held in common with
BG-1
CG-RAM COLOR DATA
BLUE GREEN RED
d14d13;d12d11d10 6p d8 d7 9p d5 d4 d3 d2 d1 do
DIRECTSELECT COLOR DATA
BLUE GREEN RED
DA7DA6CL2; 0 0 DA5DA4:DA3CL11 0 DA2DA1DA0CL00
thecolor.(However,incaseofMode-7,CL0~CL2shouldbe“0")
NOTE: If they are “O." it becomes transparent. The color of CG-RAM address (0oH) will be
background.
(NCL PG 81)
A-17
```

<!-- book1 p213 -->

```
SNESDEVELOPMENTMANUAL
WINDOW
REGISTER<2126H>～<2129H>
D7 DO
<2126H>WINDOWH0POSITION
<2127H>WINDOWH1POSITION
D7 DO
<2128H>WINDOWH2POSITION
<2129H>WINDOWH3POSITION
HO H2 H1 H3
The V-directional position is
determined by setting"W1 EN"
of registers<2123H><2124H>
<2125H> during the H-Blank
period or determined by set-
ting registers<2126H>~
<2129H>.
(NCL PG 82)
A-18
```

<!-- book1 p214 -->

```
PPUREGISTERS
BG&OBJPRIORITY
4-SCREEN/3-SCREEN MODE(In case Mode 0 and 1 are selected by register<2105H>)
*In case“D3=1" is selected by register <2105H> in the mode-1
(OTHERS)
Back Pri.=0 Pri.=0 Pri.=1 Pri.=1 Pri.=0 Pri.=0 Pri.=1 Pri.=1 Pri.=1
(SINGLE) BG4 BG3 BG4 BG3 BG2 BG1 BG2 BG1 BG3
REAR
ＦＲOＮT
OBJ OBJ OBJ OBJ
Pri.=0 Pri.=1 Pri.=2 Pri.=3
<Example of Display Priority (in case of mode 0)>
High Priority Low Priority
BG1 Pri.=0
BG2 Pri.=1 (FRONT) (REAR)
BG3 Pri.=0 are set BG2-OBJ-BG1-BG4-BG3-Back
BG4 Pri.=1
OBJ Pri.=2 (Display in the order above)
2-SCREEN/1-SCREEN MODE (in case Mode 2~7 is selected byregister<2105H>)
Back Pri.=0 Pri.=0 Pri.=1 Pri.-1
(Single BG2 BG1 BG2 BG1
Color)
REＡＲ
OBJ OBJ OBJ OBJ
Pri.=0 Pri.=1 Pri.=2 Pri.=3
NOTE: In case of the display priority between the OBJ's, normally the lower numbered OBJ will
be displayed as higher priority. (See page 1-20-2 for exception.)
This display priority will be determined before the priority between OBJ and BG is determined.
NOTE: In case of Mode 7, the priority is 0 atBG1.
(NCL PG 83)
A-19
```

<!-- book1 p215 -->

```
SNESDEVELOPMENTMANUAL
SCREEN
APPROX.63.5μ S
256 DOT
255
224
OR H-BLANK
239
262
DISPLAYAREA
OR
L
263
N
E
L-
NE
V-BLANK
NON-INTERLACE
According to register<2133H>
(262 LINE)
(NCL PG 84)
A-20
```

<!-- book1 p216 -->

```
PPUREGISTERS
BG SCREEN
H/V SCROLL ① (Scroll range by the combination of modes and SC size against screen)
<Example: in case SC size is"3"-referto register 2107H~210AH>
*In case of mode 0, 1, 2, 3, & 4
BG SIZE (8x8)
256DOT
32 CHR
32
1CHARACTERONTVSCREEN
256 (1 NAME)
CHR
DOT
8DOT
8
D
SC SCREEN
RANGE OF H-SCROLL: 0~511 (Scroll 1-dot to the left by adding 1)
RANGE OF V-SCROLL: 0~511 (Scroll 1-dot up by adding 1)
·BG SIZE (16 x 16)
512 DOT
RANGE OFV-SCROLL: 0~1023(Scroll 1-dot up by adding 1)
32 CHR
32
512
CHＲ
DOT
16 DOT
9
DOT
(NCL PG 85)
A-21
```

<!-- book1 p217 -->

```
SNESDEVELOPMENTMANUAL
BG SCREEN
H/V SCROLL (②) (Scroll range by the combination of modes and SC size against screen)
<Example: in case SC size is “3"- refer to register 2107H ~ 210AH>
*In case of MODE-5, MODE-6 & NON-INTERLACE
BG SIZE (8 × 8) BG SIZE (16 X 16)
512 DOT. 512DOT,
32 CHR 32 CHR
1CHARACTERONSCREEN
(1 NAME)
32
16 DOT
CHＲ
256
DOT
51
32
2
8-DOT
CHR
16 DOT
SC SCREEN
T
RANGE OF H-SCROLL: 0~511 (Scroll 2-dots to the left by 9
adding 1)
D
RANGE OF V-SCROLL: 0~511 (Scroll 1-dot up by
0
adding 1)
RANGE OF H-SCROLL: 0~511(Scroll 2-dots to the left by adding 1)
RANGE OF V-SCROLL: 0~1023 (Scroll1-dot up by adding 1)
*In case of MODE-5, MODE-6& INTERLACE
BG SIZE (8 × 8) ·BG SIZE (16X16)
512 DOT 512DOT
32 CHR 32CHR
256
16 DOT
512
D
8
2CHR
T
D DO
16 DOT
T
1
DISRLA
RANGE OF H-SCROLL: 0~511 (Scroll 2-dots to the left by 6
adding 1)
RANGE OF V-SCROLL: 0~511 (Scroll 1-dot up by D
adding 1)
RANGE OF H-SCROLL: 0~511 (Scroll 2-dots to the left by adding 1)
RANGE OF V-SCROLL: 0~1023 (Scroll 1 dot up by adding 1)
(NCL PG 86)
A-22
```

<!-- book1 p218 -->

```
PPUREGISTERS
 eep indino
(ADD/SUB) ())
(ADD or SUB Enable) Select
NOTE: 1) V - RAM, OAM, & CG - RAM is omitted.
(Sub SW) 2) () shows name of register.
Sub Switch
Control
Color Window
(Main Sw)
Main Switch
Control
Judge of Transparency
(CC ADD Enable)
Priority Logic. (Window Logic)
Cirucit Circuit
Main
qns
(Constant Color)
6
(W1 IN/OUT) (W2 IN/OUT)
Figure A-1 SNES PPU Main/Sub Screen Window (Through Main) (Through Sub)
(Through Main(window)) (mopum)qns y6nou1)
Q
1 Position)(W1 EN)
(H2 Position)(W2 EN)
5
(HO Position), (H3 Position)
GENERATESCREENDATA
A
DATA DATA
AT
D D
Window1 Window2
GGGG 3 Circuit Circuit
BBBB Q
(NCL PG 86a)
A-23
```
