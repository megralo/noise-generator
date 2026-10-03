import { useCallback, useEffect, useMemo, useState } from 'react';
import type { NoiseConfig } from '../domain/noise';
import { BUILT_IN_PRESETS, createPresetId, validatePresetName, type Preset } from '../presets/presets';
import { STORAGE_KEY, getBrowserStorage, loadUserPresets, saveUserPresets } from '../presets/presetStorage';

export type PresetResult = { ok: true; preset: Preset } | { ok: false; error: string };

export interface PresetControls {
  builtIn: readonly Preset[];
  user: readonly Preset[];
  /** Non-blocking storage problem to show to the user. */
  storageWarning: string | null;
  save: (name: string, config: NoiseConfig) => PresetResult;
  rename: (id: string, name: string) => PresetResult;
  remove: (id: string) => void;
  dismissWarning: () => void;
}

interface PresetState {
  user: Preset[];
  warning: string | null;
}

/** @param storageOverride injected storage for tests; `null` simulates an unavailable storage. */
export function usePresets(storageOverride?: Storage | null): PresetControls {
  const [storage] = useState(() => (storageOverride === undefined ? getBrowserStorage() : storageOverride));
  const [state, setState] = useState<PresetState>(() => {
    const loaded = loadUserPresets(storage);
    return { user: loaded.presets, warning: loaded.warning ?? null };
  });

  // Another tab wrote the presets: reload them, or the next save here would overwrite that write.
  useEffect(() => {
    if (storage === null) return;
    const handleStorage = (event: StorageEvent) => {
      if (event.storageArea !== storage || (event.key !== null && event.key !== STORAGE_KEY)) return;
      const loaded = loadUserPresets(storage);
      setState((previous) => ({ user: loaded.presets, warning: loaded.warning ?? previous.warning }));
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [storage]);

  const commit = useCallback(
    (user: Preset[]) => {
      const warning = saveUserPresets(storage, user);
      setState((previous) => ({ user, warning: warning ?? previous.warning }));
    },
    [storage],
  );

  const allPresets = useMemo(() => [...BUILT_IN_PRESETS, ...state.user], [state.user]);

  const save = useCallback(
    (name: string, config: NoiseConfig): PresetResult => {
      const validation = validatePresetName(name, allPresets);
      if (!validation.ok) return validation;
      const preset: Preset = { id: createPresetId(), name: validation.name, config, builtIn: false };
      commit([...state.user, preset]);
      return { ok: true, preset };
    },
    [allPresets, commit, state.user],
  );

  const rename = useCallback(
    (id: string, name: string): PresetResult => {
      const target = state.user.find((preset) => preset.id === id);
      if (!target) return { ok: false, error: 'Preset non trovato.' };
      const validation = validatePresetName(name, allPresets, id);
      if (!validation.ok) return validation;
      const renamed = { ...target, name: validation.name };
      commit(state.user.map((preset) => (preset.id === id ? renamed : preset)));
      return { ok: true, preset: renamed };
    },
    [allPresets, commit, state.user],
  );

  const remove = useCallback(
    (id: string) => commit(state.user.filter((preset) => preset.id !== id)),
    [commit, state.user],
  );

  const dismissWarning = useCallback(() => setState((previous) => ({ ...previous, warning: null })), []);

  return {
    builtIn: BUILT_IN_PRESETS,
    user: state.user,
    storageWarning: state.warning,
    save,
    rename,
    remove,
    dismissWarning,
  };
}
