# Section 1 — Approval Process

> Submission requirements include the ROM/cartridge format & header detail.

## Contents (per the manual's own TOC)

- 1-1 NOA Licensed Software Approval Process (p14)
- 1-2 Super NES Software Submission Requirements (p19) — hardware/ROM format specs

## Provenance

```
Source: `snes_manual/book1.pdf` (Nintendo Super NES Development Manual, Book I),
scanned 240-page image-only PDF (no text layer). Per-page text below is produced by
RapidOCR (ONNX) at 300 DPI. **Prose is a usable baseline; hex / disassembly / tables
carry OCR noise (dropped inter-word spaces, 0/O, S/s, l/I confusion) and must be
verified against the page image before being treated as fact.** Each page is tagged
with `<!-- book1 pNNN -->` so a specific page can be re-verified and corrected.
```

## Body (pages 14–58)


<!-- book1 p014 -->

```
NOALICENSEDSOFTWAREAPPROVALPROCESS
Chapter 1. NOA Licensed Software Approval Process
fords interested parties to become Nintendo Authorized Software Developers and/or Nin-
tendo Authorized Software Licensees. The normal process is summarized below.
Developer Inquiry
▼
DeveloperApplication
▼
NOA Assessment
4
Confidentiality
Agreement
Nintendo Authorized Software Developer
Technical Support
Licensee Inquiry
Licensee Application
NOA Assessment
Product Submission
ProductEvaluation/Approval
+
License Agreement
Nintendo Authorized Software Licensee
Produce Product
Figure 1-1-1 Software Approval Process
Specific questions not answered within this manual should be addressed to NOA's Li-
censing Department.
1-1-1
```

<!-- book1 p015 -->

```
SNESDEVELOPMENTMANUAL
1.2 AUTHORIZED SOFTWARE DEVELOPER REQUIREMENTS
Parties interested in becoming a Nintendo Authorized Software Developer may
contact the NOA Licensing Department via telephone, FAX, or in writing.
Written Inquiries: Nintendo of America Inc.
Licensing Department
4820-150th Avenue N.E.
Redmond,WA98052USA
Telephone: (206) 882-2040
FAX: (206) 882-3585
In response, the NOA Licensing Department will send a letter which describes
specific requirements for becoming a licensed developer. These requirements are
described, in general, below.
1.2.1 LETTER OF APPLICATION
A prospective developer's letter of application should include the follow-
ing items.
1)
cluding a summary of software development or related experience,
in the form of a prospectus, business plan, or summary statement.
2 A detailed introduction to key personnel and developers setting forth
which they have contributed.
3)
third party licensees.
4) A description of business facilities and equipment.
5)
company's employees/agents are required to sign.
6) A complete listing and at least three samples of software previously
developed, especially those which incorporate elements important
to successful NOA software or similar entertainment software.
1-1-2
```

<!-- book1 p016 -->

```
NOALICENSEDSOFTWAREAPPROVALPROCESS
1.2.2 2NOAASSESSMENT
NOA will review the material submitted and make a preliminary determi-
designation as an authorized software developer forNintendo.Because
belonging to Nintendo, and because many of Nintendo's licensees rely
onrecommendationsandreferralstoauthorizeddevelopers,Nintendo
exercises a very high level of care in approving only a select number of
authorized developers. The Licensing Department will contact the pro-
spective developer with the results of NOA's assessment.
1.2.3 CONFIDENTIALITYAGREEMENT
If the prospective developer's qualifications support designation as a li-
party described within the agreement becomes a Nintendo Authorized
Software Developer for the specified product line(s).
1.2.4 TECHNICAL SUPPORT
All technical documentationwhich is availablefor the licensed product
the confidentiality agreement. In addition, access is afforded to NOA's
Engineering Department Licensee Support Group and NOA's Product
Development and Analysis Department. These two support groups wil!
cations which are subject to special product development.
1.3 AUTHORIZED SoftWare LICENSEE REQUIREMENTS
To license a software product once it has been developed, the interested party
enseeorbecome a NintendoAuthorized Software Licensee.NOAwouldprefer
that interested parties contact Nintendo early in the development phase of a prod-
uct. Therefore, the interested party will already be a licensed developer when they
apply to become an software licensee. Exceptions will be made, however, for
those parties which have already developed a software product and wish to li-
cense it with Nintendo. In such cases, the interested party will be processed and
approved as a Nintendo Authorized Software Developer first, then processed as a
Nintendo Authorized Software Licensee. In either case, the requirements in the
following paragraphs will apply.
1-1-3
```

<!-- book1 p017 -->

```
SNESDEVELOPMENTMANUAL
Parties interested in becoming a Nintendo Authorized Software Licensee should
sponse, the NOA Licensing Department will send a letter which describes specific
1.3.1  LETTER OF APPLICATION
items.
vant industry experience, financial resources and stability, and in-
form of a prospectus, business plan, or summary statement.
2) A detailed introduction to key personnel and developers setting forth
any technical, managerial, or development experience which may
be relevant.
3)
retail price points, targeted distribution channels, advertising com-
4) Any market study information on consumer demand for the pro-
posed product(s) which the company may be relying upon.
5) A written description (in general terms) of the proposed product.
6) A complete listing and at least three samples of software previously
to successful NOA software or similar entertainment software.
1.3.2 NOA ASSESSMENT
NOA will make a preliminary determination if the:
a) Product would compliment our current line of video game prod-
ucts.
b) Company is capable of the distribution and customer service
necessary to support a successful product.
C)  Product has any special technical requirements.
NOA's Licensing Department will inform the company of the decision
made.
1-1-4
```

<!-- book1 p018 -->

```
NOALICENSEDSOFTWAREAPPROVALPROCESS
1.3.3 TECHNICAL SUPPORT
If NOA decides to proceed, the prospective licensee will be provided with
formation required. Technical support will be provided throughout the de-
velopment of the product, as needed. With respect to those parties
previously licensed as developers, this will mean continued support;
while those parties contacting Nintendo for the first time will receive a set
of technical documentation which is related to the proposed product. A
formal confidentiality agreement must be formalized prior to the release
of support materials, if one is not already on file.
1.3.4 PRODUCTSUBMISSIONANDTESTING
spective licensee, it should be submitted in accordance with the applica
ble software submission requirements, "Super NES Software Submission
Requirements"are presented in the following chapter. The samples pro-
vided will be tested and results forwarded to the prospective licensee. In
cases where failure conditions are detected during testing, NOA will re-
quire that the area(s) be corrected and the product be resubmitted for
testing.
1.3.5 FORMAL LICENSE AGREEMENT
Once the proposed product is approved, NOA will prepare a formal li-
When formalized, this agreement authorizes the licensee to go into pro-
duction with the specified licensed product.
1-1-5
```

<!-- book1 p019 -->

```
SNESDEVELOPMENTMANUAL
Chapter 2. Super NES Software Submission Requirements
All software submissions to Nintendo of America Inc. must be forwarded to the attention
ing queue may be delayed. To help reduce a submission's turn-around time, it is sug-
gested that licensees assign a primary contact person for each software submission. All
through this individual. The contact person should also be responsible for notifying any
other interestedparties.
When a submission is not approved, NOA may send a videotaped copy of the program-
to assist the licensee in analyzing the cause of the software problem. It is the licensee's
strongly encourages that copies be sent to developer(s) of the software as quickly as
possible.
2.1 SPECIFICATION SHEET AND CHECK LIST
The appropriate Software Specification sheet and the Software Submission
checklist must be filled out completely and must be correct for the particular pro-
gram version.
2.2 PROGRAM ROMS
production. If a submission RoM is not available in the size to be used, the next
size smaller should be used (i.e., a 3M program should be submitted on two 2M
ROMs). All ROMs submitted must be of the same manufacturer, size, and part
number. A label should be attached to each master ROM which lists game code,
ROM version, and ROM number. A copy of the game ROMs submitted should be
retained by the licensee for reference, as NOA cannot return originals or copies of
submittedROMs.
1-2-1
```

<!-- book1 p020 -->

```
SUPERNESSOFTWARESUBMISSIONREQUIREMENTS
2.3 EP-ROMs
Submit only the following EP-ROM types for approval.
4M: TOSHIBA TC574000D, SGS THOMPSON M27C4001,
HITACHI HN27C4001, MITSUBISHI M5M27C401K,
NEC D27C4001, Texas Instruments TMS27C040-JL,
TMS27C040-JL4,TMS27C040-JE,TMS27C040-JE4,
ATMEL AT27C040-12C, MACRONIX MX27C4000DC-12
8M: ATMEL AT27C080-10DC,AT27C080-12DC, NEC D27C8001
SGSTHOMPSONM27C801-120F1
Note: All RoMs must be 200ns or faster for Normal Speed.
All RoMs must be 120ns or faster for High Speed.
2.4 ROM DATA
In addition to the EP-ROMs, a copy of the ROM data must be submitted in binary
format on MS-DOS@ 3.5 inch disk(s). The size of the file must be equal to the size
of the EP-ROM (i.e., one 4 Meg EP-ROM = one 4 Meg file).
2.5 GAME PLAY VIDEO TAPE/RATING CERTIFICATE
A video tape containing complete game play is required unless the product has
been rated by the Entertainment Software Ratings Board (ESRB). If the product
the submission and no video tape is needed.
2.6 SCREEN TEXT
A printed copy of the complete screen text must be submitted.
2.7 INSTRUCTION MANUAL
Complete game play instructions must be submitted.
NOTE: If any of these items are not satisfied, the program will be rejected
and will not be submitted into the approval process until all criteria
are met.
1-2-2
```

<!-- book1 p021 -->

```
SNESDEVELOPMENTMANUAL
2.8 SOFTWARE VERIFICATION
The following verification process will significantly improve the probability of ap-
proval of your software.
1. The licensing screen on all submissions should state “"LICENSED BY NIN-
TENDO".
2. Confirm the Licensing Screen information is correct.
3. Check the spelling on the Licensing Screen and Title Screen, as well as the
spelling and grammar in the screen text.
4. Confirm the use of a TM, circle R (@), or circle C (@) where applicable.
5.
Licensing Screen is visible for at least one second, even if any combination
of controller buttons are pressed repeatedly. Also "Power-up" the software
6. Game characters should be moved in all possible directions or positions,
regardless of whether it is required to play the game properly. For instance,
game, go there anyway to assure there are no programming problems in
going to that location.
7.
The software should be paused many times during the test, as this often
causes programming problems to surface.
8.
All testing should be recorded onto a videotape, making it easier to review
programming problems.
9. The entire attract mode (demo) should be viewed to assure there are no
programming problems.
10.
the software should be removed from the game prior to submission. This
includes routines to determine hardware type.
11.
All references to the Super Famicom, Super Famicom logos, or Super
Famicom controllers (with multi-colored buttons) should be removed or re-
vised to represent the Super NES.
12.
All games for use with the Super NES Super Scope are required to include
a calibration mode.
13.
key.
1-2-3
```

<!-- book1 p022 -->

```
SUPERNESSOFTWARESUBMISSIONREQUIREMENTS
1. The licensee game play video tape must be recorded on a VHS
tape, Standard Play speed (SP) for clarity.
2. No editing of the tape is allowed.
3. If more than one tape is needed to show the entire piece of soft-
ware, then when a second tape begins it must show that the player
is in the exact same place as when the first tape left off.
4. No codes or "built-up" characters are allowed.
5. All levels or areas must be compieted, in succession.
6. Screen text must have correct grammar and spelling.
7. No deviations from NOA Software Standards Policy may be present.
8. The entire ending credits (if any) must be shown.
2.8.2 LICENSING SCREEN INFORMATION PASS/FAIL GUIDELINES
The following Licensing information should be included for all software.
This can be displayed on one (1) or two (2) screens.
1. Licensee's software title.
2. Licensee's trademark and copyright notice
(@ 19__ Licensee's name or copyright owner)
3. LICENSED BY NINTENDO
EXAMPLE:
Tom's GolfTMor?
@ 1992 ABC Corporation
LICENSEDBY NINTENDO
If a blank screen appears for more than two seconds when powered up,
Nintendo suggests placing a message or graphic on the screen so that
a blank screen appears for more than five seconds during game play, a
message or graphic should also be placed on the screen.
2.8.3 COMMON PROBLEMS
Some possible problems that may prevent approval of a piece of software
include, but are not limited to the following:
1. Lock up of the software.
2. Scrambled blocks or characters appear on the screen.
3. The software won't pause.
4. Your character can get stuck somewhere with no possible way to
get out.
5. Scrambled graphics at the edges of the screen when the screen
scrolls in any direction.
6. Vowels in the passwords or password entry-system.
7. Colored lines at the top or bottom of the screen.
8.
9. Inconsistent scoring methods.
1-2-4
```

<!-- book1 p023 -->

```
SNESDEVELOPMENTMANUAL
10. Flashes on screen.
11. Small flickering lines on the screen.
12. Hit or be hit by an enemy but no damage is incurred.
13. Three (3) or four (4) player game can be started without using a four
player adapter.
14.
for all formats.
15. Violation of any Programming Cautions in the product Development
Manual.
16. Use of the Nintendo logo or representations of Nintendo products in
software without license agreement.
17. The use of the term Super Nintendo or Nintendo when the Super
Nintendo Entertainment System or Nintendo Entertainment System
is the intended reference, respectively.
18. Character actions are inconsistent (for instance, a character that
cannot fly, being able to walk off the edge of a platform and stand in
midair).
19. Referring to the Nintendo control pad by an unacceptable term,
such as; "joypad", "directional control", etc.
20. Referring to the Nintendo Controller by an unacceptable term, such
as; "joystick", etc.
21. Referring to the Nintendo game pak by an unacceptable term, such
as; "Game Cassette", etc.
22. Note: If Licensor approval is required, please assure that this has
been finalized before the software submission has been made.
23. Display of Super Famicom symbols or controllers in Super NES
games.
2.8.4 A NOTE ON OBJECTIONABLE MATERIAL
A copy of the Nintendo "Game Content Guidelines" is included in book 2 of
this manual. If you are unsure of whether an item of text or element of a
game is within Nintendo Software Standards, you may contact our Product
amount of text, please send it to the attention of NOA Product Testing Su-
pervisor, using the address listed in the Preface of this manual, with the
questionable items highlighted. The material will be evaluated and you will
be contacted within a week to ten days.
1-2-5
```

<!-- book1 p024 -->

```
SUPERNESSOFTWARESUBMISSIONREQUIREMENTS
SOFTWARE SUBMISSION
CHECK LIST
MACHINE TYPE SNS VUE DMG
GAME NAME
COMPANY
GAMECODE SNS VUE_ DMG
VERSION
Evaluation
Approval Ver.
Specification Sheet
1Set of ROMs
(These must be specific EP-RoM type.
See Submission Requirements.)
MS-D0S@ 3 1/2 Disk(s) (Files must be in binary
format. See Submission Requirements for
specific information.)
1 copy of Custom DSP IC if applicable
(Super NES Submissions Only)
1 Copy of VHS Tapes or ESRB Rating
Certificate
Screen Text
Instruction Manual or Game Play Instructions
REMARKS
NOTE: This check list must be included with the software submis-
sion. If any of these items are not satisfied, the program will
be promptly returned and will not be submitted into the ap-
proval process until all criteria are met.
1-2-6
```

<!-- book1 p025 -->

```
SNESDEVELOPMENTMANUAL
THIS PAGE INTENTIONALLY
LEFT BLANK
1-2-7
```

<!-- book1 p026 -->

```
SUPERNESSOFTWARESUBMISSIONREQUIREMENTS
Super NES Software Specification
Game Title
Product Code SNS -
Super Scope SuperNESMouse
Accessories
None
MultiPlayer 5 Other(
Overseas
No'Yes  Game Title:
Version
Country: Release Date:
Company
Department
Contact Name
Address
Tel: Fax No.:
Submission Method of Submission:
Date Mail By Hand
M D Y
RoM Registration Data
Data Name Address Data Data Name Address Data
Game Title FFCOH~
FFBOH H(
Registration FFD4H
Maker Code
FFB1H H( Map Mode FFD5H H
FFB2H H( Cartridge Type FFD6H H
FFB3H H( ROM Size FFD7H H
Game Code
FFB4H H( RAM Size FFD8H H
FFB5H Destination
H( H
Code
Mask ROM Ver. FFDBH H
Expansion
FFBDH H
RAM Size Complement L FFDCH H
Check H FFDDH H
Special Version FFBEH H
L FFDEH H
CartridgeType Check Sum
FFBFH H
(Sub-number) H FFDFH H
*Write equivalent letter in parenthesis “( )".
Game Title Registration
12 3 5
Game Name
FFCO Code (ASCII)
Game Name
Data Registration
FFDO Code (ASCIl)
*Use code 20 (H) to fil space and unused area.
(Continued onreverse side)
Addendum1
1-2-8
```

<!-- book1 p027 -->

```
SNESDEVELOPMENTMANUAL
ROM Version
Mask ROM 口。 口1 □2 □3 口
EP-ROM 口1 □2 □3 45_E(Interim)
Memory Configuration
ROM Size: MBit High Speed Required? 口No
Yes
No Size: Bit
RAM
Yes Battery Back Up? 口No  Yes
None DSP (DSP ）
Super FX (Expansion RAM Bit)
Data back-up: Yes 口 No
External
SuperFX2(ExpansionRAM Bit)
Co-
Data back-up:  Yes  No
processor
 SA-1 Internal RAM Data Back-up:
Yes  No
 Other:_
Check Sums
EP-ROM MBitsx  Pcs x 1 Set
Configuration Manufacturer:
二 TModel No.:
ROMO H ROM4 H
ROM 1 H ROM 5 H
ROM2 H ROM6 H
ROM3 H ROM7 H
Total H
Affixa label tomasterROMwhichcontainsproduct GameCode,ROMVersion,
and ROM Number. Total check sum must be written even though disk media is used.
File Names
Floppy Disk 3.5" DSHD
口HD Pcs x 1 Set
Configuration
FileName HEXCode FileName HEXCode
FILEO H FILE 1
H
FILE2 H FILE 3
H
FILE 4 H FILE 5
H
FILE6 H FILE7
H
Special Programming
Special Programming?  Yes (
） 口No
Remarks:
1-2-9
```

<!-- book1 p028 -->

```
SUPERNESSOFTWARESUBMISSIONREQUIREMENTS
Instructions for Super NES Software Specification
1. Game Title, Product Code, Scheduled Release Date, Accessories, Overseas
Version, Company, Contact, Address, Telephone No., Fax No., submission
date and method.
·Product Code (4 digits) will be determined by Nintendo.
Scheduledreleasedateshouid beentered.
Game Title includes sub-title if any.
Indicate accessories other than standard controller which can be used.
If the product has been sold, or is to be sold in another country; write the game
title, country, and the scheduled release date in that country.
Company, Contact, Address, Telephone No., Fax No. must be completed.
Submission date and method of submission should be entered.
2. ROM Registration Data
Write the contents registered in the indicated addresses of the master ROM.
Refer to “Description of ROM Registration Data Specification" for details. En-
ter AsCll characters in areas marked with parenthesis “()".
3. Game Title Registration
Enter the game title registered in the master ROM using AsCll characters and
their ASCll codes. Refer to"Character Code List for Game Title Registration".
1-2-10
```

<!-- book1 p029 -->

```
SNESDEVELOPMENTMANUAL
4. ROM Version
Mask ROM Version
The Mask ROM Version number starts from O and increases for each revised
version sent for changes after starting production.
EP-ROM Version
The EP-ROM Version number starts from O and increases for each revised
version sent for approval.
Example
First Second Third Fourth Fifth
Mask ROM
0 0 0 1 1
Change after
Version
first production
EPROM 0 1 2 0 1
Version
Version on Title 0.0 0.1 0.2
1.0 1.1
Label of ROM
1
First Production
Sixth Seventh
2 2
Change after
second production
0 1
2.0 2.1
↑ 介
Second Production Third Production
5. Memory Configuration
Enter the memory configuration of the product.
Enter ROM size and whether or not High Speed Mode (3.58MHz operation) is
required.
RAM
If RAM is used, enter memory size and indicate whether or not Battery Back-
up is used.
External Co-processor
If an external co-processor is used (i.e., DSP1, Super FX), select the configu-
ration used.
1-2-11
```

<!-- book1 p030 -->

```
SUPERNESSOFTWARESUBMISSIONREQUIREMENTS
6. Check Sums
Enter the check sum of each ROM submitted. To calculate the check sum, add
eachbyte in theROM data.Thelower 2 bytesof theresulting value is the
check sum.Enter the check sum for each ROM submitted for the master pro-
gram and the total of their individual check sums. The total is calculated by
simply adding the individual check sums. This method of calculation is differ-
ent from the check sum on the ROM Registration Specification.
7. File Names
· Write the file name of each disk using the following conventions.
XXXX XX -X. SFC
Disk Number
ROM Version
Game Code (4 digits of Product Code)
For example,
If the Game Code is AAAE, ROM version is 0.1, and ROM size is 8M; the first
disk (Disk 1 of 1) should be named: “AAAE01-0.SFC" (8M file).
If, on the other hand, the Game Code is MW, ROM version is 1.0, and ROM
size is 20M;
1st Disk (1 of 3) = “MW_E10-0.SFC"(8M file)
2nd Disk (2 of 3) = "MW_E10-1.SFC" (8M file)
3rd Disk (3 of 3) = “MW_E10-2.SFC"(4M file)
Note that when the Game Code only uses 2 digits, a bar "_" is inserted in the
8. Special Programming
protection, it should be indicated. Also, the contents of the special program-
ming must be explained in writing.
Note: When more than one ROM is required for the game program, all ROMs
submitted as a set should be the same part number.
9. Remarks
If a special configuration of game pak is used, please note the special configu-
ration here. Write the name of the evaluation board which was used for debug-
ging the game. Please write the full name as printed on the board. For
example,
SHVC-4PV5B-10
If several boards were used for debugging the game, all boards must be listed.
1-2-12
```

<!-- book1 p031 -->

```
SNESDEVELOPMENTMANUAL
Character Code List for Game Title Registration
00 10 20 30 40 50 60 70 80 FO
0 SP 0 @ P p
1 1 A Q a
b
2 “ 2 B R b r
3 # 3 C S C s
4 $ 4 D T p t
5 % 5 E U e u
6 & 9 IF V f V
7 7 G W W
9
8 ！ 8 H X h
9 9 Y y
A ★ J i z
B K 1 k {
+
C L ￥
<
D M I m 1
E > N A n ～
F ？
o
Note 1: Do not use characters in shaded areas.
Note 2: "SP"means space.
Exanple: If ASCll character is A, ASCll code is 41.
1-2-13
```

<!-- book1 p032 -->

```
SUPERNESSOFTWARESUBMISSIONREQUIREMENTS
ROM Registration Data Specification
1. Insert the game title and Super NES game specification at the specified address-
es in the ROM.
2. The ROM Registration Data area is 48 bytes from address 00:FFB0H ~ 00:FFDFH
in Super NES Memory.
3. The address in ROM for registration data, using Map Mode 20, is 007FB0H ~
007FDFH.
4. The address in ROM for registration data, using Map Mode 21, is 00FFB0H ~
OOFFDFH.
5. The address in ROM for registration data, using Map Mode 23 (SA-1), is 007FBOH
~ 007FDFH.
6. The address in ROM for registration data, using Map Mode 25, is 40FFB0H ~
40FFDFH.
7. ROM registration data should be stored using the format below.
Cartridge Sub-number (Normally OoH)
Special Version (Normally 0oH) -
ExpansionRAMSize
Maker Code
-Game Code
Bank 00
0 12 23 456789ABCDE
FFBOH 00000000000000
FFCOH
Game Title
FFDOH 33
Game Title
Map Mode
Check Sum
Cartridge Type
Complement Check
ROM Size
RAM Size
Destination Code
Mask ROM Version-
8.
game.
00:FFB6H~00:FFBCH= 00H
00:FFDAH = 33H
Addendum1
1-2-14
```

<!-- book1 p033 -->

```
SNESDEVELOPMENTMANUAL
Description of ROM Registration DataSpecification
1. Maker Code (FFBOH, FFB1H)
Enter the 2-digit ASCll code assigned by Nintendo. Refer to the Nintendo/
Licensee contract, if in doubt. All letters must be in upper case.
For example;
If Maker Code is 01, the ASCll code for 0 (30H) is stored at FFB0H and the
ASCll code for 1 (31H) is stored at FFB1H.
If Maker Code is FF, the ASCll code for F (46H) is stored at FFB0H and
FFB1H.
2. Game Code (FFB2H ~ FFB5H)
Enter the 4-digit Game Code assigned by Nintendo in ASCll. All letters must be in
upper case.
For Example;
If Game Code is "SMwJ", the following ASCll codes will be entered at the indi-
cated addresses.
53H (S) = FFB2H
4DH (M) = FFB3H
57H (W) = FFB4H
4AH (J) → FFB5H
If a game program which was previously assigned a 2-digit Game Code is to be
manufactured again, the original 2-digit code will be entered followed by 2
"Space" codes. The ROM submission sheet should be completed in the same
manner.
For example;
If Game Code is "Mw", the following ASCll codes will be entered at the indi-
cated addresses.
4DH (M) → FFB2H
57H (W) = FFB3H
20H (space) = FFB4H
20H (space) = FFB5H
3. Fixed Value (FFB6H ~ FFBCH)
Store fixed value OoH at addresses FFB6H ~ FFBCH.
1-2-15
```

<!-- book1 p034 -->

```
SUPERNESSOFTWARESUBMISSIONREQUIREMENTS
4. Expansion RAM Size (FFBDH)
Enter the size of the expansion RAM installed in the game pak using the table be-
low. If the size used is not listed below, choose the next larger size which is listed.
For example, enter the size of the RAM used for Super FX co-processor. lf no ex-
pansion RAM is installed, enter OoH at address FFBDH.
For game paks which use the SA-1, enter OOH at address FFBDH. Enter the size
of the RAM used asBW-RAM at addressFFD8H.
FFBDH Size of Expansion RAM
OOH None
01H 16 KBit
03H 64 KBit
05H 256 KBit
06H 512 KBit
07H 1 MBit
5. Special Version (FFBEH)
This is only used under special circumstances, such as for a promotional event.
ThecodeOoH shouldbeentered undernormal circumstances.
6. Cartridge Type Sub-Number (FFBFH)
This is only assigned when it is necessary to distinguish between games which
use the same cartridge type. The code OoH is normally assigned.
7. Game Title (FFCOH ~ FFD4H)
Enter the game title using ASCll code (JIS 8 bit). Refer to “Character Code List for
Game Title Registration" for characters which may be used. The code “"20H"
should be used for a space and for all unused areas. The game title registered
should be close to the title under which the game will be marketed, not a tempo-
rary name used for development purposes.
1-2-16
```

<!-- book1 p035 -->

```
SNESDEVELOPMENTMANUAL
8. Map Mode (FFD5H)
This location is used to store the map mode and the speed of operation for the
Super NES CPU. Select the appropriate code from the table below.
FFD5H Map Mode Super NES CPU Clock
20H Mode 20 2.68 MHz (normal speed)
21H Mode 21 2.68 MHz (normal speed)
22H Reserved-Future Use
23H Mode 23 (SA-1) 2.68 MHz (normal speed)
25H Mode 25 2.68 MHz (normal speed)
30H Mode 20 3.58 MHz (high speed)
31H Mode 21 3.58 MHz (high speed)
35H Mode 25 3.58 MHz (high speed)
1-2-17
```

<!-- book1 p036 -->

```
SUPERNESSOFTWARESUBMISSIONREQUIREMENTS
9. Cartridge Type (FFD6H)
Indicate the game pak (cartridge) configuration. Use one of the tables below, de-
pending upon whether or not a co-processor is used.
Without Co-processor
FFD6H Game Pak (Cartridge) Configuration
OOH ROM Only
01H ROM + RAM
02H ROM + RAM + Battery
With Co-processor
FFD6H
Game Pak (Cartridge) Configuration
Upper Lower
H*0 Co-processor = DSP
1*H Co-processor = Super FX
2*H Co-processor = OBC1
3*H Co-processor = SA-1
H*3 Co-processor = Other
H* Co-processor = Custom Chip
*3H ROM + Co-processor
*4H ROM + Co-processor + RAM
*5H ROM + Co-processor + RAM + Battery
*6H ROM + Co-processor + Battery
For example;
If a game pak uses the Super FX as its co-processor and contains a 256K Ex-
pansion RAM as game pak RAM for battery backup, store 15H at address
FFD6H. In this case 05H would be stored at address FFBDH and 00H would
be stored at address FFD8H.
If a game pak uses a DSP as its co-processor and no RAM, store O3H at ad-
dress FFD6H. In this case OOH would be stored at addresses FFBDH and
FFD8H.
1-2-18
```

<!-- book1 p037 -->

```
SNESDEVELOPMENTMANUAL
If a game pak uses the SA-1 as its co-processor with 64K SRAM and battery,
store 35H at address FFD6H. In this case, 00H would be stored at address
FFBDH and 03H at address FFD8H.
10. ROM Size (FFD7H)
The program ROM size is stored at this address. Select the appropriate code from
the tablebelow.
FFD7H ROM Size
09H 3 ~ 4M Bit
OAH 5 ~ 8M Bit
OBH 9 ~ 16 M Bit
OCH 17~ 32M Bit
ODH 33~64MBit
11. RAM Size (FFD8H)
The CPU RAM size is stored at this address. Select the appropriate code from the
  o s     i  s     is
FFD8H. If only expansion RAM (game pak RAM) is installed, such as the one
BW-RAM size for an SA-1 game pak should be stored at this address.
FFD8H RAM Size
OOH No RAM
01H 16K Bit
03H 64K Bit
05H 256K Bit
06H 512K Bit
07H 1M Bit
For example;
tery backup, store O3H at address FFD8H. In this case 00H is stored at ad-
dress FFBDH and 02H is stored at address FFD6H.
1-2-19
```

<!-- book1 p038 -->

```
SUPERNESSOFTWARESUBMISSIONREQUIREMENTS
If a game pak uses the Super FX as its co-processor and contains a 256K Ex-
s
FFD8H. In this case 05H is stored at address FFBDH and 15H is stored at ad-
dress FFD6H.
12. DestinationCode(FFD9H)
Store the code, from the table below, which best describes where the product wil
be sold.
Destination RoM RecognitionCode
FFD9H
(Language) (Fourth digit of Game Code)
HOO Japan J
01H North America E
(USA and Canada)
02H All of Europe P
03H Scandinavia W
06H Europe (French only) F
HL0 Dutch H
H80 Spanish S
H60 German D
OAH Italian 1
OBH Chinese C
ODH Korean K
OEH Common A
OFH Canada N
10H Brazil B
Nintendo G
Gateway
System
11H Australia n
12H Other Variation
X
13H Other Variation Y
14H Other Variation Z
1-2-20
```

<!-- book1 p039 -->

```
SNESDEVELOPMENTMANUAL
13. Fixed Value (FFDAH)
Store fixed value 33H at address FFDAH.
14. Mask ROM Version (FFDBH)
Store the version number of the mask ROM released to the market as a product.
The number begins with 0 at production and increases with each revised version.
15. Complement Check (FFDCH, FFDDH)
Store the 1's complement of the lower 2 bytes of the program check sum in the or-
der of; FFDCH, lower and FFDDH, upper. Refer to "Check Sum", below, for calcu-
lation of the check sum.
(FFDEH. FFDFH) + (FFDCH. FFDDH) = FFFFH
Check Sum Complement Check
16. Check Sum (FFDEH, FFDFH)
First, store OFFH into the complement check area (FFDCH, FFDDH) and OoH into
the check sum area (FFDEH, FFDFH). Then add each byte in the ROM data. If
ROM size cannot be expressed evenly in 2nM bit, such as 10M or 20M bit, add
the remainder until a total of 2"M bit is reached.
For example, If the program contains 12M bit, perform the calculation as if it were
16M bit as shown below.
Remainder
First 8M bit (23M bit) )|Last 4M bit
Treatas 2-4Mbit
12M bit
16M bit (24M bit)
(Total of first 8M bit) + [(Total of last 4M bit) x2] = Check Sum
For 1oM bit, perfrom the calculation as if it were 16M bit.
(Total of first 8M bit) + [(Total of last 2M bit) x4] = Check Sum
For 20M bit, perform the calculation as if it were 32M bit.
(Total of first 16M bit) + [(Total of last 4M bit) x4] = Check Sum
For 24M bit, perform the calculation as if it were 32M bit.
(Total of first 16M bit) + [(Total of last 8M bit) x2] = Check Sum
Next, store the lower 2 bytes of the check sum value into the check sum area (FF-
DEH, FFDFH). FFDEH will contain the lower byte and FFDFH will contain the up-
per byte.
 h s  o    s  sl  as 
FFDDH.
1-2-21
```

<!-- book1 p040 -->

```
SUPERNESSOFTWARESUBMISSIONREQUIREMENTS
Data Storage on Floppy Disk
1. Use 3.5" DSHD or HD diskettes in MS-DOS IBM format.
2. File data must be in ROM image binary format and not compressed. The maxi-
mum data size on a disk is 8M bit. If the program being submitted is larger than
disk must be written to use the full 8M bit.
3. The file name for the disk is determined as follows;
XXXX XX -X . SFC
工
Disk Number
ROMVersion
Game Code (4 digits of Product Code)
for example,"AAAJ01-0.SFC".
4. A seal must be affixed to each disk to specify company name, game title, game
code,ROM version, date, and disk number.
5. For SA-1 games, don't split data by even and odd addresses.
1-2-22
```

<!-- book1 p041 -->

```
SNESDEVELOPMENTMANUAL
Super NES Cartridge PCB List
Production PCB List*1
roduction PCB ROM RAM Other
22536 SHVC-1A0N 1M/2M/4M/8M None
22537 SHVC-1A1B 1M/2M/4M/8M 16K Batt.
22538 SHVC-1A3B 1M/2M/4M/8M 64K Batt.
22539 SHVC-1A5B 1M/2M/4M/8M 256K
Batt.
22540 SHVC-1B0N 1M/2M/4M/8M None
DSP1
24468 SHVC-1B5B 1M/2M/4M/8M 256K DSP1, Batt
Evaluation PCB List*2
Evaluation PCB ROM RAM
Battery&
22427 SHVC-2P3B 1M/2M/4M/8M None/64K
64K SRAM
21945 SHVC-1P0N 1M/2M/4M
None
24470 SHVC-2Q5B 1M/2M/4M/8M None/64K/256K
Battery*4,5
None/16K/64K/
25474 SHVC-4PV5B 4M/8M/12M/16M
Battery*5
256K
Battery&
33366 SHVC- C-4PV7B 4M/8M/12M/16M/24M*7 None/512K/1M
1MSRAM
4M ~32M or None/16K/64K/
28626 SHVC-8PV5B
4M ~ 64M Battery*5
256K
26011 SHVC-2QW5B 4M/8M/12M/16M
None/64K/256K Battery*4,5
Battery&
28625 SHVC-1RA3B6S 4M or8M 64K or 512K*6
GSU1
28760 SHVC-4QW5B 1M~32M
None/64K/256K Battery*4.5
Battery &
22410*3 SHVC-Multi Checker 1M/2M/4M/8M/16M
None/256K/1M
256K SRAM
Battery&
32321 SHVC-8X7B 4M ~32M None/512K/1M
1M SRAM
Notes:
1) Mask-ROM should be used on a Production PCB. Production PCBs listed
above are bare boards.
2) EP-ROM should be used on an Evaluation PCB. Evaluation PCBs listed
above are assemblies.
3) SHVC Multi Checker must only be used with SHVC (Japanese Super NES) in
order to evaluate SNS software.
4) DsP1 must be purchased separately.
5) Static RAM(S-RAM) must be purchased separately.
7) 24M requires change of PLD.
1-2-23
```

<!-- book1 p042 -->

```
SUPERNESSOFTWARESUBMISSIONREQUIREMENTS
21.3 GAME PAK PCB MEMORY MAPPING
at(206) 861-2715.
1-2-24
```

<!-- book1 p043 -->

```
SNESDEVELOPMENTMANUAL
Usable RAM 64K
ADDRESS
BANK FFFF
8000 0000
Mode 20 (4M x 2 pcs) ROM Size 1M ~ 8M
ROM Image ROM image
at 70:0000H~70:1FFFH
o 2 tmage ROM 2 Image
RAM (64Kbit)
Usable EPROMs 1/2/4M
R A M Image AM Image
ROM
Image Image
ROM 2
Mapping
Figure 2-21-1 SHVC-2P3B PCBMEMORYMAP
ROM ROM
image
PCB Configuration  Image Image
ROM2 Image
ROM 2
R Image RAM Image
1-2-25
```

<!-- book1 p044 -->

```
SUPERNESSOFTWARESUBMISSIONREQUIREMENTS
800 H0008 6000H H0008 H0009
30 30
RAMArea
Enlarged
1FFFH 07FFH H0000
33 The shaded area indicates RAM area.Dottedarea isRAM image.
Enlarged RAM Area (16K) (64K) (256K)
16K
64K 3C
Bank 70~77 256K-
3F 3F 3F
Usable RAM None/16K/64K/256K Usable RAM None/16K/64K/256K
ADDRESS ADDRESS
BANK BANK
8000 0000 8000 0009 0000
FFFF
00 ROM1 -ma9e
ROM2 maqe
Mode 20 (4M x 4 pcs), Mode 21 (4M x 4 pcs)
100F
ROM3 maoe
ROM4 e
RAM
ROM Size 4/8/12/16M(8/16/24M*1) ROM Size 4/8/12/16M(8/16/24M*1)
37
ROM1 mage
ROM2 一 mage
ROM3 mage
ROM4 Image
Usable EPROMs 4M/8M*1 Usable EPROMs 4M/8M*1
7
7D 7D
ROM１-mage
ROM Image
8F OM２ｍe
06 ROM3 Eage
SHVC-4PV5B PCB MEMORY MAP
ROM 2
OM4 E
Mapping 20 or 21 Mapping 20 or 21
ROM ImageImageImage
3
RAM
FOM B7
Thismemorymapisusedwithfour4MbitEPROMs.
ROM
2
PCB Configuration PCB Configuration
Figure 2-21-2 FO24
Image
F7
1-2-26
```

<!-- book1 p045 -->

```
SNESDEVELOPMENTMANUAL
H8889 8000H 6000H H0008 H0009
30 30 30
RAMArea
7FFFH 1FFFH 07FFH HO000
 The image of bank 70 is generated 33 area.Dotted area is RAM image.
The shaded areaindicates RAM
Enlarged RAM Area (91) (64K) (256K)
16K in bank 71~7D andF0~FF.
64K
Bank 70~7D 256K- 3C
Usable RAM None/16K/64K/256K 3F 38
Usable RAM None/16K/64K/256K
ADDRESS ADDRESS
BANK BANK
FFFF 8000 0000 FFFF 8000 0009 0000
00 ROM1 mae
ROM2-ma9e
(sod g x Wt) iz apow (sod 8 x Wt) 0z apoW
100F
ROM3 mage
ROM4 一
201F
ROM5magé
ROM6 Eage
ROM Size 4/8/12/16/20/24/28/32M ROM Size
4/8/12/16/20/24/28/32M
HOM7
ROM8 E ge
ROM1 E age
ROM2 一 E age
ROM3 E age
807F706F605F504F403F302F
ROM4 E age
O M5 E age
6 age
Usable EPROMs 4M/8M Usable EPROMs
4M/8M
ROMN age
RO M8 age
ROM1 mage
ROM Image
8F FOM2 mage
06 ROM3-mage
ROM 2 Image
ROM4 mage
Mapping 20 or21 Mapping A09F
20 or 21
ROMmａｇe
ROM 3 Image
Figure 2-21-3 SHVC-8PV5B PCB MEMORY MAP
AF ROM61
BO ROM7
ROM 寸 Image
RAM
ROM mage
COBF Thismemorymapisusedwitheight4MbitEPROMs.
ROM5
PCB Configuration PCB Configuration
ROM 6
wl 6wl a6wi6wl
FFFOEF EODFDOCF
ROM7
ROM 8 Image
1-2-27
```

<!-- book1 p046 -->

```
SUPERNESSOFTWARESUBMISSIONREQUIREMENTS
00 6000H 8000H H0009 H0008 6000H
30 30 30
Enlarged RAMArea
7FFFH 1FFFH 07FFH H0000
33 The shadedarea'indicatesRAM area.Dotted area isRAM image.
Enlarged RAMArea (91) (64K) (256K).
16K +
64K 3C
Bank 70~7D 256K-
3F 3F 3F
Usable RAM None/16K/64K/256K Usable RAM None/16K/64K/256K
ADDRESS ADDD RESS
FFFF 8000 0000 FFFF 0008 6000 0000
ROM1 -mage
(sod  x 8) 1 apon (sod  x w8) 07 apon
ROM2 mage
ROM3lmagé
ROM Size 4/8/12/16/20/24/28/32M ROM Size 4/8/12/16/20/24/28/32M
ROM4 E 
ROM1 E age
ROM2 -mage
·ROM3 Imagei
Usable EPROMs 4M/8M Usable EPROMs 4M/8M
RAM ROM4 一 mage
02
OM1-mae
ROM Image
ROM２-maé
Mapping 20 or 21 Mapping
20 or 21
ROM3-mae
Figure 2-21-4 SHVC-8PV5B PCB MEMORY MAP
ROM 2 Image
ROM4 E RAM
ROM
PCB Configuration ROM 3 Image
PCB Configuration
ROM2
ROM3
ROM Image
FA M Image
1-2-28
```

<!-- book1 p047 -->

```
SNESDEVELOPMENTMANUAL
Auxillary Device DSP
ADDRESS read from andwrite toDSP.
BANK
FFFF 8000 0000
Thestatus imageinaddressCoooH~FFFFH of bank Thedata imageinaddress8000H-BFFFHof bank3F
Usable RAM None/64K/256K
Mode 20 (4M x 1 pcs)
CO0OH H0008
ROM Size 1/2/4/5/6/8M
Enlarged DSP Area
Bank30~3F STAT Us DATA
(BO~BF)
TheROM2areaalwaysstartsfrombank10.1Mbit(00H03H）or2Mbit00H~07H)EPROMisusedforROM1,andROM2isused,ROMandROM2arenotcontinuous.
Usable EPROMs 1M/2M/4M
ROM
Imagetmage
SHVC-2Q5B PCB MEMORY MAP
ROM2
generated in address 0000H-7FFFH
and8000H~FFFFH of bank71~7D
The image of bank 70 is
Mapping 2
and FO~FF.
DSP Image
H0000
64K 64K Enlarged RAM Area
Figure 2-21-5 Bank 70~7D 256K
256K
PCB Configuration
Image
1-2-29
```

<!-- book1 p048 -->

```
SUPERNESSOFTWARESUBMISSIONREQUIREMENTS
Auxillary Device DSP
Note: Use C000H/8000H for a port to
ADDRESS read from and write toDSP.
BANK
FFFF 8000 0000
Thedataimageinaddress8000H~BFFFHofbank3F
The status image in address CoooH-FFFFH of bank
Usable RAM None/16K/64K/256K
3F is generated in bank BF.
is generated in bank BF.
Mode 20 (4M x 2 pcs)
HOOOO H0008
DSP
Enlarged DSP Area
ROM Size 4/8/16M
ＳＴATUS DATA
RAM
[7D
Usable EPROMs 4M/8M
ROM
SHVC-2QW5B PCB MEMORY MAP
Image  Image
ROM2
and8000H~FFFFH of bank71~7D
DSP Image The image of bank 70 is
Mapping 20 or 21
and FO~FF.
H6 1FFFH H0000
DSP Image Enlarged RAM Area
Bank 70~7D 64K 64K
Figure 2-21-6 256K 256K
PCB Configuration
R A M Image
1-2-30
```

<!-- book1 p049 -->

```
SNESDEVELOPMENTMANUAL
Auxillary Device DSP
Note: Use 4000H/0000H for a port to
ADDRESS read from and write toDSP.
BANK
0008 0000
The status image in address4000H~7FFFH of bank The data image in address0000H~3FFFH of bank 60
Usable RAM None/16K/64K/256K
60 is generated in bank EO.
is generated in bank EO.
Mode 20 (8M x 2 pcs)
7FFFH 4000H H0000
Enlarged DSP Area
ROM Size 4/8/16M
ST: AT us DATA
Bank60
DSP (EO)
RAM
7D
Usable EPROMs 4M/8M
SHVC-2QW5BPCBMEMORYMAP
ROM Image
generatedinaddressO0o0H~7FFFH
The image of bank 70 is
ROM2 Image
Mapping 20 or 21
andFO~FF.
1FFFFH 7FFFH 1FFFH
H0000
DSP Image
64K 64K Enlarged RAM Area
Figure 2-21-7 Bank 70~7D
256K 256K
PCB Configuration
R AM Image
1-2-31
```

<!-- book1 p050 -->

```
SUPERNESSOFTWARESUBMISSIONREQUIREMENTS
Auxillary Device DSP
ADDRESS
The data image in address 6000H~6FFFH of bank 00~0F
BANK
0008 6000 0000
00 Eae
Usable RAM None/16K/64K/256K
appears inbank 80-8F. appears inbank80-8F.
HA M
Mode 21 (4M x 2 pcs)
7FFFH 6FFFH H0009
ROM1丨 mａge
8
ROM Size OＭ２ｌmａｇe
4/8/16M
7000H H0009
Enlarged DSP Area
Bank STATUS (Read Only) DATA (Read/Write)
OF
T7D
Usable EPROMs 4M/8M
HOM2 一
SHVC-2QW5B PCB MEMORY MAP
DSP image
Image
8000H HO009 H0008 H0009 8000H H0009
10002
Mapping 20 or 21
30 30 30
33
The shaded area is the RAM area, while the
Enlarged RAM Area (). ) (256K)
COM 3C
3F 3F 3F
Figure 2-21-8
PCB Configuration
1-2-32
```

<!-- book1 p051 -->

```
SNESDEVELOPMENTMANUAL
Auxillary Device DSP
ADDRESS
FFFF 8000 0000
Note: Use Co00H/8000H of bank 3F for a port to
read from andwrite toDsPwhen
the ROM size is 8M or less.
  S   x )  S
Usable RAM None/16K/64K/256K
HOOOO H0008
DSP
Eniarged DSP Area
ROM Size 1/2/4/6/8/12/ 16/24/32M
Bank3F STATUS DATA
Usable EPROMs 1M/2M/4M/8M
ROM
Image
SHVC-4QW5BPCBMEMORYMAP
ROM 2 Image
The image of bank 70 is appears
bank 71~7D and F0~FF.
Mapping 20 or 21
1FFFH 07FFH
000
64K Enlarged RAM Area
Figure 2-21-9 Bank70~7D 256K
PCB Configuration
RAM Image
1-2-33
```

<!-- book1 p052 -->

```
SUPERNESSOFTWARESUBMISSIONREQUIREMENTS
Auxillary Device DSP
ADDRESS
FFFF 8000 0000
Mode 20 (4M x 4 pcs) ROM Size is 12M or Greater
Usable RAM None/16K/64K/256K appears in bank Eo~EF. appears in bank EO~EF.
H0000
09 (EO)
ROM Size 1/2/4/6/8/12/ 16/24/32M
4000H H0000
Bank Eniarged DSP Area
STATUS (Read Only) DATA (Read/Write)
6F
Usable EPROMs 1M/2M/4M/8M
ROM Image
SHVC-4QW5B PCB MEMORY MAP
ROM 2 Image
The image of bank 70 is appears
inaddress0000H-7FFFHof
ROM 3 Image bank 71~7D and F0~FF.
Mapping  20 or 21
1mage
ROM 4
17FFFH 1FFFH 07FFH
16K0000H
64K Enlarged RAM Area
Figure 2-21-10 Bank 70~7D
256K
PCB Configuration
DSP
Image Image
RAM
1-2-34
```

<!-- book1 p053 -->

```
SNESDEVELOPMENTMANUAL
Auxillary Device DSP
ADDRESS
BANK The status image in address 7000H-7FFFH of bank 00~0F
The data image in address 6000H~6FFFH of bank 00~0F
FFFF 8000 0009 0000
00 ROM1 mage
ROM2 Eα
10OF
ROM3 E isgenerated inbank80~8F. is generated in bank 80-8F.
Usable RAM None/16K/64K/256K
ROM4 —a
Mode 21 (4M x 4 pcs)
6FFFH H0009
ROM1 一 E ａgé
ROM2 E 8
ROM Size 1/2/4/6/8/12/ 16/24/32M
ROM3丨 E ａge
H0004 6000H
ROＭ4ｌmage Enlarged DSP Area
Bank STATUS (Read Only) DATA (Read/Write)
% (8F)
Usable EPROMs 1M/2M/4M/8M
8 ROM2
SHVC-4QW5B PCB MEMORY MAP
ROM3 一 Ee
/DSP Image
ROM4 Ee
RAM Image
6000H H0008 6000H 8000H H0009
Mapping 20 or 21 30 30 30
ROM1 33
The shaded area is the RAM area,while the
Enlarged RAM Area () (64K) (256K)
ROM2
ROM3 3F3C
3F
ROM4
Figure 2-21-11
PCB Configuration
1-2-35
```

<!-- book1 p054 -->

```
SUPERNESSOFTWARESUBMISSIONREQUIREMENTS
COMMENT FIELD w/back-up
4M~32M 23/SA-1 ?
REMARKS 64K SRAM Installed  25 Units per Kit Up to 24M by changing PLD  25 Units per Kit Up to 24M by changing PLD 1M SRAMInstalled 256K SRAM Installed 1MSRAMInstalled
1M~32M
20/DSP20/21/DSP|20/21/DSP
4/8/16M ?
1M~8M ?
8M~64M 20/21/25 EPROM USED* Same as above Same as above
27C1001/27C2001/27C4001 27C4001/27C8001 27C4001/27C8001 27C4001/27C8001 27C1001/27C2001/27C4001 27C4001/27C8001 27C1001/27C2001/27C4001/27C8001 27C1001/27C2001/27C4001/27C8001 27C4001 27C8001
Super NES EPROM Selection Tables
20/21
20/21 ?
4M~16M4M~16M|1M~32M|4M~32M
*Note: Use EPROM listed above or one with the same pin locations.
20/21 ?
20/21 ?
SHVC Multi-Checker 2021 SHVC-8PV5B.ASSY-64M
Cartridge Evaluation Kit Cartridge Evaluation Kit
PCB ASSY SHVC-2QW5B ASSY SHVC-4QW5BASSY
SHVC-4PV5B ASSY SHVC-4PV7B ASSY SHVC-8PV5BASSY SHVC-2Q5BASSY SHVC-8X7B.ASSY
1M~8M 20 SHVC-2P3B ASSY
(SHVC-4PV5B)
(SHVC-2P3B)
None/64K
None/16/ 64/256K 512K/1M
None/
? ③ ? ? ⑧ ?
ROM SIZE MODE(S)
STATIC
RAM SIZE
1-2-36
```

<!-- book1 p055 -->

```
SNESDEVELOPMENTMANUAL
specification specification
32M 32M A 4
4 4 4 4 4
24M
O 4 4 4 20M 4 △
」16M」20M|24M
o O
16M 4
? o △ 4 o
12M  : No pian for development at this time. If necessary, please submit “Price Quote Request for Super NES
SHVC Cartridge List (20 Map, Production Type)
o o 4 4 4
10M
4M|8M|10M」12M
o O
8M o
o o o 4M
O 4
2M丨
2M1
o
Department of NOA.
16K 64K 1M
No SRAM 256K 512K No SRAM 16K 64K 256K Now available.
Department.
ROM size ROM size
[for DSP (77C25)]
SRAM size SRAM size
O
1-2-37
```

<!-- book1 p056 -->

```
SUPERNESSOFTWARESUBMISSIONREQUIREMENTS
specification specification
32M 4 4 4 4
o o 4 4 20M24M32M 4 4 △
o 4 4 4 4 4 4 4 4
o o △ 4 16M A
SHVC Cartridge List (21 Map, Production Type)
o 4 △ 4  : No plan for development at this time. If necessary, please submit “Price Quote Request for Super NES 
12M
Cartridge” to the Licensing Department of NOA five months prior to the release date.
4 o o 4 4 10M 4
O 4 4 4 4
8M
4 4M 4
4 o o 4
2M 2M
o o 4 4
Department of NOA.
16K 1M 16K
64K 64K
No SRAM 256K 512K No SRAM 256K
 : Now available. Department.
ROM size ROM size
SRAM SRAM Size
[for DSP (77C25)]
O
1-2-38
```

<!-- book1 p057 -->

```
SNESDEVELOPMENTMANUAL
THIS PAGE INTENTIONALLY
LEFT BLANK
1-2-39
```

<!-- book1 p058 -->

```
SUPERNESSOFTWARESUBMISSIONREQUIREMENTS
Price Quote Request for Super NES Cartridge
Please send this form to Nintendo of America Inc. Atn.: Juana Tingdale, Licensing Department by Fax at
(206) 861-2173.
Date(M/D/Y) / / Licensee
Release Date(M/D/Y) Game Title
Quantity Contact
Telephone No.
Specification
<Map Mode> 20map/21map/tobedetermined(pleasecircle)
<ROM size> M Bit
<RAM Specification> Bit/withoutRAM
<Backup> Yes / No
<Co-processor> DSP1 /μPD77C25(original program) / other DSP (
OBC1
Super FX
(please circle)
Others: Please specify if you are inquiring other than standard specification.
任天生記人 FOR NCL USE ONLY 業務部
芙课受领者 業務课受领者技術课担当者 部
技術课担当者
没計担当部署
<備考>
设計担当部
ΛUx-V ②予想開免期明 平成 年 月 日 顷
受领署 设计担当 印 筷日 印 部長
※ EPROM基坂の開龚予定等··
1-2-40
```
