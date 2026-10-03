import type { NoiseConfig, NoiseType } from '../domain/noise';
import { NoiseGraph, volumeToGain } from './audioGraph';
import { createNoiseBuffer } from './noiseBuffers';

const PARAM_SMOOTHING = 0.05;
const FADE_SECONDS = 0.12;

export function isWebAudioSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.AudioContext === 'function';
}

/**
 * Live playback. The AudioContext is created lazily on the first play,
 * which must happen inside a user gesture because of browser autoplay policies.
 */
export class NoiseEngine {
  private ctx: AudioContext | null = null;
  private graph: NoiseGraph | null = null;
  private readonly buffers = new Map<NoiseType, AudioBuffer>();
  private config: NoiseConfig;
  private playing = false;
  private suspendTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly onInterrupted: (() => void) | undefined;
  /** Set when playback stopped without a fade out: the next play must fade in from silence. */
  private interrupted = false;

  /** @param onInterrupted called when the browser or the system stops playback (e.g. a phone call). */
  constructor(initialConfig: NoiseConfig, onInterrupted?: () => void) {
    this.config = initialConfig;
    this.onInterrupted = onInterrupted;
  }

  get isPlaying(): boolean {
    return this.playing;
  }

  async play(): Promise<void> {
    if (this.playing) return;
    const ctx = this.ensureContext();
    const graph = this.ensureGraph(ctx);
    clearTimeout(this.suspendTimer);
    await ctx.resume();
    // dispose() may have run while waiting: the context is gone.
    if (this.ctx !== ctx || this.graph !== graph) return;
    graph.apply(this.config, PARAM_SMOOTHING);
    graph.start(ctx.currentTime);
    graph.rampOutput(volumeToGain(this.config.volume), ctx.currentTime, FADE_SECONDS, this.interrupted ? 0 : undefined);
    this.interrupted = false;
    this.playing = true;
  }

  stop(): void {
    if (!this.playing || !this.ctx || !this.graph) return;
    const ctx = this.ctx;
    this.playing = false;
    this.graph.rampOutput(0, ctx.currentTime, FADE_SECONDS);
    // Suspend after the fade so an idle page does not keep the audio thread busy.
    this.suspendTimer = setTimeout(() => {
      if (!this.playing) void ctx.suspend();
    }, FADE_SECONDS * 1000 + 50);
  }

  update(config: NoiseConfig): void {
    this.config = config;
    if (!this.graph) return;
    this.graph.apply(config, PARAM_SMOOTHING);
    if (this.playing) this.graph.setOutputLevel(volumeToGain(config.volume), PARAM_SMOOTHING);
  }

  async dispose(): Promise<void> {
    clearTimeout(this.suspendTimer);
    this.playing = false;
    this.graph?.dispose();
    this.graph = null;
    this.buffers.clear();
    const ctx = this.ctx;
    this.ctx = null;
    if (ctx && ctx.state !== 'closed') await ctx.close();
  }

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      if (!isWebAudioSupported()) throw new Error('Web Audio API non supportata da questo browser.');
      const ctx = new AudioContext({ latencyHint: 'playback' });
      ctx.addEventListener('statechange', () => this.handleStateChange(ctx));
      this.ctx = ctx;
    }
    return this.ctx;
  }

  /** Our own suspend happens only after stop(), so a non-running context while playing is external. */
  private handleStateChange(ctx: AudioContext): void {
    if (this.ctx !== ctx || !this.playing || ctx.state === 'running') return;
    this.playing = false;
    this.interrupted = true;
    this.onInterrupted?.();
  }

  private ensureGraph(ctx: AudioContext): NoiseGraph {
    if (!this.graph) {
      this.graph = new NoiseGraph(ctx, (type) => this.getBuffer(ctx, type));
      this.graph.output.connect(ctx.destination);
    }
    return this.graph;
  }

  private getBuffer(ctx: AudioContext, type: NoiseType): AudioBuffer {
    let buffer = this.buffers.get(type);
    if (!buffer) {
      buffer = createNoiseBuffer(ctx, type);
      this.buffers.set(type, buffer);
    }
    return buffer;
  }
}
