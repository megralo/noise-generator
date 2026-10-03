import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from './noise';
import { SPECTRUM_FLOOR_DB, spectrumCurve } from './spectrum';

const open = { ...DEFAULT_CONFIG, lowCut: 20, highCut: 20000 };
const levelAt = (curve: ReturnType<typeof spectrumCurve>, hz: number) =>
  curve.reduce((best, point) => (Math.abs(point.frequency - hz) < Math.abs(best.frequency - hz) ? point : best)).db;

describe('spectrumCurve', () => {
  it('normalises the peak to 0 dB and respects the floor', () => {
    const curve = spectrumCurve({ ...open, type: 'brown' });
    expect(Math.max(...curve.map((p) => p.db))).toBeCloseTo(0, 6);
    expect(Math.min(...curve.map((p) => p.db))).toBeGreaterThanOrEqual(SPECTRUM_FLOOR_DB);
  });

  it('spans 20 Hz – 20 kHz on a logarithmic axis', () => {
    const curve = spectrumCurve(open, 4);
    expect(curve[0]!.frequency).toBeCloseTo(20, 6);
    expect(curve[3]!.frequency).toBeCloseTo(20000, 6);
    expect(curve[1]!.frequency).toBeCloseTo(200, 6);
  });

  it('tilts according to the noise colour', () => {
    const pink = spectrumCurve({ ...open, type: 'pink' });
    const violet = spectrumCurve({ ...open, type: 'violet' });
    // 100 Hz -> 1 kHz is 3.32 octaves; tolerance covers the sampling of the curve.
    expect(Math.abs(levelAt(pink, 100) - levelAt(pink, 1000) - 10)).toBeLessThan(1);
    expect(Math.abs(levelAt(violet, 1000) - levelAt(violet, 100) - 20)).toBeLessThan(1.5);
  });

  it('shows the effect of the filters', () => {
    const filtered = spectrumCurve({ ...open, type: 'white', lowCut: 500, highCut: 2000 });
    expect(levelAt(filtered, 1000)).toBeGreaterThan(levelAt(filtered, 100) + 20);
    expect(levelAt(filtered, 1000)).toBeGreaterThan(levelAt(filtered, 10000) + 20);
  });
});
