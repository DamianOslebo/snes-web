# 65C816 Assembler — progress & TODO

Status: **done, committed, and wired as a full page that emits a runnable ROM.**
The shared opcode foundation and the assembler are committed and green (79
tests across the suite; typecheck and production build clean). The 65C816
editor lives on its own full page — `?asm=1`, reached from the "⌨ Assembler"
transport button — because a debugger panel was too cramped to write and review
code in. The old panel has been removed from the debugger.

The assembler no longer writes bytes into the core's RAM. It **builds a valid
256 KB LoROM SFC image** from the assembled code (`src/asm/rom.ts`) and hands it
to the emulator (`▶ Run in emulator`) or to the user (`⬇ Download .sfc`), so the
CPU *executes it from the reset vector on a cold boot* — the missing "run the
assembled code" capability, achieved without any PC-setter ABI change.

Commits, in order:

- `1b06b5a` — the foundation: `src/asm/opcode.ts`, `src/debug/disasm.ts`,
  `test/disasm.test.ts`, `src/core/mock-core.ts`
- `37f78c1` — the assembler: `src/asm/assembler.ts`, `test/asm.test.ts`,
  plus the BRK addition to `MASK_OPS`
- (earlier) — the full-page assembler: new `src/ui/assembler.ts`
  (`mountAssembler`), the `?asm=1` route + `asmBtn` handler in `src/main.ts`,
  the "⌨ Assembler" button in `src/ui/app.ts`, and the Assembler panel
  **removed** from `src/debug/debugger.ts`
- (this change) — **the ROM path**: new `src/asm/rom.ts` (`buildRom`,
  `bytesToBase64`/`base64ToBytes`, `ASM_ROM_KEY`) + `test/rom.test.ts`; the
  assembler page rewired to a core-free ROM builder (`▶ Run in emulator` +
  `⬇ Download .sfc`, the old Write/Read-back removed); the assembled-ROM handoff
  in `src/main.ts`; and the reset-vector doc fixed to say `$8000` in
  `src/core/rom-check.ts`.

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

- **Layout:** standard SFC header in `$0000–$00FF` (Mapper 0, no S-RAM, entry
  `$8000`, version 1, LoROM target); 12-byte ASCII title at `$7FC0`
  (default `"ASM 65C816"`); the **reset + NMI vectors at `$7FFC`/`$7FFE` both
  point at `$8000`** (bytes `00 80`, little-endian — what
  `looksLikeSnesRom` gates on); the code copied at file offset `$8000` (which is
  24-bit address `$8000` under LoROM bank `$00`).
- **Checksums:** standard two-step order — header checksum (`$0A`) computed
  first with the ROM-checksum byte still zero, then ROM checksum (`$09`) last so
  it includes the final header byte. The build tolerates them being wrong, but a
  correct ROM carries them and it makes the downloaded `.sfc` portable.
- **Validation:** empty program and a program past the entry region
  (`> 0x38000` bytes) throw a clear error. No guessing.
- **Handoff:** `bytesToBase64`/`base64ToBytes` carry the built ROM across the
  page→app navigation via `sessionStorage` (key `ASM_ROM_KEY`) — too large for a
  URL, and one valid base64 string (a single `btoa` over a bounded binary build,
  not per-chunk `btoa` which leaves `=` padding mid-string).

### `test/rom.test.ts` (new) — 10 tests, all green

Exact 256 KB size; code byte-for-byte at the `$8000` entry; reset + NMI vectors
`00 80` → `$8000`; the 12-byte title (default + custom); the standard header
(entry bytes `00 80`); ROM + header checksums recomputing correctly;
**`looksLikeSnesRom(buildRom(bytes)) === true`** (the critical load gate);
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
  code is placed at the ROM entry `$8000`, where the reset vector points, so the
  CPU starts there on boot.
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
npx vitest run test/rom.test.ts      # 10 tests (header, vectors, checksums, gate, base64)
npx vitest run                       # full suite: 79 tests
npm run typecheck
npm run build
```
