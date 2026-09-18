/**
 * `buildVram` — compile authored tiles + palettes + a tilemap into a raw 64 KB
 * SNES VRAM image. The graphics analog of `buildRom` in `src/asm/rom.ts`:
 * the output is a flat `Uint8Array` you can dump to a `.bin` and load into your
 * own project. **No ROM, no 65C816** — just the compiled PPU graphics data.
 *
 * Layout within the 64 KB (matching a real SNES PPU):
 *   - tile graphics:  `tileBase` char slots onward (lower 32 KB)
 *   - CGRAM palettes: `$C000 + paletteBase*32` onward
 *   - tilemap (SC0):  `mapBase` byte offset onward (1024 × 16-bit entries)
 *
 * Pure TS, no DOM — unit-testable in the node env like the rest of `src/asm/`.
 */

import { encodeTileAt, tileCharStride } from './tile-encode';
import { encodePalette, cgramOffset, type Rgb15 } from './palette';
import { encodeTilemapAt, type TilemapEntry } from './tilemap';

/** 64 KB PPU VRAM (matches `VRAM_SIZE` in `src/core/types.ts`). */
export const VRAM_SIZE = 0x10000;

export interface BuildVramOptions {
  /** Background mode 0-7 (selects tile depth/size — see `MODES` in tile-encode). */
  mode: number;
  /**
   * Tiles to encode, each a `size×size` grid of palette indices (`size` from
   * the mode). Tile `i` is placed at char slot `tileBase + i * stride`.
   */
  tiles: number[][][];
  /**
   * Palettes (each 16 colors) to write to CGRAM. Palette `i` at CGRAM index
   * `paletteBase + i`.
   */
  palettes: Rgb15[][];
  /** Optional tilemap entries (up to 1024) placed at `mapBase`. */
  tilemap?: TilemapEntry[];
  /** Base 8×8 char slot for tile 0. Default 0. */
  tileBase?: number;
  /** Base CGRAM palette index for palette 0. Default 0. */
  paletteBase?: number;
  /** Byte offset in VRAM where the tilemap starts. Default 0. */
  mapBase?: number;
}

/**
 * Build the 64 KB VRAM image. Zero-initialized, with tiles, palettes, and
 * tilemap written at their bases. Throws if any region would exceed VRAM.
 */
export function buildVram(opts: BuildVramOptions): Uint8Array {
  const {
    mode,
    tiles,
    palettes,
    tilemap,
    tileBase = 0,
    paletteBase = 0,
    mapBase = 0,
  } = opts;

  const vram = new Uint8Array(VRAM_SIZE);

  // 1) Tiles — place each at its char slot.
  const stride = tileCharStride(mode);
  for (let i = 0; i < tiles.length; i++) {
    const slot = tileBase + i * stride;
    encodeTileAt(vram, tiles[i], mode, slot);
  }

  // 2) Palettes — write each 16-color palette to CGRAM.
  for (let i = 0; i < palettes.length; i++) {
    const off = cgramOffset(paletteBase + i);
    const bytes = encodePalette(palettes[i]);
    if (off + bytes.length > VRAM_SIZE) {
      throw new Error(`buildVram: palette ${paletteBase + i} at $${off.toString(16)} exceeds VRAM`);
    }
    vram.set(bytes, off);
  }

  // 3) Tilemap — 1024 × 16-bit entries at `mapBase`.
  if (tilemap && tilemap.length) {
    encodeTilemapAt(vram, tilemap, mapBase);
  }

  return vram;
}
