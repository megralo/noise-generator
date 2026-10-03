import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../domain/noise';
import { configReducer, initialConfigState, type ConfigState } from './configReducer';

const loaded: ConfigState = { config: { ...DEFAULT_CONFIG, type: 'brown' }, activePresetId: 'p1', modified: false };

describe('configReducer', () => {
  it('sets a clamped parameter', () => {
    const next = configReducer(initialConfigState, { kind: 'setParam', key: 'volume', value: 180 });
    expect(next.config.volume).toBe(100);
    expect(next.modified).toBe(false);
  });

  it('returns the same state when nothing changes', () => {
    const same = configReducer(initialConfigState, { kind: 'setParam', key: 'volume', value: DEFAULT_CONFIG.volume });
    expect(same).toBe(initialConfigState);
    expect(configReducer(initialConfigState, { kind: 'setType', type: DEFAULT_CONFIG.type })).toBe(initialConfigState);
  });

  it('marks a loaded preset as modified after an edit', () => {
    expect(configReducer(loaded, { kind: 'setParam', key: 'width', value: 20 }).modified).toBe(true);
    expect(configReducer(loaded, { kind: 'setType', type: 'blue' }).modified).toBe(true);
  });

  it('loads a configuration and resets the modified flag', () => {
    const modified = { ...loaded, modified: true };
    const next = configReducer(modified, { kind: 'load', config: DEFAULT_CONFIG, presetId: null });
    expect(next).toEqual({ config: DEFAULT_CONFIG, activePresetId: null, modified: false });
  });

  it('forgets the active preset when it is removed', () => {
    expect(configReducer(loaded, { kind: 'presetRemoved', presetId: 'p1' }).activePresetId).toBeNull();
    expect(configReducer(loaded, { kind: 'presetRemoved', presetId: 'other' })).toBe(loaded);
  });
});
