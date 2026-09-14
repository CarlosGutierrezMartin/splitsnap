import { describe, it, expect } from 'vitest';
import { parseReceipt } from '../parseReceipt';
import type { OcrLine } from '../types';

/**
 * Ticket real de restaurante español, formato UNID. / DESCRIPCION / PRECIO /
 * IMPORTE. Es el caso que destapó que "3 COCA COLA" acababa como un solo
 * artículo llamado "3COCA COLA" a 11,25 €, en vez de 3 unidades a 3,75 €.
 *
 * Las coordenadas reproducen la maquetación: unidades a la izquierda,
 * descripción a continuación, y dos columnas de importes alineadas a la
 * derecha.
 */

const ROW_HEIGHT = 22;
const PRECIO_RIGHT = 470;
const IMPORTE_RIGHT = 600;

function at(text: string, x: number, y: number, score = 0.93): OcrLine {
  const width = text.length * 11;
  return { text, score, box: { x, y, width, height: ROW_HEIGHT, centerY: y + ROW_HEIGHT / 2 } };
}

function rightAligned(text: string, rightEdge: number, y: number, score = 0.93): OcrLine {
  const width = text.length * 11;
  return {
    text, score,
    box: { x: rightEdge - width, y, width, height: ROW_HEIGHT, centerY: y + ROW_HEIGHT / 2 },
  };
}

/** [texto de unidades+descripcion, precio unitario, importe] */
const LINEAS: Array<[string, string, string]> = [
  ['8 PAN', '1,50', '12,00'],
  ['1 RACION CROQUETAS', '13,00', '13,00'],
  ['2 RAC.1/2 MORCILLA ARTESANA', '6,25', '12,50'],
  ['7 CONSOME', '6,00', '42,00'],
  ['1 CHURRASCO', '33,00', '33,00'],
  ['1 HUEVOS C/PATATAS', '13,00', '13,00'],
  ['1 ESCALOPE MILANESA', '16,00', '16,00'],
  ['1 ESCALOPINES MEDIA', '18,00', '18,00'],
  ['1 HUEVOS C/JAMON BELLOTA', '22,50', '22,50'],
  ['1 SOLOMILLO ROQUEFORT', '28,00', '28,00'],
  ['1 SOLOMILLO A LA BRASA', '28,00', '28,00'],
  ['3 SORBETE', '7,00', '21,00'],
  // El caso que fallaba: el OCR se come el hueco y devuelve "3COCA COLA".
  ['3COCA COLA', '3,75', '11,25'],
  ['3 AGUA LITRO', '4,00', '12,00'],
  ['2 DOBLE 0,0 TOSTADA', '4,00', '8,00'],
  ['1 CAFE SOLO', '2,75', '2,75'],
];

function ticket(): OcrLine[] {
  const lines: OcrLine[] = [
    at('MESA:050', 40, 0),
    at('UNID. DESCRIPCION', 40, 40),
    rightAligned('PRECIO', PRECIO_RIGHT, 40),
    rightAligned('IMPORTE', IMPORTE_RIGHT, 40),
  ];

  LINEAS.forEach(([etiqueta, precio, importe], i) => {
    const y = 90 + i * 40;
    lines.push(at(etiqueta, 55, y));
    lines.push(rightAligned(precio, PRECIO_RIGHT, y));
    lines.push(rightAligned(importe, IMPORTE_RIGHT, y));
  });

  const pie = 90 + LINEAS.length * 40;
  lines.push(at('SUBTOTAL', 40, pie), rightAligned('293,00', IMPORTE_RIGHT, pie));
  lines.push(at('BASE', 55, pie + 60), at('266,36', 55, pie + 90));
  lines.push(at('%IVA', 300, pie + 60), at('10,00', 300, pie + 90));
  lines.push(at('IMP.IVA', 520, pie + 60), rightAligned('26,64', IMPORTE_RIGHT, pie + 90));
  lines.push(at('TOTAL EUROS', 40, pie + 140), rightAligned('293,00', IMPORTE_RIGHT, pie + 140));
  lines.push(at('PENDIENTE DE COBRO', 40, pie + 190), rightAligned('293,00', IMPORTE_RIGHT, pie + 190));
  lines.push(at('EMPLEADO: ruben', 40, pie + 240));
  lines.push(at('GRACIAS POR SU VISITA', 150, pie + 290));

  return lines;
}

describe('ticket real de restaurante', () => {
  it('reconoce los 16 artículos', () => {
    expect(parseReceipt(ticket()).items).toHaveLength(16);
  });

  it('separa la cantidad del nombre aunque el OCR los pegue', () => {
    // El fallo original: un artículo "3COCA COLA" de 11,25 € en vez de 3
    // unidades de 3,75 €. La cantidad se deduce de 11,25 / 3,75.
    const cola = parseReceipt(ticket()).items.find((i) => i.name.includes('COCA'));
    expect(cola).toMatchObject({ name: 'COCA COLA', quantity: 3, unitPrice: 3.75, totalPrice: 11.25 });
  });

  it('saca bien la cantidad y el precio unitario de cada línea', () => {
    const items = parseReceipt(ticket()).items;
    const porNombre = (n: string) => items.find((i) => i.name.startsWith(n));

    expect(porNombre('PAN')).toMatchObject({ quantity: 8, unitPrice: 1.5, totalPrice: 12 });
    expect(porNombre('CONSOME')).toMatchObject({ quantity: 7, unitPrice: 6, totalPrice: 42 });
    expect(porNombre('SORBETE')).toMatchObject({ quantity: 3, unitPrice: 7, totalPrice: 21 });
    expect(porNombre('CHURRASCO')).toMatchObject({ quantity: 1, unitPrice: 33, totalPrice: 33 });
  });

  it('no confunde con la cantidad un nombre que lleva números', () => {
    const items = parseReceipt(ticket()).items;
    expect(items.find((i) => i.name.includes('MORCILLA'))).toMatchObject({
      name: 'RAC.1/2 MORCILLA ARTESANA', quantity: 2, unitPrice: 6.25,
    });
    expect(items.find((i) => i.name.includes('TOSTADA'))).toMatchObject({
      name: 'DOBLE 0,0 TOSTADA', quantity: 2, unitPrice: 4,
    });
  });

  it('encuentra el total impreso', () => {
    expect(parseReceipt(ticket()).detectedTotal).toBe(293);
  });

  it('la suma cuadra con el total: el ticket se ha leído entero', () => {
    const { verdict } = parseReceipt(ticket());
    expect(verdict.sum).toBe(293);
    expect(verdict.level).toBe('balanced');
  });

  it('descarta el pie entero, incluidos BASE, %IVA e IMP.IVA', () => {
    const nombres = parseReceipt(ticket()).items.map((i) => i.name);
    for (const basura of ['SUBTOTAL', 'BASE', 'IVA', 'TOTAL', 'PENDIENTE', 'EMPLEADO', 'GRACIAS']) {
      expect(nombres.some((n) => n.includes(basura))).toBe(false);
    }
  });

  it('descarta la cabecera de columnas y el número de mesa', () => {
    const nombres = parseReceipt(ticket()).items.map((i) => i.name);
    expect(nombres.some((n) => n.includes('DESCRIPCION'))).toBe(false);
    expect(nombres.some((n) => n.includes('MESA'))).toBe(false);
  });
});
