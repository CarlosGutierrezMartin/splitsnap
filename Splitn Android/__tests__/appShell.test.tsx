// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

vi.mock('../ocr/engine', () => ({
  scanReceipt: vi.fn(),
  loadOcrEngine: () => Promise.resolve({}),
  onOcrStatus: (l: (s: unknown) => void) => { l({ phase: 'idle', source: 'unknown' }); return () => {}; },
  getOcrStatus: () => ({ phase: 'idle', source: 'unknown' }),
}));

import App from '../App';
import { ThemeProvider } from '../contexts/ThemeContext';
import { LanguageProvider } from '../contexts/LanguageContext';

function renderApp() {
  return render(
    <ThemeProvider><LanguageProvider><App /></LanguageProvider></ThemeProvider>,
  );
}

beforeEach(() => localStorage.clear());

describe('pantalla de arranque', () => {
  beforeEach(() => {
    // El resto de la suite parte de alguien que ya la vio; aqui interesa
    // justo el arranque en frio.
    sessionStorage.clear();
    localStorage.setItem('splitn:onboarded', '1');
  });

  it('tapa la app y cuenta lo que hace mientras arranca', async () => {
    renderApp();
    expect(await screen.findByText(/works offline|funciona sin conexión/i)).toBeTruthy();
    // Nada de la app debajo es alcanzable todavia.
    expect(screen.queryByRole('main')).toBeNull();
  });

  it('se puede saltar con un toque', async () => {
    renderApp();
    fireEvent.click(await screen.findByText(/works offline|funciona sin conexión/i));
    await waitFor(() =>
      expect(within(screen.getByRole('main')).getByRole('button', { name: /^(scan|escanear)$/i })).toBeTruthy());
  });

  it('no repite en el mismo arranque del navegador', async () => {
    const { unmount } = renderApp();
    fireEvent.click(await screen.findByText(/works offline|funciona sin conexión/i));
    await screen.findByRole('main');
    unmount();

    renderApp();
    // Ya no hay presentacion: se entra directo.
    await waitFor(() => expect(screen.getByRole('main')).toBeTruthy());
    expect(screen.queryByText(/works offline|funciona sin conexión/i)).toBeNull();
  });
});

describe('presentación de bienvenida', () => {
  it('se muestra la primera vez', async () => {
    renderApp();
    expect(await screen.findByText(/take a photo of the receipt|haz una foto del ticket/i)).toBeTruthy();
  });

  it('explica que la foto no sale del móvil', async () => {
    // Es lo que diferencia la app; si no se cuenta, nadie lo supone.
    renderApp();
    expect(await screen.findByText(/never leaves your phone|no sale de tu móvil/i)).toBeTruthy();
  });

  it('avanza paso a paso hasta poder empezar', async () => {
    renderApp();
    // Los pasos entran y salen con animacion, asi que hay que esperarlos.
    fireEvent.click(await screen.findByRole('button', { name: /^next$|^siguiente$/i }));
    expect(await screen.findByText(/check what was read|revisa lo leído/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /^next$|^siguiente$/i }));
    expect(await screen.findByText(/split it with anyone|reparte entre quien quieras/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /get started|empezar/i }));
    await waitFor(() => expect(within(screen.getByRole('main')).getByRole('button', { name: /^(scan|escanear)$/i })).toBeTruthy());
  });

  it('se puede saltar', async () => {
    renderApp();
    fireEvent.click(await screen.findByRole('button', { name: /^skip$|^saltar$/i }));
    await waitFor(() => expect(within(screen.getByRole('main')).getByRole('button', { name: /^(scan|escanear)$/i })).toBeTruthy());
  });

  it('no vuelve a salir una vez vista', async () => {
    localStorage.setItem('splitn:onboarded', '1');
    renderApp();
    await waitFor(() => expect(within(screen.getByRole('main')).getByRole('button', { name: /^(scan|escanear)$/i })).toBeTruthy());
    expect(screen.queryByRole('button', { name: /get started|empezar/i })).toBeNull();
  });
});

describe('pestañas', () => {
  beforeEach(() => localStorage.setItem('splitn:onboarded', '1'));

  it('ofrece inicio, escanear y ajustes', async () => {
    renderApp();
    const barra = await screen.findByRole('navigation', { name: /sections|secciones/i });
    expect(barra.textContent).toMatch(/home|inicio/i);
    expect(barra.textContent).toMatch(/scan|escanear/i);
    expect(barra.textContent).toMatch(/settings|ajustes/i);
  });

  it('lleva a los ajustes y de vuelta al inicio', async () => {
    renderApp();
    const barra = await screen.findByRole('navigation', { name: /sections|secciones/i });

    fireEvent.click(within(barra).getByRole('button', { name: /settings|ajustes/i }));
    expect(await screen.findByText(/^theme$|^tema$/i)).toBeTruthy();

    fireEvent.click(within(barra).getByRole('button', { name: /home|inicio/i }));
    await waitFor(() => expect(within(screen.getByRole('main')).getByRole('button', { name: /^(scan|escanear)$/i })).toBeTruthy());
  });

  it('el banco de pruebas está deshabilitado sin ningún escaneo', async () => {
    renderApp();
    const barra = await screen.findByRole('navigation', { name: /sections|secciones/i });
    fireEvent.click(within(barra).getByRole('button', { name: /settings|ajustes/i }));

    const banco = await screen.findByRole('button', { name: /test bench|banco de pruebas/i });
    expect(banco.hasAttribute('disabled')).toBe(true);
  });
});
