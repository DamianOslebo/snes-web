/**
 * App configuration.
 *
 * Default ROM — auto-loaded on boot so the app is immediately playable
 * without a file picker. To reconfigure:
 *   1. Point `DEFAULT_ROM` at a different ROM (any .sfc reachable by a
 *      Vite `?url` import), or
 *   2. Set `VITE_DEFAULT_ROM=/roms/whatever.sfc` in `.env` (put the file
 *      under `public/roms/`) to override at build time, or
 *   3. Set `DEFAULT_ROM` to `null` to disable auto-load entirely.
 *
 * The built-in default is the freeware Tuxed CPU-test ROM in `test/cpu_test/`
 * (already part of this repo) — a plain SFC, no coprocessor.
 */
import cputestUrl from '../test/cpu_test/cputest-basic.sfc?url';

const envRom: unknown = import.meta.env.VITE_DEFAULT_ROM;

export const DEFAULT_ROM: { name: string; url: string } | null =
  typeof envRom === 'string' && envRom.length > 0
    ? { name: envRom.split('/').pop() ?? 'default-rom', url: envRom }
    : { name: 'cputest-basic.sfc', url: cputestUrl };
