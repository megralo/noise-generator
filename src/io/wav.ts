const HEADER_BYTES = 44;
const BYTES_PER_SAMPLE = 2;

/** WAV data is little-endian: when the host is too, typed arrays can write it directly. */
const HOST_IS_LITTLE_ENDIAN = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1;

export interface EncodeWavOptions {
  /** Forces the portable DataView path; used by tests to compare both writers. */
  forceDataView?: boolean;
}

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
}

function toPcm16(sample: number): number {
  const clipped = Math.max(-1, Math.min(1, sample));
  return clipped < 0 ? Math.round(clipped * 0x8000) : Math.round(clipped * 0x7fff);
}

/**
 * Encodes planar float channels as an interleaved 16-bit PCM WAV file.
 * On little-endian hosts (practically all of them) samples go through an
 * Int16Array, several times faster than one DataView call per sample.
 */
export function encodeWav(
  channels: readonly Float32Array[],
  sampleRate: number,
  { forceDataView = false }: EncodeWavOptions = {},
): ArrayBuffer {
  const first = channels[0];
  if (!first) throw new RangeError('Serve almeno un canale audio.');
  if (channels.some((channel) => channel.length !== first.length)) {
    throw new RangeError('I canali audio hanno lunghezze diverse.');
  }
  if (!Number.isInteger(sampleRate) || sampleRate <= 0) {
    throw new RangeError(`Frequenza di campionamento non valida: ${sampleRate}`);
  }

  const channelCount = channels.length;
  const frames = first.length;
  const blockAlign = channelCount * BYTES_PER_SAMPLE;
  const dataBytes = frames * blockAlign;
  const buffer = new ArrayBuffer(HEADER_BYTES + dataBytes);
  const view = new DataView(buffer);

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, channelCount, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, BYTES_PER_SAMPLE * 8, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataBytes, true);

  if (HOST_IS_LITTLE_ENDIAN && !forceDataView) {
    const pcm = new Int16Array(buffer, HEADER_BYTES, frames * channelCount);
    for (let c = 0; c < channelCount; c++) {
      const channel = channels[c]!;
      for (let frame = 0, index = c; frame < frames; frame++, index += channelCount) {
        pcm[index] = toPcm16(channel[frame]!);
      }
    }
    return buffer;
  }

  let offset = HEADER_BYTES;
  for (let frame = 0; frame < frames; frame++) {
    for (let c = 0; c < channelCount; c++) {
      view.setInt16(offset, toPcm16(channels[c]![frame]!), true);
      offset += BYTES_PER_SAMPLE;
    }
  }
  return buffer;
}
