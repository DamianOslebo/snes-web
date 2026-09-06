#!/usr/bin/env bash
#
# core/build.sh — compile snes9x + the C shim into a single Emscripten module.
#
# Run from the repo root (or anywhere; it cds to the repo root itself):
#   bash core/build.sh          # or: npm run core:build
#
# Output goes to public/core/build/ so Vite serves it at /core/build/*, which is
# exactly the URL src/core/wasm-core.ts loads from (SCRIPT_URL). Building into
# public/ is deliberate: it's a web-served asset, not source.
#
# Prerequisites
#   - emcc on PATH, or an emsdk checkout (set EMSDK_DIR=/path/to/emsdk).
#   - snes9x sources under core/snes9x-2010/ (auto-cloned on first run if
#     git+network are available; set SNES9X_DIR=/path/to/snes9x-2010 to use
#     your own checkout).
#
# The target is gallaux/snes9x-2010-wasm — the "globals API" generation of
# snes9x (Init/LoadROM/S9xMainLoop + Registers/CPU globals), not the
# S9xContext API. Its wasm/ and web/ directories are NOT compiled: only the
# sources under core/snes9x-2010/core/ join our own shim.
#
# Environment overrides
#   EMSDK_DIR    path to an emsdk checkout (uses <dir>/emscripten/emcc.py)
#   SNES9X_DIR   path to a snes9x-2010 checkout (default: core/snes9x-2010)
#   CFLAGS       extra C flags (e.g. -O3)
#   SNES9X_URL   alternate git repo (default: gallaux/snes9x-2010-wasm)

set -euo pipefail

# --- locate repo root (the directory that contains core/) -------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

SNES9X_URL="${SNES9X_URL:-https://github.com/gallaux/snes9x-2010-wasm.git}"
SHIM="$SCRIPT_DIR/shim/s9x_shim.c"
OUT_DIR="$ROOT/public/core/build"

# ---------------------------------------------------------------------------
# 1. Find the Emscripten compiler
# ---------------------------------------------------------------------------
EMCC=""
# Try an ordered list of candidate emcc paths and take the first executable one.
# `emcc` (the shell wrapper) is preferred over `emcc.py` (which is not always
# +x). Both the legacy `<sdk>/emscripten/` and modern `<sdk>/upstream/emscripten/`
# emsdk layouts are covered.
pick_emcc() {
  local c
  for c in "$@"; do
    [[ -n "$c" && -x "$c" ]] && { printf '%s' "$c"; return 0; }
  done
  return 1
}
if command -v emcc >/dev/null 2>&1; then
  EMCC="emcc"
else
  # EMSDK_DIR (explicit), then a default checkout under $HOME/emsdk.
  for base in "${EMSDK_DIR:-}" "$HOME/emsdk"; do
    [[ -z "$base" ]] && continue
    if EMCC="$(pick_emcc \
      "$base/upstream/emscripten/emcc" \
      "$base/emscripten/emcc" \
      "$base/upstream/emscripten/emcc.py" \
      "$base/emscripten/emcc.py")"; then
      break
    fi
    EMCC=""
  done
fi

if [[ -z "$EMCC" ]]; then
  cat >&2 <<'EOF'
error: emscripten (emcc) not found.
Install emsdk, then activate it:

    git clone https://github.com/emscripten-core/emsdk.git
    cd emsdk
    ./emsdk install latest && ./emsdk activate latest
    ./emsdk activate latest      # or: source ./emsdk_env.sh

Then either `export PATH="$PWD/emscripten:$PATH"` or set EMSDK_DIR and re-run.
EOF
  exit 1
fi
echo ">> emcc: $EMCC"

# ---------------------------------------------------------------------------
# 2. Ensure snes9x sources are present
# ---------------------------------------------------------------------------
SNES9X="${SNES9X_DIR:-$ROOT/core/snes9x-2010}"
if [[ ! -f "$SNES9X/core/snes9x.h" ]]; then
  if [[ -z "${SNES9X_DIR:-}" ]] && command -v git >/dev/null 2>&1; then
    echo ">> snes9x not found — cloning $SNES9X_URL"
    rm -rf "$ROOT/core/snes9x-2010"
    git clone --depth 1 "$SNES9X_URL" "$ROOT/core/snes9x-2010"
    SNES9X="$ROOT/core/snes9x-2010"
  else
    cat >&2 <<EOF
error: snes9x sources not found (expected $SNES9X/core/snes9x.h).
Either run once with git+network available (it auto-clones), or set
SNES9X_DIR to your own checkout and re-run.
EOF
    exit 1
  fi
fi
echo ">> snes9x: $SNES9X"

mkdir -p "$OUT_DIR"

# ---------------------------------------------------------------------------
# 3. Compile
# ---------------------------------------------------------------------------
# Every core_* function must be exported so the JS glue (src/core/wasm-core.ts)
# can call it as Module._<name>. malloc/free are needed by the JS side for
# copying ROM/scratch buffers in and out of linear memory.
EXPORTED_FUNCTIONS='[
  "_malloc",
  "_free",
  "_core_ready",
  "_core_load_rom",
  "_core_frame",
  "_core_set_controller",
  "_core_video_ptr",
  "_core_video_len",
  "_core_audio_ptr",
  "_core_audio_len",
  "_core_audio_rate",
  "_core_system",
  "_core_read_mem_into",
  "_core_write_mem",
  "_core_reg_a",
  "_core_reg_x",
  "_core_reg_y",
  "_core_reg_s",
  "_core_reg_p",
  "_core_reg_pc",
  "_core_reg_dbr",
  "_core_reg_dpr",
  "_core_step",
  "_core_set_breakpoint",
  "_core_clear_breakpoint",
  "_core_breakpoint_count",
  "_core_breakpoint_bank",
  "_core_breakpoint_addr",
  "_core_sram_ptr",
  "_core_wram_ptr"
]'

SOURCES=("$SHIM")
while IFS= read -r f; do SOURCES+=("$f"); done \
  < <(find "$SNES9X/core" -name '*.c' | sort)

echo ">> compiling ${#SOURCES[@]} C files"

# shellcheck disable=SC2086
"$EMCC" \
  -O2 -std=gnu99 \
  ${CFLAGS:-} \
  -I "$SNES9X/core" \
  -I "$SNES9X/core/libretro" \
  -s MODULARIZE=1 \
  -s EXPORT_NAME=snesWasm \
  -s ENVIRONMENT=web \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s EXPORTED_RUNTIME_METHODS='["HEAPU8"]' \
  -s EXPORTED_FUNCTIONS="$EXPORTED_FUNCTIONS" \
  -o "$OUT_DIR/snes9x.js" \
  "${SOURCES[@]}"

# Emscripten writes snes9x.wasm next to snes9x.js in the output dir.
if [[ ! -f "$OUT_DIR/snes9x.wasm" ]]; then
  echo "error: build finished but $OUT_DIR/snes9x.wasm was not produced" >&2
  exit 1
fi

echo ">> done: $(ls -lh "$OUT_DIR/snes9x.js" "$OUT_DIR/snes9x.wasm" | awk '{print $9, $5}')"
echo ">> served at /core/build/snes9x.js — run: npm run dev"
