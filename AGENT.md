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
reply. **Stop** aborts the in-flight request. The panel never navigates the
app — the only navigation is `asm_run`'s handoff to the emulator, which is the
intended end of a task.

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
