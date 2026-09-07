import type { AudioFrame } from '../core/types';

/**
 * Feeds core audio frames into the AudioWorklet queue. Converts the core's
 * Int16 samples to Float32 and posts them; the worklet drains onto the
 * output.
 *
 * The worklet source is inlined into the bundle (`?raw` import of
 * src/runtime/worklet.js) and loaded through a Blob URL. Loading it as a
 * plain asset URL instead would depend on the server's MIME type for the
 * file — Vite's MIME table maps `.ts` to `video/mp2t` (MPEG transport
 * stream), and browsers reject non-JavaScript content types for worklet
 * scripts — and on the file being emitted/served at all. A Blob of type
 * `text/javascript` is identical in dev, prod, and static hosting.
 */
export class AudioEngine {
  private readonly ctx: AudioContext;
  private node: AudioWorkletNode | null = null;
  private readonly workletSource: string;

  constructor(ctx: AudioContext, workletSource: string) {
    this.ctx = ctx;
    this.workletSource = workletSource;
  }

  async start(): Promise<void> {
    if (this.node) return;
    const url = URL.createObjectURL(
      new Blob([this.workletSource], { type: 'text/javascript' }),
    );
    try {
      // addModule compiles the script and registers the processor before
      // resolving, so the Blob URL is disposable afterwards.
      await this.ctx.audioWorklet.addModule(url);
    } finally {
      URL.revokeObjectURL(url);
    }
    this.node = new AudioWorkletNode(this.ctx, 'snes-audio', {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [2],
    });
    this.node.connect(this.ctx.destination);
  }

  push(frame: AudioFrame): void {
    if (!this.node) return;
    this.node.port.postMessage({ left: int16ToFloat(frame.left), right: int16ToFloat(frame.right) });
  }

  async resume(): Promise<void> {
    if (this.ctx.state !== 'running') await this.ctx.resume();
  }

  async suspend(): Promise<void> {
    if (this.ctx.state === 'running') await this.ctx.suspend();
  }
}

function int16ToFloat(src: Int16Array): Float32Array {
  const out = new Float32Array(src.length);
  for (let i = 0; i < src.length; i++) out[i] = src[i] / 0x8000;
  return out;
}
