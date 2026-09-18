/**
 * `driver` — the minimal SPC700 driver, emitted as a deterministic byte blob.
 *
 * EXPERIMENTAL. This is not an SPC700 emulator and not a full music engine —
 * it is the smallest SPC700 program that plays ONE sustained, looping BRR note
 * on voice 0 from source 0, then sleeps forever. The S-DSP sustains it; the
 * SPC700 CPU is parked in SLEEP.
 *
 * Every byte is grounded in the emulator this ROM actually runs in
 * (`core/snes9x-2010/core/apu.{c,h}`) and the SNES manual's S-DSP register map:
 *
 *   - Register writes use the SPC700 opcode `0x8F` ("MOV dp,#imm"). `case 0x8F`
 *     reads the ADDRESS at `pc+1` but writes `data = *++pc` (the VALUE, loaded
 *     into `a` just before the opcode) to `dp + address` (apu.c ~2337). So the
 *     byte order is `[0x8F, value, address]` — **value first**, address second.
 *     The IPL ROM in the same file confirms it: `0x8F, 0xAA, 0xF4` writes $AA to
 *     P0, `0x8F, 0xBB, 0xF5` writes $BB to P1.
 *   - The target register is addressed `dp + address`, so the DSP ports only
 *     map when `dp === 0`. The driver therefore opens with CLRP (`0x20`,
 *     `case 0x20: dp = 0;`), which also matches the IPL ROM's own entry.
 *   - To write a S-DSP register N = value V, first select N in R_DSPADDR ($F2),
 *     then write V to R_DSPDATA ($F3); `0x8F V 0xF3` triggers `spc_dsp_write`
 *     against the selected N (apu.c ~2337, apu.h R_DSPADDR=0x2 / R_DSPDATA=0x3).
 *     That is six bytes per register.
 *   - Power-on reset values are NON-zero (apu.c `initial_regs`), so every
 *     register the sound depends on is written explicitly — including ones that
 *     reset "wrong" (VOLR0=0x8B inverts, SRCN0=0xE4 is out of range,
 *     ADSR0_0=0x82 is ADSR mode, MVOLL/MVOLR/EVOLL/EVOLR are negative,
 *     KON=0xC1 turns on voices 3–7, ENDX=0xFF is all-noise).
 *   - The S-DSP latches a voice's registers at KON, so KON (0x4C) is written
 *     LAST and is followed by SLEEP (`0xEF`, `case 0xEF:`).
 *
 * Pure + node-testable: no DOM, no AudioContext, no fetch — it only returns
 * bytes and a human-readable register list for the tests to pin.
 */

import type { PageKind } from '../agent/types';

// --- SPC700 opcodes used (apu.c confirmed) -----------------------------------
export const SPC_CLRP = 0x20; // `case 0x20: dp = 0`
export const SPC_MOV_IMM = 0x8f; // `case 0x8F` — `MOV dp,#imm` → `ram[dp+addr] = value`
export const SPC_SLEEP = 0xef; // `case 0xEF` — halt SPC700; S-DSP sustains

// --- SMP / DSP port + register addresses (apu.h confirmed) -------------------
export const DSP_SELECT = 0xf2; // $F2 = R_DSPADDR (0x2) — select the S-DSP register
export const DSP_DATA = 0xf3; // $F3 = R_DSPDATA (0x3) — write the selected register

// --- S-DSP global registers (apu.h) ------------------------------------------
export const R_KOFF = 0x5c;
export const R_DIR = 0x5d;
export const R_MVOLL = 0x0c;
export const R_MVOLR = 0x1c;
export const R_EVOLL = 0x2c;
export const R_EVOLR = 0x3c;
export const R_EON = 0x4d;
export const R_ESA = 0x6d;
export const R_EDL = 0x7d;
export const R_ENDX = 0x7c;
export const R_FLG = 0x6c;

// --- S-DSP voice 0 registers (apu.h; voice stride 0x10, voice 0 @ +0) --------
export const V_VOLL0 = 0x00;
export const V_VOLR0 = 0x01;
export const V_PITCHL0 = 0x02;
export const V_PITCHH0 = 0x03;
export const V_SRCN0 = 0x04;
export const V_ADSR0_0 = 0x05;
export const V_ADSR1_0 = 0x06;
export const V_GAIN0 = 0x07;
export const R_KON = 0x4c;

/** One emitted instruction: either a raw opcode or a register select+write. */
export type DriverStep =
  | { kind: 'op'; op: number; comment: string }
  | { kind: 'reg'; reg: number; value: number; comment: string };

/**
 * The exact, in-order program the driver emits. Kept as data so the tests can
 * pin every register/value and the byte blob is a pure function of this list.
 * Order matters: every voice register is set BEFORE the final KON.
 */
export const DRIVER_STEPS: DriverStep[] = [
  { kind: 'op', op: SPC_CLRP, comment: 'CLRP — dp=0 (required for 0x8F to target $F0–$FF)' },
  { kind: 'reg', reg: R_KOFF, value: 0xff, comment: 'KOFF  = all voices off (clean slate)' },
  { kind: 'reg', reg: R_DIR, value: 0x20, comment: 'DIR   = source-directory page $20 → entry at $2000 (MUST be past the driver+sample at $0000–$1CA8; the driver itself lives at $0000 so page 0 is out)' },
  { kind: 'reg', reg: R_MVOLL, value: 0x7f, comment: 'MVOLL = L master full +ve (reset 0x89 inverts)' },
  { kind: 'reg', reg: R_MVOLR, value: 0x7f, comment: 'MVOLR = R master full +ve (reset 0x9C inverts)' },
  { kind: 'reg', reg: R_EVOLL, value: 0x00, comment: 'EVOLL = echo L off (reset 0x9F negative)' },
  { kind: 'reg', reg: R_EVOLR, value: 0x00, comment: 'EVOLR = echo R off (reset 0x9C negative)' },
  { kind: 'reg', reg: R_EON, value: 0x00, comment: 'EON   = echo off (reset 0x67)' },
  { kind: 'reg', reg: R_ESA, value: 0x00, comment: 'ESA   = echo source address 0' },
  { kind: 'reg', reg: R_EDL, value: 0x00, comment: 'EDL   = echo delay 0 (reset 0x4E)' },
  { kind: 'reg', reg: R_ENDX, value: 0x00, comment: 'ENDX  = noise off (reset 0xFF = all noise)' },
  { kind: 'reg', reg: R_FLG, value: 0x00, comment: 'FLG   = flags clear (reset 0x00)' },
  { kind: 'reg', reg: V_VOLL0, value: 0x7f, comment: 'VOLL0 = voice 0 L volume max (reset 0x45)' },
  { kind: 'reg', reg: V_VOLR0, value: 0x7f, comment: 'VOLR0 = voice 0 R volume max (reset 0x8B inverts)' },
  { kind: 'reg', reg: V_PITCHL0, value: 0x00, comment: 'PITCHL0 = pitch low byte (base)' },
  { kind: 'reg', reg: V_PITCHH0, value: 0x10, comment: 'PITCHH0 = 0x10 → t_pitch 0x1000 = 1.0× (reset 0x9A)' },
  { kind: 'reg', reg: V_SRCN0, value: 0x00, comment: 'SRCN0 = source 0 (reset 0xE4 is out of range)' },
  { kind: 'reg', reg: V_ADSR0_0, value: 0x00, comment: 'ADSR0_0 = GAIN mode (bit7 clear; reset 0x82 = ADSR)' },
  { kind: 'reg', reg: V_ADSR1_0, value: 0x00, comment: 'ADSR1_0 = rate 0 (unused in GAIN mode)' },
  { kind: 'reg', reg: V_GAIN0, value: 0x1f, comment: 'GAIN0 = 0x1F → env 0x1F0, direct gain (reset 0x78)' },
  { kind: 'reg', reg: R_KON, value: 0x01, comment: 'KON   = voice 0 ON (LAST — S-DSP latches at KON; reset 0xC1)' },
  { kind: 'op', op: SPC_SLEEP, comment: 'SLEEP — park the SPC700; the S-DSP sustains the note' },
];

/** The register selects ($F2) and data writes ($F3) the driver performs. */
export interface DriverRegWrite {
  reg: number;
  value: number;
  comment: string;
}

export const DRIVER_REG_WRITES: DriverRegWrite[] = DRIVER_STEPS.filter(
  (s): s is { kind: 'reg'; reg: number; value: number; comment: string } => s.kind === 'reg',
);

/** Encode one step into its SPC700 bytes (0x8F uses [value, address] order). */
function encodeStep(step: DriverStep): number[] {
  if (step.kind === 'op') return [step.op];
  // Select the register in $F2, then write the value through $F3.
  return [SPC_MOV_IMM, step.reg, DSP_SELECT, SPC_MOV_IMM, step.value, DSP_DATA];
}

/**
 * Build the SPC700 driver program as a byte blob.
 *
 * Deterministic: 1 (CLRP) + 20×6 (register writes) + 1 (SLEEP) = 122 bytes.
 * @param _page the page this was requested from — kept for symmetry with the
 *              rest of the agent API; the driver content does not depend on it.
 */
export function buildDriver(_page?: PageKind): Uint8Array {
  const bytes: number[] = [];
  for (const step of DRIVER_STEPS) bytes.push(...encodeStep(step));
  return Uint8Array.from(bytes);
}

/** The driver blob's length in bytes (1 CLRP + 20 register-writes × 6 + 1 SLEEP = 122). */
export const DRIVER_BYTE_LENGTH = 1 + DRIVER_REG_WRITES.length * 6 + 1;
