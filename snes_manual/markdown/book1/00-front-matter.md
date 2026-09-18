# Book I — Front Matter

> Contains the authoritative TOC for BOTH books, incl. the Section 4 (65C816) promise.

## Contents (per the manual's own TOC)

- Table of Contents (BOOK I + II)
- List of Figures
- List of Tables
- Preface

## Provenance

```
Source: `snes_manual/book1.pdf` (Nintendo Super NES Development Manual, Book I),
scanned 240-page image-only PDF (no text layer). Per-page text below is produced by
RapidOCR (ONNX) at 300 DPI. **Prose is a usable baseline; hex / disassembly / tables
carry OCR noise (dropped inter-word spaces, 0/O, S/s, l/I confusion) and must be
verified against the page image before being treated as fact.** Each page is tagged
with `<!-- book1 pNNN -->` so a specific page can be re-verified and corrected.
```

## Body (pages 1–13)


<!-- book1 p001 -->

```
TABLE of CONTENTS
Table of Contents
BOOKI
SUBJECT PAGE
PREFACE
SECTION 1 - APPROVAL PROCESS .1-1-1
NOA Licensed Software Approval Process... .1-1-1
Super NES Software Submission Requirements .1-2-1
SECTION 2 - SUPER NES SOFTWARE .2-1-1
Introduction... .2-1-1
Object (OBJ) .. .2-2-1
Background (BG)... .2-3-1
Mosaic. .2-4-1
Rotation/Enlargement/Reduction. .2-5-1
Window (Window Mask) .2-6-1
Main/Sub Screen.. .2-7-1
CG Direct Select. .2-8-1
H-Pseudo 512 .2-9-1
Complementary Multiplication (Signed Multiplication) .2-10-1
H/V Counter Latch. .2-11-1
Offset Change .... .2-12-1
Standard Controller.... .2-13-1
Programmable IO Port ... .2-14-1
AbsoluteMultiplication/Division .2-15-1
H/V Count Timer .... .2-16-1
Direct Memory Access (DMA) .2-17-1
Interlace. .2-18-1
H-512 Mode (BG Mode 5 & 6) .2-19-1
OBJ 33's Lines Over & Priority Order ... 2-20-1
CPU Clock and Address Map. .2-21-1
Super NES Functional Operation... .2-22-1
System Flowchart.... .2-23-1
Programming Cautions... .2-24-1
Documented Problems.. .2-25-1
Register Clear (Initial Settings) .2-26-1
PPU Registers .... .2-27-1
CPU Registers... .2-28-1
```

<!-- book1 p002 -->

```
TABLEOf CONTENTS
Table of Contents (Continued)
SUBJECT PAGE
SECTION 3 - SUPER NES SOUND .3-1-1
SNES Sound Source Outline .3-1-1
BRR (Bit Rate Reduction). .3-2-1
VO Ports ...... .3-3-1
Control Register .... .3-4-1
Timers..... .3-5-1
DSP Interface Register.... .3-6-1
Register Used. .3-7-1
CPU Organization.... .3-8-1
Sound Programming Cautions. .3-9-1
SECTION 4 - SUPER NES CPU DATA .4-1-1
Outline... .4-1-1
Explanation of CPU Terminal Functions. .4-2-1
Explanation of Functions .. .4-3-1
Addressing Mode. .4-4-1
Command Set (Alphabetical Order) .4-5-1
Command Set (Matrix Display). .4-6-1
Cycles and Bytes of Addressing Modes .4-7-1
Differences Among 65C816, 65C02, and 6502 .4-8-1
Restrictions Upon Use & Application Information... .4-9-1
Details of Command Functions .. .4-10-1
Description of Commands .4-11-1
AC Characteristics.... .4-12-1
TABLES OF APPENDIX
Appendix A - PPU Registers. A-1
Appendix B - CPU Registers .B-1
Appendix C - SPC700 Commands .. ..C-1
Appendix D - Data Transfer Procedure ..D-1
INDEX
11
```

<!-- book1 p003 -->

```
TABLEOfCONTENTS
Table of Contents (Continued)
BOOK II
SUBJECT PAGE
SECTION 1 - SUPER ACCELERATOR (SA-1) 1-1-1
Super Accelerator System Functions. .1-1-1
Configuration of SA-1 .1-2-1
Super Accelerator Memory Map .1-3-1
SA-1 Internal Register Configuration .1-4-1
Multi-Processor Processing ..1-5-1
Character Conversion.. ..1-6-1
Arithmetic Function. .1-7-1
Variable-Length Bit Processing .1-8-1
DMA..... .1-9-1
SA-1 Timer. .1-10-1
SECTION 2 - SUPER Fx? .2-1-1
Introduction to Super FX .2-1-1
GSU Functional Operation .2-2-1
Memory Mapping .... .2-3-1
GSU Internal Register Configuration .2-4-1
GSU Program Execution.. .2-5-1
Instruction Execution. .2-6-1
Data Access. .2-7-1
GSU Special Functions. .2-8-1
Description of Instructions. .2-9-1
SECTION 3 - DSP/DSP1 .3-1-1
Introduction to DSP1 3-1-1
Command Summary .. .3-2-1
Parameter Data Type.. .3-3-1
Use of DSP1. .3-4-1
Description of DsP1 Commands .3-5-1
Math Functions and Equations. .3-6-1
ili
```

<!-- book1 p004 -->

```
TABLEOfCONTENTS
Table of Contents (Continued)
SUBJECT PAGE
SECTION 4 - ACCESSORIES .4-1-1
The Super NES Super Scope? System... .4-1-1
Principles of the Super NES Super Scope .4-2-1
Super NES Super Scope Functional Operation ..4-3-1
Super NES Super Scope Receiver Functions. .4-4-1
Graphics... .4-5-1
Super NES Mouse Specifications .. .4-6-1
Using the Standard BIOS. .4-7-1
Programming Cautions .4-8-1
MultiPlayer 5 Specifications.... .4-9-1
MultiPlayer 5 Supplied BIOS. .4-10-1
SUPPLEMENTAL INFORMATION
Super NES Parts List
Game Content Guidelines..
Guidelines Concerning Commercialism and Promotion of Licensee
Products or Services in Nintendo Licensed Games
Super NES Video Timing Information 10
INDEX
BULLETINS
1V
```

<!-- book1 p005 -->

```
LISTofFIGURES
List of Figures
BOOK I
FIGURE
TITLE NUMBER PAGE
Software Approval Process.. .1-1-1 .1-1-1
Picture Image .... .2-1-1 .2-1-1
Scanning Pattern for Interlace... .2-1-2. .2-1-2
Super NES Functional Block Diagram.. .2-22-1 .2-22-1
System Block Diagram ... .3-1-1. .3-1-2
Memory Map. ...... .3-1-2. .3-1-3
Sound Signal Flow ... .3-1-3. .3-1-4
BRR Data String .... .3-2-1. .3-2-1
BRR Range Data.... .3-2-2. .3-2-2
Example Data When Filter = 0 .3-2-3. .3-2-3
V/O Diagram ..3-3-1. .3-3-2
Port Clear ... ..3-4-1. .3-4-1
Clear Timing .3-4-2. .3-4-1
Timer Control. ..3-4-3. .3-4-2
Timer Section. .3-5-1. .3-5-1
4-Bit Counter .. ..3-5-2. .3-5-2
Timing..... .3-5-3. .3-5-2
Timer Related Registers.... .3-5-4.. .3-5-3
Interface Register ..... .3-6-1.. .3-6-1
Interface Register Flow... .3-6-2. .3-6-1
Bent Line Mode .3-7-1. .3-7-4
CPU Registers.... 3-8-1. .3-8-3
Boolean Bit Operation Commands .3-8-2. .3-8-8
Memory Access Addressing Effective Address .3-8-3. .3-8-9
Wave-form Overflow.. .3-9-1. .3-9-1
SNES CPU Block Diagram .. .4-1-1. .4-1-2
SNES CPU Terminal Interface Diagram .. .4-1-2. .4-1-3
SNES CPU Timing Chart. .4-12-1... .4-12-2
S-PPU Main/Sub Screen Window. A-1 .A-23
```

<!-- book1 p006 -->

```
LISTofFIGURES
List of Figures (Continued)
BOOK II
FIGURE
TITLE NUMBER PAGE
Super Accelerator System Configuration .1-1-1. .1-1-3
SAS Bus Image... .1-1-2. .1-1-4
SA-1 Block Diagram... .1-2-1 .1-2-1
Bitmap Register Files 0~7 .1-4-1. .1-4-24
Bitmap Register Files 8~F ..1-4-2 .1-4-25
Accelerator Mode.... ..1-5-1. .1-5-6
Parallel Processing Mode. ..1-5-2. ...1-5-7
Mixed Processing Mode ..1-5-3.. ..1-5-8
Character Conversion 1. ..1-6-1.. ..1-6-1
Character Conversion 2. ..1-6-2.. ..1-6-2
Compressed Bitmap Data .. 1-6-3.. ..1-6-3
Bitmap Image Projection ..1-6-4.. ..1-6-3
Bitmap Data Expansion ..1-6-5.. ..1-6-5
Memory Addresses for the Bitmap Area ..1-6-6.. ..1-6-6
Character Conversion Buffers.. ..1-6-7.. ..1-6-7
Fixed Mode Process Flow Diagram. ..1-8-1.. ..1-8-2
Auto-increment Mode Process Flow Diagram ..1-8-2. ..1-8-3
Barrel Shift Process.. ..1-8-3.. ..1-8-5
Normal DMA ..1-9-1.. .1-9-1
Character Conversion DMA ..1-9-2.. .1-9-1
Super FX System Configuration...... .2-1-1. .2-1-3
Game Pak ROM/RAM Bus Diagram ... .2-1-2. .2-1-4
GSU Functional Block Diagram... .2-2-1. .2-2-1
Super NES CPU Memory Map.. .2-3-1. .2-3-2
Super FX Memory Map .... .2-3-2 .2-3-4
Example of General Register. .2-4-1. .2-4-2
128 Dot High BG Character Array .... .2-8-1. .2-8-2
160 Dot High BG Character Array ... .2-8-2. .2-8-2
192 Dot High BG Character Array . .2-8-3.. .2-8-2
OBJ Character Array.... .2-8-4.. .2-8-3
Plot Operations Assigned by CMODE .2-8-5.. .2-8-13
System Block Diagram (DSP1) . .3-1-1. .3-1-2
Super NES CPU and DSP1 Communications ..3-1-2. .3-1-3
DSP1 Command Execution ..3-1-3. .3-1-3
Mode 20/DSP Memory Map. .3-1-4. .3-1-4
Mode 21/DSP Memory Map. ..3-1-5. .3-1-5
Super NES/DSP1 Memory Mapping (Mode 21) .3-4-1.. .3-4-1
DSP1 Status Register Configuration... .3-4-2 .3-4-2
```

<!-- book1 p007 -->

```
LIST ofFIGURES
List of Figures (Continued)
FIGURE
TITLE NUMBER PAGE
DSP1 Operations Flow Diagram .3-4-3. 3-4-3
Super NES CPU/DSP1 Operational Timing. .3-4-4. .3-4-4
Trigonometric Calculation.. ..3-5-1.. .3-5-3
Vector Calculation.... ..3-5-2. .3-5-4
Vector Size Comparison ..3-5-3... .3-5-6
Vector AbsoluteValue Calculation. ..3-5-4.. .3-5-7
Two-Dimensional Coordinate Rotation.. ..3-5-5.. ..3-5-8
Examples of Three-Dimensional Rotation. ..3-5-6... ..3-5-11
Assignment of Projection Parameter .. ..3-5-7.. ..3-5-13
Relationship of Sight and Projected Plane. ..3-5-8.. ..3-5-13
Calculation of Raster Data. ..3-5-9.... ..3-5-16
BG Screen and Displayed Area ... ..3-5-10.. .3-5-16
Calculation of Projected Position of Object... .3-5-11. .3-5-18
Projection Image of Object... ..3-5-12. .3-5-19
Calculation of Coordinates for the Indicated Point on the Screen... ..3-5-13 .3-5-20
Attack Point and Position Indicated on Screen (Side View) ... ..3-5-14. .3-5-21
Attitude Computation .... .3-5-15. .3-5-23
Object Coordinate Rotated on Y Axis .3-5-16. .3-5-23
Object Coordinate Rotated on X Axis .3-5-17. .3-5-23
Object Coordinate Rotated on Z Axis. .3-5-18. .3-5-23
Conversion of Global to Objective Coordinates.. .3-5-19. .3-5-26
Conversion of Object to Global Coordinates. ..3-5-20.... .3-5-28
Calculation of Inner Product with Forward Attitude ..3-5-21... .3-5-29
Position of Aircraft and Vector Code ..3-5-22 .3-5-30
Calculation of Rotation Angle After Attitude Change ..3-5-23 .3-5-32
Signal Flow..... .4-1-1. .4-1-1
Optical Alignment. ..4-1-2.. .4-1-2
Virtual Screen Alignment . ..4-1-3. .4-1-2
Address and Bit Assignments .4-1-4. .4-1-5
Picture Tube .4-2-1.. .4-2-1
Scanning.... .4-2-2. .4-2-2
Area Seen by Super NES Super Scope ... .4-2-3... .4-2-3
Vertical Positioning ... ..4-2-4.. .4-2-4
Horizontal Positioning .... .4-2-5.. .4-2-5
Horizontal/Vertical Counter.... .4-2-6.. .4-2-6
Super NES Super Scope Block Diagram.... .4-3-1. .4-3-2
Super NES Super Scope Flow Diagram. ..4-3-2. .4-3-3
Raster Signal.... .4-3-3. .4-3-4
Definition of One Bit . .4-3-4. .4-3-5
Output Signal Code. .4-3-5 .4-3-5
Definitions of Codes .4-3-6 .4-3-6
vii
```

<!-- book1 p008 -->

```
LISTofFIGURES
List of Figures (Continued)
FIGURE
TITLE NUMBER PAGE
Raster Signal Transmission Timing... .4-3-7. .4-3-7
Receiver Block Diagram..... .4-4-1 .4-4-1
Operation Flow Diagram .... .4-4-2 .4-4-2
Receiver/TransmitterInterface Schematic. .4-4-3 .4-4-3
One Bit Code Detection. .4-4-4. .4-4-4
Cursor Mode Raster Detection Cycle .4-4-5.. ..4-4-6
Trigger Mode, Single Shot... .4-4-6.. .4-4-7
Trigger Mode, Multiple Shots... ..4-4-7... ..4-4-8
Noise Flag .... ..4-4-8... ..4-4-9
Null Bit ... ..4-4-9... ..4-4-9
Pause Bit ..4-4-10... .4-4-10
Trigger, Single Shot. ..4-4-11.. .4-4-11
Trigger, Multiple Shots... .4-4-12.. .4-4-12
Optical Color Sensitivity Chart. ..4-5-1.. ..4-5-2
Valid Hyper Mouse Data String ..4-6-1.. .4-6-2
Serial Data Read Timing... .4-6-2. .4-6-3
Explanation of Data Strings 2 Bits or Longer... .4-6-3.. .4-6-6
Super NES Hyper Mouse Dimensions.... .4-6-4.. .4-6-7
Standard BIOS, Output Register..... .4-7-1. .4-7-3
Examples of Speed Switching Program Subroutine Call .4-7-2. .4-7-4
MultiPlayer 5 Device Hardware Connections ... .4-9-1. .4-9-2
MultiPlayer 5 Read Timing Chart, 5P Mode. .4-9-2 .4-9-5
Data Read Timing for Dissimilar Devices... .4-9-3. .4-9-8
Valid Controller Data String.. .4-9-4. .4-9-12
Sample Program Display Format. .4-10-1.... ..4-10-2
vili
```

<!-- book1 p009 -->

```
LISTofTABLES
List of Tables
BOOKI
TABLE
TITLE NUMBER PAGE
B-Bus Address Changes .2-17-1. .2-17-2
A-Bus Addressing... .2-17-2.. .2-17-4
BRR Filter Values.. ..3-2-1.. ..3-2-2
Peripherals. ..3-3-1.. ..3-3-1
Port0 - Port3 Registers. ..3-3-2. ..3-3-2
Timer Function.. ..3-5-1.. ..3-5-1
DSP Register Map. .3-7-1. ..3-7-1
ADSR Parameters .3-7-2. ..3-7-3
Gain Parameters.... .3-7-3.. ..3-7-5
Noise Generator Clock. .3-7-4.. ..3-7-8
Source Directory .... .3-7-5... .3-7-11
Source Data Block Format .3-7-6.... ..3-7-12
Opcode Matrix .... .4-6-1... ..4-6-2
Address Modes.... .4-7-1.. ..4-7-1
Table of Operations.... .4-7-2 .4-7-2
AC Characteristics .4-12-1... ..4-12-1
Command Operand Symbols and Meaning ..C-1
Symbols and Meaning for Operational
Description... C-2 .C-2
Explanation of Symbols in the Status
Flag Column ... ..C-3.. ..C-2
Data Transmission Commands, Group 1 ..C-4... ..C-3
Data Transmission Commands, Group 2 ..C-5... ..C-3
Data Transmission Commands, Group 3 ..C-6... ..C-4
Arithmetic Operation Commands ..C-7.. ..C-5
8-Bit Logic Operation Commands. ..C-8... ...C-6
Addition and Subtraction Commands. ..C-9... ...C-7
Shift Rotation Commands... ..C-10... ..C-7
16-Bit Data Transmission Commands ..C-11... ..C-8
16-Bit Operation Commands.... ..C-12... ..C-8
Multiplication and Division Commands. ..C-13.... .C-8
Decimal Compensation Commands.. ..C-14.... ...C-8
Branching Commands... ..C-15... ...C-9
Subroutine Call, Return Commands ..C-16.... ...C-9
Stack Operation Commands ..C-17.... ...C-9
Bit Operation Commands ..C-18.... ..C-10
Program Status Flag Operation Commands .C-19.... ...C-10
Other Commands .C-20.... ...C-10
ix
```

<!-- book1 p010 -->

```
LISTofTABLES
List of Tables (Continued)
BOOK II
TABLE
TITLE NUMBER PAGE
Types of Interrupts... .1-5-1. ..1-5-2
Interrupt Identification and Clear. ..1-5-2.. ..1-5-2
Interrupt Mask ..1-5-3.. ..1-5-3
Sending and Receiving a Message. ..1-5-4.. ..1-5-3
Situation Dependant Vectors ..1-5-5.. .1-5-4
Operating Modes and Processing Speeds ..1-5-6. ..1-5-9
Horizontal Size of VRAM (CDMA Register) ..1-6-1.. .1-6-6
Number of Zero Bits in BW-RAM... .1-6-2.. ..1-6-8
Character Conversion and Data Format... .1-6-3.... ..1-6-10
Arithmetic Operations Settings and Cycles .. .1-7-1... .1-7-1
Amount of Barrel Shift... .1-8-1... .1-8-4
Source Device Settings .... .1-9-1... ... 1-9-3
Destination Device Settings... .1-9-2. ..1-9-3
DMA Transmission Speed .1-9-3.. ..1-9-4
Timer Modes and Their Ranges.. .1-10-1... .1-10-1
Timer Interrupts .. .1-10-2.. .1-10-2
Registers Listed by Functional Group ... .2-2-1... .2-2-3
Instruction Set.... .2-2-2.. .2-2-6
GSU General Registers .... .2-4-1... .2-4-1
GSU Status Register Flags... .2-4-2... .2-4-4
Screen Height. .2-4-3... .2-4-8
Color Gradient .2-4-4... ..2-4-8
Dummy Interrupt Vector Addresses ..2-5-1... ..2-5-4
Dummy Data..... ..2-5-2.. ..2-5-5
Functions of CMODE ..2-8-1... ..2-8-9
DSP1 Command Summary .... .3-2-1. .3-2-1
Parameter Data Type.... .3-3-1... ..3-3-1
Signal Bit Definitions ... .4-1-1... ...4-1-6
MultiPlayer 5 Switch Function .. .4-9-1... ...4-9-3
MultiPlayer 5 Data Format. 4-9-2.. .4-9-6
```

<!-- book1 p011 -->

```
SNESDEVELOPMENTMANUAL
[Nintendo Licensee Letterhead{
[Insert Date]
Re: Confidentiality Agreement
Dear
(the “"Company") is a licensee of certain confidential, pro-
prietary, and trade secret information belonging to Nintendo of America Inc. ("Nintendo"). Such
information of Nintendo may be provided to you by the company or directly by Nintendo in reli-
ance on your relationship to the Company and your agreement expressed herein. All references in
this letter to confidential, proprietary, and trade secret information will be deemed to refer solely
to confidential, proprietary, and trade secret information of Nintendo and its affiliated corpora-
tions.
Your obligations in connection with confidential, proprietary, and trade secret information
of the Company which are reflected in other agreements between you and the Company, remain
unchanged, and are in full force and effect.
In consideration of the disclosure of confidential, proprietary, and trade secret information
  ou l o  an  ss o  e  x   no o 
time during the term of your association with the Company, or at any time thereafter, directly or
indirectly use, communicate, disclose, disseminate, discuss, lecture upon, or publish articles con-
cerning such confidential, proprietary, and trade secret information without the prior written con-
sent of the Company.
"Confidential, proprietary, and trade secret information”’ as used herein means any and all
which are applicable to the Nintendo Entertainment System (NES"), Game Boy hand held video
system ("Game Boy"), Super Nintendo Entertainment System (Super NES), or other hardware,
accessory, or software products of Nintendo, (ii) the design, and operation of the NES, Game
Boy, Super NES, or other Nintendo products, including without limitation the security system of
such products, and (i) new products, marketing plans, know-how, techniques, and methods relat-
ing to the development of software for the NES, Game Boy, Super NES, or other Nintendo hard-
ware, accessory, or software products disclosed to you as a consequence of, or during your
association with the Company. Such confidential, proprietary, and trade secret information will
not include information which is: (i) a part of the public domain; or (i) obtained by you from
someone otherwise authorized to disclose such information.
All documents, tapes, computer records, notebooks, work papers, notes and memoranda
containing confidential, proprietary, and trade secret information, made or compiled by you at any
time, or made available to you during the term of your association with the Company, including
all copies thereof, will be the property of the Company, and will be held by you in trust and solely
for the benefit of the Company, and will be promptly delivered to the Company upon termination
of your association with the Company or at any time upon request by the Company.
In the event of any material breach by you of your obligations under this agreement, then
the Company will be entitled to such relief, including injunctive relief and damages, including at-
torney's fees, as may be awarded by a court of competent jurisdiction, in addition to all other re-
lief available to the Company. In the event the Company fails to take action against you for such a
breach, Nintendo will have a direct right of action against you, without the necessity of naming
the Company.
2
```

<!-- book1 p012 -->

```
PREFACE
Preface
TECHNICAL QUESTIONS
If you need technical assistance with your Nintendo Licensee product, our
Licensee Support Group Engineers are available between 9:00 a.m. and 6:00 p.m.
Pacific Standard Time.
Telephone: 1-206-861-2715
Fax: 1-206-882-3585
Written Inquiries: Nintendo of America Inc.
Engineering Department
Licensee Support Group
4820 150th Ave. N.E.
Redmond, Wa. 98052
CONFIDENTIALITY
Pursuant to the terms of each Nintendo product license and/or confidentiality
agreement, Nintendo licensees and developers are required to secure the confidential treat-
ment of information received or derived from Nintendo from all employees, agents, or
contractors.
In response to the request of several licensees, we have prepared a supplemental
confidentiality agreement which is intended to cover only Nintendo derived information
that may be used in your business in addition to confidentiality agreements which you will
ment is included at the end of the Preface for your information.
This supplemental agreement is a suggested format only and is not a required
form, as laws in your state or jurisdiction may vary. You may wish to consult with your
own legal counsel regarding recommended formats for your state/country. In many cases,
your existing confidentiality agreements will protect both Nintendo and you fully. Howev-
er, we urge each of you to review agreements that you have in place and consider this sup-
plemental agreement, or other supplements, as may be appropriate or necessary to protect
the rights of Nintendo.
If you do not presently have a confidentiality agreement in place for your own em-
ployees, agents, or contractors, including those who have access to confidential informa-
tion of Nintendo, we suggest you contact your legal counsel for advice on proper
agreements to protect your valuable confidential information and to insure that you are
fully in compliance with your Nintendo license/confidentiality agreement.
Please contact our Legal or Licensing Departments at 1-206-882-2040 between
9:00 a.m. and 6:00 p.m. Pacific Standard Time, with any questions you may have concern-
ing this matter.
```

<!-- book1 p013 -->

```
PREFACE
The obligations set forth in this letter regarding treatment of confidential, proprietary, and
trade secret information are continuing obligations which will continue regardless of your con-
tinuing association with the company.
Please acknowledge your understanding and acceptance of the foregoing by signing and
returning two (2) copies of this letter to the Company for the benefit of the Company and Ninten-
do.
Yours sincerely,
[Insert Nintendo Licensee/Developer Name]
By:
ACKNOWLEDGEDANDACCEPTED
[Insert Contractor or Employee Name]
By:
Date:
```
