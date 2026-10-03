import { useCallback, useEffect, useRef, useState } from 'react';
import { NoiseEngine, isWebAudioSupported } from '../audio/NoiseEngine';
import type { NoiseConfig } from '../domain/noise';

export type PlaybackStatus = 'stopped' | 'starting' | 'playing';

export interface NoiseEngineControls {
  supported: boolean;
  status: PlaybackStatus;
  error: string | null;
  toggle: () => void;
  clearError: () => void;
}

function describeError(error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error);
  return `Impossibile avviare l'audio. ${detail}`;
}

/** Bridges React state and the imperative Web Audio engine. */
export function useNoiseEngine(config: NoiseConfig): NoiseEngineControls {
  const engineRef = useRef<NoiseEngine | null>(null);
  const configRef = useRef(config);
  const [status, setStatus] = useState<PlaybackStatus>('stopped');
  const [error, setError] = useState<string | null>(null);
  const supported = isWebAudioSupported();

  useEffect(() => {
    configRef.current = config;
    engineRef.current?.update(config);
  }, [config]);

  useEffect(
    () => () => {
      void engineRef.current?.dispose();
      engineRef.current = null;
    },
    [],
  );

  const toggle = useCallback(() => {
    if (!supported || status === 'starting') return;
    if (status === 'playing') {
      engineRef.current?.stop();
      setStatus('stopped');
      return;
    }

    engineRef.current ??= new NoiseEngine(configRef.current, () => setStatus('stopped'));
    const engine = engineRef.current;
    engine.update(configRef.current);
    setStatus('starting');
    setError(null);
    engine.play().then(
      () => setStatus(engine.isPlaying ? 'playing' : 'stopped'),
      (reason: unknown) => {
        engine.stop();
        setStatus('stopped');
        setError(describeError(reason));
      },
    );
  }, [status, supported]);

  const clearError = useCallback(() => setError(null), []);

  return { supported, status, error, toggle, clearError };
}
