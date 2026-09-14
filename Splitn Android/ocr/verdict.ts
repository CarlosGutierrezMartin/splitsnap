import type { ParsedItem } from '../types';

/**
 * Veredicto sobre si el ticket se ha leido entero y bien.
 *
 * A proposito NO es un porcentaje. Promediar las confianzas del OCR daria un
 * numero con pinta de precision que no significa nada: que el lector se
 * equivoque en el NOMBRE de un plato no afecta al reparto, y que se salte una
 * linea entera lo rompe. Lo que importa es el dinero.
 *
 * La señal buena la trae el propio ticket. Si la suma de las lineas coincide
 * con el total impreso, es practicamente imposible que falte o sobre un
 * articulo con precio: es una suma de comprobacion de verdad.
 */

export type VerdictLevel =
  /** La suma cuadra con el total impreso. */
  | 'balanced'
  /** No hay total impreso contra el que comprobar. */
  | 'unverified'
  /** La suma no cuadra, o no se ha reconocido casi nada. */
  | 'mismatch';

export interface Verdict {
  level: VerdictLevel;
  /** Suma de las lineas reconocidas. */
  sum: number;
  detectedTotal: number | null;
  /** Diferencia con el total impreso, con signo. Positiva = sobra. */
  difference: number | null;
  /** Cuantas lineas el parser da por dudosas. */
  uncertainItems: number;
}

/** Margen de redondeo: dos decimales tienen medio centimo de holgura. */
const TOLERANCE = 0.02;

/** Por debajo de esto el parser no las tiene todas consigo con una linea. */
const LOW_SCORE = 0.7;

export function buildVerdict(items: ParsedItem[], detectedTotal: number | null): Verdict {
  const sum = Math.round(items.reduce((acc, item) => acc + item.totalPrice, 0) * 100) / 100;
  const uncertainItems = items.filter(
    (item) => item.score !== undefined && item.score < LOW_SCORE,
  ).length;

  if (items.length === 0) {
    return { level: 'mismatch', sum: 0, detectedTotal, difference: null, uncertainItems: 0 };
  }

  if (detectedTotal === null) {
    return { level: 'unverified', sum, detectedTotal: null, difference: null, uncertainItems };
  }

  const difference = Math.round((sum - detectedTotal) * 100) / 100;
  return {
    level: Math.abs(difference) <= TOLERANCE ? 'balanced' : 'mismatch',
    sum,
    detectedTotal,
    difference,
    uncertainItems,
  };
}
