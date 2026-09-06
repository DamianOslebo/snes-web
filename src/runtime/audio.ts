import type { AudioFrame } from '../core/types';

/**
 * Feeds core audio frames into the AudioWorklet queue. Converts the core's
 * Int16 samples to Float32 and posts them; the worklet drains onto the output.
 */
export class AudioEngine {
  private readonly ctx: AudioContext;
  private node: AudioWorkletNode | null = null;
  private readonly workletPath: string;

  constructor(ctx: AudioContext, workletPath: string) {
    this.ctx = ctx;
    this.workletPath = workletPath;
  }

  async start(): Promise<void> {
    if (this.node) return;
    await this.ctx.audioWorklet.addModule(this.workletPath);
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
