# AI Agent Chat (Ollama) — setup & reference

Status: **complete** (pure agent core + SPC core fully tested; the panel is
browser-only, verified by typecheck + build + the loop's node tests).

One shared 🤖 chat panel, mounted on **all three** authoring pages
(`?asm=1`, `?gfx=1`, `?track=1`), backed by an **Ollama function-calling
endpoint**. The agent drives **all three pages from any one of them** — each
page's state lives in localStorage and every controller reads/writes it, so
edits to the graphics or tracker from the assembler page (or vice versa) just
work and re-render the page when it's on screen.

## Setup

1. **Install Ollama** and a tool-calling model (any that supports function
   calling — e.g. `qwen2.5:14b-instruct`, `llama3.1:8b-instruct`):
   ```sh
   ollama serve                      # default: http://127.0.0.1:11434
   ollama pull qwen2.5:14b-instruct
   ```
2. **Open a page** (`?asm=1` is the natural starting point), expand the 🤖
   panel (bottom-right), and press **Test** with the endpoint
   (`http://127.0.0.1:11434` is the default) — the installed models load into
   the dropdown. Endpoint + model persist in `localStorage["snes-web:agent:v1"]`.
3. **From a phone / LAN IP**, Ollama must allow the page's origin or the
   browser's CORS preflight fails with a generic network error. Run Ollama with:
   ```sh
   OLLAMA_ORIGINS=http://<page-host>:<page-port> ollama serve
   ```
   (e.g. `OLLAMA_ORIGINS=http://10.0.2.2:5173`). The panel shows this hint
   whenever "Test" can't reach the server.

## What a turn does

Non-streaming by design: one send = one agent loop of `POST /api/chat` steps.
Each step the model may request tools; the panel shows a tool chip per call
(arguments expandable, result expandable), a thinking indicator, and the final
reply. **Stop** aborts the in-flight request.

A step that Ollama rejects for a transient reason (a 5xx, a dropped tunnel
response, **the response stream ending mid-answer** — Ollama never sent its
`done` chunk, so the reply was cut off in transit — or the model emitting a
malformed tool-call that Ollama can't parse) is **retried up to 12 times**
before the error surfaces — a failed step has no side effects yet (nothing is
dispatched or appended), so the retry just re-sends the identical conversation.
A permanent rejection (a 4xx like a
404 "model not found") is *not* retried — it fails fast on the first attempt
with an actionable message. Aborts are never retried.

**A half answer is never an answer.** Two guards make sure a truncated tool
call can never be mistaken for the model finishing:

- **Stream completeness** — Ollama ends every clean stream with a final
  `{"done": true}` chunk. A stream that simply *ends* without it had its tail
  dropped (tunnel/server close), so it is a retryable step failure, never a
  successful reply.
- **The reply itself** — a reply whose JSON is cut off mid-flight (an
  unbalanced opening bracket — `[{"`, `[{"tool`, `{"tile":3,…`) is
  classified as a malformed tool call and gets the "reply with ONE valid JSON
  object" nudge, bounded like any other malformed episode. A genuine prose
  summary never trips either check.

## Step budget — it keeps working instead of making you type "continue"

A real task is more than a handful of steps, so a single step **cap** is not a
stop. Each send runs with a **per-batch checkpoint** (`maxTurns`, default 14):
when the model has been acting for that many steps without replying, the loop
doesn't end — it re-anchors it with a short "you're not done, keep going" nudge
and continues. That removes the old "Stopped at the 14-step limit → send
'continue'" dance: a mid-task checkpoint is transparent to you.

What actually **ends** a run:

- the model sends a real text reply (it's done) — *unless* it is a
  "narration stall" (it described work but called no tool; see below),
- the **total step budget** (`totalTurns`, default 150) is spent — the run
  stops as `max-turns` and the panel offers "continue" to buy more steps,
- a **spin** — the same step producing the same result with nothing changing
  (3× in a row, or an A-B-A-B cycle). Legitimate repeats that *do* change
  state (add a tile, then assemble…) never trip this, because the results
  differ and so does the step signature,
- **Stop** (you abort) — always wins, and is never auto-continued.

To restore the old hard stop, set `totalTurns` equal to `maxTurns`.
"continue" still works at any stop: it re-runs the loop over the existing
history, so a budget-ended task picks up where it left off.

## No stalling after narrating ("Now I'll build the tiles…")

Field logs showed the model replying with the *next step* — "Now I'll build
the letter tiles. Let me start…" — while calling **no tool**. That used to
end the run as if it were done (`turns: 0`), and the only way to make it do
the work it described was to type "continue". Forward-looking intent replies
("I'll…", "let me…", "about to…") that carry no tool call now get **one
nudge**: "you described the next step but did not call a tool — call it
now". If the model then calls a tool, the run proceeds, and the stall streak
resets (so a later mid-task narration gets its own nudge). A *second
consecutive* stall — two tool-less "I'll…" replies back to back — stops the
run with a visible note. Bounded, never loops. A genuine completion
("the ROM is built", "done") never matches the intent pattern, so it stops
immediately with no extra round-trip.

## Thinking (per-step latency)

The panel's **Thinking** control sends Ollama's `think` field with every
`/api/chat` step (persisted in `snes-web:agent:v1`):

- **Off** (default) → `think: false` — skips the model's reasoning phase.
  This is the biggest per-step speedup; thinking tokens are seconds-to-minutes
  of extra generation on large models and are the usual culprit behind
  tunnel/origin timeouts (a Cloudflare 524) and flaky tool-call parsing.
- **On** → `think: true` — force reasoning even if the model defaults off.
- **Auto** → the field is omitted; the model's default applies (Qwen3 models
  think **on** by default — expect slow steps over a tunnel).

**Off is the default** (as of the one-time migration): a panel configured
before the Thinking control existed stored the legacy default `auto` —
thinking ON on Qwen3-style models, which is exactly the failure mode. On
first load after the change, that legacy `auto` is silently flipped to
`off` (the stored object is stamped `v: 1`). An `on`/`off` you chose
explicitly before the migration, or an `auto` chosen after it, is always
respected verbatim.

Qwen3-style models are on/off only — Ollama's token-budget form of `think`
applies to a different model family. If steps still time out over a tunnel,
raise cloudflared's `originResponseTimeoutSeconds` (default is 100 s) and set
`OLLAMA_KEEP_ALIVE=3600` so the model stays loaded between steps.

## One conversation across all three pages

The panel's tabs (**65C816 · 🎨 Graphics · 🎵 Music**) switch between the
authoring pages — this is the *only* navigation the panel does, and it is
always **you** clicking it (the agent itself never navigates; the other
sanctioned navigation is `asm_run`'s handoff to the emulator).

The conversation is shared: the message history — the exact context sent to
Ollama — is persisted to `localStorage["snes-web:agent-conversation:v1"]`
after every send and turn, and restored on every page mount. So:

- Switching pages keeps the **same context** (the per-page system prompt
  still updates to the page you're on; the chat history continues).
- A mid-turn reload is safe: a dangling tool call is dropped on restore, and
  the history ends at your last message — send "continue" to pick up.
- **↺ New** clears the conversation only (your code/graphics/music pages are
  kept).

## Log, export & metrics

The panel keeps a timestamped journal of what actually happened, separate from
the conversation (which is what gets sent to Ollama). Per send it records:

- **run-start** — the settings snapshot: page, endpoint, model, Thinking mode;
- **user** — your prompt;
- **tool-call** / **tool-result** — every tool the model requested, its
  arguments (kept whole), and the result it got back;
- **assistant** — the model's reply;
- **error** — a surfaced failure (e.g. the exact Ollama 500 text, a CORS
  error) and the phase it happened in;
- **run-end** — how it stopped (`reply` = done; `max-turns` = the total step
  budget was spent; `loop` = a spin was detected; `aborted` = you hit Stop),
  the turn count, total wall time, and **per-step metrics**: `modelMs` (that step's
  `/api/chat` round trip, including any retries), `retries`, `retryErrors`
  (the failed attempt(s) that recovered — e.g. the XML-syntax error),
  `toolCalls`, and `toolMs` (controller dispatch time).

The journal is capped (newest 400 entries), long free-text fields are
truncated to 2000 chars, and it is persisted to
`localStorage["snes-web:agent-log:v1"]` (oldest entries drop first; if storage
is over quota the newest tail is kept). It survives page switches and reloads,
so you can gather a full session's worth across all three pages.

Two buttons next to **↺ New**:

- **⬇ Log** — downloads `snes-agent-log-<timestamp>.json`: pretty-printed,
  self-describing (app, schema, your browser user-agent, created/exported
  times, entry count, then the entries). This is the file to share when
  something misbehaves — it carries the exact error text, the per-step
  latencies, and the retry trail.
- **🧹** — clears the journal only (conversation and pages are kept).

## Tool reference (34)

**asm_*** — the assembler page
| tool | what it does |
| --- | --- |
| `asm_get_source` / `asm_set_source` / `asm_append_source` | read / replace / append the 65C816 source |
| `asm_list_data_files` / `asm_add_data_file` / `asm_remove_data_file` | the `.incbin` data-file map (manual files ≤ 64 KB, hex or base64) |
| `asm_assemble` | assemble; per-line diagnostics on failure — the fix/retry loop |
| `asm_build_rom` | build the 256 KB LoROM SFC (cart header at $7FB0 included) |
| `asm_run` | hand the ROM to the emulator (▶) — the sanctioned navigation |

**gfx_*** — the graphics page
| tool | what it does |
| --- | --- |
| `gfx_get_state` | mode / tile count / map cells set |
| `gfx_set_palette_color` | 5-bit RGB, index 0–15 background **or 16–31 OBJ (sprite)** — index 0 = transparent by convention |
| `gfx_add_tile` / `gfx_set_tile_pixel` / `gfx_fill_rect` | 16×16 tile authoring (batch: `fill_rect`) |
| `gfx_set_map_entry` / `gfx_fill_map` / `gfx_set_map_grid` | the 32×32 SC0 map (`set_map_grid` takes `grid[row][col]`) |
| `gfx_set_alt_map_entry` / `gfx_fill_alt_map` / `gfx_set_alt_map_grid` | the SECOND (ALT) 32×32 SC0 map — authoring it is what activates the `vram_toggle` service routine on export (caps/uncap flips) |
| `gfx_set_oam_entry` | place/update one SPRITE slot 0–127 (`slot/tile/x/y`, `flipH/flipV`, `priority` 0–3; `hide:true` removes it) — see Sprites below |
| `gfx_clear_oam` | hide all 128 sprite slots (start clean) |
| `gfx_export_vram` | compile the **compact** VRAM image (used palette + tiles + tilemap, a few KB) → registers `vram.bin` on the asm page **and appends the `vram_load` bring-up glue** (plus `vram_toggle` + `pad_read` when an ALT map is set; idempotent — re-running replaces the block, never duplicates it) |
| `gfx_export_oam` | compile the 128-slot OAM table (512 bytes) → registers `oam.bin` **and appends the `oam_load` glue with the chosen GLOBAL size baked into OBJSEL** (`size` "8x8" or "16x16", default "16x16"; idempotent — re-exporting switches the size, never duplicates `oam_load`) |

**trk_*** — the music page
| tool | what it does |
| --- | --- |
| `trk_get_song` | name / tempo / orders / patterns / instruments |
| `trk_set_cell` / `trk_set_pattern` | cells; notes as number (24=C, 81=A4), name ("A4"), or null rest |
| `trk_set_tempo` / `trk_set_orders` / `trk_add_pattern` | tempo (rows/s), play order, blank pattern |
| `trk_add_instrument` | preset `lead` \| `bass` \| `noise` \| `pad` |
| `trk_preview` / `trk_stop` | browser Web Audio preview (only works while the tracker page is open) |
| `trk_export_spc` | build the SPC700 package → registers `spc.bin` **and appends the `spc_load` 65C816 loader glue** (idempotent — re-running replaces the block, never duplicates it) |

## The end-to-end recipe (what the prompt teaches the model)

The program is **tiny** — the model never hand-rolls PPU setup, VRAM DMA,
OAM writes, or SPU port writes. The export tools generate self-contained
65C816 routines (`vram_load`, `oam_load`, `spc_load`) and append them; the
program just calls them:

```
reset:
  jsr vram_load        ; PPU bring-up + VRAM fill (glue from gfx_export_vram)
  ; jsr oam_load       ; sprite table + OBJ layer (glue from gfx_export_oam) — only if sprites
  ; jsr spc_load       ; SPC700 loader (glue from trk_export_spc) — only if music
idle:
  bra idle
```

Order matters — the exports **append** glue, so they come **after**
`asm_set_source` (which replaces the whole source, wiping any appended glue):

1. `gfx_*` — palette, tiles, SC0 map; for a **second screen** author the ALT
   map too (`gfx_set_alt_map_*`); for **sprites** paint the sprite char(s),
   set the OBJ palette colors (indices 16–31), and place each with
   `gfx_set_oam_entry` (skip what you don't need).
2. `trk_*` — author the song (skip if no music).
3. `asm_set_source` — the minimal reset program above (`jsr vram_load` if
   graphics, `jsr oam_load` right after it if sprites, `jsr spc_load` if
   music; nothing else).
4. `gfx_export_vram` (destName `vram.bin`), `gfx_export_oam` (destName
   `oam.bin`, size "8x8" or "16x16" — the ONE size every sprite draws at),
   and `trk_export_spc` (destName `spc.bin`) — each compiles its image,
   registers the data file, **and appends its loader glue** (all idempotent,
   so re-running after a later `asm_set_source` restores the glue without
   duplicating a label).
5. `asm_assemble` → fix diagnostics → repeat until clean.
6. `asm_build_rom` → `asm_run` → the ROM loads + runs in the emulator.

The safest clean-slate sequence after any program edit is:
`asm_set_source` → (gfx_export_vram) → (gfx_export_oam) → (trk_export_spc)
→ `asm_assemble`.

## Sprites (the OBJ layer) — scope & limits

- **What it is**: 128 OAM slots (standard 4 bytes each: HPos, VPos, Name, attr),
  drawn from the same 8×8 chars you paint in the tile editor, coloured from the
  **OBJ palette** (`gfx_set_palette_color` indices **16–31** — index 16 = the
  sprite transparency slot). `gfx_export_oam` bakes the chosen GLOBAL size into
  OBJSEL and `oam_load` streams the table through $2104 and turns the OBJ layer
  on.
- **Two sizes, chosen ONCE per ROM** — sprite size is **global** (OBJSEL), not a
  per-slot field:
  - **8×8** (OBJSEL `$00`): one char IS the sprite; `tile` is that char's index.
  - **16×16** (OBJSEL `$60`): a 2×2 block of four 8×8 chars. `tile` is the
    **top-left char, on an even char column** (`tile % 2 == 0`). The SNES lays
    8×8 chars out **16 per row**, so the block is (tile, tile+1, tile+16,
    tile+17) — the bottom pair sits 16 below, **not 8**. Paint those four chars
    as one connected picture.
- **Priority decides visibility**: priority 0–1 draws the sprite *under* the
  background; 2–3 *over* it. With a painted background behind (almost always),
  pass `priority: 2` — the default 0 leaves the screen looking blank.
- **What it is not**: mixed sizes in one ROM; moving sprites without a re-call to
  `oam_load` (OAM is loaded once); per-sprite palettes. v1 = a character standing
  on the screen — fully supported; chasing animation is not.
- **Verification**: `test/gfx-oam.test.ts` pins the encoder bytes and the
  per-size glue text (both assemble with the real assembler into a valid
  256 KB LoROM), and — when the wasm build is present — renders a white sprite
  on the **real core** to prove the size is honoured: the same char at 8×8 in
  one ROM and 16×16 in another, same OAM slot.

## In-ROM SPU audio — scope & limits (EXPERIMENTAL)

- **What it is**: one BRR sample (a sustained looping note) + a **minimal
  hand-emitted SPC700 driver** (20 register writes via $F2/$F3, then SLEEP) +
  the Appendix D data-transfer handshake from the 65C816 side. Grounded in
  `core/snes9x-2010/core/apu.c` and the SNES manual book 1 (Appendix D +
  S-DSP register map); every byte pinned by `test/spc-*.test.ts`.
- **What it is not**: not an SPC700 emulator, not a sequencer — the S-DSP
  sustains one looping voice; the SPC700 CPU parks in SLEEP. Multi-voice
  songs / note sequencing are out of v1 scope.
- **Verification is by ear on real hardware**: the in-browser mock core has no
  SPU, so CI can't hear it. Stage it: (a) does the sustained note play after
  `asm_run`? (b) if not, the debug surface is the driver blob (122 bytes) and
  the $2140–$2143 handshake — both byte-inspectable in the tests.

## Files

| area | where |
| --- | --- |
| pure agent core (node-tested) | `src/agent/{types,ollama,tools,loop,system,state-store}.ts` |
| OAM (sprite) core (node-tested) | `src/gfx/oam.ts` — 128-slot table, OBJSEL per size, `oam_load` glue |
| pure SPC core (node-tested) | `src/spc/{brr,driver,layout}.ts` |
| the panel (browser-only) | `src/ui/agent-chat.ts` |
| per-page controllers | `makeAsmController` (ui/assembler.ts), `makeGfxController` (ui/graphics.ts), `makeTrackController` (ui/track.ts) |
| tests | `test/agent-{ollama,loop,tools,system,state-store}.test.ts`, `test/gfx-oam.test.ts` (incl. real-core sprite-size render), `test/spc-{brr,driver}.test.ts` |
