import type { PlaybackStatus } from '../hooks/useNoiseEngine';

interface TransportButtonProps {
  status: PlaybackStatus;
  disabled: boolean;
  onToggle: () => void;
}

export function TransportButton({ status, disabled, onToggle }: TransportButtonProps) {
  const playing = status === 'playing';
  const starting = status === 'starting';
  const label = playing ? 'Ferma' : 'Avvia';
  return (
    <button
      type="button"
      className="transport"
      data-state={status}
      // While starting, aria-disabled instead of disabled: a disabled button would drop the keyboard focus.
      onClick={starting ? undefined : onToggle}
      disabled={disabled}
      aria-disabled={starting || undefined}
      aria-busy={starting}
      aria-keyshortcuts="Space"
    >
      <span className="transport__ring" aria-hidden="true" />
      <svg className="transport__icon" viewBox="0 0 24 24" aria-hidden="true">
        {playing ? <rect x="6.5" y="6.5" width="11" height="11" rx="2" /> : <path d="M8 5.5v13l11-6.5z" />}
      </svg>
      <span className="transport__label">{starting ? 'Avvio…' : label}</span>
    </button>
  );
}
