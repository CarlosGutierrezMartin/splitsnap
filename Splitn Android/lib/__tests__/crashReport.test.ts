// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { markScanStarted, markScanFinished, consumeInterruptedScan } from '../crashReport';

beforeEach(() => localStorage.clear());

describe('detección de escaneos interrumpidos', () => {
  it('no avisa cuando nunca se escaneó', () => {
    expect(consumeInterruptedScan()).toBe(false);
  });

  it('no avisa cuando el escaneo terminó', () => {
    markScanStarted();
    markScanFinished();
    expect(consumeInterruptedScan()).toBe(false);
  });

  it('avisa cuando el escaneo quedó a medias', () => {
    // Simula que la pestaña murió: la marca se puso y nadie la quitó.
    markScanStarted();
    expect(consumeInterruptedScan()).toBe(true);
  });

  it('solo avisa una vez', () => {
    markScanStarted();
    expect(consumeInterruptedScan()).toBe(true);
    expect(consumeInterruptedScan()).toBe(false);
  });

  it('ignora una marca vieja de otra sesión', () => {
    const haceUnaHora = Date.now() - 60 * 60 * 1000;
    localStorage.setItem('splitn:scan-in-progress', String(haceUnaHora));
    expect(consumeInterruptedScan()).toBe(false);
  });
});
