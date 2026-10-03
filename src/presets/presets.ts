import type { NoiseConfig } from '../domain/noise';

export interface Preset {
  id: string;
  name: string;
  config: NoiseConfig;
  builtIn: boolean;
}

export const MAX_PRESET_NAME_LENGTH = 40;

export const BUILT_IN_PRESETS: readonly Preset[] = [
  {
    id: 'builtin-rain',
    name: 'Pioggia',
    builtIn: true,
    config: { type: 'pink', volume: 55, lowCut: 120, highCut: 9000, width: 120, modRate: 0.15, modDepth: 20 },
  },
  {
    id: 'builtin-ocean',
    name: 'Oceano',
    builtIn: true,
    config: { type: 'brown', volume: 65, lowCut: 30, highCut: 3500, width: 130, modRate: 0.08, modDepth: 65 },
  },
  {
    id: 'builtin-focus',
    name: 'Focus',
    builtIn: true,
    config: { type: 'grey', volume: 45, lowCut: 60, highCut: 12000, width: 100, modRate: 0.1, modDepth: 0 },
  },
  {
    id: 'builtin-sleep',
    name: 'Sonno profondo',
    builtIn: true,
    config: { type: 'brown', volume: 50, lowCut: 20, highCut: 1200, width: 80, modRate: 0.05, modDepth: 15 },
  },
  {
    id: 'builtin-fan',
    name: 'Ventola',
    builtIn: true,
    config: { type: 'pink', volume: 60, lowCut: 80, highCut: 2500, width: 60, modRate: 1.2, modDepth: 8 },
  },
  {
    id: 'builtin-waterfall',
    name: 'Cascata',
    builtIn: true,
    config: { type: 'white', volume: 55, lowCut: 200, highCut: 14000, width: 140, modRate: 0.3, modDepth: 10 },
  },
];

export type NameValidation = { ok: true; name: string } | { ok: false; error: string };

/** Trims and collapses whitespace, then checks length and uniqueness (case-insensitive). */
export function validatePresetName(
  input: string,
  existing: readonly Preset[],
  ignoreId?: string,
): NameValidation {
  const name = input.trim().replace(/\s+/g, ' ');
  if (name === '') return { ok: false, error: 'Inserisci un nome per il preset.' };
  if (name.length > MAX_PRESET_NAME_LENGTH) {
    return { ok: false, error: `Il nome può contenere al massimo ${MAX_PRESET_NAME_LENGTH} caratteri.` };
  }
  const lower = name.toLocaleLowerCase('it-IT');
  const clash = existing.some((preset) => preset.id !== ignoreId && preset.name.toLocaleLowerCase('it-IT') === lower);
  if (clash) return { ok: false, error: `Esiste già un preset chiamato "${name}".` };
  return { ok: true, name };
}

export function createPresetId(): string {
  return `user-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
