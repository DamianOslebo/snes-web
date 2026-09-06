/**
 * Fixed-timestep emulation driver. Advances the core at a constant rate
 * (default 60 Hz) regardless of display refresh, using a rAF clock +
 * accumulator. `tick` is called once per emulated frame.
 */
export class FrameLoop {
  private readonly stepMs: number;
  private acc = 0;
  private last = 0;
  private raf = 0;
  private running = false;

  constructor(private readonly tick: () => void, hz = 60) {
    this.stepMs = 1000 / hz;
  }

  get isRunning(): boolean {
    return this.running;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.acc = 0;
    this.raf = requestAnimationFrame(this.loop);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private loop = (now: number): void => {
    if (!this.running) return;
    let dt = now - this.last;
    this.last = now;
    if (dt > 250) dt = 250; // clamp after a tab was backgrounded
    this.acc += dt;
    while (this.acc >= this.stepMs) {
      this.acc -= this.stepMs;
      this.tick();
    }
    this.raf = requestAnimationFrame(this.loop);
  };
}
