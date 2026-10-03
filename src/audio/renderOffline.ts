import type { NoiseConfig } from '../domain/noise';
import { NoiseGraph, volumeToGain } from './audioGraph';
import { createNoiseBuffer } from './noiseBuffers';

export const EXPORT_SAMPLE_RATE = 44100;
export const EXPORT_CHANNELS = 2;
export const MIN_EXPORT_SECONDS = 1;
export const MAX_EXPORT_SECONDS = 600;
const EDGE_FADE_SECONDS = 0.05;

export function isOfflineRenderSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.OfflineAudioContext === 'function';
}

export function validateExportDuration(seconds: number): string | null {
  if (!Number.isFinite(seconds) || !Number.isInteger(seconds)) return 'La durata deve essere un numero intero di secondi.';
  if (seconds < MIN_EXPORT_SECONDS || seconds > MAX_EXPORT_SECONDS) {
    return `La durata deve essere compresa tra ${MIN_EXPORT_SECONDS} e ${MAX_EXPORT_SECONDS} secondi.`;
  }
  return null;
}

/** Size of the resulting 16-bit stereo WAV, header included. */
export function estimateWavBytes(seconds: number): number {
  return 44 + seconds * EXPORT_SAMPLE_RATE * EXPORT_CHANNELS * 2;
}

/**
 * Renders the current configuration faster than real time through the same
 * graph used for playback, with short fades at both ends to avoid clicks.
 */
export async function renderNoise(config: NoiseConfig, seconds: number): Promise<AudioBuffer> {
  const error = validateExportDuration(seconds);
  if (error) throw new RangeError(error);
  if (!isOfflineRenderSupported()) throw new Error('Il rendering offline non è supportato da questo browser.');

  const length = seconds * EXPORT_SAMPLE_RATE;
  const ctx = new OfflineAudioContext({ numberOfChannels: EXPORT_CHANNELS, length, sampleRate: EXPORT_SAMPLE_RATE });
  const buffer = createNoiseBuffer(ctx, config.type);
  const graph = new NoiseGraph(ctx, () => buffer);
  graph.output.connect(ctx.destination);
  graph.apply(config, 0);

  const gain = volumeToGain(config.volume);
  const fade = Math.min(EDGE_FADE_SECONDS, seconds / 4);
  const out = graph.output.gain;
  out.setValueAtTime(0, 0);
  out.linearRampToValueAtTime(gain, fade);
  out.setValueAtTime(gain, seconds - fade);
  out.linearRampToValueAtTime(0, seconds);

  graph.start(0);
  return ctx.startRendering();
}
