/**
 * AudioWorklet processor. Runs on the audio thread and drains a queue of
 * Float32 samples (pushed from the main thread via postMessage) into the
 * output. Avoids SharedArrayBuffer so it works without COOP/COEP headers.
 *
 * This file is loaded as an *audio worklet module*, not bundled into the app.
 */

/**
 * The worklet realm's globals (`AudioWorkletProcessor`, `registerProcessor`)
 * live on the AudioWorkletGlobalScope, not on the main-thread DOM scope the
 * app is typed against. Depending on which lib (dom vs webworker) the build
 * pulls in is fragile, so reach the real worklet globals through `globalThis`
 * and type them structurally. At runtime these resolve to the actual worklet
 * globals of the realm this module executes in.
 */
type WorkletPort = {
  onmessage: ((event: { data: unknown }) => void) | null;
};

const AudioWorkletProcessor: new () => { port: WorkletPort } =
  (globalThis as unknown as { AudioWorkletProcessor: new () => { port: WorkletPort } })
    .AudioWorkletProcessor;

class SnesAudioProcessor extends AudioWorkletProcessor {
  // Annotated as the bare (non-generic) typed-array type so values of type
  // `Float32Array<ArrayBuffer>` returned by `append`/`slice` assign cleanly.
  private left: Float32Array = new Float32Array(0);
  private right: Float32Array = new Float32Array(0);
  private read = 0;

  constructor() {
    super();
    this.port.onmessage = (e) => {
      const d = e.data as { left: Float32Array; right: Float32Array };
      this.left = append(this.left, d.left);
      this.right = append(this.right, d.right);
    };
  }

  process(_inputs: Float32Array[][], outputs: Float32Array[][], _params: unknown): boolean {
    const out = outputs[0];
    const L = out[0];
    const R = out.length > 1 ? out[1] : L;
    for (let i = 0; i < L.length; i++) {
      if (this.read < this.left.length) {
        L[i] = this.left[this.read];
        R[i] = this.right[this.read];
        this.read++;
      } else {
        L[i] = 0;
        R[i] = 0;
      }
    }
    // Bound memory: drop consumed samples, and periodically compact.
    if (this.read >= this.left.length || this.read > 8192) {
      if (this.read > 0) {
        this.left = this.left.slice(this.read);
        this.right = this.right.slice(this.read);
      }
      this.read = 0;
    }
    return true;
  }
}

function append(dst: Float32Array, src: Float32Array): Float32Array {
  const out = new Float32Array(dst.length + src.length);
  if (dst.length) out.set(dst, 0);
  if (src.length) out.set(src, dst.length);
  return out;
}

(globalThis as unknown as {
  registerProcessor: (name: string, processorCtor: new () => unknown) => void;
}).registerProcessor('snes-audio', SnesAudioProcessor);
