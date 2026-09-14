import { describe, it, expect } from 'vitest';
import { buildVerdict } from '../verdict';
import type { ParsedItem } from '../../types';

function item(name: string, totalPrice: number, score?: number): ParsedItem {
  return {
    id: name, name, quantity: 1, unitPrice: totalPrice, totalPrice,
    ...(score !== undefined ? { score } : {}),
  };
}

describe('buildVerdict', () => {
  it('da por bueno el ticket cuando la suma cuadra con el total impreso', () => {
    const v = buildVerdict([item('CERVEZA', 5), item('TORTILLA', 8.5)], 13.5);
    expect(v.level).toBe('balanced');
    expect(v.difference).toBe(0);
  });

  it('tolera el redondeo de los céntimos', () => {
    expect(buildVerdict([item('CAFE', 1.2), item('TE', 1.15)], 2.36).level).toBe('balanced');
  });

  it('avisa de que no puede verificar sin total impreso', () => {
    const v = buildVerdict([item('CERVEZA', 5)], null);
    expect(v.level).toBe('unverified');
    expect(v.difference).toBeNull();
  });

  it('detecta que falta algo y dice cuánto', () => {
    const v = buildVerdict([item('CERVEZA', 5)], 13.5);
    expect(v.level).toBe('mismatch');
    // Negativo = falta por leer. Ese importe suele bastar para ver qué línea.
    expect(v.difference).toBe(-8.5);
  });

  it('detecta que sobra algo y dice cuánto', () => {
    const v = buildVerdict([item('CERVEZA', 5), item('MESA', 12)], 5);
    expect(v.level).toBe('mismatch');
    expect(v.difference).toBe(12);
  });

  it('un ticket sin artículos nunca es fiable', () => {
    expect(buildVerdict([], 13.5).level).toBe('mismatch');
  });

  it('cuenta las líneas dudosas aunque el ticket cuadre', () => {
    // Puede cuadrar y aun así tener nombres mal leídos: son cosas distintas.
    const v = buildVerdict([item('CERVEZA', 5, 0.55), item('TORTILLA', 8.5, 0.9)], 13.5);
    expect(v.level).toBe('balanced');
    expect(v.uncertainItems).toBe(1);
  });

  it('no cuenta como dudosas las líneas escritas a mano', () => {
    const v = buildVerdict([item('CERVEZA', 5), item('TORTILLA', 8.5)], 13.5);
    expect(v.uncertainItems).toBe(0);
  });
});
