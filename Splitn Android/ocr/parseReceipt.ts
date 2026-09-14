import type { OcrLine } from './types';

import { analyzeLayout, moneyCellsOf, normalize, rowPriceIn, type Column, type Layout } from './layout';
import { deskew } from './deskew';
import { buildVerdict, type Verdict } from './verdict';
import type { ParsedItem } from '../types';

/**
 * Convierte lineas sueltas de OCR en articulos con cantidad y precio.
 *
 * Esto es lo que antes hacia el LLM. La decision de "esto es un articulo" se
 * apoya en tres cosas, de mas fiable a menos:
 *
 *  1. La maquetacion (ocr/layout.ts): el ticket es una tabla, y los importes
 *     de linea se alinean en una columna dentro de una franja concreta.
 *  2. La aritmetica del propio ticket: las lineas buenas suman el total
 *     impreso.
 *  3. El vocabulario: una lista de palabras de pie e impuestos.
 *
 * El orden importa. La lista de palabras era antes el criterio principal y
 * es el mas fragil de los tres: falla con el primer local que escribe "SUMA"
 * o que vende algo llamado "Tarta Total".
 */

export interface ParseResult {
  items: ParsedItem[];
  detectedTotal: number | null;
  warnings: ParseWarning[];
  /** Diagnostico por fila, para la pantalla de revision y el banco de pruebas. */
  diagnostics: RowDiagnostic[];
  /** Si el ticket se ha leido entero y bien. */
  verdict: Verdict;
  /** Inclinacion corregida, en grados. 0 si el ticket estaba recto. */
  skewDegrees: number;
}

export type ParseWarning =
  | { kind: 'no-items' }
  | { kind: 'total-mismatch'; sum: number; detectedTotal: number }
  | { kind: 'no-total' }
  | { kind: 'no-layout' };

/** Por que se acepto o rechazo una fila. */
export interface RowDiagnostic {
  text: string;
  score: number;
  accepted: boolean;
  reasons: string[];
}

const NON_ITEM_KEYWORDS = [
  'TOTAL', 'SUBTOTAL', 'SUB TOTAL', 'BASE IMPONIBLE', 'IMPONIBLE',
  'IVA', 'I.V.A', 'TAX', 'VAT', 'CUOTA', 'REDONDEO',
  'EFECTIVO', 'CASH', 'CAMBIO', 'CHANGE', 'TARJETA', 'CARD', 'VISA',
  'MASTERCARD', 'CONTACTLESS', 'ENTREGADO', 'A DEVOLVER', 'DEVOLUCION',
  'PAGADO', 'FORMA DE PAGO',
  'PROPINA', 'TIP', 'SERVICIO',
  'DESCUENTO', 'PROMOCION', 'CUPON',
  'DESCRIPCION', 'CONCEPTO', 'CANTIDAD', 'PRECIO', 'IMPORTE', 'UNIDADES',
  'P.V.P', 'PVP',
  'FACTURA', 'TICKET', 'SIMPLIFICADA', 'NIF', 'CIF', 'TELEFONO',
  'FECHA', 'CAMARERO', 'CAJERO', 'TURNO', 'CLIENTE',
  'GRACIAS', 'THANK', 'VISITA', 'VUELVA', 'RESUMEN', 'COPIA',
  'DIRECCION', 'AVENIDA', 'WWW', 'HTTP',
];

/**
 * Cantidad al principio de la linea: "2", "2x", "2 x", "2 ud", "2uds".
 *
 * El espacio final es opcional a proposito: el OCR se come con frecuencia el
 * hueco estrecho entre la columna de unidades y el nombre, y devuelve
 * "3COCA COLA" de una pieza. Que se pegue no puede costar la cantidad.
 */
const QUANTITY_PATTERN = /^(\d{1,3})(\s*)(?:[xX*]|UDS?|UNIDS?)?[\s.)-]*/;

/** Tolerancia al comprobar si importe/precio da un entero, en centimos. */
const RATIO_TOLERANCE_CENTS = 2;

/**
 * Deduce la cantidad dividiendo el importe de linea entre el precio unitario.
 *
 * Los tickets de restaurante espanoles llevan columnas PRECIO e IMPORTE, y
 * eso es una comprobacion gratis: si 11,25 / 3,75 da 3 exacto, hay 3
 * unidades. Funciona aunque el OCR lea mal el digito de la cantidad o lo
 * pegue al nombre, que es justo lo que falla con "3COCA COLA".
 */
function quantityFromArithmetic(unitPrice: number, lineTotal: number): number | null {
  const unitCents = Math.round(unitPrice * 100);
  const totalCents = Math.round(lineTotal * 100);
  if (unitCents <= 0 || totalCents < unitCents) return null;

  const ratio = totalCents / unitCents;
  const rounded = Math.round(ratio);
  if (rounded < 1 || rounded > 99) return null;

  // Se compara en centimos para no arrastrar el error del coma flotante.
  if (Math.abs(rounded * unitCents - totalCents) > RATIO_TOLERANCE_CENTS) return null;
  return rounded;
}

/** Umbral de aceptacion de la puntuacion combinada. */
const ACCEPT_THRESHOLD = 0.5;

/** Por debajo de esto la fila se acepta pero se marca como dudosa. */
const UNCERTAIN_THRESHOLD = 0.7;

function rowText(row: OcrLine[]): string {
  return row.map((line) => line.text).join(' ').replace(/\s+/g, ' ').trim();
}

function rowScore(row: OcrLine[]): number {
  if (row.length === 0) return 0;
  return row.reduce((sum, line) => sum + line.score, 0) / row.length;
}

/**
 * Agrupa las cajas del OCR en filas visuales.
 *
 * El detector devuelve el nombre del producto y su precio como cajas
 * distintas porque los separa el hueco de la columna. Reconstruir la fila es
 * imprescindible: sin esto cada precio queda huerfano de su articulo.
 */
export function groupIntoRows(lines: OcrLine[]): OcrLine[][] {
  if (lines.length === 0) return [];

  const heights = lines.map((l) => l.box.height).sort((a, b) => a - b);
  const medianHeight = heights[Math.floor(heights.length / 2)] ?? 10;
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

  return rows.map((row) => row.sort((a, b) => a.box.x - b.box.x));
}

/** Busca el total impreso, preferiendo TOTAL a secas sobre SUBTOTAL o TOTAL IVA. */
function findTotal(rows: OcrLine[][], column: Column | null): number | null {
  let best: number | null = null;
  let bestRank = -1;

  for (const row of rows) {
    const text = normalize(rowText(row));
    if (!text.includes('TOTAL')) continue;

    const cell = column ? rowPriceIn(row, column) : null;
    const cells = moneyCellsOf(row);
    const value = cell?.value ?? (cells.length > 0 ? cells[cells.length - 1]!.value : null);
    if (value === null || value <= 0) continue;

    let rank = 1;
    if (/\bSUB\s?TOTAL\b/.test(text)) rank = 0;
    else if (text.includes('IVA')) rank = 0;
    else if (/\bTOTAL\b/.test(text)) rank = 3;

    if (rank > bestRank) { bestRank = rank; best = value; }
  }

  return best;
}

/**
 * Quita del nombre el numero de la columna de unidades.
 *
 * Solo se recorta cuando es seguro: o bien venia separado por un espacio, o
 * bien coincide con una cantidad mayor que uno ya deducida. Sin esa cautela,
 * un producto como "7UP" o "1906" perderia parte de su nombre.
 */
function stripLeadingQuantity(
  label: string,
  match: RegExpExecArray | null,
  quantity: number,
): string {
  if (!match) return label;

  const hadSpace = (match[2] ?? '').length > 0;
  const matchesQuantity = Number(match[1]) === quantity && quantity > 1;
  // Un numero de tres cifras pegado no es una cantidad, es una referencia,
  // y tampoco forma parte del nombre.
  const looksLikeCode = (match[1] ?? '').length === 3;

  if (hadSpace || matchesQuantity || looksLikeCode) return label.slice(match[0].length);
  return label;
}

function cleanName(raw: string): string {
  return raw
    .replace(/[.…]{2,}/g, ' ')
    .replace(/^[\s|:/*-]+|[\s|:/*-]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

interface Candidate {
  item: ParsedItem;
  score: number;
  reasons: string[];
}

/**
 * Evalua una fila como posible articulo.
 *
 * Devuelve una puntuacion en vez de un si/no: las señales se suman y una sola
 * no decide. Asi una linea con buena pinta de producto pero el precio fuera
 * de columna sigue teniendo opciones, y una con precio en columna pero nombre
 * ilegible no entra solo por eso.
 */
function evaluateRow(
  row: OcrLine[],
  index: number,
  layout: Layout,
  inItemZone: boolean,
): { candidate: Candidate | null; diagnostic: RowDiagnostic } {
  const text = rowText(row);
  const reasons: string[] = [];
  const reject = (reason: string): { candidate: null; diagnostic: RowDiagnostic } => {
    reasons.push(reason);
    return { candidate: null, diagnostic: { text, score: 0, accepted: false, reasons } };
  };

  if (!text) return reject('fila vacia');

  const normalized = normalize(text);
  const keyword = NON_ITEM_KEYWORDS.find((k) => normalized.includes(k));
  if (keyword) return reject(`palabra de pie: ${keyword}`);

  const allMoney = moneyCellsOf(row);
  if (allMoney.length === 0) return reject('sin importe');

  const columnCell = layout.priceColumn ? rowPriceIn(row, layout.priceColumn) : null;
  // Sin columna detectada (tickets muy cortos) se cae al ultimo importe de la
  // fila, que es la heuristica de toda la vida.
  const priceCell = columnCell ?? allMoney[allMoney.length - 1]!;

  let score = 0;
  if (columnCell) { score += 0.45; reasons.push('precio en la columna'); }
  else { score += 0.1; reasons.push('precio fuera de la columna'); }

  if (!inItemZone) {
    // Limite duro, no un matiz de puntuacion: por debajo del total solo hay
    // formas de pago y despedidas. Un "PENDIENTE DE COBRO 293,00" tiene
    // importe en columna y nombre con pinta de texto, asi que por puntuacion
    // entraba como articulo y duplicaba el total del ticket.
    return reject('fuera de la zona de articulos');
  }
  score += 0.15;
  reasons.push('dentro de la zona de articulos');

  // Todo lo anterior al primer importe es la etiqueta: cantidad + nombre.
  const label = text.slice(0, text.indexOf(allMoney[0]!.raw));

  const lineTotal = priceCell.value;
  if (lineTotal <= 0) return reject('importe no positivo');

  // Los importes a la izquierda del de linea son candidatos a precio unitario.
  const before = allMoney.filter((c) => c.rightX < priceCell.rightX);
  const unitCandidate = before.length > 0 ? before[before.length - 1]!.value : null;

  // 1) La aritmetica manda: importe / precio da la cantidad exacta.
  const arithmeticQuantity =
    unitCandidate !== null ? quantityFromArithmetic(unitCandidate, lineTotal) : null;

  // 2) El texto, como respaldo y para contrastar.
  const quantityMatch = QUANTITY_PATTERN.exec(label);
  const textQuantityRaw = quantityMatch ? Number(quantityMatch[1]) : null;
  const textQuantity =
    textQuantityRaw !== null && textQuantityRaw >= 1 && textQuantityRaw <= 99 ? textQuantityRaw : null;

  let quantity = 1;
  let unitPrice: number;

  if (arithmeticQuantity !== null && unitCandidate !== null) {
    quantity = arithmeticQuantity;
    unitPrice = unitCandidate;
    reasons.push(`cantidad ${quantity} deducida del importe`);
    score += 0.2;
    if (textQuantity === arithmeticQuantity) {
      // Texto y aritmetica coinciden: no hay margen de duda en esta linea.
      score += 0.1;
      reasons.push('la cantidad del texto coincide');
    }
  } else if (textQuantity !== null) {
    quantity = textQuantity;
    unitPrice = lineTotal / quantity;
    score += 0.1;
    reasons.push(`cantidad ${quantity} del texto`);
  } else {
    unitPrice = lineTotal;
  }

  const name = cleanName(stripLeadingQuantity(label, quantityMatch, quantity));
  const letters = (name.match(/[A-Za-zÀ-ÿ]/g) ?? []).length;
  if (name.length < 2 || letters === 0) return reject('sin nombre legible');

  // Un nombre de producto es mayoritariamente letras. Una referencia como
  // "8412345678905" o "REF 22/A" no lo es.
  const letterRatio = letters / name.length;
  if (letterRatio >= 0.5) { score += 0.3; reasons.push('nombre con pinta de producto'); }
  else { reasons.push(`nombre poco alfabetico (${Math.round(letterRatio * 100)}%)`); }

  score += rowScore(row) * 0.1;
  const confidence = rowScore(row);

  if (!Number.isFinite(unitPrice) || unitPrice <= 0) return reject('precio unitario invalido');

  const rounded = Math.round(unitPrice * 100) / 100;
  const item: ParsedItem = {
    id: `item-${index}-${Math.round(rounded * 100)}`,
    name,
    quantity,
    unitPrice: rounded,
    totalPrice: Math.round(rounded * quantity * 100) / 100,
    confidence,
    score: Math.round(Math.min(1, score) * 100) / 100,
  };

  const accepted = score >= ACCEPT_THRESHOLD;
  return {
    candidate: accepted ? { item, score, reasons } : null,
    diagnostic: { text, score: Math.round(score * 100) / 100, accepted, reasons },
  };
}

/**
 * Busca el subconjunto de candidatos que suma exactamente el total impreso.
 *
 * El ticket trae su propia comprobacion: si las lineas buenas suman el total,
 * un descuadre significa que sobra o falta alguna. Cuando quitando una o dos
 * lineas dudosas la suma cuadra al centimo, esas lineas sobraban.
 *
 * Se limita a quitar candidatos, nunca a inventarlos, y solo prueba con los
 * de peor puntuacion: eliminar a ciegas podria "cuadrar" el ticket borrando
 * articulos buenos.
 */
function reconcileWithTotal(candidates: Candidate[], total: number): Candidate[] {
  const sum = (list: Candidate[]) =>
    Math.round(list.reduce((acc, c) => acc + c.item.totalPrice, 0) * 100) / 100;

  if (Math.abs(sum(candidates) - total) <= 0.02) return candidates;

  // Solo se consideran sospechosos los de puntuacion mas baja, y como mucho
  // cuatro: mas que eso deja de ser una correccion y pasa a ser adivinar.
  const suspects = [...candidates]
    .sort((a, b) => a.score - b.score)
    .slice(0, 4)
    .filter((c) => c.score < UNCERTAIN_THRESHOLD);

  for (let size = 1; size <= suspects.length; size++) {
    for (const combo of combinations(suspects, size)) {
      const kept = candidates.filter((c) => !combo.includes(c));
      if (kept.length > 0 && Math.abs(sum(kept) - total) <= 0.02) return kept;
    }
  }

  return candidates;
}

function* combinations<T>(items: T[], size: number): Generator<T[]> {
  if (size === 0) { yield []; return; }
  for (let i = 0; i <= items.length - size; i++) {
    for (const rest of combinations(items.slice(i + 1), size - 1)) {
      yield [items[i]!, ...rest];
    }
  }
}

/** Punto de entrada: lineas de OCR -> articulos del ticket. */
export function parseReceipt(lines: OcrLine[]): ParseResult {
  // Enderezar antes de agrupar no es opcional: `groupIntoRows` reparte por
  // coordenada Y, asi que en un ticket torcido el nombre y su precio caen en
  // filas distintas y la linea se pierde sin que salte ningun error.
  const { lines: straight, angle } = deskew(lines);
  const rows = groupIntoRows(straight);
  const layout = analyzeLayout(rows);
  const detectedTotal = findTotal(rows, layout.priceColumn);

  const lastRow = layout.footerStart >= 0 ? layout.footerStart : rows.length;

  const candidates: Candidate[] = [];
  const diagnostics: RowDiagnostic[] = [];

  rows.forEach((row, index) => {
    const inItemZone = index >= layout.itemsStart && index < lastRow;
    const { candidate, diagnostic } = evaluateRow(row, index, layout, inItemZone);
    diagnostics.push(diagnostic);
    if (candidate) candidates.push(candidate);
  });

  const reconciled = detectedTotal !== null ? reconcileWithTotal(candidates, detectedTotal) : candidates;
  const items = reconciled.map((c) => c.item);

  const warnings: ParseWarning[] = [];
  if (items.length === 0) warnings.push({ kind: 'no-items' });
  if (!layout.priceColumn && items.length > 0) warnings.push({ kind: 'no-layout' });

  const sum = Math.round(items.reduce((acc, item) => acc + item.totalPrice, 0) * 100) / 100;

  if (detectedTotal === null) {
    if (items.length > 0) warnings.push({ kind: 'no-total' });
  } else if (Math.abs(sum - detectedTotal) > 0.02) {
    warnings.push({ kind: 'total-mismatch', sum, detectedTotal });
  }

  return {
    items,
    detectedTotal,
    warnings,
    diagnostics,
    verdict: buildVerdict(items, detectedTotal),
    skewDegrees: Math.round(((angle * 180) / Math.PI) * 10) / 10,
  };
}
