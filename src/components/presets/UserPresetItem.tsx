import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import type { PresetResult } from '../../hooks/usePresets';
import { MAX_PRESET_NAME_LENGTH, type Preset } from '../../presets/presets';

interface UserPresetItemProps {
  preset: Preset;
  active: boolean;
  onApply: (preset: Preset) => void;
  onRename: (id: string, name: string) => PresetResult;
  onRemove: (id: string) => void;
}

type Mode = 'view' | 'rename' | 'confirmDelete';

export function UserPresetItem({ preset, active, onApply, onRename, onRemove }: UserPresetItemProps) {
  const id = useId();
  const [mode, setMode] = useState<Mode>('view');
  const [draft, setDraft] = useState(preset.name);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const applyRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (mode === 'rename') inputRef.current?.select();
    if (mode === 'confirmDelete') cancelRef.current?.focus();
  }, [mode]);

  const backToView = () => {
    setMode('view');
    setError(null);
    // Return focus to the row so keyboard users do not lose their place.
    requestAnimationFrame(() => applyRef.current?.focus());
  };

  const submitRename = (event: FormEvent) => {
    event.preventDefault();
    const result = onRename(preset.id, draft);
    if (result.ok) backToView();
    else setError(result.error);
  };

  if (mode === 'rename') {
    return (
      <li className="preset-row">
        <form className="flex w-full flex-col gap-1" onSubmit={submitRename}>
          <label htmlFor={`${id}-name`} className="sr-only">
            Nuovo nome per {preset.name}
          </label>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              id={`${id}-name`}
              className="field min-w-0 flex-1"
              value={draft}
              maxLength={MAX_PRESET_NAME_LENGTH}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => event.key === 'Escape' && backToView()}
              aria-invalid={error !== null}
              aria-describedby={error ? `${id}-error` : undefined}
            />
            <button type="submit" className="button button--primary">
              Salva
            </button>
            <button type="button" className="button" onClick={backToView}>
              Annulla
            </button>
          </div>
          {error && (
            <p id={`${id}-error`} className="field-error" role="alert">
              {error}
            </p>
          )}
        </form>
      </li>
    );
  }

  if (mode === 'confirmDelete') {
    return (
      <li className="preset-row preset-row--danger">
        <span className="min-w-0 flex-1 truncate text-sm">
          Eliminare <strong>{preset.name}</strong>?
        </span>
        <button type="button" className="button button--danger" onClick={() => onRemove(preset.id)}>
          Elimina
        </button>
        <button ref={cancelRef} type="button" className="button" onClick={backToView}>
          Annulla
        </button>
      </li>
    );
  }

  return (
    <li className="preset-row">
      <button
        ref={applyRef}
        type="button"
        className="preset-row__apply"
        aria-pressed={active}
        onClick={() => onApply(preset)}
      >
        <span className="truncate">{preset.name}</span>
      </button>
      <button
        type="button"
        className="icon-button"
        aria-label={`Rinomina ${preset.name}`}
        onClick={() => {
          setDraft(preset.name);
          setMode('rename');
        }}
      >
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M4 14.5V16h1.5l8.8-8.8-1.5-1.5L4 14.5zM12.8 5.7l1.5 1.5 1.2-1.2a1 1 0 000-1.4l-.1-.1a1 1 0 00-1.4 0l-1.2 1.2z" />
        </svg>
      </button>
      <button
        type="button"
        className="icon-button icon-button--danger"
        aria-label={`Elimina ${preset.name}`}
        onClick={() => setMode('confirmDelete')}
      >
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M5 6h10M8 6V4.5h4V6M6.5 6l.7 9.5h5.6l.7-9.5" />
        </svg>
      </button>
    </li>
  );
}
