// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScanningView } from '../components/ScanningView';
import { ThemeProvider } from '../contexts/ThemeContext';
import { LanguageProvider } from '../contexts/LanguageContext';
import type { OcrStatus } from '../ocr/types';

function renderWith(status: OcrStatus) {
  return render(
    <ThemeProvider>
      <LanguageProvider>
        <ScanningView status={status} error={null} onRetry={() => {}} onEnterManually={() => {}} />
      </LanguageProvider>
    </ThemeProvider>,
  );
}

describe('pantalla de carga del modelo', () => {
  it('enseña porcentaje y MB reales, no una rueda ciega', () => {
    renderWith({
      phase: 'downloading', source: 'local',
      progress: { loaded: 10_485_760, total: 20_971_520 },
    });

    expect(screen.getByText(/50%/)).toBeTruthy();
    expect(screen.getByText(/10\.0 \/ 20\.0 MB/)).toBeTruthy();
  });

  it('expone el avance a lectores de pantalla', () => {
    renderWith({
      phase: 'downloading', source: 'local',
      progress: { loaded: 5_242_880, total: 20_971_520 },
    });

    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('25');
  });

  it('no inventa un porcentaje cuando no se sabe el total', () => {
    // Sin content-length se enseñan los MB descargados, que son reales, en
    // vez de una barra que avanzaría sola sin significar nada.
    renderWith({
      phase: 'downloading', source: 'local',
      progress: { loaded: 3_145_728, total: 0 },
    });

    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.getByText(/3\.0 MB/)).toBeTruthy();
  });

  it('distingue la descarga de la preparación del motor', () => {
    renderWith({ phase: 'initializing', source: 'local' });
    expect(screen.getByText(/preparando el lector|preparing the reader/i)).toBeTruthy();
  });

  it('al leer el ticket ya no habla de descargas', () => {
    renderWith({ phase: 'ready', source: 'local' });
    expect(screen.getByText(/leyendo el ticket|reading the receipt/i)).toBeTruthy();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });
});
