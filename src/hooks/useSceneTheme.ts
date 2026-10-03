import { useEffect, useRef, type RefObject } from 'react';
import { approachTheme, themeToCssVars, themesClose, type SceneTheme } from '../theme/sceneTheme';

/** Time constant of the colour glide: about 95% of the way after three times this value. */
const GLIDE_TAU_SECONDS = 0.7;
const MAX_FRAME_SECONDS = 0.1;

function writeTheme(root: HTMLElement, theme: SceneTheme): void {
  for (const [name, value] of Object.entries(themeToCssVars(theme))) root.style.setProperty(name, value);
}

/**
 * Glides the page colours towards the target theme and drives the "breathing"
 * glow. Writes CSS custom properties directly, so React does not re-render per frame.
 *
 * Custom properties are inherited, so every write on the root invalidates the
 * style of the whole document: colours are written there only while they change,
 * and the per-frame `--breathe` value is scoped to the background element.
 * The loop sleeps as soon as the colours have converged and nothing breathes.
 */
export function useSceneTheme(
  target: SceneTheme,
  reducedMotion: boolean,
  sceneRef: RefObject<HTMLElement | null>,
): void {
  const currentRef = useRef<SceneTheme | null>(null);
  const writtenRef = useRef<SceneTheme | null>(null);
  const breatheRef = useRef<string | null>(null);
  const phaseRef = useRef(0);

  useEffect(() => {
    const root = document.documentElement;
    let frame = 0;
    let last = performance.now();

    const writeBreathe = (value: string) => {
      const scene = sceneRef.current;
      if (scene === null || breatheRef.current === value) return;
      scene.style.setProperty('--breathe', value);
      breatheRef.current = value;
    };

    const tick = (now: number) => {
      const dt = Math.min(MAX_FRAME_SECONDS, (now - last) / 1000);
      last = now;
      const current = currentRef.current;
      const approached = reducedMotion || !current ? target : approachTheme(current, target, dt, GLIDE_TAU_SECONDS);
      const converged = themesClose(approached, target);
      const next = converged ? target : approached;
      currentRef.current = next;
      if (writtenRef.current !== next) {
        writeTheme(root, next);
        writtenRef.current = next;
      }

      const breathing = !reducedMotion && next.breatheDepth > 0.002;
      if (breathing) {
        phaseRef.current = (phaseRef.current + dt * next.breatheRate) % 1;
        const wave = 0.5 + 0.5 * Math.sin(phaseRef.current * 2 * Math.PI);
        // Same shape as the audio modulation: gain = 1 - depth * (1 - wave).
        writeBreathe(((1 - wave) * next.breatheDepth).toFixed(3));
      } else {
        writeBreathe('0');
      }

      frame = breathing || !converged ? requestAnimationFrame(tick) : 0;
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, reducedMotion, sceneRef]);
}
