# Section 3 — Super NES Sound (SPC700)

> SPC700 CPU (the sound coprocessor), NOT the 65C816 main CPU.

## Contents (per the manual's own TOC)

- 3-1 Sound Source Outline (p153)
- 3-2 BRR (p157)
- 3-3 V/O Ports (p160)
- 3-4 Control Register (p162)
- 3-5 Timers (p164)
- 3-6 DSP Interface (p167)
- 3-7 Register Used (p168)
- 3-8 CPU Organization (SPC700) (p180)
- 3-9 Sound Programming Cautions (p189)

## Provenance

```
Source: `snes_manual/book1.pdf` (Nintendo Super NES Development Manual, Book I),
scanned 240-page image-only PDF (no text layer). Per-page text below is produced by
RapidOCR (ONNX) at 300 DPI. **Prose is a usable baseline; hex / disassembly / tables
carry OCR noise (dropped inter-word spaces, 0/O, S/s, l/I confusion) and must be
verified against the page image before being treated as fact.** Each page is tagged
with `<!-- book1 pNNN -->` so a specific page can be re-verified and corrected.
```

## Body (pages 153–195)


<!-- book1 p153 -->

```
OUTLINE
Chapter 1. SNES Sound Source Outline
1.1 OUTLINE
The SNES sound source is composed of a Sound-CPU-IC, a single chip in which
are integrated an 8-bit CPU, IPL ROM, I/O ports, a DSP-IC, and peripheral appa-
ratus.
CHARACTERISTICS
·CPU : Sony SPC700 series CMOS 8-bit CPU
core
·Minimum Command Execution Time : 1.953μs/2.48MHz when active
·Internal ROM : 64 byte (IPL ROM)
·Memory Space : 64K byte
·Peripheral Functions
·/O Ports : SNES CPU Interface I/O Ports 8 bit x 4
Universal 1/O Ports 8 bit x 2
·Timers : (8 bit timer + 4 bit counter) x 3 sets
·Output Sound Production : 4-bit ADPCM sampling sound x 8 tones
(simultaneous production)
(NCL PG 2)
3-1-1
```

<!-- book1 p154 -->

```
SNESDEVELOPMENTMANUAL
1.2 SYSTEM OUTLINE
JOY GAME
CONTROLLER
STICK CASSETTE
TV STERIO, ETC.
VIDEO AUDIO-IN
AUDIO
SNES CPU SNESPPU
MAIN-CPU SIDE
SNESBUS
APU I/O PORT AUDIO-OUT
SNES-SOUNDSIDE D/A
SOUND CPU DSP
CONVERTER
512K RAM
Figure 3-1-1 System Block Diagram
1.3 Designation and Role of Each Section:
1.3.1 Sound-CPU:
SNES sound source CPU. Program and tone color data are read into RAM
from the game cassette through the SNES CPU, Consequently controlling
the game music.
In addition, the Sound- CPU is provided with an internal IPL-ROM which is
activated upon reset. The IPL-ROM provides for transmission of data
through the SNES CPU, initial settings of the SNES sound source, etc.
1.3.2 DSP:
out various functions for the purpose of musical expression.
1.3.3 512K RAM:
Shared on a time basis by the Sound-CPU and the DSP.
1.3.4  SNES CPU:
CPU for SNES use. Carries out progression of the game in conformity with
the game cassette format.
1.3.5 SPPU:
PPU for SNES use. Creates imaging through CPU control.
(NCL PG 3)
3-1-2
```

<!-- book1 p155 -->

```
OUTLINE
1.4 MEMORY MAPPING
H0000
External MemoryRegion
00EFH
0-Page
0OFOH
Peripheral
Function Registers
00FFH
0100H
512K bit RAM
(installed on board)
1-Page
External MemoryRegion
01FFH
0200H
Standard data
transmission region
External MemoryRegion
7FFFH
FFBFH
FFCOH
IPL ROM 64 byte *
FFFFH
* The initial hardware setting program is installed in the IPL ROM
Figure 3-1-2 Memory Map
(NCL PG 4)
3-1-3
```

<!-- book1 p156 -->

```
SNESDEVELOPMENTMANUAL
1.5 SIGNAL FLOW
D/O
L-CH MAIN L-CH ECHO R-CHMAIN R-CHECHO
PARALLEL
SERIAL
Figure 3-1-3. Sound Signal Flow
EON
VOL
EFB
Z
20-0 FIR FILTER
ADSR(1) ADSR(2) ADSR/ENV
NOISE GENERATOR FLG(NCK) ESA) EXTERNALMEMORY
P(H), P(L)
FLG(ECEN)
PM PITCH CONVERT
 LEFT CHANNEL
MOI
OUTXof VOICE(i-1) MVOL(L)
BRR CODE
(NCL PG 5)
3-1-4
```

<!-- book1 p157 -->

```
BITRATEREDUCTION
Chapter 2. BRR (Bit Rate Reduction)
Sound data for the Super NES is recorded on a game data cassette in 4-bit ADPCM for-
mat. Creating data in this format requires the use of a technique called “BRR" for some
sounds.
NEWS system, which has been the standard tool used by Nintendo to date. When the
same data is created using a different tool, however, one must understand BRR.
Complications arise during the creation of sound data from data in BRR format when cre-
ating the position of the program which selects the filter number described below. Also,
Nintendo cannot currently support this programming effort.
One block of wave form data is comprised of a one-byte header and eight-byte wave
form (4 bit x 16 samples). This is the minimum unit the sound IC can handle.
header 123456 78910111213141516
D7 D6 D5 D4 D3 D2 DT DO
Range value Filter No. Loop End BLOCK
yes/no  or not
Figure 3-2-1 BRR Data String
From this, the range and filter contain the BRR information (how the data string in 1 - 16
and filters 2 and 3 require twoprevious samples.)
The "range" indicates the number of bits shifted. One sample data (4-bit) is shifted to the
left for the number of bits and re-created as 16-bit data. The maximum value for a range
is 12(1100). (See the next page.)
3-2-1
```

<!-- book1 p158 -->

```
SNESDEVELOPMENTMANUAL
Range = 0 4-bit data
Range = 1 — Shit 1 to left
Range = 2 一Shift 2 to left
Range = 3 Shift 3 to left
Range = 11 (b) -Shift 11 to left
Range = 12 (c) —Shift 12 to left
Figure 3-2-2 BRR Range Data
ad puoas puet'x aidwes snoaad aui wol x 'anga aidwes e bupooap lo uoenba ua
vious sample x.2, is given below.
X = R + ax-1 + bx.2
R is the value obtained by shifting the 4-bit data, d, by the range value, r.
R= [d] 2r-15
([d] is a decimal presentation of d, which is in two's compliment form, -7 ~+8)
The values of a and b for each filter are as follows:
Filter No. a b
0 0 0
1 0.9375 0
2 1.90625 -0.9375
3 1.796875 -0.8125
Table 3-2-1 BRR FilterValues
3-2-2
```

<!-- book1 p159 -->

```
BITRATEREDUCTION
7FFF 000 6000 4000 2000 1800 1000 0800 0000 F800 F000 E800 E000 000 A000
8001
F FC 00
F800
F400
EC00
E800
E4 00
67531EB9ABDE EC00
F800
block #3 (range=A)
0400
0
1400
1C 00
6 1800
5 1400
3
0
F F800
E F0 00
D E8 00
B D8 00
DO00
C800
D8 00
531EB9AE F0 00
block #2 (range=B)
080
1800
2800
7 3800
6 3000
5 2800
3 1800
0 0000
F F0 00
E E0 00
D D000
B BO00
A A000
9000
B0 00 =
S31EB9 E0 00
block #1 (range=C)
10:00
3000
5000
675 7000
6000
5 5000
3 3000
0 000
7FFF- Figure 3-2-3 Example Data when Filter :
6000 4000 2000 0000 E000 COOO A000
8001
Ts
decode value
DATA
EX.FILTER=0
3-2-3
```

<!-- book1 p160 -->

```
SNESDEVELOPMENTMANUAL
Chapter 3. HO Ports
3.1 PERPHERAL FUNCTIONS REGISTERS
Peripheral Function Registers Table 3-3-1. Peripherals
AddressFunctionRegister R/wWhen Reset Remarks
OOFOH (test) Installed in Sound-CPU
00F1H Control W Control ="--00-000"
00F2H Register Add. R/W Indeterminate Installed in DSP
00F3H Register Data R/W Indeterminate Installed in DSP
Port 0r = “00"
00F4H Port-0 R/W Installed in Sound-CPU
Port 0w = "00"
Port 1r = “00"
00F5H Port-1 R/W Installed in Sound-CPU
Port 1w = “00"
Port 2r = "00"
00F6H Port-2 R/W Installed in Sound-CPU
Port 2w = "00"
Port 3r = “00"
00F7H Port-3 R/W Installed in Sound-CPU
Port 3w = "00"
00F8H
00F9H
0OFAH Timer-0 W Indeterminate Installed in Sound-CPU
00FBH Timer-1 W Indeterminate Installed in Sound-CPU
00FCH Timer-3 W Indeterminate Installed in Sound-CPU
0OFDH Counter-0 R Indeterminate Installed in Sound-CPU
O0FEH Counter-1 R Indeterminate Installed in Sound-CPU
O0FFH Counter-3 R Indeterminate Installed in Sound-CPU
(NCL PG 6)
3-3-1
```

<!-- book1 p161 -->

```
I/OPORTS
3.2 APU 1/O PORTS
Ports O-3 are ports which carry out data transmission to the SCPU through the
SNES bus and are composed of four 8-bit input registers and four 8-bit output reg-
isters. Port n r registers can only write from the SCPU section and can only read
from the Sound-CPU section. The opposite is true of the port n w registers. Since
and Port Ow is provided.
1. Data is input into Port 0r when the SCPU writes data into 2140H. Then, the
contents of Ports Or are read when the Sound-CPU reads the data in
O0F4H (this is also true of Ports 1r - 3r).
2. Data is written into Port Ow when the Sound-CPU writes data into the APU
I/O port (O0F4H). Then the contents of Port Ow are read when the SCPU
reads 2140H (this is also true of Ports 1w - 3w).
3. When reset is applied, the contents of Port n r registers and Port n w regis-
ters become "00" (n =0-3).
Table 3-3-2Port0 - Port3 Registers
AddressSeen From Sound-CPuAddress SeenFrom SCPuRegister Name W/R FunctionSeenFromSound-CPUSection
Portor R Read content of Portor register.
00F4H 2140H
Portow W Write to Portow register.
Port1r R Read content of Portr register.
00F5H 2141H
Port1w W Write to Port1w register.
Port2r R Read content of Port2r register.
00F6H 2142H
Port2w W Write to Port2w register.
Port3r R Read content of Port3r register.
00F7H 2143H
Port3w W Write to Port3w register.
Figure 3-3-1 I/O Diagram
From SCPU To SCPU
Port nr  Port nw
To Sound-CPU From Sound-CPU
(NCL PG 7)
3-3-2
```

<!-- book1 p162 -->

```
SNESDEVELOPMENTMANUAL
Chapter 4. Control Register
4.1 THE PORT CLEAR FUNCTION BY MEANS OF THE CONTROL
REGISTER.
The ports are cleared to "oo" when "1" is written into the control register port clear
control bits PC32 and PC10. When "0" is written in, they are not cleared.
When "1" is written into the port clear control bit PC10, both the port 0r register
ten into Pc32, both the port 2r register and the port 3r register are cleared to "00".
CONTROLREGISTER
D7D6D5 D4D3D2 D1 D0
Control
PC32PC10 ST2 ST1 STO (W)
(00F1H)
"1" Port Reset
"O" No Clear
When Reset:"--00-000"
Figure 3-4-1 Port Clear
Note: Clear Timing
Port clear is executed during the machine cycle following that in which “1"
is written into the port clear control bit.
When port clear timing conflicts with write timing to the port in question
from the SNES bus, there are cases in which the contents of the register in
question become indeterminate.
MachineCycleMachineCycle
Clear Pulse
Timing when "1" is written into the port clear control bit.
Figure 3-4-2 Clear Timing
(NCL PG 8)
3-4-1
```

<!-- book1 p163 -->

```
CONTROLREGISTER
4.2 TIMER CONTROL BY MEANS OF THE CONTROL REGISTER
CONTROLREGISTER
D7 D6 D5 D4 D3 D2 D1 DO
Control
PC32 PC10 ST2 ST1 STO (W)
(00F1H)
"1" Timer Start
"0" Timer Stop
WhenReset:"--00-000"
Figure 3-4-3 Timer Control
STO is the Timer T0 start/stop control bit; the timer stops with "0" and starts with
"1". At this timer, it is necessary to input "1" into ST0 once it has been changed to
"O".
ST1 and ST2 are respectively the start/stop control bits of timers T1 and T2. Their
function is identical to that of STo.
NOTE: In regard to the functional operation of timers, please refer to the next
page.
(NCLPG 9)
3-4-2
```

<!-- book1 p164 -->

```
SNESDEVELOPMENTMANUAL
Chapter 5. Timers
5.1 FUNCTION OF TImERS T0, T1, AND T2
The SNES sound source is provided with three timers; To, T1, and T2.
Clock
Prescaler 8 bits
2.048 MHz
8KHz
Lowerlevel8-bit Upper level 4-bit
programmableinterval timer upcounter 01:
8KHz
Same as above Same as above :T1
64KHz
Same as above Same as above :T2
Figure 3-5-1 Timer Section
The timers T0, T1, and T2 are each composed of a lower level 8-bit programma-
ble interval timer connected to an upper level 4-bit up counter.
The 8-bit timer is made up of an 8-bit binary up counter, comparator, timer regis-
ter, and control circuit. Each of the timers; T0, T1, and T2; is independently pro-
grammable.
The clock input to timers T0 and T1 from the prescaler is 8KHz (125 μs) and the
((s g') he   a   s i  o
8-bit Timer 4-bit Up Counter
Resolution Max. Count Value|Max. Count Value
Timer T0, T1 125 μsec. 32 msec. 512 msec.
Timer T2 15.6 μsec. 4 msec. 64 msec.
Table 3-5-1  Timer Function
(NCL PG 10)
3-5-1
```

<!-- book1 p165 -->

```
TIMERS
5.2 TIMERACTION
Since timers To, T1, and T2 are alike in structure, an explanation of only timer T0
is provided.
The lower level 8-bit timer of timer To is composed principally of a binary up
counter, which is incremented at each count of the clock input. When its value cor-
responds to the contents of the timer register, it is cleared to ooH. Simultaneously
a pulse is generated to the 4-bit up counter.
The 4-bit up counter is composed principally of a binary up counter, which incre-
ments at each input of a lower level pulse.
The action of the counter of timer To is controlled by the O bit of the control regis-
ter. When bit STo is "O" count up is suspended. Count up commences when both
the counters, it is necessary to set bit STo to "1" after having set it to "O".
Writing to the timer register is carried out while the counter is stopped. At this time
the minimum write value is 0oH and the maximum value is 01 H. Though it is not
possible to read the value of the timer register, it is possible to read the 4-bit value
CNO at any time. When the value of CNo is read, only the 4-bit up counter section
is cleared to "00".
Figure 3-5-24-bit Counter
Upper Level 4-bit CounterTiming
4-bit Counter
Pulse
CK
CN
Read Clear Pulse
Action of timer T0 is stopped by means of the reset input (POR="L"). At the time of
reset, ST0 of the control register is "O" and; CNO and TMO of the timer register are
indeterminate.
When CN is read, the 4-bit up counter alone is cleared through IC internal timing,
But the read clear pulse and the pulse to the 4-bit up counter do not conflict with
each other.
Consequently, when the pulse is input to the 4-bit up counter, the value of CN will
necessarily be incremented; or when the value of CN is read, CN will be cleared
and become "0".
Internal Signal
Read Clear Pulse
Pulse to 4-bit
Counter
Value of CN
Read Value of CN,
Read Value of CN,
Value is 2
Figure 3-5-3. Timing Value is 4
(NCL PG 11)
3-5-2
```

<!-- book1 p166 -->

```
SNESDEVELOPMENTMANUAL
5.3 TIMER RELATED REGISTERS
Control Register
D6 D5 D4 D3 D2 D1 DO
D7
Control (W)
PC32 PC10| ST2 ST1 STO
(00F1H)
+
"" Timer Start
"O"Timer Stop
When Reset:"--00-000"
Timer Register
D7D6D5 D4 D3 D2 D1 D0
TMO
Timer-0 (W)
(00FAH)
TM1
Timer-1 (W)
(00FBH)
TM2
Timer-2 (W)
(0OFCH)
Counter Register
D7 D6[ D5 D4 D3 D2 D1 DO
Counter-0 CNO
(R)
(00FDH)
Counter-1 CN1
(R)
(OOFEH)
CN2
Counter-2
(R)
(00FFH)
Indeterminate
When Reset
Figure 3-5-4 Timer Related Registers
(NCL PG 12)
3-5-3
```

<!-- book1 p167 -->

```
DSPINTERFACEREGISTER
Chapter 6. DSP Interface Register
6.1 Interface Register
D7 D6 D5 D4 D3 D2 D1 D0
Register Address Register Address
(R/W)
(00F2H)
D7 D6 D5 D4 D3 D2 D1 D0
Register Data Register Data
(R/W)
(00F3H)
Indeterminate
Figure 3-6-1. Interface Register When Reset
This is the register which loads data into the registers within DSP. Values are
loaded into the designated register in accordance with the path of the flow-chart
below. The DSP address is written to 00F2H and data is written to 00F3H (refer to
Flow A). When the contents of the register data is read, it conforms to Flow B. The
address to be read is loaded into 00F2H and the contents of 00F3H are read.
Figure 3-6-2. Interface Register Flow
Loading Data into Reading Data in
DSP Registers DSP Registers
Address is Address is
Set at 00F2H Set at 00F2H
Data is Loaded Data is
at 00F3H Read at 00F3H
Secondary Secondary
Processing Processing
(NCL PG 13)
3-6-1
```

<!-- book1 p168 -->

```
SNESDEVELOPMENTMANUAL
Chapter 7. Register Used
7.1 DSP REGISTER MAP
Address Register Explanation ofFunction
00 VOL(L) LeftChannelVolume VOICE O!
01 VOL (R) Right Channel Volume
02 P(L) The total 14 bits of P(H) and P(L) express
03 P (H) Pitch Height
04 SRCN Designatessourcenumberfrom0-255
05 ADSR (1) Address is designated by D7=1 of ADSR(1); when
06 ADSR (2) D7=0, Gain is operative
07 GAIN Envelope can be freely designated by the program
08 ..ENVX Present value of envelope which DsPrewrites at
each Ts
Value afterenvelopemultiplication&beforeVOL
09 ..OUTX
multiplication (present wave height value)
10~19 Voice t
20 ~ 29 Voice 2
30 ~39 Voice 3
40 ~ 49 Voice 4 Same as Voice 0
50~59 Voice5
60 ~ 69 Voice 6
70 ~ 79 Voice7
MVOL (L) Main Volume (L)
OC
MVOL (R) Main Volume (R)
1C
EVOL (L) Echo Volume (L)
2C
EVOL (R) Echo Volume (R)
3C
Key On, D0-D7 correspond to Voice0-Voice7
4C KON
KOF Key Off
5C
FLG Designated on/off of reset, mute,echo, and noise
6C
clock
7C .ENDX Indicates source end block
OD EFB Echo Feedback
1D Not Used
2D PMON Pitch modulation of Voice i with OUTX of Voice (i-1)
asmodulatedwave
3D NON Noise on/off, D0-D7 correspond to Voice0-Voice7
4D EON Echo On/Off
5D DIR Off-setaddress of source directory
6D ESA Off-set addressofechoregion,EchoStartAddress
7D EDL Echo Delay. Only lower level 4 bits active.
OF CO
1F C1
2F C2
Echo Filter coefficients
Filter
3F C3
Makes up an 8 tapFiR Filter
Coefficients
4F C4
(BothLch&Rchhavethesamefilter)
5F C5
6F C6
7F C7
.. Register written to by DSP during conditions of activity.
Table 3-7-1 DSP Register Map
(NCL PG 14)
3-7-1
```

<!-- book1 p169 -->

```
REGISTERUSED
7.2 REGISTER FUNCTION
7.2.1 Register of each voice (Addresses indicated are those of Voice 0).
7.2.1.1 VOL (L), VOL (R)
D7 D6D5D4D3D2D1D0
VOL (L) VOL (L)
(00H) sign
VOL (R) VOL (R)
(01H) sign
Each is a volume level muitiplied by Lch and Rch, which is in a 2's
complement form making D7 the sign bit. When a negative value
is entered, phases reverse.
7.2.1.2 P(L), P(H)
D7D6D5D4D3D2D1D0
P(H). P(H)
(0), (0)
(03H)
P(L) P(L)
(02H)
Pitch is expressed by the total 14 bits combining six lower level
bits of P(H) and eight bits of P(L). At the current time, two upper
level bits of P(H) are not used. (Considered to be “O" at all times.)
With f as the frequency of the reproduced sound, fo as the fre-
quency of the original sound (sound at the time of recording),
and P as the value expressed by the lower level fourteen bits
of P(H) and P(L), the following formula is performed:
P
212
The diagram below illustrates the relationship between P and the
octaval ratio of the reproduced sound and the original sound.
There are theoretically no limitations in the practical range so long
ed to approximately four times the frequency of the original sound.
Interval: -20ct. -1oct. original +1oct. +20ct. (approx.)
sound
P: 0400H 0800H 1000H 2000H 3FFFH
In terms of tone quality, the lower level 4 bits of P(L) should be set
concern.
(NCL PG 15)
3-7-2
```

<!-- book1 p170 -->

```
SNESDEVELOPMENTMANUAL
7.2.1.3 ADSR(1),ADSR(2)
D7 D6D5D4D3D2D1D0
ADSR(1) ADSR DR
AR
(05H) /GAIN
ADSR(2) SL SR
(06H)
When D7 of ADSR(1) = "1", these two bytes become operable.
(ADSR mode)
AR is added to the fixed value "1/64" and DR, SR by the fixed val-
ue "1-1/256". When in the state of "Key Off", the “click" sound is
prevented by the addition of the fixed value “1/256". (GAlN mode
is identical.)
Table3-7-2AdsrParameters
AR Time from 0 to 1 DRTime from 1 to SL SL Ratio SR Time from 0 to 1
0 4.1 sec 0 1.2sec 0 1/8 0 Infinite
1 2.6 sec 1 740 msec 1 2/8 1 38sec
1.5 sec 2 440 msec 3/8 28 sec
23 23
1.0 sec 3 290 msec 4/8 24sec
4 640 msec 180msec 5/8 19sec
234567
5 380msec 456 110 msec 6/8 14 sec
4567
6 260msec 74 msec 7/8 12 sec
7 160msec 7 37msec 1 9.4 sec
8 96 msec 8 7.1 sec
9 64 msec 9 5.9sec
A 40msec A 4.7 sec
24 msec 3.5 sec
BC
16 msec 2.9 sec
BCDEF 10 msec D 2.4 sec
6msec 1.8 sec
EF
0msec 1.5 sec
10 1.2 sec
11 880msec
12 740msec
13 590 msec
14 440msec
15 370msec
16 290 msec
17 220 msec
18 180 msec
19 150 msec
S 1A 110msec
1B 92msec
1C 74 msec
/AR SR 1D 55msec
DR
E 37msec
1F 18msec
Key On Key Off
(NCL PG 16)
3-7-3
```

<!-- book1 p171 -->

```
REGISTERUSED
7.2.1.4 GAIN
This becomes operable when D7 of ADSR(1) = 0. The following
five modes are available.
D7D6D5D4D3D2D1D0
Direct Designation
(07H) 0
Increase Mode (Linear)
0
(07H)
Increase Mode (Bent Line)
1
(07H)
Decrease Mode (Linear)
0 0
(07H)
Decrease Mode (Exponential)
0
(07H)
.. Direct Designation: The value of GAIN is set directly by the values of Do ~ D6.
.: Increase (Linear): Addition of the fixed value 1/64.
: Increase (Bent Line): Addition of the constant 1/64 up to 0.75, addition of the
constant 1/256 from 0.75 to 1.
.. Decrease (Linear): Subtraction of the fixed value 1/64.
.. Decrease (Exponential): Multiplication by the fixed value 1-1/256.
In all cases, present envelope values (indicated by ENvX) are uti-
lized for initial values.
1.00
0.75
1-ket
Increase Mode: 1-ke is approximated with bent lines.
Figure 3-7-1Bent Line Mode
The various parameter values are indicated on the next page.
(NCL PG 17)
3-7-4
```

<!-- book1 p172 -->

```
SNESDEVELOPMENTMANUAL
GAINPARAMETERS
Decrease Mode
Parameter Increase Mode Increase Mode Decrease Mode
Exponential
Values Linear (0—1) Bentline(0—1) Linear(1—0)
(0—→1/10)
00 Infinite Infinite Infinite Infinite
01 4.1 sec 7.2 sec 4.1 sec 38 sec
02 3.1 sec 5.4 sec 3.1 sec 28 sec
03 2.6 sec 4.6 sec 2.6 sec 24sec
04 2.0 sec 3.5 sec 2.0 sec 19 sec
05 1.5 sec 2.6 sec 1.5 sec 14 sec
06 1.3 sec 2.3 sec 1.3 sec 12sec
07 1.0 sec 1.8 sec 1.0 sec 9.4 sec
08 770 msec 1.3 sec 770 msec 7.1 sec
60 640 msec 1.1 sec 640msec 5.9 sec
OA 510msec 900msec 510msec 4.7 sec
OB 380msec 670 msec 380msec 3.5 sec
OC 320msec 560msec 320msec 2.9 sec
OD 260 msec 450msec 260msec 2.4 sec
OE 190 msec 340msec 190 msec 1.8 sec
OF 160 msec 280msec 160 msec 1.5 sec
10 130 msec 220 msec 130 msec 1.2 sec
11 96 msec 170 msec 96 msec 880 msec
12 80msec 140 msec 80msec 740msec
13 64 msec 110msec 64 msec 590 msec
14 48msec 84msec 48msec 440 msec
15 40 msec 70msec 40msec 370msec
16 32 msec 56msec 32msec 290 msec
17 24 msec 42 msec 24 msec 220 msec
18 20 msec 35 msec 20 msec 180 msec
19 16msec 28msec 16msec 150 msec
1A 12msec 21msec 12 msec 110 msec
1B 10 msec 18 msec 10msec 92msec
1C 8msec 14msec 8msec 74 msec
1D 6 msec 11 msec 6 msec 55msec
1E 4 msec 7msec 4 msec 37 msec
1F 2msec 3.5 msec 2msec 18msec
Table 3-7-3GainParameters
(NCL PG 18)
3-7-5
```

<!-- book1 p173 -->

```
REGISTERUSED
7.2.1.5 SRCN
Refers to source number. It is the sequence of tone color within
the hexa-file of tones produced by means of a separate tool. (0 ~
255)
D7D6D5D4D3D2D1D0
SRCN
(04H)
7.2.1.6 ENVX
The present value of the ADSR/GAIN envelope constant. The
DSP section rewrites this at each Ts (31.25 μsec).
Seven bits without a sign bit. (D7 is always 0).
D7D6D5D4D3D2D1D0
ENVX
0
(08H)
7.2.1.7 OUTX
The present value of the wave height after envelope mulitiplication
and prior to VOL multiplication. The DSP section rewrites this at
each Ts. (31.25 μsec). Its value is utilized as the modulated wave
of pitch modulation.
Eight bits with a sign bit.
D7 D6 D5 D4 D3 D2 D1 D0
OUTX
Sign
(H60)
(NCL PG 19)
3-7-6
```

<!-- book1 p174 -->

```
SNESDEVELOPMENTMANUAL
7.2.2 COMPLETE VOICE REGISTERS
7.2.2.1 KON, KOF
"Key on" and "Key off". D0 ~ D7 correspond to Voice 0 ~ 7. When
a "1", key on or key off are active; when "0" neither is active. These
two registers need not be reset. With KOF, in regard to any Voice
in which a “1"is written and whether in the ADSR mode or GAIN
mode, 1 to 0 decreases at the rate of 8 msec by means of the ad-
dition of the fixed value 1/256. In writing in a succession of KON
and KOF, two Ts (62.5 μsec) or more should be released. (In writ-
ing a succession of various data in less that 2 Ts, the data written
may not be usable later.)
D7 D6 D5 D4 D3 D2 D1 DO
KON
Voice 7 Voice 6|Voice 5Voice 4|Voice 3|Voice 2] Voice 1|Voice 0
(4CH)
KOF
(5CH) Voice7|Voice6|Voice5|Voice4|Voice3|Voice2|Voice1|Voice0
7.2.2.2 PMON
Pitch modulation is imposed on Voice n with OUTX of Voice(n-1)
(n=1-7) as a modulated wave. When Dn=1, it becomes modula-
tion ON. (For example, when D1=1, a modulated tone is generat-
ed from Voice 1.) However modulation does not affect Voice 0.
Therefore, the bit Do is not active. In regard to the method of pitch
modulation, when yo is the wave height value of the modulated
wave and P is the value of P(H) and P(L), then:
P'= P(1+yo)
The value of P", as above, is substituted for P and used as the pitch at that time.
D7 D6 D5 D4 D3 D2 D1 DO
PMON
Voice 7Voice 6|Voice 5/Voice 4|Voice 3|Voice 2|Voice
(2DH)
7.2.2.3 NON
issued instead of sound source data. At this time, if sound source
data of formants only is designated through the previous SRCN,
then noise is generated only for the duration of the sound source
data. When reproduction for random lengths of time is desired,
sound source data incorporating a loop must be designated
through the SRCN. In addition, even though two or more Voices
may be on, the source of noise is the same.
Note: Modulation can not be imposed on this noise.
D7 D6 D5 D4 D3 D2 D1 DO
NON
Voice  7|Voice 6|Voice5/Voice 4|Voice 3|Voice 2|Voice 1|Voice 0
(3DH)
(NCL PG 20)
3-7-7
```

<!-- book1 p175 -->

```
REGISTERUSED
7.2.2.4 EON
Echo on/off. Active "1". D0 ~ 7 correspond to Voice 0 ~ 7.
D7 D6 D5 D4 D3 D2 D1 DO
EON
Voice 7 Voice6Voice5|Voice4Voice3|Voice2 Voice 1lVoice (
(4DH)
(5) FLG
D7 D6 D5 D4 D3 D2 D1 DO
FLG
RES MUTE ECEN NCK
(6CH)
RES: Soft reset is turned on when D7=1. At this time, all Voices
are in a state of "Key On" suspension and Mute is turned on. It be-
comes a "1" with power on.
MUTE: Mute is turned on in all Voices when D6=1. This always oc-
curs when power is first applied.
ECEN: Allows the possibility to write into external memory through
Echo, when D5=0. (Echo Enable). After power on, read out data is
indeterminate until initial data is written in by the CPU.
NCK: Designates the clock of the noise generator.
Table3-7-4.NoiseGeneratorClock
NCK Freq. NCK Freq. NCK Freq. NCK Freq.
00 0 Hz 08 83 Hz 10 500 Hz 18 3.2 KHz
01 16 Hz 09 100 Hz 11 667H Hz 19 4.0 KHz
02 21 Hz OA 125 Hz 12 800 Hz 1A 5.3 KHz
03 25 Hz OB 167 Hz 13 1.0  KHz 1B 6.4 KHz
04 31 Hz OC 200 Hz 14 1.3 KHz 1C 8.01 KHz
05 42 Hz OD 250 Hz 15 1.6  KHz 1D 10.7 KHz
06 50 Hz OE 333 HN 16 2.0 KHz 1E 16 KHz
07 63 Hz OF 400 Hz 17 2.7  KHz 1F 32 KHz
It is only possible to write into these registers from the CPU sec-
tion.
(NCL PG 21)
3-7-8
```

<!-- book1 p176 -->

```
SNESDEVELOPMENTMANUAL
7.2.2.5 ENDX
When BRR decode of the block having the Source End flag is
completed, the DsP section sets up a "1". D0 ~ 7 correspond to
corresponding to this voice is reset. In addition, when the CPU
section writes into this register, all bits are reset.
D7 D6 D5 D4 D3 D2 D1 DO
ENDX
Voice Voice6|Voice5] Voice4|Voice3 Voice 2 Voice ↑ 1Voice 0
(7CH)
7.2.2.6 MVOL(L), MVOL(R), EVOL(L), and EVOL(R)
Refer to Main Volume (Lch, Rch) and Echo Volume (Lch, Rch).
The output of this register is the sum of main volume and echo vol-
ume with a sign bit.
D7 D6 D5 D4 D3 D2 D1 DO
MVOL(Lch, Rch)
EVOL(Lch, Rch)
(OCH) Sign
(1CH)
7.2.2.7 ESA
Echo Start Address. Issues the off-set address of the Echo region.
(ESA) x 10oH becomes the lead-off address of the Echo region.
7.2.2.8 EDL
Echo Delay. Only the lower level four bits are used. Delay time o is
an interval of 16 msec. and is variable within a range of 0 ~ 240
msec. If this time is considered to be t, the necessary external
memory region is (2t) Kbytes, with a maximum allowable of 30
Kbytes. However, when EDL=0, the four byte memory region of
ESA - ESA+3 becomes necessary.
D7 D6 D5 D4 D3 D2 D1 DO
EDL
(7DH)
7.2.2.9 EFB
Refers to Echo Feed-Back. This word consists of eight bits includ-
ing a sign bit.
D7 D6 D5 D4 D3 D2 D1 DO
EFB
Sign
(HGO)
7.2.2.10DIR
Issues the off-set address of the source directory. (DlR) x 100Hs
is the beginning address of the directory.
(NCL PG 22)
3-7-9
```

<!-- book1 p177 -->

```
REGISTERUSED
7.2.2.11C0 ~ C7
Issues the filter coefficient. It is composed of eight bits, including
a sign bit and makes up an eight tap FiR filter (identical with that
of Lch and Rch).
D7 D6 D5 D4 D3 D2 D1 DO
C0~C7
Sign
(OFH) ~ (7FH)
'punos oyoa aue uo pasodw s! lall ssed moi e uaum I aidwexg bunes ja
Register Numerical Value
CO FF
C1 80
C2 17
C3 24
C4 24
C5 17
C6 08
C7 FF
Filter Setting Example 2: When the echo sound is given the same tone color as
the original sound.
Register NumericalValue
CO 7F
C1 00
C2 00
0 00
00
00
C6 00
C7 00
(NCL PG 23)
3-7-10
```

<!-- book1 p178 -->

```
SNESDEVELOPMENTMANUAL
7.3 SOUND SOURCE DATA (SOURCE) SPECIFICATIONS *
Sound source data is produced according to the following specifications by means
of specialized tools.
7.3.1 Source Directory
7.3.1.1 SA(H), SA(L)
The source start address. This 16 bit address is the lead-off ad-
dress of the lead-off block.
7.3.1.2 LSA(H), LSA(L)
Source loop start address. This 16 bit address is the lead-off ad-
dress of the loop start block.
Table 3-7-5. Source Directory
MemoryAddress Directory
n+o SA(L)
SA:Source Start Address
n+1 SA(H)
n+2 LSA(L)
LSA:SourceLoopStartAddress
n+3 LSA(H)
A15 Ag A7 Ao
DIR 00000000
SRCN 00
n=(DIR)×100H + (SRCN)x 4
n
* Sound source data used in the SNES is called "Source".
(NCL PG 24)
3-7-11
```

<!-- book1 p179 -->

```
REGISTERUSED
7.3.2 SOURCE DATA
7.3.2.1BLOCK FORMAT
The sound, sampled at 32KHz, undergoes BRR (bit rate reduc-
tion) processing and the data is condensed from 16 bits to 4 bits.
The four-bit data is arranged into sixteen portions and, together
with the RF register, is formed into one block of nine bytes.
D7 D6 D5 D4 D3 D2 D1 DO
BRRData Loop
END
RF on/off
DAO DAoH DAoL
DBO DBoH DgoL
DA1 DA1H DA1L
DB1 DB1H DB1L
DA2 DA2H DA2L
DB2 DB2H DB2L
DA3 DA3H DA3L
DB3 DBsH DB3L
Table 3-7-6Source Data Block Format
7.3.2.2 RF
Bits D7 ~ D2 is composed of data relating to BRR. When D1=1, it
indicated that it is a source having a loop and when D1=0, it indi-
cates that the block is the block with the final data.
(NCL PG 25)
3-7-12
```

<!-- book1 p180 -->

```
SNESDEVELOPMENTMANUAL
Chapter 8. CPU Organization
A Sony SPC7o0 series is used in the CPU core of the SNES Sound Source. It is possible
to access and address space of 64 Kbytes in the SPC series CPU. Address classification
i ep aue oi pebas ul '1 abed pallo ase Hysto ~ Hooio sasappe pue 0 abed pallo
dressing modes with a small number of machine cycles.
Within the CPU there are the universal registers A, X, and Y, program status word (PSW)
of the various flags, program counter (PC), and stack pointer (SP).
The A register is operable by the greatest number of commands and becomes an 8-bit
operation accumulator. When 16-bit operations are carried out, it becomes paired with
as dual address command source, destination address register, etc.
In the command set there are single address commands which carry out arithmetic and
ignate random addresses within the direct page as source addresses and destination ad-
dresses.
mands are applicable to the 8 Kbyte wide range of data of addresses 00o0h ~ 1FFFH·
Moreover, in regard to the bits within the direct page, set, reset and bit conditional rela-
tive jump can be utilized. In regard to the data within the total space of the 64 Kbytes;
data which must be systematized or in order to carry out data processing rapidly, it is
possible to operate 16-bit data with a single command. Addition, subtraction, compari-
son, and transference are possible between two bytes of continuous 16-bit data within
rement of continuous 16-bit data within the direct page are possible.
and processing of data in a variety of forms. Multiplication is 8-bits x 8-bits with no sign
the A register; the result is entered into the (Y,A) 16-bit accumulator. Division is 16 bits/8
bits with no sign and is carried out with the dividend stored in the (Y,A) 16 bit accumula-
tor and the divisor stored in the X register. The resulting quotient is entered into the A
register and the remainder into theY register.
(NCL PG 26)
3-8-1
```

<!-- book1 p181 -->

```
CPUREGISTERS
When processing decimal data, there are decimal addition/subtraction correcting com-
mands in regard to the results of both addition and subtraction.
In regard to branched commands, there are relative branched commands according to
the conditions of the various status flags, according to the conditions of set or reset of
In regard to subroutine call commands, there are subroutine address direct designation,
Three-byte call commands within the 64 Kbytes, Two-byte call commands for calling
specific areas, and One-byte call commands using call tables. It is possible to improve
byte efficiency through proper usage in response to the frequency of subroutine use.
(NCLPG26a)
3-8-2
```

<!-- book1 p182 -->

```
SNESDEVELOPMENTMANUAL
8.1 CPU REGISTERS
Within the CPU are the registers necessary for the execution of various com-
ter, Y register (8-bit universal register which can also be used as an index
register), PSW (program status word), SP (stack pointer), etc. These are all 8-bit
registers, but the PC (program counter) is made up of 16 bits.
PC
Program Counter (16 bits)
A A Register (8 bits)
Y A ; (Y, A Paired 16 bit Accumulator) (16 bits)
X X Register (8 bits)
Y Y Register (8 bits)
SP Stack Pointer (8 bits)
PSW Program StatusWord (8 bits)
Carry Flag (Bit Accumulator)
Zero Flag
Half Carry Flag
-Direct Page Flag
-Overflow Flag
-Negative Flag
Figure 3-8-1 CPU Registers
(NCL PG 27)
3-8-3
```

<!-- book1 p183 -->

```
CPUREGISTERS
8.1.1 A REGISTER
This register is used as an 8-bit accumulator. At times of 16-bit operation
commands, it becomes the register which contains low byte data in the 16-
commands are issued, it becomes the multiplier register and low byte data
of the product is entered. When division commands are issued, paired with
the Y register, it formulates the dividend and the resulting quotient is en-
tered.
8.1.2 X REGISTER
In addition to its role as a universal data register, it also functions as an in-
dex register when index addressing is being carried out. In addition, it is
used as a two- address command destination address register and X regis
ter indirect address register. In division commands, it becomes the divisor
register.
8.1.3 Y REGISTER
In addition to its role as a universal register, it functions as an index register
when index addressing is being carried out. In addition, it is used as a two
ation commands, it becomes the register which contains the high byte data
of the 16-bit accumulator, which is made up of the pairing of this register
with the A register. When multiplication commands are being carried out, it
becomes the dividend register and the product high byte data is entered.
When carrying out division commands, paired with the A register it formu-
lates the dividend and the resulting remainder is entered.
8.1.4PROGRAM COUNTER
The program counter is made up of 16 bits and has an address region of
are called PCL. Normally, it will contain the address to be executed during
bytes necessary for the command to be fetched. When there is a branching
tion will be stored in the program counter. When there is a reset (POR) in-
put, reset vectors which are in addresses FFFF and FFFE enter
respectively PCH and PCL for branching to take place.
8.1.5 STACK POINTER
The stack pointer is used to send data to the RAM or to recover data from
the RAM when the subroutine call commands push (PUSH), pop (POP),or
stack pointer is within page 1 (addresses 0100u ~ 01FFH).
1514131211109876543210
SP Values
Fixed byHardwareDetermined by theProgram
(NCL PG 28)
3-8-4
```

<!-- book1 p184 -->

```
SNESDEVELOPMENTMANUAL
When sending data to the RAM, the stack pointer decreases by one after
sending data (post decrement) and increases by one prior to restoring data
(pre-increment). The diversified activities of the stack pointer are summa-
rized below.
*SUB-ROUTINECALLS
Stack Address Activity SP Value After Sending
SP Sending to PCH SP-1
SP-1 Sending to PCL SP-2
*RESTORINGFROMSUB-ROUTINE
Stack Address Activity SP Value AfterSending
SP Restore to PCH SP+1
SP+1 Restore to PCL SP+2
To send the contents of the A register, X register, Y register, or PSW (pro-
gram status word) to and from the stack, the commands PUSH and POP
can be used.
*PUSH A (X, Y, PSW)
StackAddress Activity SPValueAfterSending
SP Sending of A (X, Y, PSW) SP-1
*pOP A (X, Y, PSW)
Stack Address Activity SP Value After Sending
SP Restore A (X, Y, PSW) SP+1
(NCL PG 29)
3-8-5
```

<!-- book1 p185 -->

```
CPUREGISTERS
8.1.6 PROGRAM STATUS WORD (PSW)
The program status word is made up of the various flags which are set and
resetaccording totheresultsoftheexecutionof8-bitregistercommands
and thevariousflagswhichdetermine theactivities of the CPU.Whenre-
set it becomes "0o0-0-00".
7654321 0
N 工 Z
 Carry Flag (C)
After operation execution, this flag is set when there has been a carry from the up-
permost bit of the arithmetic logic unit (ALU) or when there has been no borrow. It
is also altered with shift or rotate commands. It acts as bit accumulator for Bool-
CLRC command. The carry flag inverts with the NOTC command.
Zero Flag (Z)
After operation execution, this flag is set when the result is zero and reset when
the result is not zero. Even with 16-bit operation commands, zero detection is car-
ried out. It is possible to carry out tests with conditional branching commands. - :
 Half Carry Flag (H)
After operation execution, this flag is set when there has been a carry from bit 3 of
set the half carry flag however, it is reset by means of the CLRV command. When-
 Direct Page Flag (P)
This is the flag which designates the direct page to which many addressing
modes are applicable, such as direct page addressing, etc. When "0", the direct
page becomes the addresses of the region 0oo0 ~ 0oFFμ and when "1", it be-
comes the addresses of the region 0100u ~ 01FF. It is set by the SET P com-
mand and reset by the CLRP command.
 Overflow Flag (V)
After arithmetic operation execution, this flag is set when overflow or underflow
has been produced. When this occurs the H flag is also set. It is possible to carry
out tests with conditional branching commands.
 Negative Fiag (N)
After operation execution, this flag is set when the value of the result of MSB is "1 "
and reset when its value is "o". It is possible to carry out tests with conditional
branching commands.
(NCL PG 30)
3-8-6
```

<!-- book1 p186 -->

```
SNESDEVELOPMENTMANUAL
8.2 MEMORYSPACE
It is possible for the Sound-CPU to address 64 Kbytes of memory. Memory space
is divided up according to purpose. From address 0000H, 512 bytes are divided
 alaissod s! ll 'auo abed pue olaz abed pallo shun ag gh jo sabed omi ous
access data within these regions by means of numerous addressing modes, such
8.2.1 Direct Pages (Page Zero, Page One)
status word, it is possible to designate whether page zero or page one is to
be made the direct page. It is set up such that the data within this page can
types of commands and addressing modes.
8.2.1.1Stack Area
The stack region is established in the RAM region within page one.
The uppermost byte of the stack address is fixed at 01. The lower-
most byte of the stack address must be given its initial setting by the
program.
8.2.2 Uppermost Page (Internal RoM Region)
A mask ROM is installed within the Sound-CPU from FFCOH - FFFFF.
There is a program in it which transmits data from the ROM cassette to the
512 Kbit RAM through the SNES CPU. This region is used by means of re-
set.
(NCL PG 31)
3-8-7
```

<!-- book1 p187 -->

```
CPU REGISTERS
8.2.3Area of Applicable Bit Operation Commands
8.2.3.1SET1, CLR1
The commands SET1 (set memory bit) and CLR1 (clear memory
bit) are applicable to one-bit data with the direct page.
8.2.3.2TSET1,TCLR1
The commands TSET1 (test and set bit) and TCLR1 (test and clear
bit) are applicable to the total 64 Kbyte region.
8.2.3.3Boolean Operation Commands
The Boolean operation commands (AND1, OR1, EOR1, MOV1,
NOT1) are applicable to the 8 Kbyte region of 0000u ~ 1FFFH.
0000H
SET1, CLR1
Applicable
00FFH
toDirect
Page
01FFHF
AND1,OR1,EOR1
MOV1, NOT1
TSET1, TCLR1
1FFFH
7FFFH
FFBFH
FFCOH
IPL ROM
FFFFH
Figure 3-8-2 Boolean Bit Operation Commands
(NCL PG 32)
3-8-8
```

<!-- book1 p188 -->

```
SNESDEVELOPMENTMANUAL
8.2.4 Direct Page Addressing
Since all of the addressing modes indicated in Figure 2-7-3 are applicable
to the data of the direct page (P=0: addresses 0000 ~ 00FF, P=1: ad-
dresses 0100 ~ 01FF) designated by the direct page (P) flag, it is possi-
ble to manipulate the data in various ways. In addition, byte efficiency
improves due to the fact that direct address designation is possible by one-
byte data within the command words. Since effective command cycles also
decrease, data can be accessed more rapidly.
Effective Address Region
#
Symbol Addressing
Bytes
0000H~01FFH~1FFFH1FFFH
dp Direct Page 2
x+dp X-indexed Direct Page 2
dp+Y Y-lndexed Direct Page 2
(x) Indirect 1
(x)+ Indirect Auto-Increment 1
dp.dp Direct Page to D.P. 3
(X),(Y) Indirect Page to I.P. 1
dp,#imm Immediate Data to D.P. 3
q'dp Direct Page Bit 2
dp.bit,rei Direct Page Bit Reiative 3
mem.bit Absolute Boolean Bit
3
!abs Absolute 3
!abs+x X-lndexed Absolute 3
!abs+y Y-Indexed Absolute
[DP+X] X-indexed indirect 2
[DP+Y] IndirectY-IndexedIndirect
2
Figure 3-8-3 Memory Access Addressing Effective Address
(NCL PG 33)
3-8-9
```

<!-- book1 p189 -->

```
SOUNDPROGRAMMINGCAUTIONS
Chapter 9. Sound Programming Cautions
9.1 CAUTION #1
When layering sound on several tracks (for example, when layering sound effects
on back-ground music), make sure an overflow does not occur due to the addi-
tional output. Eight-track sound is ultimately transmitted as one signal, which is
signal exceeds this limit.
This segment creates noise
Maximum output value to DAC
Amplitude
Figure 3-9-1 Wave-form Overflow
9.2 CAUTION #2
The following precautions should be observed when making the initial selections
for a sound driver echo function.
1. The FLG's ECEN should not be turned “on"immediately after the
EDL and ESA registers have been assigned a number. Otherwise,
the RAM area used by the program or other area could be dam-
aged. Either of the following guidelines can be used to determine
the appropriate wait period after setting the EDL and ESA regis-
ters.
a) Wait 240 ms.
b) Read the EDL value (α) before writing to it, and calculate the
wait period based on the following formula.
α x 16 (ms)
In addition, the EVOL should be set high only after (the EDL val-
ue) x 16 ms or greater. (The read data is undefined until the DSP
begins writing data, and could generate noise.)
3-9-1
```

<!-- book1 p190 -->

```
SNESDEVELOPMENTMANUAL
2. Turn both the ECEN and EVOL "off' when the echo function is not
in use. Data will be read and output unless the EvOL is 0.
9.3 CAUTION #3 (ECHO OPERATIONS)
This caution describes the procedure to be followed when writing echo data to the
appropriate RAM area.
· ESA (Echo Start Address - 6DH): Initial address for the echo start
area.
· EDL (Echo Delay - 7DH): Determines the number of address-
es in the echo area begining from
the initial address.
9.3.1 PROCEDURE
An internal counter exists for the echo data, which is written sequentially.
This counter is called the “echo counter'. The EDL determines the maxi-
mum value of the echo counter. When the echo counter reaches (the
ESA value x 80H), the echo counter is set to 00. Echo data is written two
bytes at a time (4 bytes for the left and right) every 31.25 s. A delay of
16 ms occurs using a RAM address area of 80H.
The echo counter is 15 bits, from 000H ~ 7FFH. The following formula is
used to determine the RAM address to which the echo data is written.
(ESA value x 10oH) + (echo counter value) = (echo write address)
D15 D8 D7 DO
ESA
Echocountervalue
+
Echowrite conditions
However, changes in the echo counter value do not immediately follow
changes in the ESA value using the above formula. Therefore, unantici-
pated problems, such as data loss, could occur. The relationship be-
tween the echo counter and EDL value can be explained as follows.
It was mentioned above that the echo counter is set to Oo when it reaches
(the ESA value x 80H). However, the ESA value mentioned here is not
the value of ESA at that time, but at the time when the echo counter was
previously set to Oo. Even when the ESA value is changed, the counter
continues counting until it reaches the previously set ESA value, wherein
it is set to Oo. Then, the last-specified ESA value and echo counter value
are compared. (This is to prevent the echo counter from incrementing un-
til the maximum value is reached, when a small value is assigned to
ESA). For these reasons, the echo write address will be within the speci-
fied range if the programmer waits for the period of time specified below
when re-writing the EDL value.
3-9-2
```

<!-- book1 p191 -->

```
SOUNDPROGRAMMINGCAUTIONS
wait time = (the EDL value prior to rewrite) x 16 ms
To insure that the echo data is written to the echo area, wait for a period
equal to the last-specified EDL value x 16 ms.
9.4 CAUTION #4
could lead to loss of data in critical RAM areas or noise generation. Reverberation
may occur when the echo feedback value is too large.
9.5 CAUTION #5
It is extremely important to follow the recommended procedure (Caution #3,
above) when setting the initial echo values and modifying the echo parameters.
The RAM used as the echo buffer is also used for the program, wave form data,
and sound driver. If an echo is started before the echo parameter initialization is
established, critical data may be overwritten in the RAM area.
9.6 CAUTION #6
Do not use an excessive sound data compression ratio. An excessive compres-
sion ratio results in distorted sound output.
9.7 CAUTION #7
When performing sound checks, the monaural sound output should also be
checked. Sound data created for stereo output may not be produced as desired
when played on a monaural output device. Super NES monaural sound is gener-
fect is created in stereo by setting negative values in the volume register, the
sound volume may be altered when the sound is combined to generate monaural
'ndno
3-9-3
```

<!-- book1 p192 -->

```
SNESDEVELOPMENTMANUAL
9.8 CAUTION #8
Sampled data should not have any discontinuity. A crackling noise is produced by
discontinuous samples. The following are examples of discontinuity in the sam-
pled data.
The sampled data does not begin at 0.
The sampled data does not end at 0.
A discontinuity occurs in the middle of the sampled data.
3-9-4
```

<!-- book1 p193 -->

```
SOUNDPROGRAMMINGCAUTIONS
9.9 CAUTION #9
When transferring data between the Super NES CPU and the APU using the IPL
loader, a hang-up can occur if the program is interrupted.
When the Super NES CPU sends the termination code, the Sound CPU sends a
code to the Super NES CPU to indicate that it has received data. The Sound CPU
erases this code after 300-400 μsec.
If an interrupt occurs after sending the termination code, for a period which is
greater than 300-400 micro-seconds, the status code from the Sound CPU will be
cause the Super NES CPU will wait indefinitely for the Sound CPU to indicate that
it has received data.
Two possible options are available to prevent this from occuring.
Modify the transfer routine run on the Super NES CPU side.
Inhibit interrupts during transfer.
These options are demonstrated below.
9.7.1 MODIFIED TRANSFER ROUTINE
Addtwolinesasshowntotheroutine.
adc #07fh ; original code
pla ; original code
sta !APU_port 0 ; original code
cpx #1 ; solution #1
bcc boot_ret ; solution #1
boot_wait3 cmp !APU_porto ; original code
bne boot_wait3 ; original code
bvs ; original code
boot_ret plp ; original code
rts ; original code
end
3-9-5
```

<!-- book1 p194 -->

```
SNESDEVELOPMENTMANUAL
9.7.2INHIBITING INTERRUPTS
Inhibit any interrupt from the time the termination code is sent until the
Sound CPU sends an acknowledgement. This is demonstrated by the
highlightedcodebelow.
adc #07fh ; original code
pla ; original code
sta !APU_port 0
; no interrupt
boot_wait3 cmp !APU_porto
; no interrupt
bne boot_wait3 ; no interrupt
bvs ; original code
pop ; original code
rts ; original code
end
9.10 CAUTION #10 - DATA TRANSFER
When data is written to Port 0 <2140H> and Port 1 <2141H> in the 16 bit mode,
during data transfer from the Super NES APU, the value of Port 3 <2143H> may,
inadvertantly, be changed. Therefore, the 8 bit mode should be used when writing
data to theseports.
This occurs because multiple ROMs installed on the game pak PCB can increase
load capacity of the data bus and, when combined with a drastic fluctuation of
CPU data output, cause noise in the data being written. An example is provided
below.
ADDRESS
2140H (Port 0) 2141H (Port 1)
DATA 2140H 2141H
Write Data Write Data
B-ADDRESSO
Noise Pulse
B-ADDRESS1
PA WRITE
3-9-6
```

<!-- book1 p195 -->

```
SOUNDPROGRAMMINGCAUTIONS
In the example on the previous page, if data is written to 2140H (Port 0) and
2141H (Port 1) in the 16 bit mode, noise pulses may occur at B-Address 1 due to
noise which occurs when all CPU data simultaneously changes from high to low.
This depends upon the type of CPU data. When data is written to 2141H (Port 1),
B-Address1 becomes "1". In other words, the same data is written to 2143H (Port
3) due to this pulse.
3-9-7
```
