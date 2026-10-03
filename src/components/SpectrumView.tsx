import { useMemo } from 'react';
import { NOISE_TYPE_INFO, PARAM_SPEC_BY_KEY, formatParam, type NoiseConfig } from '../domain/noise';
import { SPECTRUM_FLOOR_DB, SPECTRUM_MAX_HZ, SPECTRUM_MIN_HZ, spectrumCurve } from '../domain/spectrum';

const WIDTH = 320;
const HEIGHT = 96;
const GRID_FREQUENCIES = [
  { frequency: 100, label: '100' },
  { frequency: 1000, label: '1k' },
  { frequency: 10000, label: '10k' },
];

const xFor = (frequency: number) =>
  (Math.log(frequency / SPECTRUM_MIN_HZ) / Math.log(SPECTRUM_MAX_HZ / SPECTRUM_MIN_HZ)) * WIDTH;

/** Theoretical spectral shape: shows at a glance how colour and filters shape the sound. */
export function SpectrumView({ config }: { config: NoiseConfig }) {
  const { line, area } = useMemo(() => {
    const points = spectrumCurve(config).map(
      (point) => `${(point.x * WIDTH).toFixed(1)},${((point.db / SPECTRUM_FLOOR_DB) * HEIGHT).toFixed(1)}`,
    );
    const path = `M ${points.join(' L ')}`;
    return { line: path, area: `${path} L ${WIDTH},${HEIGHT} L 0,${HEIGHT} Z` };
  }, [config]);

  return (
    <figure className="spectrum">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Spettro teorico del ${NOISE_TYPE_INFO[config.type].label} noise filtrato tra ${formatParam(PARAM_SPEC_BY_KEY.lowCut, config.lowCut)} e ${formatParam(PARAM_SPEC_BY_KEY.highCut, config.highCut)}`}
      >
        <defs>
          <linearGradient id="spectrum-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" className="spectrum__stop" stopOpacity="0.45" />
            <stop offset="1" className="spectrum__stop" stopOpacity="0" />
          </linearGradient>
        </defs>
        {GRID_FREQUENCIES.map(({ frequency }) => (
          <line key={frequency} className="spectrum__grid" x1={xFor(frequency)} x2={xFor(frequency)} y1={0} y2={HEIGHT} />
        ))}
        <path className="spectrum__area" d={area} fill="url(#spectrum-fill)" />
        <path className="spectrum__line" d={line} />
      </svg>
      <figcaption className="spectrum__axis" aria-hidden="true">
        <span>20 Hz</span>
        {GRID_FREQUENCIES.map(({ frequency, label }) => (
          <span key={frequency} style={{ left: `${(xFor(frequency) / WIDTH) * 100}%` }}>
            {label}
          </span>
        ))}
        <span>20k</span>
      </figcaption>
    </figure>
  );
}
