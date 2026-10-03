import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, NOISE_TYPES } from '../domain/noise';
import { approachTheme, mixHue, soundToTheme, themeToCssVars, themesClose } from './sceneTheme';

describe('mixHue', () => {
  it('takes the shortest way round the colour wheel', () => {
    expect(mixHue(350, 10, 0.5)).toBeCloseTo(0, 6);
    expect(mixHue(10, 350, 0.5)).toBeCloseTo(0, 6);
    expect(mixHue(100, 200, 0.5)).toBeCloseTo(150, 6);
  });
});

describe('soundToTheme', () => {
  it('gives every noise colour a distinct background', () => {
    const backgrounds = NOISE_TYPES.map((type) => themeToCssVars(soundToTheme({ ...DEFAULT_CONFIG, type }, true))['--bg']);
    expect(new Set(backgrounds).size).toBe(NOISE_TYPES.length);
  });

  it('keeps backgrounds dark enough for light text', () => {
    for (const type of NOISE_TYPES) {
      for (const highCut of [1000, 20000]) {
        for (const lowCut of [20, 1000]) {
          const theme = soundToTheme({ ...DEFAULT_CONFIG, type, highCut, lowCut }, true);
          expect(theme.base.l).toBeLessThanOrEqual(30);
        }
      }
    }
  });

  it('darkens the scene when high frequencies are cut', () => {
    const open = soundToTheme({ ...DEFAULT_CONFIG, highCut: 20000 }, true);
    const muffled = soundToTheme({ ...DEFAULT_CONFIG, highCut: 1000 }, true);
    expect(muffled.base.l).toBeLessThan(open.base.l);
    expect(muffled.glow.l).toBeLessThan(open.glow.l);
  });

  it('follows loudness, stereo width and playback state', () => {
    const quiet = soundToTheme({ ...DEFAULT_CONFIG, volume: 10 }, true);
    const loud = soundToTheme({ ...DEFAULT_CONFIG, volume: 90 }, true);
    expect(loud.glowAlpha).toBeGreaterThan(quiet.glowAlpha);
    expect(soundToTheme({ ...DEFAULT_CONFIG, volume: 90 }, false).glowAlpha).toBeLessThan(loud.glowAlpha);
    expect(soundToTheme({ ...DEFAULT_CONFIG, width: 150 }, true).spread).toBeGreaterThan(
      soundToTheme({ ...DEFAULT_CONFIG, width: 0 }, true).spread,
    );
  });

  it('breathes only while playing with some modulation', () => {
    const config = { ...DEFAULT_CONFIG, modDepth: 50, modRate: 0.5 };
    expect(soundToTheme(config, true)).toMatchObject({ breatheDepth: 0.5, breatheRate: 0.5 });
    expect(soundToTheme(config, false).breatheDepth).toBe(0);
  });
});

describe('approachTheme', () => {
  it('converges gradually towards the target', () => {
    const from = soundToTheme({ ...DEFAULT_CONFIG, type: 'brown' }, true);
    const to = soundToTheme({ ...DEFAULT_CONFIG, type: 'blue' }, true);
    const step = approachTheme(from, to, 1 / 60, 0.7);
    expect(themesClose(step, to)).toBe(false);
    expect(themesClose(step, from)).toBe(false);

    let current = from;
    for (let frame = 0; frame < 60 * 10; frame++) current = approachTheme(current, to, 1 / 60, 0.7);
    expect(themesClose(current, to)).toBe(true);
  });
});
