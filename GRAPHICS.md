# Graphics Editor & VRAM Inspector

Status: **complete.** The `?gfx=1` page (Inspector + Editor) and the 🎨 Graphics
button wiring are in place, the five-way `core_vram_ptr` ABI sync and the pure-TS
gfx data path are done, and the test suite is green (120 tests, 40 of them gfx).
The last confirmation is a final `npm run typecheck && npm run build` run.

🤖 The agent panel (present on all three authoring pages) can drive this page end-to-end — see [AGENT.md](AGENT.md).
The graphics tool is one new page — `?gfx=1`, reached from
the "🎨 Graphics" transport button — with two halves:

- **Inspector** — read + decode the *running* core's 64 KB VRAM: tile graphics,
  CG-RAM palettes, and the SC0 tilemap.
- **Editor** — statically author tiles + palettes + a 32×32 tilemap and emit a
  **raw 64 KB VRAM `.bin`** you load into your own project. **No ROM, no 65C816.**

The data model is a pure-TS, node-testable module set (`src/gfx/*`) built the same
way as `src/asm/*`. The test *is* the guarantee for the byte formats, so the exact
bit order lives in code + tests, not prose.

## The SNES VRAM model (oracle- + `ppu.c`-confirmed)

**VRAM is 64 KB** (`Memory.VRAM`, `core/memmap.h`). It is **PPU-only** — *not on
the CPU bus* (written via the `$2118/$211A` VMA/VDMA path) — so the existing
`readMem`/`core_mem_*` ABI cannot reach it. The only path is a new shim export that
returns `Memory.VRAM`, exactly how `core_wram_ptr` returns `Memory.RAM`
(`core/shim/s9x_shim.c`). See the ABI note below.

Layout within the 64 KB:

- **Tile graphics (character data):** the lower 32 KB (`$0000–$7FFF`). Indexed by
  8×8 "char slot"; a tile occupies one slot (8×8 modes) or two adjacent slots
  (16×16 modes).
- **CG-RAM palettes:** `$C000–$DFFF` — 256 palettes × 16 colors × 2 bytes.
  `cgramOffset(i) = $C000 + i*32`. 15-bit 5-5-5 RGB.
- **Tilemap (SC0):** at byte offset `SCBase * 2` — 1024 × 16-bit entries = 2048 B
  (`ppu.c`: `SC0 = (uint16_t*)&Memory.VRAM[PPU.BG[bg].SCBase << 1]`).

> **CGRAM ≠ framebuffer.** The CGRAM color word is 5-5-5. The shim's
> `convertVideo()` expands to the *screen* framebuffer in 5-6-5 — a different
> format. Do not mix them (the tests pin the CGRAM 5-5-5 layout explicitly).

### Mode geometry (indexed by background mode 0-7)

| mode | size | depth | colors | bytes/8×8 sub-tile |
|------|------|-------|--------|--------------------|
| 0    | 8×8  | 2     | 4      | 16                 |
| 1    | 16×16| 2     | 4      | 16 (×4 sub-tiles)  |
| 2    | 8×8  | 4     | 16     | 32                 |
| 3    | 16×16| 4     | 16     | 32 (×4 sub-tiles)  |
| 4    | 8×8  | 8     | 256    | 64                 |
| 5    | 16×16| 8     | 256    | 64 (×4 sub-tiles)  |
| 6    | 8×8  | 2     | 4      | 16                 |
| 7    | 8×8  | 8     | 256    | 64 (EXTBG)         |

### Tile encoding — planar, MSB-first (ORACLE-CONFIRMED)

Tiles are stored **planar**, one bit-plane at a time, MSB-first. For an 8×8
sub-tile, pixel (row `r`, col `c`) on plane `p` lives at:

```
byteOffset = (p >> 1) * 16 + 2 * r + (p & 1)
bit        = 7 - c            // bit 7 = leftmost (col 0)
index     |= (1 << p) at that bit
```

So `byteOffset` = row `r` of plane-pair `(p>>1)`, byte `(p&1)`, and the color index
is the 2/4/8 planes recombined. Bytes per 8×8 sub-tile = `depth * 8`
(2bpp→16, 4bpp→32, 8bpp→64).

A **16×16** tile is four 8×8 sub-tiles at 8×8 char slots (verified via `ppu.c`
`TILE_PLUS` + `t1=16`): **UL→N, UR→N+1, LL→N+16, LR→N+17**
(`SUBTILE_OFFSETS = [0,1,16,17]`). A 16×16 tile therefore straddles two char
columns, so consecutive 16×16 tiles sit 2 slots apart (`tileCharStride = 2`).

### CGRAM color word (5-5-5, little-endian 2 bytes/color)

```
low  = (R & 0x1F) | ((G & 0x7) << 5)
high = ((G >> 3) & 0x3) | ((B & 0x1F) << 2) | (T << 7)
```

decode: `R = low & 0x1F`; `G = ((low >> 5) & 7) | ((high & 3) << 3)`;
`B = (high >> 2) & 0x1F`; `T = high >> 7`. A palette is **always 16 colors
(32 B)**; color 0 is the transparent slot by convention (the T bit drives
transparency). 5→8-bit for display: `x8 = (x5 << 3) | (x5 >> 2)`
(0→0, 1→8, 16→132, 31→255) — the same expansion the shim uses.

### Tilemap entry (16-bit, little-endian)

```
bits  9-0  = tile name (10-bit)   0x03FF
bits 12-10 = palette bank (3-bit) 0x1C00   (ignored by 8bpp modes)
bit  13    = priority             0x2000
bit  14    = H-flip (mirror X)    0x4000
bit  15    = V-flip (mirror Y)    0x8000
```

Full SC0 map = 1024 entries = 2048 B at `SCBase * 2`.

## ABI — `core_vram_ptr()` (the required three-way sync)

Reading a running core's VRAM is the **one new capability** the C ABI needed. It
mirrors `core_wram_ptr` and keeps the three-way sync CLAUDE.md mandates
(shim ↔ `S9xModule` ↔ `build.sh` `EXPORTED_FUNCTIONS`), plus the `SnesCore`
interface + `MockCore` line-up:

1. **`core/shim/s9x_shim.c`** — next to `core_wram_ptr`:
   ```c
   EMSCRIPTEN_KEEPALIVE
   unsigned char *core_vram_ptr(void) { return g_ready ? Memory.VRAM : NULL; }
   ```
2. **`core/build.sh`** — `"_core_vram_ptr"` appended to `EXPORTED_FUNCTIONS`
   (after `"_core_wram_ptr"`).
3. **`src/core/wasm-core.ts`** — `_core_vram_ptr(): number` on `S9xModule`;
   `readVram(): Uint8Array` = `M.HEAPU8.slice(ptr, ptr + VRAM_SIZE)`.
4. **`src/core/types.ts`** — `readVram(): Uint8Array;` on `SnesCore`, and
   `export const VRAM_SIZE = 0x10000;`.
5. **`src/core/mock-core.ts`** — `readVram()` returns a **seeded 64 KB VRAM**
   (a recognizable tile set + a 16-color palette + a 1024-entry map, built with
   the same `buildVram` the Editor exports) so the Inspector is demoable
   core-free and the whole suite runs without emsdk.

> **Real-core path:** a one-time `npm run core:build` (emsdk) rebuilds the wasm
> with `_core_vram_ptr` exported. The mock path needs no build.

## Done

### `src/gfx/palette.ts` (new) — CGRAM 5-5-5

`Rgb15 {r,g,b,transparent}`; `rgb15`, `rgb5to8`; `encodeColor`/`decode15` (the
2-byte LE pair, T bit at `high >> 7`); `encodePalette(colors[16])` → 32 B (throws
unless exactly 16); `cgramOffset(i) = $C000 + i*32`. Pure TS.

### `src/gfx/tile-encode.ts` (new) — planar tile + sub-tile I/O

`MODES` (8 modes), `depthForMode`/`sizeForMode`/`colorsForMode`/
`charBytesForMode`/`tileCharStride`, `SUBTILE_OFFSETS = [0,1,16,17]`.
`encode8x8`/`decode8x8` (the oracle-confirmed planar core), `encodeTile` (8×8 or
16×16 as 4 sub-tiles [UL,UR,LL,LR]), `encodeTileAt` (write into a VRAM buffer,
self-zeroing). Throws on an index that doesn't fit the depth — never truncates.

### `src/gfx/tilemap.ts` (new) — SC0 entries

`TilemapEntry {tile,palette,flipX,flipY,priority}`; `encodeEntry`/`decodeEntry`;
`encodeTilemap` (LE 16-bit, 2 B/entry), `encodeTilemapAt(vram, entries, mapBase)`.
Tile name range-checked 0..1023 (never a wrapped name).

### `src/gfx/vram.ts` (new) — `buildVram`

**`buildVram({mode, tiles, palettes, tilemap?, tileBase?, paletteBase?, mapBase?})`**
→ the raw 64 KB image: tiles at `tileBase + i*stride`, palettes at
`$C000 + paletteBase*32`, map at `mapBase`. Zero-initialized; throws if any region
would exceed the 64 KB. This is the graphics analog of `buildRom` in
`src/asm/rom.ts` — except the output is PPU graphics data, not an SFC.

### `src/gfx/decode.ts` (new) — the Inspector's reader

The inverse of the encoders, all reading straight out of a 64 KB buffer:
`decodeTile(vram, mode, tileIndex, tileBase?)` → `size×size` palette-index grid
(16×16 composes its four sub-tiles); `decodePalette(vram, paletteIndex)` → 16
`Rgb15`; `decodeTilemap(vram, mapBase?, count?)`. Range-checked against the buffer.

### Tests (node env) — 40 tests, all green

- **`test/gfx-tile.test.ts` (14)** — per-mode 0-7 round-trip
  (encode→decode identical); exact byte counts (16/32/64 per sub-tile, ×4 for 16×16);
  hand-computed bytes for the planar layout (a checkerboard's first byte, an
  8bpp block's byte) — the oracle guarantee in the test itself.
- **`test/gfx-palette.test.ts` (8)** — 5-5-5 `encode`/`decode` round-trip across
  every channel; the canonical SNES word pairs (red/green/blue/white); the T bit;
  `rgb5to8` matched to the shim's `convertVideo` values; `encodePalette` = 32 B and
  its size contract; `cgramOffset`.
- **`test/gfx-tilemap.test.ts` (7)** — the 16-bit entry bit layout (tile/palette/
  priority/H/V flip); encode/decode round-trip; 2048 B for a full map; the
  overflow guard.
- **`test/gfx-vram.test.ts` (11)** — `buildVram` placement for modes 0 and 3
  (tiles at base, sub-tiles at slots 0/1/16/17, palettes at `$C000+`, map at
  `mapBase`); 64 KB size; custom bases; **decode the built image → equal to the
  inputs** (the end-to-end round trip); and the overflow rejections.

## `?gfx=1` page — `src/ui/graphics.ts` (`mountGraphics`)

A dedicated full page (mirrors `src/ui/assembler.ts`: `el`/CSS/`doDownload`/
back-button patterns), with two tabs. Because it is a standalone route, its
Inspector can load a ROM and *run it to a frame* to populate VRAM — a self-contained
"load ROM → run → read its VRAM" workflow. `main.ts` routes it **before** the full
emulator boot, so the **Editor works fully core-free on any origin**.

- **Inspector tab** (core-backed): a ROM picker (`looksLikeSnesRom` file input), a
  small Run/Pause/Step transport (`core.frame()`/`core.step()` — no canvas/audio
  needed to populate VRAM), a mode selector (0-7), a tile-base + index-range picker,
  a **Refresh** (VRAM changes as the ROM runs → re-read `core.readVram()`), a palette
  swatch strip, and a hex-dump toggle. Renders decoded tiles as colored grids via a
  `decodeTile`→palette→canvas blit.
- **Editor tab** (core-free): a mode selector; a **tile paint grid** (canvas, paint
  palette indices — 1-bit-per-click for 4-color modes, direct index for 8bpp); a
  **16-color palette editor** (color 0 = transparent); a **32×32 tilemap grid**
  (each cell: tile # + flip toggles); a **live preview** canvas of the composed
  background; and **⬇ Download VRAM .bin** → `buildVram(...)` → Blob → object-URL
  anchor (the assembler's `doDownload` pattern: 5000 ms revoke before dropping the
  anchor).

  **v1 simplification:** the Editor always uses a single 16-color palette (CGRAM
  index 0) regardless of mode — a painted index `n` resolves to `palette[n & 15]`.
  For 2/4bpp modes that is exactly right; for 8bpp modes (4/5/7) the full 256-color
  index space is therefore limited to indices 0-15 (one palette). Transparency is
  "index 0" or a color with its transparent flag set, in both the preview and the
  painted tile. A multi-palette (256-color) editor is a v2 item.

## Wiring

- **`src/ui/app.ts`** — `gfxBtn: HTMLButtonElement` on `Ui`; create it next to
  `asmBtn` (`el('button','btn','🎨 Graphics')`); add it to the transport array and
  the return object.
- **`src/main.ts`** — import `mountGraphics`; add a `?gfx=1` dispatch before
  `buildUi` (mirrors the `?asm=1` block); wire `gfxBtn`'s click to
  `url.searchParams.set('gfx','1'); location.href = url.toString();` exactly like
  `asmBtn`.

## Verify

```bash
npx vitest run test/gfx-tile.test.ts      # 14 tests (per-mode round-trips + hand bytes)
npx vitest run test/gfx-palette.test.ts   # 8 tests  (5-5-5 round-trips, rgb5to8)
npx vitest run test/gfx-tilemap.test.ts   # 7 tests  (entry bits, 2048 B, guard)
npx vitest run test/gfx-vram.test.ts      # 11 tests (buildVram layout + round-trip)
npx vitest run                           # full suite: 120 tests
npm run typecheck
npm run build
```

Optional (real-core Inspector): `npm run core:build` (emsdk) to export
`_core_vram_ptr`, then `npm run dev` → `?gfx=1` → Inspector → load any ROM,
Run/Step to a frame with a visible background, pick a mode + tile base → the ROM's
live tiles + palettes render; **Refresh** re-reads. `?mock=1` exercises the
Inspector against `MockCore`'s seeded VRAM with no emsdk at all.
