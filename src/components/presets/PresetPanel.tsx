import { useId, useRef, useState, type FormEvent } from 'react';
import type { NoiseConfig } from '../../domain/noise';
import type { PresetControls } from '../../hooks/usePresets';
import { MAX_PRESET_NAME_LENGTH, type Preset } from '../../presets/presets';
import { Notice } from '../Notice';
import { UserPresetItem } from './UserPresetItem';

interface PresetPanelProps {
  presets: PresetControls;
  config: NoiseConfig;
  activePresetId: string | null;
  modified: boolean;
  onApply: (preset: Preset) => void;
  onSaved: (preset: Preset) => void;
  onRemoved: (id: string) => void;
}

export function PresetPanel({ presets, config, activePresetId, modified, onApply, onSaved, onRemoved }: PresetPanelProps) {
  const id = useId();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [savedName, setSavedName] = useState<string | null>(null);
  const userHeadingRef = useRef<HTMLHeadingElement>(null);

  const active = [...presets.builtIn, ...presets.user].find((preset) => preset.id === activePresetId);

  const handleSave = (event: FormEvent) => {
    event.preventDefault();
    const result = presets.save(name, config);
    if (!result.ok) {
      setError(result.error);
      setSavedName(null);
      return;
    }
    setError(null);
    setName('');
    setSavedName(result.preset.name);
    onSaved(result.preset);
  };

  return (
    <section className="panel" aria-labelledby={`${id}-title`}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={`${id}-title`} className="section-title">
          Preset
        </h2>
        <p className="truncate text-xs text-ink/60" aria-live="polite">
          {active ? (
            <>
              <span className="text-ink/85">{active.name}</span>
              {modified && <span className="preset-badge">modificato</span>}
            </>
          ) : (
            'Configurazione libera'
          )}
        </p>
      </div>

      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Preset predefiniti">
        {presets.builtIn.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className="chip"
            aria-pressed={preset.id === activePresetId}
            onClick={() => onApply(preset)}
          >
            {preset.name}
          </button>
        ))}
      </div>

      <h3 ref={userHeadingRef} tabIndex={-1} className="mt-5 text-xs font-semibold uppercase tracking-[0.14em] text-ink/55 outline-none">
        I tuoi preset
      </h3>
      {presets.user.length === 0 ? (
        <p className="mt-2 text-sm text-ink/55">Nessun preset salvato. Regola le manopole e salvale qui sotto.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1.5" aria-label="Preset personali">
          {presets.user.map((preset) => (
            <UserPresetItem
              key={preset.id}
              preset={preset}
              active={preset.id === activePresetId}
              onApply={onApply}
              onRename={presets.rename}
              onRemove={(presetId) => {
                presets.remove(presetId);
                onRemoved(presetId);
                // The removed row held the focus: move it to a stable landmark.
                userHeadingRef.current?.focus();
              }}
            />
          ))}
        </ul>
      )}

      <form className="mt-4 flex flex-col gap-1" onSubmit={handleSave} noValidate>
        <label htmlFor={`${id}-name`} className="text-sm text-ink/75">
          Salva la configurazione corrente
        </label>
        <div className="flex gap-2">
          <input
            id={`${id}-name`}
            className="field min-w-0 flex-1"
            placeholder="Nome del preset"
            value={name}
            maxLength={MAX_PRESET_NAME_LENGTH}
            onChange={(event) => {
              setName(event.target.value);
              setError(null);
            }}
            aria-invalid={error !== null}
            aria-describedby={error ? `${id}-error` : undefined}
          />
          <button type="submit" className="button button--primary">
            Salva
          </button>
        </div>
        {error && (
          <p id={`${id}-error`} className="field-error" role="alert">
            {error}
          </p>
        )}
        {savedName && !error && (
          <p className="text-xs text-ink/65" role="status">
            Preset “{savedName}” salvato.
          </p>
        )}
      </form>

      {presets.storageWarning && (
        <div className="mt-4">
          <Notice tone="warning" onDismiss={presets.dismissWarning}>
            {presets.storageWarning}
          </Notice>
        </div>
      )}
    </section>
  );
}
