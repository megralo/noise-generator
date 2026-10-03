import { render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG } from '../domain/noise';
import { soundToTheme, type SceneTheme } from '../theme/sceneTheme';
import { useSceneTheme } from './useSceneTheme';

function Harness({ theme, reducedMotion = false }: { theme: SceneTheme; reducedMotion?: boolean }) {
  const sceneRef = useRef<HTMLDivElement>(null);
  useSceneTheme(theme, reducedMotion, sceneRef);
  return <div ref={sceneRef} data-testid="scene" />;
}

const root = document.documentElement;
const frames = (count: number) => vi.advanceTimersByTime(count * 16);
const breathing = soundToTheme({ ...DEFAULT_CONFIG, modDepth: 80, modRate: 1 }, true);
const still = soundToTheme({ ...DEFAULT_CONFIG, modDepth: 0 }, true);

describe('useSceneTheme', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
    root.removeAttribute('style');
  });

  afterEach(() => {
    vi.useRealTimers();
    root.removeAttribute('style');
  });

  it('writes colours on the root and scopes --breathe to the scene element', () => {
    const { getByTestId } = render(<Harness theme={breathing} />);
    frames(10);
    const scene = getByTestId('scene');
    expect(root.style.getPropertyValue('--bg')).not.toBe('');
    expect(root.style.getPropertyValue('--breathe')).toBe('');

    const first = scene.style.getPropertyValue('--breathe');
    frames(15);
    expect(first).not.toBe('');
    expect(scene.style.getPropertyValue('--breathe')).not.toBe(first);
  });

  it('stops rewriting the root once the colours have converged, even while breathing', () => {
    const { rerender } = render(<Harness theme={still} />);
    frames(2);
    rerender(<Harness theme={breathing} />);
    frames(60 * 6); // well past the glide time
    const setProperty = vi.spyOn(root.style, 'setProperty');
    frames(60);
    expect(setProperty).not.toHaveBeenCalled();
    setProperty.mockRestore();
  });

  it('glides gradually towards a new colour', () => {
    const brown = soundToTheme({ ...DEFAULT_CONFIG, type: 'brown' }, true);
    const { rerender } = render(<Harness theme={still} />);
    frames(2);
    const start = root.style.getPropertyValue('--bg');
    rerender(<Harness theme={brown} />);
    frames(3);
    const midway = root.style.getPropertyValue('--bg');
    frames(60 * 6);
    const end = root.style.getPropertyValue('--bg');
    expect(new Set([start, midway, end]).size).toBe(3);
  });

  it('does not breathe with reduced motion', () => {
    const { getByTestId } = render(<Harness theme={breathing} reducedMotion />);
    frames(20);
    expect(getByTestId('scene').style.getPropertyValue('--breathe')).toBe('0');
  });
});
