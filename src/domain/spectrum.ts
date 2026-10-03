import type { NoiseConfig, NoiseType } from './noise';

export const SPECTRUM_MIN_HZ = 20;
export const SPECTRUM_MAX_HZ = 20000;
export const SPECTRUM_FLOOR_DB = -48;

export interface SpectrumPoint {
  /** Horizontal position in [0, 1] on a logarithmic frequency axis. */
  x: number;
  frequency: number;
  /** Level relative to the loudest point, in [SPECTRUM_FLOOR_DB, 0]. */
  db: number;
}

const SLOPE_DB_PER_OCTAVE: Record<Exclude<NoiseType, 'grey'>, number> = {
  white: 0,
  pink: -3,
  brown: -6,
  blue: 3,
  violet: 6,
};

/** IEC 61672 A-weighting in dB (0 dB at 1 kHz). */
function aWeightingDb(f: number): number {
  const f2 = f * f;
  const ra =
    (12194 ** 2 * f2 * f2) /
    ((f2 + 20.6 ** 2) * Math.sqrt((f2 + 107.7 ** 2) * (f2 + 737.9 ** 2)) * (f2 + 12194 ** 2));
  return 20 * Math.log10(ra) + 2;
}

function sourceDb(type: NoiseType, f: number): number {
  if (type === 'grey') return Math.min(20, -aWeightingDb(f));
  return SLOPE_DB_PER_OCTAVE[type] * Math.log2(f / 1000);
}

/** Second-order Butterworth magnitudes, matching the Q = 0.707 filters of the audio graph. */
function highPassDb(f: number, cutoff: number): number {
  const r4 = (f / cutoff) ** 4;
  return 10 * Math.log10(r4 / (1 + r4));
}

function lowPassDb(f: number, cutoff: number): number {
  return -10 * Math.log10(1 + (f / cutoff) ** 4);
}

/** Theoretical spectrum shape of the configured noise, for display purposes. */
export function spectrumCurve(config: NoiseConfig, points = 96): SpectrumPoint[] {
  const span = Math.log(SPECTRUM_MAX_HZ / SPECTRUM_MIN_HZ);
  const raw = Array.from({ length: points }, (_, index) => {
    const x = index / (points - 1);
    const frequency = SPECTRUM_MIN_HZ * Math.exp(x * span);
    const db = sourceDb(config.type, frequency) + highPassDb(frequency, config.lowCut) + lowPassDb(frequency, config.highCut);
    return { x, frequency, db };
  });
  const peak = Math.max(...raw.map((point) => point.db));
  return raw.map((point) => ({ ...point, db: Math.max(SPECTRUM_FLOOR_DB, point.db - peak) }));
}
