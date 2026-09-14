// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

/**
 * Recorre el flujo completo con el OCR simulado.
 *
 * El motor real no puede correr en un test (pesa decenas de MB y necesita
 * WASM), pero el fallo que buscamos no está en leer la imagen: está en lo que
 * pasa DESPUÉS, al pintar la pantalla de revisión con lo leído.
 */

const scanReceipt = vi.fn();

vi.mock('../ocr/engine', () => ({
  scanReceipt: (...args: unknown[]) => scanReceipt(...args),
  loadOcrEngine: () => Promise.resolve({}),
  onOcrStatus: (listener: (s: unknown) => void) => {
    listener({ phase: 'ready', source: 'local' });
    return () => {};
  },
  getOcrStatus: () => ({ phase: 'ready', source: 'local' }),
}));

import App from '../App';
import { ThemeProvider } from '../contexts/ThemeContext';
import { LanguageProvider } from '../contexts/LanguageContext';
import type { OcrLine } from '../ocr/types';

function line(text: string, x: number, y: number, score = 0.95): OcrLine {
  return { text, score, box: { x, y, width: text.length * 10, height: 20, centerY: y + 10 } };
}

function priceLine(text: string, y: number, rightEdge = 360): OcrLine {
  const width = text.length * 10;
  return { text, score: 0.95, box: { x: rightEdge - width, y, width, height: 20, centerY: y + 10 } };
}

/** Salida de OCR parecida a la de un ticket de bar real. */
const TICKET: OcrLine[] = [
  line('BAR LA PLAZA', 40, 0),
  line('CERVEZA', 10, 100), priceLine('5,00', 100),
  line('TORTILLA', 10, 130), priceLine('8,50', 130),
  line('TOTAL', 10, 200), priceLine('13,50', 200),
];

function renderApp() {
  return render(
    <ThemeProvider>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </ThemeProvider>,
  );
}

async function scanWith(lines: OcrLine[]) {
  scanReceipt.mockResolvedValue({ lines, image: { width: 400, height: 300 }, elapsedMs: 10 });
  const { container } = renderApp();

  fireEvent.click(await screen.findByRole('button', { name: /escanear ticket|scan receipt/i }));

  const input = container.querySelector('input[type=file]') as HTMLInputElement;
  const file = new File([new Uint8Array([1, 2, 3])], 'ticket.png', { type: 'image/png' });
  fireEvent.change(input, { target: { files: [file] } });
}

beforeEach(() => {
  scanReceipt.mockReset();
  localStorage.clear();
});

describe('flujo de escaneo', () => {
  it('llega a la pantalla de revisión con los artículos leídos', async () => {
    await scanWith(TICKET);

    await waitFor(() => {
      expect(screen.getByDisplayValue('CERVEZA')).toBeTruthy();
    }, { timeout: 5000 });

    expect(screen.getByDisplayValue('TORTILLA')).toBeTruthy();
    // El total impreso debe aparecer para poder contrastarlo.
    // El total impreso aparece dos veces (suma y total del ticket): basta con
    // comprobar que la pantalla lo muestra.
    expect(screen.getAllByText(/13,50/).length).toBeGreaterThan(0);
  });

  it('no se queda en blanco cuando el OCR no reconoce ningún artículo', async () => {
    // Caso muy real: foto borrosa. Debe ofrecer añadir a mano, no romperse.
    await scanWith([line('GRACIAS POR SU VISITA', 10, 100)]);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /añadir artículo|add item/i })).toBeTruthy();
    }, { timeout: 5000 });
  });

  it('dice que el ticket cuadra cuando la suma coincide con el total', async () => {
    await scanWith(TICKET);
    await waitFor(() => {
      expect(screen.getByText(/la suma cuadra|the sum matches/i)).toBeTruthy();
    }, { timeout: 5000 });
  });

  it('dice cuánto falta cuando la suma no llega al total impreso', async () => {
    // El precio de la tortilla se lee mal como 0,50 en vez de 8,50: el total
    // impreso delata que faltan 8,00 sin que nadie tenga que sumar a mano.
    await scanWith([
      line('CERVEZA', 10, 100), priceLine('5,00', 100),
      line('TORTILLA', 10, 130), priceLine('0,50', 130),
      line('TOTAL', 10, 200), priceLine('13,50', 200),
    ]);

    await waitFor(() => {
      expect(screen.getByText(/faltan.*8,00|8,00.*missing/i)).toBeTruthy();
    }, { timeout: 5000 });
  });

  it('avisa de que no puede verificar cuando no hay total impreso', async () => {
    await scanWith([
      line('CERVEZA', 10, 100), priceLine('5,00', 100),
      line('TORTILLA', 10, 130), priceLine('8,50', 130),
    ]);

    await waitFor(() => {
      expect(screen.getByText(/no he encontrado el total|couldn't find the printed total/i)).toBeTruthy();
    }, { timeout: 5000 });
  });

  it('recupera un ticket torcido que de otro modo perdería líneas', async () => {
    // Mismo ticket rotado 7°, como una foto hecha a pulso. Sin enderezar, el
    // nombre y su precio caen en filas distintas y las líneas se pierden.
    const rad = (7 * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const tilt = (l: OcrLine): OcrLine => {
      const px = l.box.x + l.box.width / 2 - 200;
      const py = l.box.centerY - 150;
      const cxr = px * cos - py * sin + 200;
      const cyr = px * sin + py * cos + 150;
      return { ...l, box: { ...l.box, x: cxr - l.box.width / 2, y: cyr - 10, centerY: cyr } };
    };

    await scanWith(TICKET.map(tilt));

    await waitFor(() => {
      expect(screen.getByDisplayValue('CERVEZA')).toBeTruthy();
    }, { timeout: 5000 });
    expect(screen.getByDisplayValue('TORTILLA')).toBeTruthy();
  });

  it('muestra el error en pantalla cuando el OCR falla', async () => {
    scanReceipt.mockRejectedValue(new Error('boom'));
    const { container } = renderApp();

    fireEvent.click(await screen.findByRole('button', { name: /escanear ticket|scan receipt/i }));

    const input = container.querySelector('input[type=file]') as HTMLInputElement;
    const file = new File([new Uint8Array([1])], 't.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/no se pudo leer|couldn't read/i)).toBeTruthy();
    }, { timeout: 5000 });
  });
});
