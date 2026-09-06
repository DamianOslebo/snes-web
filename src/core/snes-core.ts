import { MockCore } from './mock-core';
import { createWasmCore } from './wasm-core';
import type { SnesCore } from './types';

/**
 * Build the core to run.
 *  - `?mock=1` (or a non-browser env)  -> MockCore, always
 *  - otherwise                         -> WasmCore, falling back to MockCore
 *                                          if the emscripten build is missing.
 * This keeps `npm run dev` working out of the box, before `core:build` exists.
 */
export async function createCore(preferMock?: boolean): Promise<SnesCore> {
  const forceMock =
    preferMock ||
    typeof document === 'undefined' ||
    (typeof location !== 'undefined' && new URLSearchParams(location.search).has('mock'));

  if (!forceMock) {
    try {
      return await createWasmCore();
    } catch (err) {
      // No wasm build / load failure -> degrade to the mock so the UI still runs.
      console.warn('[core] falling back to MockCore:', (err as Error).message);
    }
  }
  return new MockCore();
}
