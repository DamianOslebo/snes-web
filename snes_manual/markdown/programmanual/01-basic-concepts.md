# Chapter 1 — Basic Assembly Language Concepts

> Grounding / number systems; low assembler relevance but frames the rest.

## Contents (per the book's own TOC)

- Binary Numbers (p12)
- Hexadecimal (p14)
- ASCII (p15)
- Boolean Logic (p16)
- Signed Numbers (p18)
- Computer Arithmetic (p20)
- Machine Language (p20)
- Assembly Language (p22)
- Subroutines (p24)

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

## Body (pages 12–25)


<!-- programmanual p012 -->

```
The Western Design Center


1) Chapter One

Basic Assembly Language Programming Concepts
       This chapter reviews some of the key concepts that must be mastered prior to learning to program a
computer in assembly language. These concepts include the use of the binary and hexadecimal number
systems; boolean logic; how memory is addressed as bytes of data; how characters are represented as ASCII
codes; binary-coded decimal (BCD) number systems, and more. The meaning of these terms is explained in
this chapter. Also discussed is the use of an assembler, which is a program used to write machine-language
programs, and programming techniques like selection, loops, and subroutines.
         Since the primary purpose of this book is to introduce you to programming the 65816 and the other members of
the 65x family, this single chapter can only be a survey of this information rather than a complete guide.

Binary Numbers
       In its normal, everyday work, most of the world uses the decimal, or base ten, number system, and
everyone takes for granted that this system is the “natural” (or even the only) way to express the concept of
numbers. Each place in a decimal number stands for a power of ten: ten to the 0 power is 1, ten to the 1st power
is ten, ten to the 2nd power is 100, and so on. Thus, starting from a whole number’s right-most digit and
working your way left, the first digit is multiplied by the zero power of ten, the second by the first power of ten,
and so on. The right-most digits are called the low-order or least significant digits in a positional notation
system such as this, because they contribute least to the total magnitude of the number; conversely, the leftmost
digits are called the high-order or most significant digits, because they add the most weight to the value of the
number. Such a system is called a positional notation system because the position of a digit within a string of
numbers determines its value.
         Presumably, it was convenient and natural for early humans to count in multiples of ten because they
had ten fingers to count with. But it is rather inconvenient for digital computers to count in decimal; they have
the equivalent of only one finger, since the representation of numbers in a computer is simply the reflection of
electrical charges, which are either on or off in a given circuit. The all or nothing nature of digital circuitry
lends itself to the use of the binary, or base two, system of numbers, with one represented by “on” and zero
represented by “off”. A one or a zero in binary arithmetic is called a binary digit, or a bit for short.
         Like base ten digits, base two digits can be strung together to represent numbers larger than a single
digit can represent, using the same technique of positional notation described for base ten numbers above. In
this case, each binary digit is such a base two number represents a power of two, with a whole number’s right-
most bit representing two to the zero power (ones), the next bit representing two to the first power (twos), the
next representing two to the second power (fours), and so on (Figure 1-1 Binary Representation)




                                                                                                                  12
```

<!-- programmanual p013 -->

```
The Western Design Center

Grouping Bits into Bytes

         As explained, if the value of a binary digit, or bit, is a one, it is stored in a computer’s memory by
switching to an “on” or charged state, in which case the bit is described as being set; if the value of a given bit is
a zero, it is marked in memory by switching to an “off” state, and the bit is said to be reset.
         While memory may be filled with thousands or even millions of bits, a microprocessor must be able to
deal with them in a workable size.

                       128’s Place


                                     64’s Place


                                                  32’s Place


                                                               16’s Place


                                                                            8’s Place


                                                                                        4’s Place


                                                                                                    2’s Place


                                                                                                                1’s Place
                        0            1            1            0            0           1           1           0




                                                                                                                             2

                                                                                                                             4

                                                                                                                            32

                                                                                                                            64
                                                                                                                            102

                                                     Figure 1-1 Binary Representation
         The smallest memory location that can be individually referenced, or addressed, is usually, and always
in the case of the 65x processors, a group of eight bits. This basic eight-bit unit of memory is known as a byte.
Different types of processors can operate on different numbers of bits at any given time, with most
microprocessors handling one, two, or four bytes of memory in a single operation. The 6502 and 65C02
processors can handle only eight bits at a time. The 65816 and 65802 can process either eight or sixteen bits at
a time.
         Memory is organized as adjacent, non-overlapping bytes, each of which has its own specific address.
An address is the unique, sequential identifying number used to reference the byte at a particular location.
Addresses start at zero and continue in ascending numeric order up to the highest addressable location.
         As stated, the 65802 and 65816 can optionally manipulate two adjacent bytes at the same time; a
sixteen-bit data item stored in two contiguous bytes is called a double byte in this book. A more common but
misleading usage is to describe a sixteen-bit value as a word; the term word is more properly used to describe
the number of bits a processor fetches in a single operation, which may be eight, sixteen, thirty-two, or some
other number of bits depending on the type of processor.
         It turns out that bytes – multiples of eight bits – are conveniently sized storage units for programming
microprocessors. For example, a single byte can readily store enough information to uniquely represent all of
the characters in the normal computer character set. An eight-bit binary value can be easily converted to two
hexadecimal (base sixteen) digits; this fact provides a useful intermediate notation between the binary and
decimal number systems. A double byte can represent the entire range of memory addressable by the 6502,
65C02, and 65802, and one complete bank – 64K bytes – on the 65816. Once you’ve adjusted to it, you’ll find
that there is a consistent logic behind the organization of a computer’s memory into eight-bit bytes.
         Since the byte is one of the standard units of a computer system, a good question to ask at this point
would be just how large a decimal number can you store in eight bits? The answer is 255. The largest binary
number you can store in a given number of bits is the number represented by that many one-bits. In the case of
                                                                                                                                  13
```

<!-- programmanual p014 -->

```
The Western Design Center


the byte, this is 11111111, or 255 decimal (or 28 - 1). Larger numbers are formed by storing longer bit-strings
in consecutive bytes.
          The size of a computer’s memory is typically expressed in bytes, which makes sense because the byte is
the smallest addressable unit. And since a byte is required to store the representation of a single alphanumeric
character, you can get an easy visualization of about how much storage 64K of memory is by thinking of that
many characters. The K stands for one thousand (from the Greek kilo meaning thousand, as in kilogram or
kilometer); however, since powers of two are always much more relevant when discussing computer memories,
the symbol K in this context actually stands for 1024 bytes, the nearest power-of-two approximation of 1000, so
64K is 65,536 bytes, 128K is 131,072 bytes, and so on. Within a given byte (or double byte) it is often
necessary to refer to specific bits within the word. Bits are referred to by number. The low-order, or right-most
bit, is called bit zero; this corresponds to the one’s place. The next-higher-order bit is bit one, and so on. The
high-order bit of a byte is therefore bit seven; of a double byte, bit fifteen. The convention of calling the lower-
order bit the “right-most” is consistent with the convention used in decimal positional notation; normal decimal
numbers are read from left to right, from high-order to low-order. Figure 1.2 illustrates the bit numbers for
bytes and double bytes, as well as the relative weights of each bit position.


                                                     Double-Byte
                                                                            Byte
               15   14     13   12   11   10     9     8    7      6    5   4      3   2     1     0
              High-Order                                                                   Low-Order


                                               Figure 1-2 Bit Numbers
Hexadecimal Representation of Binary
         While binary is a convenient number system for computers to use, it is somewhat difficult to translate a
series of ones and zeros into a number that is meaningful. Any number that can be represented by eight binary
bits can also be represented by two hexadecimal (or hex for short) digits. Hexadecimal numbers are base
sixteen numbers. Since base two uses the digits zero through one, and base ten the digits zero through nine,
clearly base sixteen must use digits standing for the numbers zero through fifteen. Table 1.1 is a chart of the
sixteen possible four-bit numbers, with their respective decimal and hexadecimal representations.




                                                                                                                 14
```

<!-- programmanual p015 -->

```
The Western Design Center

                              Binary                   Decimal               Hexadecimal
                                       0000                    0                   0
                                       0001                    1                   1
                                       0010                    2                   2
                                       0011                    3                   3
                                       0100                    4                   4
                                       0101                    5                   5
                                       0110                    6                   6
                                       0111                    7                   7
                                       1000                    8                   8
                                       1001                    9                   9
                                       1010                    10                  A
                                       1011                    11                  B
                                       1100                    12                  C
                                       1101                    13                  D
                                       1110                    14                  E
                                       1111                    15                  F

                                           Table 1-1 Decimal and Hex Numbers
Because the positional notation convention reserves only a single place for each multiplier of the power of that base, the
numbers ten through fifteen must be represented by a single base-sixteen digit. Rather than create entirely new symbols for
digits, the first six letters of the alphabet were chosen to represent the numbers ten through fifteen. Each of the sixteen hex
digits corresponds to one of the possible combinations of four binary digits.
         Binary numbers larger than 1111 are converted to hexadecimal by first separating the bits into groups of
fur, starting from the right-most digit and moving left. Each group of four bits is converted into its
corresponding hex equivalent. It is generally easier to work with a hexadecimal number like F93B than its
binary counterpart 111100100111011.          Hexadecimal numbers are often used by machine language
programming tools such as assemblers, monitors, and debuggers to represent memory addresses and their
contents. The value of hexadecimal numbers is the ease with which they can be converted to and from their
binary equivalents once the table has been memorized.
         While a hexadecimal 3 and a decimal 3 stand for the same number, a hexadecimal 23 represents two
decimal sixteen’s plus 3, or 35 decimal. To distinguish a multiple-digit hex number from a decimal one, either
the word hexadecimal should precede or follow it, or a ‘$’ should prefix it, as in $23 for decimal 35, or $FF to
represent 255. A number without any indication of base is presumed to be decimal. An alternative notation for
hexadecimal numbers is to use the letter H as a suffix to the number (for example, FFH); however, the dollar-
sign prefix is generally used by assemblers for the 65x processors.

The ASCII
         Characters – letters, numbers, and punctuation – are stored in the computer as number values, and
translated to and from readable form on input or output by hardware such as keyboards, printers, and CRTs.
There are 26 English-language lower-case letters, another 26 upper-case ones, and a score or so of special
characters, plus the ten numeric digits, any of which might be typed from a keyboard or displayed on a screen or
printer, as well as stored or manipulated internally. Further, additional codes may be needed to tell a terminal or
printer to perform a given function, such as cursor or print head positioning. These control codes including
carriage return, which returns the cursor or print head to the beginning of a line; line feed, which moves the
cursor or print head down a line; bell, which rings a bell; and back space, which moves the cursor or print head
back one character.
         The American Standard Code for Information Interchange abbreviated ASCII and pronounced AS
key, was designed to provide a common representation of characters for all computers. An ASCII code is
stored in the low-order seven bits of a byte; the most significant bit is conventionally a zero, although a system
can be designed either to expect it to be set or to ignore it. Seven bits allow the ASCII set to provide 128
different character codes, one for each English letter and number, most punctuation marks, the most commonly
use mathematical symbols, and 32 control codes.


                                                                                                                            15
```

<!-- programmanual p016 -->

```
The Western Design Center

         The use of different bit values, or numbers, to store character codes, is entirely analogous to the
“decoder ring” type of cipher: the letter ‘A’ is one, ‘B’ is two, and so on; but in the case of the ASCII character
set, the numbers assigned to the letters of the alphabet are different, and there are different codes for upper- and
lower-case letters.
         There is an ASCII chart in Appendix F of this book. Notice that since the decimal digits 0 through 9
are represented by $30 to $39, they can be easily converted between their binary representations and their actual
values by the addition or subtraction of $30. The letters are arranged in alphabetical order, the capital letters
from A through Z represented by $41 through $5A and the lower-case letters from a through z represented by
$61 through $7A. This allows letters to be placed in alphabetical order by numerically sorting their ASCII
values, and characters to be converted between upper- and lower-case by the addition or subtraction of $20.
Finally, notice that the control characters from Ctrl-@ and Ctrl-A through Ctrl-Z and on to Ctrl-_ run from zero
to $1F and allow easy conversion between the control characters and the equivalent printing characters by the
addition or subtraction of $40.
         To print a character on an output device, you must send it the ASCII value of the character: to print an
‘A’, you must send $41 to the screen, not $A, which is the ASCII code for a line feed; and to print an ’8’, you
must send $38, not $8, which is the ASCII code for a backspace. The space character, too, has and ASCII code:
$20.
         Since any memory value – take $41 for example – could represent either an ASCII code (for ‘A’ in this
case) or a number (decimal 65), the interpretation of the data is defined by the code of the program itself and
how it treats each piece of data it uses within a give context.

Boolean Logic
         Logical operations interpret the binary on/off states of a computer’s memory as the values true and
false rather than the numbers one and zero. Since the computer handles data one or two bytes at a time, each
logical operation actually manipulates a set of bits, each with its own position.
         Logical operations manipulate binary “flags”. There are three logical operations that are supported by
65x microprocessor instructions, each combining two operands to yield a logical (true or false) result: and, or,
and exclusive or.

Logical And

         The AND operator yields true only if both of the operands are themselves true; otherwise, it yields
false. Remember, true is equivalent to one, and false equivalent to zero. Within the 65x processors, two strings
of eight, or in the case of the 65816, eight or sixteen, individual logical values may be ANDed, generating a
third string of bits; each bit in the third set is the result of ANDing the respective bit in each of the first two
operands. As a result, the operation is called bitwise.
         When considering bitwise logical operations, it is normal to use binary representation. When
considered as a numeric operation on two binary numbers, the result given in Figure 1.3 makes little sense. By
examining each bit of the result, however, you will see that each has been determined by ANDing the two
corresponding operand bits.

                                                       11011010         $DA
                                           AND         01000110         $45
                                          equals       01000010         $42

                                              Figure 1-3 ANDing Bits




                                                                                                                 16
```

<!-- programmanual p017 -->

```
The Western Design Center

        A truth table can be drawn for two-operand logical operations. You find the result of ANDing two bits
by finding the setting of one bit on the left and following across until you’re under the setting of the other bit.
Table 1.2 shows the truth table for AND.
                                                          Second Operand
         0      1
                                         First Operand
                                                     0         0      0
                                                     1         0      1

                                         Table 1-2 Truth Table for AND
Logical Or
        The OR operator yields a one or true value if either (or both) of the operands is true. Taking the same
values as before, examine the result of the logical OR operation in Figure 1.4. The truth table for the OR
function is shown in Table 1.3.
                                                       11011010           $DA
                                            OR         01000110           $45
                                          equals       11011110           $DE

                                              Figure 1-4 ORing Bits
Logical Exclusive Or
         The exclusive OR operator is similar to the previously-described OR operation; in this case, the result
is true only if one or the other of the operands is true, but not if both are true or (as with OR) neither is true.
That is, the result is true only if the operands are different, as Figure 1.5 illustrates using the same values as
before. The truth table for exclusive OR is shown in Table 1.4.
                                                          Second Operand
         0          1
                                         First Operand
                                                     0         0      1
                                                     1         1      1


                                          Table 1-3 Truth Table for OR
                                                       11011010           $DA
                                           EOR         01000110           $45
                                          equals       10011100           $9C


                                       Figure 1-5 EXCLUSIVE ORing Bits
                                                          Second Operand
         0      1
                                         First Operand
                                                     0         0      1
                                                     1         1      0

                                   Table 1-4 Truth Table for EXCLUSIVE OR
Logical Complement
        As Figure 1.6 shows, the logical complement of a value is its inverse: the complement of true is false,
and the complement of false is true.




                                                                                                                17
```

<!-- programmanual p018 -->

```
The Western Design Center

                                                           11011010           $DA
                               COMPLEMENTED
                                    equals                 00100101           $25
                                      Figure 1-6 COMPLEMENTing Bits


         While the 65x processors have no complement or not function built in, exclusive ORing a value with a
string of ones ($FF or $FFFF) produces the complement, as Figure 1.7 illustrates.

                                                        11011010            $DA
                                           EOR          11111111            $FF
                              equals Complement         00100101            $25

                             Figure 1-7 COMPLEMENTing Bits Using Exclusive OR
         Since complement has only one operand, its truth table, drawn in Table 1.5, is simpler than the other
truth tables.
                                             operand          result
                                                0               1
                                                1               0


                                   Table 1-5 Truth Table for COMPLEMENT

Signed Numbers
         Many programs need nothing more than the whole numbers already discussed. But others need to store
and perform arithmetic on both positive and negative numbers.
         Of the possible systems for representing signed numbers, most microprocessors, among them those in
the 65x family, use two’s complement. Using two’s-complement form, positive numbers are distinguished
from negative ones by the most significant bit of the number: a zero means the number is positive; a one means
it is negative.
         To negate a number in the two’s-complement system, you first complement each of its bits, then add
one. For example, to negate one (to turn plus-one into minus-one):

                                       00000001        To negate +1,
                                       11111110        complement each bit
                                             +1        and add one.
                                       11111111        The result is – 1.

         So $FF if the two’s-complement representation of minus-one. When converting to two’s complement
by hand, an easier technique than the two-step process is to copy zeroes from the right (least significant bit)
until the first one is reached; copy that one, and then change every zero to a one and every one to a zero as you
continue to the left. Try it on the example above.
         Now, instead of using eight bits to represent the integers from zero to 255, two’s-complement
arithmetic uses eight bits to represent signed numbers from –128 ($80) to + 127 ($7F), as Table 1.6 shows.
There is always one more negative than positive number in a two’s-complement system.




                                                                                                              18
```

<!-- programmanual p019 -->

```
The Western Design Center

                                 Decimal            Hexadecimal           Binary
                                   +127                 $7F          0111 1111
                                   +126                 $7E          0111 1110
                                   +125                 $7D          0111 1101
                                       .                   .             .
                                       .                   .             .
                                       .                   .             .
                                     +1                   1          0000 0001
                                      0                   0          0000 0000
                                     -1                 $FF          1111 1111
                                     -2                 $FE          1111 1110
                                     -3                 $FD          1111 1101
                                       .                   .             .
                                       .                   .             .
                                       .                   .             .
                                   -126                 $82          1000 0010
                                   -127                 $81          1000 0001
                                   -128                 $80          1000 0000

                         Table 1-6 The Eight-Bit Range of Two’s-Complement Numbers


         Another practical way to think of negative two’s-complement numbers is to think of negative numbers
as the (unsigned) value that must be added to the corresponding positive number to produce zero as the result.
For example, in an eight-bit number system, the value that must be added to one to produce zero (disregarding
the carry) is $FF; 1+$FF=$100, or 0 if only the low-order eight bits is considered. $FF must therefore be the
two’s-complement value for minus one.
         The introduction of two’s-complement notation creates yet another possibility in interpreting the data
stored at an arbitrary memory location. Since $FF could represent either the unsigned number 255 or the
negative integer minus-one, it’s important to remember that it is only the way in which a program interprets the
data stored in memory that gives it its proper value – signed or unsigned.

Storing Numbers in Decimal Form

         Computers use numbers in binary form most efficiently. But when a program calls for decimal
numbers to be entered or output frequently, storing numbers in their decimal form – rather than converting them
to binary and back – may be preferable. Further, converting floating-point decimal numbers to a binary
floating-point form and back can introduce errors: for example, 8 minus 2.1 could result in 5.90000001 rather
than the correct answer, 5.9.
         As a result, some programs, such as accounting applications, store numbers in decimal form, each
decimal digit represented by four bits, yielding two decimals digits per byte, as Table 1.7 shows. This form is
called binary-coded decimal BCD lies somewhere between the machine’s native binary and abstractions such
as the ASCII character codes for numbers.
         Since four bits can represent the decimal numbers from zero to fifteen, using the same number of bits to
represent only the numbers from zero through nine wastes six combinations of the binary digits. This less than
optimal use of storage is the price of decimal accuracy and convenience.




                                                                                                              19
```

<!-- programmanual p020 -->

```
The Western Design Center

                   Binary            Hexadecimal                 Decimal                 BCD
                   0000 0000               0                          0                0000 0000
                   0000 0001               1                          1                0000 0001
                   0000 0010               2                          2                0000 0010
                   0000 0011               3                          3                0000 0011
                   0000 0100               4                          4                0000 0100
                   0000 0101               5                          5                0000 0101
                   0000 0110               6                          6                0000 0110
                   0000 0111               7                          7                0000 0111
                   0000 1000               8                          8                0000 1000
                   0000 1001               9                          9                0000 1001
                   0000 1010               A                         10                0001 0000
                   0000 1011               B                         11                0001 0001
                   0000 1100               C                         12                0001 0010
                   0000 1101               D                         13                0001 0011
                   0000 1110               E                         14                0001 0100
                   0000 1111               F                         15                0001 0101


                                       Table 1-7 The First 16 BCD Numbers
        The 65x processors have a special decimal mode which can be set by the programmer. When decimal
mode is set, numbers are added and subtracted with the assumption that they are BCD numbers: in BCD mode,
for example, 1001+1 (9+1) yields the BCD results of 0001 0000 rather than the binary result of 1010 (1010 has
no meaning in the context of BCD number representation).
        Obviously, in different context 0001 0000 could represent either 10 decimal or $10 hexadecimal (16
decimal); in this case, the interpretation is dependent on whether the processor is in decimal mode or not.

Computer Arithmetic

         Binary arithmetic is just like decimal arithmetic, except that the highest digit isn’t nine, it’s one. Thus
1+0=1, while 1+1=0 with a carry of 1, or binary 10. Binary of 10 is equivalent of a decimal 2. And 1-0=1,
while during the subtraction of binary 1 from binary 10, the 1 can’t be subtracted from the 0, so a borrow is
done, getting the 1 from the next position (leaving it 0); thus, 10-1=1.
         Addition and subtraction are generally performed in one or more main processor registers, called
accumulators. On the 65x processors, they can store either one or, optionally on the 65802 and 65816, two
bytes. When two numbers are added that cause a carry from the highest bit in the accumulator, the result is
larger than the accumulator can hold. To account for this, there is a special one-bit location, called a carry bit,
which holds the carry out of the high bit from an addition. Very large numbers can be added by adding the low-
order eight or sixteen bits (whichever the accumulator holds) of the numbers, and then adding the next set of bit
plus the carry from the previous addition, and so on. Figure 1.8 illustrates this concept of multiple-precision
arithmetic.

Microprocessor Programming
        You have seen how various kinds of data are represented and, in general, how this data can be
manipulated. To make those operations take place, a programmer must instruct the computer on the steps it
must take to get the data, the operations to perform on it, and finally the steps to deliver the results in the
appropriate manner. Just as a record player is useless without a record to play, so a computer is useless without
a program to execute.

Machine Language

        The microprocessor itself speaks only one language, its machine language, which inevitably is just
another form of binary data. Each chip design has its own set of machine language instructions, called its
instruction set, which defines the function that it can understand and execute. Whether you program in
machine language, in its corresponding assembly language, or in a higher level language like BASIC or Pascal,
the instructions that the microprocessor ultimately executes are always machine language instructions.
Programs in assembly and higher-level languages are translated (by assemblers, compilers and interpreters) to
machine language before the processor can execute them.
                                                                                                                 20
```

<!-- programmanual p021 -->

```
The Western Design Center

         Each machine language instruction in the 65x series of microprocessors is one to four bytes long. The
first byte of each instruction is called the operation code (opcode for short); it specifies the operation the
computer is to do. Any additional bytes in the instruction make up the operand, typically all or part of an
address to be accessed, or a value to be processed.
  0    0     1     1      1       0     0      0             1     0     0        0      0        0    1    1
                        $38                                                            $83

  1    0     1     0      0       1     0      1             1     0     1        0      0        1    0    1
                    Plus $A5                                                      Plus $A5

                        PLUS CARRY              1


   1     1    0     1         1    1     1      0             0     0     1        0         1     0    0       0
                   Equal $DE                                                             Equals
                                                                                        $28


                                                                                  Carry = 1

                                             $3883 Plus $A5A5 Equals $DE28


                                       Figure 1-8 Multiple-Precision Arithmetic




                                                                                                                    21
```

<!-- programmanual p022 -->

```
The Western Design Center

Assembly Language
         Writing long strings of hexadecimal or binary instructions to program a computer is obviously not
something you would want to do if you could at all avoid it. The 65816’s 256 different opcodes, for example,
would be difficult to remember in hexadecimal form – and even harder in binary form. Assembly language,
and programs which translate assembly language to machine code (called assemblers) were devised to simplify
the task of machine programming.
         Assembly language substitutes a short word – known as a mnemonic (which means memory aid) – for
each binary machine code instruction. So while the machine code instruction 1010 1010, which instructs the
65x processor to transfer the contents of the A accumulator to the X index register, may be hard to remember,
its assembler mnemonic TAX (for “Transfer A to X”) is much easier.
         The entire set of 65x opcodes are covered alphabetically by mnemonic label in Chapter Eighteen, while
Chapter Five through Thirteen discuss them in functional groups, introducing each of them, and providing
examples of their use.
         To write an assembly language program, you first use a text editing program to create a file containing
the series of instruction mnemonics and operands that comprise it; this is called the source program, source
code or just source. You then use this as the input to the assembler program, which translates the assembler
statements into machine code, storing the generated code in an output file. The machine code is either in the
form of executable object code, which is ready to be executed by the computer, or (using some development
systems), a relocatable object module, which can be linked together with other assembled object modules
before execution.
         If this were all that assembly language provided, it would be enough to make machine programming
practical. But just as the assembler lets you substitute instruction mnemonics for binary operation codes, it lets
you use names for the memory locations specified in operands so you don’t have to remember or compute their
addresses. By naming routines, instructions which transfer control to them can be coded without having to
know their addresses. By naming constant data, the value of each constant is stated only in one place, the place
where it is named. If a program modification requires you to change the values of the constants, changing the
definition of the constant in that one place changes the value wherever the name has been used in the program.
These symbolic names given to routines and data are known as labels.
         As your source program changes during development, the assembler will resolve each label reference
anew each time an assembly is performed, allowing code insertions and deletions to be made. If you hard-
coded the addresses yourself, you would have to recalculate them by hand each time you inserted or deleted a
line of code.
         The use of an assembler also lets you comment your program within the source file – that is, to explain
in English what it is you intend the adjacent assembly statements to do and accomplish.
         More sophisticated macro assemblers take symbol manipulation even further, allowing special labels,
called macro instructions (or just macros for short), to be assigned to a whole series of instructions. Macro is
a Greek word meaning long, so a macro instruction is a “long” instruction. Macros usually represent a series of
instructions which will appear in the code frequently with slight variations. When you need the series, you can
type in just the macro name, as though it were an instruction mnemonic; the assembler automatically “expand”
the macro instruction to the previously-defined string of instructions. Slight variations in the expansion are
provided for by a mechanism that allows macro instructions to have operands.

Writing in Assembly Language

        In addition to understanding the processor you’re working with, you must also have a good knowledge
of the particular assembler you are using to program in assembly language. While the specific opcodes used are
carved in the silicon die of the processor itself, the mnemonics for those opcodes are simple conventions and
may vary slightly from one assembler to another (although the mnemonics proposed by a processor’s
manufacturer will tend to be seen as the standard). Varying even more widely are assembler directives –
assembler options which can be specified in the midst of code. These options tell the assembler such things as
where to locate the program in memory, which portions of the source listing to print, or what labels to assign to
constants.


                                                                                                               22
```

<!-- programmanual p023 -->

```
The Western Design Center

          Nevertheless, most microcomputer assemblers have a great deal in common. They generally provide
four columns, or fields, for different types of information about an operation: a label which can be used to
symbolically identify the location of the code; the opcode; the operand; and space for comments. Figure 1.9
illustrates some typical assembler source code, with the different fields highlighted.
          While an opcode or directive appears in every assembler statement, the operand field may or may not be
required by any particular opcode, since there are several one-byte instructions which consist solely of an
opcode. The label and comment field are optional, added to make the program easier to read, write, debug, and
modify later.
          During assembly, the assembler checks the fields to be sure the information there is complete, of the
proper type, and not out of order, and issues error messages to warn you problems. It also checks to be sure you
have not tried to define the same label twice, and that you have not used a label you did not define.

Basic Programming Concepts

         There are several concepts which, in general terms, characterize the different ways a program can
execute.
         The most obvious concept is that of straight-line execution: a program starts in low memory and steps
a few bytes higher into memory with execution of each new instruction until it reaches the end, never doubling
back or jumping forward. Straight-line execution is clean and clear: it begins at the beginning, executes every
instruction in the program once, and ends at the end. This type of execution is the default execution mode. The
65x processors have register called the program counter, which is automatically updated at the end of each
instruction so that it contains the address of the next instruction to be executed.

               Label      Opcode      Operand Comment
               Field      Field       Field   Field
                          REP         #$10
                          LONGI       ON

                          SEP         #$20
                          LONGA       OFF

                          LDY         #0
                   LOOP   LDA         (1,S),Y       get character from first string
                          BEQ         PASS          if zero, end of string: match
                          CMP         (3,S),Y       compare to corresponding char in 2nd string
                          BNE         FAIL          bra if not equal; probably failure
                          INY                       else do not pair
                          BRA         LOOP

               ;          matches shortest string

               PASS       PLP                       they match up to shortest string;
                          CLC                       restore status, but clear carry
                          BRA         EXIT

               FAIL       LDA         (3,S),Y       was last failure due to end of string2?
                          BEQ         PASS          yes; let it pass
                          PLP                       restore status, but set carry (no match)
                          SEC

                                   Figure 1-9 Typical Assembler Source Code




                                                                                                             23
```

<!-- programmanual p024 -->

```
The Western Design Center

Selection Between Paths

         Real-life problems – the kind you want to write computer programs to solve – are seldom straight and
simple. A computer would be very limited with only straight-line execution capability, that is, if it could not
make choices between different courses of action based on the conditions that exist while it is executing.
Selection between paths provides computers with their decision-making capabilities. The 65x microprocessors
carry out selection between paths by means of conditional branch instructions.
         An example of selection between paths would be a tic-tac-toe program. Playing second, the program
must choose where to place its first token from eight different squares. If the opponent has taken the center
square, the program must respond differently than if a side square were taken.
         Execution still begins at the beginning and ends at the end, in a single pass through the code, but whole
groups of instructions on paths not taken are not executed.

Looping

         Let’s say you write a program to convert a Fahrenheit temperature to Celsius. If you had only one
temperature to convert, you wouldn’t spend the time writing a program. What you want the program to do is
prompt for a Fahrenheit temperature, convert it to Celsius, print out the result, then loop back and prompt for
another Fahrenheit temperature, and so on – until you run out of temperatures to convert. This program uses a
program concept called looping or iteration, which is simply the idea that the same code can be reexecuted
repeatedly – with different values for key variables – until a given exit condition. In this case the exit condition
might be the entry of a null or empty input string.
         Often, it’s not the whole program that loops, but just a portion of it. While a poker program could deal
out 20 cards, one at a time, to four players, it would use much less program memory to deal out one card to each
of the players, then loop back to do the same thing over again four more times, before going on to take bets and
play the poker hands dealt.
         Looping saves writing repetitive code over and over again, which is both tedious and uses up memory.
The 65x microprocessors execute loops by means of branch and jump instructions.
         Looping almost always uses the principle of selection between paths to handle exiting the loop. In the
poker program, after each set of four cards has been dealt to the four players, the program must decide if that
was the fifth set of four cards or if there are more to deal. Four times it will select to loop back and deal another
set; the fifth time, it will select another path – to break out of the loop to begin prompting for bets.

Subroutines

         Even with loops, programmers could find themselves writing the same section of code over and over
when it appears in a program not in quick succession but rather recurring at irregular intervals throughout the
program. The solution is to make the section of code a subroutine, which the program can call as many times
and from as many locations as it needs to by means of a jump-to-subroutine instruction. The program, on
encountering the subroutine call, makes note of its current location for purposes of returning to it, then jumps to
the beginning of the subroutine code. At the end of the subroutine code, a return-from-subroutine instruction
tells the program to return from the subroutine to the instruction after the subroutine call. There are several
different types of calls and returns available on the different 65x processors; all of them have a basic call and
return instruction in common.
         Programmers often build up large libraries of general subroutines that multiply, divide, output
messages, send bytes to and receive bytes from a communications line, output binary numbers in ASCII,
translate numbers from keyboard ASCII into binary, and so on. Then when one of these subroutines is needed,
the programmer can get a copy from the library or include the entire library as part of his program.




                                                                                                                  24
```

<!-- programmanual p025 -->

```
The Western Design Center




                           Part 2
                        Architecture




                                       25
```
