import {
  DEFAULT_CONFIG,
  PARAM_SPECS,
  clampParam,
  isNoiseType,
  type NoiseConfig,
  type ParamSpec,
} from '../domain/noise';

export const CSV_FORMAT_VERSION = 1;
export const MAX_CSV_BYTES = 64 * 1024;
const HEADER = ['parameter', 'value', 'unit'] as const;

export interface CsvIssue {
  /** 1-based line number, when the issue refers to a specific row. */
  line?: number;
  message: string;
}

export type CsvParseResult =
  | { ok: true; config: NoiseConfig; warnings: CsvIssue[] }
  | { ok: false; errors: CsvIssue[] };

export function serializeConfigCsv(config: NoiseConfig): string {
  const rows: string[][] = [
    [...HEADER],
    ['format_version', String(CSV_FORMAT_VERSION), ''],
    ['type', config.type, ''],
    ...PARAM_SPECS.map((spec) => [spec.csvKey, String(config[spec.key]), spec.unit]),
  ];
  return rows.map((row) => row.join(',')).join('\r\n') + '\r\n';
}

const SPEC_BY_CSV_KEY = new Map<string, ParamSpec>(PARAM_SPECS.map((spec) => [spec.csvKey, spec]));

/** Plain decimals only, as written by the export: Number() would also accept "0x1F", "1e2" or "Infinity". */
const DECIMAL_PATTERN = /^[+-]?(\d+(\.\d*)?|\.\d+)$/;

function describeLine(line: number): string {
  return `Riga ${line}`;
}

/**
 * Parses a configuration exported by {@link serializeConfigCsv}.
 * Tolerates BOM, CRLF, blank lines, surrounding spaces and any row order.
 * Out-of-range values are clamped and missing parameters fall back to defaults,
 * both reported as warnings; malformed data is reported as errors.
 */
export function parseConfigCsv(text: string): CsvParseResult {
  if (text.length > MAX_CSV_BYTES) {
    return { ok: false, errors: [{ message: `Il file supera la dimensione massima di ${MAX_CSV_BYTES / 1024} KB.` }] };
  }
  if (text.includes('\u0000')) {
    return { ok: false, errors: [{ message: 'Il file non sembra un CSV di testo.' }] };
  }

  const lines = text.replace(/^\uFEFF/, '').split(/\r\n|\n|\r/);
  const rows = lines
    .map((content, index) => ({ line: index + 1, cells: content.split(',').map((cell) => cell.trim()) }))
    .filter((row) => row.cells.some((cell) => cell !== ''));

  if (rows.length === 0) {
    return { ok: false, errors: [{ message: 'Il file è vuoto.' }] };
  }

  const [header, ...body] = rows;
  const headerCells = header!.cells.map((cell) => cell.toLowerCase());
  if (headerCells[0] !== HEADER[0] || headerCells[1] !== HEADER[1]) {
    return {
      ok: false,
      errors: [{ line: header!.line, message: `${describeLine(header!.line)}: intestazione attesa "${HEADER.join(',')}".` }],
    };
  }

  const errors: CsvIssue[] = [];
  const warnings: CsvIssue[] = [];
  const config: NoiseConfig = { ...DEFAULT_CONFIG };
  const seen = new Set<string>();

  for (const { line, cells } of body) {
    const key = (cells[0] ?? '').toLowerCase();
    const rawValue = cells[1] ?? '';
    const where = describeLine(line);

    if (cells.length < 2 || key === '') {
      errors.push({ line, message: `${where}: servono almeno le colonne "parameter" e "value".` });
      continue;
    }
    if (seen.has(key)) {
      warnings.push({ line, message: `${where}: "${key}" è duplicato, viene usato l'ultimo valore.` });
    }
    seen.add(key);

    if (key === 'format_version') {
      if (rawValue !== String(CSV_FORMAT_VERSION)) {
        errors.push({ line, message: `${where}: versione di formato "${rawValue}" non supportata.` });
      }
      continue;
    }

    if (key === 'type') {
      const type = rawValue.toLowerCase();
      if (isNoiseType(type)) config.type = type;
      else errors.push({ line, message: `${where}: tipo di noise "${rawValue}" sconosciuto.` });
      continue;
    }

    const spec = SPEC_BY_CSV_KEY.get(key);
    if (!spec) {
      warnings.push({ line, message: `${where}: parametro "${cells[0]}" sconosciuto, ignorato.` });
      continue;
    }

    const value = DECIMAL_PATTERN.test(rawValue) ? Number(rawValue) : Number.NaN;
    if (!Number.isFinite(value)) {
      errors.push({ line, message: `${where}: il valore di "${key}" non è un numero ("${rawValue}").` });
      continue;
    }

    const clamped = clampParam(spec, value);
    if (value < spec.min || value > spec.max) {
      warnings.push({
        line,
        message: `${where}: "${key}" fuori intervallo (${spec.min}–${spec.max} ${spec.unit}), impostato a ${clamped}.`,
      });
    }
    config[spec.key] = clamped;
  }

  if (!seen.has('type')) {
    warnings.push({ message: `Tipo di noise mancante: usato il predefinito "${DEFAULT_CONFIG.type}".` });
  }
  for (const spec of PARAM_SPECS) {
    if (!seen.has(spec.csvKey)) {
      warnings.push({ message: `Parametro "${spec.csvKey}" mancante: usato il predefinito ${spec.defaultValue} ${spec.unit}.` });
    }
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, config, warnings };
}
