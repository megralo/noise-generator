import type { ReactNode } from 'react';

export type NoticeTone = 'info' | 'success' | 'warning' | 'error';

interface NoticeProps {
  tone: NoticeTone;
  children: ReactNode;
  onDismiss?: () => void;
}

export function Notice({ tone, children, onDismiss }: NoticeProps) {
  return (
    <div className="notice" data-tone={tone} role={tone === 'error' ? 'alert' : 'status'}>
      <div className="min-w-0 flex-1">{children}</div>
      {onDismiss && (
        <button type="button" className="icon-button -my-1 -mr-1 shrink-0" onClick={onDismiss} aria-label="Chiudi avviso">
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M5 5l10 10M15 5L5 15" />
          </svg>
        </button>
      )}
    </div>
  );
}
