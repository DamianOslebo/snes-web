import { createCore } from './core/snes-core';
import { SYSTEM_UNSUPPORTED, unsupportedCoprocessors } from './core/types';
import { DEFAULT_ROM } from './config';
import { CanvasRenderer } from './runtime/renderer';
import { AudioEngine } from './runtime/audio';
import { InputManager } from './runtime/input';
import { FrameLoop } from './runtime/frame-loop';
import { buildUi } from './ui/app';
import { mountDebug } from './debug/debugger';
import workletSource from './runtime/worklet.js?raw';

async function boot(): Promise<void> {
  const mountEl = document.getElementById('app');
  if (!mountEl) throw new Error('#app mount point missing');
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
  };

  ui.romInput.addEventListener('change', async () => {
    const file = ui.romInput.files?.[0];
    if (!file) return;
    await loadRomBytes(file.name, new Uint8Array(await file.arrayBuffer()));
  });

  // --- focus mode + fullscreen -------------------------------------------
  // Focus mode dedicates the keyboard to the game (InputManager.captureKeys
  // consumes every keydown/keyup), hides the chrome, scales the canvas to the
  // viewport, and auto-runs. F1 toggles it, Esc exits. Fullscreen (F, or the
  // button) is the browser's, applied to the whole shell.
  let focused = false;
  const setFocused = (on: boolean): void => {
    focused = on;
    input.captureKeys = on;
    ui.root.classList.toggle('focused', on);
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

  // Default ROM: auto-loaded on boot (see src/config.ts). Works on both the
  // wasm core (which actually emulates it) and the mock (which ignores ROM
  // contents and just becomes ready). "Load ROM…" replaces it any time.
  if (DEFAULT_ROM) {
    try {
      const res = await fetch(DEFAULT_ROM.url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await loadRomBytes(DEFAULT_ROM.name, new Uint8Array(await res.arrayBuffer()));
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
  }

  (window as unknown as Record<string, unknown>).__snes = { core, debug };
}

boot().catch((err) => {
  console.error('[snes-web] boot failed:', err);
  const el = document.getElementById('app');
  if (el) el.textContent = `Boot failed: ${(err as Error).message}`;
});
