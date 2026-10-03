import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TransportButton } from './TransportButton';

describe('TransportButton', () => {
  it('keeps the focus while starting and ignores clicks until ready', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    const { rerender } = render(<TransportButton status="stopped" disabled={false} onToggle={onToggle} />);
    const button = screen.getByRole('button', { name: 'Avvia' });
    await user.click(button);
    expect(onToggle).toHaveBeenCalledTimes(1);

    rerender(<TransportButton status="starting" disabled={false} onToggle={onToggle} />);
    expect(document.activeElement).toBe(button);
    expect((button as HTMLButtonElement).disabled).toBe(false);
    expect(button.getAttribute('aria-disabled')).toBe('true');
    await user.click(button);
    expect(onToggle).toHaveBeenCalledTimes(1);

    rerender(<TransportButton status="playing" disabled={false} onToggle={onToggle} />);
    expect(screen.getByRole('button', { name: 'Ferma' }).getAttribute('aria-disabled')).toBeNull();
  });

  it('is really disabled when playback is not supported', () => {
    render(<TransportButton status="stopped" disabled onToggle={vi.fn()} />);
    expect((screen.getByRole('button', { name: 'Avvia' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
