import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../domain/noise';
import { estimateWavBytes, renderNoise, validateExportDuration } from './renderOffline';

describe('validateExportDuration', () => {
  it.each([1, 30, 600])('accepts %s seconds', (seconds) => {
    expect(validateExportDuration(seconds)).toBeNull();
  });

  it.each([0, -1, 601, 2.5, Number.NaN])('rejects %s', (seconds) => {
    expect(validateExportDuration(seconds)).not.toBeNull();
  });
});

describe('estimateWavBytes', () => {
  it('matches a 16-bit stereo 44.1 kHz file with header', () => {
    expect(estimateWavBytes(60)).toBe(44 + 60 * 44100 * 4);
  });
});

describe('renderNoise', () => {
  it('rejects invalid durations before touching Web Audio', async () => {
    await expect(renderNoise(DEFAULT_CONFIG, 0)).rejects.toThrow(RangeError);
  });

  it('fails clearly when OfflineAudioContext is missing', async () => {
    await expect(renderNoise(DEFAULT_CONFIG, 5)).rejects.toThrow('non è supportato');
  });
});
