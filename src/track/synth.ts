/**
 * Core-free Web Audio renderer for the tracker — a software approximation of
 * the SNES S-DSP (8 sample voices, per-voice volume, echo), not the real
 * SPC700. It plays instrument `Float32Array` samples re-pitched per note
 * (`playbackRate = noteFreq / baseFreq`, mirroring the S-DSP's P/0x2000 law,
 * clamped to the 0.25×–4× S-DSP pitch range) through a per-channel gain, with
 * an echo send (feedback delay + low-pass, standing in for the S-DSP's delay +
 * shared 8-tap FIR filter) and a light reverb for color.
 *
 * Thin on purpose: all scheduling decisions live in sequencer.ts (testable in
 * node); this file is the only place that touches AudioContext, so it stays
 * out of the test suite (node has no Web Audio).
 */

import { CHANNELS, noteToFreq } from './model';
import type { Instrument } from './model';
import type { Step } from './sequencer';

/** S-DSP pitch range: P 0x0400–0x3FFF = 0.25× to 4× original sample rate. */
const RATE_MIN = 0.25;
const RATE_MAX = 4;
/** Key-off release (s) — a short fade so a replaced voice doesn't click. */
const RELEASE_S = 0.02;

/** One sounding voice: source + gain, kept together so a re-key can release the gain. */
interface Voice {
  src: AudioBufferSourceNode;
  gain: GainNode;
}

export class TrackerSynth {
  private ctx: AudioContext | null = null;
  private channelGains: GainNode[] = [];
  private instruments: Instrument[] = [];
  /** 1:1 with `instruments`; `null` until the context exists (lazy). */
  private buffers: (AudioBuffer | null)[] = [];
  /** The sounding voice per channel (S-DSP: one voice per channel; key-on restarts it). */
  private active = new Map<number, Voice>();

  constructor(instruments: Instrument[] = []) {
    this.instruments = instruments;
    this.buffers = instruments.map(() => null);
  }

  /** Rebuild the sample buffers (call when the song's instruments change). */
  setInstruments(instruments: Instrument[]): void {
    this.instruments = instruments;
    this.buffers = instruments.map((inst) => (this.ctx ? this.makeBuffer(inst) : null));
  }

  /** Must be called from a user gesture (Play) to satisfy autoplay rules. */
  async resume(): Promise<void> {
    this.ensureGraph();
    await this.ctx!.resume();
  }

  /** The AudioContext clock in seconds (null until the graph exists). */
  now(): number | null {
    return this.ctx ? this.ctx.currentTime : null;
  }

  suspend(): void {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }

  /**
   * Key-on a note at `when` (AudioContext time, default now). Looping
   * instruments run until `stop()`; one-shots stop just past their length.
   * Re-keys the channel's current voice (S-DSP: one voice per channel).
   */
  playNote(step: Step, when?: number): void {
    this.ensureGraph();
    const ctx = this.ctx!;
    const inst = this.instruments[step.inst];
    if (!inst) return;
    let buf = this.buffers[step.inst];
    if (!buf) {
      buf = this.makeBuffer(inst);
      this.buffers[step.inst] = buf;
    }

    const t = when ?? ctx.currentTime;
    const rate = Math.min(RATE_MAX, Math.max(RATE_MIN, noteToFreq(step.note) / inst.baseFreq));
    const ch = step.channel % CHANNELS;

    // A new note-on replaces whatever is sounding on this channel (the S-DSP
    // re-keys the voice rather than stacking a second sample on it). The old
    // voice is released at the NEW voice's start time — never at "now" (the
    // schedule moment): the lookahead scheduler schedules ~300 ms ahead, so a
    // hard cut now would kill a note before it ever sounded, and any song
    // whose notes are closer together than the lookahead would play silent.
    this.releaseVoice(ch, t);

    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    src.loop = inst.loop;

    // Per-voice volume (0–15 → gain), modest so 8 voices summed can't clip.
    const voice = ctx.createGain();
    voice.gain.value = Math.pow(step.vol / 15, 1.4) * 0.85;
    src.connect(voice);
    voice.connect(this.channelGains[ch]);

    src.start(t);
    if (!inst.loop) {
      src.stop(t + buf.duration / rate + 0.02); // let the decay tail out
    }
    this.active.set(ch, { src, gain: voice });
    src.onended = () => {
      if (this.active.get(ch)?.src === src) this.active.delete(ch);
    };
  }

  /** Key-off everything (all voices, including looping ones). */
  stop(): void {
    if (!this.ctx) return;
    for (const ch of [...this.active.keys()]) this.releaseVoice(ch, this.ctx.currentTime);
  }

  /**
   * Key off the channel's current voice at `at` — the incoming note's start
   * time, or `now` for Stop — with at least a `RELEASE_S` fade. The fade ends
   * a hard cut (click) that a bare `stop()` at schedule time would leave.
   */
  private releaseVoice(ch: number, at: number): void {
    const ctx = this.ctx!;
    const v = this.active.get(ch);
    if (!v) return;
    this.active.delete(ch);
    const now = ctx.currentTime;
    const end = Math.max(at, now + RELEASE_S);
    try {
      v.gain.gain.setValueAtTime(v.gain.gain.value, now);
      v.gain.gain.linearRampToValueAtTime(0, end);
    } catch {
      // context already closed — the voice goes away with it
    }
    try {
      v.src.stop(end);
    } catch {
      // already stopped — fine
    }
  }

  /** Close the AudioContext and release the graph. */
  dispose(): void {
    this.stop();
    if (this.ctx) void this.ctx.close();
    this.ctx = null;
    this.channelGains = [];
    this.buffers = [];
  }

  private makeBuffer(inst: Instrument): AudioBuffer {
    const buf = this.ctx!.createBuffer(1, inst.sample.length, 32_040);
    buf.getChannelData(0).set(inst.sample);
    return buf;
  }

  private ensureGraph(): void {
    if (this.ctx) return;
    if (typeof AudioContext === 'undefined') {
      throw new Error(
        'AudioContext is unavailable — this browser or origin does not support Web Audio',
      );
    }
    const ctx = new AudioContext();
    this.ctx = ctx;

    const master = ctx.createGain();
    master.gain.value = 0.8;
    master.connect(ctx.destination);

    this.channelGains = [];
    for (let ch = 0; ch < CHANNELS; ch++) {
      const g = ctx.createGain();
      g.gain.value = 0.9;
      g.connect(master);
      this.channelGains.push(g);
    }

    // Echo: feedback delay + low-pass (the S-DSP's echo is a delay line with
    // feedback, low-passed through its shared 8-tap FIR filter).
    const echoSend = ctx.createGain();
    echoSend.gain.value = 0.28;
    for (const g of this.channelGains) g.connect(echoSend);
    const delay = ctx.createDelay(2);
    delay.delayTime.value = 0.12;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 4500;
    const fb = ctx.createGain();
    fb.gain.value = 0.38; // < 1 — too much feedback turns into reverberation/noise
    delay.connect(lp);
    lp.connect(fb);
    fb.connect(delay);
    lp.connect(master);

    // Reverb: a light convolution for musical color (approximation, not S-DSP).
    const reverbSend = ctx.createGain();
    reverbSend.gain.value = 0.12;
    for (const g of this.channelGains) g.connect(reverbSend);
    const conv = ctx.createConvolver();
    conv.buffer = makeImpulse(ctx, 0.9, 2.6);
    const wet = ctx.createGain();
    wet.gain.value = 0.7;
    conv.connect(wet);
    wet.connect(master);

    // Materialize any buffers deferred before the context existed.
    for (let i = 0; i < this.buffers.length; i++) {
      if (this.buffers[i] === null) {
        const inst = this.instruments[i];
        if (inst) this.buffers[i] = this.makeBuffer(inst);
      }
    }
  }
}

/** A short decaying-noise impulse response for the reverb bus. */
function makeImpulse(ctx: AudioContext, seconds: number, decay: number): AudioBuffer {
  const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  let seed = 0x5eed;
  const rnd = (): number => {
    seed = (seed * 1_664_525 + 1_013_904_223) >>> 0;
    return seed / 0x8000_0000 - 1;
  };
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = rnd() * Math.pow(1 - i / len, decay);
  }
  return buf;
}
