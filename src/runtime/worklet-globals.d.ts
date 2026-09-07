/**
 * Ambient types for the AudioWorklet *processor realm*.
 *
 * `AudioWorkletProcessor` and `registerProcessor` exist only on the
 * AudioWorkletGlobalScope the worklet runs in on the audio thread — the DOM
 * lib tsc checks against declares nothing for them (they're mentioned in
 * doc comments only) — so src/runtime/worklet.js is checked against these
 * structural shapes instead. Keep them in sync with the worklet's usage.
 */

interface SnesAudioMessage {
  left: Float32Array;
  right: Float32Array;
}

interface WorkletProcessor {
  readonly port: {
    onmessage: ((event: { data: SnesAudioMessage }) => void) | null;
  };
  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Float32Array[],
  ): boolean;
}

declare const AudioWorkletProcessor: new () => WorkletProcessor;

declare function registerProcessor(
  name: string,
  processorCtor: new () => WorkletProcessor,
): void;
