/**
 * Cheap ROM sanity check, run before handing fetched/picked bytes to a core.
 *
 * Every SNES image the core can load carries the 65C816 CPU-reset vector
 * `00 80` (little-endian for the `$8000` entry) at file offset `$7FC0` or
 * `$7FFC`, possibly behind a 512-byte (`$0200`) header — the same locations
 * snes9x's own ROM scoring checks, so this can reject a bad payload (an HTML
 * page from a dev-server SPA fallback, a truncated or CRLF-mangled file)
 * without ever rejecting something the core would accept.
 */
export function looksLikeSnesRom(b: Uint8Array): boolean {
  for (const header of [0x0000, 0x0200]) {
    for (const v of [0x7fc0, 0x7ffc]) {
      const i = header + v;
      if (i + 1 < b.length && b[i] === 0x00 && b[i + 1] === 0x80) return true;
    }
  }
  return false;
}
