import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { STORAGE_KEY } from './presets/presetStorage';

const valueOf = (name: string) => screen.getByRole('slider', { name }).getAttribute('aria-valuenow');
const alertsText = () => screen.getAllByRole('alert').map((alert) => alert.textContent).join(' | ');

describe('App', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders six knobs and six noise colours', () => {
    render(<App />);
    expect(screen.getAllByRole('slider')).toHaveLength(6);
    expect(screen.getAllByRole('radio')).toHaveLength(6);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Pink noise');
  });

  it('explains when Web Audio is not available instead of crashing', () => {
    render(<App />);
    expect(alertsText()).toContain('non supporta la Web Audio API');
    expect((screen.getByRole('button', { name: /avvia/i }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('switches noise colour with the keyboard-accessible radio group', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('radio', { name: /brown/i }));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Brown noise');
  });

  it('applies a built-in preset and flags later edits as modified', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Oceano' }));
    expect(screen.getByRole('button', { name: 'Oceano' }).getAttribute('aria-pressed')).toBe('true');
    expect(valueOf('Volume')).toBe('65');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Brown noise');

    screen.getByRole('slider', { name: 'Volume' }).focus();
    await user.keyboard('{ArrowUp}');
    expect(screen.getByText('modificato')).toBeTruthy();
  });

  it('saves, renames and deletes a user preset, persisting it locally', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByPlaceholderText('Nome del preset'), 'Studio{Enter}');
    const list = screen.getByRole('list', { name: 'Preset personali' });
    expect(within(list).getByRole('button', { name: 'Studio' }).getAttribute('aria-pressed')).toBe('true');
    expect(window.localStorage.getItem(STORAGE_KEY)).toContain('Studio');

    await user.click(screen.getByRole('button', { name: 'Rinomina Studio' }));
    const input = screen.getByRole('textbox', { name: 'Nuovo nome per Studio' });
    await user.clear(input);
    await user.type(input, 'Pioggia{Enter}');
    expect(alertsText()).toContain('Esiste già');
    await user.clear(input);
    await user.type(input, 'Studio notte{Enter}');
    expect(within(list).getByRole('button', { name: 'Studio notte' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Elimina Studio notte' }));
    await user.click(screen.getByRole('button', { name: 'Elimina' }));
    expect(screen.queryByRole('list', { name: 'Preset personali' })).toBeNull();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('[]');
  });

  it('picks up presets saved in another tab instead of overwriting them', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Another tab saves a preset: the browser only notifies the other tabs.
    const fromOtherTab = { id: 'user-other', name: 'Altra scheda', config: { type: 'brown', volume: 40, lowCut: 20, highCut: 5000, width: 100, modRate: 0.2, modDepth: 0 } };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([fromOtherTab]));
    fireEvent(window, new StorageEvent('storage', { key: STORAGE_KEY, storageArea: window.localStorage }));

    const list = screen.getByRole('list', { name: 'Preset personali' });
    expect(within(list).getByRole('button', { name: 'Altra scheda' })).toBeTruthy();

    await user.type(screen.getByPlaceholderText('Nome del preset'), 'Questa scheda{Enter}');
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]') as { name: string }[];
    expect(stored.map((preset) => preset.name)).toEqual(['Altra scheda', 'Questa scheda']);
  });

  it('forgets the active preset when another tab deletes it', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.type(screen.getByPlaceholderText('Nome del preset'), 'Studio{Enter}');
    const saved = window.localStorage.getItem(STORAGE_KEY)!;

    const otherTabWrites = (value: string) => {
      window.localStorage.setItem(STORAGE_KEY, value);
      fireEvent(window, new StorageEvent('storage', { key: STORAGE_KEY, storageArea: window.localStorage }));
    };
    otherTabWrites('[]');
    expect(screen.getByText('Configurazione libera')).toBeTruthy();

    // The same preset comes back (e.g. restored storage): it must not look applied again.
    otherTabWrites(saved);
    const list = screen.getByRole('list', { name: 'Preset personali' });
    expect(within(list).getByRole('button', { name: 'Studio' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByText('Configurazione libera')).toBeTruthy();
  });

  it('rejects an empty preset name', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Salva' }));
    expect(alertsText()).toContain('Inserisci un nome');
  });

  it('imports a CSV configuration and reports warnings', async () => {
    const user = userEvent.setup();
    render(<App />);
    const file = new File(['parameter,value,unit\ntype,violet,\nvolume,120,%\n'], 'config.csv', { type: 'text/csv' });
    await user.upload(screen.getByLabelText(/importa csv/i), file);

    await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Violet noise'));
    expect(valueOf('Volume')).toBe('100');
    expect(screen.getByText(/importata con 6 avvisi/)).toBeTruthy();
  });

  it('shows import errors with line numbers and keeps the current configuration', async () => {
    render(<App />);
    const file = new File(['parameter,value,unit\ntype,green,\n'], 'bad.csv', { type: 'text/csv' });
    fireEvent.change(screen.getByLabelText(/importa csv/i), { target: { files: [file] } });

    await waitFor(() => expect(screen.getByText(/Riga 2: tipo di noise "green" sconosciuto/)).toBeTruthy());
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Pink noise');
  });

  it('explains when offline rendering is not available', () => {
    render(<App />);
    expect(screen.getByText(/non supporta il rendering audio offline/)).toBeTruthy();
  });

  it('keeps the drop zone highlighted while dragging over its own content', () => {
    render(<App />);
    const zone = screen.getByLabelText(/importa csv/i).closest('label')!;
    const child = within(zone).getByText('Importa CSV');

    // jsdom has no DragEvent: a MouseEvent of the same type carries relatedTarget.
    const dragLeave = (relatedTarget: Element) => fireEvent(zone, new MouseEvent('dragleave', { bubbles: true, relatedTarget }));

    fireEvent.dragOver(zone);
    expect(zone.hasAttribute('data-active')).toBe(true);
    dragLeave(child);
    expect(zone.hasAttribute('data-active')).toBe(true);
    dragLeave(document.body);
    expect(zone.hasAttribute('data-active')).toBe(false);
  });

  it('rejects files that are not CSV', async () => {
    render(<App />);
    const file = new File(['x'], 'photo.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText(/importa csv/i), { target: { files: [file] } });
    await waitFor(() => expect(screen.getByText(/non è un file CSV/)).toBeTruthy());
  });

  it('validates the WAV export duration', async () => {
    vi.stubGlobal('OfflineAudioContext', function OfflineAudioContext() {});
    const user = userEvent.setup();
    render(<App />);
    const duration = screen.getByLabelText('Durata in secondi');
    await user.clear(duration);
    await user.type(duration, '900');
    expect(screen.getByText(/compresa tra 1 e 600/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '1 min' }));
    expect((duration as HTMLInputElement).value).toBe('60');
  });
});
