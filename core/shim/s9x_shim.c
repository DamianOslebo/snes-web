/*
 * s9x_shim.c — a C ABI bridge between the web app and snes9x.
 *
 * This file is compiled together with snes9x-2010 (core/snes9x-2010, the
 * "globals API" generation) by core/build.sh into a single Emscripten module.
 * It exports exactly the functions declared in `S9xModule`
 * (src/core/wasm-core.ts):
 *
 *   core_ready / core_load_rom / core_frame / core_set_controller
 *   core_video_ptr / core_video_len / core_audio_ptr / core_audio_len
 *   core_audio_rate / core_system
 *   core_read_mem_into / core_write_mem
 *   core_reg_a|x|y|s|p|pc|dbr|dpr
 *   core_step / core_set_breakpoint / core_clear_breakpoint
 *   core_breakpoint_count / core_breakpoint_bank / core_breakpoint_addr
 *   core_sram_ptr / core_wram_ptr
 *
 * Keep this file in sync with the S9xModule interface in src/core/wasm-core.ts
 * and the EXPORTED_FUNCTIONS list in core/build.sh.
 *
 * Save states do NOT need a shim hook: the web side snapshots the whole
 * linear memory heap (M.HEAPU8), which already contains WRAM, SRAM, the CPU,
 * PPU and SPU state, so a whole-heap copy can't miss a register. The shim only
 * has to hand back the SRAM/WRAM pointers for the save-state *differ*.
 *
 * Design notes
 *   - ROM loading goes through snes9x's memstream: the app copies the ROM
 *     into wasm linear memory, the shim points the memory stream at it and
 *     LoadROM() reads it — no filesystem needed in the browser.
 *   - Memory read/write for the debugger uses the real bus
 *     (S9xGetByte/S9xSetByte) with full 24-bit addresses, so ROM banks
 *     $00-$FF, WRAM, SRAM and the PPU/SPU register windows all behave the
 *     way they do on hardware.
 *   - core_step() runs exactly one instruction using the same fetch/decode
 *     sequence as S9xMainLoop's inner loop (NMI/IRQ preamble, fast/slow
 *     opcode fetch, 4K-block rebasing, H-event processing), so single-step
 *     is faithful to run mode.
 *   - Breakpoints are checked at frame boundaries and after each stepped
 *     instruction (PC compare); the hit is reported to JS via _s9xBreakpoint.
 */

#include <emscripten.h>

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "snes9x.h"
#include "memmap.h"
#include "cpuexec.h"
#include "cpuops.h"
#include "65c816.h"
#include "apu.h"
#include "ppu.h"
#include "controls.h"
#include "getset.h"
#include "sa1.h"
#include "streams/memory_stream.h"
#include "streams/file_stream.h" /* RFILE (stubs below) */
#include "libretro/libretro.h" /* struct retro_memory_descriptor (stub below) */

/* Defined in controls.c */
extern uint16_t joypad[8];

/* ------------------------------------------------------------------ */
/* Link stubs: symbols snes9x-2010 expects the frontend to provide    */
/* ------------------------------------------------------------------ */

/* CPU timing (snes9x.h macros ONE_CYCLE / SLOW_ONE_CYCLE / TWO_CYCLES). */
bool overclock_cycles = false;
int one_c = 6;
int slow_one_c = 8;
int two_c = 12;

/* ppu.c sprite-flicker reduction option; off by default. */
bool reduce_sprite_flicker = false;

void S9xMessage(S9xMessagePriority p, S9xMessageCategory c, const char *msg) {
    (void)p; (void)c;
    printf("%s\n", msg);
}

const char *S9xGetDirectory(uint32_t dirtype) {
    (void)dirtype;
    return "";
}

void S9xDeinitUpdate(int width, int height) {
    (void)width; (void)height;
}

void S9xLibretroSwFbAcquire(int width, int height) {
    (void)width; (void)height;
}

void S9xLibretroSwFbAbort(void) {}

void S9xAppendMapping(struct retro_memory_descriptor *desc) {
    (void)desc;
}

/* BS-X / multi-cart file I/O — unsupported in the web build; ROM loading
   goes through the memory stream instead. */
RFILE *filestream_open(const char *path, unsigned mode, unsigned hints) {
    (void)path; (void)mode; (void)hints;
    return NULL;
}
int64_t filestream_read(RFILE *stream, void *s, int64_t len) {
    (void)stream; (void)s; (void)len;
    return -1;
}
int filestream_close(RFILE *stream) {
    (void)stream;
    return -1;
}

/* ------------------------------------------------------------------ */
/* Shim state                                                          */
/* ------------------------------------------------------------------ */

static int g_inited = 0;
static int g_ready = 0;   /* set once a ROM is loaded and the core is up */

/* Persistent 256x224 RGBA8 frame, refreshed by core_frame(). */
#define VIDEO_BYTES (SNES_WIDTH * SNES_HEIGHT * 4)
static unsigned char *g_video = NULL;

/* Samples drained since the last core_audio_len() read (interleaved
   stereo int16). Capped well above a few frames; oldest samples are
   dropped if the app stops draining. */
#define AUDIO_CAP_SAMPLES (1 << 16)
static int16_t *g_audio = NULL;
static unsigned int g_audio_len = 0;

#define MAX_BREAKPOINTS 64
static uint8_t  bp_bank[MAX_BREAKPOINTS];
static uint16_t bp_addr[MAX_BREAKPOINTS];
static int      bp_count = 0;

/* ------------------------------------------------------------------ */
/* JS hook: report a breakpoint hit                                    */
/* ------------------------------------------------------------------ */

EM_JS(void, js_on_breakpoint, (int bank, int addr), {
    if (typeof Module !== 'undefined' && Module &&
        typeof Module._s9xBreakpoint === 'function') {
        Module._s9xBreakpoint(bank, addr);
    }
});

static void check_breakpoints(void) {
    if (bp_count == 0) return;
    const uint32_t pc = Registers.PBPC;
    for (int i = 0; i < bp_count; i++) {
        if ((((uint32_t)bp_bank[i] << 16) | bp_addr[i]) == pc) {
            js_on_breakpoint(bp_bank[i], bp_addr[i]);
            break;
        }
    }
}

/* ------------------------------------------------------------------ */
/* Initialisation                                                      */
/* ------------------------------------------------------------------ */

static int initOnce(void) {
    if (g_inited) return 1;

    memset(&Settings, 0, sizeof(Settings));
    Settings.FrameTimePAL   = 20000;
    Settings.FrameTimeNTSC  = 16667;
    Settings.HDMATimingHack = 100;
    Settings.BlockInvalidVRAMAccessMaster = TRUE;
    Settings.SuperFXSpeedPerLine = 0.417f * 10.5e6f;
    Settings.NormalControls = TRUE;
    CPU.Flags = 0;

    /* Every failure path prints: core_load_rom returns 0 to the app either
       way, and the app quotes these lines on the next load failure, so the
       status bar says *which* step failed instead of "core failed". */
    if (!Init()) {
        S9xMessage(S9X_MSG_ERROR, S9X_CATEGORY_EXTERNAL, "core init failed: Init()");
        return 0;
    }
    if (!S9xInitAPU()) {
        S9xMessage(S9X_MSG_ERROR, S9X_CATEGORY_EXTERNAL, "core init failed: S9xInitAPU()");
        return 0;
    }
    S9xInitSound();

    GFX.Pitch  = MAX_SNES_WIDTH * sizeof(uint16_t);
    GFX.Screen = (uint16_t *)calloc((size_t)GFX.Pitch * 512, 1);
    if (!GFX.Screen) {
        S9xMessage(S9X_MSG_ERROR, S9X_CATEGORY_EXTERNAL, "core init failed: calloc(GFX.Screen)");
        return 0;
    }
    S9xGraphicsInit();

    S9xUnmapAllControls();
    S9xSetController(0, CTL_JOYPAD, 0, 0, 0, 0);
    S9xSetController(1, CTL_JOYPAD, 1, 0, 0, 0);

    g_video = (unsigned char *)calloc(VIDEO_BYTES, 1);
    if (!g_video) {
        S9xMessage(S9X_MSG_ERROR, S9X_CATEGORY_EXTERNAL, "core init failed: calloc(g_video)");
        return 0;
    }
    g_audio = (int16_t *)calloc(AUDIO_CAP_SAMPLES, sizeof(int16_t));
    if (!g_audio) {
        S9xMessage(S9X_MSG_ERROR, S9X_CATEGORY_EXTERNAL, "core init failed: calloc(g_audio)");
        return 0;
    }

    g_inited = 1;
    return 1;
}

/* ------------------------------------------------------------------ */
/* ROM loading                                                         */
/* ------------------------------------------------------------------ */

EMSCRIPTEN_KEEPALIVE
int core_ready(void) {
    return g_ready;
}

EMSCRIPTEN_KEEPALIVE
int core_load_rom(unsigned char *rom, unsigned int len) {
    if (!initOnce()) return 0;
    memstream_set_buffer(rom, len);
    if (!LoadROM()) return 0;
    S9xReset();
    g_ready = 1;
    return 1;
}

/* ------------------------------------------------------------------ */
/* Frame / audio                                                       */
/* ------------------------------------------------------------------ */

static void drainSpcAudio(void) {
    int count = 0;
    const short *src = S9xDrainAudio(&count);
    if (!src || count <= 0) return;
    if (g_audio_len + (unsigned int)count > AUDIO_CAP_SAMPLES) {
        /* App stopped draining: drop the oldest samples. */
        const unsigned int drop = g_audio_len + (unsigned int)count - AUDIO_CAP_SAMPLES;
        memmove(g_audio, g_audio + drop, (size_t)(g_audio_len - drop) * sizeof(int16_t));
        g_audio_len -= drop;
    }
    memcpy(g_audio + g_audio_len, src, (size_t)count * sizeof(int16_t));
    g_audio_len += (unsigned int)count;
}

static void convertVideo(void) {
    if (!GFX.Screen) return;
    const unsigned int w = SNES_WIDTH;
    const unsigned int h = SNES_HEIGHT;
    const unsigned int pitch = GFX.Pitch / sizeof(uint16_t);
    for (unsigned int y = 0; y < h; y++) {
        const uint16_t *src = GFX.Screen + (size_t)y * pitch;
        unsigned char *dst = g_video + (size_t)y * w * 4;
        for (unsigned int x = 0; x < w; x++) {
            const uint16_t col = src[x];
            dst[0] = (unsigned char)(((col >> 11) & 0x1F) << 3);
            dst[1] = (unsigned char)(((col >> 5) & 0x3F) << 2);
            dst[2] = (unsigned char)((col & 0x1F) << 3);
            dst[3] = 0xFF;
            dst += 4;
        }
    }
}

EMSCRIPTEN_KEEPALIVE
void core_frame(void) {
    if (!g_ready) return;
    IPPU.RenderThisFrame = true;
    S9xMainLoop();
    drainSpcAudio();
    convertVideo();
    check_breakpoints();
}

EMSCRIPTEN_KEEPALIVE
unsigned char *core_video_ptr(void) {
    return g_video;
}

EMSCRIPTEN_KEEPALIVE
unsigned int core_video_len(void) {
    return (g_ready && g_video) ? VIDEO_BYTES : 0;
}

EMSCRIPTEN_KEEPALIVE
int16_t *core_audio_ptr(void) {
    return g_audio;
}

/* Returns the pending audio in BYTES (interleaved int16) and consumes
   the buffer; JS slices HEAPU8 by this length. */
EMSCRIPTEN_KEEPALIVE
unsigned int core_audio_len(void) {
    const unsigned int n = g_audio_len;
    g_audio_len = 0;
    return n * sizeof(int16_t);
}

/* Native SPC output rate (32040 Hz nominally; tempo-hack carts differ).
   The app sizes its AudioContext to this. */
EMSCRIPTEN_KEEPALIVE
int core_audio_rate(void) {
    return (int)S9xGetAudioSampleRate();
}

/* System / coprocessor feature mask the core detected in the loaded ROM.
   Bit order MUST match the SYSTEM constants in src/core/types.ts:
     0 SuperFX   1 SA1     2 C4      3 SDD1    4 SPC7110
     5 SPC7110RTC 6 OBC1   7 SETA    8 SRTC    9 BS-X
   The app reports "unsupported coprocessor" for the bits in
   SYSTEM_UNSUPPORTED (Super FX / SA-1 / SDD1 — v1 scope, CLAUDE.md)
   instead of running a cart it cannot emulate. */
EMSCRIPTEN_KEEPALIVE
unsigned core_system(void) {
    unsigned s = 0;
    if (Settings.SuperFX)    s |= 1u << 0;
    if (Settings.SA1)        s |= 1u << 1;
    if (Settings.C4)         s |= 1u << 2;
    if (Settings.SDD1)       s |= 1u << 3;
    if (Settings.SPC7110)    s |= 1u << 4;
    if (Settings.SPC7110RTC) s |= 1u << 5;
    if (Settings.OBC1)       s |= 1u << 6;
    if (Settings.SETA)       s |= 1u << 7;
    if (Settings.SRTC)       s |= 1u << 8;
    if (Settings.BS)         s |= 1u << 9;
    return s;
}

/* ------------------------------------------------------------------ */
/* Input                                                               */
/* ------------------------------------------------------------------ */

/* App button layout (src/core/types.ts), bit positions 0-11:
 *   B Y SELECT START UP DOWN LEFT RIGHT A X L R
 * remapped onto snes9x's SNES_*_MASK values. Player is 1-based in the
 * app (port 0 in the core). */
EMSCRIPTEN_KEEPALIVE
void core_set_controller(int player, int buttons) {
    int port = player - 1;
    if (port < 0) port = 0;
    if (port > 7) port = 7;

    uint16_t state = 0;
    if (buttons & (1 << 0))  state |= SNES_B_MASK;
    if (buttons & (1 << 1))  state |= SNES_Y_MASK;
    if (buttons & (1 << 2))  state |= SNES_SELECT_MASK;
    if (buttons & (1 << 3))  state |= SNES_START_MASK;
    if (buttons & (1 << 4))  state |= SNES_UP_MASK;
    if (buttons & (1 << 5))  state |= SNES_DOWN_MASK;
    if (buttons & (1 << 6))  state |= SNES_LEFT_MASK;
    if (buttons & (1 << 7))  state |= SNES_RIGHT_MASK;
    if (buttons & (1 << 8))  state |= SNES_A_MASK;
    if (buttons & (1 << 9))  state |= SNES_X_MASK;
    if (buttons & (1 << 10)) state |= SNES_TL_MASK;
    if (buttons & (1 << 11)) state |= SNES_TR_MASK;
    joypad[port] = state;
}

/* ------------------------------------------------------------------ */
/* Memory (real bus, full 24-bit addresses)                            */
/* ------------------------------------------------------------------ */

EMSCRIPTEN_KEEPALIVE
void core_read_mem_into(int bank, int addr, unsigned char *dest, int len) {
    const uint32_t a = ((uint32_t)(bank & 0xff) << 16) | (uint32_t)(addr & 0xffff);
    for (int i = 0; i < len; i++) dest[i] = S9xGetByte(a + (uint32_t)i);
}

EMSCRIPTEN_KEEPALIVE
void core_write_mem(int bank, int addr, const unsigned char *src, int len) {
    const uint32_t a = ((uint32_t)(bank & 0xff) << 16) | (uint32_t)(addr & 0xffff);
    for (int i = 0; i < len; i++) S9xSetByte(src[i], a + (uint32_t)i);
}

/* ------------------------------------------------------------------ */
/* Registers                                                           */
/* ------------------------------------------------------------------ */

EMSCRIPTEN_KEEPALIVE
uint16_t core_reg_a(void) { return Registers.A.W; }
EMSCRIPTEN_KEEPALIVE
uint16_t core_reg_x(void) { return Registers.X.W; }
EMSCRIPTEN_KEEPALIVE
uint16_t core_reg_y(void) { return Registers.Y.W; }
EMSCRIPTEN_KEEPALIVE
uint16_t core_reg_s(void) { return Registers.S.W; }

/* The condition flags live in ICPU until S9xPackStatus() commits them to
   Registers.PL, so pack before reading P to report live flags. */
EMSCRIPTEN_KEEPALIVE
uint8_t core_reg_p(void) {
    S9xPackStatus();
    return Registers.PL;
}

EMSCRIPTEN_KEEPALIVE
uint32_t core_reg_pc(void) { return Registers.PBPC; }
EMSCRIPTEN_KEEPALIVE
uint8_t core_reg_dbr(void) { return Registers.DB & 0xf; }
EMSCRIPTEN_KEEPALIVE
uint16_t core_reg_dpr(void) { return Registers.D.W; }

/* ------------------------------------------------------------------ */
/* Single-instruction step                                             */
/* ------------------------------------------------------------------ */
/* Runs exactly one instruction, mirroring S9xMainLoop's inner loop:
 * the NMI/IRQ/SCAN_KEYS preamble, the fast/slow opcode fetch, the 4K
 * block rebase check, and H-event processing after the instruction.
 * PackStatus + breakpoint check follow so the debugger sees post-instruction
 * state. (The idle-loop speedhack is intentionally not applied while
 * stepping: accuracy over speed in the debugger.) */

EMSCRIPTEN_KEEPALIVE
void core_step(void) {
    if (!g_ready) return;

    register uint8_t Op;
    register struct SOpcodes *Opcodes;

    if (CPU.Flags) {
        if (CPU.Flags & NMI_FLAG) {
            if (Timings.NMITriggerPos <= CPU.Cycles) {
                CPU.Flags &= ~NMI_FLAG;
                Timings.NMITriggerPos = 0xffff;
                if (CPU.WaitingForInterrupt) {
                    CPU.WaitingForInterrupt = FALSE;
                    Registers.PCw++;
                }
                S9xOpcode_NMI();
            }
        }
        if (CPU.Flags & IRQ_FLAG) {
            if (CPU.IRQPending) {
                CPU.IRQPending--;
            } else {
                if (CPU.WaitingForInterrupt) {
                    CPU.WaitingForInterrupt = FALSE;
                    Registers.PCw++;
                }
                if (CPU.IRQActive) {
                    if (!CheckFlag(IRQ))
                        S9xOpcode_IRQ();
                } else {
                    CPU.Flags &= ~IRQ_FLAG;
                }
            }
        }
        if (CPU.Flags & SCAN_KEYS_FLAG) {
            /* Core would stop here until the next frame: report nothing. */
            return;
        }
    }

    Opcodes = S9xOpcodesSlow;
    CPU.PrevCycles = CPU.Cycles;

    if (CPU.PCBase) {
        Op = CPU.PCBase[Registers.PCw];
        CPU.Cycles += CPU.MemSpeed;
        Opcodes = ICPU.S9xOpcodes;
    } else {
        Op = S9xGetByte(Registers.PBPC);
        OpenBus = Op;
    }

    if ((Registers.PCw & MEMMAP_MASK) + ICPU.S9xOpLengths[Op] >= MEMMAP_BLOCK_SIZE) {
        uint8_t *oldPCBase = CPU.PCBase;
        CPU.PCBase = S9xGetBasePointer(ICPU.ShiftedPB + ((uint16_t)(Registers.PCw + 4)));
        if (oldPCBase != CPU.PCBase ||
            (Registers.PCw & ~MEMMAP_MASK) == (0xffff & ~MEMMAP_MASK))
            Opcodes = S9xOpcodesSlow;
    }

    Registers.PCw++;
    (*Opcodes[Op].S9xOpcode)();

    if (Settings.SA1)
        S9xSA1MainLoop();

    while (CPU.Cycles >= CPU.NextEvent)
        S9xDoHEventProcessing();

    S9xPackStatus();
    check_breakpoints();
}

/* ------------------------------------------------------------------ */
/* Breakpoints                                                         */
/* ------------------------------------------------------------------ */

EMSCRIPTEN_KEEPALIVE
void core_set_breakpoint(int bank, int addr) {
    const int b = bank & 0xff;
    const unsigned a = (unsigned)addr & 0xffff;
    for (int i = 0; i < bp_count; i++) {
        if (bp_bank[i] == b && bp_addr[i] == a) return; /* already set */
    }
    if (bp_count >= MAX_BREAKPOINTS) return;
    bp_bank[bp_count] = (uint8_t)b;
    bp_addr[bp_count] = (uint16_t)a;
    bp_count++;
}

EMSCRIPTEN_KEEPALIVE
void core_clear_breakpoint(int bank, int addr) {
    const int b = bank & 0xff;
    const unsigned a = (unsigned)addr & 0xffff;
    for (int i = 0; i < bp_count; i++) {
        if (bp_bank[i] == b && bp_addr[i] == a) {
            bp_count--;
            if (i != bp_count) {
                bp_bank[i] = bp_bank[bp_count];
                bp_addr[i] = bp_addr[bp_count];
            }
            return;
        }
    }
}

EMSCRIPTEN_KEEPALIVE
int core_breakpoint_count(void) {
    return bp_count;
}

EMSCRIPTEN_KEEPALIVE
uint8_t core_breakpoint_bank(int i) {
    return (i >= 0 && i < bp_count) ? bp_bank[i] : 0;
}

EMSCRIPTEN_KEEPALIVE
uint16_t core_breakpoint_addr(int i) {
    return (i >= 0 && i < bp_count) ? bp_addr[i] : 0;
}

/* ------------------------------------------------------------------ */
/* Save-state helpers                                                  */
/* ------------------------------------------------------------------ */

EMSCRIPTEN_KEEPALIVE
unsigned char *core_sram_ptr(void) {
    return g_ready ? Memory.SRAM : NULL;
}

EMSCRIPTEN_KEEPALIVE
unsigned char *core_wram_ptr(void) {
    return g_ready ? Memory.RAM : NULL;
}

EMSCRIPTEN_KEEPALIVE
unsigned char *core_vram_ptr(void) {
    return g_ready ? Memory.VRAM : NULL;
}
