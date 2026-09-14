import { describe, it, expect } from 'vitest';
import { parseReceipt } from '../parseReceipt';
import { analyzeLayout, findPriceColumn, moneyCellsOf } from '../layout';
import { groupIntoRows } from '../parseReceipt';
import type { OcrLine } from '../types';

function line(text: string, x: number, y: number, score = 0.95): OcrLine {
  const height = 20;
  return { text, score, box: { x, y, width: text.length * 10, height, centerY: y + height / 2 } };
}

/** Precio alineado a la derecha: se ancla el BORDE derecho, no el izquierdo. */
function price(text: string, y: number, rightEdge = 360, score = 0.95): OcrLine {
  const width = text.length * 10;
  return { text, score, box: { x: rightEdge - width, y, width, height: 20, centerY: y + 10 } };
}

describe('moneyCellsOf', () => {
  it('sitúa el importe por su borde derecho cuando ocupa su propia caja', () => {
    const cells = moneyCellsOf([price('5,00', 100, 360)]);
    expect(cells[0]!.rightX).toBeCloseTo(360, 1);
  });

  it('estima la posición cuando nombre y precio comparten caja', () => {
    // "CERVEZA 5,00": el importe está al final, así que su borde derecho
    // debe caer cerca del borde derecho de la caja.
    const cells = moneyCellsOf([line('CERVEZA 5,00', 10, 100)]);
    expect(cells[0]!.rightX).toBeCloseTo(10 + 120, 0);
  });
});

describe('findPriceColumn', () => {
  it('encuentra la columna donde se alinean los importes', () => {
    const rows = groupIntoRows([
      line('CERVEZA', 10, 100), price('5,00', 100, 360),
      line('TORTILLA', 10, 130), price('8,50', 130, 360),
      line('CAFE', 10, 160), price('1,20', 160, 360),
    ]);
    const column = findPriceColumn(rows, 20);
    expect(column).not.toBeNull();
    expect(column!.center).toBeCloseTo(360, 0);
    expect(column!.support).toBe(3);
  });

  it('no inventa columna con un solo importe', () => {
    const rows = groupIntoRows([line('CERVEZA', 10, 100), price('5,00', 100, 360)]);
    expect(findPriceColumn(rows, 20)).toBeNull();
  });
});

describe('detección por maquetación', () => {
  it('descarta un número suelto que no está en la columna de precios', () => {
    // El teléfono lleva un patrón que parece importe, pero está a la
    // izquierda, lejos de la columna. Ninguna lista de palabras lo salva:
    // aquí lo descarta la posición.
    const { items } = parseReceipt([
      line('Bar Paco', 10, 0), line('91 123,45', 10, 30),
      line('CERVEZA', 10, 100), price('5,00', 100, 360),
      line('TORTILLA', 10, 130), price('8,50', 130, 360),
      line('PULPO', 10, 160), price('14,00', 160, 360),
      line('TOTAL', 10, 220), price('27,50', 220, 360),
    ]);
    expect(items.map((i) => i.name)).toEqual(['CERVEZA', 'TORTILLA', 'PULPO']);
  });

  it('acota la zona: nada por debajo del total entra como artículo', () => {
    const layout = analyzeLayout(groupIntoRows([
      line('CERVEZA', 10, 100), price('5,00', 100, 360),
      line('TOTAL', 10, 140), price('5,00', 140, 360),
      line('EFECTIVO', 10, 170), price('10,00', 170, 360),
    ]));
    expect(layout.footerStart).toBe(1);
  });

  it('no confunde el nombre del local con el pie del ticket', () => {
    // "Total Market" contiene TOTAL pero no lleva importe en columna, así
    // que no puede marcar el inicio del pie.
    const layout = analyzeLayout(groupIntoRows([
      line('Total Market S.L.', 10, 0),
      line('LECHE', 10, 100), price('1,20', 100, 360),
      line('PAN', 10, 130), price('0,90', 130, 360),
      line('TOTAL', 10, 180), price('2,10', 180, 360),
    ]));
    expect(layout.footerStart).toBe(3);
  });
});

describe('reconciliación con el total impreso', () => {
  it('descarta la línea sobrante cuando al quitarla la suma cuadra', () => {
    // "MESA 12,00" no es un artículo: es ruido con pinta de línea. El total
    // impreso (10,00) sólo cuadra si se descarta, y el parser lo deduce
    // sin necesidad de conocer la palabra "MESA".
    const { items, warnings } = parseReceipt([
      line('CERVEZA', 10, 100), price('4,00', 100, 360),
      line('CAFE', 10, 130), price('6,00', 130, 360),
      line('MESA', 10, 160), price('12,00', 160, 290),
      line('TOTAL', 10, 220), price('10,00', 220, 360),
    ]);
    expect(items.map((i) => i.name)).toEqual(['CERVEZA', 'CAFE']);
    expect(warnings).not.toContainEqual(
      expect.objectContaining({ kind: 'total-mismatch' }),
    );
  });

  it('no borra artículos buenos para forzar que cuadre', () => {
    // Aquí falta una línea que el OCR no leyó: la suma nunca va a cuadrar.
    // Lo correcto es avisar, no ir quitando artículos legítimos.
    const { items, warnings } = parseReceipt([
      line('CERVEZA', 10, 100), price('4,00', 100, 360),
      line('CAFE', 10, 130), price('6,00', 130, 360),
      line('TOTAL', 10, 200), price('25,00', 200, 360),
    ]);
    expect(items).toHaveLength(2);
    expect(warnings).toContainEqual({ kind: 'total-mismatch', sum: 10, detectedTotal: 25 });
  });
});

describe('diagnóstico', () => {
  it('explica por qué se rechazó cada fila', () => {
    const { diagnostics } = parseReceipt([
      line('CERVEZA', 10, 100), price('5,00', 100, 360),
      line('IVA 10%', 10, 140), price('0,45', 140, 360),
      line('TOTAL', 10, 180), price('5,00', 180, 360),
    ]);
    const iva = diagnostics.find((d) => d.text.includes('IVA'));
    expect(iva!.accepted).toBe(false);
    expect(iva!.reasons.join(' ')).toContain('IVA');
  });

  it('puntúa más alto un artículo con precio en columna que uno sin ella', () => {
    const { diagnostics } = parseReceipt([
      line('CERVEZA', 10, 100), price('5,00', 100, 360),
      line('TORTILLA', 10, 130), price('8,50', 130, 360),
      line('RARO', 10, 160), price('2,00', 160, 180),
      line('TOTAL', 10, 220), price('15,50', 220, 360),
    ]);
    const bueno = diagnostics.find((d) => d.text.includes('CERVEZA'))!;
    const raro = diagnostics.find((d) => d.text.includes('RARO'))!;
    expect(bueno.score).toBeGreaterThan(raro.score);
  });
});
