import { DEFAULT_CONFIG, PARAM_SPEC_BY_KEY, clampParam, type NoiseConfig, type NoiseType, type ParamKey } from '../domain/noise';

export interface ConfigState {
  config: NoiseConfig;
  /** Preset the current configuration was loaded from, if any. */
  activePresetId: string | null;
  /** True once the user changes something after loading a preset. */
  modified: boolean;
}

export type ConfigAction =
  | { kind: 'setParam'; key: ParamKey; value: number }
  | { kind: 'setType'; type: NoiseType }
  | { kind: 'load'; config: NoiseConfig; presetId: string | null }
  | { kind: 'presetRemoved'; presetId: string };

export const initialConfigState: ConfigState = {
  config: DEFAULT_CONFIG,
  activePresetId: null,
  modified: false,
};

export function configReducer(state: ConfigState, action: ConfigAction): ConfigState {
  switch (action.kind) {
    case 'setParam': {
      const value = clampParam(PARAM_SPEC_BY_KEY[action.key], action.value);
      if (state.config[action.key] === value) return state;
      return { ...state, config: { ...state.config, [action.key]: value }, modified: state.activePresetId !== null };
    }
    case 'setType':
      if (state.config.type === action.type) return state;
      return { ...state, config: { ...state.config, type: action.type }, modified: state.activePresetId !== null };
    case 'load':
      return { config: action.config, activePresetId: action.presetId, modified: false };
    case 'presetRemoved':
      if (state.activePresetId !== action.presetId) return state;
      return { ...state, activePresetId: null, modified: false };
  }
}
