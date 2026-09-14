import type { OcrLine } from './types';
import { findMoney } from './money';
import type { ParsedItem } from '../types';

/**
 * Convierte lineas sueltas de OCR en articulos con cantidad y precio.
 *
 * Esto es lo que antes hacia el LLM. Al ser reglas deterministas se puede
 * testear, corre en microsegundos y no cuesta dinero; a cambio hay que
 * asumir que fallara en formatos raros, por eso la pantalla de revision
 * manual forma parte del flujo y no es un extra.
 */

export interface ParseResult {
  items: ParsedItem[];
  /** Total impreso en el ticket, si se ha encontrado. */
  detectedTotal: number | null;
  warnings: ParseWarning[];
}

export type ParseWarning =
  | { kind: 'no-items' }
  | { kind: 'total-mismatch'; sum: number; detectedTotal: number }
  | { kind: 'no-total' };

/**
 * Palabras que marcan una linea como "no es un articulo".
 *
 * Se comparan sin acentos y en mayusculas. Incluye tanto pies de ticket
 * (totales, impuestos, formas de pago) como cabeceras de columna y datos
 * del establecimiento.
 */
const NON_ITEM_KEYWORDS = [
  // Totales e impuestos
  'TOTAL', 'SUBTOTAL', 'SUB TOTAL', 'BASE IMPONIBLE', 'BASE', 'IMPONIBLE',
  'IVA', 'I.V.A', 'TAX', 'VAT', 'CUOTA', 'REDONDEO', 'IMPORTE TOTAL',
  // Pago
  'EFECTIVO', 'CASH', 'CAMBIO', 'CHANGE', 'TARJETA', 'CARD', 'VISA',
  'MASTERCARD', 'CONTACTLESS', 'ENTREGADO', 'A DEVOLVER', 'DEVOLUCION',
  'PAGADO', 'FORMA DE PAGO', 'PAGO',
  // Propina y servicio
  'PROPINA', 'TIP', 'SERVICIO', 'CUBIERTO',
  // Descuentos
  'DESCUENTO', 'DTO', 'PROMOCION', 'CUPON',
  // Cabeceras de columna
  'DESCRIPCION', 'CONCEPTO', 'ARTICULO', 'ARTICULOS', 'CANT', 'CANTIDAD',
  'PRECIO', 'IMPORTE', 'UDS', 'UNIDADES', 'P.V.P', 'PVP', 'SUBT',
  // Datos del establecimiento y del ticket
  'FACTURA', 'TICKET', 'SIMPLIFICADA', 'NIF', 'CIF', 'TEL', 'TELEFONO',
  'FECHA', 'HORA', 'MESA', 'CAMARERO', 'CAJERO', 'CAJA', 'TURNO', 'CLIENTE',
  'ATENDIDO', 'GRACIAS', 'THANK', 'VISITA', 'VUELVA', 'RESUMEN', 'COPIA',
  'DIRECCION', 'CALLE', 'AVDA', 'AVENIDA', 'PLAZA', 'C.P', 'WWW', 'HTTP',
];

/** Cantidad al principio de la linea: "2", "2x", "2 x", "2 ud", "2uds". */
const QUANTITY_PATTERN = /^(\d{1,3})\s*(?:[xX*]|UD|UDS|U|UNID|UNIDS)?\s*[-.)]?\s+/;

/** Normaliza para comparar: sin acentos, en mayusculas, sin espacios dobles. */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function isNonItemLine(text: string): boolean {
  const normalized = normalize(text);
  return NON_ITEM_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

/**
 * Agrupa las cajas del OCR en filas visuales.
 *
 * El detector devuelve el nombre del producto y su precio como cajas
 * distintas porque estan separadas por espacio en blanco. Reconstruir la fila
 * es imprescindible: sin esto cada precio queda huerfano de su articulo.
 */
export function groupIntoRows(lines: OcrLine[]): OcrLine[][] {
  if (lines.length === 0) return [];

  const heights = lines.map((l) => l.box.height).sort((a, b) => a - b);
  const medianHeight = heights[Math.floor(heights.length / 2)] ?? 10;
  // Dos cajas son de la misma fila si sus centros distan menos de ~2/3 de la
  // altura tipica de linea. Mas holgado junta filas contiguas; mas estricto
  // parte filas con el precio ligeramente desalineado.
  const tolerance = medianHeight * 0.65;

  const sorted = [...lines].sort((a, b) => a.box.centerY - b.box.centerY);
  const rows: OcrLine[][] = [];
  let current: OcrLine[] = [];
  let anchorY = Number.NaN;

  for (const line of sorted) {
    if (current.length === 0 || Math.abs(line.box.centerY - anchorY) <= tolerance) {
      if (current.length === 0) anchorY = line.box.centerY;
      current.push(line);
    } else {
      rows.push(current);
      current = [line];
      anchorY = line.box.centerY;
    }
  }
  if (current.length > 0) rows.push(current);

  // Dentro de cada fila, orden de lectura: izquierda a derecha.
  return rows.map((row) => row.sort((a, b) => a.box.x - b.box.x));
}

function rowText(row: OcrLine[]): string {
  return row.map((line) => line.text).join(' ').replace(/\s+/g, ' ').trim();
}

function rowScore(row: OcrLine[]): number {
  if (row.length === 0) return 0;
  return row.reduce((sum, line) => sum + line.score, 0) / row.length;
}

/**
 * Busca el total impreso. Se prefiere la linea que dice exactamente TOTAL
 * frente a SUBTOTAL o TOTAL IVA, que son distintos y suelen convivir.
 */
function findTotal(rows: OcrLine[][]): number | null {
  let best: number | null = null;
  let bestRank = -1;

  for (const row of rows) {
    const text = normalize(rowText(row));
    if (!text.includes('TOTAL')) continue;

    const money = findMoney(rowText(row));
    if (money.length === 0) continue;
    const value = money[money.length - 1]!.value;
    if (value <= 0) continue;

    // Rangos: TOTAL a secas gana a TOTAL A PAGAR, y ambos a SUBTOTAL.
    let rank = 1;
    if (/\bSUB\s?TOTAL\b/.test(text)) rank = 0;
    else if (/\bTOTAL\b/.test(text) && !text.includes('IVA')) rank = 3;
    else if (text.includes('IVA')) rank = 0;

    if (rank > bestRank) {
      bestRank = rank;
      best = value;
    }
  }

  return best;
}

/** Limpia el nombre del articulo de restos de la columna de cantidad. */
function cleanName(raw: string): string {
  return raw
    .replace(/[.…]{2,}/g, ' ')       // rellenos de puntos hasta el precio
    .replace(/^[\s|:/*-]+|[\s|:/*-]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Interpreta una fila como articulo. Devuelve null si no lo es.
 */
function parseRow(row: OcrLine[], index: number): ParsedItem | null {
  const text = rowText(row);
  if (!text) return null;
  if (isNonItemLine(text)) return null;

  const money = findMoney(text);
  if (money.length === 0) return null;

  // Todo lo que hay antes del primer importe es la etiqueta: cantidad + nombre.
  const label = text.slice(0, money[0]!.index);

  let quantity = 1;
  let nameSource = label;
  const quantityMatch = QUANTITY_PATTERN.exec(label);
  if (quantityMatch) {
    // El numero de cabecera sobra en el nombre tanto si son unidades como si
    // es una referencia de articulo, asi que se recorta siempre.
    nameSource = label.slice(quantityMatch[0].length);

    // Pero solo lo tratamos como cantidad si es plausible: una cifra de tres
    // digitos en un ticket de bar es un codigo, no 100 unidades.
    const parsed = Number(quantityMatch[1]);
    if (parsed >= 1 && parsed <= 99) quantity = parsed;
  }

  const name = cleanName(nameSource);
  // Sin nombre legible no hay articulo que repartir: suele ser una linea de
  // codigos o un artefacto del OCR.
  if (name.length < 2 || !/[A-Za-zÀ-ÿ]/.test(name)) return null;

  // Con dos o mas importes el formato es "... precioUnitario total".
  // Se valida el producto antes de fiarse, porque a veces la penultima
  // columna es un descuento o un porcentaje de IVA.
  let unitPrice: number;
  const lineTotal = money[money.length - 1]!.value;

  if (money.length >= 2 && quantity > 1) {
    const candidateUnit = money[money.length - 2]!.value;
    const consistent = Math.abs(candidateUnit * quantity - lineTotal) < 0.02;
    unitPrice = consistent ? candidateUnit : lineTotal / quantity;
  } else {
    unitPrice = quantity > 1 ? lineTotal / quantity : lineTotal;
  }

  if (!Number.isFinite(unitPrice) || unitPrice <= 0) return null;

  return {
    id: `item-${index}-${Math.round(unitPrice * 100)}`,
    name,
    quantity,
    unitPrice: Math.round(unitPrice * 100) / 100,
    totalPrice: Math.round(unitPrice * quantity * 100) / 100,
    confidence: rowScore(row),
  };
}

/**
 * Punto de entrada: lineas de OCR -> articulos del ticket.
 */
export function parseReceipt(lines: OcrLine[]): ParseResult {
  const rows = groupIntoRows(lines);
  const detectedTotal = findTotal(rows);

  const items: ParsedItem[] = [];
  rows.forEach((row, index) => {
    const item = parseRow(row, index);
    if (item) items.push(item);
  });

  const warnings: ParseWarning[] = [];
  if (items.length === 0) {
    warnings.push({ kind: 'no-items' });
  }

  const sum = Math.round(items.reduce((acc, item) => acc + item.totalPrice, 0) * 100) / 100;

  if (detectedTotal === null) {
    if (items.length > 0) warnings.push({ kind: 'no-total' });
  } else if (Math.abs(sum - detectedTotal) > 0.02) {
    // No es un error fatal: puede faltar una linea, sobrar una, o el ticket
    // llevar un servicio aparte. Se avisa para que la persona lo revise.
    warnings.push({ kind: 'total-mismatch', sum, detectedTotal });
  }

  return { items, detectedTotal, warnings };
}
