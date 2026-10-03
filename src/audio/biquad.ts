/** Normalised biquad coefficients (a0 = 1), from the RBJ Audio EQ Cookbook. */
export interface BiquadCoefficients {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
}

type ShelfKind = 'lowshelf' | 'highshelf' | 'peaking';

export function designBiquad(
  kind: ShelfKind,
  frequency: number,
  gainDb: number,
  q: number,
  sampleRate: number,
): BiquadCoefficients {
  const a = 10 ** (gainDb / 40);
  const w0 = (2 * Math.PI * frequency) / sampleRate;
  const cos = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * q);
  let b0: number, b1: number, b2: number, a0: number, a1: number, a2: number;

  if (kind === 'peaking') {
    b0 = 1 + alpha * a;
    b1 = -2 * cos;
    b2 = 1 - alpha * a;
    a0 = 1 + alpha / a;
    a1 = -2 * cos;
    a2 = 1 - alpha / a;
  } else {
    const sqrtA2alpha = 2 * Math.sqrt(a) * alpha;
    const sign = kind === 'lowshelf' ? 1 : -1;
    b0 = a * (a + 1 - sign * (a - 1) * cos + sqrtA2alpha);
    b1 = sign * 2 * a * (a - 1 - sign * (a + 1) * cos);
    b2 = a * (a + 1 - sign * (a - 1) * cos - sqrtA2alpha);
    a0 = a + 1 + sign * (a - 1) * cos + sqrtA2alpha;
    a1 = -sign * 2 * (a - 1 + sign * (a + 1) * cos);
    a2 = a + 1 + sign * (a - 1) * cos - sqrtA2alpha;
  }

  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
}

/** Filters the samples in place (direct form I). */
export function applyBiquad(samples: Float32Array, c: BiquadCoefficients): void {
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < samples.length; i++) {
    const x0 = samples[i]!;
    const y0 = c.b0 * x0 + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
    samples[i] = y0;
  }
}
