# Section 2 (a) — Graphics Feature Set

> PPU/graphics feature chapters. OCR is prose-usable; tables/figures noisy.

## Contents (per the manual's own TOC)

- 2-1 Introduction (p59)
- 2-2 Object/OBJ (p61)
- 2-3 Background (p63)
- 2-4 Mosaic (p65)
- 2-5 Rotation/Enlargement/Reduction (p66)
- 2-6 Window (p68)
- 2-7 Main/Sub Screen (p69)
- 2-8 CG Direct Select (p74)
- 2-9 H-Pseudo 512 (p75)
- 2-10 Complementary Multiplication (p76)
- 2-11 H/V Counter Latch (p77)
- 2-12 Offset Change (p78)
- 2-13 Standard Controller (p79)
- 2-14 Programmable I/O (p81)
- 2-15 Abs. Multiplication/Division (p82)
- 2-16 H/V Count Timer (p83)
- 2-17 DMA (p84)
- 2-18 Interlace (p89)
- 2-19 H-512 (p90)
- 2-20 OBJ 33's Lines / Priority (p91)

## Provenance

```
Source: `snes_manual/book1.pdf` (Nintendo Super NES Development Manual, Book I),
scanned 240-page image-only PDF (no text layer). Per-page text below is produced by
RapidOCR (ONNX) at 300 DPI. **Prose is a usable baseline; hex / disassembly / tables
carry OCR noise (dropped inter-word spaces, 0/O, S/s, l/I confusion) and must be
verified against the page image before being treated as fact.** Each page is tagged
with `<!-- book1 pNNN -->` so a specific page can be re-verified and corrected.
```

## Body (pages 59–92)


<!-- book1 p059 -->

```
INTRODUCTION
Chapter 1.Introduction
The following is a brief discussion of basic concepts used to display game characters on
the home television set. Even if you have developed software for the Nintendo Entertain-
ment System (NES), please review this information.
1.1 PICTURE IMAGE GENERATION
The picture on a color television set consists of 525 horizontal lines with each line
having color information. The broadcasting station breaks the picture into lines as
shown in the figure below.
The odd numbered lines are converted to electronic signals from the top to the
bottom of the screen. The remaining even numbered lines are converted from the
top to the bottom in the same way.
This method, in which a trace is generated and displayed for every other line, is
called the 'INTERLACE" method. The electronic signal which has been transmit-
ted is converted to a light signal and will create traces on the television screen in
thesameordergenerated.
The act of tracing light on the screen is called "scanning". The period while scan-
ning the odd numbered lines is cailed the "1st field". The period while scanning the
called "one frame". During the period of one frame, the first and second fields are
displayed in sequence. Because 1/60 of a second is required to produce one field,
by the human eye and the luminescence of the CRT, the picture does not normal-
ly appear to flicker.
Figure 2-1-1
Picture Image
234567
DOTCHARACTERMAP
5
TimeSequence
(NCL PG 2)
2-1-1
```

<!-- book1 p060 -->

```
SNESDEVELOPMENTMANUAL
1.2 SUPERNESDISPLAY
The picture display on the Super Nintendo Entertainment System (Super NES)
other is a non-interlace mode, in which one frame takes 1/60th of a second. In the
non-interlace mode the same position is scanned every field. Each frame consists
compared to the interlace mode, since each point on the screen is radiated every
1/60th of a second.
1.3 BLANKING
The screen is scanned from left to the right and from top to bottom (see Figure 1-
1-2). After scanning the screen from left to right, horizontal blanking occurs to pre-
vent the electron beam from being seen as it returns to the left side of the screen.
When the beam reaches the bottom right hand side of the screen, vertical blank-
ing occurs to allow the beam to reposition at the top left of the screen without be-
ing seen. The NES and the Super NES use this blanking efficiently to display the
variousmovementsofcharacters.
a
V-Scanning
a
1st Field (Odd) 2nd Field (Even)
H-Scanning
Figure 2-1-2- Scanning Pattern for Interlace
(NCL PG 3)
2-1-2
```

<!-- book1 p061 -->

```
OBJECT
Chapter 2. Object(oBJ)
2.1 OUTLINE
This function can display an object in a certain position on the screen. The charac-
ters, such as the UFO or the missile of a space game, look like they are moving. lf
the character's picture is replaced at the same time the point is moved, animation
effects can occur (such as "Mario" character looking like he is walking).
2.2 FUNCTION
The maximum number of OBJ's that can be displayed on the screen is 128 and
selected for each OBJ. There are 8 color pallets for OBJ's and one pallet can be
Therefore, each OBJ in the picture is drawn by 16 colors. Each of the 128 objects
that may be displayed on the screen at one time has its own priority order, which
will decide the display priority if 2 or more OBJ's are overlapped. In addition, there
-od, ee pue ,epo Aod bo, .'srh-al, pue 'umop-dn, jo uooun, dig eu s!
ity Order" shifting function.
(NCL PG 4)
2-2-1
```

<!-- book1 p062 -->

```
SNESDEVELOPMENTMANUAL
2.3 SETTING EXAMPLE
INITIAL SETTINGS
·Clear each register
· Set register <2101H>
OBJ Size Select
SETTINGS
OBJ Name Select
OBJ Name Base Address
· Set D1 of register <2133H>
"OBJV Select"Settings
·Set D4 of register<212CH>
"Through Main OBJ" Settings
FORCED BLANK
· Set register <2115H>
V-RAM Address Sequence Mode
SETTINGS
H/L INC
·Setregister<2116H>~<2119H>
SETTINGS
V-RAM Address
V-RAM Data
(Transfer OBJ character data to VRAM by DMA)
·Set register<2121H>,<2122H>
SETTINGS
CG RAM Address
CG RAM Data
(Transfer OBJ color data to CG {Color Generator) by
DMA)
V-BLANK
· Set register <2102H>~<2104H>
OAM Address
SETTINGS
OAM Priority Rotation
OAM Data
(Transfer OBJ data toOAM byDMA)
DISPLAY
CAUTION: It is prohibited to write “100H" to the “OAM H-position (9-bit)
(Refer to page A-4)
(NCL PG 5)
2-2-2
```

<!-- book1 p063 -->

```
BACKGROUND
Chapter 3. Background (BG)
3.1 OUTLINE
The background for OBJ, such as Mario, can be displayed on the screen and
scrolled up, down, left or right. This helps the game effect.
3.2 FUNCTION
There are 8 kinds of BG mode. In BG mode 0 thru 6, there is a difference depend-
ing on the combination of numbers of screens, the numbers of the cell color, the
resolution and the offset function. There are 4 screens provided and the number
of the cell colors are 4 to 256. There are 3 kinds of the resolution selected from
256-dot x 224-dot, 512-dot x 224-dot,or 512-dot x 448-dot.The character size
can be set “8-dot x 8-dot"or "16-dot x 16-dot"on each screen.
The offset value (scroll coordinate) can be set on each BG screen and the offset
that the vertical partial scroll can be made. Eight pallets can be used per charac-
ter, and H-Flip or V-Flip is available per character. Also, the priority order of BG
and OBJ can be changed per character. (Refer to page A-19)
Mode-7 is a screen, which can rotate, enlarge or reduce. There are other func-
tions for BG, such as mosaic, window, fixed color addition/subtraction, screen ad-
dition/subtraction,and H-Pseudo 512.
(NCL PG 6)
2-3-1
```

<!-- book1 p064 -->

```
SNESDEVELOPMENTMANUAL
3.3S SETTING EXAMPLE
INITIAL SETTINGS
· Clear each register
·Set register <2105H>
BG Mode
BG Size SETTINGS
· Set register <2107H> ~ 210AH>
SC Size
SC Base Address
SETTINGS
· Set register <210BH>, <210CH>
Set Name Base Address
. Set“D0~ D3"of register <212CH> *
Set Through Main BG
FORCEDBLANK
· Set register <2115H>
V-RAM Address Sequence Mode
H/L INC SETTINGS
·Setregister<2116H>~<2119H>
V-RAMAddress
V-RAM Data SETTINGS
(TransferBG-SCdata&BGcharacterdata toVRAMby
DMA)
· Set register <2121H>,<2122H>
CG RAM Address
SETTINGS
CG RAM Data
(TransferBGcolordata toCG{color generator} byDMA)
V-BLANK
·Setregister<210DH>~<2114H>
Set BG H/V Offset
DISPLAY
In case of BGMODE5or6,“Through SubBG"ofregister<212DH>
shouldalsobeset
(NCL PG 7)
2-3-2
```

<!-- book1 p065 -->

```
MOSAIC
Chapter 4. Mosaic
4.1 OUTLINE
off a picture (refer to page A-7).
4.2 FUNCTION
A picture element of mosaic design can be changed to 15 sizes and a mosaic de-
sign can be selected for BG screen.
4.3 SETTING EXAMPLE
INITIALSETTINGS
.Enable BG to display(SeeBG Instruction).
V-BLANK
·Set register <2106H>
Mosaic Size
SETTINGS
MosaicEnable
DISPLAY
(NCL PG 8)
2-4-1
```

<!-- book1 p066 -->

```
SNESDEVELOPMENTMANUAL
Chapter 5. Rotation/Enlargement/Reduction
5.1 OUTLINE
In the BG Mode-7 function, more animation effects, are available to the screen
through rotation, enlargement or reduction, and a scroll function.
5.2 FUNCTION
5.2.1 TYPE 1
There are 256 character numbers (8-dot x 8-dot size). Each dot can be one
of the 256colors,from a selectionof 32,768colors.InEXTBG mode,each
dotcanbeoneof 128colorsfromaselectionof32,768colorsandeachdot
can have priority order. In this function, it is possible to scroll up, down, to
the left or right. The center coordinate of rotation, enlargement and reduc-
tion can be set at a point either outside or inside of the display area. The ro-
can be selected in order to display the excessportion:
1) the back drop color
2) a single character (CHR# 0)
3) repetition (wrap) of the screen area
5.2.2 EXTBG MODE(TYPE I1)
EXTBG mode is originally provided as a function for the purpose of the LSl
BG expand. For the Super NES, this function is used for rotation, enlarge-
ment and reduction in 128 colors with priority order..
(NCL PG 9)
2-5-1
```

<!-- book1 p067 -->

```
ROTATION/ENLARGEMENT/REDUCTION
5.3  SETTING EXAMPLE
INITIALSETTINGS
· Clear each register
· Set register <2105H>1
BG Mode - 7 Settings
· Set register <212CH>2
Through main BG settings
. Set register <211AH>
Screen Flip
SETTINGS
Screen Over
1. On EXTBG mode, EXT input of register
<2133H> needs to be set.
2. Normally, BG1 should be set, but BG 2 should be
set on EXTBG mode.
FORCED BLANK
·Set register<2115H>
V-RAM Address Sequence Mode
H/L INC SETTINGS
· Set register<2116H>~<2119H>
V-RAM Address
V-RAM Data SETTINGS
(TransferBG-SCdata toloweraddress ofV-RAMand
character data toupper address of V-RAM by DMA)
·Set register<2121H>,<2122H>
CG RAM Address
SETTINGS
CG RAM Data
(Transfer BG color data to CG {color generator} by
DMA)
V-BLANK
·Set register<210DH>,<210EH>
"BG 1 H/V Offset" Settings
·Setregister<211BH>~<211EH>
"Matrix Parameter"Settings
·Set register<211FH>,<2120H>
"Center Position"Settings
DISPLAY
(NCL PG 10)
2-5-2
```

<!-- book1 p068 -->

```
SNESDEVELOPMENTMANUAL
Chapter 6. Window (Window Mask)
6.1 OUTLINE
This function limits the display area on the TV screen for BG and OBJ. This win-
dow can be set on the TV screen. BG and OBJ can be displayed inside or outside
of this area.
6.2 FUNCTION
There are 2 windows. Each window can affect either the BG screen or OBJ and
can be either internal or external masked. Four types of window mask logic (OR,
AND, XOR and NXOR) can be selected for each BG and OBJ, using 2 kinds of
windows simultaneously (refer to "Mask Logic Settings for Window 1 & 2" under
"PPU Registers"). If this function is combined with the function of H-DMA, various
shapes of the window will be formed, such as; a round shape, heart shape, or star
shape. It is also possible to use this function combined with the screen addition/
subtraction and fixed color addition functions.
6.3 SETTING EXAMPLE
INITIALSETTINGS
·Clear each register
·EnableBG todisplay (SeeBG Instruction)
·Set register<2123H>~<2125H>
"BG,OBJ,ColorWindow"Settings
·Set register<2126H>~<2129H>
"Window Position"Settings
·Setregister<212AH>~<212BH>
"Window Logic"Settings
·Set register<212EH>,<212FH>
"Through MAIN (Window)" Settings
"Through SUB (Window)"Settings
V-BLANK
· Set H-DMA etc.
DISPLAY
(NCL PG 11)
2-6-1
```

<!-- book1 p069 -->

```
MAIN/SUBSCREEN
Chapter 7. Main/Sub Screen
When displaying several BG and OBJ screens, the picture to be displayed in the over-
lapped portion is decided by two paths. One of them is called the main screen and the
other is called the sub screen. The screen to be used for the main and sub screens can
be selected by registers <212CH> and <212DH>. Furthermore, the data for the main and
sub screens to be displayed is made according to the priority order. Unless the addition/
subtraction screen is done as follows, the “Main Sw" of the “Color Window" in register
<2130H> is normally on, and the "Sub Sw" is normally off so that only the main screen is
displayed(seepage A-23).
<212CH>
MAIN
BG SCREEN MAIN
SCREEN
OBJ SCREEN
R SCREEN
DATA
SELECT DATA
SUB
SCREEN SUB
R SCREEN
SELECT
DATA
<212DH>
(NCL PG 12)
2-7-1
```

<!-- book1 p070 -->

```
SNESDEVELOPMENTMANUAL
7.1 SCREEN ADDITION/SUBTRACTION
7.1.1 OUTLINE
This function is the addition (Overlapping Light) or the subtraction (Lens
Filter) for the main screen and the sub screen in order to have the effect of
transparency.
7.1.2FUNCTION
This function displays the result after the addition or subtraction of RGB
screen or OBJ data on the main screen to be added to or subtracted from
the sub screen, similar to the figure below. However, when there is no
screen data on the sub screen (screen is clear), the color constant ex-
plained on page 1-7-4 will be added or subtracted.
When the result of addition or subtraction exceeds 31, the value becomes
31. When the result of addition or subtraction is less than 0, the value be
comes 0.
Please do not use this function on BG mode 5 or 6.
MAINSCREEN
ADDITION/SUBTRACTION
DATA
SELECT
SUB SCREEN ADDER-SUBTRACTER DISPLAY
DATA
(NCL PG 13)
2-7-2
```

<!-- book1 p071 -->

```
MAIN/SUBSCREEN
7.1.3 SETTING EXAMPLE
INITIAL SETTINGS
· Clear each register
·EnableBG to display(seeBG instruction)
·Enable OBJ to display (see OBJ instruction)
·SetD1ofregister<2130H>
"CCADDEnable"Settings
·Set register<2131H>
ADDor SUB Enable
1/2 Enable
SETTINGS
ADD/SUB
·Set register<212CH>
"Through Main" Settings
·Set register<212DH>
"Through Sub" Settings
DISPLAY
NOTE:When the main screen data is the OBJ, it will be added to or
subtracted from thesubscreendata onlyfortheOBJof thepallet
code (4 to 7).
subtractionresultofeachRGBbecomes1/2.
(NCL PG 14)
2-7-3
```

<!-- book1 p072 -->

```
SNESDEVELOPMENTMANUAL
7.2 COLOR CONSTANT ADDITION/SUBTRACTION
7.2.1 OUTLINE
ter) with RGB value (coior constant) set by the main screen and register
<2132H>. This will change the color on the display area.
7.2.2 FUNCTION
This function can perform addition/subtraction by using the RGB value (col-
or constant) which is set by register <2132H> instead of the sub screen of
the addition/subtraction screen described previously.
7.2.3SETTING EXAMPLE
INITIAL SETTINGS
· Clear each register
·EnableBG to display (seeBG Manual).
·Clear D1 of register <2130H>
"CC ADD Enable"Settings
· Set register <2131H>
ADD or SUB Enable
 SETTINGS
1/2Enable
ADD/SUB
.Setregister<2132H>
"Color Constant Data" Settings
DISPLAY
(NCL PG 15)
2-7-4
```

<!-- book1 p073 -->

```
MAIN/SUBSCREEN
7.3 COLOR WINDoW (Combination of Window & Addition/
Subtraction)
7.3.1 OUTLINE
The Screen Addition/Subtraction or the Color Constant Addition/Subtrac-
tion can be performed inside or outside the window (only one or the other).
7.3.2 FUNCTION
This function can select what portion of the window should be displayed
and added or subtracted on each main screen and sub screen. The follow-
ing is the function of window, the screen addition/subtraction and the color
constant addition/subtraction.
7.3.3 SETTING EXAMPLE
INITIALSETTINGS
· Clear each register
·EnableBG todisplay(SeeBGManual)
·EnableOBJ to display (SeeOBJ Manual)
·Set register <212EH>,<212FH>
Through Main (Window) 
SETTINGS
Through Sub (Window)
· Set register <2125H>
Set Color Window
·Setregister<2126H>~<2129H>
Set Window Position
·Setregister<212AH>,<212BH>
Set Window Logic
· Set register <2130H>
Color Window ON/OFF settings
·Set register<2131H>
ADDorSUB Enable
1/2 Enable
SETTINGS
ADD/SUB
·Set register <2132H>
Color Constant Data setings
V-BLANK
·Set H-DMA etc.
DISPLAY
(NCL PG 16)
2-7-5
```

<!-- book1 p074 -->

```
SNESDEVELOPMENTMANUAL
Chapter 8. CG Direct Select
8.1 OUTLINE
On BG-1 in Mode 3, 4 and 7, the character data can be used as the color data
Mode 3 and 4, and 256 fixed colors on Mode 7. BG-2 and OBJ can use the CG-
RAM color data without being limited to the color data on BG-1,
8.2 FUNCTION
When BG-1 on Mode 3, 4 and 7 is displayed on the TV screen, this function wil!
display 8-bit color data per character dot without using the CG-RAM. The CG-
RAM data is used for the objects and other background screens.
8.3 SETTING EXAMPLE
·EnableBG todisplay (SeeBGInstruction)
·Set "D0"of register <2130H>
"Direct Select"Settings
NOTE: See page A-17 for color data.
(NCL PG 17)
2-8-1
```

<!-- book1 p075 -->

```
H-PSEUDO512
Chapter 9. H-Pseudo 512
9.1 OUTLINE
In modes other than 5 and 6, this function provides gradation between 2 dots
which are next to each other horizontally, which changes the color smoothly.
9.2 FUNCTION
This function utilizes screen addition/subtraction. The color constant addition/sub-
traction can not be done at the same time that this function is performed.
9.3 SETTING EXAMPLE
·Enable BG to display (seeBG instruction)
· Set "D3"of register <2133H>
“Pseudo 512"settings
· Set register<212CH>,<212DH>
Through Main
Through Sub SETTINGS
· Set D1 of register <2130H>
"CC ADD Enable"settings
·Set register <2131H>
ADDor SUB Enable
1/2 Enable
SETTINGS
ADD/SUB
(NCL PG 18)
2-9-1
```

<!-- book1 p076 -->

```
SNESDEVELOPMENTMANUAL
Chapter 10. Complementary Multiplication (Signed
Multiplication)
10.1 OUTLINE
The 2's complement multiplication will be performed with high speed. For exam-
ple, to calculate the rotation parameter in mode 7, it will lighten the burden of the
CPU processing.
10.2 FUNCTION
The high speed multiplication of 16-bit (2's complement) and 8-bit (2's comple-
ment) will be performed with "no-wait," and the result becomes 24-bit (2's comple-
ment).
10.3 SETTING EXAMPLE
·SetBGother than MODE-7(orV-Blank/ForcedBlank)
(Except during V-Blank or Forced Blank period)
·Write lower 8-Bit (Multiplicand) to register <211BH>: (Input)
·Write higher 8-Bit (Multiplicand) to register<211BH>:( (Input)
· Write register 8-Bit (Multiplier) to register <211CH>: (1nput)
· Read register <2134H> ~ <2136H>: (Result)
(NCL PG 19)
2-10-1
```

<!-- book1 p077 -->

```
H/VCOUNTERLATCH
Chapter 11.  H/V Counter Latch
11.1 OUTLINE
This function is used for synchronization of process timing by tracking the scan-
ning beam on the screen.
11.2 FUNCTION
This function sets the vertical and horizontal counter value (when register
<2137H> is read) and tracks the raster beam on the screen by reading the regis-
ter value. (The scanning is synchronized with an internal vertical and horizontal
counter.)
11.3 SETTING EXAMPLE
· Read register <2137H>: (counter latch)
·Read register<213FH>
(Initialize register <213CH>,<213DH> in the order of Low and High)
·Read register<213CH>,<213DH>
(NCL PG 20)
2-11-1
```

<!-- book1 p078 -->

```
SNESDEVELOPMENTMANUAL
Chapter 12. Offset Change
12.1 OUTLINE
The horizontal and vertical scroll (offset) value can be performed every horizontal
8-dot (character unit) in mode 2, 4, and 6. The other part of the screen can be
brought into the middle of the frame in order to have the effect of a window. A par-
tial vertical scroll canalsobe made.
12.2 FUNCTION
This function can be used in any of the three ways, listed below.
· Affect BG-1 only
Affect BG-2 only
Affect both BG-1 and BG-2
The offset for both H and V can be changed at every character unit on mode 2
and 6, but the offset for either H or V (only one or the other) can be changed on
mode 4. The same offset will be performed on each line once the offset data for a
horizontal line (32 characters) is set. To change the setting of the other offset val-
ue, depending on the scanning line, change "BG-3 SC Offset Address"or "BG-3
SCBaseAddress"during theH-DMAperiod.
12.3 SETTING EXAMPLE
INITIAL SETTINGS
·Clear each register
·EnableBG todisplay(seeBG instruction)
Set OFFSET data to BG-3 SC
V-BLANK
·Set H-DMA etc.
DISPLAY
(NCL PG 21)
2-12-1
```

<!-- book1 p079 -->

```
STANDARDCONTROLLER
Chapter 13. Standard Controller
13.1 OUTLINE
The switch status of the standard controller can be read automatically in serial or-
der and will be converted to parallel data.
13.2 FUNCTION
Two standard controllers can be connected to the Super NES. Four standard con-
trollers may be connected by using an expanded connector, such as MuitiPlayer 5
(refer to "Accessories"). Single bit data is assigned to each switch. Up to 16 bits
be read 1 bit at a time by the software, as for the NES. The hardware reads the
data for about 215 μs after the V Blank flag is set or NMl is applied. During this
215 (214.55) μs is equivalent to 3.4 (3.38) scanning lines; a period of 580
(576) bytes to be transferred by DMA. (lf the CPU clock is 2.68 MHz, it is
equivalent to 580 machine cycles.) As soon as V-Blank starts, normal flow
is to perform general purpose DMA. Therefore, it is convenient if the total 
number of bytes to be transferred by general purpose DMA is used for read
timing. (Please refer to the System Flowchart.)
The standard controller data (register) should be read after confirming that
"JOY-C Enable" of register <4212H> is not set during the V-Blank period,
so that valid data can be read.
After the 18 μs (48 machine cycles with 2.68 MHz) from the beginning of V-
Blank, the hardware will start to read. "Standard CNTRL Enable"of register
<4212H> cannot be set during this period.
(NCL. PG 22)
2-13-1
```

<!-- book1 p080 -->

```
SNESDEVELOPMENTMANUAL
13.3 SETTING EXAMPLE
INITIAL SETTINGS
·Set"1"to“D0"of register<4200H>
"Standard CNTRLEnable"Settings
·Set "0"to “D0"of register <4016H>
V-BLANK
· Process for DMA (215 μs or more)
·Read register<4218H>～<421FH>
·Read register<4016H>&<4017H>
(lf expanded bits exist)
DISPLAY
(NCL PG 23)
2-13-2
```

<!-- book1 p081 -->

```
PROGRAMMABLEI/OPORT
Chapter 14. Programmable I/O Port
14.1 OUTLINE
An 8 bit programmable I/O port is provided for interface to peripheral devices,
such as; a keyboard, the 3D glass, etc.
14.2 HOW TO USE
A "1" should be written to register <4201H> for the bit to be used as the in-port.
The selected bit will become the in-port, which can be read by register <4213H>.
Output data should be written to the bit of register<4201H> to be used as the
Out-port. This data can be output directly.
★Only 2 of the 8 bits can be used at the connector for the controller (Refer to
page 1-28-1).
(NCL PG 24)
2-14-1
```

<!-- book1 p082 -->

```
SNESDEVELOPMENTMANUAL
Chapter 15. Absolute Multiplication/Division
15.1 OUTLINE
Absolute muitiplication (8 bit by 8 bit) and absolute division (16 bit by 8 bit) can be
done using this function. It is also convenient for processing arrays of tables and
can improve the processing speed for multiplication and division.
15.2 FUNCTION
The multiplication calculation between the multiplicand of an 8 bit absolute value
(0 ~ 255) and the multiplier of an 8 bit absolute value (0 ~ 255) can be performed
between the dividend of a 16 bit absolute value (0 ~ 65535) and the divisor of an 8
bit absolute value (0 ~ 255) can be performed and can provide the result of a 16
If the divisor is "0" in the division calculation, the quotient value becomes 65535
(OFFFFH) and the remainder becomes the dividend value. Therefore, caution is
required.
It takes about 8 machine cycles for the multiplication calculation and about 16 ma-
chine cycles for the division calculation. The register value for multiplicand and
15.3 SETTING EXAMPLE
In case of Multiplication
Set register<4202H>
"Multiplicand-A" Settings
Setregister<4203H>
"Multiplier-B"Settings
Waitfor8MachineCycles
Readregister<4216H>,<4217H>
Read Product-C
In case of Division
Setregister<4204H>,<4205H>
"Dividend-C"Settings
Setregister<4206H>
"Divisor-B"Settings
Waitfor16MachineCycles
Read register <4214H>, <4215H>
ReadQuoiient-A
Readregister<4216H>，<4217H>
Read Remainder
(NCL PG 25)
2-15-1
```

<!-- book1 p083 -->

```
HNCOUNTTIMER
Chapter 16.  H/V Count Timer
16.1 OUTLINE
The Super NES has a timer synchronizing with the display on the TV screen,
which is used for adjusting the synchronization of the scanning process on the
screen and software execution.
16.2 FUNCTION
This function can generate the interrupt at either a V or H position of the scanning
lines. It can also generate the interrupt at any position of the scanning line.
16.3 SETTING EXAMPLE
INITIAL SETTINGS
Disable IRQ
"Set D4 and D5"of register <4200H>
"Timer Enable"Settings
Set register<4207H>~<420AH>
H Count Time
L SETTINGS
VCountTime
Enable IRQ
IRQ PROCESS
Read“D7"of register<4211H>
Confirm "Timer IRQ"
Clear"D4"and“D5"ofregister<4200H>
Process for Target Task
DISPLAY
(NCL PG 26)
2-16-1
```

<!-- book1 p084 -->

```
SNESDEVELOPMENTMANUAL
Chapter 17. Direct Memory Access (DMA)
The DMA is the method to transfer the data in the same manner as the data transfer
which is done by the CPU. However, the DMA can transfer the data at high speeds by
using the hardware instead of the CPU. The SNES has the exclusive DMA, since the pic
ture data has to be transferred rapidly.
The DMA for the SNES is to transfer the data between "A-Bus Address" in the CPU
(0000000 ~ 0FFFFFF) and "B-Bus Address" in the S-PPU (0002100 ~ 00021FF), which
has 8 channels total. There are two kinds of DMA: general purpose DMA and H-DMA. Ei-
in the order of lower channel numbers (0 ~ 7). The H-DMA can interrupt even during the
than the general purpose DMA. Furthermore, the CPU process stops automatically dur-
ing the DMA period, and will start again after the DMA is completed. It is not necessary to
observe the DMA completion by the CPU.
17.1 GENERAL PURPOSE DMA
17.1.1 OUTLINE
This function can transfer the data rapidly between 2 types of memory
devices: memory which can be accessed directly by the CPU, such as
through the S-PPU, such as the V-RAM.
17.1.2 FUNCTION
The maximum area of the A-Bus address which can be used in one chan-
nel is limited in one bank (65,536 Byte). Therefore, in case of spreading
over more than 2 banks, it is necessary to use more than 2 channels or
transfer twice. One A-Bus address basically is increased every time 1
byte of data is transferred.However, it can be decreased or fixed de-
pending on the settings ("d3" and "d4" of register <43x0H>).
(NCLPG27)
2-17-1
```

<!-- book1 p085 -->

```
DIRECTMEMORYACCESS
The following table shows four types of B-Bus address changes:
Table 2-17-1 B-Bus Address Changes
TransferWordSelect D2~D0 D2 ~ D0 D2~D0 D2~D0
<43X0H> 000or 001 011 100
010
#of Transfer
(#of Byte)
0 B B B B
1 B B+1 B B+1
2 B B B+1 B+2
3 B B+1 B+1 B+3
4 B B B B
5 B B+1 B B+1
?
?
·In case of 224 fines, general purpose DMA can transfer 6K byte data maximum
during V-Blank period.
NOTE: B means the data of register <43X1H>
(NCL PG 28)
2-17-2
```

<!-- book1 p086 -->

```
SNESDEVELOPMENTMANUAL
17.1.3 SETTING EXAMPLE
FORCED BLANK
When using CH4:
·Clear "D4"of register <420BH>, <420CH>
·Set register<4340H>
CH4 Transfer word select
A Bus Address Fixed, INC/DEC SETTINGS
CH4 Transfer Origination
·Set register<4341H>
“BAddress"Settings
· Set register <4342H> ~ <4344H>“A1 Table Address" Settings
·Set register<4345H>,<4346H>
"# of Bytes to be Transferred" Settings
·Write“1"to“D4"of register<420BH>
CH4 Start General Purpose DMA
DISPLAYPERIOD
When using CH3
·Clear“D3"of register<420BH>,<420CH>
·Set register<4330H>
CH3 Transfer word select
A Bus Address Fixed, INC/DEC SETTINGS
CH3 Transfer Origination
·Set register<4331H>
“B Address"Settings
·Set register<4332H>~<4334H>"A1Table Address"Settings
·Set register<4335H>,<4336H>
"# of Bytes to be Transferred" Settings
V - BLANK
a>  , , 
CH3 Start General Purpose DMA
(NCL PG 29)
2-17-3
```

<!-- book1 p087 -->

```
DIRECTMEMORYACCESS
17.2 H-DMA
17.2.1 OUTLINE
This is a special DMA which can transfer data automatically, synchroniz-
ing with the H-Blank. The S-PPU settings can be varied by each horizon-
tal scan line and special effects can be added to the picture.
17.2.2 FUNCTION
This function transfers the data from the A-Bus memory (CPU memory)
to the S-PPU register. There are two kinds of addressing modes on the
A-Bus side; absolute and indirect addressing. Either type of addressing
can be set by each channel. There are two kinds of data transfer. One is
to transfer a set of data during each horizontal blanking period. The other
Table 2-17-2 B-Bus Address Change
TransferWordSelect D2~D0 D2~D0 D2~D0 D2~D0 D2 ~D0
<43X0H> 000 001 010 011 100
#of Line
to be transferred
B B
B B
B B+1
B
B+1 B+2
B+1 B
B+1
B B
B B B B+1
2 B
B +1 B+2
B+1 B
B+1 B+3
NOTE:B means the data of register<43X1H>.
(NCL PG 30)
2-17-4
```

<!-- book1 p088 -->

```
SNESDEVELOPMENTMANUAL
17.3 SETTING EXAMPLE
FORCED BLANK
When using Indirect Addressing (Type 1) with CH0
·Clear"D0"of register<420CH>
·Set register<4300H>
CHo Transfer word select
CH0 TYPE="1" SETTINGS
CHO Transfer Origination
· Set register <4301H>
“B Address" Settings
  ,   >   
· Set register <4307H>
"CHo Data Bank" Settings
·Write “1"to “D0"of register <420CH>
CHO Start H - DMA
DISPLAYPERIOD
When using Absolute Addressing(Type 0) with CH1
·Clear"D1"ofregister<420CH>
· Set register <4310H>
CH1 Transfer word select
CH1 TYPE ="0" SETTINGS
CH1 Transfer Origination
· Set register <4311H>
“B Address"Settings
· Set register <4312H> ~<4314H>"A1 Table Address" Settings
V - BLANK
·Write “1"to“D1"of register <420CH>
CH1 Start H - DMA
(NCL PG 31)
2-17-5
```

<!-- book1 p089 -->

```
INTERLACE
Chapter 18. Interlace
18.1 BG MODE 0 ~ 4 & 7
When “1" is written to D0 of register <2133H>, the picture signal output from the
Super NES will be the interlace signal. In the case of BG modes 0 through 4 and
7, the same picture will be displayed unless the picture data is changed between
the 1st field and the 2nd field. (Refer to BG Screen in Appendix A.)
18.2BG MODE 5 & 6
When using interlace on BG mode 5 and 6, the vertical resolution will be doubled
field and 2nd field. (Refer to BG Screen in Appendix A.)
18.3 OBJ
When "1" is written to "D1" of register <2133H>, the vertical resolution will be dou-
bled as in the case of BG Mode 5 and 6, because a picture is generated using one
frame. The range of the V-position for OBJ is 0 through 255 and this range will not
be doubled.
(NCL PG 32)
2-18-1
```

<!-- book1 p090 -->

```
SNESDEVELOPMENTMANUAL
Chapter 19.  H-512 Mode (BG Mode 5 & 6)
19.1 MAIN SCREEN & SUB SCREEN SETTINGS
The screen addition/subtraction function should not be used, because a part of
both main screen and sub screen functions are used in this mode. With the excep-
tion of color constant addition/subtraction, "1" should be written to D4 and D5 of
register <2130H> and the sub-switch should be off. The same data should be writ-
ten to registers <212CH>, <212DH>, <212EH>, and <212FH>. “Through" should
be the same for both the main and sub-screens.
19.2 FIXED COLOR ADDITION/SUBTRACTION
tion/subtraction. Because a part of both main screen and sub screen functions are
used, this selection cannot be performed. It is necessary to write "1" to 6 flags (D0
~ D5) when color constant addition/subtraction is performed. The remaining set-
tings are the same as the normal Color Constant Addition/Subtraction. There will
be addition/subtraction every 2 dots, horizontally, in the color window function, be-
cause the window has only 256 positions horizontally.
19.3 DISPLAY WITH OBJ
The name H-512 indicates a horizontal resolution of 512 for BG. The horizontal
resolution for the OBJ is only 256-dot, regardless of the BG mode. The priority or-
der for BG is determined by every dot.
19.4 OTHERS
See “BG Screen" in the Tables of Appendix for details.
(NCLPG33)
2-19-1
```

<!-- book1 p091 -->

```
OBJ33
Chapter 20.  OBJ 33's Lines Over & Priority Order
20.133'S RANGE OVER
The number of OBJs which can be displayed in a horizontal line is limited. One of
these limitations is called the "33's Range Over." This limits the number of OBJs
which can be displayed in a horizontal line, regardless of the OBJ size. If "33's
Range Over" has occurred in one field (at least one line), "D6" of register
<213EH> will be set. For the line in which this "33's Range Over" occurs, only 32
OBJs can be displayed out of 33 or more OBJs present. The 32 OBJs displayed
are selected using the priority order (selected from smaller OBJ number).
other OBJs.
NOTE: If H-position is minus, and the OBJ is not displayed on the screen area
(located on the left of the screen to be displayed), "the number of displayed OBJs"
does not count them.
20.235'STIMEOVER
The other limitation on the horizontal line is called “35's time over." This limits the
number of OBJs (converted to character size 8-dot x 8-dot) that can be displayed.
If the "35's Time Over" has occurred in one field (at least one line), “D7" of the reg-
(selected from larger OBJ number). This limit is due to a conversion limit of less
than 35 OBJs (8 x 8) displayed per horizontal line. “These 32 OBJs must satisty
the display condition explained in "33's Range Over", above.
NOTE: There are characters (8-dot x 8-dot) which are not displayed on the dis-
play area depending on OBJ size and position. But they are not included in this
limitation (34 or less).
(NCL PG 34)
2-20-1
```

<!-- book1 p092 -->

```
SNESDEVELOPMENTMANUAL
20.3 PRIORITY ORDER SHIFTING
As mentioned above, limited numbers of OBJs can be displayed in a line and are
related to the priority order. It is desirable to develop a game within this limitation.
However, sometimes OBJs need to be displayed beyond this limitation. This can
be accomplished using virtual OBJs. One method is to change the priority order
every frame. Another method changes the OBJ data order through programming.
The Super NES also contains a function which rotates the priority order of 128
OBJs. When using these methods, consider that the OBJ will flash every frame
unit and the priority order among OBJs will change. The method for assignment is
as follows:
Step 1. Display the OBJ.
Step 2. Write "1" to "D7" of register <2103H>.
Step 3. Write the highest priority OBJ number (0 ~ 127) to “D1 ~ D7" of
register <2102H> during V-Blank period every frame.
Step 4. Repeat step 3.
When OBJ number stored in step 3 is "n".
OBJ NUMBER PRIORITY ORDER
OBJ 0 129-n
OBJ(n -1) 128
BJ (n) 1
OBJ (n+ 1) 2
BJ127 128- n
(NCL PG 35)
2-20-2
```
