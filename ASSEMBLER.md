# 65C816 Assembler — progress & TODO

Status: **done, committed, and wired as a full page that emits a *loadable* ROM.**
The shared opcode foundation and the assembler are committed and green (80
tests across the suite; typecheck and production build clean). The 65C816
editor lives on its own full page — `?asm=1`, reached from the "⌨ Assembler"
transport button — because a debugger panel was too cramped to write and review
code in. The old panel has been removed from the debugger.

🤖 The agent panel (present on all three authoring pages) can drive this page end-to-end — see [AGENT.md](AGENT.md).

The assembler no longer writes bytes into the core's RAM. It **builds a valid
256 KB LoROM SFC image** from the assembled code (`src/asm/rom.ts`) and hands it
to the emulator (`▶ Run in emulator`) or to the user (`⬇ Download .sfc`), so the
CPU *executes it from the reset vector on a cold boot* — the missing "run the
assembled code" capability, achieved without any PC-setter ABI change.

**New (uncommitted): `.incbin` / `.bin`** — embed a loaded binary file
(`📦 Data files…`) into the ROM at that position and reference its address by
label. See the `.incbin` section below + `test/incbin.test.ts`.

**Load-gate fix:** the cart header is now emitted at its real location
(file offset `$7FB0`), with the `ROMSize` byte at `$7FD7` set to a valid value.
An earlier revision wrote it at `$0000` and left `$7FD7` = `0`, so snes9x's
`InitROM` (`core/memmap.c:1949`) rejected the ROM as corrupt and the `$8000`
slot read as stray header bytes. Both symptoms are fixed — verified end-to-end
against the emulator's own gate and the reference ROM's header.

**Code-offset fix (the "empty ROM / `BRK` at `$008000`" root cause):** the
assembled code must sit at **file `$0000`**, not file `$8000`. Under SNES LoROM
the file is mirrored in 32 KB blocks and the cold-boot reset target CPU
`$008000` (bank `$00`) reads file offset `$0000`; file `$8000` is a *separate*
32 KB block (CPU `$010000`). An earlier revision copied the code to file `$8000`,
so on reset the CPU read the zero-filled file-`$0000` region and fell straight
into `BRK` (`00 00`) while the real code sat in the wrong block — the "whole ROM
is empty" / "no data at `$8000`" reports. `buildRom` now uses a distinct
`CODE_OFFSET = 0x0000` (the file offset) separate from `ROM_ENTRY = 0x8000`
(the *assembly origin address* the code is written against), and caps the code
at `$7FB0` bytes so it can't run into the cart header.

Commits, in order:

- `1b06b5a` — the foundation: `src/asm/opcode.ts`, `src/debug/disasm.ts`,
  `test/disasm.test.ts`, `src/core/mock-core.ts`
- `37f78c1` — the assembler: `src/asm/assembler.ts`, `test/asm.test.ts`,
  plus the BRK addition to `MASK_OPS`
- (earlier) — the full-page assembler: new `src/ui/assembler.ts`
  (`mountAssembler`), the `?asm=1` route + `asmBtn` handler in `src/main.ts`,
  the "⌨ Assembler" button in `src/ui/app.ts`, and the Assembler panel
  **removed** from `src/debug/debugger.ts`
- (committed) — **the ROM path**: new `src/asm/rom.ts` (`buildRom`,
  `bytesToBase64`/`base64ToBytes`, `ASM_ROM_KEY`) + `test/rom.test.ts`; the
  assembler page rewired to a core-free ROM builder (`▶ Run in emulator` +
  `⬇ Download .sfc`, the old Write/Read-back removed); the assembled-ROM handoff
  in `src/main.ts`; and the reset-vector doc fixed to say `$8000` in
  `src/core/rom-check.ts`.
- (this fix) — **cart header at its real `$7FB0` location**: the header bytes
  (title, `ROMSize`/`SRAMSize`, checksums) and the vectors were being written
  at the wrong file offsets, leaving `$7FD7` (ROMSize) zero — which snes9x's
  `InitROM` corrupt gate rejects and which is why `$8000` read as stray header
  bytes. `src/asm/rom.ts` now emits the header at `$7FB0` with `ROMSize`=`$08`
  at `$7FD7`, and `test/rom.test.ts` gains the gate + checksum checks.
- (this fix) — **code at file `$0000`, not `$8000` (the "empty ROM" root
  cause):** `buildRom` copied the assembled code to file offset `$8000`, but
  under LoROM the reset target CPU `$008000` reads file `$0000` (file `$8000`
  is a separate 32 KB block), so the CPU booted into the zero-filled region and
  hit `BRK`. `src/asm/rom.ts` now copies the code to `CODE_OFFSET = 0x0000`
  (a distinct constant from the `ROM_ENTRY = 0x8000` origin address) and caps
  it at `$7FB0` bytes; `test/rom.test.ts` asserts the code at file `$0000` and
  the new cap.

## Done

### `src/asm/opcode.ts` (new) — single source of truth

One canonical 65C816 (SNES 5A22) opcode table read by **both** the
disassembler and the assembler, so decode and encode can never drift apart.

- Every entry cross-checked against snes9x's `S9xOpcodesM1X1` /
  `S9xOpLengthsM1X1` dispatch + length tables and WDC "Programming the 65816"
  Ch.19 (the flat $00–$FF instruction matrix). Opcodes we're not certain
  about are left out and decode as `??` — per the CLAUDE.md safety principle
  (safe-`??` over mislabeling). The deliberate omissions (all decode as `??`):
  the implied-indexed-indirect ALU family (obscure + mode-fragile), WDM
  ($42 — WDC-proprietary, not on SNES 5A22 silicon), MVP/MVN ($44/$54 — rare
  block moves), and the Absolute-Indexed-Long exotic family.
- Confirmed, not guessed: the return opcodes are **`RTS`=`$60` and `RTI`=`$40`
  — identical to the 6502, no 65C816 swap** (WDC Ch.19 matrix: "40 RTI",
  "60 RTS"). This was the source of an earlier false "C816 swaps RTS/RTI"
  claim that had leaked into the mock seed and a couple of test comments.
- Collision detection: registering the same opcode byte twice throws.
- Exports:
  - `OPCODES` — decode table (byte → `{mnem, mode}`)
  - `encodeOp(mnem, mode)` — encode map (the assembler's entry point)
  - `operandSize(mode)` — operand byte count at the 8-bit baseline
  - `MASK_OPS` (`REP`/`SEP`/`BRK`) — must always keep exactly a 1-byte
    operand (flag mask for REP/SEP; dummy byte for BRK), never widened
- Deliberate design decision: sizes are the **8-bit-immediate (power-up)
  baseline**. 16-bit-immediate widening (once `REP #$1` sets P bit 0) is
  tracked by the *assembler*, kept out of the table so the table stays one
  canonical decode.

### `src/debug/disasm.ts` — refactored onto the shared table

Dropped its own hand-written table (~170 lines) in favor of importing
`OPCODES`/`operandSize` from `src/asm/opcode.ts`; keeps only the
presentation layer (sizing, operand formatting, branch-target resolution).
This also **fixed real mislabels** in the old table:

- ALU addressing-form nibble offsets were wrong (e.g. `LDA $A5` was `abs`,
  is now `zp`; `AND $2F` was `long`, is now `abs`; `ORA $01` is now `indy`,
  `ORA $11` is `indx`).
- `JSR`/`JMP` were decoded as 24-bit `long` — they're absolute (2-byte)
  operand; 24-bit banked is only `JSL` (`$22`).
- 8-bit conditional branches were sized as 16-bit relative (3 bytes); they
  take a 1-byte offset (2 total). Only `BRL` (`$82`) is the 16-bit branch.
- Stack/register bytes corrected: `PHD`/`PLD` were `$CD`/`$AD` (now `$0B`/
  `$2B`), `TSK` at `$2B` was wrong (that's `PLD`), `REP`/`SEP` were
  `$02`/`$03` (now `$C2`/`$E2`), and the C816 transfers (`TCS`/`TCD`/`TDC`,
  `TXY`, `TYX`, `XBA`, `XCE`, `PHY`/`PLY`) are now covered.
- Extended to the full 5A22 set the old table lacked: the `(S)` stack-relative
  ALU family, zero-page,Y (`LDX`/`STX` only), `STZ` absolute + absolute,X,
  the `ROL` memory forms, `TSB`/`TRB`, `BIT` immediate + zero-page,X,
  `DEC`/`INC` absolute,X, and the long/stack-control ops `PER`/`PEA`/`PEI`.

### `src/asm/assembler.ts` (new) — the assembler

`assemble(source, origin = 0x008000) → AsmResult` — pure TS, no DOM, unit-
testable on its own.

- **Syntax:** every shared-table instruction in every mode it supports;
  immediates `#$NN`/`#$NNNN`; addresses `$NN`/`$NNNN` with optional `,X`/`,Y`
  (`,`Y is only valid where the table allows it — `LDX`/`STX` zero-page,Y);
  indirects `($NN)`, `($NN,X)`, `($NN),Y`; stack-relative `(S)` / `(S)+$NN`;
  banked `$C0:0301`; branch labels, `$bank:addr` targets, and explicit
  offsets `+$NN`/`-$NN`; directives `.byte`/`.db`, `.word`/`.dw`,
  `.ascii`/`.asciz`/`.text`; comments `;` and `//`.
- **Labels:** two-pass resolution — the second pass is a fixed-point sweep
  over label offsets that is *monotone* (offsets only shrink from the
  worst-case seed, so termination is guaranteed; a 10,000-pass cap throws
  "did not converge — this is a bug"). Per-line P-state is precomputed
  first, since it depends only on preceding REP/SEP, not on widths.
- **P-register tracking:** power-up 8-bit; `REP #$1` → 16-bit A, `SEP #$1`
  → back (same for the X/Y bits, tracked independently). An immediate is
  2 bytes exactly when its width bit is set; `REP`/`SEP`/`BRK` operands are
  always 1 byte (`MASK_OPS`). A >8-bit immediate in 8-bit mode is an error,
  not a truncation.
- **Zero-page vs absolute by width AS WRITTEN** (`$4C` → zp, `$004C` → abs,
  even though the value fits a byte) — this mirrors the disassembler's
  printing, which is what makes its output reassemble byte-identically.
  Labels used as addresses are classified by their resolved value.
- **Branch encoding:** `offset = target − PC-after-instruction` in the
  full 24-bit address space (origin-inclusive), range-checked BEFORE
  truncation (±128..±127 for 8-bit rel, ±32768..±32767 for BRL) — an
  out-of-range branch is an error, never a wrapped byte.
- **Errors:** every failure is a line-numbered message
  (`{line, message}`) — unknown mnemonic, undefined/duplicate label,
  mode not supported by the mnemonic (`LDA ($0100)` → "does not take an
  indirect operand"), out-of-range offsets, oversized immediates, unknown
  directives. The result on failure carries empty bytes/lines. No guessing,
  same safe-`??` philosophy as the disassembler.
- **Result shape:** `{ok, origin, bytes, lines[], labels[], errors[],
  modeTrace[]}` where `lines` is a per-line byte map (offset/size/bytes/
  label) and `modeTrace` the per-line a16/x16/y16 state — both ready to
  drive a listing UI.

### `test/asm.test.ts` (new) — 20 tests, all green

Known-vector encoding of every addressing form; width-as-written
classification; forward/backward label branches (8-bit and BRL); the
8-bit and 16-bit fixed-point seeds; REP/SEP A/X/Y width tracking (with the
`modeTrace` asserted, not just the bytes); BRK's dummy byte staying 1 byte
in 16-bit mode; directives; labels-as-addresses by resolved width; the
per-line byte map; precise line-numbered errors per case.

And the payoff of the shared table — **assemble → disassemble →
reassemble → byte-identical**: the round-trip helper runs the assembled
bytes through `disassembleRange`, then reassembles each instruction's
*disassembler text* at that instruction's own address and demands
byte-identity with the original output. Covers all 12 addressing forms, a
branch-heavy program (labels, `BRL`, self-referential `BNE +0`), and a
13-instruction pass over the extended set — `(S)`, zero-page,Y, `STZ`
absolute/absolute,X, `ROL`, `TSB`/`TRB`, `BIT #imm`, `PER`, and `WAI`/`STP`.

### `test/disasm.test.ts` + `src/core/mock-core.ts` — updated, passing

- Disasm tests rewritten to the corrected encodings; new BRL test and
  expanded C816 stack/register-transfer coverage (9 tests, all green).
- MockCore's seed program re-encoded to match (BNE is now 2 bytes,
  `STA $0200` is `8D 00 02`). `mock-core.test.ts` still passes.

### `src/asm/rom.ts` (new) — build a runnable SFC ROM from assembled code

`buildRom(code, opts?) → Uint8Array` wraps the assembled bytes in a **256 KB
LoROM** image the emulator reads and executes — not a RAM write. Pure TS, no
DOM, unit-testable like the rest of `src/asm/`.

- **Layout:** the SNES cart header lives at file offset **`$7FB0`** — snes9x
  reads it via `RomHeader = Memory.ROM + 0x7FB0` (`core/memmap.c`), *not* at
  `$0000`. Written at their real offsets, mirroring the known-working reference
  ROM field-for-field: ROM id at `$7FB2`, the 12-byte ASCII title at `$7FC0`
  (default `"ASM 65C816"`), `ROMSpeed` `$7FD5`=`$30`, `ROMType` `$7FD6`=`$00`,
  **`ROMSize` `$7FD7`=`$08`**, `SRAMSize` `$7FD8`=`$00`, `ROMRegion`
  `$7FD9`=`$00`, `CompanyId` `$7FDA`=`$00`. The **reset + NMI vectors at
  `$7FFC`/`$7FFE` both point at `$8000`** (bytes `00 80`, little-endian — what
  `looksLikeSnesRom` gates on). The code is copied at file offset **`$0000`**
  (== CPU `$008000`, bank `$00`, under LoROM — the cold-boot reset target; file
  `$8000` is a *separate* 32 KB block and where an earlier revision wrongly put
  the code).
- **Why the header is at `$7FB0`, not `$0000`:** snes9x's load gate
  (`memmap.c:1949`) rejects a ROM whose `ROMSize` byte (`RomHeader[0x27]` = file
  `$7FD7`) is outside `$07–$1E`, or whose `SRAMSize` (`RomHeader[0x28]` = file
  `$7FD8`) exceeds `$10`. An earlier revision wrote the header at `$0000` and
  left `$7FD7` = `$00`, so the emulator refused the ROM with "ROM is corrupt or
  invalid" (and the code slot at `$8000` read as stray header bytes). Setting
  `ROMSize`/`SRAMSize` at their real `$7FD7`/`$7FD8` positions fixes both the
  load gate and the wrong bytes-at-`$8000` symptom.
- **Checksums:** the standard 16-bit ROM + complement pair at `$7FDC–$7FDF`
  (low byte first, matching snes9x's read order). `sum` is all bytes except the
  four checksum bytes; `ROMChecksum = 0x0000 − sum`, `Complement = 0xFFFF − sum`
  (mod `0x10000`). snes9x does not verify them (the reference ROM's are
  `0000`/`FFFF` yet it loads), but a well-formed image carries correct ones, so
  the downloaded `.sfc` is portable.
- **Code lives at file `$0000`, not `$8000`:** under SNES LoROM the file is
  mirrored in 32 KB blocks and the reset target CPU `$008000` (bank `$00`) reads
  file offset `$0000`. File `$8000` is a *separate* 32 KB block (CPU `$010000`).
  An earlier revision copied the code to file `$8000`, so on reset the CPU read
  the zero-filled file-`$0000` region (the `00 00` → `BRK` symptom) while the
  real code sat in the wrong 32 KB block. The fix is `CODE_OFFSET = 0x0000` in
  `buildRom`, distinct from the `ROM_ENTRY = 0x8000` *assembly origin address*.
- **Validation:** empty program and a program past the entry region
  (`> 0x7FB0` bytes — code at file `$0000` must not run into the `$7FB0` cart
  header) throw a clear error. No guessing.
- **Handoff:** `bytesToBase64`/`base64ToBytes` carry the built ROM across the
  page→app navigation via `sessionStorage` (key `ASM_ROM_KEY`) — too large for a
  URL, and one valid base64 string (a single `btoa` over a bounded binary build,
  not per-chunk `btoa` which leaves `=` padding mid-string).

### `.incbin` — embed binary data files (uncommitted)

The assembler now accepts two new directives, `.incbin "file"` (and the
`.bin` alias), which embed a loaded `.bin` file's bytes verbatim at that
position — the way to pull the graphics editor's VRAM dump (or any
tileset/PCM/SFX data) into the built ROM.

- **Syntax:** `label: .incbin "tiles.bin"` (or `.incbin 'x'`, `.bin x` —
  quoted, single-quoted, or bare; names with spaces work when quoted).
  Unknown names fail with the loaded-file list; zero files loaded fails
  with a "load it first" message; every failure is line-numbered.
- **Address referencing:** a label **on** the include line resolves to
  the data's first CPU byte (`origin + offset`); a label on the next line
  resolves just past it — so `data: .incbin "t.bin"` followed by
  `LDA data,X` / `JSR handler` / `CMP data+3` are all ordinary label uses.
  Branches correctly span the data (the byte map is real bytes, so the
  two-pass offset sweep sees it).
- **Cap:** code **plus** data must fit the 32 KB entry region
  (`MAX_CODE = $7FB0`, file `$0000–$7FAF`) — a full 64 KB VRAM image does
  **not** fit; a typical KB-scale tileset does. The escape hatch for more
  than 32 KB is multi-bank placement (`.org` into bank `$01`, file `$8000`)
  — deliberately not in v1 (the ROM is fixed 256 KB; bigger images mean a
  512 KB+ image and `ROMSize` changes).
- **Engine cost:** zero — the bytes materialize into `Line.data` at parse
  time, so sizing, labels, branch ranges, the `buildRom` cap check, and
  the listing all inherit it. The page's listing caps a displayed include
  at 16 bytes + "… +N more" so a 64 KB dump can't wreck the DOM.
- **Page:** a "📦 Data files…" picker (`.bin/.dat/.img/.rom`, multi-file)
  keeps the bytes in page state (chips with size + remove); each change
  re-assembles live. `assemble(source, origin, includes)` — the third
  argument is the new `IncludeMap` (`Record<string, Uint8Array>`).
- **Tests:** `test/incbin.test.ts` — 13 tests: exact byte placement,
  alias/quote/name variants, multi-include ordering, label-before and
  label-after addressing (`LDA data,X` → `bd lo hi` over the data,
  `BRA past` rel = +4 over a 4-byte include), the three error cases,
  end-to-end `buildRom` → `looksLikeSnesRom` with the data at its file
  offset, the `$7FB0` overflow throw, and the exact-fit boundary.

### `test/rom.test.ts` (new) — 11 tests, all green

Exact 256 KB size; code byte-for-byte at file `$0000` (== CPU `$008000`);
reset + NMI vectors `00 80` → `$8000`; the 12-byte title (default + custom);
the cart header at
`$7FB0` with `ROMSize`/`SRAMSize` at `$7FD7`/`$7FD8`; **a test that mirrors
snes9x's `InitROM` corrupt-ROM gate** (`SRAMSize ≤ 16 && 7 ≤ ROMSize ≤ 30`);
the 16-bit ROM + complement checksums at `$7FDC–$7FDF` recomputing correctly
with the `complement + 1 ≡ ROMChecksum` relation;
**`looksLikeSnesRom(buildRom(bytes)) === true`** (the app's load gate);
rejection of an empty / oversized program; the base64 round-trip at every size
the app uses; and the end-to-end *assemble → buildRom → gate* check on a
cold-boot-safe program.

## Assembler page — `src/ui/assembler.ts` (`?asm=1`)

A dedicated full page (not a debugger panel) — full-width editor on the left,
live assembled listing on the right — enough room to actually author and
review code. Reached from the "⌨ Assembler" transport button, which sets
`?asm=1`; `main.ts` routes it **before** the full emulator boot.

- **Core-free (pure TS):** the page no longer boots a core or touches RAM. It
  assembles the source at a fixed ROM entry (`$8000`) and turns the bytes into
  a ROM, so it works on any origin — no `AudioContext`/`AudioWorklet` needed to
  author or download. (Running the ROM is the *emulator's* job and still needs
  a secure origin for audio, exactly like any other ROM.)
- Paste 65C816 source (pre-filled with a small, **cold-boot-safe** loop) — the
  code is assembled at CPU `$008000` and placed at file `$0000` (its LoROM image
  of that address), where the reset vector points, so the CPU starts there on boot.
- **Assemble** (or live-assemble as you type, 300 ms debounce) → a per-line
  listing (address, bytes, source — from the assembler's `lines` result) or
  the line-numbered errors; Run and Download stay disabled until an assemble
  succeeds.
- **▶ Run in emulator** → `buildRom(last.bytes)` → base64 into
  `sessionStorage[ASM_ROM_KEY]` → navigate to the base route (strip `?asm`),
  where `main.ts` reads + clears the key and loads the ROM through the same
  `looksLikeSnesRom` → `core.loadRom` → render/audio pipeline a picked `.sfc`
  uses. The emulator then reads and executes the code the user wrote.
- **⬇ Download .sfc** → the same `buildRom` image written to disk as
  `assembled.sfc` (an object-URL anchor click) — the "ROM file" the user can
  keep or load elsewhere.
- **📦 Data files…** → pick `.bin`/`.dat`/`.img`/`.rom` files to embed with
  `.incbin "name"` (e.g. the graphics editor's 64 KB VRAM dump or a slice of
  it). Loaded files show as chips (name · size · ✕); removing one re-assembles
  so a dangling `.incbin` fails loudly. The listing shows an include's first
  16 bytes + "… +N more" — never the full dump.
- "← Back to game" strips the param and reboots the emulator.

The debugger's old Assembler panel (and its `buildMemToolbar` return-value
change that only the panel needed) is gone — `src/debug/debugger.ts` is back
to its five core panels.

## Not done

- **Live in-RAM execution / instruction stepping is still not wired.** The ROM
  path (this change) makes the emulator *run* the assembled code from a cold
  boot, which resolves the "can't start it" gap without any PC-setter ABI.
  Stepping a hand-placed code blob inside a running cart still can't be done
  from the app: `core.step` is frame-granular (snes9x's `S9xRun`), and single-
  instruction stepping needs the one-line `s9x_step` shim patch documented in
  `core/README.md` — out of scope here.
- `src/ui/input-test.ts` + the `?inputtest=1` route in `src/main.ts` are
  a *separate* uncommitted task (Backbone/Android input probe) — commit
  or shelve separately, not with this work.

## Verify

```bash
npx vitest run test/asm.test.ts      # 20 tests (incl. round-trips)
npx vitest run test/disasm.test.ts   # 9 tests
npx vitest run test/rom.test.ts      # 11 tests (header, vectors, checksums, gate, base64)
npx vitest run test/incbin.test.ts   # 13 tests (placement, labels, cap, errors)
npx vitest run                       # full suite (asm + gfx + mock + …)
npm run typecheck
npm run build
```
