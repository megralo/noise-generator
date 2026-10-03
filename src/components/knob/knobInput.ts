import { clampParam, fromNormalized, toNormalized, type ParamSpec } from '../../domain/noise';

/** Steps expressed as a fraction of the knob travel. */
export const STEP = 0.01;
export const FINE_STEP = 0.002;
export const PAGE_STEP = 0.1;
/** Vertical pixels for a full sweep while dragging; multiplied when fine-tuning. */
export const DRAG_PIXELS = 220;
export const FINE_DRAG_FACTOR = 5;

/** Moves the knob by a fraction of its travel, guaranteeing visible progress despite rounding. */
export function stepValue(spec: ParamSpec, value: number, delta: number): number {
  const next = fromNormalized(spec, toNormalized(spec, value) + delta);
  if (next !== value || delta === 0) return next;
  return clampParam(spec, value + Math.sign(delta) * 10 ** -spec.decimals);
}

/** Maps a key press to the new value, or null when the key is not handled. */
export function valueForKey(spec: ParamSpec, value: number, key: string, fine: boolean): number | null {
  const step = fine ? FINE_STEP : STEP;
  switch (key) {
    case 'ArrowUp':
    case 'ArrowRight':
      return stepValue(spec, value, step);
    case 'ArrowDown':
    case 'ArrowLeft':
      return stepValue(spec, value, -step);
    case 'PageUp':
      return stepValue(spec, value, PAGE_STEP);
    case 'PageDown':
      return stepValue(spec, value, -PAGE_STEP);
    case 'Home':
      return spec.min;
    case 'End':
      return spec.max;
    case 'Delete':
    case 'Backspace':
      return spec.defaultValue;
    default:
      return null;
  }
}
