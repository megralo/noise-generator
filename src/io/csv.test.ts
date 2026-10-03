import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, type NoiseConfig } from '../domain/noise';
import { MAX_CSV_BYTES, parseConfigCsv, serializeConfigCsv } from './csv';

const sample: NoiseConfig = { type: 'brown', volume: 42, lowCut: 35, highCut: 4200, width: 120, modRate: 0.35, modDepth: 60 };

const FULL_BODY = [
  'type,brown,',
  'volume,42,%',
  'low_cut,35,Hz',
  'high_cut,4200,Hz',
  'stereo_width,120,%',
  'mod_rate,0.35,Hz',
  'mod_depth,60,%',
];

function csv(...rows: string[]): string {
  return ['parameter,value,unit', ...rows].join('\n');
}

function expectOk(text: string) {
  const result = parseConfigCsv(text);
  if (!result.ok) throw new Error(`Parsing fallito: ${result.errors.map((e) => e.message).join('; ')}`);
  return result;
}

function expectErrors(text: string) {
  const result = parseConfigCsv(text);
  if (result.ok) throw new Error('Il parsing avrebbe dovuto fallire');
  return result.errors;
}

describe('serializeConfigCsv', () => {
  it('writes header, version, type and every parameter with units', () => {
    expect(serializeConfigCsv(sample)).toBe(
      [
        'parameter,value,unit',
        'format_version,1,',
        'type,brown,',
        'volume,42,%',
        'low_cut,35,Hz',
        'high_cut,4200,Hz',
        'stereo_width,120,%',
        'mod_rate,0.35,Hz',
        'mod_depth,60,%',
        '',
      ].join('\r\n'),
    );
  });
});

describe('parseConfigCsv', () => {
  it('round-trips an exported configuration without warnings', () => {
    const result = expectOk(serializeConfigCsv(sample));
    expect(result.config).toEqual(sample);
    expect(result.warnings).toEqual([]);
  });

  it('tolerates BOM, CRLF, blank lines, spaces, case and any row order', () => {
    const text = '﻿ Parameter , Value , Unit \r\n\r\n' + [...FULL_BODY].reverse().map((row) => ` ${row.replace(',', ' , ')} `).join('\r\n');
    const result = expectOk(text.replace('brown', 'BROWN'));
    expect(result.config).toEqual(sample);
    expect(result.warnings).toEqual([]);
  });

  it('clamps out-of-range values with a warning that names the line', () => {
    const result = expectOk(csv(...FULL_BODY.filter((row) => !row.startsWith('volume')), 'volume,150,%'));
    expect(result.config.volume).toBe(100);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toMatchObject({ line: 8 });
    expect(result.warnings[0]!.message).toContain('fuori intervallo');
  });

  it('fills missing parameters with defaults and warns', () => {
    const result = expectOk(csv('type,violet,'));
    expect(result.config).toEqual({ ...DEFAULT_CONFIG, type: 'violet' });
    expect(result.warnings).toHaveLength(6);
  });

  it('warns about a missing type', () => {
    const result = expectOk(csv(...FULL_BODY.slice(1)));
    expect(result.config.type).toBe(DEFAULT_CONFIG.type);
    expect(result.warnings.map((w) => w.message).join()).toContain('Tipo di noise mancante');
  });

  it('ignores unknown parameters with a warning', () => {
    const result = expectOk(csv(...FULL_BODY, 'reverb,30,%'));
    expect(result.warnings).toEqual([{ line: 9, message: expect.stringContaining('"reverb" sconosciuto') }]);
  });

  it('uses the last value of a duplicated parameter and warns', () => {
    const result = expectOk(csv(...FULL_BODY, 'volume,10,%'));
    expect(result.config.volume).toBe(10);
    expect(result.warnings[0]!.message).toContain('duplicato');
  });

  it('reports an unknown noise type with its line', () => {
    expect(expectErrors(csv('volume,10,%', 'type,green,'))).toEqual([
      { line: 3, message: expect.stringContaining('"green" sconosciuto') },
    ]);
  });

  it.each(['abc', '', '12abc', 'NaN', 'Infinity', '0x1F', '1e2', '1_000'])('reports the non-numeric value "%s"', (value) => {
    const errors = expectErrors(csv('type,pink,', `volume,${value},%`));
    expect(errors).toEqual([{ line: 3, message: expect.stringContaining('non è un numero') }]);
  });

  it.each([
    ['+40', 40],
    ['40.', 40],
    ['.5', 1],
    ['-3', 0],
  ])('accepts the decimal "%s"', (raw, expected) => {
    const result = parseConfigCsv(csv('type,pink,', `volume,${raw},%`));
    expect(result.ok && result.config.volume).toBe(expected);
  });

  it('collects every error instead of stopping at the first', () => {
    expect(expectErrors(csv('type,green,', 'volume,x,%', 'width'))).toHaveLength(3);
  });

  it('rejects rows with a single column', () => {
    expect(expectErrors(csv('type,pink,', 'volume'))[0]).toMatchObject({ line: 3 });
  });

  it('rejects an unsupported format version', () => {
    expect(expectErrors(csv('format_version,2,', ...FULL_BODY))[0]!.message).toContain('versione');
  });

  it('rejects a missing or wrong header', () => {
    expect(expectErrors('type,pink,\nvolume,40,%')[0]).toMatchObject({ line: 1 });
  });

  it.each([
    ['an empty file', ''],
    ['a whitespace-only file', ' \n \r\n'],
    ['a binary file', 'parameter,value\u0000\u0001'],
    ['an oversized file', 'x'.repeat(MAX_CSV_BYTES + 1)],
  ])('rejects %s', (_, text) => {
    expect(expectErrors(text)).toHaveLength(1);
  });
});
