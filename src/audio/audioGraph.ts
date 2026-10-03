import type { NoiseConfig, NoiseType } from '../domain/noise';

/** Headroom so that full volume plus modulation never clips the output. */
const MASTER_HEADROOM = 0.9;
export const TYPE_CROSSFADE_SECONDS = 0.6;

export type BufferProvider = (type: NoiseType) => AudioBuffer;

/** Perceptual taper: the knob position feels linear to the ear. */
export function volumeToGain(volumePercent: number): number {
  const v = Math.min(1, Math.max(0, volumePercent / 100));
  return v * v * MASTER_HEADROOM;
}

/** Moves a parameter to a value: exponentially when smoothing > 0, instantly otherwise. */
function scheduleValue(param: AudioParam, value: number, now: number, smoothing: number): void {
  param.cancelScheduledValues(now);
  if (smoothing > 0) param.setTargetAtTime(value, now, smoothing);
  else param.setValueAtTime(value, now);
}

interface Voice {
  type: NoiseType;
  source: AudioBufferSourceNode;
  gain: GainNode;
}

/**
 * The signal chain shared by live playback and offline rendering:
 * voices -> high-pass -> low-pass -> mid/side width -> modulation -> master.
 */
export class NoiseGraph {
  readonly output: GainNode;
  private readonly ctx: BaseAudioContext;
  private readonly getBuffer: BufferProvider;
  private readonly bus: GainNode;
  private readonly highPass: BiquadFilterNode;
  private readonly lowPass: BiquadFilterNode;
  private readonly side: GainNode;
  private readonly modulation: GainNode;
  private readonly lfo: OscillatorNode;
  private readonly lfoDepth: GainNode;
  private voice: Voice | null = null;
  private started = false;

  constructor(ctx: BaseAudioContext, getBuffer: BufferProvider) {
    this.ctx = ctx;
    this.getBuffer = getBuffer;

    this.bus = ctx.createGain();
    this.highPass = new BiquadFilterNode(ctx, { type: 'highpass', Q: Math.SQRT1_2 });
    this.lowPass = new BiquadFilterNode(ctx, { type: 'lowpass', Q: Math.SQRT1_2 });
    this.bus.connect(this.highPass).connect(this.lowPass);

    // Mid/side matrix: L' = M + wS, R' = M - wS with M = (L+R)/2 and S = (L-R)/2.
    const splitter = ctx.createChannelSplitter(2);
    const merger = ctx.createChannelMerger(2);
    const mid = new GainNode(ctx, { gain: 0.5 });
    const rightInverted = new GainNode(ctx, { gain: -1 });
    const sideInverted = new GainNode(ctx, { gain: -1 });
    this.side = ctx.createGain();
    this.lowPass.connect(splitter);
    splitter.connect(mid, 0);
    splitter.connect(mid, 1);
    splitter.connect(this.side, 0);
    splitter.connect(rightInverted, 1);
    rightInverted.connect(this.side);
    mid.connect(merger, 0, 0);
    mid.connect(merger, 0, 1);
    this.side.connect(merger, 0, 0);
    this.side.connect(sideInverted).connect(merger, 0, 1);

    // Amplitude modulation between (1 - depth) and 1.
    this.modulation = ctx.createGain();
    this.lfo = new OscillatorNode(ctx, { type: 'sine' });
    this.lfoDepth = ctx.createGain();
    this.lfo.connect(this.lfoDepth).connect(this.modulation.gain);
    merger.connect(this.modulation);

    this.output = new GainNode(ctx, { gain: 0 });
    this.modulation.connect(this.output);
  }

  /** Applies every parameter; smoothing = 0 sets values instantly (offline renders). */
  apply(config: NoiseConfig, smoothing: number): void {
    const now = this.ctx.currentTime;
    const set = (param: AudioParam, value: number) => scheduleValue(param, value, now, smoothing);
    const nyquist = this.ctx.sampleRate / 2;
    const depth = config.modDepth / 100;

    set(this.highPass.frequency, Math.min(config.lowCut, nyquist));
    set(this.lowPass.frequency, Math.min(config.highCut, nyquist));
    set(this.side.gain, (config.width / 100) * 0.5);
    set(this.modulation.gain, 1 - depth / 2);
    set(this.lfoDepth.gain, depth / 2);
    set(this.lfo.frequency, config.modRate);

    this.setType(config.type, smoothing > 0 ? TYPE_CROSSFADE_SECONDS : 0);
  }

  /** Follows a new master level, e.g. while the volume knob moves. */
  setOutputLevel(value: number, smoothing: number): void {
    scheduleValue(this.output.gain, value, this.ctx.currentTime, smoothing);
  }

  /** Ramps the master level linearly, from `from` or the current level; used for fades in/out. */
  rampOutput(target: number, at: number, duration: number, from?: number): void {
    const param = this.output.gain;
    param.cancelScheduledValues(at);
    param.setValueAtTime(from ?? param.value, at);
    param.linearRampToValueAtTime(target, at + duration);
  }

  start(at: number): void {
    if (this.started) return;
    this.started = true;
    this.lfo.start(at);
    this.voice?.source.start(at);
  }

  dispose(): void {
    if (this.started) {
      this.voice?.source.stop();
      this.lfo.stop();
    }
    this.voice = null;
    this.output.disconnect();
  }

  private setType(type: NoiseType, crossfade: number): void {
    if (this.voice?.type === type) return;
    const now = this.ctx.currentTime;
    const previous = this.voice;

    const source = new AudioBufferSourceNode(this.ctx, { buffer: this.getBuffer(type), loop: true });
    const gain = new GainNode(this.ctx, { gain: previous && crossfade > 0 ? 0 : 1 });
    source.connect(gain).connect(this.bus);
    this.voice = { type, source, gain };

    if (this.started) source.start(now);
    if (!previous) return;

    if (!this.started) {
      previous.gain.disconnect();
      return;
    }
    previous.source.onended = () => previous.gain.disconnect();
    if (crossfade > 0) {
      // Uncorrelated noise sums in power, so an equal-power curve keeps the level steady.
      const from = previous.gain.gain.value;
      previous.gain.gain.cancelScheduledValues(now);
      gain.gain.setValueCurveAtTime(equalPowerCurve('in', 1), now, crossfade);
      previous.gain.gain.setValueCurveAtTime(equalPowerCurve('out', from), now, crossfade);
      previous.source.stop(now + crossfade + 0.05);
    } else {
      previous.source.stop(now);
    }
  }
}

const CURVE_POINTS = 64;

function equalPowerCurve(direction: 'in' | 'out', scale: number): Float32Array {
  const curve = new Float32Array(CURVE_POINTS);
  for (let i = 0; i < CURVE_POINTS; i++) {
    const angle = ((i / (CURVE_POINTS - 1)) * Math.PI) / 2;
    curve[i] = scale * (direction === 'in' ? Math.sin(angle) : Math.cos(angle));
  }
  return curve;
}
