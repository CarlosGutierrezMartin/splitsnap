import type { OcrLine } from './types';

/**
 * Correccion de la inclinacion del ticket.
 *
 * `groupIntoRows` reconstruye cada linea del ticket agrupando cajas por su
 * coordenada Y. Eso da por supuesto que las filas son horizontales, y en una
 * foto hecha a mano casi nunca lo son.
 *
 * Con el ticket torcido, el nombre del plato y su precio -separados por medio
 * ancho de imagen- acaban con Y muy distintas y caen en filas diferentes. El
 * precio queda huerfano y la linea se pierde, sin ningun error visible.
 *
 * Aqui se estima el angulo y se deshace la rotacion sobre las coordenadas.
 * Es solo aritmetica: no se vuelve a tocar la imagen ni a pasar el OCR.
 */

/** Mas alla de esto no es una foto torcida, es otra cosa: no se toca. */
const MAX_ANGLE_RAD = (12 * Math.PI) / 180;

/** Por debajo de esto la correccion no compensa el riesgo de empeorar. */
const MIN_ANGLE_RAD = (0.4 * Math.PI) / 180;

/** Paso de busqueda del angulo. Medio grado basta: por debajo no cambia nada. */
const ANGLE_STEP_RAD = (0.5 * Math.PI) / 180;

/** Centro vertical de una caja tras rotar la nube un angulo dado. */
function rotatedCenterY(box: OcrLine['box'], cx: number, cy: number, sin: number, cos: number): number {
  const px = box.x + box.width / 2 - cx;
  const py = box.centerY - cy;
  return px * sin + py * cos + cy;
}

/**
 * Cuenta cuantas cajas quedan emparejadas en una fila con alguna otra tras
 * rotar un angulo dado.
 *
 * Esta es la medida que de verdad importa: no interesa el angulo "real" del
 * papel, sino el que hace que el nombre y su precio caigan en la misma fila.
 */
function pairedBoxesAt(lines: OcrLine[], angle: number, tolerance: number, cx: number, cy: number): number {
  const sin = Math.sin(-angle);
  const cos = Math.cos(-angle);

  const ys = lines.map((line) => rotatedCenterY(line.box, cx, cy, sin, cos)).sort((a, b) => a - b);

  let paired = 0;
  let groupSize = 1;

  for (let i = 1; i <= ys.length; i++) {
    const continues = i < ys.length && ys[i]! - ys[i - 1]! <= tolerance;
    if (continues) {
      groupSize++;
    } else {
      if (groupSize >= 2) paired += groupSize;
      groupSize = 1;
    }
  }

  return paired;
}

/**
 * Estima el angulo de inclinacion del texto, en radianes.
 *
 * En vez de medir pendientes entre pares -que se contaminan con pares de
 * filas distintas y sesgan la mediana- se prueban angulos en un rango y se
 * elige el que deja mas cajas emparejadas en filas. Optimiza directamente el
 * objetivo, y de paso es inmune a cajas sueltas.
 */
export function estimateSkew(lines: OcrLine[]): number {
  if (lines.length < 4) return 0;

  const heights = lines.map((l) => l.box.height).sort((a, b) => a - b);
  const tolerance = (heights[Math.floor(heights.length / 2)] ?? 10) * 0.65;

  const cx = lines.reduce((sum, l) => sum + l.box.x + l.box.width / 2, 0) / lines.length;
  const cy = lines.reduce((sum, l) => sum + l.box.centerY, 0) / lines.length;

  const baseline = pairedBoxesAt(lines, 0, tolerance, cx, cy);

  let bestScore = baseline;
  let plateau: number[] = [];

  for (let angle = -MAX_ANGLE_RAD; angle <= MAX_ANGLE_RAD; angle += ANGLE_STEP_RAD) {
    if (Math.abs(angle) < MIN_ANGLE_RAD) continue;

    const score = pairedBoxesAt(lines, angle, tolerance, cx, cy);
    if (score > bestScore) { bestScore = score; plateau = [angle]; }
    else if (score === bestScore && bestScore > baseline) plateau.push(angle);
  }

  // La puntuacion se satura: en cuanto la rotacion es suficiente, un rango
  // entero de angulos empareja todas las cajas por igual. Quedarse con el
  // primero del rango infracorrige; el centro es la mejor estimacion.
  if (plateau.length === 0) return 0;

  // Se exige ganar al menos una pareja entera. Una mejora de una sola caja
  // suele ser ruido, y en un ticket muy girado -fuera del rango que podemos
  // arreglar- cualquier angulo aporta algo sin arreglar nada.
  if (bestScore < baseline + 2) return 0;

  return plateau[Math.floor(plateau.length / 2)]!;
}

/**
 * Devuelve las lineas con las coordenadas rotadas para dejar el texto
 * horizontal. Si no hay inclinacion apreciable devuelve el mismo array.
 */
export function deskew(lines: OcrLine[]): { lines: OcrLine[]; angle: number } {
  const angle = estimateSkew(lines);
  if (angle === 0) return { lines, angle: 0 };

  // Se rota alrededor del centro de la nube de cajas para que las
  // coordenadas no se desplacen a territorio negativo.
  const cx = lines.reduce((sum, l) => sum + l.box.x + l.box.width / 2, 0) / lines.length;
  const cy = lines.reduce((sum, l) => sum + l.box.centerY, 0) / lines.length;

  const cos = Math.cos(-angle);
  const sin = Math.sin(-angle);

  const rotated = lines.map((line) => {
    const { box } = line;
    const px = box.x + box.width / 2 - cx;
    const py = box.centerY - cy;

    const centerY = px * sin + py * cos + cy;
    const centerX = px * cos - py * sin + cx;

    return {
      ...line,
      box: {
        ...box,
        x: centerX - box.width / 2,
        y: centerY - box.height / 2,
        centerY,
      },
    };
  });

  return { lines: rotated, angle };
}
