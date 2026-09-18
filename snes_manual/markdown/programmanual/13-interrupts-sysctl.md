# Chapter 13 — Interrupts & System Control

> Interrupt vectors + RTI — needed for a correct 65C816 instruction set.

## Contents (per the book's own TOC)

- Interrupts / NMI (p192)
- Processing Interrupts (p197)
- Interrupt Response Time (p200)
- Status Register Control (PLP/SEI/CLI/RTI) (p201)
- No Operation (NOP/STP/WAI) (p202)

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

## Body (pages 192–203)


<!-- programmanual p192 -->

```
The Western Design Center




13) Chapter Thirteen
Interrupts and System Control Instructions

          This is the last chapter that introduces new instructions; almost the entire 65816 instruction set, and all
of the addressing modes, have been presented. The only instructions remaining are the interrupts and status
register control instructions, listed in Table 13.1. This chapter introduces interrupt processing, as well.
          Most of the system control functions described are of practical interest only if you are implementing
systems programs for the 65x processors, such as operating systems or device handling routines. It is quite
possible that if you are programming on an existing machine, with full operating system support, you will have
little cause to use many of the system control instructions.

                                Available on:
  Mnemonic            6502       65C02        65802/816                      Description
      BRK              x           x              x        Break (software interrupt)
      RTI              x           x              x        Return from Interrupt
      NOP              x           x              x        No operation
      SEC              x           x              x        Set carry flag
      CLC              x           x              x        Clear carry flag
      SED              x           x              x        Set decimal mode
      CLD              x           x              x        Clear decimal mode
      SEI              x           x              x        Set interrupt disable flag
      CLI              x           x              x        Clear interrupt disable flag
      CLV              x           x              x        Clear overflow flag
      SEP                                         x        Set status register bits
      REP                                         x        Clear status register bits
      COP                                         x        Co-processor or software
                                                           interrupt
        STP                                       x        Stop the clock
        WAI                                       x        Wait for interrupt
        WDM                                       x        Reserved for expansion


                         Table 13-1. Interrupt and System Control Instructions.


Interrupts

         An interrupt, as the name implies, is a disruption of the normal sequential flow of control, as modified
by the flow-altering statements such as branches and jump instructions encountered in the stream of code.
         Hardware interrupts are generated when an external device causes one of the interrupt pins, usually
the IRQ’ or interrupt request pin, to be electrically pulled low from its normally high signal level. The typical
application of 65x interrupts is the implementation of an interrupt-driven I/O system, where input-output
devices are allowed to operate asynchronously from the processor. This type of system is generally considered
to be superior to the alternative type of I/O management system, where devices are polled at regular intervals to
determine whether or not they are ready to send or receive data; in an interrupt-driven system, I/O service only
claims processor time when an I/O operation is ready for service. Figure 13.1 illustrates how processor time is
spent under either system.




                                                                                                                 192
```

<!-- programmanual p193 -->

```
The Western Design Center

                                                   POLLING

I/O
Service


Polling
Loop


User Task
                                  A                              TIME                     B


                                            INTERRUPT-DRIVEN


I/O
Service




User
Task
                                  A                     TIME                      B

                                         I/O Requested at Times A and B


                               Figure 13-1 I/O Management: Interrupts vs. Polling


         Software interrupts are special instructions that trigger the same type of system behavior as occurs
during a hardware interrupt.
         When an interrupt signal is received, the processor loads the program counter with the address stored in
one of the sixteen-bit interrupt vectors in page $FF of bank zero memory, jumping to the (bank zero) routine
whose address is stored there. (In the case of the 6502, 65C02, and 65802, “bank zero” refers to the lone 64K
bank memory addressable by these processors.) The routine that it finds there must determine the nature of the
interrupt and handle it accordingly.
         When an interrupt is first received, the processor finishes the currently executing instruction and pushes
the double-byte program counter (which now points to the instruction following the one being executed when
the interrupt was received) and the status flag byte onto the stack. Since the 6502 and 65C02 have only a
sixteen-bit program counter, only a sixteen-bit program counter address is pushed onto the stack; naturally, this
is the way the 65802 and 65816 behave when in emulation mode as well. The native-mode 65802 and 65816
must (and do) also push the program counter bank register, since it is changed to zero when control is
transferred through the bank zero interrupt vectors.
         As Figure 13.2 shows, in native mode the program bank is pushed onto the stack first, before the
program counter and the status register: but emulation mode it is lost. This means that if a 65816 program is
running in emulation mode in a bank other than zero when an interrupt occurs, there will be no way of knowing
where to return to after the interrupt is processed because the original bank will have been lost.

                                                                                                               193
```

<!-- programmanual p194 -->

```
The Western Design Center

         This unavoidable but fairly esoteric problem can be dealt with in two ways. The first is simply never
run in emulation mode outside bank zero. The second solution, which is to store the value of the program
counter bank register in a known location before entering the emulation mode with a non-zero program counter
bank register, is described later in this chapter.
         In addition to pushing the status and program counter information onto the stack, the d decimal flag in
the status register is cleared (except on the 6502), returning arithmetic to binary mode. The i interrupt disable
flag is set, preventing further interrupts until your interrupt-service routine resets it (it may do this as soon as it
is finished saving the previous context) or the routine is exited (with an RTI return-from-interrupt instruction).
Indeed, if the interrupt flag had already been set, the first interrupt would have been ignored as well.
         This last feature of disabling interrupts, however, does not apply to a second type of hardware interrupt,
called the non-maskable interrupt (or NMI’) for the very reason that it cannot be ignored, even if the i flag is
set. NMI’ is triggered by a separate pin on a 65x processor; its use is usually reserved for a single high priority
interrupt, such as power failure detection.

                                          6502/65C02/Emulation Mode

                                                    Stack
                                 before
                                                  PC High
                                                                                       Program    Counter (PC)
           Stack   Pointer (S)                     PC Low
                                                  Status (P)
                                 after
                                                                                Status (P)

                                                    Bank 0




                                               65802/65816 Native Mode

                                                    Stack
                                 before
                                             Program Bank (PBR)              Program Bank (PBR)
                                                   PC High
                                                                                         Program    Counter (PC)
           Stack   Pointer (S)                     PC Low
                                                  Status (P)                      Status (P)
                                 after

                                                    Bank 0


                                          Figure 13-2 Interrupt Processing


        Just as the two types of interrupt have their own signals and pins, they also have their own vectors –
locations where the address of the interrupt-handling routine is stored. As Table 13.2 shows, on the 65802 and
65816 there are two sets of interrupt vectors: one set for when the processor is in emulation mode, and one set
for when the processor is in native mode. Needless to say, the locations of the emulation mode vectors are
identical to the locations of the 6502 and 65C02 vectors.




                                                                                                                   194
```

<!-- programmanual p195 -->

```
The Western Design Center

                          Emulation mode, e = 1                             Native mode, e = 0
                00FFFE,FF - IRQ/BRK                                  00FFEE,EF         -      IRQ
                00FFFC,FD - RESET                                                      -
                00FFFA,FB - NMI                                      00FFEA,EB         -      NMI
                00FFF8,F9 - ABORT                                    00FFE8,E9         -      ABORT
                                                                     00FFE6,E7         -      BRK
                00FFF4,F5 - COP                                      00FFE4,E5         -      COP


                                                 Table 13-2 Interrupt Vectors


          As you can see in Table 13.2, there are several other vector locations named in addition to IRQ’ and
NMI’. Note that there is no native mode RESET’ vector: RESET’ always forces the processor to emulation
mode. Also note that the IRQ’ vector among the 6502 vectors is listed as IRQ’/BRK, while in the
65802/65816 native mode list, each has a separate vector.
          The BRK and COP vectors are for handling software interrupts. A software interrupt is an
instruction that imitates the behavior of a hardware interrupt by stacking the program counter and the status
register, and then branching through a vector location. On the 6502 and 65C02, the location jumped to in
response to the execution of a BRK (a software interrupt) and the location to which control is transferred after
an IRQ’ (a hardware interrupt) is the same; the interrupt routine itself must determine the source of the interrupt
(that is, either software or hardware) by checking the value of bit five of the processor status register pushed
onto the stack. On the 6502 and 65C02 (and the 6502 emulation mode of the 65802 and 65816), bit five is the b
break flag. Note first that this is not true of the 65816 native mode, since bit five of its status register is the m
memory select flag. Secondly, notice that it is the stacked status byte which must be checked, not the current
status byte.
          Suppose, for example, that the IRQ’/BRK vector at $00:FFFE.FF contains the address $B100
(naturally, in the low-high order all 65x addresses are stored in), and the code in Fragment 13.1 is stored starting
at $B100. When a BRK instruction is executed, this routine distinguishes it from a hardware interrupt and
handles each uniquely.

  0000                                   ORG          $B100
  0000
  0000                IRQBRKIN           START
  0000    8D1000                         STA          SAVEA            save original accumulator
  0003    68                             PLA                           copy p register
  0004    48                             PHA                           return it to stack
  0005    2920                           AND          #%00010000       look at bit four only
  0007    D0F7                           BNE          ISBRK            bra if bit 4 set:
  0009                ;                                                     BRK caused interrupt
  0009                                   .                             else caused by IRQ”
  0009                                   .
  0009                                   .
  0009                                   .
  0009    4C0C00                         JMP          RETURN           reload accum and return
  000C
  000C                ; handle interrupt caused by BRK instruction
  000C
  000C                ISBRK            .                               do BRK handling code
  000C                                 .
  000C                                 .
  000C    AD1000      RETURN           LDA            SAVEA            reload saved accumulator
  000F    40                           RTI                             return
  0010
  0010    00          SAVEA            DS             1
  0011
  0011                                 END


                                                          Fragment 13.1




                                                                                                                 195
```

<!-- programmanual p196 -->

```
The Western Design Center

          The RTI, or return-from-interrupt instruction is similar to the RTS (return-from-subroutine) instruction. RTI
returns control to the location following the instruction that was interrupted by pulling the return address off the stack.
Unlike the RTS instruction, however, since the status register was also pushed onto the stack in response to the interrupt, it
too is restored, returning the system to its prior state. Further, in the 65802/65816 native mode the RTI instruction behaves
like an RTL (return from subroutine long), in that the program counter bank register is also pulled off the stack. This
difference makes it critical that the processor always be in the same state when the RTI instruction is executed as it was
when it was interrupted. The fact that the 65816 has separate vector groups for native and emulation modes makes this
easier to achieve.
          There is another key difference between the RTI and the RTS or RTL: RTS and RTL increment the
return address after pulling it off the stack and before loading it into the program counter; RTI on the other
hand loads the program counter with the stack return address unchanged.
          RTI will probably not function correctly in the special case where an interrupt occurred while code was
executing in the emulation mode in a non-zero bank: RTI will try to return control to an address within the bank
the RTI is executed in, which will probably not be the correct bank because (as on the 6502 and 65C02) the
bank address is not stacked. As mentioned earlier, the only way to deal with this is to save the bank address
prior to entering emulation mode. When the interrupt handler returns, it should use this saved bank address to
execute a long jump to an RTI instruction stored somewhere within the return bank, the long jump will present
the program bank address to the correct value before the RTI is executed.
          The interrupt handler itself should enter the native mode if interrupts are to be reenabled before exiting
in order to avoid the same problem, the return to emulation mode before exiting via the long jump to the RTI
instruction.
          Concerning the BRK instruction, you should also note that although its second byte is basically a “don’t
care” byte – that is, it can have any value - the BRK (and COP instruction as well) is a two-byte instruction, the
second byte sometimes is used as a signature byte to determine the nature of the BRK being executed. When
an RTI instruction is executed, control always returns to the second byte past the BRK opcode. Figure 13.3
illustrates a stream of instructions in hexadecimal form, the BRK instruction, its signature byte, and location an
RTI returns to. The BRK instruction has been inserted in the middle; after the BRK is processed by a routine
(such as the skeleton of a routine described above), control will return to the BCC instruction, which is the
second byte past the BRK opcode.
          The fact that the opcode for the BRK instruction is 00 is directly related to one of its uses: patching
existing programs. Patching is the process of inserting instruction data in the middle of an existing program in
memory to modify (usually to correct) the program without reassembling it. This is a favored method of some
programmers in debugging and testing assembly language programs, and is quite simple if you have a good
machine-level monitor program that allows easy examination and modification of memory locations. However,
if the program to be patched is stored in PROM (programmable read-only memory), the only way to modify a
program that has already been “burned-in” is to change any remaining one bits to zeros. Once a PROM bit has
been “blown” to zero, it cannot be restored to a one. The only way to modify the flow of control is to insert
BRK instructions – all zeroes – at the patch location and to have the BRK handling routine take control from
there.




                                                                                                                          196
```

<!-- programmanual p197 -->

```
The Western Design Center

                  LDA $44


             A5              44

                                  00              00              90               32




                         BRK instruction
                                                                            BCC instruction
                                              optional
                                            ‘signature byte’


                                                          control resumes here
                                                           after RTI executed

                                   Figure 13-3Break Signature Byte Illustration


Processing Interrupts

         Before an interrupt handling routine can perform a useful task, it must first know what is expected of it.
The example of distinguishing a BRK from an IRQ is just a special case of the general problem of identifying
the source of an interrupt. The fact that different vectors exist for different types of interrupts – for example,
NMI would usually be reserved for some catastrophic type of interrupt, like “power failure imminent”, which
demanded immediate response – solves the problem somewhat. Typically, however, in an interrupt-driven
system there will be multiple sources of interrupts through a single vector. The 65802 and 65816, when in
native mode, eliminate the need for a routine to distinguish between IRQ and BRK, such as the one above, by
providing a separate BRK vector, as indicated in Table 13.2. Although this does simplify interrupt processing
somewhat, it was done primarily to free up bit five in the status register to serve as the native memory select
flag, which determines the size of the accumulator.
         The interrupt source is generally determined by a software technique called polling: when an interrupt
occurs, all of the devices that are known to be possible sources of interrupts are checked for an indication that
they were the source of the interrupt. (I/O devices typically have a status bit for this purpose.) A hardware
solution also exists, which is to externally modify the value that is apparently contained in the vector location
depending on he source of interrupt. The 65816 aids the implementation of such systems by providing a
VECTOR PULL signal, which is asserted whenever the interrupt vector memory locations are being accessed
in response to an interrupt.
         A simple example of the polling method could be found in a system that includes the 6522 Versatile
Interface Adapter as one of its I/O controllers. The 6522 is a peripheral control IC designed for hardware
compatibility with the 65x processor family. The 6522 includes two parallel I/O ports and two timer/counters.
It can be programmed to generate interrupts in response to events such as hardware handshaking signals,
indicating that data has been read or written to its I/O ports, or to respond to one of its countdown timers
reaching zero. The 6522 contains sixteen different control and I/O registers, each of which is typically mapped
to an adjacent address in the 65x memory space. When an interrupt occurs, the processor must poll the
interrupt flag register, shown in Figure 13.4, to determine the cause of the interrupt.




                                                                                                               197
```

<!-- programmanual p198 -->

```
The Western Design Center

  7     6     5     4     3      2     1     0
                                                                  SET BY             CLEARED BY
                                                             CA2 active edge      Read or write
                                                  CA2
                                                                                  Reg. 1 (ORA)
                                                             CA1 active edge      Read or write
                                            CA1
                                                                                  Reg. 1 (ORA)
                                                             Complete 8 shifts    Read or write
                                      SHIFT REG
                                                                                  Shift Reg.
                                CB2                          CB2 active edge      Read or write ORB
                         CB1                                 CB1 active edge      Read or write ORB
                                                             Time-out of T2       Read T2 low or write
                   TIMER2
                                                                                  T2 high
                                                             Time-out of T-1      Read T1 low or write
             TIMER1
                                                                                  T1 high
                                                             Any enabled          Clear all interrupts
       IRQ
                                                             interrupt


                                 Figure 13-4 6522 VIA Interrupt Flag Register


        If register zero of the 6522 is mapped to location $FF:B080 of a 65816 system, for example, the
interrupt flag register would normally be found at $FF:B08D. The polling routine in Fragment 13.2 would be
needed whenever an interrupt occurred. To keep the example simple, assume that only the two timer interrupts
are enabled (for example, timer 1 to indicate, in a multi-tasking system, that a given process’ time-slice has
expired and the next process must be activated; timer 2, on the other hand, to maintain a time-of-day clock).




                                                                                                          198
```

<!-- programmanual p199 -->

```
The Western Design Center

     0000                     IRQIN          START
     0000     E220                           SEP              #$20          8-bit accumulator
     0002                                    LONGA            OFF
     0002
     0002     8D1B00                         STA              SAVEA         save the accumulator
     0005     AF8DB0FF                       LDA              $FFB08D       device interrupt register
     0009     10F5                           BPL              NEXTDEV       branch if bit 7 clear
     000B     0A                             ASL              A             check bits 6 & 5
     000C     0A                             ASL              A             bit 6 to carry, 5 to sign
     000D     30F1                           BMI              TIMER2        if 5 set, timer2 caused
     000F                     ;                                                  interrupt
     000F
     000F                     ; timer2 didn’t cause interrupt; timer1?
     000F
     000F     90EF                           BCC              ERROR         interrupt source unknown
     0011
     0011                     ; bit 6 set: timer1 caused interrupt
     0011
     0011                     TIMER1         .                              timer 1 handler code
     0011                                    .
     0011                                    .
     0011
     0011     8004                           BRA              RETURN
     0013
     0013                     ; bit 5 set: timer2 caused interrupt
     0013
     0013                     TIMER2         .                             timer 2 handler code
     0013                                    .
     0013                                    .
     0013     8002                           BRA              RETURN
     0015
     0015                     ; interrupt not caused by 6522: check other devices
     0015
     0015                     NEXTDEV        .                             code to poll next devices
     0015                                    .
     0015                                    .
     0015     8000                           BRA              RETURN
     0017
     0017                     ERROR          .                             error handling code
     0017                                    .
     0017                                    .
     0017
     0017     AD1B00          RETURN         LDA              SAVEA        reload saved accumulator
     001A     40                             RTI                           and return
     001B
     001B     00              SAVEA          DS               1
     001C                                    END

                                                       Fragment 13.2

         When the interrupt flag register is loaded into the accumulator, the first thing to check is whether or not
bit seven is set; bit seven is set if any 6522 interrupt is enabled. If it is clear, then the interrupt handler branches
to the location NEXTDEV, which polls all other connected I/O devices looking for the interrupt.
         If the 6522 was the source of the interrupt, then two shifts move the flag register’s bit six into the carry
and bit five into bit seven of the accumulator. Since bit five is set by the time-out of timer 2, if the high-order
bit of the accumulator is set (minus), then the source of the interrupt must be timer 2. If timer 2 did not cause
the interrupt, then the carry flag is checked; if it’s set, then timer 1 caused the interrupt; if it’s clear, then timer 1
didn’t cause it either, so there has been some kind of error.

                                                                                                                      199
```

<!-- programmanual p200 -->

```
The Western Design Center
          Control is thus assigned to the correct routine to handle the specific source of interrupt.
          It is important to note that in both examples in this chapter, the accumulator was saved in memory prior
to its use within the interrupt-handling routine. You should further note that in the second example, which is
specific to the 65816, only the low-order byte of the accumulator was stored, because the STA SAVEA
instruction was executed after the SEP #$20 instruction, which set the accumulator size to eight bits. When the
RTI instruction is executed at the end of the interrupt service routine, the m status flag will be restored to
whatever value it had prior to the interrupt. If m was clear and the accumulator was in sixteen-bit mode, the
high-order byte will have been preserved throughout the interrupt routine provided that none of the interrupt
handling routines switch into sixteen-bit mode; if they do, the high-order part of the accumulator must be saved
first, then restored before execution of the RTI.
          An important concept related to interrupt handling is that of reentrancy; a reentrant program can be
interrupted and literally reentered by the interrupt handling routine and return correct values for both the
original invocation and the reentrant call from the interrupt handler. Reentrancy is normally achieved by using
no addressable memory – only registers, which may be saved and restored on the stack each time the routine is
entered. The stack relative addressing modes simplify the writing of reentrant routines considerably.

Interrupt Response Time

         By saving only the essentials – the program counter, program counter bank in 65802/65816 native
mode, and status register – and shifting the burden of saving and restoring user registers (those that are actually
used) to the programmer of the interrupt-handler, the 65x processors provide maximum flexibility and
efficiency. It is quite possible for an interrupt routine to do useful work – such as checking the status of
something within the system at periodic intervals – without using any registers.
         At either seven or eight cycles per interrupt – the time required to stack the program counter, pc bank,
and status register, and then jump through the interrupt vectors – the interrupt response cycle is among the
longest-executing 65x instructions. Since an interrupt always lets the current instruction complete execution,
there is a possible seven-cycle delay between the receipt of an interrupt and the servicing of one; this delay is
called the interrupt latency. Small as the delay is, it can be significant in the servicing of data acquisition and
control devices operating in real time, systems in which it is important that interrupts be disabled as little as
possible.
         It has been the goal of the designers of the 65x series to keep interrupt latency to a minimum. To
further reduce interrupt latency, the 65802 and 65816 introduced a special new instruction, the WAI or wait for
interrupt instruction. In an environment where the processor can be dedicated to serving interrupts – that is,
where the interrupts provide timing or synchronization information, rather than being used to allow
asynchronous I/O operations to be performed – the processor can be put into a special state where it sits and
waits for an interrupt to happen. This lets any of the user registers be saved before the interrupt occurs, and
eliminates the latency required to complete an existing instruction. Upon execution of a WAI instruction, the
processor goes into a very low-power state, signals the outside world that it is waiting by pulling the bi-
directional RDY signal low, and sits idle until an interrupt is received. When that occurs, response is immediate
since no cycles are wasted completing an executing instruction.
         There are two responses to an interrupt after the WAI instruction is executed. The first, as you might
expect, is to release the waiting condition and transfer control to the appropriate interrupt vector, as normally
takes place whenever interrupts are serviced. The second response is if maskable interrupts (on the IRQ’ line)
have been disabled, in which case the normal interrupt processing does not occur. However, since the waiting
condition is released, execution continues with the instruction following the WAI opcode. This means that
specialized interrupt-synchronization routines can be coded with a one-cycle latency between receipt of
interrupt and response.
         A second, similar 65802/65816 instruction is the STP or stop the clock instruction. The STP
instruction reduces on-chip power consumption to a very low level by stopping the phase two clock input.
Since power consumption of CMOS circuits increases with operating frequency, by halting the clock input the
STP instruction is able to reduce the power consumption of the 65816 to its lowest possible value. Like the
WAI instruction, the STP idles the processor after being executed. Further, the processor I/O buffers are
disabled, making the bus available. The processor is powered back up in response to a RESET’ signal being
asserted.


                                                                                                               200
```

<!-- programmanual p201 -->

```
The Western Design Center

          The RESET’ pin is an input similar to the IRQ’ and NMI’ inputs. It is used to perform system
initialization or reinitialization. When a 65x system is first powered up, RESET’ must be asserted by external
power-up circuitry. It can also be used to let the user force the system into a known state, for example, to break
out of an infinite loop.
          When RESET’ is asserted, the processor is forced to emulation mode and the registers and status flags
are initialized as shown in Table 13.3. Note that the initialization of the index register high bytes to zero is
really a function of x being forced to one; x = 1 always clears the high byte of the index registers.

   Stack High                                       01
   Direct Page Register                             0000
   X Register High                                  00
   Y Register High                                  00
   Program Bank Register                            00
   Data Bank Register                               00
   Status Register                                  m = 1, x = 1, d = 0, i = 1
   Emulation Flag                                   1


                                           Table 13-3 Reset Initialization


         In addition to the BRK, IRQ’, RESET’, and NMI’ vectors discussed, there are two remaining
interrupt-like vectors. These are the COP (co-processor) and ABORT’ vectors. The COP vector is essentially
a second software interrupt, similar to BRK, with its own vector. Although it can be used in a manner similar
to BRK, it is intended particularly for use with co-processors, such as floating-point processors. Like BRK, it
is a two-byte instruction with the second available as a signature byte.
         The ABORT’ vector contains the address of the routine which gains control when the 65816 ABORT’
signal is asserted. Prior to transferring control through the ABORT’ vector, the current instruction is completed
but no registers are modified. The pc bank, program counter, and status register are pushed onto the stack in the
same manner as an interrupt. The ABORT’ signal itself is only available on the 65816; although the 65802 has
an ABORT’ vector, it is ineffective since no ABORT’ signal can be generated because of the need for the
65802 to be pin-compatible with the 6502. Typical application of the abort instruction feature is the
implementation of hardware memory-management schemes in more sophisticated 65816 systems. When a
memory-bounds violation of some kind is detected by external logic, the ABORT'’ signal is asserted, letting the
operating system attempt to correct the memory-management anomaly before resuming execution.

Status Register Control Instruction
          There are nine instructions that directly modify the flags of the status register; two of them are available
only on the 65802 and 65816. These last two are the SEP (set the P status register) and REP (reset P)
instructions, which you are already familiar with from their use in the example to set or reset the m and x flags
in the status register. They can be used to set or clear any of the flags in the status register. For each bit in the
immediate byte that follows the opcode, the corresponding bit in the status register is set or cleared (depending
on whether SEP or REP, respectively, was used).
          The other seven flag instructions set or clear individual flags in the status register. The pair SEC and
CLC set and clear the carry flag when executed. These should be familiar to you from the chapter on
arithmetic, where the CLC is always used before the first of a series of ADC instructions, and SEC before the
first of a series of SBC instructions. Likewise, the SED and CLD modes should also be familiar from the same
chapter’s discussion of decimal-mode arithmetic; these two instructions set or clear the decimal mode. Note
that reset can also affect the decimal flag: it is always initialized to zero on reset on the 65C02, 65802, and
65816; on the other hand, its value is indeterminate after reset on the 6502.
          The SEI (set interrupt disable flag) and CLI (clear interrupt disable flag) instructions are new to this
chapter: they are used to enable or disable the processor’s response to interrupt requests via the IRQ’ signal. If
the SEI instruction has been executed, interrupts are disabled; a CLI interrupt instruction may be used to
reenable interrupts. Note that the interrupt disable flag is set automatically in response to an interrupt request,
whether a software interrupt or IRQ’, NMI’, or RESET’; this “locks out” other interrupts from occurring until
                                                                                                                  201
```

<!-- programmanual p202 -->

```
The Western Design Center
the current one has been serviced. Similarly, the interrupt disable flag is cleared automatically upon return from
an interrupt via RTI due to reloading of the stacked status register, which was pushed with i clear.
          The SEI lets interrupts be locked out during critical routines which should not be interrupted. An
example would be a device controller that depended on software timing loops for correct operation; interrupts
must be locked out for the duration of the timing loop. It is important in an environment where interrupts are
supported that they not be locked out for long periods of time. Although the CLI instruction will explicitly
clear the interrupt disable flag, it is rarely used because typically the processor status is saved before execution
of an SEI instruction as in Fragment 13.3, which reclears the flag by restoring the entire processor status
register.

               0000    08                   PHP              save status
               0001    78                   SEI              disable interrupts
               0002                         .
               0002                         .                execute time-critical code
               0002                         .
               0002    28                   PLP              done – restore status, enable interrupts

                                                  Fragment 13.3

Since the interrupt disable flag was clear when the PHP instruction was executed, the PLP instruction restores
the cleared flag. This same technique is also useful when mixing subroutine calls to routine with different
default modes for accumulator and index register sizes; since saving the status with PHP is a common operation
between subroutine calls anyway, the PLP instruction can be used to conveniently restore operating modes as
well as status flags.
         Finally, there is a CLV (clear overflow flag). There is no corresponding set overflow instruction, and,
as you will recall from the chapter on arithmetic, the overflow flag does not need to be explicitly cleared before
a signed operation. The arithmetic operation always change the overflow status to correctly reflect the result.
The reason for including an explicit CLV instruction in the 65x repertoire is that the 6502, 65C02, and 65802
have a SET OVERFLOW input signal; external hardware logic can set the overflow flag of the status register
by pulling the SET OVERFLOW input low. Since there is no corresponding clear overflow input signal, the
overflow must be cleared in software in order to regain susceptibility to the SET OVERFLOW signal.
         The practical application of the SET OVERFLOW signal is generally limited to dedicated control
applications; it is rarely connected on general-purpose, 6502-based computer systems. On the 65816, there is
no SET OVERFLOW input; it was sacrificed to make room for some of the more generally useful new signals
available on the 65816 pin configuration.

No Operation Instructions

         The final two instructions to complete the 65816 instruction set are the no operation instruction. These
do exactly what they sound like: nothing. They are used as place holders, or time-wasters; often they are used
to patch out code during debugging. The NOP instruction – with a hexadecimal value of $EA – is the standard
no operation.
         As mentioned in the earlier architecture chapters, the 6502 and 65C02 have a number of unimplemented
instructions – the same opcodes which, on the 65802 and 65816, correspond to the new instructions. On the
6502, the operation of the processor when these “instructions” are executed is undefined; some of them cause
the processor to “hang-up.” On the 65C02, these are all “well-behaved” no-operations of either one, two, or
more cycles. On the 65802 and 65816, there is only one unimplemented instruction, defined as WDM; this is
reserved for future systems as an escape prefix to expand the instruction set with sixteen-bit opcodes. For this
reason, it should not be used in your current programs, as it will tend to make them incompatible with future
generations of the 65816.




                                                                                                                202
```

<!-- programmanual p203 -->

```
The Western Design Center




                        Part 4
                      Applications




                                     203
```
