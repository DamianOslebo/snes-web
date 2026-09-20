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
response, or the model emitting a malformed tool-call that Ollama can't parse)
is **retried up to 2 times** before the error surfaces — a failed step has no
side effects yet (nothing is dispatched or appended), so the retry just
re-sends the identical conversation. Aborts are never retried.

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
- **run-end** — how it stopped (`reply` / `max-turns` / `aborted`), the turn
  count, total wall time, and **per-step metrics**: `modelMs` (that step's
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

## Tool reference (28)

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
| `gfx_set_palette_color` | 5-bit RGB, index 0–15 (0 = transparent by convention) |
| `gfx_add_tile` / `gfx_set_tile_pixel` / `gfx_fill_rect` | 16×16 tile authoring (batch: `fill_rect`) |
| `gfx_set_map_entry` / `gfx_fill_map` / `gfx_set_map_grid` | the 32×32 SC0 map (`set_map_grid` takes `grid[row][col]`) |
| `gfx_export_vram` | compile the 64 KB VRAM image → registers `vram.bin` on the asm page |

**trk_*** — the music page
| tool | what it does |
| --- | --- |
| `trk_get_song` | name / tempo / orders / patterns / instruments |
| `trk_set_cell` / `trk_set_pattern` | cells; notes as number (24=C, 81=A4), name ("A4"), or null rest |
| `trk_set_tempo` / `trk_set_orders` / `trk_add_pattern` | tempo (rows/s), play order, blank pattern |
| `trk_add_instrument` | preset `lead` \| `bass` \| `noise` \| `pad` |
| `trk_preview` / `trk_stop` | browser Web Audio preview (only works while the tracker page is open) |
| `trk_export_spc` | build the SPC700 package → registers `spc.bin` **and appends the 65C816 loader glue** |

## The end-to-end recipe (what the prompt teaches the model)

Order matters — the exports append/register data, so they come **after**
`asm_set_source` (which replaces the whole source):

1. `gfx_*` — palette, tiles, SC0 map.
2. `trk_*` — author the song (or skip music).
3. `asm_set_source` — the complete 65C816 program: `.incbin "vram.bin"` +
   VRAM DMA at startup ($2108/$2118), and `JSR spc_load` if there is music
   (never `.incbin "spc.bin"` itself — the glue already includes it).
4. `gfx_export_vram` (destName `vram.bin`) and `trk_export_spc` (destName
   `spc.bin`) — both register their data file on the assembler page.
5. `asm_assemble` → fix diagnostics → repeat until clean.
6. `asm_build_rom` → `asm_run` → the ROM loads + runs in the emulator.

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
| pure SPC core (node-tested) | `src/spc/{brr,driver,layout}.ts` |
| the panel (browser-only) | `src/ui/agent-chat.ts` |
| per-page controllers | `makeAsmController` (ui/assembler.ts), `makeGfxController` (ui/graphics.ts), `makeTrackController` (ui/track.ts) |
| tests | `test/agent-{ollama,loop,tools,system,state-store}.test.ts`, `test/spc-{brr,driver}.test.ts` |
