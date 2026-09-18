# Section 2 (b) — CPU, Memory Map & Reset/Boot

> MOST relevant to the reset-PC / assembler work. Hand-verify the *CROWN JEWEL* pages.

## Contents (per the manual's own TOC)

- 2-21 CPU Clock and Address Map (p93)  *CROWN JEWEL — memory map + 6502/65816 modes
- 2-22 Super NES Functional Operation (p98)
- 2-23 System Flowchart (p101)  *CROWN JEWEL — reset/boot flow
- 2-24 Programming Cautions (p104)
- 2-25 Documented Problems (p112)
- 2-26 Register Clear / Initial Settings (p114)  *CROWN JEWEL — reset register state
- 2-27 PPU Registers (p115)
- 2-28 CPU Registers (p140)

## Provenance

```
Source: `snes_manual/book1.pdf` (Nintendo Super NES Development Manual, Book I),
scanned 240-page image-only PDF (no text layer). Per-page text below is produced by
RapidOCR (ONNX) at 300 DPI. **Prose is a usable baseline; hex / disassembly / tables
carry OCR noise (dropped inter-word spaces, 0/O, S/s, l/I confusion) and must be
verified against the page image before being treated as fact.** Each page is tagged
with `<!-- book1 pNNN -->` so a specific page can be re-verified and corrected.
```

## HAND-VERIFIED EXTRACT (CPU Clock, Memory Map, ROM/reset) — from page images

> Transcribed directly from the 300 DPI page images (p93–95), NOT from the noisy
> OCR baseline below. These are the facts the reset-PC / ROM-header work rests on,
> so they are spelled out unambiguously here.

### 21.1 CPU clock (p93)
- Clock speed is **auto-selected per address** from the device access time. Three speeds:
  **3.58 MHz, 2.68 MHz, 1.79 MHz**.
- **Default is 2.68 MHz.** The 65816 core is clocked internally at 3.58 MHz, but the
  bus/DMA region runs at 2.68 MHz.
- The 3.58 MHz vs 2.68 MHz choice for a given region is set by **bit 0 (D0) of register
  `$420D`** (per the figure, this select applies to memory range ②).
- Address→clock regions (from Figure 2-21-1):
  - `$0000–$1FFF` (banks 00–3F / 80–BF / 7E): 2.68 MHz — the common **8K WRAM**
  - `$2000–$5FFF` (common bank): reserved — S-PPU / CPU / DMA registers (3.58 MHz block `$4200–$5EFF`)
  - `$4000–$41FF`: 1.79 MHz — **Controller** port
  - `$6000–$7EFF`: 2.68 MHz — **EXPAND** (coprocessor / Super FX window)

### 21.2 CPU memory map (p93 + Figure 2-21-1, p94)
- **WRAM = 128K total**, split as:
  - **8K common bank** at `$0000–$1FFF`, visible in **every** bank of 00–3F, 80–BF, and 7E
    (this is the "common bank" — S-PPU/DMA/CPU registers hang off `$2000–$5FFF` here).
  - **120K** at `$2000–$FFFF` of bank **7E** plus `$0000–$FFFF` of bank **7F** (the two are
    one contiguous memory).
- Everything else in the 24-bit space is **ROM** (the "Memory" hatched cells), i.e. banks
  map to cartridge ROM under the SNES Mode-20 (LoROM) mapper.
- ROM banks 00–7D hold program ROM (bank 00 is the base image); banks 7E/7F are WRAM;
  the `$6000–$7EFF` window is the coprocessor "EXPAND" area.

### Figure 2-21-2 — ROM/cartridge map, "Mode 20" (p95) — the reset-PC facts
- **Note 1:** The ROM image for banks **00H–7DH** is generated in **bank 00H**.
- **Note 2:** *"Set start vector and general registration area at address
  **FFC0H–FFDFH in bank 00H**."* ← the SNES **ROM header** lives here. This is where the
  65816 **reset vector** and the boot/SPU header bytes sit, in bank `$00`.
- **Note 3:** Specify the ROM speed mode (high-speed) in the ROM header.
- **Note 4:** If program ROM is **< 8M**, the **DSP/Sound area is `$8000–$FFFF` in
  banks 30H–3FH** (else it sits at banks 7D–7F in the >8M layout).
- Available ROM sizes shown: 8M / 16M / 24M / 32M, plus an "Extended RAM Area"
  (64K/256K) and a "Static RAM Area (on Cartridge)" for the sound coprocessor.

#### How this fits the 65C816 reset path (the assembler's entry point)
The SNES 65816 **resets into 8-bit (6502) mode**, and its initial PC is the 16-bit
**reset vector read from bank `$00`, `$FFFC–$FFFD`** (big-endian; bank forced to `$00`).
That vector is the tail of the Note-2 `$FFC0–$FFDF` header block, so a hand-built ROM
gets its entry point by:
1. placing the 128-byte SNES ROM header at **bank `$00`, `$FFC0`**,
2. putting a **16-bit start address** at `$FFFC–$FFFD` pointing at the first instruction,
3. writing the first instruction in **6502 (8-bit) mode** — switch to 16-bit mode with
   `REP #$30` (A/X/Y 16-bit) only once ready.

> The full 65C816 **command set** that would back steps 3 (PEA/PEI/PER/PHB/PHK/PLB,
> `REP`/`SEP`, the 65C02 deltas, cycle/byte tables) is **Section 4 of Book I, which is
> MISSING from this scan** — see `README.md` and `Programmanual.pdf` (which has it,
> with a clean text layer).

## Body (pages 93–152)


<!-- book1 p093 -->

```
CPUCLOCKANDADDRESSMAP
Chapter 21. CPU Clock and Memory Mapping
21.1 CPU CLOCK
The CPU clock can be switched automatically, depending on the address to be
accessed by the CPU. Three clock speeds are available: 3.58MHz, 2.68MHz, and
1.79 MHz. The device speed (ROM, RAM, LSl, etc.) will determine the speed to
be used. If a medium speed ROM and RAM (access time less than 200ns) are
used in the cartridge, it will be mapped to the address area for 2.68MHz. If high
between the address and the clock. Two clocks (2.68MHz & 3.58MHz) can be se-
the illustration on the next page. The default setting is 2.68MHz. The CPU is oper-
ated internally with a 3.58MHz clock speed. (Regardless of the address, DMA will
be performed with 2.68MHz clock speed).
21.2 CPU MEMORY MAP
Please refer to "Frequency & Address Map" on the next page. The WRAM (8K-
Byte) is mapped to address (00o0 ~ 1FFF) of banks (00 ~ 3F), (80 ~ BF) and 7E.
This is the WRAM used as common bank. This 8K-Bytes can be accessed from
any bank described above. The WRAM (120K-Byte) is mapped to address (2000
~ FFFF) of bank 7E and (0000 ~ FFFF) of bank 7F. Therefore, the WRAM (128K-
               s
one consecutive memory and can be accessed from the B - Bus address. The ad-
dress "2000 ~ 5FFF"of bank "00 ~ 3F" and “80 ~ BF" are reserved as a register
area of the S-PPU, DMA, etc. Because this basically is reserved as a common
bank area, the S-PPU and DMA register can be accessed from any bank above.
(NCLPG36)
2-21-1
```

<!-- book1 p094 -->

```
SNESDEVELOPMENTMANUAL
7FFF2.68M
CPU_DMA, etc. 1FFF 2.68M
(8K-BYTE)
EXPAND 4200 ~ 5FFF 3.58 M
WRAM
0009 4000 0000
2000：
RAM
RAM
41403F3E
---Fix 2.68 MHz 8K byte
RAM 2 ---Fix 2.68 MHz 120K byte
RAM
81.80 7F 7E 7D RA
RAM 1
RAM
RAM
C1 C0 BF BE
Figure 2-21-1 Super NES CPU Memory Map -Fix.2.68 MHz
Memory
A23-A16(BANK)
A15~A0FF FE
FFFF E000 COO0 A000
8000 0009 4000 2000 0000
(NCL PG 37)
2-21-2
```

<!-- book1 p095 -->

```
CPUCLOCKANDADDRESSMAP
H0009 4000H 2000H 07FFH H0000
H0008
Bank 70~7D
16K
64K Expanded RAMArea
256K
FFFFH H0008 2000H HO00O
Bank Address
Register
8M
16M
24M
~ FFH can be executed in the high speed mode.
32M AvailableROMArea
StaticRAMArea
(on Cartridge)
18
Specify the need for the high speed mode in the submission form.
'Had ~ Hg yueq ui pelelauan s! Ha ~ Hoo yueq lo, sbe! o au1 :1 alon
Super NES Memory Map (Mode 20)
Figure 2-21-2 S
2-21-3
```

<!-- book1 p096 -->

```
SNESDEVELOPMENTMANUAL
FFFFH H0009 Area HO000
HO008 -DSP
Bank Address
Reqister
8000H H0009 H0008 H0009
30 30
StaticRAMAtea 33
(256K)
(1M)
3C
3F
Enlarged RAM Area
H0008 7800 H0008 H0009
30 30
H ~ Ho yq ui n s! H   yq yo s   spe w ai  i  n 
() 64K)
3F 3F
, Reset Vector) in the vector area of bank CoH"
1
 the need for the high speed mode in the submission form.
( )    en  a
8M
16M
24M  and bank 80H ~ BFH.
Note 1: In memory Mode 21, vectors (i.e.,
Program ROM Area (1)
ROMAreaAvailable
32M
2-21-4
```

<!-- book1 p097 -->

```
CPUCLOCKANDADDRESSMAP
CO:0000H FF:FFFFH 40:0000H 41:0000H 3E:8000H 3F:0000H 3F:8000H
FFFFH 8000H H0009 2000H HO000
Bank Address
Register
DSP Area
Program ROM Program ROM Area (2)
Area (1)
RESERVED AREA
Program ROM Area (3)
32M 31.5M
-T
ROMAreaAvailable (32M to 63M)
RAE
RESERVEDAREA
Note 2: Programs located in the area of bank 80H~FFH can be executed in the high speed 
(on Cartridge)  pue 3 yueg jo eae wo weiaid aui se se pue 3e yuea jo eaie aui as :t alon
StaticRAMArea
SRAM
ROMAreaAvailable (to 32M)
mode (3.58 MHz).
Note 3: Don't access null area.
Figure 2-21-4
2-21-5
```

<!-- book1 p098 -->

```
SNESDEVELOPMENTMANUAL
Chapter 22.  Super NES Functional Operation
each of the major components of the Super NES control deck. Refer to the Super NES
Functional Block Diagram (opposite page) while reading the following paragraphs.
22.1 SUPER NES CPU
This is the Central Processing Unit for the Super NES. It coordinates all func-
tions of the Super NES control deck and peripheral devices which are attached
to the Super NES.
22.2 SUPER NES PPU1 AND PPU2
These 2 units work together as the Picture Processing Unit for the Super NES.
Pictures are generated for display based upon control inputs from the Super
NES CPU. In general, PPU1 is used to generate background character data, ro-
tation, and scaling; while PPU2 performs special effects like windows, mosaic,
and fades.
22.3 SUPER NES WRAM
The work RAM (WRAM) is a custom 128K x 8 bit RAM used by the Super NES
CPU for data storage. Direct Memory Addressing (DMA) can be used by the Su-
per NES CPU for rapid bulk transfer of data.
22.4 VRAM
The VRAM is composed of 2 - 32K x 8 bit S-RAMs. This unit is used by PPU1 to
store background character data until needed for display.
22.5 AUDIO PROCESSING UNIT (APU)
The Audio Processing Unit performs all sound functions for the Super NES and
is composed of the following units.
22.5.1 SOUND CPU
The Sound CPU is the central processing unit for the Super NES Audio
Processing Unit. It controls sound functions much in the same way that
the Super NES CPU controls functions of the Super NES.
22.5.2 SOUND DSP
The DSP has 8 channels of pulse code modulated (PCM) sound, a
noise generator, echo, sweep, envelope, and other circuits to repro-
duce tone qualities from RAM data.
2-22-1
```

<!-- book1 p099 -->

```
SUPERNESFUNCTIONALOPERATION
P
MOD
RF
L+R
AMP
SYNC SIGNAL
BRIGHTNESS VIDEO
VIDEO COLORSIGNAL 8'7
SIGNAL
Processing Unit (APU)
RGB ENCODER
R. G.B.
AMP
SYNC SIGNAL
D/A CONV
SOUND RAM
R.G.B.
ZHIN
DATA 3SO
L+R
SUPER NES PPU2 CONTROL:BCK,LRCK
XTA1
EXPL,R GPK L,R
SOUND DSP
VDB0-7
CONTROL:PARD,PAWR
VRAM 32KX8Bit ZX SRAM SUPER NES BLOCK DIAGRAM
VRAMDATABUS:VDA0~7
COPUA-153
RESET CPUDATA BUS:CD0-7
VRD.VAWR.VBWR
21MHz VRAMBUS
RESET
SOUND CPU
DCK
ADDRESS:PA0-7 S
SUPER NES PPU1
RESET
RESET
RESET
28P
MHz
OSC 21.47727
BBUS
SUPER
CONTROLLER S CPU NES WRAM
CONNECTOR
NOH
OsC 4.00MHz CPURD.CPUWR
CIC CA0-23CONTROL:
21MHz A BUS
CICO-3
62P GPK CONNECTOR
Figure 2-22-1 Super NES Functional Block Diagram
2-22-2
```

<!-- book1 p100 -->

```
SNESDEVELOPMENTMANUAL
22.5.3SOUNDRAM
The Sound RAM is composed of 2-32Kx8 bit SRAMs. Program and
tone data are loaded from the game pak to the sound RAM by the
Sound CPU. The RAM is time shared by the Sound CPU and DSP.
22.5.4 D/ACONVERTER
Converts the digitized sound to an analog signal which is filtered and
amplified to produce the L+R (mono) output through the RF Modulator
and L,R (stereo) outputs through the multi-out connector.
2-22-3
```

<!-- book1 p101 -->

```
SYSTEMFLOWCHART
Chapter 23. System Flowchart
POWER - SW ON
or
RESET-SW ON
Jump to address indicated by Reset
Vector(00FFFDH,O0FFFCH)
[Forced Blank]
>   , 
INITIAL SETTINGS
Clear each Register (See Ch.26)
[Main Register Settings]
·Set each“Base Address"
·Set“OBJ Size Select"&“OBJ Name Select"
Register<2101H>,<2105H>,<2107H>~<210AH>
·THROUGH MAINSETTINGS
FORCED
REGISTER<212CH>
BLANK
OAM,CG RAM DATA SETTINGS
NOTE: The function to set the OAM address automatically will not
workduring Forced Blank period!
[OAM&CGRAMAddressSettings]
●Set OAM Address
Normally write “00H" to register <2102H> <2103H>
·Set CG RAM Address
Normally write"00H"toregister<2121H>
(To Sheet 2)
(NCL PG 40)
2-23-1
```

<!-- book1 p102 -->

```
SNESDEVELOPMENTMANUAL
(From Sheet 1)
Transfer OAM data & CG data by using
2 channelsof GeneralPurposeDMA
VRAMDATASETTINGS
VRAM DATA SETTINGS
·“VRAM address H/L INC" Settings
·“VRAM address Sequence Mode"Settings
·"VRAM address"Settings
FORCED
Register <2115H>, <2116H>, <2117H>
BLANK
V-RAM data transfer by using General Purpose DMA
NO
OBJ, BG CHR Data
has been transferred?
BG SC Data
YES
Register settings for initial screen to be displayed
Release“Forced Blank"
Write “0FH" to register<2100H> for display
I(To Sheet 3)
(NCL PG 41)
2-23-2
```

<!-- book1 p103 -->

```
SYSTEMFLOWCHART
(From Sheet 2)
Generate data of register to be renewed and memory in
order to change BG &OBJ character
·Enable“NMI Enable” Display
Period
·Enable“JOY-C Enable
Write“81H"to register<4200H>
No NMI
WAIT NMI
NMI
(Recognize the beginning|of V-Blank period by NMI)
V-Blank
(Set previously renewed data of register and memory)
Period
·Transferrenewed OAM databyDMA
more than
215μs
·Data settings for BG&OBJ whichrenewpicture
(Read data from Joy Controller)
Display
Register<4218H>~<421FH>
Period
(NCL PG 42)
2-23-3
```

<!-- book1 p104 -->

```
SNESDEVELOPMENTMANUAL
Chapter 24. .Programming Cautions
24.1 CAUTION #1
Registers <210DH> ~ <2114H> and <211BH> ~ <2120H> must be accessed in
the order of Low and High twice (Read Twice or Write Twice). If it is not known
whether the next access should be low or high, initialize as follows:
Oam, CGram, Vram Set the address again.
Other Registers (Write) The lower data should be written more
than one time, and the higher data
should be written.
H/V Counter Read TheH/V counterwill be initialized when
the statusregister<213FH> is read.The
data should be read in the order of Low
and High.
24.2 CAUTION #2
The period which can be accessed for the register is as follows:
V-RAM, OAM Forced Blank or V-Blank period only.
CG-RAM Forced Blank, V-Blank or H-Blank period
only.
Other Register (Write) All period (however, when writing the
data, the picture may not be displayed
properly).
Other Register (Read) All period (However, the data which may
be changed during display period may
not be read properly).
24.3 CAUTION #3
The address space for the V-RAM is 64K-word (1 word = 16-bit) maximum. 32K-
word memory is installed in the Super NES unit.
24.4 CAUTION #4
When the V-RAM is accessed from the CPU, the address counter will be in-
creased automatically. For the V-RAM increment mode, please use the register
mode designated by the instruction.
(NCL PG 43)
2-24-1
```

<!-- book1 p105 -->

```
PROGRAMMINGCAUTIONS
24.5 CAUTION #5
When the V-RAM is read continuously, the first address will not be incremented
once theV-RAM data hasbeenstored.Thefirst address should beread as
dummy data on subsequent passes.
24.6 CAUTION #6
The top color data of each CG color data palette is transparent. Because trans-
CG address (OoH) is normally black (background).
24.7 CAUTION #7
Even though 9-bits are provided as the OAM H-position, the value (100H) must
not be used.
24.8 CAUTION #8
ed to the controller ports. The valid identification codes are:
·Standard Controller 0000B
· Super NES Mouse 0001B
· Super Scope 1111B
These codes may be found in bits D3 ~ D0 of registers <4218H> and <421AH>.
If the standard controller is used for the game, inputs should be ignored whenev-
er the ID code is not 0oooB.
24.9 CAUTION #9
The initial value of the work RAM in the main computer is not set when power is
applied to the computer. Programming should be done in such a way that no er-
rors occur when the data is indeterministic. The initial value is different depend-
ing upon the computer used. Initialize the entire RAM area when, for example, it
has been programmed under the misconception that the data is a fixed value,
00·FF.
24.10 CAUTION #10
When using the battery back-up SRAM, avoid program errors due to data loss.
The CPU may crash if the user hits the control deck when the game pak is in
dirty. Data loss may be unavoidable in some cases. Before reusing SRAM data,
determine if the data is recoverable. One method of detection is to save the data
inseveralareasoftheSRAMandcalculate thechecksumsofeacharea.Be-
fore utilizing any data in the SRAM, the program must compare each of the
check sums. If the check sums are not equal, the data is corrupted.
(NCL PG 43)
2-24-2
```

<!-- book1 p106 -->

```
SNESDEVELOPMENTMANUAL
24.11 CAUTION #11
In addition to using a check code to check a hot/cold start, determine if the con-
tent of the work RAM used is correct after the reset. Data in work RAM is lost
gradually after the power is turned off. The speed at which data is lost differs ac-
cording to the area. If the device is turned on immediately after it has been
turned off, the area that is checked for hot/cold start code may contain the origi-
nal data. This does not mean that the entire data have been recovered. Guide-
lines for prevention of data loss are the same as those for the previous caution.
24.12 CAUTION #12
When executing critical commands using the controller keys, such as; modify,
erase data, or software reset, use all 16 bits of data including the input device's
signature. Corrupt data may be sent by the controller if the controller is un-
plugged during a game. When the computer is reset using start, select, L, and R
controller data simultaneously, verify that:
· The start, select, L, and R are pressed,
· No other keys are pressed, and
· The signature data is 0oo0.
In other words, check that the key data is 3030H.
24.13 CAUTION #13
Do not place critical game characters within two characters of the perimeter of
the display screen area. This area of the television varies from one brand or
model to the next. The Super NES may not be able to display characters in
some areas if programmed too close to the edge of the screen. Critical game
characters include score data and various parameters.
24.14 CAUTION #14
Ensure that the program clears the emulation bit on reset or start-up before exe-
cuting 65816 instructions (i.e., JMP $808007). This is demonstrated in the pro-
gramming example, below:
Example:
RESET ;Reset vector
SE1
;Disable interrupt
CLC ;Clear carry
XCE
;Exchange carry with E bit, now in 65816 mode
JMP$808009;Example 65816 instruction
2-24-3
```

<!-- book1 p107 -->

```
PROGRAMMINGCAUTIONS
24.15 CAUTION #15
When utilizing the high speed mode (3.58MHz), perform a dummy jump at the
start of every vector to change the Program Bank Register to the upper banks
($80 or above). Refer to the following program example.
Example:
ORG $808000
RESET
SEI
CLC
XCE
JMP ~RESETFAST ;Dummy jump to change PBR
RESETFAST ;RESETFAST belongs to bank $80
NMI
JMP ~NMIFAST
NMIFAST
24.16 CAUTION #16
When restarting controller read after it has been temporarily disabled, the user
program should confirm that the buttons have been released before accepting
the button inputs.
controller read. This data is held for about 3 fields (50 msec) into the next con-
controller performance is demonstrated in the table below.
User No No
"B" Button “A" Button
Operation Operation Operation
Nintendo B B N/A A A A A
Controller
,ndino
j0 indino B B N/A B B B A
Some
Licensed
Controllers
Controller Ensble Disable Enable
Read
Note: 1 field (16.6 msec)
2-24-4
```

<!-- book1 p108 -->

```
SNESDEVELOPMENTMANUAL
For instance, if the software is programmed as follows;
1. Enter the room when "B" button is pressed.
2. Disable controller read while changing screen data.
3. The room appears and enable controller read.
4. Exit the room when "B" button is pressed.
the player will immediately exit the room.
This problem can be resolved in 2 different ways, as described below.
24.16.1 EDGE DETECTION
If "edge detection" is used for processing controller data instead of
"level detection", the above problem can be avoided. The fol-
lowing sample program illustrates edge detection. The differ-
ence between controller (Cont) and trigger (Trig) data in the
sample program is shown in the table below.
Cont 0 0 0 1 1 0 0 0 0 1 1 0 0
Trig 0 0 0 0 0 0 0 0 0 0 100 0 0
Note:0 = Off
1 = On
2-24-5
```

<!-- book1 p109 -->

```
PROGRAMMINGCAUTIONS
(SAMPLEPROGRAM)
;- RAM Definition
Cont1L ds 1 ; Controller #1 data low byte
Cont1H ds 1 ; Controller #1 data high byte
Cont2L ds 1 ; Controller #2 data low byte
Cont2H ds 1 ; Controller #2 data high byte
Trig1L ds 1 ; Trigger data of controller #1
Trig1H ds 1
Trig2L ds 1 ;Trigger data of controller #2
Trig2H ds 1
;- Read Controller
RdCont;
push
a8 ; Accumulator 8-bit
RdCont_Wait1
LDA HVBJoy ;<4212>
AND #%00000001 ; Wait JOY-C Enable : D0=0
BEQ RdCont_Wait1
RdCont_Wait2
LDA HVBJoy
AND #%00000001
BNE RdCont_Wait2
a16 ; Accumulator 16-bit
i16 ; Index 16-bit
RdCont_Cont1
LDY Cont1L. ; Keep last data in "IY"
LDA Joy1L ; <4218> (Cont1-L)
STA Cont1L ; Store new controller data
TYA ; <edge detection>
EOR Cont1L
AND Cont1L
STA Trig1L ; Store trigger data
RdCont_Cont2
LDY Cont2L ; Keep last data in "IY"
LDA Joy2L ; <421AH>(Cont2-L)
STA Cont2L ; Store new controller data
TYA ；<edge detection>
EOR Cont2L
AND Cont2L
STA Trig2L ; Store trigger data
pop
RTS
2-24-6
```

<!-- book1 p110 -->

```
SNESDEVELOPMENTMANUAL
24.16.2 ALTERNATE METHOD
The problem may be avoided by ignoring controller data for about 3
fields, after restarting controller read. Since programming becomes
very complicated, increasing the risk of program bugs, this method is
not recommended.
If controller read is disabled for 1~2 fields, the consumer cannot press
a button quickly enough to cause a problem. This configuration is il-
lustrated in the table below.
User No No
“A"
"B"Button
Operation Operation Operation
Button
Nintendo B B N/A B B
AAA A
Controller
indino
Output of B B N/A B B
AAIAA
Some
Licensed
Controllers
Controller Ensble Disable Enable
Read
Note: 1 field (16.6 msec)
2-24-7
```

<!-- book1 p111 -->

```
PROGRAMMINGCAUTIONS
THIS PAGE INTENTIONALLY
LEFT BLANK
2-24-8
```

<!-- book1 p112 -->

```
SNESDEVELOPMENTMANUAL
Chapter 25. Documented Problems
The following paragraphs describe system problems which have been identified and pro-
vides solutions for the problems listed.
25.1 PROBLEM 1
25.1.1 SYMPTOM
If H-DMA starts at about the same time that General Purpose DMA finish-
es, sometimes the CPU will cease to operate properly or H-DMA will not be
correctly implemented (S-CPU ver. 1).
This could happen if General Purpose DMA finishes during the first 2.24 μs
of the H - Blank period on lines 0 - 224 (239), while H-DMA is being used. It
can also happen at the beginning of line O, as well. *
* The real time trace function of the ICE can be utilized to confirm the tim-
ing.
25.1.2 SOLUTION
This problem will not happen if General Purpose DMA is used only during
V - Blank or if H-DMA starts in the middle of data transfer of General Pur-
pose DMA. It does not happen if H-DMA is not being used.
This problem can also be avoided by adjusting the time at which General
Purpose DMA begins and/or decreasing the number of bytes transferred.
The H and V count timers can be utilized to determine the start time of
General Purpose DMA. One line takes 63.5 μs and the value of one count
on the H count timer is equivalent to 0.186 μs.
The end timing of the General Purpose DMA changes depending on the
amount of transferred data of H-DMA which happens in the middle of data
transfer of the General Purpose DMA.
When the problem occurs:
General Purpose
General Purpose
DMA Ends
DMA Starts
Generall General Generall General
CPU|HDMA CPU Purpose HDMA|Purpose
Purpose HDMA Purpose HDMA CPU
DMA DMA DMA DMA
63.5 μs
When avoiding the problem:
General Purpose General Purpose
DMA Starts DMAEnds
General General Generall General
CPUHDMA CPU Purpose HDMA|Purpose
Purpose HDMA Purposel CPU] HDMA CPU
DMA DMA DMA DMA
(NCL PG 43a)
2-25-1
```

<!-- book1 p113 -->

```
DOCUMENTEDPROBLEMS
25.2 PROBLEM 2
25.2.1 SYMPTOM
When the size of OBJ 0 is 16 x 16, 32 x 32, or 64 x 64, and its horizontal
position is 0 through 255, and there are other objects present with negative
horizontal positions (they are not displayed on the screen), the Time Over
Flag will become 1 (S-PPU1 ver. 1).
25.2.2 SOLUTION
The cause is being examined.
(NCL PG 43b)
2-25-2
```

<!-- book1 p114 -->

```
SNESDEVELOPMENTMANUAL
Chapter 26. Register Clear (Initial Settings)
(This is a recommended setting for beginners. It is not necessary to perform register
clear exactly this way. However, the register status is not stable when power is turned on
and initial settings must be performed).
ADDRESS(HEX) DATA (HEX) ADDRESS (HEX) DATA (HEX)
<2100> 8 F (Forced Blank) <2120> 00 00
<2101> 00 <2121> 00
<2102> 00 <2122> (CG Data)
<2103> 00 <2123> 00
<2104> (OAM Data) <2124> 00
<2105> 00 <2125> 00
<2106> 00 <2126> 00
<2107> 00 <2127> 00
<2108> 00 <2128> 00
<2109> 00 <2129> 00
<210A> 00 <212A> 00
<210B> 00 <212B> 00
<210C> 00 <212C> 00
(Low) (High) <212D> 00
<210D> 00 00 <212E> 00
<210E> 00 00 <2130> 30
<210F> 00 00 <2131> 00
<2110> 00 00 <2132> EO
<2111> 00 00 <2133> 00
<2112> 00 00 <4200> 00
<2113> 00 00 <4201> FF
<2114> 00 00 <4202> 00
<2115> 80 <4203> 00
<2116> 00 <4204> 00
<2117> 00 <4205> 00
<2118> (VRAM Data) <4206> 00
<2119> (VRAM Data) <4207> 00
<211A> 00 <4208> 00
<211B> 00 01 <4209> 00
<211C> 00 00 <420A> 00
<211D> 00 00 <420B> 00
<211E> 0:0 01 <420C> 00
<211F> 00 00 <420D> 00
(NCL PG 44)
2-26-1
```

<!-- book1 p115 -->

```
PPUREGISTERS
Chapter 27. PPU Registers
ADDRESS: 2100H
NAME: INIDISP
CONTENTS:INITIAL SETTINGS FOR SCREEN
D7 D6 D5 D4 D3 D2 D1 DO
BLANK FADE IN/OUT (0~15)
2100H
ING
F3 F2 F1 FO
SCREEN BRIGHTNESS: Determine
the screen brightness (16-stages)
F3 F2 F1 FO BRIGHTNESS
1 1 1 1 BRIGHT
1 1 0
0 0 0 0 DARK
BLANKING:FORCEDBLANKING 0: NON-BLANKING
BLANKING
ADDRESS: 2101H
NAME: OBJSEL
CONTENTS:OBJECT SIZE&OBJECTDATAAREADESIGNATION
D7 D6 D5 D4 D3 D2 D1 DO
OBJ SIZE SELECT OBJ OBJ
NAMESELECT NAME BASE ADDR 2101H
S2 S1 S0 N1 NO BA-2 BA-1 BA-0
OBJECTBASEADDRESS(UPPER
For Expansion
3BIT)
Norm = 0
Designate the segment (8K-word/
segment)addresswhich theOBJ data
is storedin the VRAM.(See pages A-1
and A-2)
-OBJECTDATAAREASELECT
The upper4K-word outof the area(8K-word)designatedby
"ObjectBaseAddress"isassigned astheBaseArea,and
the area of the lower 4K-word combined with its Base Area
can be selected. (See pages A-1 and A-2)
OBJECT SIZE: DESIGNATE OBJECT SIZE (See pages A-3 and A-4)
OBJ SIZE
S2 S1 S0 0 (SM) 1 (LG)
0 0 0 8 DOT 16 DOT
0 0 1 8 DOT 32DOT
0 ← 0 8 DOT 64 DOT
0 1 1 16 DOT 32DOT
1 0 0 16 DOT 64 DOT
0 1 32 DOT 64 DOT
(NCL PG 46)
2-27-1
```

<!-- book1 p116 -->

```
SNESDEVELOPMENTMANUAL
ADDRESS: 2102H/2103H
NAME: OAMADDL/ OAMADDH
CONTENTS:ADDRESS FORACCESSING OAM(OBJECTATTRIBUTE MEMORY)
ADDRESS
D7 D6 D5 D4 D3 D2 D1 DO
OAMADDRESS 2102H
A7 A6 A5 A4 A3 A2丨A1 A0
OAMPRIORITYROTATION OAMADDRESSMSB
2103H
A8
This is theINITIALADDRESS tobeset in advancewhenreading fromor writing
to the OAM.
To set the OBJ priority order, write “1" to D7 (OAM Priority Rotation) of register
<2103H> and set the highest priority OBJ number(0 ~ 127) to D1 ~ D7 of register
<2102H>(refer to“Priority Order Shifting").
The address which has been set just before every field (beginning with V-BLANK)
will be set again to registers <2102H><2103H> automatically. However, the ad-
dress cannotbeset automatically during Forced Blankperiod.
ADDRESS: 2104H
NAME: OAM DATA
CONTENTS:DATAFOROAMWRITE
D7 D6 D5 D4 D3 D2 D1 DO
OAM DATA (LOW, HIGH)
2104H
D7 D6 D5 D4 D3 D2 一 D1 DO
This is the OAM data tobe written to any address of the OAM (refer topage A-3).
After register <2102H> or <2103H> is accessed, the data must be written in the or-
der of Lower 8-bit and Upper 8-bit of register <2104H>. The OAM address will be
increased automatically when the OAM data is written in the order of LOw to HiGH.
The data can be written only during a V-BLANK or FORCED BLANK period.
(NCL PG 47)
2-27-2
```

<!-- book1 p117 -->

```
PPUREGISTERS
ADDRESS: 2105H
NAME: BG MODE
CONTENTS:BGMODE&CHARACTERSIZESETTINGS
D7 D6 D5 D4 D3 D2 D1
DO
BG SIZE BG3 BG MODE
2105H
BG 4E BG3 BG2 BG 1 PRIO. M2 M1 MO
BG SCREEN MODE SELECT:
SeeBGScreenModeSummary
(page A-5)
HIGHESTPRIORITYDESIGNATIONFORBG-3
MakeBG3highestpriorityduringBGMode0or 1
(page A-19)
0:OFF
1:ON
BG SIZE DESIGNATION:Designate the sizefor each BG Character
(pages A-21 and A-22)
8X8 DOT/CHARACTER
1: 16 X16 DOT/CHARACTER
16 DOT
00 01 IncaseCHRNAMEofSCdatais"OoH":
16 DOT
10 11
CHARACTER NAME (HEX)
ADDRESS: 2106H
NAME: MOSAIC
CONTENTS: SIZE & SCREEN DESIGNATION FOR MOSAIC DISPLAY
D7 D6 D5 D4 D3 D2 D1 DO
MOSAICSIZE MOSAICENABLE
2106H
M3 M2 M1 MO BG4 IB BG3 BG2 BG1
MOSAIC MODE SELECT:
ON/OFFforMosaicModeofeachBG
0:OFF
1:ON
MOSAICMODESIZEDESIGNATION:DESIGNATEMOSAICMODESIZE
(page A-7)
256MODE 512MODE(HXV)
M3M2M1M0 SIZE M3 M2|M1M0 SIZE (): NON-INTERLACE
0 0 0 0 1 X 1 DOT 0 0 0 0 2X2 DOT (2 X 1DOT)
0 0 0 1 2X2DOT 0 0 0 1 4X4D0T(4X2DOT)
0 0 1 0 3X3DOT 0 0 1 0 6X6D0T(6X3D0T)
15 X 15 DOT 0 30X30DOT(30X15DOT)
16 X 16 DOT 32X32DOT(32X16DOT)
(NCL PG 48)
2-27-3
```

<!-- book1 p118 -->

```
SNESDEVELOPMENTMANUAL
ADDRESS: 2107H/2108H/2109H/210AH
NAME: BG1SC/BG2SC/BG3SC/BG4SC
CONTENTS:ADDRESSFORSTORING SC-DATA OFEACHBG&SC SIZEDESIGNATION
(MODE 0 ~6)
D7 D6 D5 D4 D3 D2 D1 DO
BG1 SCBASEADDRESS BG1 SC SIZE
2107H
A5 A4 A3 |A2 丨A1丨 A0 S1 S0
BG2 SCBASEADDRESS BG2SCSIZE
2108 H
A5 A4 A3 A2 A0 S1 S0
BG3 SCBASEADDRESS BG3 SC SIZE
2109H
A5 A4 A3 A2 A1 A0 S1 S0
BG4 SCBASEADDRESS BG4 SCS SIZE
210AH
A5 A4 A3 A2 A1 A0 S1 S0
SCREEN SIZE DESIGNATION
(pages A-21 and A-22)
DesignateBackground Screen
Size
BACKGROUNDSCREENBASEADDRESS(UPPER6-BIT)
Designatethesegment inwhichBG-SCdataintheVRAM is
stored.(1K-WORD/SEGMENT)
SCREENSIZE&SCREENREPETITION
S1 Sol SCREEN SIZE S1SO SCREEN SIZE
SCO SCO SCO SCO
0 0 0
SCO SCO SC1 SC1
SCO SC1 SCO
SCO SC1
SC2 SC3 SC2
SCO SC1
一
SCO SC1 SCO
(NCL PG 49)
2-27-4
```

<!-- book1 p119 -->

```
PPUREGISTERS
ADDRESS: 210BH/ 210CH
NAME: BG12NBA/BG34NBA
CONTENTS:BGCHARACTERDATAAREADESIGNATION
D7 D6 D5 D4 D3 D2 D1 DO
BG2 NAMEBASEADDRESS BG1NAMEBASEADDRESS
210BH
A3 A2 A1 AO A3 A2 A1 A0
BG4NAMEBASEADDRESS BG3 NAMEBASEADDRESS
210C H
A3 |A2|A1 AO A3 A2 |A1AO
BACKGROUND NAME BASE ADDRESS (UPPER 4-BIT):
Designate thesegment addressin theVRAM inwhichBG character data
isstored.(4K-WORD/SEGMENT)
ADDRESS: 210DH/210EH
NAME: BG1H0FS/BG1V0FS
CONTENTS:H/V SCROLLVALUEDESIGNATIONFORBG-1
D7 D6 D5. D4 D3 D2 D1 DO
BG 1 H-OFFSET (LOW,HIGH)
(H012) (H011). (H010) (60H) (H08) 210DH
H0 7 H0 6 H05 H0 4 H03 H02 H0 1 Ho 0
BG 1 V-OFFSET (LOW,HIGH)
(V012).(V011).(V010) (V09) (V08) 210EH
v07丨v06|v05| V0 4  V03 V0 2 V0 1 Voo
10-Bit maximum (0 ~ 1023) can be designated for H/V scroll value. (The size of
13-Bit maximum {-4096 ~ 4095} can be designated in MODE -7).
(pages A-10 and A-11)
By writing to the register twice, the data can be set in the order of Low and High.
(NCL PG 50)
2-27-5
```

<!-- book1 p120 -->

```
SNESDEVELOPMENTMANUAL
ADDRESS: 210FH/2110H/2111H/2112H/2113H/2114H
NAME: BG2H0FS/BG2V0FS/BG3H0FS/BG3V0FS/BG4H0FS/BG4V0FS
CONTENTS:H/V SCROLLVALUEDESIGNATION FORBG-2,3,4
D7 D6 D5 D4 D3 D2 D1 DO
BG H-OFFSET (LOW, HIGH) 210FH
(6 0H) (H0 8) 2111H
HO 7|HO 6| HO5 HO 4 |HO 3  H0 2 H0 1 2113H
HO 0
BG V-OFFSET (LOW, HIGH) 2110H
(V09) (V08) 2112H
v07|v06|v05|v04丨v03丨v02| V0 11 Vo0 2114H
10-Bit maximum (0 ~ 1023) of the H/V scroll value can be designated
(page A-10)
By writing to the register twice, the data can be set in the order of Low-
and High.
ADDRESS: 2115H
NAME: VMAINC
D7 D6 D5 D4 D3 D2 D1 DO
H/L V-RAMADDRESSSEQUENCEMODE
FULL GRAPHIC SC INCREMENT 2115H
INC G1 G0 11 10
Designate theincrement value for theVRAM
address. (page A-8)
G1 G0 10 INCREMENTVALUE
0 1 0 0 Increment by 8 (for 32 times) (2-Bit Formation)
1 0 0 0 [ncrement by8(for 64times) (4-BitFormation)
1 1 0 0 Increment by8 (for 128times) （8-BitFormation)
0 0 0 0 Addressincrements1BY1
0 0 0 1 AddressIncrements32BY32
0 0 1 0 AddressIncrements128BY128
0 0 1 AddressIncrements128BY128
Designate the increment timing for the address
0:The addresswill be increased after.the data hasbeen written toregister<2118H>
orthedatahasbeenreadfromregister<2139>.
1:The address will be increased afterthe data has been written to register<2119H>
or thedatahasbeenreadfromregister<213AH>.
(NCL PG 51)
2-27-6
```

<!-- book1 p121 -->

```
PPU REGISTERS
ADDRESS: 2116H / 2117H
NAME: VMADDL/VMADDH
CONTENTS:ADDRESSFORVRAMREADANDWRITE
D7 D6 D5 D4 D3 D2 D1 DO
VRAM ADDRESS (LOW)
2116H
A7 A6 A5 A4 A3 A2 A1| AO
VRAM ADDRESS (HIGH)
2117H
A15 A14A13A12丨A11 A10|A9丨A8
。 This is the initial address for reading from the VRAM or writing to the VRAM.
The data isread or writtenby the addressset initially,and every time the data is
read or written,the addresswill be increased automatically.
The value to be increased is determined by “SC INCREMENT"of register
<2115H> and the setting value of the “FULL GRAPHIC."
ADDRESS: 2118H/2119H
NAME: VMDATAL/VMDATAH
CONTENTS:DATA FORVRAM WRITE
D7 D6 D5 D4 D3 D2 D1 DO
VRAM DATA (LOW)
2118H
A71A6 A5 A4 A3 A2丨A1AO
VRAM DATA (HIGH)
2119H
A15|A14|A13A12A11|A10|A9|A8
This is the screen data and character data (BG & OBJ), which can be written to
anyaddressintheVRAM.
According to the settings of register <2115H> “H/L INC," the data can be written
to the VRAM as follows:
H/L INC WRITE TO REGISTER OPERATION
0 Writeto<2118H>only Thedataiswrittentolower8-bitoftheVRAMand
theaddresswillbe increasedautomatically.
Write to<2119H> only The data is written to upper 8-bit of the VRAM and
the address will be increased automatically.
0 Write in the order of When the data is set in the order of upper and lower,
<2119H> and <2118H> the address will be increased.
1 Write in the order of When the data is set in the order of lower and upper,
<2118H> and <2119H> the address will be increased
NOTE: The data can be writen only during V-BLANK or FORCED BLANK period.
(NCL PG 52)
2-27-7
```

<!-- book1 p122 -->

```
SNESDEVELOPMENTMANUAL
ADDRESS: 211AH
NAME: M7SEL
CONTENTS:INITIALSETTINGINSCREENMODE-7
D7 D6 D5 D4 D3 D2 D1 DO
SCREENOVER SCREEN FLIP
211AH
01 00 V H
>HORIZONTALVERTICAL FLIP:
H-FLIP/V-FLIPin theScreen
Mode-7
V H DISPLAY
0 0 Normal display
0 1 H-Directional Flip only
0 V-Directional Flip only
BothH&VDirectionalFlip
Thefollowingprocess ismade if thescreen tobe displayed isoutsideof thescreen
area.
01 00 PROCESSOUTOFAREA
0 0 Screen repetitionif outside ofscreenarea
1 0 Outside of the screen area is the Back Drop Screen in single color
1 Character#Orepetitionifoutsideofscreenarea
(NCL PG 53)
2-27-8
```

<!-- book1 p123 -->

```
PPUREGISTERS
ADDRESS:211BH/211CH/211DH/211EH/211FH/2120H
NAME: M7A/M7B/M7C/M7D/M7X/ M7Y
CONTENTS:ROTATION/ENLARGEMENT/REDUCTIONIN MODE-7,CENTER COORDINATE
SETTINGS&MULTIPLICAND/MULTIPLIERSETTINGSOFCOMPLEMENTARY
MULTIPLICATION
D7 D6 D5 D4 D3 D2 D1 DO
MATRIXPARAMETERA (LOW,HIGH)
(MP15) (MP14), (MP13). (MP12). (MP11). (MP10) (MP9) . (MP8) 211 BH
MP 7 MP6 MP5 MP 4 MP3 MP2|MP1 MP0
MATRIXPARAMETERB(LOW,HIGH)
(MP15) (MP14), (MP13). (MP12), (MP11). (MP10) (MP9) (MP8) 211 CH
MP7 MP6|MP5|MP4MP3|MP2|MP1 MP0
MATRIX PARAMETER C (LOW,HIGH)
(MP15). (MP14), (MP13). (MP12). (MP11). (MP10) (MP9) . (MP8) 211 DH
MP 7 MP 6 MP5 MP4 MP3 MP 2] MP1 MP0
MATRIX PARAMETER D (LOW, HIGH)
(MP15)( (MP14). (MP13). (MP12). (MP11).( (MP10) (MP9) (MP8) 211 EH
MP7 MP 6 MP 5 MP4 MP 3 MP 2 MP 1 MP0
The 8-bit data should be written twice in the order of lower and upper.
Then, the parameter of rotation, enlargement and reduction should be
set by its 16-bit data.
The value down to a decimal point should be set to the lower 8-bit. The
signed bit. There is a decimal point between M7 & M8.)
FORMULA FOR ROTATION/ENLARGEMENT/REDUCTION(Refer to
Rotation/Enlargement/Reduction in Appendix A.).
A = cos x (1 / α), B = siny× (1 / α), C = -sinx(1 / β), D = cosyx(1 / β)
Y: Rotation angle α: Reduction Rates for X (H) β: Reduction Rates for Y (v)
X。 · Yo : Center Coordinate,X, · Y1 : Display Coordinate,
X2 · Y2 : Coordinate Before Calculation
(NCL PG 54)
2-27-9
```

<!-- book1 p124 -->

```
SNESDEVELOPMENTMANUAL
Set the value of "A" to the register <211BH>. In the same way, set
"B~D" to the register <211CH> ~ <211EH>.
in  auop q uo (a-a x la-it) uodn euaaidwo au
registers <211BH> <211CH>. When setting 16-bit data to register
<211BH> (must be written twice) and 8-bit data to register <211CH>
(must be written only once), the multiplication result can be indicated
rapidly by reading registers <2134H> ~ <2136H>.
D7 D6. D5 D4 D3 D2 D1 DO
CENTER POSITION X。 (LOW, HIGH)
211 FH
(X12).(X11)，(X10)，(X9) (X8)
X7】X61×5[ X4 X3 X2X1 X0
CENTER POSITIONY。(LOW,HIGH)
(Y12)。 (Y11),(Y10),(Y9).(Y8) 2120H
Y7丨Y6|Y5 Y4 Y3 Y2】 Y1I.Y0
The center coordinate (Xo Yo) for Rotation/Enlargement/Reduction can
be designated by this register.
The coordinate value of Xo & Yo can be designated by 13-bit (comple-
ment of 2).
This register requires that the lower 8-bit set first and the upper 5-bit is
set. Therefore, 13-bit data in total can be set.
(NCL PG 54)
2-27-10
```

<!-- book1 p125 -->

```
PPUREGISTERS
ADDRESS:2121H
NAME: CGADD
CONTENTS:ADDRESSFORCG-RAM READANDWRITE
D7 D6 D5 D4 D3 D2 D1 DO
CGRAMADDRESS
2121H
A7 1A6A5 A4 A3 A2 A1 A0
This is the initial address for reading from the CG-RAM or writing
to the CG-RAM.
The data is read by address set initially, and every time the data
is read or written, the address will be increased automatically.
ADDRESS: 2122H
NAME: CGDATA
CONTENTS:DATAFORCG-RAMWRITE
D7 D6 D5 D4 D3 D2 D1 DO
CGRAMDATA(LOW,HIGH)
(D14) 2122H
(D13) (D12) (D11) (D10) (D9) (D8)
D7 D6 D5 D4 D3 D2 D1 DO
This is the color generator data to be written at any address of the
CG-RAM.
The mapping of BG1 ~ BG 4 and OBJ data in the CG-RAM will be
determined, which is performed by every mode selected by “BG
MODE"of register <2105H>. (See page A-17)
There are the color data of 8 palettes for each screen of BG1 ~
BG4. The palette selection is determined by 3-bit of the SC data
"COLOR."(Refer to page A-10)
Because the CG-RAM data is 15-bit/word, it is necessary to set low-
er 8-bit first to this register and then upper 7-bit should be set. When
both lower and upper are set, the address will be increased by 1 au-
tomatically.
NOTE: After the address is set, the data should be written in the or-
der of low, then high. This is similar to the OAM Data register.
NOTE: The data can be written only during H/V BLANK or FORCED
BLANK period.
(NCL PG 55)
2-27-11
```

<!-- book1 p126 -->

```
SNESDEVELOPMENTMANUAL
ADDRESS: 2123H/2124H/2125H
NAME: W12SEL/W34SEL/WOBJSEL
CONTENTS:WINDOW MASKSETTINGS (BG1~BG4,OBJ,COLOR)
D7 D6 D5 D4 D3 D2 D1 DO
BG2 WINDOW BG1 WINDOW
2123H
W2EN|IN/OUT|W1ENIN/OUTW2ENIN/OUT|W1EN|IN/OUT
BG4WINDOW BG3WINDOW
2124H
W2EN|IN/OUT|W1EN|IN/OUTW2EN|IN/OUT|W1EN|IN/OUT
COLORWINDOW OBJ WINDOW
2125H
W2EN |IN/OUT[W1ENIN/OUTW2EN|IN/OUT|W1ENIN/OUT
WINDOw IN/OUT : The window mask area can be designated
whetherinsideoroutsideoftheframe
designated by the window position.
IN OUT
0:IN
1: OUT
*:DISPLAY AREA
0:OFF
WINDOW-1 ENABLE: Window-1 ON/OFF Designation
1: ON
WINDOW-2ENABLE:WindoW-2ON/OFF
The COLORWINDOw is a window for main and sub screen.(It is related to theregister
<2130H>).
ADDRESS: 2126H/2127H/2128H/2129H
NAME: WH0/WH1/WH2/WH3
CONTENTS: WINDOW POSITION DESIGNATION (Refer to page A-18)
D7 D6 D5 D4 D3 D2 D1 DO
2126H WINDOW-1 LEFT
WINDOWH0/H1/H2/H3POSITION 2127H POSITION
DESIGNATION
P5 P4 P3 」P2」P1 2128H
P7 P6 PO
2129H
WINDOW H0 POSITION<2126H>:WINDOW-1Left Position Designation.It can be set in range 0 ~255
WINDOWH2POSITION<2128H>:WINDOW-2LeftPositionDesignation.Itcanbesetinrange0255
NOTE: If LEFT POSITION SETTINGVALUE>RIGHT POSITIONVALUE"is aSSumed, there will
be no range of the window.
(NCL PG 56)
2-27-12
```

<!-- book1 p127 -->

```
PPUREGISTERS
ADDRESS: 212AH/212BH
NAME: WBGLOG/WOBJLOG
CONTENTS:MASKLOGICSETTINGSFORWINDOW-1&2ONEACHSCREEN
D7 D6 D5 D4 D3 D2 D1 DO
WINDOW LOGIC
BG4 BG3 BG2 BG1 212AH
D1 DO D1 DO D1 D1丨 DO
WINDOWLOGIC
Color OBJ
212BH
D1 DO D1 DO
WINDOWLOGIC:SETMASKLOGICFORWINDOW-1&2
When both Window-1 and Window-2 are “IN," the shaded portion will be masked as follows:
W1 : Window 1
W2 : Window 2
W1
W2
D1 DO LOGIC
0 0 OR
0 1 AND
1 0 XOR
XNOR
W1
W2
NOTE: “IN/OUT"of registers <2123H><2124H><2125H>becomes the “NOT logic"for each
Window-1andWindow-2.
(NCL PG 57)
2-27-13
```

<!-- book1 p128 -->

```
SNESDEVELOPMENTMANUAL
ADDRESS:212CH
NAME: TM
CONTENTS:MAIN SCREEN DESIGNATION
D7 D6 D5 D4 D3 D2 D1 DO
THROUGHMAIN
212CH
OBJ BG4 BG3 BG2 BG1
MAINSCREENDESIGNATION:
Designate the screen (BG1 ~ BG4, OBJ)
tobe displayed as theMain Screen.
Designatethescreen tobe added for the
screen addition/subtraction .
0 : DISABLE
1 : ENABLE
ADDRESS: 212DH
NAME: TS
CONTENTS:SUBSCREENDESIGNATION
D7 D6 D5 D4 D3 D2 ‘D1 DO
THROUGHSUB
212DH
OBJ BG4 BG3 |BG2 BG1
SUBSCREENDESIGNATION:
Designate the screen (BG1~BG4,OBJ)
tobedisplayed asSUB-Screen.
Designatethescreentobeaddedforthe
screenaddition/subtraction
0 : DISABLE
1 : ENABLE
NOTE:Whenthescreenaddition/subtractionisfunctioning.theSUBscreenisascreen
to be added or subtracted against the MAiN screen.
(NCL PG 58)
2-27-14
```

<!-- book1 p129 -->

```
PPUREGISTERS
ADDRESS:212EH
NAME: TMW
CONTENTS:WINDOW MASK DESIGNATION FOR MAIN SCREEN
D7 D6 D5 D4 D3 D2 D1 DO
THROUGH MAIN (WINDOW)
212EH
OBJ BG4 BG3 BG2 2BG1
WINDOWMASKDESIGNATIONFOR
MAIN SCREEN:
In the window area designated by
register<2123H>~<2129H>,the
screen to be displayed can be
designated,whichisselectedamong
theMain screen designatedby
register <212CH>.
0 : DISABLE
1 : ENABLE
ADDRESS: 212FH
NAME: TSW
CONTENTS:WINDOWMASKDESIGNATIONFORSUBSCREEN
D7 D6 D5 D4 D3 D2 D1 DO
THROUGH SUB (WINDOW)
212FH
OBJ BG4 BG3 BG2 BG1
WINDOWMASKDESIGNATIONFOR
SUB SCREEN:
In the window area designated by
register <2123H>~<2129H>,the
screen to be displayed can be
designated,whichisselected among
the Sub screen designated by
register <212DH>.
0:DISABLE
1 : ENABLE
NOTE:When the screen addition/subtraction is functioning,the SUB screen is a screen
tobe addedorsubtractedagainsttheMAiNscreen.
(NCL PG 59)
2-27-15
```

<!-- book1 p130 -->

```
SNESDEVELOPMENTMANUAL
ADDRESS:2130H
NAME: CGSWSEL
D7 D6 D5 D4 D3 D2 D1 DO
COLORWINDOWON/OFF CCADDDIRECT
MAIN SW (A) SUB SW (B) 2130H
M1 MO S1 S0 ENABLESELECT
DIRECT SELECT (Refer to p. A-17):
TheVRAMdata(Color&Character
data) become the color data directly.
(Onlywhen mode-3, 4& 7 are
selected.)
-0:DISABLE
1: ENABLE
FIXED COLOR
ADDITION/SUBTRACTION ENABLE:
Designate whether 2 kinds of the data should
beadded/subtractedfromeachotherornot,
whichare thefixedcolor setbyregister
<2132H>andthecolordatawhichissetto
the CGRAM.
0 : ADDITION/SUBTRACTION
FOR FIXED COLOR
1 : ADDITION/SUBTRACTION
FORSUBSCREEN
COLORWINDOWON/OFFMAIN/SUBSWITCH:
When the Color Window is functioning,
the assignment of the window area for
MAIN and SUB screens can be designated.
MO
S1)(S0 FUNCTION
0 0 ON (All the time)
0 1 ON(insidewindowonly)
0 ON(Outsidewindowonly)
OFF(Ali the time)
(NCL PG 60)
2-27-16
```

<!-- book1 p131 -->

```
PPUREGISTERS
ADDRESS:2131H
NAME: CGADSUB
OBJ&BACKGROUND COLOR
D7 D6 D5 D4 D3 D2 D1 DO
ADD 1/2 ADDorSUBENABLE
2131H
SUB ENABLE BACK OBJ BG 4 BG 3BG 2| BG 1
COLOR DATAADDITION/SUBTRACTIONENABLE:
Designate the color data of BG1 ~ BG4,OBJ, or Back in
the main screen for addition/subtraction of the Sub screen
color data (or fixed color data.)
-0:DISABLE
- 1 :ENABLE (Addition/Subtraction function: ON)
Note: When OBJ is designated, the Addition/Subtraction
function is available only when the OBJ color palette is 4
through 7.
"1/2OF COLORDATA"DESIGNATION:
When color constant addition/subtraction or screen addition/
subtraction is performed, designate whether the RBG result in the
addition/subtraction area should be "1/2" or not. The back
(color constant) area on the Sub·screen, will not become "1/2"
0:DISABLE
-1 : ENABLE (1/2 function: ON)
COLOR DATA ADDITION/SUBTRACTION SELECT:
In the case of executing screen
addition/subtraction,designate
either addition or subtraction mode.
0 :ADDITION MODE SELECT
1 : SUBTRACTION MODE SELECT
(NCL PG 60)
2-27-17
```

<!-- book1 p132 -->

```
SNESDEVELOPMENTMANUAL
ADDRESS: 2132H
NAME: COLDATA
CONTENTS:FIXEDCOLORDATAFORFIXEDCOLORADDITION/SUBTRACTION
D7 D6 D5 D4 D3 D2 D1 DO
COLORCONSTANTDATA
COLORBRILLIANCE DATA 2132H
BLUE GREEN RED D4 D2 D1 DO
COLOR CONSTANTDATA:
Set the color constant data-for-color constant
addition/subtraction.
COLOR DESIGNATION: Bit for Selecting Desired Color
R/G/B brightness should be set using 5-bit data. Example:
RED COH, 3EH (B=00H, G=00H, R=1FH)
GREEN A0H,5FHB=00H,G=1FH,R=00H)
BLUE 60H,9FH (B=1FH,G=00H,'R=00H)
WHITE EFH
BLACK EOH
(NCL PG 61)
2-27-18
```

<!-- book1 p133 -->

```
PPUREGISTERS
ADDRESS: 2133H
NAME: SETINI
CONTENTS:SCREEN INITIAL SETTING
D7 D6 D5 D4 D3 D2 D1 DO
EXT. EXT. PSEUDO 224 OBJ-V INTER-
2133H
SYNC. INPUT 512 239 SELECT LACE
SCANNING INTERLACE(1)
NON/INTERLACE(O) SELECTION:
(Related to <2105H>)
OBJ V-DIRECTION DISPLAY:米
In the interlace mode, select either 1 dot
per line or 1 dot repeated every 2 lines. If "1"
is written, the OBJ'appears to be reduced to
half its vertical size.
BGV-DIRECTION DISPLAY:
Switch the display line of a field to 224-Line 0r 239-Line.
(In case of interlace mode, it will be doubled dot.)
C0 : 224 LINES
-1:239 LINES
HORIZONTALPSEUDO512 MODE:
An imaginary resolution of 512 (Horizontal) can
be created by shifting the SUB screen half dot to
the left, alternately every field:
-0:DISABLE
.1:ENABLE
EXTBG MODE (SCREEN EXPAND):
Enable the data supplied from the external LSi. For the Super NES,
enable when the screen with priority is used on mode-7.
EXTERNAL SYNCHRONIZATION:
Used for super-imposing images, etc. Normally, "0" should be written.
米 If "D1" is set in non-interlace mode, even and odd numbered lines of the OBJ
will be displayed alternately every field.
(NCL PG 61)
2-27-19
```

<!-- book1 p134 -->

```
SNESDEVELOPMENTMANUAL
ADDRESS:2134H/2135H/2136H
NAME: *MPYL/ *MPYM/ *MPYH
CONTENTS:MULTIPLICATIONRESULT
D7 D6 D5 D4 D3 D2 D1 DO
M py (Low)
2134H
M7 M6 M5 M4 M3 M21. M1| MO
MP Y (MID)
2135H
M15M14 M13 M12 M11 M10| M9 M8
M P Y (HIGH)
2136H
M23M22M21 M20  M19| M18|M17 M16
This is a Multiplication result (complement of 2) and can be read by seting 16-bit to
register<211BH>andsetting8-Bitdata toregister<211CH>
ADDRESS: 2137H
NAME: *SLHV
CONTENTS:SOFTWARELATCH FOR H/V COUNTER
D7 D6 D5 D4 D3 D2 D1 DO
SOFT LATCH FOR H/V COUNTER
2137H
SL71SL6 S SL5 SL4 SL3 SL2 SL1 SLO
The H/V counter value at the point when register <2137H> is read can be latched.
The data which was read is meaningless data.
The H/V counter value latched can be referred by registers <213CH> and
<213DH>.
(NCL PG 62)
2-27-20
```

<!-- book1 p135 -->

```
PPUREGISTERS
ADDRESS:2138H
NAME: *OAMDATA
CONTENTS: READ DATA FROM OAM
D7 D6 D5 D4 D3 D2 D1 DO
OAMDATA (LOW,HIGH)
2138H
D7 D6 D5 D4 D3 D2 D1 DO
This is a register, which can read the data at any address of the OAM.
When the address is set to register <2102H> <2103H> and register <2138H> is
also accessed, the data can be read in the order of Low 8-Bit/High 8-Bit. Afterward,
theaddresswill be increased automaticaly,and the data of thenext addresscan
be read.
NOTE: The data can be read only during H/V BLANK or FORCED BLANK period.
ADDRESS: 2139H / 213AH
NAME: *VMDATAL/*VMDATAH
CONTENTS:READDATAFROMVRAM
D7 D6 D5 D4 D3 D2 D1 DO
VRAM DATA (LOW)
2139H
D71 D6 丨D5 」D4 D3 D2 D11 DO
VRAMDATA(HIGH)
213AH
D15|D14|D13|D12| D11| D10|D9|D8
This is a register, which can read the data at any address of the VRAM.
The initial address should be set by registers <2116> and <2117H>. The data can
beread by the addresswhichhasbeen set initially.
When reading the data continuously,the first data for the address increment
should be read as“dummy"data after the address has been set.
Quantity to be increased will be determined by “SC INCREMENT" of register
<2115H> and the setting value of the “FULL GRAPHIC."
NOTE: The data can be read only during HV BLANK or FORCED BLANK period.
(NCL PG 63)
2-27-21
```

<!-- book1 p136 -->

```
SNESDEVELOPMENTMANUAL
ADDRESS: 213BH
NAME: *CGDATA
CONTENTS:READDATAFROMCG-RAM
D7 D6 D5 D4 D3 D2 D1 DO
CG DATA (LOW,HIGH)
(D14) (D13) (D12) (D11) (D10) (D9) (D8) 213BH
D7 D6 D5 D4 D3 D2 D1 DO
This is a register, which can read the data at any address of the CG-RAM.
The initial address can be set by register <2121H>. The lower 8-Bit is read first,
and then the upper 7-Bit will be read by accessing the register. The current ad-
dresswill be increased to the next address at thesame time the upper 7-Bit is
read.
Note: The data can be read only during H/V blank or forced blank period.
ADDRESS: 213CH/213DH
NAME: *OPHCT/*OPVCT
CONTENTS:H/VCOUNTERDATABYEXTERNALORSOFTWARELATCH
D7 D6 D5 D4 D3 D2 D1 DO
OUTPUTDATAOFH-COUNTER
(H8) 213CH
H7 H6 H5 H4 H3 H2 H1 HO
OUTPUTDATAOFV-COUNTER
213DH
(V8)
V7 V6 丨V5 V4 V3 V2 V1 Vo
The H/V counter is latched by reading register <2137H>, and its H/V counter val-
ue can be read by this register.
The H/V counter is also latched by the external latch, and its value can be read by
this register.
If register <213CH> or <213DH> is read after register <213FH> has been read,
the lower 8-Bit data will be read first, and then the upper 1-Bit will be read by
reading the register.
(NCL PG 64)
2-27-22
```

<!-- book1 p137 -->

```
PPUREGISTERS
ADDRESS:213EH
NAME: *STAT77
CONTENTS:PPUSTATUSFLAG&VERSIONNUMBER
D7 D6 D5 D4 D3 D2 D1 DO.
TIME RANGE MASTER 5C77VERSIONNUMBER
213EH
OVER OVER /SLAVE
MASTER/ SLAVE MODE SELECT: LSI MODE (Normally“O"is Set)
OBJ DISPLAY STATUS (ON A HORIZONTALLINE)
-RANGE:WhenQuantityof theOBJ(regardlessof thesize)becomes33pcs or more,
"1" will be set.
-TIME: When quantity of the OBJ which is converted to "8 x 8-SIZE" is 35 pcs or more,
"1" will be set
NOTE: The flag will be reset at the end of theV-BLANK period.
ADDRESS: 213FH
NAME: *STAT78
CONTENTS:PPU STATUSFLAG&VERSION NUMBER
D7 D6 D5 D4 D3 D2 D1 DO
FIELD EXT. NTSC 5C78VERSIONNUMBER
213FH
LATCH /PAL
DISPLAY METHOD 0: NTSC
1:PAL
EXTERNAL LATCHFLAG:When the external signal (Light Pen,etc.)is applied,it
enablestolatch theH/Vcountervalue.It isconnected toI/Oportd7inSNEs.
(Refer to page 1-28-1.)
This is astatusflag,which indicateswhether the 1st or 2nd field is scanned at the interlace
mode.(The definition is different from the field of NTSC.)
0 : 1ST FIELD
1 : 2ND FIELD
NOTE: When this register is read, registers <213CH> <213DH> will be initialized individually in the
order of Low and High.
(NCL PG 65)
2-27-23
```

<!-- book1 p138 -->

```
SNESDEVELOPMENTMANUAL
ADDRESS: 2140H/2141H/2142H/2143H
NAME: APUIO0/APUIO1/APUIO2/APUIO3
CONTENTS:COMMUNICATIONPORTWITHAPU
D7 D6 D5 D4 D3 D2 D1 DO
2140H
APU 10 PORT 2141H
2142H
2143H
The port provides more registers for the purpose of IN/OuT, which
are 8 registers in total in the APU. Therefore, the different register
will be accessed, whether reading or writing for the same address.
Refer toPart 2 of this manual for the details of the communication
method.
(NCLPG 66)
2-27-24
```

<!-- book1 p139 -->

```
PPU REGISTERS
ADDRESS:2180H
NAME: WMDATA
CONTENTS:DATA to consecutivelyread from and write toWRAM
D7 D6 D5 D4 D3 D2 D1 DO
WORKRAMDATA
2180H
A7丨A6！A5丨 A4 A3 A2| A11 A0
·Data to consecutively read and write at any address of WRAM
Data is read and written at address set by register <2181H> ~ <2183H>, and
address automatically increases each time data is read or written.
ADDRESS: 2181H/2182H/2183H
NAME: WMADDL/WMADDM/WMADDH
CONTENTS:Address to consecutively read and write WRAM
D7 D6 D5 D4 D3 D2 D1 DO
WORKRAMADDRESS(LOW)
2181H
A7 A6 A5|A41.A3↓ A2」 A1 A0
WORKRAMADDRESS(Mid)
2182H
A15A14 A13|A12|A11 A10 A9 A8
WORKRAMADDRESS (High)
2183H
A16
Address to be set beforeWRAM is consecutively read or written.
A0 through A16 at register <2181H> ~ <2183H> is lower 17 bit address to show
address 7E0000 ~7FFFFF Memory.
(NCL PG 66a)
2-27-25
```

<!-- book1 p140 -->

```
SNESDEVELOPMENTMANUAL
Chapter 28. ( CPU Registers
ADDRESS :4200H
NAME :NMITIMEN
READ
D7 D6 D5 D4 D3 D2 D1 Do
NM1 STANDARD
TIMER ENABLE
CNTRL 4200H
ENABLE
V-EN H-EN ENABLE
STANDARDCONTROLLERENABLE
-0:Disable Automatic reading of Standard Controller
-1 : Enable Automatic reading of Standard Controller
米 Reading the data can be started at the beginning of
V -Blank period,but it takes about 3 or 4 scanning
lines to complete the read.
TIMERENABLE
-V-EN:V-COUNTTIMERENABLE
- H - EN: H- COUNT TIMER ENABLE
V
FUNCTION
ENEN
0 0 DisableBOTH H&V.
0 1 Enable H only.IRQ is applied by H - count timer value designated.
1 0 EnableV only.IRQ is applied by V - count timer value designated.
1 Enableboth H & V.IRQ is applied byboth H and V count timer value designated.
NMI ENABLE: Enable NMl at the point when V-Blank begins.
0 :NMIDISABLE
L1 : NMI ENABLE
ADDRESS:4201H
NAME : WRIO
CONTENTS:PROGRAMMABLEI/O PORT(OUT-PORT)
D7 D6 D5 D4 D3 D2 D1 D0
1/0 PORT
4201H
D7 D6 D5 D4 D3 D2 D1 DO
This is a Programmable I/O port (OUT - PORT). The written data will be output directly from
the OUT - PORT.
When this is used as a INPORT, "1" should be written to the particular bit which will be used
as a IN - PORT. The input data can be read by register <4213H>.
OnlyD6andD7canbe used bytheSuperNES.StandardController I and Ill(connector1)
hassignal atD6 andStandardControllierll and IV(connector2)has signal at D7. Signal at
(NCL PG 88)
2-28-1
```

<!-- book1 p141 -->

```
CPUREGISTERS
ADDRESS:4202H/4203H
NAME :WRMPYA/WRMPYB
CONTENTS:MULTIPLIER&MULTIPLICANDBYMULTIPLICATION
D7 D6 D5 D4 D3 D2 D1 DO
MULTIPLICAND -A
4202H
A7 A6 A5 A4 A3 A2 A1 A0
MULTIPLIER- B
4203H
B7 B6 B5 B4 B3 B2 B1 B0
This is a register, which can set as multiplicand (A) and a multiplier (B) for Absolute
9 =( -)x( -),
A PRODUCT (C) can be read by registers <4216H><4217H>.
Set in the order of (A) and (B). The operation will start as soon as (B) has been set, and it
will be completed right after an 8-machine cycle period.
Once the data of theA-REGlSTER is set,it will notbe destroyed until new data is set.
ADDRESS:4204H/4205H/4206H
NAME :WRDIVL/WRDIVH/WRDIVB
CONTENTS: DIVISOR & DIVIDEND BY DIVIDE
D7 D6 D5 D4 D3 D2 D1 Do
DIVIDEND- C (LOW)
4204H
C7 C6 C5 C4 C3 C2 C1 CO
DIVIDEND- C (HIGH)
4205H
C15 C14 C13 C12 C11 C10 C9 C8
DIVISOR - B
4206H
B7 B6 B5 B4 B3 B2 B1 B0
This is a register, which can be set as Dividend (C) and a Divisor (B) for Absolute Divide
of “C (16-bit) ÷ B (8-bit) = A (16-bit)".
The Quotient (A) can be read by registers<4214H><4215H>.And the remainder can be read
by registers<4216H><4217H>.
Set in the order of (C) and (B). The operation will start as soon as (B) has been set, and it
will becompleted right after a 16-machinecycleperiod.
Once the data of the C-REGISTER is set, it will not be destroyed until new data is set.
(NCL PG 89)
2-28-2
```

<!-- book1 p142 -->

```
SNESDEVELOPMENTMANUAL
ADDRESS:4207H/4208H
NAME :HTIMEL / HTIMEH
CONTENTS:H-COUNT TIMER SETTINGS
D7 D6 D5 D4 D3 D2 D1 DO
H - COUNT TIMER
4207H
H7 H6 H5 H4 H3 H2 H1 OH
H MSB
4208H
H8
This is a register, which can set the H-COUNT TIMER value.
The storedvalue should befrom 0 through 339,which is counted from the farleft on the screen.
When the coordinate counter becomes the count value set, the IRQ will be applied.
And at the same time,"1"will be written to “timer IRQ"of register <4211H>(READ RESET).
Enable/Disable of the interrupt will be determined bysettingregister<4200H>.
米 长This continuous counter is reset every scanning line, therefore once the count value is stored,
it is possible to apply the IRQ every time the scanning line comes to the same horizontal
position on the screen.
ADDRESS:4209H/420AH
NAME :VTIMEL/VTIMEH
CONTENTS:V-COUNT TIMER SETTINGS
D7 D6 D5 D4 D3 D2 D1 Do
V-COUNT TIMER
4209H
V7 V6 V5 V4 V3 V2 V1 vo
VMSB
420AH
V8
This is a register,which canset theV-COUNT TIMERvalue.
·The storedvalue should be from0 through 261(262),which is counted from topof the
screen.(This line number described is different from the actual line number on the screen.)
When thecoordinatecounterbecomes thecountvalueset,theIRQwillbeapplied.
At the same time, "1"willbe written to “timer IRQ"of register <4211H>(READ RESET).
Enable/Disable of the interrupt will be determined by settingregister<42o0H>.
米 Thisisacontinuouscounter like theH-counter andwillresetevery time262linesare
scanned. Once the count value is stored, it ispossible to apply the IRQ every time the
scanning line comes to the same verticai position on the screen.
(NCL PG 90)
2-28-3
```

<!-- book1 p143 -->

```
CPUREGISTERS
ADDRESS:420BH
NAME :MDMAEN
D7 D6 D5 D4 D3 D2 D1 D0
GENERAL PURPOSE DMA ENABLE FLAG
420BH
CH7 EN | CH6 EN 丨 CH5 EN CH4 EN | CH3 EN | CH2 EN 丨CH1 EN |CH0 EN
General purpose DMA consists of 8 channels total (CH0 ~ CH7).
This is used to designate 1 of the 8 channeis (8 channels maximum).
fo hg aui o, . i, bum Ka paeuiisap aa ueo pasn aq ot jauueuo aui
this channel. As soon as "1" is written to the bit (after a few cycles have passed),
the general purpose DMA transfer will begin.
When general purpose DMA of the designated channel is completed, the
flagwill be cleared.
NOTE: Because the data area(register<430oH>~) of each channel is held in common with the data
of eachH-DMA channel, the channel designated by theH-DMA channel designationregister
<420CH> can not be used. (It is prohibited to write1" to the bit of the channel).Therefore 8
started,thegeneralpurposeDMAwill bediscontinued inthemiddle andresumedright after
theH-DMAiscomplete.
NOTE: If 2 or more channels are designated, theDMA transferwill beperformed continuously
according to the priority order described on page B-1. The CPU will also stop operation until
all the general purpose DMAs are completed.
(NCL PG 91)
2-28-4
```

<!-- book1 p144 -->

```
SNESDEVELOPMENTMANUAL
ADDRESS:420CH
NAME :HDMAEN
CONTENTS:CHANNEL DESIGNATION FOR H-DMA
D7 D6 D5 D4 D3 D2 D1 Do
H -DMA ENABLE FLAG
420CH
CH7 EN |CH6 EN CH5 EN CH4 EN CH3 EN CH2 EN | CH1 EN CHO EN
The H-DMA consists of 8 channeis total (CH0 ~ CH7).
The register is used to designate the channel out of 8 channels (8 channels
maximum).
The channel which should be used can be designated by writing "1" to the bit of
this register. As soon as H-Blank begins (after a few cycles have passed), the
H-DMA transfer will begin.
NOTE: Once this flag is set, it will not be cleared until new data is set.
transfer pattern will be repeated. The flag is also set out of V-Blank period,
so the DMA transfer will be performed properly for the next screen frame.
ADDRESS:420DH
NAME :MEMSEL
CONTENTS:ACCESS CYCLE DESIGNATION IN MEMORY ② AREA (Refer to “Memory Map")
D7 D6 D5 D4 D3 D2 D1 Do
2.68
420DH
3.58
ACCESS CYCLE DESIGNATIONIN MEMORY ② AREA
-0 : 2.68MHz access cycle
- 1 : 3.58MHz access cycle (Only when the high speed memory is used)
MEMORY ② shows the address. (8000H ~ FFFFH) of the bank (80H ~ BFH)
and all the addresses of the bank (CoH ~ FFH).
When power is turned on or the reset signal is applied, it becomes “0".
(NCL PG 91&91a)
2-28-5
```

<!-- book1 p145 -->

```
CPUREGISTERS
ADDRESS:4210H
NAME :* RDNMI
CONTENTS:NMIFLAGBYV-BLANK&VERSIONNUMBER
D7 D6 D5 D4 D3 D2 D1 D0
BLANK SNES-CPUVERSIONNUMBER
4210H
NMI
NMI FLAG BY V-BLANK : When “1" is written to“NMI ENABLE"of register <4200H>, this
flag will show NMl status.
0 : NMI has not occurred
1 : NMI has occurred
* A "1" is written to this flag at the beginning of V-Blank and a "O" is written at the end of V-Blank.
Itcanalsoberesetbyreading thisregister.
NOTE : It is necessary to reset by reading this flag during NM1 processing. (Refer to page B-3.)
ADDRESS:4211H
NAME :* TIMEUP
CONTENTS:IRQFLAGBYH/V COUNT TIMER
D7 D6 D5 D4 D3 D2 D1 Do
TIMER
4211H
IRQ
IRQFLAGBYH/VCOUNTTIMER:
This flag is “READ RESET". (If Timer Enable is set by "Timer Enable"of register <4200H>,
IRQwili be applied and the flagwili be set assoon as H/V count timer reaches thevalue
stored.
※ Even if V-EN ="0" and H-EN ="0" are set by "Timer Enable" of register <4200H>, this flag will be
reset.
-0:EitherH/Vcounttimerisactiveordisabled
-1 : Status of H/V count timer is Time-Up
(NCL PG 92)
2-28-6
```

<!-- book1 p146 -->

```
SNESDEVELOPMENTMANUAL
ADDRESS:4212H
NAME : * HVBJOY
D7 D6 D5 D4 D3 D2 D1 D0
V H STANDARD
CNTRL 4212H
BLANK BLANK
ENABLE
STANDARD CONTROLLER ENABLE:
This flag shows the timing to
read thedataof theStandard
Controller. (However, it is
limited to the casewhere the
"STANDARDCNTRLENABLE"of
(,  s ! <o> 
0:This is a period when theStandard
Controller is not reading the data
or is disabled. (ln case “o" is set to
"STANDARD CNTRL ENABLE"of
register <4200H>)
-1 : This is a period when the Standard
Controller is reading data.
H-BLANKPERIODFLAG:It showswhether theScanisin the H-Blank
period or not.
0 : Out of H-Blank period
L 1 : In H-Blank period
V-BLANKPERIODFLAG:Itshowswhether thescanisintheV-Blankperiodornot.
0 : Out of V-Blank period
-1 : In V-Blank period 
ADDRESS:4213H
NAME :* RDIO
CONTENTS:PROGRAMMABLE VOPORT(IN-PORT)
D7 D6 D5 D4 D3 D2 D1 Do
1/0 PORT
4213H
D7 D6 D5 D4 D3 D2 D1 DO
This is a Programmable 1/O port (IN - PORT). The data which is set to the IN-PORT should
be read directly.
The bit in which "1" is written by register <4201H> is used as the IN-PORT.
Only D6and D7 can be used by the Super NES. Standard Controller I and Ill (connector 1)
has'signal at D6 and Standard Controller ll and IV(connector 2) has signal at D7. Signal at
D7 is also an external latch input signal (Refer to“PPU Status Flag and Version Number” in
"PPU Registers").
(NCL PG 93)
2-28-7
```

<!-- book1 p147 -->

```
CPUREGISTERS
ADDRESS:4214H/4215H
NAME :* RDDIVL/ * RDDIVH
CONTENTS:QUOTIENTOFDIVIDERESULT
D7 D6 D5 D4 D3 D2 D1 D0
QUOTIENT - A (LOW)
4214H
A7 A6 A5 A4 A3 A2 A1 A0
QUOTIENT - A (HIGH)
4215H
A15 A14 A13 A12 A11 A10 A9 A8
This is Quotient (A), which is a result of absolute division of
"C (16 BIT)÷B(8BIT)= A (16 BIT)".
Dividend (C) and divisor (B) are set by registers <4204H>, <4205H>, and <4206H>.
ADDRESS:4216H/4217H
NAME :* RDMPYL / * RDMPYH
CONTENTS:PRODUCTOFMULTIPLICATIONRESULT ORREMAINDEROFDIVIDERESULT
D7 D6 D5 D4 D3 D2 D1 Do
PRODUCT-C [MULTIPLICATION] / REMAINDER [DIVIDE] (LOW)
4216 H
C7 C6 C5 C4 C3 C2 C1 Co
PRODUCT-C [MULTIPLICATION] / REMAINDER [DIVIDE] (HIGH)
4 217H
C15 C14 C13 C12 C11 C10 C9 C8
① WHEN USED FOR MULTIPLICATION
●This is a Product (C), which is a result of Absolute Multiplication of
“A (8 BIT) XB (8BiT) =C (16 BIT)".
· Multiplicand (A) and Muitiplier (B) are set by registers <4202H> and <4203H>.
②WHENUSEDFORDIVISION
·This is a Remainder, which is a result of Absolute Division of
)     ()   )   ()  )
●Dividend (C) and divisor (B) are set by registers <4204H>, <4205H>, and <4206H>.
(NCL PG 94)
2-28-8
```

<!-- book1 p148 -->

```
SNESDEVELOPMENTMANUAL
ADDRESS:4218H/4219H/421AH/421BH/421CH/421DH/421EH/421FH
NAME :STDCNTRL1L/1H/2L/2H/3L/3H/4L/4H
CONTENTS:DATAFORSTANDARDCONTROLLERI,II, III,&IV
D7 D6 D5 D4 D3 D2 D1 Do
STANDARD CONTROLLER -I (LOW)
A X L R 4218H
BUTTON BUTTON BUTTON BUTTON
STANDARD CONTROLLER-I(HIGH)
B Y SELECT! START DIRECTIONAL PAD 4219H
BUTTON BUTTONBUTTON BUTTON UP DOWNILEFTI RIGHT
STANDARD CONTROLLER -II(LOW)
A X L R 421AH
BUTTON BUTTON BUTTON BUTTON
STANDARDCONTROLLER-II(HIGH)
B Y SELECTI START DIRECTIONAL PAD 421BH
BUTTON BUTTONE BUTTONBUTTON UP IDOWN|LEFT|RIGHT
STANDARD CONTROLLER-III (LOW)
A X L R 421CH
BUTTON|BUTTON|BUTTON|BUTTON|
STANDARD CONTROLLER-III(HIGH)
B Y SELECT1 START DIRECTIONAL PAD 421DH
BUTTON BUTTONBUTTON|BUTTON UP DOWN LEFTI RIGHT
STANDARDCONTROLLER-IV(LOW)
A X L R 421EH
BUTTON|BUTTON|BUTTON|BUTTON
STANDARDCONTROLLER-IV(HIGH)
B Y SELECTI START DIRECTIONAL PAD 421FH
BUTTONBUTTONBUTTON BUTTON UP DOWN LEFT RIGHT
For controller expansion
Registers<4016H><4017H>canbe used thesameas theNES.
PORT
D7 D6 D5 D4 D3 D2 D1 DO
4016H D0 : Data for Controller !.
4016H RD
4016H Di : Data for Controller Ill
OUT0,OUT1,OUT2(OUT1.and
4016HWR
OUT2'arenotoutputfromSNES)
401ZH D0 : Data for Controller I!
4017H RD
4017HDi:DataforControlleriv
NOTE:Whether the standard controllers are connected to Super NES unit or not can be determined
-1: connected
-0 :not connected
(NCL PG 95)
2-28-9
```

<!-- book1 p149 -->

```
CPU REGISTERS
ADDRESS :43X0H (X : CHANNEL NUMBER<0~7>)
NAME
CONTENTS:PARAMETERFORDMATRANSFER
D7 D6 D5 D4 D3 D2 D1 Do
CH CH CH TRANSFER
ABUSADDRESS
WORDSELECT 43X0H
* TYPE
INC/DEC FIXED D2 D1 DO
* Transfer
Origination
DMATRANSFERWORDSELECT
GENERAL PURPOSE DMA : B-ADDRESS CHANGE
METHOD DESIGNATION
PER CHANNEL
D1D0 ADDRESSTOBEWRITTEN
0 0 0 1-ADDRESS
0 0 1 2-ADDRESS (VRAM etc.) L,H
0 0 1-ADDRESS(WRITETWICE)
2-ADDRESS (WRITE TWICE) L,L,H,H
0 0 4-ADDRESS L,H,L,H
H-DMA : The number of bytes to be transferred per line
and write method designation.
D2D1DO#OFBYTETOADDRESSTOBEWRITTEN
BE TRANS-
FERRED
0 0 0 1BYTE 1-ADDRESS
0 0 1 2 BYTE 2-ADDRESS (VRAM etc.) L,H
0 1 0 2 BYTE 1-ADDRESS (WRITE TWICE) L,L
0 1 4 BYTE 2-ADDRESS(WRITE TWICE) L,L,H,H
0 0 4BYTE 4-ADDRESS L.H.L.H
/DECREMENTSELECT[INCASEOFGENERALPURPOSE
DMA]
r0 : Automatic address increment/decrement
D3
L1 : Fixed address (To be used when clearing VRAM etc.)
-0:Automatic increment
D4 (In case “0" is written to D3)
-1 : Automatic decrement
TYPE DESIGNATION [H-DMA ONLY] : Addressing mode designation when
accessing the data (Referto pageB-2).
0:ABSOLUTEADDRESSING
L1:INDIRECT ADDRESSING
TRANSFER ORIGINATION DESIGNATION : Transfer direction A Bus-→B Bus
B Bus-→A Bus Designation(Refer to page B-1)
(o ) -< 9- : 0
 
米 For example, in case the DMA transfer is performed from CPU memory to PPU, “0" shouid be
written.
(NCL PG 96)
2-28-10
```

<!-- book1 p150 -->

```
SNESDEVELOPMENTMANUAL
ADDRESS:43X1H (X: CHANNEL NUMBER<0~7>)
NAME
CONTENTS:B-BUSADDRESSFORDMA
D7 D6 D5 D4 D3 D2 D1 DO
B-ADDRESS
43X1H
BA7 BA6 BA5 BA4 BA3 BA2 BA1 BAO
·This is a register whichcanset the address of B-bus.
Whether this is the address of the“Transfer Destination"or the address of the“Transfer
Direction can be designated by “Transfer Origination"
A - BUS← > B -BUS
Actual address is 0021XXH.
(XX : value by this register)
ADDRESS:43X2H/43X3H/43X4H(X:CHANNEL NUMBER<0~7>)
NAME
CONTENTS:TABLEADDRESSOFA-BUSFORDMA<A1TABLEADDRESS>
D7 D6 D5 D4 D3 D2 D1 D0
A1 TABLE ADDRESS (LOW)
43X2H
A7 A6 A5 A4 A3 A2 A1 A0
A1 TABLE ADDRESS (HIGH)
43X3H
A15 A14 A13 A12 A11 A10 A9 A8
A-TABLE BANK
43X4H
A23 A22 A21 A20 A19 A18 A17 A16
This is a register, which can set the address of A-bus.
Whether this is the address of the“Transfer Destination"or the address of the“Transfer
Origination"can be determined by D7 (Transfer Origination) of register<43xoH>.
A "0"should be written to D7except in special cases.
In the H-DMA mode,the address of the transfer origination is designated except it is a
special case. Therefore,for the CPU area designated by this address, the data (page B-2)
must beset by the absolute addressingmode or the indirect addressing mode.
Thisaddressbecomes thebasic address on theA-BusduringDMA transferperiod and the
address will be increased or decreased based on this address.(when the general purpose
DMA is performed, it will be decreased.)
(NCL PG 97)
2-28-11
```

<!-- book1 p151 -->

```
CPUREGISTERS
ADDRESS:43X5H/43X6H/43X7H(X:CHANNELNUMBER<0~7>)
NAME
CONTENTS:DATAADDRESSSTOREBYH-DMA
D7 D6 D5 D4 D3 D2 D1 Do
FOR H-DMA
DATA ADDRESS (LOW)
DA7 DA6 DA5 DA4 DA3 DA2 DA1 DAO
43X5H
NUMBEROFBYTESTOBETRANSFERRED(LOW)
GENERAL
B7 1 B6 B5 B4 PURPOSE
B3 B2 B1 B0
DMA
FOR H-DMA
DATAADDRESS(HIGH)
DA15 DA14I DA13 DA12 2丨DA11丨DA10 DA9 DA8
43X6H
NUMBEROFBYTESTOBETRANSFERRED(HIGH)
GENERAL
B15 B14 B13 B12 B11 B10 B9 B8 PURPOSE
DMA
DATA BANK FOR H-DMA
DA23 DA22 」DA21 DA20|[ DA19 DA18 DA17 DA16
43X7H
INCASEOFH-DMA
This is aregister in which theindirect addresswillbestored automaticallyin theIndirect
addressing mode.The indirect address means the data described on page B-2.It is not
IN CASEOFGENERALPURPOSEDMA
This is the register which can set the number of bytes to be transferred. However, the rumber
of Byte (0000H) means 10000H.
(NCL PG 98)
2-28-12
```

<!-- book1 p152 -->

```
SNESDEVELOPMENTMANUAL
ADDRESS :43X8H / 43X9H (X :CHANNELNUMBER<0~7>)
NAME
CONTENTS:TABLE ADDRESS OF A-BUS BY DMA <A2 TABLE ADDRESS>
D7 D6 D5 D4 D3 D2 D1 Do
A2TABLEADDRESS(LOW)
43X8H
A7 A6 A5 A4 A3 A2 A1 A0
A2 TABLE ADDRESS (HIGH)
43X9H
A15 A14 A13 A12 A11 A10 A9 A8
This is the address which is used to access the CPU and RAM. It will be increased
automatically. (See page B-2.)
The data of this register is used as the basic address which is the address set by the "A1
Table Address".Afterwards,because it will be increased (or decreased) automatically,it is
not necessary to set the address into this register by the CPU directly.
However, if the data which is transferred needs to be changed by force, it can be
H-DMA
donebysetting theCPU memoryaddressto thisregister.Insuchcase,the
ONLY
address of the CPU which is accessed currentlywill be changed byreading this
register.
ADDRESS:43XAH (X:CHANNEL NUMBER<0~7>)
NAME
CONTENTS:THE NUMBER OFLINES TOBETRANSFERRED BY H-DMA
D7 D6 D5 D4 D3 D2 D1 Do
NUMBER OF LINES
43XAH
Continue L6 L5 L4 L3 L2 L1 Lo
This is the register which shows the number of lines for H-DMA transfer. (Refer to page B-2.)
The number of lines written to the CPU memory will be the basic number of lines. It is not
necessary to write the data into this register by the CPU directly.
(NCL PG 99)
2-28-13
```
