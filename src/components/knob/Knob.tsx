import { memo, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { formatParam, fromNormalized, toNormalized, type ParamKey, type ParamSpec } from '../../domain/noise';
import { DRAG_PIXELS, FINE_DRAG_FACTOR, FINE_STEP, STEP, stepValue, valueForKey } from './knobInput';

interface KnobProps {
  spec: ParamSpec;
  value: number;
  /** Receives the parameter key, so one stable callback can serve every knob. */
  onChange: (key: ParamKey, value: number) => void;
}

const SWEEP_DEGREES = 270;
const START_DEGREES = -SWEEP_DEGREES / 2;
const TICKS = 11;
const CENTER = 50;
const ARC_RADIUS = 42;

function polar(radius: number, degrees: number): [number, number] {
  const radians = (degrees * Math.PI) / 180;
  return [CENTER + radius * Math.sin(radians), CENTER - radius * Math.cos(radians)];
}

const [arcStartX, arcStartY] = polar(ARC_RADIUS, START_DEGREES);
const [arcEndX, arcEndY] = polar(ARC_RADIUS, -START_DEGREES);
const ARC_PATH = `M ${arcStartX} ${arcStartY} A ${ARC_RADIUS} ${ARC_RADIUS} 0 1 1 ${arcEndX} ${arcEndY}`;

const TICK_LINES = Array.from({ length: TICKS }, (_, index) => {
  const degrees = START_DEGREES + (index / (TICKS - 1)) * SWEEP_DEGREES;
  const [x1, y1] = polar(47, degrees);
  const [x2, y2] = polar(index % 5 === 0 ? 50 : 49, degrees);
  return { x1, y1, x2, y2, major: index % 5 === 0 };
});

/**
 * Rotary control implementing the ARIA slider pattern.
 * Mouse: vertical drag, wheel, double click to reset. Shift fine-tunes.
 * Keyboard: arrows, Page Up/Down, Home/End, Delete to reset.
 * Memoised: with a stable `onChange`, moving one knob does not re-render the others.
 */
export const Knob = memo(function Knob({ spec, value, onChange }: KnobProps) {
  const id = useId();
  const controlRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; lastY: number; position: number } | null>(null);
  const latest = useRef({ spec, value, onChange });
  const [dragging, setDragging] = useState(false);

  // Layout effect: synced before the browser can deliver the next wheel event.
  useLayoutEffect(() => {
    latest.current = { spec, value, onChange };
  });

  // React registers wheel listeners as passive, so preventDefault needs a native listener.
  useEffect(() => {
    const element = controlRef.current;
    if (!element) return;
    const handleWheel = (event: WheelEvent) => {
      const delta = event.deltaY || event.deltaX;
      if (delta === 0) return;
      event.preventDefault();
      const current = latest.current;
      const next = stepValue(current.spec, current.value, (delta < 0 ? 1 : -1) * (event.shiftKey ? FINE_STEP : STEP));
      // Several wheel events can arrive before React re-renders: step from the value just sent.
      current.value = next;
      current.onChange(current.spec.key, next);
    };
    element.addEventListener('wheel', handleWheel, { passive: false });
    return () => element.removeEventListener('wheel', handleWheel);
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const next = valueForKey(spec, value, event.key, event.shiftKey);
    if (next === null) return;
    event.preventDefault();
    if (next !== value) onChange(spec.key, next);
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, lastY: event.clientY, position: toNormalized(spec, value) };
    setDragging(true);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const pixels = DRAG_PIXELS * (event.shiftKey ? FINE_DRAG_FACTOR : 1);
    // Accumulate the unrounded position so slow drags are not swallowed by rounding.
    drag.position = Math.min(1, Math.max(0, drag.position + (drag.lastY - event.clientY) / pixels));
    drag.lastY = event.clientY;
    const next = fromNormalized(spec, drag.position);
    if (next !== value) onChange(spec.key, next);
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
  };

  const position = toNormalized(spec, value);
  const formatted = formatParam(spec, value);
  const style = {
    '--knob-angle': `${START_DEGREES + position * SWEEP_DEGREES}deg`,
    '--knob-fill': position,
  } as CSSProperties;

  return (
    <div className="knob" style={style} data-dragging={dragging || undefined}>
      <div
        ref={controlRef}
        role="slider"
        tabIndex={0}
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-hint`}
        aria-valuemin={spec.min}
        aria-valuemax={spec.max}
        aria-valuenow={value}
        aria-valuetext={formatted}
        aria-orientation="vertical"
        className="knob__control"
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={() => onChange(spec.key, spec.defaultValue)}
      >
        <svg className="knob__svg" viewBox="0 0 100 100" aria-hidden="true">
          {TICK_LINES.map((tick, index) => (
            <line
              key={index}
              className={tick.major ? 'knob__tick knob__tick--major' : 'knob__tick'}
              x1={tick.x1}
              y1={tick.y1}
              x2={tick.x2}
              y2={tick.y2}
            />
          ))}
          <path className="knob__track" d={ARC_PATH} pathLength={100} />
          <path className="knob__value" d={ARC_PATH} pathLength={100} />
        </svg>
        <div className="knob__cap">
          <span className="knob__pointer" />
        </div>
      </div>
      <span id={`${id}-label`} className="knob__label">
        {spec.label}
      </span>
      <span className="knob__readout" aria-hidden="true">
        {formatted}
      </span>
      <span id={`${id}-hint`} className="sr-only">
        {spec.hint}. Trascina in verticale, usa la rotella o le frecce; Maiusc per regolazione fine; doppio clic o Canc
        per ripristinare.
      </span>
    </div>
  );
});
