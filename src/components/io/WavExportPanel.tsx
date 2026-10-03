import { useId, useState } from 'react';
import {
  MAX_EXPORT_SECONDS,
  MIN_EXPORT_SECONDS,
  estimateWavBytes,
  isOfflineRenderSupported,
  renderNoise,
  validateExportDuration,
} from '../../audio/renderOffline';
import type { NoiseConfig } from '../../domain/noise';
import { buildFilename, downloadBlob } from '../../io/download';
import { encodeWav } from '../../io/wav';
import { Notice } from '../Notice';

const QUICK_DURATIONS = [
  { seconds: 10, label: '10 s' },
  { seconds: 30, label: '30 s' },
  { seconds: 60, label: '1 min' },
  { seconds: 300, label: '5 min' },
  { seconds: 600, label: '10 min' },
];

const sizeFormatter = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 });

function formatSize(bytes: number): string {
  const megabytes = bytes / (1024 * 1024);
  return megabytes >= 1 ? `${sizeFormatter.format(megabytes)} MB` : `${sizeFormatter.format(bytes / 1024)} KB`;
}

type ExportState = { kind: 'idle' } | { kind: 'rendering' } | { kind: 'done'; filename: string } | { kind: 'error'; message: string };

export function WavExportPanel({ config }: { config: NoiseConfig }) {
  const id = useId();
  const [durationInput, setDurationInput] = useState('30');
  const [state, setState] = useState<ExportState>({ kind: 'idle' });
  const supported = isOfflineRenderSupported();

  const seconds = Number(durationInput);
  const durationError = durationInput.trim() === '' ? 'Inserisci una durata.' : validateExportDuration(seconds);
  const rendering = state.kind === 'rendering';

  const exportWav = async () => {
    if (durationError || rendering) return;
    setState({ kind: 'rendering' });
    try {
      const audio = await renderNoise(config, seconds);
      const channels = Array.from({ length: audio.numberOfChannels }, (_, channel) => audio.getChannelData(channel));
      const blob = new Blob([encodeWav(channels, audio.sampleRate)], { type: 'audio/wav' });
      const filename = buildFilename(config.type, 'wav');
      downloadBlob(blob, filename);
      setState({ kind: 'done', filename });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      setState({
        kind: 'error',
        message: `Esportazione non riuscita: ${detail}. Prova con una durata più breve.`,
      });
    }
  };

  return (
    <section className="panel" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="section-title">
        Esporta audio
      </h2>
      {!supported ? (
        <p className="mt-3 text-sm text-ink/70">Il tuo browser non supporta il rendering audio offline.</p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Durate rapide">
            {QUICK_DURATIONS.map((option) => (
              <button
                key={option.seconds}
                type="button"
                className="chip chip--small"
                aria-pressed={seconds === option.seconds}
                onClick={() => setDurationInput(String(option.seconds))}
                disabled={rendering}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-end gap-2">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <label htmlFor={`${id}-duration`} className="text-sm text-ink/75">
                Durata in secondi
              </label>
              <input
                id={`${id}-duration`}
                className="field"
                type="number"
                inputMode="numeric"
                min={MIN_EXPORT_SECONDS}
                max={MAX_EXPORT_SECONDS}
                step={1}
                value={durationInput}
                onChange={(event) => setDurationInput(event.target.value)}
                disabled={rendering}
                aria-invalid={durationError !== null}
                aria-describedby={`${id}-duration-help`}
              />
            </div>
            <button
              type="button"
              className="button button--primary"
              onClick={() => void exportWav()}
              disabled={durationError !== null || rendering}
              aria-busy={rendering}
            >
              {rendering && <span className="spinner" aria-hidden="true" />}
              {rendering ? 'Rendering…' : 'Esporta WAV'}
            </button>
          </div>
          <p id={`${id}-duration-help`} className={durationError ? 'field-error mt-1' : 'mt-1 text-xs text-ink/60'}>
            {durationError ?? `WAV 16-bit stereo, 44,1 kHz · circa ${formatSize(estimateWavBytes(seconds))}`}
          </p>
        </>
      )}

      <div className="mt-3">
        {state.kind === 'rendering' && (
          <Notice tone="info">Generazione del file in corso: la configurazione corrente viene renderizzata offline.</Notice>
        )}
        {state.kind === 'done' && (
          <Notice tone="success" onDismiss={() => setState({ kind: 'idle' })}>
            File “{state.filename}” pronto per il download.
          </Notice>
        )}
        {state.kind === 'error' && (
          <Notice tone="error" onDismiss={() => setState({ kind: 'idle' })}>
            {state.message}
          </Notice>
        )}
      </div>
    </section>
  );
}
