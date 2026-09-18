# Appendix D — Data Transfer Procedure

> Includes 65816 'rep' mode-switch snippets (boot loader).

## Contents (per the manual's own TOC)

- Data transfer / Sound Boot Loader V1.1

## Provenance

```
Source: `snes_manual/book1.pdf` (Nintendo Super NES Development Manual, Book I),
scanned 240-page image-only PDF (no text layer). Per-page text below is produced by
RapidOCR (ONNX) at 300 DPI. **Prose is a usable baseline; hex / disassembly / tables
carry OCR noise (dropped inter-word spaces, 0/O, S/s, l/I confusion) and must be
verified against the page image before being treated as fact.** Each page is tagged
with `<!-- book1 pNNN -->` so a specific page can be re-verified and corrected.
```

## Body (pages 237–240)


<!-- book1 p237 -->

```
SNESDEVELOPMENTMANUAL
Appendix D. Data Transfer Procedure
D.1 Data Transfer Procedure
Sound CPU SideDirection SNES CPU Side Procedure
PORTO =OAAh]
Confirm AA, BB (1)
PORT1 = 0BBh
PORT1=NOT 0
PORTO = PT0
PORT3=ADDRESS HIGH
PORTO=OCCh
HI (PTO is data written at PORTO by the Main CPU, [(3)
and it is OcCh in this case.)
Data Transfer Start (4)
PORT1 = DATA
PORTO = 000h
PORTO = PT0
Repeat
PORT1 = DATA
(5)
PORTO = (previous PORTO data) + 1
PORTO=PT0
When sending the next data block
PORT1 = NOT 0
PORT2 = ADDRESS LOW (Data Transfer)
PORT3 = ADDRESS HIGH
PORT0 = (previous PORT0 data) + 2 to 127
(6)
*Total ≠0
PORTO = PTO
Return to Data Transfer Start
After sending the last block
PORT1 = 000
PORT2 = ADDRESS LOW (Program Start Address)
PORT3 = ADDRESS HIGH
PORT0 = (previous PORT0 data) + 2 to 127
(7)
PORT=PTO
Complete Data Transfer
(NCL PG 45)
D-1
```

<!-- book1 p238 -->

```
DATATRANSFERPROCEDURE
D.2 Data Transfer Instruction
The transfer program on the Sound CPU is stored in the internal ROM called IPL
ROM. This ROM functions after reset. The program ROM functions using the
Main CPUandPORT O through 3.
(5) The sound CPU writes AAh to PORT 1. The Main CPU reads and confirms
dataatPORT O and 1.
(6) The Main CPU writes Start Address to PORT 2 and 3. After storing Port 2
and 3, store any number except 0 to PORT 1 and store CCh to PORT 0.
(7) The sound CPU checks PORT O for CCh and writes CCh to PORT 0.
(8) Start data transfer. The Main CPU writes first data to PORT 1 and writes
OOh to PORT 0. The Sound CPU reads data from PORT 1 and writes O0h
to PORT 0.
(9) The Main CPU checks PORT 0, writes next data to PORT 1, and incre-
ments of PORT 0. This is the data transfer procedure. The data block con-
tains the quantity of data to be transferred.
(10) When PORT O stops incrementing, proceed to the next step. The value that
the SNES CPU writes to PORT O must not be OOh. Write any value but O0h
to PORT 1. The Sound CPU writes the same value to PORT 0 and then re-
turns to step (4).
(11) After sending all data blocks using steps (4) through (6), the data transfer is
completed. Program Start Address is stored to PORT 2 and 3, Write 00h to
PORT 1.
(NCL PG 46)
D-2
```

<!-- book1 p239 -->

```
SNESDEVELOPMENTMANUAL
D.3[  Data Block Organization
Data is divided into several blocks having consecutive addresses. The quantity of
data (2 byte) and address (2 byte) are stored in front of data.
Data Block Example:
Data Quantity Transfer Address
dw 000010h.010000h
db 030h,031h,032h,033h,034h,035h,036h,037h :First Data Block
db 038h,039h,03ah,03bh,03ch,03dh,03fh
dw0001h,020000h
db 030h,031h,032h,033h,034h,035h,036h,037h:Last Data Block
db 038h,039h,03ah,03bh,03ch,03dh,03eh,03fh
dw00000h.00800h
Transfer End Code Program Start Address
(NCL PG 47)
D-3
```

<!-- book1 p240 -->

```
DATATRANSFERPROCEDURE
D.4 Sound Boot Loader V1.1
glb Boot_APU
APU_port 0 equ 02140h
APUport 1 nba 02141h
APU_port 2 equ 02142h
APUport equ 02143h
address equ 0000oh InputSoundROMStartAddress
(3 byte) in 0 page and call
code
Boot_APU "Boot_APU" from main routine.
php
rep #00110000b
idx16 ;sony news
mem16 ;sonynews
on16i ;SNES Emulator
on16a ;SNESEmulator
idy #0
ida #0bbaah
boot_initial !APU_PORTO ;m16
cmp
bne boot_initial
sep #00100000b
mem8 ;sonynews
off16a ;SNES Emulator
1da #0cch
bra boot_entry1
boot_repeat 1da [address],y
iny
xba
1da #0
bra boot_entry2
boot_loop xba
1da [address],y
iny
xba
boot_wait1 !APU_PORTO
cmp
bne boot_wait1
inc e
boot_entry2 #00100000b
rep
sta !APUPORTO :m16
sep #00100000b
dex
bne boot_loop
boot_wait2 !APO_PORTO
cmp
bne boot_wait2
boot_zero adc #3
bag boot_zero
boot_entry1
pha >
rep #00100000b
1da [address],y ;m16
iny
iny
tax
1da [address],y ;m16
iny
iny
sta !APU_PORT2 ;m16
sep #00100000b
cpx #1
1da #0
rol a
sta !APU_PORT1
adc #07fh
pla
sta !APU_PORTO
boot_wait3 cmp !APUTPORTO
bne boot_wait3
bvs bootrepeat
plp
rts
end
(NCL PG48)
D-4
```
