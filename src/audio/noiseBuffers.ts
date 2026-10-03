import type { NoiseType } from '../domain/noise';
import { applyBiquad, designBiquad } from './biquad';

export type RandomSource = () => number;

/** Samples backed by a regular ArrayBuffer, as required by AudioBuffer.copyToChannel. */
export type Samples = Float32Array<ArrayBuffer>;

/** Length of the looped buffer: long enough to make the loop point imperceptible. */
export const LOOP_SECONDS = 12;
const LOOP_CROSSFADE_SECONDS = 0.25;
const TARGET_RMS = 0.2;
const PEAK_LIMIT = 0.98;

function white(length: number, random: RandomSource): Samples {
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) out[i] = random() * 2 - 1;
  return out;
}

/** Paul Kellet's refined pink filter (-3 dB/octave). */
function pink(length: number, random: RandomSource): Samples {
  const out = new Float32Array(length);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < length; i++) {
    const w = random() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856;
    b4 = 0.55 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.016898;
    out[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362;
    b6 = w * 0.115926;
  }
  return out;
}

/** Leaky integrator of white noise (-6 dB/octave). */
function brown(length: number, random: RandomSource): Samples {
  const out = new Float32Array(length);
  let last = 0;
  for (let i = 0; i < length; i++) {
    last = (last + 0.02 * (random() * 2 - 1)) / 1.02;
    out[i] = last;
  }
  return out;
}

/** First difference: adds +6 dB/octave to the source slope. */
function differentiate(source: Samples): Samples {
  const out = new Float32Array(source.length);
  let previous = 0;
  for (let i = 0; i < source.length; i++) {
    const current = source[i]!;
    out[i] = current - previous;
    previous = current;
  }
  return out;
}

/** White noise shaped by an approximate inverse A-weighting curve. */
function grey(length: number, random: RandomSource, sampleRate: number): Samples {
  const out = white(length, random);
  applyBiquad(out, designBiquad('lowshelf', 180, 14, 0.7, sampleRate));
  applyBiquad(out, designBiquad('peaking', 3500, -9, 0.9, sampleRate));
  applyBiquad(out, designBiquad('highshelf', Math.min(11000, sampleRate * 0.4), 6, 0.7, sampleRate));
  return out;
}

function generateRaw(type: NoiseType, length: number, sampleRate: number, random: RandomSource): Samples {
  switch (type) {
    case 'white':
      return white(length, random);
    case 'pink':
      return pink(length, random);
    case 'brown':
      return brown(length, random);
    case 'blue':
      return differentiate(pink(length, random));
    case 'violet':
      return differentiate(white(length, random));
    case 'grey':
      return grey(length, random, sampleRate);
  }
}

/**
 * Removes DC, normalises RMS to a common level and keeps peaks below full scale.
 * Statistics are gathered in a single pass (variance = E[x²] − mean²) and
 * applied in a second one: the buffers are large, so passes are what cost.
 */
function normalize(samples: Samples): void {
  const n = samples.length;
  let sum = 0;
  let sumOfSquares = 0;
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < n; i++) {
    const v = samples[i]!;
    sum += v;
    sumOfSquares += v * v;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const mean = sum / n;
  const rms = Math.sqrt(Math.max(0, sumOfSquares / n - mean * mean));
  if (rms === 0) {
    samples.fill(0);
    return;
  }

  const peak = Math.max(max - mean, mean - min);
  const gain = Math.min(TARGET_RMS / rms, PEAK_LIMIT / peak);
  for (let i = 0; i < n; i++) samples[i] = (samples[i]! - mean) * gain;
}

/**
 * Generates one channel of seamlessly loopable noise.
 * The extra tail is blended into the head with an equal-power crossfade,
 * so the last sample flows into the first one without a click.
 */
export function generateLoopChannel(
  type: NoiseType,
  length: number,
  sampleRate: number,
  random: RandomSource = Math.random,
): Samples {
  if (!Number.isInteger(length) || length <= 0) {
    throw new RangeError(`Lunghezza del buffer non valida: ${length}`);
  }
  const fade = Math.min(Math.floor(length / 4), Math.round(sampleRate * LOOP_CROSSFADE_SECONDS));
  const raw = generateRaw(type, length + fade, sampleRate, random);
  // A view, not a copy: the tail beyond `length` is only read by the crossfade below.
  const out = raw.subarray(0, length);
  for (let i = 0; i < fade; i++) {
    const t = i / fade;
    out[i] = raw[i]! * Math.sqrt(t) + raw[length + i]! * Math.sqrt(1 - t);
  }
  normalize(out);
  return out;
}

/** Two independent channels, so the stereo width control has something to widen. */
export function generateStereoLoop(
  type: NoiseType,
  sampleRate: number,
  random: RandomSource = Math.random,
): [Samples, Samples] {
  const length = Math.round(sampleRate * LOOP_SECONDS);
  return [generateLoopChannel(type, length, sampleRate, random), generateLoopChannel(type, length, sampleRate, random)];
}

/** Creates an AudioBuffer holding a freshly generated stereo loop of the given type. */
export function createNoiseBuffer(ctx: BaseAudioContext, type: NoiseType): AudioBuffer {
  const channels = generateStereoLoop(type, ctx.sampleRate);
  const buffer = ctx.createBuffer(2, channels[0].length, ctx.sampleRate);
  buffer.copyToChannel(channels[0], 0);
  buffer.copyToChannel(channels[1], 1);
  return buffer;
}
