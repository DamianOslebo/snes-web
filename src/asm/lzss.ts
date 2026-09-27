/**
 * `lzss` — a dependency-free flag-byte LZSS (LZ77) codec for shrinking the
 * asset blobs the ROM toolchain embeds (`vram.bin`, `spc.bin`) via `.incbin`.
 *
 * **Why:** both `gfx_export_vram` and `trk_export_spc` bake raw asset bytes
 * into the 256 KB SFC, and that data counts against the hard
 * `MAX_CODE = 0x7FB0` (~32 KB) code+data budget in `src/asm/rom.ts`. Tile
 * graphics (repeating rows) and BRR samples (looping ADPCM-ish patterns) are
 * highly compressible, so compressing the blob in JS at build time and
 * decompressing it at runtime in the ROM frees that budget for more art/music.
 *
 * **House precedent:** `src/spc/brr.ts` ships a BRR encoder *and* a reference
 * decoder in one module, proven by a round-trip test. This module does the
 * same: `lzssCompress` (build-time, in JS) + `lzssDecompress` (a reference
 * mirror of the 65C816 routine) + the generated `lz_decode` glue. The
 * round-trip test (`test/lzss.test.ts`) proves the compressor and the reference
 * decoder agree; the real-core test (`test/lzss-core.test.ts`) proves the
 * *65C816* decoder agrees by reading the decompressed WRAM back on snes9x.
 *
 * **The byte format** (documented here, consumed by all three):
 *
 * ```
 *   offset  size  field
 *   0x00    4     magic = 4C 5A 53 31  ("LZSS")
 *   0x04    2     uncompressed length, little-endian (0x0001..0xFFFF; 0 = empty)
 *   0x06    …     token stream
 * ```
 *
 * Token stream = a **flag byte** `F`, then for each bit `b` of `F` from
 * bit 0 → bit 7:
 *   - `F & (1 << b)` **set**   → LITERAL: the next 1 byte is copied verbatim.
 *   - `F & (1 << b)` **clear** → COPY: the next 3 bytes are `[off_lo, off_hi, len]`;
 *     `offset = off_lo | off_hi<<8` (1..65535, ≤ bytes produced so far),
 *     `len` (2..255). Copy `len` bytes from `out_pos − offset` to `out_pos`,
 *     forward and overlapping (safe because offset ≥ 1 ⇒ source < dest).
 *
 * A flag byte precedes its 8 tokens. The stream ends exactly when
 * `uncompressed length` bytes have been emitted (the length field terminates
 * it — there is no end marker). Window 65535, max match 255.
 */

import { assemble } from './assembler';

/** The 4-byte stream magic, "LZSS". */
export const LZSS_MAGIC: readonly number[] = [0x4c, 0x5a, 0x53, 0x31];

/**
 * The WRAM scratch buffer the 65C816 `lz_decode` expands into. $0200 (bank $00,
 * PHB=$00 in 8-bit mode) maps to `Memory.RAM[0x200]` (MAP_SYSTEM: banks
 * $00–$3F, offset $0000–$1FFF → WRAM) and is DISJOINT from the ROM code
 * (bank $00, offset $8000+) and the `.incbin` blob (bank $00, offset $8xxx).
 * The tests read it back via `core.readMem(0x7e, 0x0200, n)` (bank $7E is the
 * same `Memory.RAM`, MAP_WRAM).
 */
export const LZ_SCRATCH = 0x0200;
const LZ_SCRATCH_LO = LZ_SCRATCH & 0xff;       // 0x00
const LZ_SCRATCH_HI = (LZ_SCRATCH >> 8) & 0xff; // 0x02

/**
 * The assembled byte size of `lz_decode`, MEASURED by assembling the glue
 * (the source of truth, not an estimate). Falls back to a conservative
 * over-estimate if the glue can't be assembled — over-charging keeps the
 * fallback rule safe (it will simply prefer the raw path).
 */
let _routineBytes = 255;
{
  const r = assemble(lzssGlue(), 0x008000);
  if (r.ok) _routineBytes = r.bytes.length;
}
export const LZ_ROUTINE_BYTES = _routineBytes;

/**
 * The net per-asset glue overhead of the LZ path vs the raw path: the
 * decompress preamble (`lzDecodeCall` + `lzRepoint`, 28 bytes) minus the raw
 * pointer preamble it replaces (9 bytes) = ~19, rounded UP to 24 for a safety
 * margin. Over-charging is the safe direction — it only ever biases the
 * fallback rule back toward the raw path, never toward a larger ROM.
 */
export const LZ_GLUE_EXTRA = 24;

const h = (n: number): string => '$' + (n & 0xff).toString(16).padStart(2, '0');

// --- the compressor (build-time, JS) ----------------------------------------

/**
 * Compress `input` to the flag-byte LZSS format above. Hash-chain on 2-byte
 * prefixes, greedy: for each position, take the best match of length ≥
 * `MIN_MATCH` found among a bounded candidate set, else emit a literal. The
 * output is ALWAYS a valid stream (every emitted copy is verified and in
 * window), never just an approximation — the search bound only affects
 * *ratio*, not correctness.
 */
export function lzssCompress(input: Uint8Array): Uint8Array {
  const n = input.length;
  const out: number[] = [];
  out.push(LZSS_MAGIC[0], LZSS_MAGIC[1], LZSS_MAGIC[2], LZSS_MAGIC[3]);
  out.push(n & 0xff, (n >> 8) & 0xff);
  if (n === 0) return Uint8Array.from(out);

  const HASH_BITS = 15;
  const MASK = (1 << HASH_BITS) - 1;
  const head = new Int32Array(1 << HASH_BITS).fill(-1); // head[h] = newest pos w/ prefix-hash h
  const prev = new Int32Array(n).fill(-1);              // prev[p] = older pos sharing p's chain slot
  const MAX_WINDOW = 65535;
  const MAX_MATCH = 255;
  const MIN_MATCH = 4;   // copies < 4 bytes cost more than literals (3-byte token overhead)
  const CANDIDATES = 8;  // bounded search: ratio-only, not a correctness bound

  const hOf = (i: number): number => ((input[i] << 5) ^ (input[i + 1] & 0xff)) & MASK;

  let i = 0;
  while (i < n) {
    let flag = 0;
    const payload: number[] = [];
    for (let b = 0; b < 8; b++) {
      if (i >= n) break;
      const tokenStart = i;
      // Best verified back-reference at `i` (offset ≤ bytes already emitted).
      let bestLen = 0;
      let bestOff = 0;
      if (i + 1 < n) {
        let cand = head[hOf(i)];
        let checked = 0;
        while (cand !== -1 && checked < CANDIDATES) {
          const off = i - cand;
          if (off >= 1 && off <= MAX_WINDOW) {
            let len = 0;
            const maxLen = Math.min(MAX_MATCH, n - i);
            while (len < maxLen && input[cand + len] === input[i + len]) len++;
            if (len > bestLen) {
              bestLen = len;
              bestOff = off;
              if (len === maxLen) break; // cannot extend further
            }
          }
          cand = prev[cand];
          checked++;
        }
      }
      if (bestLen >= MIN_MATCH) {
        payload.push(bestOff & 0xff, (bestOff >> 8) & 0xff, bestLen);
        i += bestLen;
      } else {
        flag |= 1 << b;
        payload.push(input[i]);
        i++;
      }
      // Register every position just consumed so later positions can match it.
      for (let p = tokenStart; p < i && p + 1 < n; p++) {
        const hh = hOf(p);
        prev[p] = head[hh];
        head[hh] = p;
      }
    }
    out.push(flag, ...payload);
  }

  return Uint8Array.from(out);
}

// --- the reference decompressor (mirror of the 65C816 routine) --------------

/**
 * Decompress a flag-byte LZSS stream. A byte-for-byte behavioural mirror of
 * the generated `lz_decode` (the BRR house pattern): the round-trip test
 * asserts `lzssDecompress(lzssCompress(x)) === x`, and the real-core test
 * asserts the 65C816 `lz_decode` produces the same bytes in WRAM. Throws on a
 * malformed stream (bad magic, over-read, zero offset) rather than guessing.
 */
export function lzssDecompress(stream: Uint8Array): Uint8Array {
  if (stream.length < 6) throw new Error('lzss: stream too short');
  for (let k = 0; k < 4; k++) {
    if (stream[k] !== LZSS_MAGIC[k]) throw new Error('lzss: bad magic');
  }
  const total = stream[4] | (stream[5] << 8);
  const out = new Uint8Array(total);
  let src = 6;
  let dst = 0;
  if (total === 0) return out;
  let flag = stream[src++];
  let bits = 0;
  while (dst < total) {
    if (bits === 8) {
      if (src >= stream.length) throw new Error('lzss: unexpected end of stream');
      flag = stream[src++];
      bits = 0;
    }
    if (flag & (1 << bits)) {
      if (src >= stream.length) throw new Error('lzss: unexpected end of stream (literal)');
      out[dst++] = stream[src++];
    } else {
      if (src + 3 > stream.length) throw new Error('lzss: unexpected end of stream (copy)');
      const off = stream[src] | (stream[src + 1] << 8);
      const len = stream[src + 2];
      src += 3;
      if (off < 1) throw new Error('lzss: zero offset');
      for (let k = 0; k < len; k++) {
        out[dst] = out[dst - off];
        dst++;
      }
    }
    bits++;
  }
  return out;
}

// --- the 65C816 decoder glue -------------------------------------------------

/**
 * The `lz_decode` routine, emitted once per ROM (via `upsertGlue(c,'lz',…)`).
 *
 * Pure 8-bit mode — **no REP/SEP, no PEX, no 16-bit A/X/Y** — so it uses only
 * the repo assembler's opcode table (proven by `test/lzss-glue.test.ts`). The
 * caller (the asset glue) sets `$40/$41` = the embedded blob and `$42/$43` =
 * `LZ_SCRATCH`, then `jsr lz_decode`. Zero-page scratch `$40–$4c` is disjoint
 * from spc (`$10–$17`), vram (`$20–$2a`), and oam (`$30/$31`) glue.
 *
 * **Branch-range discipline:** the 65C816's conditional branches are 8-bit
 * relative only (±127). So every *conditional* branch (done-check, literal/copy
 * dispatch, loop back-edges) is kept short — "done" is a fall-through `rts`
 * or an adjacent `beq`, never a long forward jump — and the single long
 * loop-back (re-entering the token loop after loading a fresh flag byte) uses
 * `BRL` (0x82, 16-bit unconditional, in the repo's opcode table; no
 * REP/SEP dependence, safe in 8-bit mode). This is why the routine reads a
 * fresh flag byte at the BOTTOM of the loop rather than the top: it lets the
 * per-token done-check be a short `bne` to the loop and the completion `rts`
 * a fall-through, so it reads exactly `ceil(tokens/8)` flag bytes and never
 * over-reads past the `.incbin` blob (which would otherwise read into whatever
 * follows it in the ROM).
 */
export function lzssGlue(): string {
  return `;=== LZSS_DECODE_GLUE (generated) ===
; lz_decode: expand the flag-byte LZSS stream at [\$40/\$41] into [\$42/\$43].
;   Stream: 4B magic "LZSS" + 2B LE length + token stream (flag byte, bit0
;   first: set=1 literal byte, clear=3-byte copy [off_lo,off_hi,len]). Stops
;   when \`length\` bytes are out. Pure 8-bit mode; ZP scratch \$40-\$4c only.
lz_decode:
  ldy #0
  ; ---- skip the 4-byte magic ----
  ldx #4
lz_skip:
  inc $40
  bne lz_skip_a
  inc $41
lz_skip_a:
  dex
  bne lz_skip
  ; ---- read the 16-bit uncompressed length (LE) into \$48/\$49 ----
  lda ($40),Y
  sta $48
  inc $40
  bne lz_len_a
  inc $41
lz_len_a:
  lda ($40),Y
  sta $49
  inc $40                ; advance past length-hi too — else lz_go re-reads it as the flag
  bne lz_len_b
  inc $41
lz_len_b:
  lda $48                ; empty stream (length 0) → nothing to decode
  ora $49
  bne lz_go              ; non-empty → set up and run the token loop (short)
  rts                    ; empty → done (fall-through)
lz_go:
  ; ---- read the first flag byte ----
  lda ($40),Y
  inc $40
  bne lz_fl
  inc $41
lz_fl:
  sta $47
  ldx #8                 ; bits-left
lz_loop:
  lda $48                ; out_total == 0 → done (fall-through)
  ora $49
  bne lz_tok
  rts
lz_tok:
  lsr $47                ; bit0 → carry
  bcs lz_lit
  ; ---- COPY: [off_lo, off_hi, len] ----
  lda ($40),Y
  inc $40
  bne lz_cpa
  inc $41
lz_cpa:
  sta $4b                ; off_lo
  lda ($40),Y
  inc $40
  bne lz_cpb
  inc $41
lz_cpb:
  sta $4c                ; off_hi
  lda ($40),Y
  inc $40
  bne lz_cpc
  inc $41
lz_cpc:
  sta $46                ; len
  ; out_total -= len. MUST run BEFORE the copy loop, because that loop DECs $46
  ; down to 0 ($46 is the loop counter). Subtracting afterwards would read $46==0
  ; and never decrement the counter: every copy would advance the destination but
  ; not count, so the done-check (out_total==0) would never fire and the routine
  ; would loop forever, running off the end of the stream.
  lda $48
  sec
  sbc $46
  sta $48
  lda $49
  sbc #0
  sta $49
  ; copy source = dst - offset
  sec
  lda $42
  sbc $4b
  sta $44                ; csrc lo
  lda $43
  sbc $4c
  sta $45                ; csrc hi
lz_cpy:
  lda ($44),Y
  sta ($42),Y
  inc $44
  bne lz_cpya
  inc $45
lz_cpya:
  inc $42
  bne lz_cpyb
  inc $43
lz_cpyb:
  dec $46
  bne lz_cpy
  bra lz_post
lz_lit:
  ; ---- LITERAL ----
  lda ($40),Y
  sta ($42),Y
  inc $40
  bne lz_lita
  inc $41
lz_lita:
  inc $42
  bne lz_litb
  inc $43
lz_litb:
  ; out_total -= 1. Must be carry-based (like the copy path's sbc), because a
  ; "dec lo; bne skip; dec hi" idiom is WRONG here: dec sets Z on result==0,
  ; which fires for lo=1 (no high-byte borrow needed) and NOT for lo=0 (borrow
  ; needed) -- exactly inverted, so the counter drifts by 256 on every page
  ; wrap and the loop runs a wrong number of tokens.
  sec
  lda $48
  sbc #1
  sta $48
  lda $49
  sbc #0
  sta $49
lz_post:
  dex
  bne lz_loop            ; more bits in this flag byte → next token (short)
  ; flag exhausted — check completion, then load the next flag
  lda $48
  ora $49
  bne lz_nextflag
  rts                    ; out_total hit 0 exactly on a flag boundary
lz_nextflag:
  lda ($40),Y
  inc $40
  bne lz_fl2
  inc $41
lz_fl2:
  sta $47
  ldx #8
  brl lz_loop            ; loop back (16-bit: spans past the ±127 window)
;=== /LZSS_DECODE_GLUE ===
`;
}

/**
 * The 65C816 preamble an asset glue emits to decompress ITS embedded blob:
 * load the data label into `$40/$41` (src), set `$42/$43` = `LZ_SCRATCH`
 * (dst), then `jsr lz_decode`. Follow it with `lzRepoint(lo,hi)` to re-point
 * the asset's own data walker at the decompressed buffer.
 */
export function lzDecodeCall(dataLabel: string): string {
  return (
    `  pea ${dataLabel}\n` +
    `  pla\n` +
    `  sta $40                  ; lz src lo\n` +
    `  pla\n` +
    `  sta $41                  ; lz src hi\n` +
    `  lda #${h(LZ_SCRATCH_LO)}     ; lz dst lo (LZ_SCRATCH)\n` +
    `  sta $42\n` +
    `  lda #${h(LZ_SCRATCH_HI)}     ; lz dst hi (LZ_SCRATCH)\n` +
    `  sta $43\n` +
    `  jsr lz_decode            ; expand the embedded blob into WRAM scratch\n`
  );
}

/**
 * The 65C816 lines that re-point an asset's data walker (its `loZp`/`hiZp`
 * pointer) at the decompressed `LZ_SCRATCH` buffer, to be emitted right after
 * `lzDecodeCall`.
 */
export function lzRepoint(loZp: string, hiZp: string): string {
  return (
    `  lda #${h(LZ_SCRATCH_LO)}     ; data ptr lo -> decompressed buffer\n` +
    `  sta ${loZp}\n` +
    `  lda #${h(LZ_SCRATCH_HI)}     ; data ptr hi\n` +
    `  sta ${hiZp}\n`
  );
}
