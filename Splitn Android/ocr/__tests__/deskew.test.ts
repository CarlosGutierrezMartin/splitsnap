import { describe, it, expect } from 'vitest';
import { estimateSkew, deskew } from '../deskew';
import { groupIntoRows } from '../parseReceipt';
import type { OcrLine } from '../types';

function box(text: string, x: number, y: number): OcrLine {
  const height = 20;
  return { text, score: 0.95, box: { x, y, width: text.length * 10, height, centerY: y + height / 2 } };
}

/**
 * Genera un ticket rotando las coordenadas un ángulo dado, como saldría de
 * una foto hecha a pulso.
 */
function tilted(degrees: number): OcrLine[] {
  const flat: Array<[string, number, number]> = [
    ['CERVEZA', 10, 100], ['5,00', 300, 100],
    ['TORTILLA', 10, 140], ['8,50', 300, 140],
    ['PULPO', 10, 180], ['14,00', 300, 180],
    ['TOTAL', 10, 240], ['27,50', 300, 240],
  ];

  const rad = (degrees * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const cx = 200;
  const cy = 170;

  return flat.map(([text, x, y]) => {
    const width = text.length * 10;
    const px = x + width / 2 - cx;
    const py = y + 10 - cy;
    const centerX = px * cos - py * sin + cx;
    const centerY = px * sin + py * cos + cy;
    return {
      text, score: 0.95,
      box: { x: centerX - width / 2, y: centerY - 10, width, height: 20, centerY },
    };
  });
}

describe('estimateSkew', () => {
  it('no ve inclinación en un ticket recto', () => {
    expect(estimateSkew(tilted(0))).toBe(0);
  });

  it('mide la inclinación de un ticket torcido', () => {
    const angle = (estimateSkew(tilted(6)) * 180) / Math.PI;
    expect(angle).toBeCloseTo(6, 0);
  });

  it('mide también la inclinación en el otro sentido', () => {
    const angle = (estimateSkew(tilted(-5)) * 180) / Math.PI;
    expect(angle).toBeCloseTo(-5, 0);
  });

  it('ignora inclinaciones ínfimas que no compensa corregir', () => {
    expect(estimateSkew(tilted(0.2))).toBe(0);
  });

  it('nunca corrige más allá del rango que puede arreglar', () => {
    // Un ticket a 40° no tiene arreglo por software: habría que rehacer la
    // foto. Lo que sí se garantiza es que la corrección se queda dentro del
    // rango soportado y no empeora el emparejado de filas.
    const muyTorcido = tilted(40);
    const grados = (estimateSkew(muyTorcido) * 180) / Math.PI;
    expect(Math.abs(grados)).toBeLessThanOrEqual(12);

    const antes = groupIntoRows(muyTorcido).filter((f) => f.length >= 2).length;
    const despues = groupIntoRows(deskew(muyTorcido).lines).filter((f) => f.length >= 2).length;
    expect(despues).toBeGreaterThanOrEqual(antes);
  });

  it('no revienta con muy pocas cajas', () => {
    expect(estimateSkew([box('SOLO', 10, 10)])).toBe(0);
    expect(estimateSkew([])).toBe(0);
  });
});

describe('deskew', () => {
  it('devuelve el mismo array cuando no hay que corregir nada', () => {
    const lines = tilted(0);
    expect(deskew(lines).lines).toBe(lines);
  });

  it('el caso que de verdad importa: un ticket torcido rompe las filas', () => {
    // Sin corregir, nombre y precio de la misma línea caen en filas
    // distintas porque sus coordenadas Y se separan. Este es el fallo
    // silencioso: el precio queda huérfano y la línea se pierde.
    const torcido = tilted(7);
    const filasSinCorregir = groupIntoRows(torcido);
    const emparejadasSin = filasSinCorregir.filter((f) => f.length >= 2).length;

    const filasCorregidas = groupIntoRows(deskew(torcido).lines);
    const emparejadasCon = filasCorregidas.filter((f) => f.length >= 2).length;

    expect(emparejadasSin).toBeLessThan(4);
    expect(emparejadasCon).toBe(4);
  });

  it('deja cada nombre junto a su precio tras corregir', () => {
    const filas = groupIntoRows(deskew(tilted(7)).lines);
    const textos = filas.map((f) => f.map((l) => l.text).join(' '));
    expect(textos).toContain('CERVEZA 5,00');
    expect(textos).toContain('TORTILLA 8,50');
    expect(textos).toContain('PULPO 14,00');
  });
});
