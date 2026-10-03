import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, sanitizeConfig } from '../domain/noise';
import { MemoryStorage } from '../test/helpers';
import { STORAGE_KEY, loadUserPresets, saveUserPresets } from './presetStorage';
import { BUILT_IN_PRESETS, MAX_PRESET_NAME_LENGTH, createPresetId, validatePresetName, type Preset } from './presets';

const userPreset = (id: string, name: string): Preset => ({ id, name, config: DEFAULT_CONFIG, builtIn: false });

describe('BUILT_IN_PRESETS', () => {
  it('contain only valid configurations and unique ids', () => {
    for (const preset of BUILT_IN_PRESETS) expect(sanitizeConfig(preset.config)).toEqual(preset.config);
    expect(new Set(BUILT_IN_PRESETS.map((p) => p.id)).size).toBe(BUILT_IN_PRESETS.length);
  });
});

describe('validatePresetName', () => {
  const existing = [...BUILT_IN_PRESETS, userPreset('u1', 'Notte')];

  it('normalises whitespace', () => {
    expect(validatePresetName('  Mio   preset ', existing)).toEqual({ ok: true, name: 'Mio preset' });
  });

  it.each([
    ['empty', '   '],
    ['too long', 'x'.repeat(MAX_PRESET_NAME_LENGTH + 1)],
    ['a duplicate of a built-in (case-insensitive)', 'pioggia'],
    ['a duplicate of a user preset', 'NOTTE'],
  ])('rejects a name that is %s', (_, name) => {
    expect(validatePresetName(name, existing).ok).toBe(false);
  });

  it('allows keeping the same name when renaming', () => {
    expect(validatePresetName('Notte', existing, 'u1')).toEqual({ ok: true, name: 'Notte' });
  });
});

describe('createPresetId', () => {
  it('generates distinct ids', () => {
    const ids = new Set(Array.from({ length: 50 }, createPresetId));
    expect(ids.size).toBe(50);
  });
});

describe('preset storage', () => {
  it('round-trips user presets', () => {
    const storage = new MemoryStorage();
    const presets = [userPreset('a', 'Uno'), userPreset('b', 'Due')];
    expect(saveUserPresets(storage, presets)).toBeNull();
    expect(loadUserPresets(storage)).toEqual({ presets, warning: undefined });
  });

  it('starts empty without warnings when nothing is stored', () => {
    expect(loadUserPresets(new MemoryStorage())).toEqual({ presets: [] });
  });

  it('warns when storage is unavailable', () => {
    expect(loadUserPresets(null).warning).toBeDefined();
    expect(saveUserPresets(null, [])).not.toBeNull();
  });

  it.each([
    ['invalid JSON', '{not json'],
    ['a non-array value', '{"id":"a"}'],
  ])('ignores %s with a warning', (_, raw) => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, raw);
    const result = loadUserPresets(storage);
    expect(result.presets).toEqual([]);
    expect(result.warning).toContain('danneggiati');
  });

  it('keeps valid entries and drops invalid or duplicated ones', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { id: 'a', name: 'Buono', config: DEFAULT_CONFIG },
        { id: 'b', name: '', config: DEFAULT_CONFIG },
        { id: 'c', name: 'Tipo errato', config: { ...DEFAULT_CONFIG, type: 'green' } },
        { id: 'a', name: 'Duplicato', config: DEFAULT_CONFIG },
        42,
      ]),
    );
    const result = loadUserPresets(storage);
    expect(result.presets.map((p) => p.name)).toEqual(['Buono']);
    expect(result.warning).toContain('non erano validi');
  });

  it('normalises stored names and drops the ones that clash, as the UI would', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { id: 'a', name: '  Studio   notte ', config: DEFAULT_CONFIG },
        { id: 'b', name: 'studio NOTTE', config: DEFAULT_CONFIG },
        { id: 'c', name: 'pioggia', config: DEFAULT_CONFIG },
        { id: BUILT_IN_PRESETS[0]!.id, name: 'Rubato', config: DEFAULT_CONFIG },
      ]),
    );
    const result = loadUserPresets(storage);
    expect(result.presets.map((p) => p.name)).toEqual(['Studio notte']);
    expect(result.warning).toContain('non erano validi');
  });

  it('reports write failures such as an exceeded quota', () => {
    const storage = new MemoryStorage();
    storage.failWrites = true;
    expect(saveUserPresets(storage, [userPreset('a', 'Uno')])).toContain('Impossibile salvare');
  });

  it('reports read failures', () => {
    const storage = new MemoryStorage();
    storage.getItem = () => {
      throw new DOMException('denied', 'SecurityError');
    };
    expect(loadUserPresets(storage).warning).toContain('Impossibile leggere');
  });
});
