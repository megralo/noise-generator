import { sanitizeConfig } from '../domain/noise';
import { BUILT_IN_PRESETS, validatePresetName, type Preset } from './presets';

export const STORAGE_KEY = 'noise-generator.presets.v1';

export interface LoadResult {
  presets: Preset[];
  warning?: string;
}

/** Returns localStorage when usable; access itself can throw (privacy modes, sandboxed frames). */
export function getBrowserStorage(): Storage | null {
  try {
    const storage = window.localStorage;
    const probe = `${STORAGE_KEY}.probe`;
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}

/** Applies the same rules as the UI: stored data may have been edited by hand. */
function parsePreset(value: unknown, existing: readonly Preset[]): Preset | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== 'string' || record.id === '') return null;
  if (existing.some((preset) => preset.id === record.id)) return null;
  if (typeof record.name !== 'string') return null;
  const validation = validatePresetName(record.name, existing);
  if (!validation.ok) return null;
  const config = sanitizeConfig(record.config);
  if (!config) return null;
  return { id: record.id, name: validation.name, config, builtIn: false };
}

export function loadUserPresets(storage: Storage | null): LoadResult {
  if (!storage) {
    return { presets: [], warning: 'Archiviazione locale non disponibile: i preset personali non verranno salvati.' };
  }
  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return { presets: [], warning: 'Impossibile leggere i preset salvati.' };
  }
  if (raw === null) return { presets: [] };

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { presets: [], warning: 'I preset salvati erano danneggiati e sono stati ignorati.' };
  }
  if (!Array.isArray(data)) {
    return { presets: [], warning: 'I preset salvati erano danneggiati e sono stati ignorati.' };
  }

  const presets: Preset[] = [];
  const known: Preset[] = [...BUILT_IN_PRESETS];
  for (const item of data) {
    const preset = parsePreset(item, known);
    if (preset) {
      presets.push(preset);
      known.push(preset);
    }
  }
  const warning =
    presets.length < data.length ? 'Alcuni preset salvati non erano validi e sono stati ignorati.' : undefined;
  return { presets, warning };
}

/** Persists user presets; returns an error message when the write fails (e.g. quota exceeded). */
export function saveUserPresets(storage: Storage | null, presets: readonly Preset[]): string | null {
  if (!storage) return 'Archiviazione locale non disponibile: le modifiche valgono solo per questa sessione.';
  const data = presets.map(({ id, name, config }) => ({ id, name, config }));
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(data));
    return null;
  } catch {
    return 'Impossibile salvare i preset: spazio di archiviazione esaurito o non accessibile.';
  }
}
