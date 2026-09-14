import type { OcrLine } from './types';
import { findMoney } from './money';

/**
 * Analisis de maquetacion del ticket.
 *
 * Un ticket no es texto suelto: es una tabla. Los precios van alineados a la
 * derecha en una columna, y los articulos viven en una franja entre la
 * cabecera del local y el pie con los totales.
 *
 * Aprovechar esa estructura es mucho mas robusto que buscar palabras clave:
 * no depende del idioma, ni del vocabulario del local, ni de como escriban
 * "TOTAL". Una lista negra falla con el primer ticket que dice "SUMA" o que
 * vende un producto llamado "Tarta Total".
 */

/** Un importe localizado en la pagina, con su posicion horizontal. */
export interface MoneyCell {
  value: number;
  /** Borde derecho del importe. Es lo que se alinea en una columna. */
  rightX: number;
  /** Indice de la caja OCR dentro de la fila. */
  lineIndex: number;
  /** Posicion del importe dentro del texto de esa caja. */
  charIndex: number;
  raw: string;
}

export interface Column {
  center: number;
  tolerance: number;
  /** Cuantas filas tienen un importe en esta columna. */
  support: number;
}

export interface Layout {
  /** Columna del importe de linea (la de mas a la derecha con soporte). */
  priceColumn: Column | null;
  /** Fila donde empieza el pie del ticket; -1 si no se ha encontrado. */
  footerStart: number;
  /** Primera fila con pinta de articulo; 0 si no se puede acotar. */
  itemsStart: number;
  /** Altura tipica de linea, util para tolerancias. */
  medianHeight: number;
}

/** Normaliza para comparar: sin acentos, mayusculas, espacios colapsados. */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Localiza los importes de una fila con su posicion horizontal.
 *
 * Cuando el importe ocupa su propia caja (lo habitual, porque el hueco de la
 * columna separa nombre y precio) el borde derecho es exacto. Si nombre y
 * precio comparten caja, se estima por la proporcion de caracteres: menos
 * preciso, pero suficiente para agrupar en columnas.
 */
export function moneyCellsOf(row: OcrLine[]): MoneyCell[] {
  const cells: MoneyCell[] = [];

  row.forEach((line, lineIndex) => {
    const text = line.text;
    if (text.length === 0) return;

    for (const match of findMoney(text)) {
      const endRatio = (match.index + match.raw.length) / text.length;
      cells.push({
        value: match.value,
        rightX: line.box.x + line.box.width * Math.min(1, endRatio),
        lineIndex,
        charIndex: match.index,
        raw: match.raw,
      });
    }
  });

  return cells;
}

/**
 * Agrupa valores en una dimension: los ordena y corta donde hay un hueco
 * mayor que la tolerancia.
 */
function cluster(values: number[], tolerance: number): number[][] {
  if (values.length === 0) return [];
  const sorted = [...values].sort((a, b) => a - b);

  const groups: number[][] = [];
  let current: number[] = [sorted[0]!];

  for (let i = 1; i < sorted.length; i++) {
    const value = sorted[i]!;
    if (value - current[current.length - 1]! <= tolerance) current.push(value);
    else { groups.push(current); current = [value]; }
  }
  groups.push(current);
  return groups;
}

function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Encuentra la columna donde se alinean los importes de linea.
 *
 * Se queda con el grupo mas a la derecha que tenga soporte suficiente: en un
 * ticket con columnas de precio unitario e importe, la de la derecha es
 * siempre el importe de la linea.
 */
export function findPriceColumn(rows: OcrLine[][], medianHeight: number): Column | null {
  // La tolerancia se ata a la altura de linea porque escala con la resolucion
  // de la foto: en una imagen grande, todo esta mas separado.
  const tolerance = Math.max(12, medianHeight * 1.5);

  const rightEdges: number[] = [];
  for (const row of rows) {
    const cells = moneyCellsOf(row);
    if (cells.length === 0) continue;
    // Solo el importe mas a la derecha de cada fila: los de en medio son
    // precios unitarios o porcentajes y ensuciarian la columna.
    rightEdges.push(Math.max(...cells.map((c) => c.rightX)));
  }

  if (rightEdges.length < 2) return null;

  const groups = cluster(rightEdges, tolerance);
  // Un grupo con una sola fila no es una columna, es una coincidencia.
  const candidates = groups.filter((g) => g.length >= 2);
  if (candidates.length === 0) return null;

  const best = candidates.reduce((a, b) => {
    // Gana el soporte; a igualdad, el que este mas a la derecha.
    if (b.length !== a.length) return b.length > a.length ? b : a;
    return mean(b) > mean(a) ? b : a;
  });

  return { center: mean(best), tolerance, support: best.length };
}

/** Palabras que marcan el pie del ticket. Solo se usan para acotar la zona. */
const FOOTER_MARKERS = [
  'TOTAL', 'IMPORTE A PAGAR', 'A PAGAR', 'EFECTIVO', 'TARJETA', 'CAMBIO',
  'ENTREGADO', 'IVA', 'I.V.A', 'BASE IMPONIBLE', 'SUMA', 'TAX', 'VAT',
  'CASH', 'CARD', 'CHANGE', 'SUBTOTAL',
];

/**
 * Encuentra donde acaba la lista de articulos.
 *
 * Se busca el marcador de pie mas alto que ademas lleve importe: un "Gracias
 * por su visita" al final no sirve para acotar, y la palabra "TOTAL" dentro
 * del nombre de un producto tampoco, porque ese producto no lleva el importe
 * en la posicion del pie.
 */
export function findFooterStart(rows: OcrLine[][], column: Column | null): number {
  for (let i = 0; i < rows.length; i++) {
    const text = normalize(rows[i]!.map((l) => l.text).join(' '));
    if (!FOOTER_MARKERS.some((marker) => text.includes(marker))) continue;

    // Exigir importe en la columna es lo que distingue el pie de verdad de un
    // local llamado "Total Market S.L.": el nombre del local no lleva precio
    // alineado en la columna de importes.
    const hasPrice = column ? rowPriceIn(rows[i]!, column) !== null : moneyCellsOf(rows[i]!).length > 0;
    if (hasPrice) return i;
  }
  return -1;
}

/** Calcula toda la maquetacion de una vez. */
export function analyzeLayout(rows: OcrLine[][]): Layout {
  const heights = rows.flat().map((l) => l.box.height).sort((a, b) => a - b);
  const medianHeight = heights[Math.floor(heights.length / 2)] ?? 10;

  // Dos pasadas: la columna se estima primero con todo el ticket para poder
  // localizar el pie, y se recalcula despues solo con el cuerpo, donde las
  // lineas de articulo mandan sobre las de totales.
  const roughColumn = findPriceColumn(rows, medianHeight);
  const footerStart = findFooterStart(rows, roughColumn);
  const body = footerStart >= 0 ? rows.slice(0, footerStart) : rows;
  const priceColumn = findPriceColumn(body, medianHeight) ?? roughColumn;

  // La cabecera termina en la primera fila que ya lleva importe en columna:
  // el nombre del local y su NIF no lo llevan.
  let itemsStart = 0;
  if (priceColumn) {
    for (let i = 0; i < body.length; i++) {
      if (rowPriceIn(body[i]!, priceColumn) !== null) { itemsStart = i; break; }
    }
  }

  return { priceColumn, footerStart, itemsStart, medianHeight };
}

/**
 * Devuelve el importe de la fila que cae dentro de la columna de precios,
 * o null si la fila no tiene ninguno ahi.
 */
export function rowPriceIn(row: OcrLine[], column: Column): MoneyCell | null {
  const cells = moneyCellsOf(row);
  const inColumn = cells.filter((c) => Math.abs(c.rightX - column.center) <= column.tolerance);
  if (inColumn.length === 0) return null;
  // Si hay varios, el de mas a la derecha es el importe de la linea.
  return inColumn.reduce((a, b) => (b.rightX > a.rightX ? b : a));
}
