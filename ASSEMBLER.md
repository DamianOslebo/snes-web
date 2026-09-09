# 65C816 Assembler — progress & TODO

Status: **done, committed, and wired into the debugger.** The shared opcode
foundation, the assembler, and the debugger's Assembler panel are built and
green (66 tests across the suite; typecheck and production build clean).

Commits, in order:

- `1b06b5a` — the foundation: `src/asm/opcode.ts`, `src/debug/disasm.ts`,
  `test/disasm.test.ts`, `src/core/mock-core.ts`
- `37f78c1` — the assembler: `src/asm/assembler.ts`, `test/asm.test.ts`,
  plus the BRK addition to `MASK_OPS`
- (3rd commit) — the Assembler panel in `src/debug/debugger.ts`

## Done

### `src/asm/opcode.ts` (new) — single source of truth

### `src/asm/opcode.ts` (new) — single source of truth

One canonical 65C816 (SNES 5A22) opcode table read by **both** the
disassembler and the assembler, so decode and encode can never drift apart.

- Every entry cross-checked against snes9x's `S9xOpcodesM1X1` /
  `S9xOpLengthsM1X1` tables. Opcodes we're not certain about are left out
  and decode as `??` — per the CLAUDE.md safety principle (safe-`??` over
  mislabeling). One known deliberate omission: `STZ` absolute (`$92`).
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

### `src/asm/assembler.ts` (new) — the assembler

`assemble(source, origin = 0x008000) → AsmResult` — pure TS, no DOM, unit-
testable on its own.

- **Syntax:** every shared-table instruction in every mode it supports;
  immediates `#$NN`/`#$NNNN`; addresses `$NN`/`$NNNN` with optional `,X`/`,Y`;
  indirects `($NN)`, `($NN,X)`, `($NN),Y`; banked `$C0:0301`; branch labels,
  `$bank:addr` targets, and explicit offsets `+$NN`/`-$NN`; directives
  `.byte`/`.db`, `.word`/`.dw`, `.ascii`/`.asciz`/`.text`; comments `;` and
  `//`.
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

### `test/asm.test.ts` (new) — 19 tests, all green

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
byte-identity with the original output. Covers all 12 addressing forms and
a branch-heavy program (labels, `BRL`, self-referential `BNE +0`).

### `test/disasm.test.ts` + `src/core/mock-core.ts` — updated, passing

- Disasm tests rewritten to the corrected encodings; new BRL test and
  expanded C816 stack/register-transfer coverage (7 tests, all green).
- MockCore's seed program re-encoded to match (BNE is now 2 bytes,
  `STA $0200` is `8D 00 02`). `mock-core.test.ts` still passes.

## Assembler panel (debugger) — `src/debug/debugger.ts`

The UI: a panel between Memory and Save states.

- Paste 65C816 source into a textarea (pre-filled with a small loop) and
  pick a bank/addr — default WRAM `$7E:8000`, because bank `$00` is ROM
  and unwritable on hardware.
- **Assemble** → either a per-line listing (address, bytes, source — from
  the assembler's `lines` result) or the line-numbered errors; the Write
  button stays disabled until an assemble succeeds.
- **Write** → `SnesCore.writeMem(bank, addr, bytes)` copies the bytes into
  the live core (works on both the wasm core and the mock), then the
  Memory panel jumps to the written block. For that, `buildMemToolbar`
  now returns its region-select + offset widgets.

## Not done

- **Executing the written code is not wired up.** The core ABI exposes
  registers read-only — there is no PC setter — so the panel can place
  code in WRAM but cannot make the CPU start there. That would be a shim
  addition, and per the three-way sync rule it would need to be added to
  `wasm-core.ts` and `core/build.sh`'s `EXPORTED_FUNCTIONS` at the same
  time.
- `src/ui/input-test.ts` + the `?inputtest=1` route in `src/main.ts` are
  a *separate* uncommitted task (Backbone/Android input probe) — commit
  or shelve separately, not with this work.

## Verify

```bash
npx vitest run test/asm.test.ts      # 19 tests (incl. round-trips)
npx vitest run test/disasm.test.ts   # 7 tests
npx vitest run                       # full suite: 66 tests
npm run typecheck
```
