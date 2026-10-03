import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { Knob } from './components/knob/Knob';
import { CsvPanel } from './components/io/CsvPanel';
import { WavExportPanel } from './components/io/WavExportPanel';
import { NoiseTypeSelector } from './components/NoiseTypeSelector';
import { Notice } from './components/Notice';
import { PresetPanel } from './components/presets/PresetPanel';
import { SpectrumView } from './components/SpectrumView';
import { TransportButton } from './components/TransportButton';
import { NOISE_TYPE_INFO, PARAM_SPECS, type NoiseConfig, type NoiseType, type ParamKey } from './domain/noise';
import { useNoiseEngine } from './hooks/useNoiseEngine';
import { usePrefersReducedMotion } from './hooks/usePrefersReducedMotion';
import { usePresets } from './hooks/usePresets';
import { useSceneTheme } from './hooks/useSceneTheme';
import type { Preset } from './presets/presets';
import { configReducer, initialConfigState } from './state/configReducer';
import { soundToTheme } from './theme/sceneTheme';

function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName) || target.getAttribute('role') === 'slider')
  );
}

export default function App() {
  const [state, dispatch] = useReducer(configReducer, initialConfigState);
  const { config, activePresetId, modified } = state;
  const engine = useNoiseEngine(config);
  const presets = usePresets();
  const reducedMotion = usePrefersReducedMotion();
  const playing = engine.status === 'playing';

  const sceneRef = useRef<HTMLDivElement>(null);
  const theme = useMemo(() => soundToTheme(config, playing), [config, playing]);
  useSceneTheme(theme, reducedMotion, sceneRef);

  const { toggle } = engine;
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.repeat || isTypingTarget(event.target)) return;
      event.preventDefault();
      toggle();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggle]);

  // The active preset can disappear without a click here, e.g. deleted in another tab.
  const { builtIn, user } = presets;
  useEffect(() => {
    if (activePresetId === null) return;
    if ([...builtIn, ...user].some((preset) => preset.id === activePresetId)) return;
    dispatch({ kind: 'presetRemoved', presetId: activePresetId });
  }, [activePresetId, builtIn, user]);

  const setParam = useCallback((key: ParamKey, value: number) => dispatch({ kind: 'setParam', key, value }), []);
  const setType = useCallback((type: NoiseType) => dispatch({ kind: 'setType', type }), []);
  const applyPreset = useCallback((preset: Preset) => dispatch({ kind: 'load', config: preset.config, presetId: preset.id }), []);
  const importConfig = useCallback((imported: NoiseConfig) => dispatch({ kind: 'load', config: imported, presetId: null }), []);
  const presetRemoved = useCallback((presetId: string) => dispatch({ kind: 'presetRemoved', presetId }), []);

  return (
    <>
      <div ref={sceneRef} className="scene" aria-hidden="true" data-playing={playing || undefined}>
        <div className="scene__glow" />
        <div className="scene__glow scene__glow--echo" />
        <div className="scene__grain" />
        <div className="scene__vignette" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:py-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">Noise Generator</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              {NOISE_TYPE_INFO[config.type].label} noise
            </h1>
          </div>
          <TransportButton status={engine.status} disabled={!engine.supported} onToggle={toggle} />
        </header>

        {!engine.supported && (
          <Notice tone="error">
            Il tuo browser non supporta la Web Audio API: la riproduzione non è disponibile. Prova con una versione
            recente di Firefox, Chrome, Edge o Safari.
          </Notice>
        )}
        {engine.error && (
          <Notice tone="error" onDismiss={engine.clearError}>
            {engine.error}
          </Notice>
        )}

        <main className="grid flex-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <section className="panel panel--instrument flex flex-col gap-6" aria-label="Strumento">
            <NoiseTypeSelector value={config.type} onChange={setType} />
            <SpectrumView config={config} />
            <div>
              <h2 className="section-title">Controlli</h2>
              <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3">
                {PARAM_SPECS.map((spec) => (
                  <Knob key={spec.key} spec={spec} value={config[spec.key]} onChange={setParam} />
                ))}
              </div>
            </div>
          </section>

          <aside className="flex flex-col gap-6" aria-label="Preset ed esportazione">
            <PresetPanel
              presets={presets}
              config={config}
              activePresetId={activePresetId}
              modified={modified}
              onApply={applyPreset}
              onSaved={applyPreset}
              onRemoved={presetRemoved}
            />
            <CsvPanel config={config} onImport={importConfig} />
            <WavExportPanel config={config} />
          </aside>
        </main>

        <footer className="text-xs leading-relaxed text-ink/55">
          <p>
            <kbd>Spazio</kbd> avvia/ferma · Manopole: trascina in verticale, rotella o <kbd>↑</kbd> <kbd>↓</kbd>{' '}
            <kbd>PagSu</kbd> <kbd>PagGiù</kbd> <kbd>Home</kbd> <kbd>Fine</kbd> · <kbd>Maiusc</kbd> regolazione fine ·
            doppio clic o <kbd>Canc</kbd> ripristina
          </p>
          <p className="mt-1">Tutto avviene nel tuo browser: nessun dato lascia questo dispositivo.</p>
        </footer>
      </div>
    </>
  );
}
