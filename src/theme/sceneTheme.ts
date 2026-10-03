import { PARAM_SPEC_BY_KEY, toNormalized, type NoiseConfig, type NoiseType } from '../domain/noise';

export interface Hsl {
  h: number;
  s: number;
  l: number;
}

/** Everything the background and accents need, derived from the sound. */
export interface SceneTheme {
  base: Hsl;
  glow: Hsl;
  accent: Hsl;
  /** Opacity of the main glow, follows the loudness. */
  glowAlpha: number;
  /** Horizontal size of the glow in percent, follows the stereo width. */
  spread: number;
  /** Breathing cycles per second, follows the modulation rate. */
  breatheRate: number;
  /** Breathing amount in [0, 1], follows the modulation depth. */
  breatheDepth: number;
}

interface Palette {
  base: Hsl;
  glow: Hsl;
  accent: Hsl;
}

/**
 * Each colour of noise gets the colour it is named after. Backgrounds stay dark
 * so light text keeps a comfortable contrast whatever the configuration.
 */
export const PALETTES: Record<NoiseType, Palette> = {
  white: { base: { h: 215, s: 14, l: 22 }, glow: { h: 210, s: 35, l: 90 }, accent: { h: 205, s: 45, l: 84 } },
  pink: { base: { h: 335, s: 38, l: 17 }, glow: { h: 340, s: 85, l: 72 }, accent: { h: 338, s: 90, l: 76 } },
  brown: { base: { h: 24, s: 45, l: 11 }, glow: { h: 28, s: 75, l: 50 }, accent: { h: 32, s: 85, l: 64 } },
  blue: { base: { h: 218, s: 60, l: 15 }, glow: { h: 205, s: 95, l: 60 }, accent: { h: 198, s: 95, l: 68 } },
  violet: { base: { h: 268, s: 50, l: 15 }, glow: { h: 276, s: 85, l: 66 }, accent: { h: 282, s: 90, l: 76 } },
  grey: { base: { h: 220, s: 6, l: 17 }, glow: { h: 220, s: 9, l: 64 }, accent: { h: 220, s: 12, l: 80 } },
};

const WARM_HUE = 28;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Signed shortest angular distance from one hue to another, in [-180, 180). */
function hueDelta(from: number, to: number): number {
  return ((((to - from) % 360) + 540) % 360) - 180;
}

/** Linear interpolation along the shortest way round the colour wheel. */
export function mixHue(from: number, to: number, t: number): number {
  return (from + hueDelta(from, to) * t + 360) % 360;
}

function mixHsl(a: Hsl, b: Hsl, t: number): Hsl {
  return { h: mixHue(a.h, b.h, t), s: a.s + (b.s - a.s) * t, l: a.l + (b.l - a.l) * t };
}

const mix = (a: number, b: number, t: number) => a + (b - a) * t;

export function soundToTheme(config: NoiseConfig, playing: boolean): SceneTheme {
  const palette = PALETTES[config.type];
  // 1 = fully open filter, 0 = darkest setting.
  const brightness = toNormalized(PARAM_SPEC_BY_KEY.highCut, config.highCut);
  const thinness = toNormalized(PARAM_SPEC_BY_KEY.lowCut, config.lowCut);
  const energy = (config.volume / 100) * (playing ? 1 : 0.35);

  const base: Hsl = {
    h: palette.base.h,
    s: clamp(palette.base.s - thinness * 8, 0, 100),
    l: clamp(palette.base.l - (1 - brightness) * 5 + thinness * 2, 4, 30),
  };
  const glow: Hsl = {
    h: mixHue(palette.glow.h, WARM_HUE, (1 - brightness) * 0.2 * (palette.glow.s / 100)),
    s: clamp(palette.glow.s - thinness * 15, 0, 100),
    l: clamp(palette.glow.l - (1 - brightness) * 14, 20, 95),
  };

  return {
    base,
    glow,
    accent: palette.accent,
    glowAlpha: clamp(0.14 + energy * 0.62, 0, 1),
    spread: 45 + (config.width / PARAM_SPEC_BY_KEY.width.max) * 35,
    breatheRate: config.modRate,
    breatheDepth: playing ? config.modDepth / 100 : 0,
  };
}

export function mixTheme(from: SceneTheme, to: SceneTheme, t: number): SceneTheme {
  return {
    base: mixHsl(from.base, to.base, t),
    glow: mixHsl(from.glow, to.glow, t),
    accent: mixHsl(from.accent, to.accent, t),
    glowAlpha: mix(from.glowAlpha, to.glowAlpha, t),
    spread: mix(from.spread, to.spread, t),
    breatheRate: mix(from.breatheRate, to.breatheRate, t),
    breatheDepth: mix(from.breatheDepth, to.breatheDepth, t),
  };
}

/** Frame-rate independent exponential approach towards the target. */
export function approachTheme(current: SceneTheme, target: SceneTheme, dtSeconds: number, tauSeconds: number): SceneTheme {
  return mixTheme(current, target, 1 - Math.exp(-dtSeconds / tauSeconds));
}

export function themesClose(a: SceneTheme, b: SceneTheme): boolean {
  const colors: [Hsl, Hsl][] = [
    [a.base, b.base],
    [a.glow, b.glow],
    [a.accent, b.accent],
  ];
  return (
    colors.every(([x, y]) => Math.abs(hueDelta(x.h, y.h)) < 0.2 && Math.abs(x.s - y.s) < 0.2 && Math.abs(x.l - y.l) < 0.2) &&
    Math.abs(a.glowAlpha - b.glowAlpha) < 0.002 &&
    Math.abs(a.spread - b.spread) < 0.1 &&
    Math.abs(a.breatheRate - b.breatheRate) < 0.001 &&
    Math.abs(a.breatheDepth - b.breatheDepth) < 0.002
  );
}

const hsl = (c: Hsl) => `${c.h.toFixed(1)} ${c.s.toFixed(1)}% ${c.l.toFixed(1)}%`;

export function themeToCssVars(theme: SceneTheme): Record<string, string> {
  return {
    '--bg': hsl(theme.base),
    '--glow': hsl(theme.glow),
    '--accent-h': theme.accent.h.toFixed(1),
    '--accent-s': `${theme.accent.s.toFixed(1)}%`,
    '--accent-l': `${theme.accent.l.toFixed(1)}%`,
    '--glow-alpha': theme.glowAlpha.toFixed(3),
    '--glow-spread': `${theme.spread.toFixed(1)}%`,
  };
}
