import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CONFIG,
  PARAM_SPECS,
  PARAM_SPEC_BY_KEY,
  clampParam,
  formatParam,
  fromNormalized,
  sanitizeConfig,
  toNormalized,
} from './noise';

describe('parameter mapping', () => {
  it.each(PARAM_SPECS.map((spec) => [spec.key, spec] as const))('%s maps the ends of the range to 0 and 1', (_, spec) => {
    expect(toNormalized(spec, spec.min)).toBe(0);
    expect(toNormalized(spec, spec.max)).toBeCloseTo(1, 10);
    expect(fromNormalized(spec, 0)).toBe(spec.min);
    expect(fromNormalized(spec, 1)).toBe(spec.max);
  });

  it('uses a logarithmic scale for frequencies', () => {
    const spec = PARAM_SPEC_BY_KEY.highCut;
    // Geometric mean of 1 kHz and 20 kHz sits in the middle of the travel.
    expect(toNormalized(spec, Math.sqrt(1000 * 20000))).toBeCloseTo(0.5, 6);
  });

  it('round-trips values through the knob position', () => {
    for (const spec of PARAM_SPECS) {
      expect(fromNormalized(spec, toNormalized(spec, spec.defaultValue))).toBe(spec.defaultValue);
    }
  });

  it('clamps positions outside [0, 1]', () => {
    const spec = PARAM_SPEC_BY_KEY.volume;
    expect(fromNormalized(spec, -3)).toBe(0);
    expect(fromNormalized(spec, 7)).toBe(100);
  });
});

describe('clampParam', () => {
  const spec = PARAM_SPEC_BY_KEY.modRate;

  it('clamps and rounds to the spec precision', () => {
    expect(clampParam(spec, 0.123456)).toBe(0.12);
    expect(clampParam(spec, 99)).toBe(2);
    expect(clampParam(spec, -1)).toBe(0.05);
  });

  it('falls back to the default for non-finite input', () => {
    expect(clampParam(spec, Number.NaN)).toBe(spec.defaultValue);
    expect(clampParam(spec, Number.POSITIVE_INFINITY)).toBe(spec.defaultValue);
  });
});

describe('formatParam', () => {
  it('formats with Italian separators and kHz above 1000 Hz', () => {
    expect(formatParam(PARAM_SPEC_BY_KEY.highCut, 12000)).toBe('12,0 kHz');
    expect(formatParam(PARAM_SPEC_BY_KEY.highCut, 1500)).toBe('1,50 kHz');
    expect(formatParam(PARAM_SPEC_BY_KEY.lowCut, 120)).toBe('120 Hz');
    expect(formatParam(PARAM_SPEC_BY_KEY.modRate, 0.2)).toBe('0,20 Hz');
    expect(formatParam(PARAM_SPEC_BY_KEY.volume, 60)).toBe('60 %');
  });
});

describe('sanitizeConfig', () => {
  it('accepts a valid config and clamps values', () => {
    expect(sanitizeConfig({ ...DEFAULT_CONFIG, volume: 250 })).toEqual({ ...DEFAULT_CONFIG, volume: 100 });
  });

  it.each([
    ['null', null],
    ['a string', 'pink'],
    ['an unknown type', { ...DEFAULT_CONFIG, type: 'green' }],
    ['a missing parameter', { type: 'pink', volume: 10 }],
    ['a non-numeric parameter', { ...DEFAULT_CONFIG, width: '100' }],
  ])('rejects %s', (_, input) => {
    expect(sanitizeConfig(input)).toBeNull();
  });
});
