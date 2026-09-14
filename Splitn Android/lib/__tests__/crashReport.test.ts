// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  markScanStarted, markScanPhase, markScanImageSize, markScanFinished,
  consumeInterruptedScan, describePhase,
} from '../crashReport';

beforeEach(() => {
  localStorage.clear();
  markScanFinished();
});

describe('detección de escaneos interrumpidos', () => {
  it('no avisa cuando nunca se escaneó', () => {
    expect(consumeInterruptedScan()).toBeNull();
  });

  it('no avisa cuando el escaneo terminó', () => {
    markScanStarted();
    markScanPhase('inference');
    markScanFinished();
    expect(consumeInterruptedScan()).toBeNull();
  });

  it('dice en qué fase murió el escaneo', () => {
    // Simula que la pestaña se cerró durante la inferencia: nadie limpió.
    markScanStarted();
    markScanPhase('inference');
    expect(consumeInterruptedScan()).toMatchObject({ phase: 'inference' });
  });

  it('empieza marcando la carga del motor', () => {
    markScanStarted();
    expect(consumeInterruptedScan()).toMatchObject({ phase: 'engine' });
  });

  it('conserva el tamaño de la foto, que es lo que dispara la memoria', () => {
    markScanStarted();
    markScanPhase('preprocess');
    markScanImageSize(12_000_000);
    expect(consumeInterruptedScan()).toMatchObject({ phase: 'preprocess', pixels: 12_000_000 });
  });

  it('solo avisa una vez', () => {
    markScanStarted();
    expect(consumeInterruptedScan()).not.toBeNull();
    expect(consumeInterruptedScan()).toBeNull();
  });

  it('ignora una marca vieja de otra sesión', () => {
    const haceUnaHora = Date.now() - 60 * 60 * 1000;
    localStorage.setItem('splitn:scan-progress', JSON.stringify({ phase: 'inference', at: haceUnaHora }));
    expect(consumeInterruptedScan()).toBeNull();
  });

  it('ignora una marca corrupta sin reventar', () => {
    localStorage.setItem('splitn:scan-progress', 'no es json');
    expect(consumeInterruptedScan()).toBeNull();
  });
});

describe('describePhase', () => {
  it('describe cada fase en los dos idiomas', () => {
    expect(describePhase('inference', 'es')).toBe('leyendo el ticket');
    expect(describePhase('inference', 'en')).toBe('reading the receipt');
  });
});
