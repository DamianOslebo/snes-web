import { createCore } from './core/snes-core';
import { looksLikeSnesRom } from './core/rom-check';
import { SYSTEM_UNSUPPORTED, unsupportedCoprocessors } from './core/types';
import { DEFAULT_ROM } from './config';
import { CanvasRenderer } from './runtime/renderer';
import { AudioEngine } from './runtime/audio';
import { InputManager } from './runtime/input';
import { TouchController } from './runtime/touch';
import { FrameLoop } from './runtime/frame-loop';
import { buildUi } from './ui/app';
import { mountBindings } from './ui/bindings';
import { mountAssembler } from './ui/assembler';
import { ASM_ROM_KEY, base64ToBytes } from './asm/rom';
import { mountDebug } from './debug/debugger';
import workletSource from './runtime/worklet.js?raw';

async function boot(): Promise<void> {
  const mountEl = document.getElementById('app');
  if (!mountEl) throw new Error('#app mount point missing');

  // Controller-binding config page (?bindings=1), reached from the
  // "Controller" button. A standalone view: no core, no audio — it only needs
  // a pad once the user starts assigning. Binding state lives in localStorage
  // and is re-read by InputManager on the next emulator boot.
  if (new URLSearchParams(location.search).get('bindings') === '1') {
    mountBindings(mountEl);
    return;
  }

  // Assembler page (?asm=1), reached from the "Assembler" button. A standalone
  // 65C816 editor — like the bindings page it boots no core: it assembles to
  // machine code and hands a built SFC ROM to the app (▶ Run) or the user
  // (⬇ Download). No core/audio needed to author, so it works on any origin.
  if (new URLSearchParams(location.search).get('asm') === '1') {
    mountAssembler(mountEl);
    return;
  }

  const ui = buildUi(mountEl);

  const core = await createCore();
  const tag = `${core.id}${core.isMock ? ' (mock)' : ''}`;
  const setStatus = (s: string) => {
    ui.status.textContent = s;
  };
  setStatus(`${tag} · ${core.ready ? 'ready' : 'load a ROM to begin'}`);

  // --- runtime -----------------------------------------------------------
  const renderer = new CanvasRenderer(ui.canvas);
  // Match the AudioContext to the core's native SPU rate (32040 Hz for
  // snes9x) so the worklet's 1:1 drain plays at the right pitch.
  //
  // AudioWorklet is a secure-context-only API: on a plain-HTTP origin that
  // isn't localhost (e.g. a LAN IP), Chrome/Edge leave
  // `AudioContext.audioWorklet` undefined, so there is no audio at all.
  // Fail loudly with the remedy instead of silently running mute.
  if (typeof AudioContext === 'undefined') {
    throw new Error('AudioContext is not available in this browser');
  }
  const audioCtx = new AudioContext({ sampleRate: core.audioRate() });
  if (!audioCtx.audioWorklet) {
    throw new Error(
      'AudioWorklet is unavailable because this page is not on a secure origin. ' +
      'Open it at http://localhost:<port> (localhost counts as a secure context), ' +
      'or add this exact origin (scheme://host:port) to ' +
      'chrome://flags/#unsafely-treat-insecure-origin-as-secure and relaunch the browser.',
    );
  }
  const audio = new AudioEngine(audioCtx, workletSource);
  await audio.start();
  await audio.suspend(); // hold audio until the user starts the emulator

  const input = new InputManager(core);
  input.attach(document.body);

  // --- touch + gamepad controllers ---------------------------------------
  // A coarse primary pointer (or legacy ontouchstart) means the keyboard
  // gamepad model above won't exist, so we surface an on-screen controller
  // and auto-enter focus mode. `?focus=0` opts out (e.g. to use the debugger
  // on a phone). Desktop with a fine pointer gets no touch UI.
  //
  // A connected (Bluetooth) gamepad is the PRIMARY controller; the on-screen
  // touch pad is the FALLBACK — shown only in focus mode and only while no
  // gamepad is connected, and re-shown automatically if the pad is unplugged.
  const isTouch =
    typeof window !== 'undefined' &&
    (window.matchMedia?.('(pointer: coarse)')?.matches === true || 'ontouchstart' in window);
  const autoFocus =
    isTouch && new URLSearchParams(location.search).get('focus') !== '0';
  const touch = isTouch ? new TouchController((mask) => input.setTouchMask(mask)) : null;
  if (touch) ui.root.appendChild(touch.root);

  // `focused` is declared here (not where setFocused is defined below) so the
  // gamepad handler and syncTouch can read it before that section runs.
  let focused = false;
  let gamepad = false; // true while a gamepad is connected
  const syncTouch = (): void => {
    if (!touch) return;
    // Overlay only in focus mode, and only when no gamepad is driving the pad.
    touch.setEnabled(focused && !gamepad);
  };
  input.onGamepadChange = (connected) => {
    gamepad = connected;
    syncTouch();
    // The binding config is only useful with a pad attached: reveal the
    // "Controller" button on connect, hide it again on unplug.
    ui.bindingsBtn.hidden = !connected;
  };
  // A pad paired before the page loaded never fires `gamepadconnected`, so
  // read it now to start in the right mode (touch overlay hidden) instead of
  // flashing the touch pad for a frame once the frame loop begins.
  input.pollGamepad();
  syncTouch();

  const loop = new FrameLoop(() => {
    core.frame();
    renderer.draw(core.lastVideo());
    audio.push(core.drainAudio()); // keep draining so the C-side buffer stays bounded
    input.pollGamepad();
  }, 60);

  const setRunning = (on: boolean): void => {
    if (on) loop.start();
    else loop.stop();
  };

  // --- debugger (self-refreshes on a timer + on breakpoint hits) --------
  const debug = mountDebug(ui.debug, core);
  core.onBreakpoint = (hit) => {
    setRunning(false);
    setStatus(`⛔ breakpoint @ $${hit.bank.toString(16).toUpperCase()}:${hit.addr.toString(16).padStart(4, '0').toUpperCase()}`);
    debug.refresh();
  };

  // --- transport ---------------------------------------------------------
  ui.playBtn.addEventListener('click', async () => {
    if (!core.ready) {
      ui.romInput.click(); // prompt for a ROM
      return;
    }
    await audio.resume();
    setRunning(true);
  });
  ui.pauseBtn.addEventListener('click', () => setRunning(false));
  ui.stepBtn.addEventListener('click', () => {
    if (!core.ready) return;
    setRunning(false);
    core.step();
    renderer.draw(core.lastVideo());
    debug.refresh();
  });
  ui.saveBtn.addEventListener('click', () => {
    const count = debug.captureSlot();
    setStatus(`💾 saved slot #${count - 1}`);
  });

  // --- ROM loading -------------------------------------------------------
  // Shared path for the file picker and the default ROM: load, check the
  // coprocessor mask, then draw + resume audio + run.
  const loadRomBytes = async (name: string, rom: Uint8Array): Promise<void> => {
    setStatus(`loading ${name}…`);
    if (!looksLikeSnesRom(rom)) {
      throw new Error(
        `"${name}" (${rom.length} bytes) does not look like a SNES ROM ` +
        `(no $8000 reset vector (00 80) at $7FC0/$7FFC)`,
      );
    }
    await core.loadRom(rom);
    // This build can't run carts with these coprocessors (v1 scope): report
    // it instead of silently running the wrong thing.
    const sys = core.system();
    if (sys & SYSTEM_UNSUPPORTED) {
      setRunning(false);
      setStatus(`⚠️ ${name}: unsupported coprocessor (${unsupportedCoprocessors(sys).join(', ')})`);
      return;
    }
    renderer.draw(core.lastVideo());
    await audio.resume();
    setRunning(true);
    setStatus(`${tag} · running ${name}`);
    // On a touch device, drop straight into focus mode: chrome away, canvas
    // filling the viewport, on-screen controller visible.
    if (autoFocus) setFocused(true);
  };

  ui.romInput.addEventListener('change', async () => {
    const file = ui.romInput.files?.[0];
    if (!file) return;
    try {
      await loadRomBytes(file.name, new Uint8Array(await file.arrayBuffer()));
    } catch (err) {
      // Surface load failures in the status bar instead of an unhandled
      // rejection with the status stuck at "loading …".
      setRunning(false);
      setStatus(`⚠️ ${file.name}: ${(err as Error).message}`);
    }
  });

  // --- focus mode + fullscreen -------------------------------------------
  // Focus mode dedicates the keyboard to the game (InputManager.captureKeys
  // consumes every keydown/keyup), hides the chrome, scales the canvas to the
  // viewport, and auto-runs. F1 toggles it, Esc exits. Fullscreen (F, or the
  // button) is the browser's, applied to the whole shell.
  const setFocused = (on: boolean): void => {
    focused = on;
    input.captureKeys = on;
    ui.root.classList.toggle('focused', on);
    syncTouch();
    if (on) {
      (document.activeElement as HTMLElement | null)?.blur();
      if (core.ready) {
        audio.resume();
        setRunning(true);
      }
    }
  };
  const toggleFullscreen = (): void => {
    if (document.fullscreenElement === ui.root) document.exitFullscreen();
    else ui.root.requestFullscreen().catch(() => setStatus('fullscreen unavailable'));
  };
  ui.focusBtn.addEventListener('click', () => setFocused(!focused));
  ui.fullscreenBtn.addEventListener('click', toggleFullscreen);
  // Opens the binding-config page (a standalone ?bindings=1 view). "Back to
  // game" there strips the param, so the emulator reboots and InputManager
  // picks up the freshly saved mapping from localStorage.
  ui.bindingsBtn.addEventListener('click', () => {
    const url = new URL(location.href);
    url.searchParams.set('bindings', '1');
    location.href = url.toString();
  });
  // Opens the 65C816 assembler page (?asm=1). "Back to game" there strips the
  // param, so the emulator reboots with whatever state it had.
  ui.asmBtn.addEventListener('click', () => {
    const url = new URL(location.href);
    url.searchParams.set('asm', '1');
    location.href = url.toString();
  });
  // Touch escape hatch for focus mode (Esc/F1 don't exist on a phone).
  ui.exitFocusBtn.addEventListener('click', () => {
    setFocused(false);
    if (document.fullscreenElement) document.exitFullscreen();
    ui.exitFocusBtn.blur();
  });
  document.addEventListener('fullscreenchange', () => {
    const fs = document.fullscreenElement === ui.root;
    ui.fullscreenBtn.textContent = fs ? '⛶ Exit fullscreen' : '⛶ Fullscreen';
    if (!fs) setFocused(false); // Esc ending fullscreen also ends focus mode
  });
  // Capture phase, before the InputManager's body listeners, so the toggles
  // work whether or not focus mode is active.
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.code === 'F1') {
      e.preventDefault();
      setFocused(!focused);
    } else if (e.code === 'KeyF') {
      e.preventDefault();
      toggleFullscreen();
    } else if (e.code === 'Escape' && focused) {
      e.preventDefault();
      setFocused(false);
      if (document.fullscreenElement) document.exitFullscreen();
    }
  }, true);

  // Assembled ROM: if the assembler page handed a built ROM through
  // sessionStorage (▶ Run), load + run it through the exact same pipeline as a
  // user-picked .sfc — it takes priority over the default ROM.
  const asmB64 = sessionStorage.getItem(ASM_ROM_KEY);
  let loadedAsm = false;
  if (asmB64) {
    // Clear before awaiting so a failed or slow load can't re-trigger it on the
    // next boot; on failure we fall through to the default ROM below.
    sessionStorage.removeItem(ASM_ROM_KEY);
    try {
      await loadRomBytes('assembled.sfc', base64ToBytes(asmB64));
      loadedAsm = true;
    } catch (err) {
      setRunning(false);
      setStatus(`⚠️ assembled ROM failed to load: ${(err as Error).message}`);
    }
  }

  // Default ROM: auto-loaded on boot (see src/config.ts). Works on both the
  // wasm core (which actually emulates it) and the mock (which ignores ROM
  // contents and just becomes ready). "Load ROM…" replaces it any time. Skipped
  // when an assembled ROM was just loaded above.
  if (DEFAULT_ROM && !loadedAsm) {
    try {
      const res = await fetch(DEFAULT_ROM.url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // A dev-server SPA fallback for a missing asset returns 200 + HTML,
      // which sails past `res.ok` and would otherwise reach the core as an
      // opaque "failed to load ROM".
      if (/text\/html/i.test(res.headers.get('content-type') ?? '')) {
        throw new Error(
          `server returned an HTML page for ${DEFAULT_ROM.url} — ` +
          `the ROM file is probably missing from this checkout`,
        );
      }
      const rom = new Uint8Array(await res.arrayBuffer());
      if (!looksLikeSnesRom(rom)) {
        throw new Error(
          `${DEFAULT_ROM.name} (${rom.length} bytes) does not look like a SNES ROM ` +
          `— check the file in this checkout (size, sha256sum)`,
        );
      }
      await loadRomBytes(DEFAULT_ROM.name, rom);
    } catch (err) {
      setRunning(false);
      setStatus(`⚠️ default ROM failed to load: ${(err as Error).message}`);
    }
  }

  // The mock falls back to a dummy ROM so the test pattern runs on load.
  if (core.isMock && !core.ready) {
    await core.loadRom(new Uint8Array(0x10000));
    renderer.draw(core.lastVideo());
    await audio.resume();
    setRunning(true);
    setStatus(`${tag} · mock test pattern running (press ⏭ to step, ⏸ to pause)`);
    if (autoFocus) setFocused(true);
  }

  (window as unknown as Record<string, unknown>).__snes = { core, debug };
}

boot().catch((err) => {
  console.error('[snes-web] boot failed:', err);
  const el = document.getElementById('app');
  if (el) el.textContent = `Boot failed: ${(err as Error).message}`;
});
