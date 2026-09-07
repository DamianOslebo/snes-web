// @ts-check
/**
 * AudioWorklet processor. Runs on the audio thread and drains a queue of
 * Float32 samples (pushed from the main thread via postMessage) into the
 * output. Avoids SharedArrayBuffer so it works without COOP/COEP headers.
 *
 * This file is inlined into the bundle with a Vite `?raw` import and loaded
 * through a Blob URL (see src/runtime/audio.ts), so the browser executes
 * this source as-is on the audio thread: it must stay **plain JavaScript** —
 * no TypeScript-only syntax (annotations, `as` casts, `private`, ...). The
 * worklet-realm globals it uses are declared in worklet-globals.d.ts, and
 * `// @ts-check` + `checkJs` in tsconfig keep it type-checked in the build.
 */

class SnesAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    // `@type` (bare, non-generic Float32Array) so the property accepts both
    // `new Float32Array(0)` (→ Float32Array<ArrayBuffer>) and the
    // Float32Array<ArrayBufferLike> values returned by append()/slice().
    /** @type {Float32Array} */
    this.left = new Float32Array(0);
    /** @type {Float32Array} */
    this.right = new Float32Array(0);
    /** @type {number} */
    this.read = 0;
    this.port.onmessage = (e) => {
      this.left = append(this.left, e.data.left);
      this.right = append(this.right, e.data.right);
    };
  }

  /** @param {Float32Array[][]} _inputs @param {Float32Array[][]} outputs */
  process(_inputs, outputs) {
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

/**
 * @param {Float32Array} dst
 * @param {Float32Array} src
 * @returns {Float32Array}
 */
function append(dst, src) {
  const out = new Float32Array(dst.length + src.length);
  if (dst.length) out.set(dst, 0);
  if (src.length) out.set(src, dst.length);
  return out;
}

registerProcessor('snes-audio', SnesAudioProcessor);
