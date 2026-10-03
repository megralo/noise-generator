import { describe, expect, it } from 'vitest';
import { NOISE_TYPES, type NoiseType } from '../domain/noise';
import { seededRandom } from '../test/helpers';
import { applyBiquad, designBiquad } from './biquad';
import { generateLoopChannel, generateStereoLoop } from './noiseBuffers';

const SAMPLE_RATE = 44100;
const LENGTH = SAMPLE_RATE; // one second is plenty for statistics

function stats(samples: Float32Array) {
  let sum = 0;
  let energy = 0;
  let peak = 0;
  let diffEnergy = 0;
  for (let i = 0; i < samples.length; i++) {
    const v = samples[i]!;
    sum += v;
    energy += v * v;
    peak = Math.max(peak, Math.abs(v));
    if (i > 0) diffEnergy += (v - samples[i - 1]!) ** 2;
  }
  return {
    mean: sum / samples.length,
    rms: Math.sqrt(energy / samples.length),
    peak,
    // Share of energy in the high frequencies: 0 for DC, up to 4 for Nyquist.
    brightness: diffEnergy / energy,
  };
}

/** Share of the energy below ~150 Hz, measured through a one-pole low-pass. */
function lowBandShare(samples: Float32Array): number {
  const a = 1 - Math.exp((-2 * Math.PI * 150) / SAMPLE_RATE);
  let y = 0;
  let low = 0;
  let total = 0;
  for (const x of samples) {
    y += a * (x - y);
    low += y * y;
    total += x * x;
  }
  return low / total;
}

describe('generateLoopChannel', () => {
  it.each(NOISE_TYPES)('%s noise is centred, normalised and within full scale', (type) => {
    const samples = generateLoopChannel(type, LENGTH, SAMPLE_RATE, seededRandom());
    const { mean, rms, peak } = stats(samples);
    expect(samples).toHaveLength(LENGTH);
    expect(Math.abs(mean)).toBeLessThan(1e-3);
    expect(peak).toBeLessThanOrEqual(0.98 + 1e-6);
    expect(rms).toBeGreaterThan(0.1);
    expect(rms).toBeLessThanOrEqual(0.2 + 1e-6);
  });

  it('orders the colours by spectral tilt', () => {
    const order: NoiseType[] = ['brown', 'pink', 'white', 'blue', 'violet'];
    const brightness = order.map((type) => stats(generateLoopChannel(type, LENGTH, SAMPLE_RATE, seededRandom())).brightness);
    for (let i = 1; i < brightness.length; i++) {
      expect(brightness[i]).toBeGreaterThan(brightness[i - 1]!);
    }
  });

  it('grey noise has more low-end than white noise', () => {
    const grey = lowBandShare(generateLoopChannel('grey', LENGTH, SAMPLE_RATE, seededRandom()));
    const white = lowBandShare(generateLoopChannel('white', LENGTH, SAMPLE_RATE, seededRandom()));
    expect(grey).toBeGreaterThan(white * 3);
  });

  it('joins the loop seamlessly even for brown noise', () => {
    const samples = generateLoopChannel('brown', LENGTH, SAMPLE_RATE, seededRandom(7));
    let maxStep = 0;
    for (let i = 1; i < samples.length; i++) maxStep = Math.max(maxStep, Math.abs(samples[i]! - samples[i - 1]!));
    const seam = Math.abs(samples[0]! - samples[samples.length - 1]!);
    expect(seam).toBeLessThanOrEqual(maxStep);
  });

  // Reference values recorded from the previous four-pass normalisation.
  const GOLDEN: Record<NoiseType, number[]> = {
    white: [0.0633721, -0.2404635, 0.3534082, 0.1866144, -0.0507395],
    pink: [0.0450046, -0.098606, 0.2786178, -0.0927053, -0.0205715],
    brown: [-0.0414362, -0.0886539, 0.1635132, -0.1734382, -0.0553758],
    blue: [0.0995618, -0.2208034, 0.4214681, 0.164084, 0.0215313],
    violet: [0.0803578, -0.215902, 0.3455859, 0.0204294, 0.0235813],
    grey: [0.0914484, -0.1948226, 0.3559781, -0.043166, 0.0278171],
  };

  it.each(NOISE_TYPES)('%s noise matches the reference samples', (type) => {
    const samples = generateLoopChannel(type, 4096, SAMPLE_RATE, seededRandom(1));
    [0, 1, 100, 2047, 4095].forEach((index, k) => {
      expect(samples[index]).toBeCloseTo(GOLDEN[type][k]!, 6);
    });
  });

  it('is deterministic for a given random source', () => {
    const a = generateLoopChannel('pink', 1000, SAMPLE_RATE, seededRandom(3));
    const b = generateLoopChannel('pink', 1000, SAMPLE_RATE, seededRandom(3));
    expect(a).toEqual(b);
  });

  it.each([0, -5, 1.5, Number.NaN])('rejects invalid length %s', (length) => {
    expect(() => generateLoopChannel('white', length, SAMPLE_RATE)).toThrow(RangeError);
  });
});

describe('generateStereoLoop', () => {
  it('produces two independent channels of the loop length', () => {
    const [left, right] = generateStereoLoop('white', 8000, seededRandom());
    expect(left).toHaveLength(8000 * 12);
    expect(right).toHaveLength(left.length);
    let correlation = 0;
    for (let i = 0; i < left.length; i++) correlation += left[i]! * right[i]!;
    const { rms } = stats(left);
    expect(Math.abs(correlation / left.length) / (rms * rms)).toBeLessThan(0.05);
  });
});

describe('biquad', () => {
  it('is transparent at 0 dB', () => {
    const c = designBiquad('peaking', 1000, 0, 1, SAMPLE_RATE);
    expect(c.b0).toBeCloseTo(1, 10);
    expect(c.b1).toBeCloseTo(c.a1, 10);
    expect(c.b2).toBeCloseTo(c.a2, 10);
  });

  it('a low shelf applies its gain at DC and not at Nyquist', () => {
    const c = designBiquad('lowshelf', 200, 12, 0.7, SAMPLE_RATE);
    const dcGainDb = 20 * Math.log10((c.b0 + c.b1 + c.b2) / (1 + c.a1 + c.a2));
    const nyquistGainDb = 20 * Math.log10(Math.abs((c.b0 - c.b1 + c.b2) / (1 - c.a1 + c.a2)));
    expect(dcGainDb).toBeCloseTo(12, 6);
    expect(nyquistGainDb).toBeCloseTo(0, 3);
  });

  it('a high shelf applies its gain at Nyquist and not at DC', () => {
    const c = designBiquad('highshelf', 8000, 6, 0.7, SAMPLE_RATE);
    const dcGainDb = 20 * Math.log10((c.b0 + c.b1 + c.b2) / (1 + c.a1 + c.a2));
    const nyquistGainDb = 20 * Math.log10(Math.abs((c.b0 - c.b1 + c.b2) / (1 - c.a1 + c.a2)));
    expect(dcGainDb).toBeCloseTo(0, 6);
    expect(nyquistGainDb).toBeCloseTo(6, 3);
  });

  it('filters in place', () => {
    const samples = new Float32Array([1, 0, 0, 0]);
    applyBiquad(samples, { b0: 0.5, b1: 0, b2: 0, a1: 0, a2: 0 });
    expect(Array.from(samples)).toEqual([0.5, 0, 0, 0]);
  });
});
