# Appendix B — CPU Registers

> Main-CPU (65C816) register definitions. Verify from images when used.

## Contents (per the manual's own TOC)

- 65C816 register definitions (main CPU)

## Provenance

```
Source: `snes_manual/book1.pdf` (Nintendo Super NES Development Manual, Book I),
scanned 240-page image-only PDF (no text layer). Per-page text below is produced by
RapidOCR (ONNX) at 300 DPI. **Prose is a usable baseline; hex / disassembly / tables
carry OCR noise (dropped inter-word spaces, 0/O, S/s, l/I confusion) and must be
verified against the page image before being treated as fact.** Each page is tagged
with `<!-- book1 pNNN -->` so a specific page can be re-verified and corrected.
```

## Body (pages 219–226)


<!-- book1 p219 -->

```
SNESDEVELOPMENTMANUAL
Appendix B. CPU Registers
GENERAL PURPOSE DMA H-DMA
i) Transfer Method i) Transfer Method
A-BUS B-BUS A-BUS B-BUS
CPU CPU
PPU PPU
RAM · ROM RAM·ROM
ii) Data Format i) Data Format (Refer to pp. B-3 & B-4)
Typical Data Bank  Type 0 : Absolute addressing
L Type 1 : tndirect addressing
-C “o": If the data is the same as the data of
the previous line,the data will not be
transferred. (Data Compression)
L C "1" : A pair of data per horizontal line.
ii) Trigger (Start) ii) Trigger (Start)
General Purpose DMA Enabie Flag H-Blank
PRIORITY
H-DMA>GENERAL PURPOSE DMA
ch0>ch1>···>ch7
in the same DMA (General purpose DMA or H-DMA)
H COORDINATE H-BLANK
0 255 341
V
H-DMA CH0~CH7TABLE
TABLE PROCESS
C
GENERALPURPOSEDMA
0 CPU Memory---→ PPU
R
D
ROM — CPU DRAM etc.
1
N
A
T
E
DISPLAY AREA
224
GENERAL PURPOSE DMA
V-
CPU Memory — VRAM etc. BLANK
262
(NCL PG 101)
B-1
```

<!-- book1 p220 -->

```
CPU REGISTERS
H-DMA ABSOLUTE ADDRESSING(TYPE-O):This is a mode used to transfer the data of the
D7CPU RAM D0 address designatedby theTableAddress.
A1 TABLE ADDRESS C#OFLINES:100
A2 TABLEADDRESS DATA - 1 (LOW)
DATA-1 (HIGH)
SETTING MODE (EXAMPLE 1)
DATA - 2 (LOW)
· C="1" : A pair of new data per H-line
·NUMBER OF LINES:100
· TRANSFER WORD SELECT : 1 (2-BYTE L,H)
(200-Bytes data in total)
DATA-100 (HIGH)
A1TABLEADDRESS C#OF LINES :100
SETTING MODE (EXAMPLE 2)
A2 TABLE ADDRESS Data
· C="0" :Same data as previous line. (Repeat data
Data for all lines.)
·NUMBER OFLINES:100
Data
·TRANSFER WORD SELECT :4 (4-BYTE L,H,L,H)
Data
(4-Bytes data in total)
C #OFLINES:0
#of line (O) settings : It indicates that the data for
the DMA transfer has gone.
INDIRECT ADDRESSING (TYPE-1) : This is a mode used to transfer the data of the address
designatedbytheDataAddress,whichisstored tothe
address designated bytheTableAddress.
CPU RAM (TABLE MEMORY)
CPU RAM (TABLE MEMORY) SETTING MODE
D7 00
(EXAMPLE 1)
D7 Do
· C="1" : A pair of data
A1TABLEADDRESSC #OF LINES
per H-line
A2TABLEADDRESS Data Address (LOW)
NUMBER OF LINES
Data Address(HIGH) TOPADDRESS :100
TRANSFERWORD
C #OFLINES
SELECT:
Data Address (LOW) TOPADDRESS 1 (2-BYTE L,H)
Data Address (HIGH) In this case, data area
is 200 byte.
100(Line) x 2 (Trans-
fer Byte)
SETTING MODE
(EXAMPLE 2)
· C="0" :Same data as
previous line
·NUMBER OF LINES
：100
TRANSFER WORD
SELECT :
4 (4-BYTE L,H,L,H)
In this case, data area
C #OFLINES:0
is 4Byte.
# of line (O) settings : It indicates that the data for
the DmA transfer has gone.
(NCL PG102)
B-2
```

<!-- book1 p221 -->

```
SNESDEVELOPMENTMANUAL
DETECT BEGINNING OF V - BLANK
Display Period READ<4210H>
D7 of <4200H>「0 : Disable NMI signal (Always)
RESET "NMI Enable"  1: Depend on "Blank NMI" Flag
SETBLANKNMIOUTPUT
V-BLANK(START) NMI SIGNAL
FLAG
D7 of <4210H> { 0: NMl has not occurred
"NMI Enable"  1: NMI has occurred
The “Blank NMl" flag of register<4210H> will be set at the beginning of V - Blank and will
reset at the end of V - Blank. It may also be reset by reading register <4210H>.
<EXAMPLE>
1. In case of detecting the beginning of V - Blank by NMl :
START NMI
Read<4210H>
Initial Settings
NMIProcess
Write“1”to NMIEnablel
RTI
Process
NMI is an edge trigger. If register<4210H> is not read during
V -Blank and“NMi Enable"is set to "1", NMI will be duplicated.
Read <4210H> Read <4212H>
1: 0:
Blank NMI Flag Blank NMI Flag
0: 1 : V - Blank Period
Read<4210H> Reset the flag
Processing during V- Blank
(NCL PG 103)
B-3
```

<!-- book1 p222 -->

```
CPU REGISTERS
SUMMARYOFREGISTERS
REGISTERS(WRITE)S-PPU
ADDRESS D7 D6 D5 D4 D3 D2 D1 Do
Blanking Fade IN/OUT (0 ~ 15)
2100H
2101H OBJ Size Select OBJ Name Select OBJNameBase Address
2102H OAM Address
OAMPriority OAM Address
2103H
Rotation! MSB
2104H OAM Data (Low, High)
BGSize BG3 BG Mode (0 ~ 7)
2105H
BG4 BG3 BG2 BG1 Priority
MosaicSize MosaicEnable
2106H
BG4 BG3 BG2 BG1
2107H BG1SCBaseAddress BG1 SC Size
2108H BG2SCBaseAddress BG2 SC Size
2109H BG3 SC Base Address BG3SCSize
210AH BG4 SC Base Address BG4 SC Size
BG2NameBaseAddress BG1NameBaseAddress
210BH
BG4NameBaseAddress BG3NameBaseAddress
210CH
210DH BG1 H - Offset (Low, High)
210EH BG1V - Offset (Low, High)
210FH BG2 H - Offset (Low, High)
2110H BG2 V - Offset (Low, High)
2111H BG3 H - Offset (Low, High)
2112H BG3 V - Offset (Low, High)
2113H BG4 H - Offset (Low, High)
2114H BG4 V - Offset (Low, High)
2115H H/L Inc V-RAMAddressSeguenceMode
Full Graphic SCIncrement
2116H V - RAM Address (Low)
2117H V - RAM Address (High)
2118H V - RAM Data (Low)
2119H V - RAM Data (High)
211AH Screen
Over V
(NCL PG104)
B-4
```

<!-- book1 p223 -->

```
SNESDEVELOPMENTMANUAL
REGISTERS(WRITE)S-PPU
ADDRESS D7 D6 D5 D4 D3 D2 D1 DO
211BH Matrix Parameter A (Low, High)
211CH Matrix Parameter B (Low,High)
211DH Matrix Parameter C (Low, High)
211EH Matrix Parameter D (Low, High)
211FH Matrix Parameter X (Low, High)
2120H Matrix Parameter Y (Low, High)
2121H CG-RAMAddress
2122H CG - RAM Data (Low, High)
2123H BG2 Window BG1 Window
W2 EN I IN/OUT |W1 EN I IN/OUT W2 ENIIN/OUT |W1 ENI IN/OUT
BG4 Window BG3 Window
2124H
W2ENIIN/OUTIW1EN|IN/OUT W2EN|IN/OUTIW1ENI IN/OUT
2125H ColorWindow OBJWindow
W2 ENIIN/OUT|W1EN|IN/OUT W2EN|IN/OUT|W1EN|IN/OUT
2126H Window H0 Position (0 ~255)
2127H Window H1Position(0~255)
2128H WindowH2Position(0~255)
2129H Window H3 Position(0 ~255)
212AH WindowLogic
BG4 BG3 BG2 BG1
212BH WindowLogic
Color OBJ
212CH Through Main
OBJ BG4 BG3 BG2 BG1
212DH Through Sub
OBJ 1 BG4 BG3 BG2 BG1
212EH Through Main (Window)
OBJ BG4 BG3 BG2 BG1
212FH Through Sub (Window)
OBJ BG4 BG3 BG2 BG1
2130H WindowON/OFF CGADD Direct
MainSW(A) SubSW(B) Enable Select
2131H ADD 1/2 ADDorSUBEnable
'SUB Enable BACK OBJ BG4 BG3 BG2 BG1
2132H Color Constant Data
Blue Green Red Color Brilliance Data
2133H EXT. EXT. Pseudo OBJ - V TInter-
224/239
Sync. Input 512 Select lace
(NCL PG 104)
B-5
```

<!-- book1 p224 -->

```
CPUREGISTERS
S-PPU READ REGISTER
ADDRESS D7 D6 D5 D4 D3 D2 D1 D0
2134H
M P Y (Low)
2135H
M P Y (Mid)
2136H
M P Y (High)
2137H SoftLatchforH/VCounter
2138H OAM Data (Low, High)
2139H V - RAM Data (Low)
V- RAM Data (High)
213AH
213BH CG Data (Low, High)
213CH Output Data of H - Counter (Low, High)
Output Data of V - Counter (Low, High)
213DH
Time Range Master S - PPU1 Version Number
213EH
Over Over /Slave
Field EXT. NTSC S - PPU2 Version Number
213FH
Latch /PAL
APUREAD/WRITEREGISTER
ADDRESS D7 D6 D5 D4 D3 D2 D1 DO
APU I/O Port
2140H
APU I/O Port
2141H
2142H APU I/O Port
2143H APU I/O Port
WORK RAMREAD/WRITE REGISTER
ADDRESS D7 D6 D5 D4 D3 D2 D1 DO
2180H WORK RAM Data
WORK RAM WRITE REGISTER
ADDRESS D7 D6 D5 D4 D3 D2 D1 Do
2181H WORK RAM Address (Low)
2182H WORK RAM Address (Mid)
WORKRAM Address(High)
2183H
(NCL PG 105)
B-6
```

<!-- book1 p225 -->

```
SNESDEVELOPMENTMANUAL
REGISTERS(WRITE) S-CPU
ADDRESS D7 D6 D5 D4 D3 D2 D1 DO
4200H NMI Timer Enable -or
Enable V-EN H- EN Enable
4201H 1/OPort
4202H Multiplicand-A
4203H Multiplier - B
4204H Dividend - C (Low)
4205H Dividend - C (High)
4206H Divisor - B
4207H H -Counter Timer
4208H H-MSB
4209H V - Counter Timer
420AH V-MSB
420BH GeneralPurposeDMA（EnableFlag)
CH7EN|CH6EN|CH5EN|CH4EN|CH3EN|CH2EN N|CH1EN|CH0 EN
420CH H-DMA（EnableFlag)
CH7EN|CH6EN|CH5EN|CH4EN|CH3EN CH2EN|CH1EN|CH0EN
420DH 2.68
/3.58
(NCL PG 106)
B-7
```

<!-- book1 p226 -->

```
CPUREGISTERS
REGISTERS(READ) S-CPU
ADDRESS D7 D6 D5 D4 D3 D2 D1 Do
4210H Blank SNES-CPUVersionNumber
NMI
4211H Timer
IRQ
4212H V-BlankH-Blank -Aor
Enable
4213H V/O Port
4214H Quotient - A (Low)
4215H Quotient - A (High)
4216H Product - C / Remainder (Low)
4217H Product - C / Remainder(High)
4218H Joy Controller I (Low)
4219H Joy Controller I (High)
421AH Joy ControllrlII(Low)
421BH Joy Contrlle l (High)
421CH Joy ControllerIll Low)
421DH Joy ControlleIll(High)
421EH Joy Controlle IV (Low)
421FH Joy Controller IV (High)
REGISTERS(WRITE)S-CPU
ADDRESS D7 D6 D5 D4 D3 D2 D1 DO
CHX A-Bus Address CHX Transfer Word Select
43X0H
Type INC/DECIFixed
43X1H CHXB-Address
CHX A1 Table Address (Low)
43X2H
43X3H CHX A1 Table Address (High)
CHXA TableBank
43X4H
43X5H CHX Data Address (H-DMA) (Low)
/ NumberofBytestobeTransferred(General PurposeDMA)
43X6H CHXData Address(H-DMA) (4b!H)
/ NumberofBytesto'beTransferred(GeneralPurposeDMA)
CHX Data Bank (H - DMA)
43X8H CHX A2 Table Address (Low)
43X9H CHX A2 Table Address (High)
Continuel Number of Lines
43XAH
* T - Org means the "Transfer Orientation".
(NCL PG 106)
8-8
```
