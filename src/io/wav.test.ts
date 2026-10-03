import { describe, expect, it } from 'vitest';
import { seededRandom } from '../test/helpers';
import { encodeWav } from './wav';

const ascii = (view: DataView, offset: number, length: number) =>
  String.fromCharCode(...Array.from({ length }, (_, i) => view.getUint8(offset + i)));

describe('encodeWav', () => {
  it('writes a valid 16-bit PCM RIFF header', () => {
    const left = new Float32Array([0, 0.5, -0.5]);
    const right = new Float32Array([1, -1, 0]);
    const view = new DataView(encodeWav([left, right], 44100));

    expect(view.byteLength).toBe(44 + 3 * 2 * 2);
    expect(ascii(view, 0, 4)).toBe('RIFF');
    expect(view.getUint32(4, true)).toBe(view.byteLength - 8);
    expect(ascii(view, 8, 4)).toBe('WAVE');
    expect(ascii(view, 12, 4)).toBe('fmt ');
    expect(view.getUint16(20, true)).toBe(1);
    expect(view.getUint16(22, true)).toBe(2);
    expect(view.getUint32(24, true)).toBe(44100);
    expect(view.getUint32(28, true)).toBe(44100 * 4);
    expect(view.getUint16(32, true)).toBe(4);
    expect(view.getUint16(34, true)).toBe(16);
    expect(ascii(view, 36, 4)).toBe('data');
    expect(view.getUint32(40, true)).toBe(12);
  });

  it('interleaves channels and scales samples to 16 bit', () => {
    const view = new DataView(encodeWav([new Float32Array([0, 0.5]), new Float32Array([1, -1])], 8000));
    const samples = Array.from({ length: 4 }, (_, i) => view.getInt16(44 + i * 2, true));
    expect(samples).toEqual([0, 32767, Math.round(0.5 * 32767), -32768]);
  });

  it('clips samples outside [-1, 1]', () => {
    const view = new DataView(encodeWav([new Float32Array([2, -3])], 8000));
    expect(view.getInt16(44, true)).toBe(32767);
    expect(view.getInt16(46, true)).toBe(-32768);
  });

  it('rejects inconsistent input', () => {
    expect(() => encodeWav([], 44100)).toThrow(RangeError);
    expect(() => encodeWav([new Float32Array(2), new Float32Array(3)], 44100)).toThrow(RangeError);
    expect(() => encodeWav([new Float32Array(2)], 0)).toThrow(RangeError);
    expect(() => encodeWav([new Float32Array(2)], 44100.5)).toThrow(RangeError);
  });

  it('writes the same bytes through the fast and the portable path', () => {
    const random = seededRandom(99);
    const left = Float32Array.from({ length: 4097 }, () => random() * 2.4 - 1.2);
    const right = Float32Array.from({ length: 4097 }, () => random() * 2 - 1);
    left.set([0, -0, 1, -1, 0.5, -0.5, 1e-9, -1e-9], 0);
    for (const channels of [[left], [left, right]]) {
      const fast = new Uint8Array(encodeWav(channels, 48000));
      const portable = new Uint8Array(encodeWav(channels, 48000, { forceDataView: true }));
      expect(fast.length).toBe(portable.length);
      expect(fast.findIndex((byte, i) => byte !== portable[i])).toBe(-1);
    }
  });
});
