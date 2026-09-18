# Music Tracker

Status: **complete.** The `?track=1` page and the 🎵 Music button wiring are in
place, the pure-TS track core (`src/track/*`) is tested, and the test suite is
green.

🤖 The agent panel (present on all three authoring pages) can drive this page end-to-end — see [AGENT.md](AGENT.md).

The music tracker is one new standalone page — `?track=1`, reached from the
"🎵 Music" transport button — a FamiTracker-style editor for the SNES S-DSP:

- **Pattern grid** — 32 rows × 8 channels (the S-DSP's 8 sample voices),
  multiple patterns per song.
- **Instrument rack** — procedural PCM presets (Lead, Bass, Noise, Pad) plus
  "add instrument" for more; every instrument is a mono sample the synth
  re-pitches per note.
- **Song order** — a play-order list of patterns, tempo (rows/second), loop
  on/off.
- **Live preview** — Web Audio playback (Play/Stop/Step) with a lookahead
  scheduler; songs persist to localStorage and round-trip through `.snc` JSON.

The data model is a pure-TS, node-testable module set (`src/track/*`) built the
same way as `src/gfx/*` and `src/asm/*`:

```
src/track/
  model.ts      Song/Pattern/Cell/Instrument types, note names, JSON (.snc)
  preset.ts     procedural PCM instrument samples (32,040 Hz)
  sequencer.ts  row → note-event expansion (rowToSteps / playheadToSteps),
                playhead math (advanceSong / songRowAt), and the lookahead
                window scheduler (scheduleWindow)
  synth.ts      TrackerSynth — the ONLY file that touches AudioContext
src/ui/track.ts the ?track=1 page (plain DOM, browser-only)
test/
  track-model.test.ts      note math, parsing, .snc round-trip
  track-sequencer.test.ts  event expansion, order/pattern walking, non-loop end,
                           window scheduling (cursor anchoring, ended, loop)
  track-preset.test.ts     sample shape (length, zero-boundaries, amplitude)
```

`synth.ts` and `src/ui/track.ts` are deliberately **outside the node test
suite** (node has no Web Audio); the testable scheduling logic all lives in
`sequencer.ts`.

## What it approximates, and what it is not

This is a **software approximation of the S-DSP, not the real SPC700**. The
real SNES music path (SPC700 CPU running S-DSP driver code, BRR-compressed
samples, per-voice pitch/volume/key registers, the delay line + shared 8-tap
FIR echo) is out of scope here — this page is a music *composer*, not an
emulation of SPC700 playback. The parts it mirrors faithfully:

| S-DSP fact | where it shows up |
|---|---|
| exactly **8 sample voices** (0–7) | `CHANNELS = 8` — the grid is 8 columns; one sounding voice per channel |
| **per-voice volume 0–15** (4-bit) | `Cell.vol` (VOL_MIN 0 … VOL_MAX 15) |
| pitch = 0.25×–4× the sample's base rate (P 0x0400–0x3FFF) | `synth.ts` clamps `playbackRate` to [0.25, 4] |
| key-on **re-keys** the voice; samples must start/end near zero (crackle) | `playNote` replaces the channel's voice; `preset.ts` forces `sample[0] = sample[n-1] = 0` |
| SPU rate 32,040 Hz | `PRESET_RATE = 32_040`, `makeBuffer(…, 32_040)` |

And the parts it fakes: the echo (a feedback delay + low-pass stands in for the
S-DSP delay line + FIR) and a light convolver "reverb" the S-DSP doesn't have.

## Note numbering (FamiTracker convention)

`0 = C-2 … 24 = middle C (octave 0, rendered bare "C") … 81 = A4 (440 Hz) …
119 = B7`. `noteToFreq(n) = 440 · 2^((n−81)/12)`. The grid input accepts
`A4`, `C#2`, `b4`, a bare letter (middle-C row), and `--` / `R` / `rest` for a
rest; anything out of 0–119 is rejected.

## Scheduling (the page, `src/ui/track.ts`)

Standard lookahead scheduler over the pure core — the windowing math lives in
`scheduleWindow` (sequencer.ts), so the page only feeds it the clock:

1. **Play** (a user gesture) calls `synth.resume()` — this both satisfies the
   autoplay rules and lazily builds the AudioContext graph + sample buffers.
   The song then starts at `startAt = now + 50 ms` (a short lead-in) with the
   scheduler cursor at the first row.
2. A 25 ms `setInterval` tick calls `scheduleWindow(song, tempo, cursor,
   until, now + 300 ms, loop)`, which expands the rows starting at the cursor
   whose slots fall within the horizon and hands back the new cursor/`until`.
   The key rule: **each row is anchored to its OWN slot in the song** — the
   first at `until`, the next at `until + 1/tempo`, and so on — not to `now`
   at schedule time. Feeding the returned cursor/`until` back in therefore
   plays at true tempo with no gaps and no double-scheduling, whatever the
   tick cadence. (Anchoring the window to `now` on every tick instead is the
   classic mistake: it races the song through at ~`lookahead ÷ tickInterval`
   times its tempo — 300 ms ÷ 25 ms ≈ 12× — with overlapping notes.)
3. Events go to `synth.playNote(step, when)` with **absolute AudioContext
   time** (`s.at` from the window). A new note on a channel re-keys it: the
   channel's previous voice is released **at the new voice's start time** with
   a 20 ms fade (`RELEASE_S`) — never at the schedule moment. With a lookahead
   scheduler, cutting a replaced voice at schedule time kills it before it has
   sounded (any song whose notes sit closer together than the lookahead would
   play silent), and a bare `stop()` leaves a click; releasing at the note's
   own time is exactly the S-DSP's key-on semantics. Stop/Step use the same
   fade, so there are no hard cuts.
4. Non-loop songs stop when `scheduleWindow` reports the last row of the last
   order entry was scheduled (`ended`); `advanceSong` returns `null` there
   instead of wrapping.
5. **Step** auditions one row at the playhead and advances it one row — for
   row-by-row writing without starting the whole song.
6. **Playhead highlight** — while playing, the grid lights the row currently
   *sounding*: `k = floor((now − startAt) · tempo)` rows have elapsed since
   row 0, and `songRowAt(song, k)` (sequencer.ts) maps k back to the order
   entry and row. It tracks the synth clock (not the scheduler cursor, which
   runs 300 ms ahead) and only highlights rows of the pattern on screen.

## The `.snc` format

`.snc` is JSON (`TRACK_VERSION = 1`):

```jsonc
{
  "v": 1,
  "name": "Demo Song",
  "tempo": 8,                   // rows per second (8 ≈ 120 BPM at 4 rows/beat)
  "orders": [0, 0, 1, 1],       // pattern indices, in play order
  "patterns": [                 // [pattern][row][channel] = [note|null, inst, vol]
    [[ [null,0,12], … ×8 channels ], … ×32 rows ]
  ],
  "instruments": [              // order = the rack
    { "id": "lead", "name": "Lead", "baseFreq": 220, "loop": true,
      "sample": [0.0, …] }      // mono PCM in −1…1, 32,040 Hz
  ]
}
```

`fromJSON` is strict: every pattern must have the same row count, every row
exactly 8 cells, note numbers clamped to 0–119, instrument indices clamped to
the rack, and at least one instrument and one order. The page persists the
current song to `localStorage["snes-web:track-song:v1"]` (debounced 400 ms)
and reloads it on open; "Reset demo" restores the built-in A-minor demo.

## Wiring

- `src/ui/app.ts` — the 🎵 Music transport button (`ui.trackBtn`), always
  visible like the other tool buttons.
- `src/main.ts` — the `?track=1` route (boots no core/audio, like `?gfx=1`)
  and the button handler. "← Emulator" strips the param and reboots the app.
