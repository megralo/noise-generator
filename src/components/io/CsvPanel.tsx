import { useId, useState, type ChangeEvent, type DragEvent } from 'react';
import type { NoiseConfig } from '../../domain/noise';
import { MAX_CSV_BYTES, parseConfigCsv, serializeConfigCsv, type CsvIssue } from '../../io/csv';
import { buildFilename, downloadBlob } from '../../io/download';
import { Notice, type NoticeTone } from '../Notice';

interface CsvPanelProps {
  config: NoiseConfig;
  onImport: (config: NoiseConfig) => void;
}

interface Report {
  tone: Extract<NoticeTone, 'success' | 'warning' | 'error'>;
  title: string;
  issues: CsvIssue[];
}

function looksLikeCsv(file: File): boolean {
  return /\.csv$/i.test(file.name) || file.type === 'text/csv' || file.type === 'text/plain' || file.type === '';
}

export function CsvPanel({ config, onImport }: CsvPanelProps) {
  const id = useId();
  const [report, setReport] = useState<Report | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);

  const exportCsv = () => {
    const blob = new Blob([serializeConfigCsv(config)], { type: 'text/csv;charset=utf-8' });
    downloadBlob(blob, buildFilename(config.type, 'csv'));
  };

  const importFile = async (file: File) => {
    if (!looksLikeCsv(file)) {
      setReport({ tone: 'error', title: `“${file.name}” non è un file CSV.`, issues: [] });
      return;
    }
    if (file.size > MAX_CSV_BYTES) {
      setReport({ tone: 'error', title: `“${file.name}” supera i ${MAX_CSV_BYTES / 1024} KB consentiti.`, issues: [] });
      return;
    }
    setBusy(true);
    try {
      const result = parseConfigCsv(await file.text());
      if (!result.ok) {
        setReport({ tone: 'error', title: `Impossibile importare “${file.name}”.`, issues: result.errors });
        return;
      }
      onImport(result.config);
      setReport(
        result.warnings.length > 0
          ? { tone: 'warning', title: `Configurazione importata con ${result.warnings.length} avvisi.`, issues: result.warnings }
          : { tone: 'success', title: 'Configurazione importata. Puoi salvarla come preset.', issues: [] },
      );
    } catch {
      setReport({ tone: 'error', title: `Impossibile leggere “${file.name}”.`, issues: [] });
    } finally {
      setBusy(false);
    }
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset so selecting the same file again still triggers a change.
    event.target.value = '';
    if (file) void importFile(file);
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragOver(false);
    const files = event.dataTransfer.files;
    if (files.length > 1) {
      setReport({ tone: 'error', title: 'Trascina un solo file alla volta.', issues: [] });
      return;
    }
    const file = files[0];
    if (file) void importFile(file);
  };

  return (
    <section className="panel" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="section-title">
        Configurazione CSV
      </h2>
      <div className="mt-3 grid gap-2">
        <button type="button" className="button button--primary justify-center" onClick={exportCsv}>
          <svg className="h-4 w-4" viewBox="0 0 20 20" aria-hidden="true">
            <path d="M10 3v10m0 0l-4-4m4 4l4-4M4 16h12" />
          </svg>
          Esporta CSV
        </button>
        <label
          className="dropzone"
          data-active={dragOver || undefined}
          aria-busy={busy}
          onDragOver={(event) => {
            event.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={(event) => {
            // dragleave also fires when moving onto a child: only react when really leaving the zone.
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragOver(false);
          }}
          onDrop={handleDrop}
        >
          <input
            type="file"
            accept=".csv,text/csv"
            className="dropzone__input sr-only"
            onChange={handleChange}
            disabled={busy}
          />
          <svg className="h-5 w-5" viewBox="0 0 20 20" aria-hidden="true">
            <path d="M10 13V3m0 0L6 7m4-4l4 4M4 16h12" />
          </svg>
          <span>
            <span className="font-medium text-ink">Importa CSV</span>
            <span className="block text-xs text-ink/60">Clicca o trascina qui un file .csv</span>
          </span>
        </label>
      </div>

      {report && (
        <div className="mt-3">
          <Notice tone={report.tone} onDismiss={() => setReport(null)}>
            <p className="font-medium">{report.title}</p>
            {report.issues.length > 0 && (
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs">
                {report.issues.map((issue, index) => (
                  <li key={index}>{issue.message}</li>
                ))}
              </ul>
            )}
          </Notice>
        </div>
      )}
    </section>
  );
}
