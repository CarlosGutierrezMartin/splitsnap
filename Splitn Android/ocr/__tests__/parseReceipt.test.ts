import { describe, it, expect } from 'vitest';
import { parseReceipt, groupIntoRows } from '../parseReceipt';
import type { OcrLine } from '../types';

/**
 * Fabrica una linea de OCR. `y` es la fila visual y `x` la columna, que es
 * todo lo que el agrupador necesita para reconstruir el ticket.
 */
function line(text: string, x: number, y: number, score = 0.95): OcrLine {
  const height = 20;
  return {
    text,
    score,
    box: { x, y, width: text.length * 10, height, centerY: y + height / 2 },
  };
}

/** Un ticket de bar tipico: nombre a la izquierda, precio a la derecha. */
function receiptLines(): OcrLine[] {
  return [
    line('BAR LA PLAZA', 40, 0),
    line('CIF B12345678', 40, 30),
    line('MESA 4', 40, 60),
    line('DESCRIPCION', 10, 100),
    line('IMPORTE', 300, 100),
    line('2 CERVEZA', 10, 140),
    line('2,50', 250, 140),
    line('5,00', 320, 140),
    line('TORTILLA', 10, 170),
    line('8,50', 320, 170),
    line('3 CAFE SOLO', 10, 200),
    line('1,20', 250, 200),
    line('3,60', 320, 200),
    line('TOTAL', 10, 260),
    line('17,10', 320, 260),
  ];
}

describe('groupIntoRows', () => {
  it('junta en una fila las cajas que comparten altura', () => {
    const rows = groupIntoRows([
      line('CERVEZA', 10, 140),
      line('5,00', 320, 142),
      line('TORTILLA', 10, 170),
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.map((l) => l.text)).toEqual(['CERVEZA', '5,00']);
  });

  it('ordena cada fila de izquierda a derecha', () => {
    const rows = groupIntoRows([line('5,00', 320, 140), line('CERVEZA', 10, 140)]);
    expect(rows[0]!.map((l) => l.text)).toEqual(['CERVEZA', '5,00']);
  });

  it('tolera una lista vacia', () => {
    expect(groupIntoRows([])).toEqual([]);
  });
});

describe('parseReceipt', () => {
  it('extrae los articulos con su cantidad y precio unitario', () => {
    const { items } = parseReceipt(receiptLines());

    expect(items).toHaveLength(3);
    expect(items[0]).toMatchObject({ name: 'CERVEZA', quantity: 2, unitPrice: 2.5, totalPrice: 5 });
    expect(items[1]).toMatchObject({ name: 'TORTILLA', quantity: 1, unitPrice: 8.5, totalPrice: 8.5 });
    expect(items[2]).toMatchObject({ name: 'CAFE SOLO', quantity: 3, unitPrice: 1.2, totalPrice: 3.6 });
  });

  it('detecta el total impreso', () => {
    expect(parseReceipt(receiptLines()).detectedTotal).toBe(17.1);
  });

  it('no avisa cuando la suma cuadra con el total', () => {
    expect(parseReceipt(receiptLines()).warnings).toEqual([]);
  });

  it('avisa cuando la suma no cuadra con el total', () => {
    const lines = receiptLines().map((l) => (l.text === '17,10' ? line('25,00', 320, 260) : l));
    const { warnings } = parseReceipt(lines);
    expect(warnings).toContainEqual({ kind: 'total-mismatch', sum: 17.1, detectedTotal: 25 });
  });

  it('descarta totales, impuestos y formas de pago', () => {
    const { items } = parseReceipt([
      line('PULPO', 10, 100),
      line('14,00', 320, 100),
      line('BASE IMPONIBLE', 10, 140),
      line('12,73', 320, 140),
      line('IVA 10%', 10, 170),
      line('1,27', 320, 170),
      line('TOTAL', 10, 200),
      line('14,00', 320, 200),
      line('EFECTIVO', 10, 230),
      line('20,00', 320, 230),
      line('CAMBIO', 10, 260),
      line('6,00', 320, 260),
    ]);

    expect(items.map((i) => i.name)).toEqual(['PULPO']);
  });

  it('descarta las cabeceras de columna', () => {
    const { items } = parseReceipt([
      line('CANT DESCRIPCION PRECIO IMPORTE', 10, 100),
      line('PAELLA', 10, 140),
      line('22,00', 320, 140),
    ]);
    expect(items.map((i) => i.name)).toEqual(['PAELLA']);
  });

  it('prefiere TOTAL frente a SUBTOTAL', () => {
    const { detectedTotal } = parseReceipt([
      line('AGUA', 10, 100),
      line('2,00', 320, 100),
      line('SUBTOTAL', 10, 140),
      line('1,82', 320, 140),
      line('TOTAL', 10, 170),
      line('2,00', 320, 170),
    ]);
    expect(detectedTotal).toBe(2);
  });

  it('deduce el precio unitario cuando solo aparece el total de linea', () => {
    const { items } = parseReceipt([line('4 CROQUETAS', 10, 100), line('10,00', 320, 100)]);
    expect(items[0]).toMatchObject({ quantity: 4, unitPrice: 2.5, totalPrice: 10 });
  });

  it('reconoce el formato "2 x NOMBRE"', () => {
    const { items } = parseReceipt([line('2 x TARTA', 10, 100), line('9,00', 320, 100)]);
    expect(items[0]).toMatchObject({ name: 'TARTA', quantity: 2, unitPrice: 4.5 });
  });

  it('trata un numero largo como codigo de articulo y no como cantidad', () => {
    const { items } = parseReceipt([line('100 SOPA', 10, 100), line('6,00', 320, 100)]);
    expect(items[0]).toMatchObject({ name: 'SOPA', quantity: 1, unitPrice: 6 });
  });

  it('ignora la penultima columna cuando no cuadra con la cantidad', () => {
    // Aqui "10" es un porcentaje de IVA colado en la fila, no un precio
    // unitario: 2 x 10,00 no da 7,00, asi que hay que deducirlo del total.
    const { items } = parseReceipt([
      line('2 VINO', 10, 100),
      line('10,00', 240, 100),
      line('7,00', 320, 100),
    ]);
    expect(items[0]).toMatchObject({ quantity: 2, unitPrice: 3.5, totalPrice: 7 });
  });

  it('descarta lineas sin nombre legible', () => {
    const { items } = parseReceipt([line('8412345678905', 10, 100), line('3,00', 320, 100)]);
    expect(items).toHaveLength(0);
  });

  it('avisa cuando no reconoce ningun articulo', () => {
    const { items, warnings } = parseReceipt([line('GRACIAS POR SU VISITA', 10, 100)]);
    expect(items).toHaveLength(0);
    expect(warnings).toContainEqual({ kind: 'no-items' });
  });

  it('propaga la confianza del OCR para poder resaltar lineas dudosas', () => {
    const { items } = parseReceipt([line('MERLUZA', 10, 100, 0.4), line('15,00', 320, 100, 0.6)]);
    expect(items[0]!.confidence).toBeCloseTo(0.5, 5);
  });

  it('no revienta con una imagen sin texto', () => {
    expect(parseReceipt([])).toMatchObject({ items: [], detectedTotal: null });
  });
});
