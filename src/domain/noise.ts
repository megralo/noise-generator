export const NOISE_TYPES = ['white', 'pink', 'brown', 'blue', 'violet', 'grey'] as const;

export type NoiseType = (typeof NOISE_TYPES)[number];

export interface NoiseConfig {
  type: NoiseType;
  volume: number;
  lowCut: number;
  highCut: number;
  width: number;
  modRate: number;
  modDepth: number;
}

export type ParamKey = Exclude<keyof NoiseConfig, 'type'>;

export interface ParamSpec {
  key: ParamKey;
  /** Stable identifier used by the CSV format. */
  csvKey: string;
  label: string;
  hint: string;
  unit: string;
  min: number;
  max: number;
  defaultValue: number;
  scale: 'linear' | 'log';
  decimals: number;
}

export interface NoiseTypeInfo {
  label: string;
  slope: string;
  description: string;
}

export const NOISE_TYPE_INFO: Record<NoiseType, NoiseTypeInfo> = {
  white: { label: 'White', slope: '0 dB/ott', description: 'Energia uguale su tutte le frequenze, brillante e frusciante.' },
  pink: { label: 'Pink', slope: '−3 dB/ott', description: 'Bilanciato e naturale, come pioggia costante.' },
  brown: { label: 'Brown', slope: '−6 dB/ott', description: 'Profondo e caldo, come un fiume o un tuono lontano.' },
  blue: { label: 'Blue', slope: '+3 dB/ott', description: 'Acuto e frizzante, come uno spruzzo d’acqua.' },
  violet: { label: 'Violet', slope: '+6 dB/ott', description: 'Sibilante e sottile, concentrato sugli acuti.' },
  grey: { label: 'Grey', slope: 'curva uditiva', description: 'Percepito uniforme dall’orecchio umano.' },
};

export const PARAM_SPECS: readonly ParamSpec[] = [
  { key: 'volume', csvKey: 'volume', label: 'Volume', hint: 'Livello di uscita', unit: '%', min: 0, max: 100, defaultValue: 60, scale: 'linear', decimals: 0 },
  { key: 'lowCut', csvKey: 'low_cut', label: 'Low-cut', hint: 'Taglia le frequenze gravi', unit: 'Hz', min: 20, max: 1000, defaultValue: 20, scale: 'log', decimals: 0 },
  { key: 'highCut', csvKey: 'high_cut', label: 'High-cut', hint: 'Taglia le frequenze acute', unit: 'Hz', min: 1000, max: 20000, defaultValue: 20000, scale: 'log', decimals: 0 },
  { key: 'width', csvKey: 'stereo_width', label: 'Stereo', hint: 'Ampiezza dell’immagine stereo', unit: '%', min: 0, max: 150, defaultValue: 100, scale: 'linear', decimals: 0 },
  { key: 'modRate', csvKey: 'mod_rate', label: 'Onda', hint: 'Velocità della modulazione', unit: 'Hz', min: 0.05, max: 2, defaultValue: 0.2, scale: 'log', decimals: 2 },
  { key: 'modDepth', csvKey: 'mod_depth', label: 'Profondità', hint: 'Intensità della modulazione', unit: '%', min: 0, max: 100, defaultValue: 0, scale: 'linear', decimals: 0 },
];

export const PARAM_SPEC_BY_KEY = Object.fromEntries(PARAM_SPECS.map((spec) => [spec.key, spec])) as Record<
  ParamKey,
  ParamSpec
>;

export const DEFAULT_CONFIG: NoiseConfig = {
  type: 'pink',
  ...(Object.fromEntries(PARAM_SPECS.map((spec) => [spec.key, spec.defaultValue])) as Record<ParamKey, number>),
};

export function isNoiseType(value: string): value is NoiseType {
  return (NOISE_TYPES as readonly string[]).includes(value);
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Clamps to the spec range and rounds to the spec precision. */
export function clampParam(spec: ParamSpec, value: number): number {
  if (!Number.isFinite(value)) return spec.defaultValue;
  return roundTo(Math.min(spec.max, Math.max(spec.min, value)), spec.decimals);
}

/** Maps a value to the knob position in [0, 1]. */
export function toNormalized(spec: ParamSpec, value: number): number {
  const clamped = Math.min(spec.max, Math.max(spec.min, value));
  if (spec.scale === 'log') {
    return Math.log(clamped / spec.min) / Math.log(spec.max / spec.min);
  }
  return (clamped - spec.min) / (spec.max - spec.min);
}

/** Maps a knob position in [0, 1] back to a clamped, rounded value. */
export function fromNormalized(spec: ParamSpec, position: number): number {
  const p = Math.min(1, Math.max(0, position));
  const raw = spec.scale === 'log' ? spec.min * (spec.max / spec.min) ** p : spec.min + p * (spec.max - spec.min);
  return clampParam(spec, raw);
}

const numberFormatters = new Map<number, Intl.NumberFormat>();

function formatNumber(value: number, decimals: number): string {
  let formatter = numberFormatters.get(decimals);
  if (!formatter) {
    formatter = new Intl.NumberFormat('it-IT', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    numberFormatters.set(decimals, formatter);
  }
  return formatter.format(value);
}

/** Human readable value, also used as aria-valuetext. */
export function formatParam(spec: ParamSpec, value: number): string {
  if (spec.unit === 'Hz' && value >= 1000) {
    return `${formatNumber(value / 1000, value >= 10000 ? 1 : 2)} kHz`;
  }
  return `${formatNumber(value, spec.decimals)} ${spec.unit}`;
}

/**
 * Builds a valid config from untrusted data (storage, imports).
 * Returns null when the shape is not recognisable.
 */
export function sanitizeConfig(input: unknown): NoiseConfig | null {
  if (typeof input !== 'object' || input === null) return null;
  const record = input as Record<string, unknown>;
  if (typeof record.type !== 'string' || !isNoiseType(record.type)) return null;
  const config: NoiseConfig = { ...DEFAULT_CONFIG, type: record.type };
  for (const spec of PARAM_SPECS) {
    const value = record[spec.key];
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    config[spec.key] = clampParam(spec, value);
  }
  return config;
}
