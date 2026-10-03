import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useCallback, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { PARAM_SPEC_BY_KEY, type ParamKey, type ParamSpec } from '../../domain/noise';
import { Knob } from './Knob';
import { STEP, stepValue, valueForKey } from './knobInput';

function ControlledKnob({ spec, initial, onChange }: { spec: ParamSpec; initial: number; onChange?: (v: number) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <Knob
      spec={spec}
      value={value}
      onChange={(_, next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}

const volume = PARAM_SPEC_BY_KEY.volume;
const highCut = PARAM_SPEC_BY_KEY.highCut;

describe('knob input helpers', () => {
  it('always makes progress despite rounding', () => {
    expect(stepValue(volume, 50, 0.002)).toBe(51);
    expect(stepValue(volume, 50, -0.002)).toBe(49);
    expect(stepValue(volume, 100, 0.01)).toBe(100);
  });

  it('ignores unrelated keys', () => {
    expect(valueForKey(volume, 50, 'a', false)).toBeNull();
    expect(valueForKey(volume, 50, 'Tab', false)).toBeNull();
  });
});

describe('Knob', () => {
  it('exposes the ARIA slider semantics', () => {
    render(<Knob spec={highCut} value={12000} onChange={() => {}} />);
    const slider = screen.getByRole('slider', { name: 'High-cut' });
    expect(slider.getAttribute('aria-valuemin')).toBe('1000');
    expect(slider.getAttribute('aria-valuemax')).toBe('20000');
    expect(slider.getAttribute('aria-valuenow')).toBe('12000');
    expect(slider.getAttribute('aria-valuetext')).toBe('12,0 kHz');
    expect(slider.getAttribute('tabindex')).toBe('0');
    expect(slider.getAttribute('aria-describedby')).toBeTruthy();
  });

  it('responds to arrows, Page Up/Down, Home/End and Delete', async () => {
    const user = userEvent.setup();
    render(<ControlledKnob spec={volume} initial={50} />);
    const slider = screen.getByRole('slider', { name: 'Volume' });
    slider.focus();

    await user.keyboard('{ArrowUp}');
    expect(slider.getAttribute('aria-valuenow')).toBe('51');
    await user.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(slider.getAttribute('aria-valuenow')).toBe('49');
    await user.keyboard('{PageUp}');
    expect(slider.getAttribute('aria-valuenow')).toBe('59');
    await user.keyboard('{PageDown}');
    expect(slider.getAttribute('aria-valuenow')).toBe('49');
    await user.keyboard('{End}');
    expect(slider.getAttribute('aria-valuenow')).toBe('100');
    await user.keyboard('{Home}');
    expect(slider.getAttribute('aria-valuenow')).toBe('0');
    await user.keyboard('{Delete}');
    expect(slider.getAttribute('aria-valuenow')).toBe(String(volume.defaultValue));
  });

  it('fine-tunes with Shift on a logarithmic parameter', async () => {
    const user = userEvent.setup();
    render(<ControlledKnob spec={highCut} initial={5000} />);
    const slider = screen.getByRole('slider');
    slider.focus();
    await user.keyboard('{Shift>}{ArrowUp}{/Shift}');
    const fine = Number(slider.getAttribute('aria-valuenow'));
    await user.keyboard('{ArrowUp}');
    const coarse = Number(slider.getAttribute('aria-valuenow'));
    expect(fine).toBeGreaterThan(5000);
    expect(coarse - fine).toBeGreaterThan(fine - 5000);
  });

  it('does not call onChange at the limits', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Knob spec={volume} value={100} onChange={onChange} />);
    screen.getByRole('slider').focus();
    await user.keyboard('{ArrowUp}{End}');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('changes value with the mouse wheel and prevents page scroll', () => {
    render(<ControlledKnob spec={volume} initial={50} />);
    const slider = screen.getByRole('slider');
    const event = new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true });
    fireEvent(slider, event);
    expect(event.defaultPrevented).toBe(true);
    expect(slider.getAttribute('aria-valuenow')).toBe('51');
    fireEvent.wheel(slider, { deltaY: 100 });
    fireEvent.wheel(slider, { deltaY: 100 });
    expect(slider.getAttribute('aria-valuenow')).toBe('49');
  });

  it('does not lose wheel steps that arrive before a re-render', () => {
    const onChange = vi.fn();
    // The value prop never changes, as when events outpace React's rendering.
    render(<Knob spec={volume} value={50} onChange={onChange} />);
    const slider = screen.getByRole('slider');
    for (let i = 0; i < 3; i++) slider.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true }));
    expect(onChange.mock.calls.map(([, value]) => value)).toEqual([51, 52, 53]);
  });

  it('re-renders only the knob whose value changed', async () => {
    // Knob reads spec.label once per render: counting the reads counts the renders.
    let widthRenders = 0;
    const countedWidth = new Proxy(PARAM_SPEC_BY_KEY.width, {
      get(target, property, receiver) {
        if (property === 'label') widthRenders++;
        return Reflect.get(target, property, receiver);
      },
    });
    function TwoKnobs() {
      const [values, setValues] = useState({ volume: 50, width: 100 });
      const handleChange = useCallback((key: ParamKey, value: number) => setValues((v) => ({ ...v, [key]: value })), []);
      return (
        <>
          <Knob spec={volume} value={values.volume} onChange={handleChange} />
          <Knob spec={countedWidth} value={values.width} onChange={handleChange} />
        </>
      );
    }

    const user = userEvent.setup();
    render(<TwoKnobs />);
    const [volumeSlider, widthSlider] = screen.getAllByRole('slider');
    const rendersBefore = widthRenders;
    volumeSlider!.focus();
    await user.keyboard('{ArrowUp}{ArrowUp}{ArrowUp}');
    expect(volumeSlider!.getAttribute('aria-valuenow')).toBe('53');
    expect(widthRenders).toBe(rendersBefore);

    // The memoised knob still receives fresh values.
    const width = PARAM_SPEC_BY_KEY.width;
    const once = stepValue(width, 100, -STEP);
    const twice = stepValue(width, once, -STEP);
    widthSlider!.focus();
    await user.keyboard('{ArrowDown}');
    expect(widthSlider!.getAttribute('aria-valuenow')).toBe(String(once));
    await user.keyboard('{ArrowDown}');
    expect(widthSlider!.getAttribute('aria-valuenow')).toBe(String(twice));
    expect(twice).toBeLessThan(once);
  });

  it('follows a vertical drag and resets on double click', () => {
    render(<ControlledKnob spec={volume} initial={50} />);
    const slider = screen.getByRole('slider');
    slider.setPointerCapture = () => {};
    fireEvent.pointerDown(slider, { pointerId: 1, button: 0, clientY: 300 });
    fireEvent.pointerMove(slider, { pointerId: 1, clientY: 256 }); // 44 px up = 20% of the travel
    expect(slider.getAttribute('aria-valuenow')).toBe('70');
    fireEvent.pointerUp(slider, { pointerId: 1 });
    fireEvent.pointerMove(slider, { pointerId: 1, clientY: 0 });
    expect(slider.getAttribute('aria-valuenow')).toBe('70');

    fireEvent.doubleClick(slider);
    expect(slider.getAttribute('aria-valuenow')).toBe(String(volume.defaultValue));
  });
});
