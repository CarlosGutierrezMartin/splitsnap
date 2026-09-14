/**
 * Lectura de importes en tickets europeos.
 *
 * Un ticket espanol escribe "1.234,56" y uno anglosajon "1,234.56". El mismo
 * ticket puede mezclar ambos si el TPV esta mal configurado, asi que no nos
 * fiamos de la configuracion regional: deducimos el separador decimal de cada
 * numero por su forma.
 */

/**
 * Un importe son digitos con exactamente dos decimales, opcionalmente con
 * separador de millares.
 *
 * Exigir los dos decimales es deliberado: es lo que distingue un precio
 * ("2,50") de una cantidad ("2") en una linea como "2 CERVEZA 2,50 5,00".
 * Sin esa regla el parser confunde cantidades con precios constantemente.
 */
export const MONEY_PATTERN = /-?\d{1,3}(?:[.,\s]\d{3})*[.,]\d{2}(?!\d)|-?\d+[.,]\d{2}(?!\d)/g;

export interface MoneyMatch {
  value: number;
  /** Posicion en la cadena original, necesaria para separar nombre de precio. */
  index: number;
  raw: string;
}

/**
 * Convierte el texto de un importe a numero.
 * Devuelve null si no es interpretable.
 */
export function parseMoney(raw: string): number | null {
  const cleaned = raw.replace(/[\s€]|EUR(?:OS)?/gi, '');
  if (!cleaned) return null;

  const negative = cleaned.startsWith('-');
  const digits = negative ? cleaned.slice(1) : cleaned;

  // El ultimo separador es el decimal; todo lo anterior son millares. Esta
  // regla sola resuelve "1.234,56", "1,234.56" y "12,50" sin ambiguedad.
  const lastSeparator = Math.max(digits.lastIndexOf(','), digits.lastIndexOf('.'));
  if (lastSeparator === -1) {
    const whole = Number(digits);
    return Number.isFinite(whole) ? (negative ? -whole : whole) : null;
  }

  const integerPart = digits.slice(0, lastSeparator).replace(/[.,\s]/g, '');
  const decimalPart = digits.slice(lastSeparator + 1);

  const value = Number(`${integerPart || '0'}.${decimalPart}`);
  if (!Number.isFinite(value)) return null;
  return negative ? -value : value;
}

/** Encuentra todos los importes de una linea, en orden de aparicion. */
export function findMoney(text: string): MoneyMatch[] {
  const matches: MoneyMatch[] = [];
  for (const match of text.matchAll(MONEY_PATTERN)) {
    const value = parseMoney(match[0]);
    if (value === null) continue;
    matches.push({ value, index: match.index, raw: match[0] });
  }
  return matches;
}

/** Formatea un importe en euros con convencion espanola. */
export function formatEuros(value: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
}
