import type { VideoFrame } from '../core/types';

/** Blits a core frame (RGBA8) to a 2D canvas. */
export class CanvasRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly image: ImageData;

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas context unavailable');
    this.ctx = ctx;
    canvas.width = 256;
    canvas.height = 224;
    this.image = new ImageData(256, 224);
  }

  draw(frame: VideoFrame): void {
    if (frame.width !== 256 || frame.height !== 224) {
      // Unexpected geometry — rescale the backing store rather than crash.
      return;
    }
    // `data` is a fresh Uint8Array each frame; copy it into the reused ImageData.
    this.image.data.set(frame.data, 0);
    this.ctx.putImageData(this.image, 0, 0);
  }
}
