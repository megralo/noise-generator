import { memo, type CSSProperties } from 'react';
import { NOISE_TYPES, NOISE_TYPE_INFO, type NoiseType } from '../domain/noise';
import { PALETTES } from '../theme/sceneTheme';

interface NoiseTypeSelectorProps {
  value: NoiseType;
  onChange: (type: NoiseType) => void;
}

/** Native radio group: arrow-key navigation and screen reader semantics come for free. */
export const NoiseTypeSelector = memo(function NoiseTypeSelector({ value, onChange }: NoiseTypeSelectorProps) {
  return (
    <fieldset className="type-selector">
      <legend className="section-title">Colore del noise</legend>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {NOISE_TYPES.map((type) => {
          const info = NOISE_TYPE_INFO[type];
          const glow = PALETTES[type].glow;
          const style = { '--swatch': `hsl(${glow.h} ${glow.s}% ${glow.l}%)` } as CSSProperties;
          return (
            <label key={type} className="type-option" style={style}>
              <input
                type="radio"
                name="noise-type"
                value={type}
                checked={value === type}
                onChange={() => onChange(type)}
                className="type-option__input sr-only"
                aria-describedby={`noise-type-${type}-slope`}
              />
              <span className="type-option__card">
                <span className="type-option__swatch" aria-hidden="true" />
                <span className="type-option__name">{info.label}</span>
                <span id={`noise-type-${type}-slope`} className="type-option__slope">
                  {info.slope}
                </span>
              </span>
            </label>
          );
        })}
      </div>
      <p className="mt-3 min-h-[2.5rem] text-sm text-ink/70" aria-live="polite">
        {NOISE_TYPE_INFO[value].description}
      </p>
    </fieldset>
  );
});
