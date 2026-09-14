import type { CropRect } from './imageCrop';

/**
 * Deteccion automatica del papel dentro de la foto.
 *
 * Se hace con aritmetica sobre los pixeles y no con OpenCV, que viene dentro
 * del paquete del motor de OCR: tirar de el aqui obligaria a descargar 10 MB
 * antes de poder recortar, que es justo lo contrario de lo que se busca.
 *
 * El metodo aprovecha que un ticket es una mancha clara y compacta sobre un
 * fondo mas oscuro (mesa, mantel, bandeja). No resuelve perspectiva, pero no
 * hace falta: el resultado es una PROPUESTA que la persona ajusta, y para eso
 * un rectangulo bien puesto vale tanto como un cuadrilatero perfecto.
 */

/** Margen que se deja alrededor del papel detectado, en fraccion del lado. */
const PADDING = 0.015;

/**
 * Extension minima para considerar que una fila o columna es papel, RELATIVA
 * al maximo del perfil.
 *
 * Con un umbral absoluto (pongamos, medio ancho de imagen) un ticket
 * estrecho -que es lo normal- no se detectaria nunca: sus filas solo cubren
 * un 30-40% del ancho. Relativo al maximo, el metodo funciona igual con un
 * ticket que llena la foto que con uno pequeño en una esquina.
 */
const COVERAGE_RATIO = 0.5;

/** Por debajo de esta area la deteccion se considera un error. */
const MIN_AREA = 0.08;

/** Por encima de esta area no aporta nada: seria recortar casi nada. */
const MAX_AREA = 0.97;

/**
 * Umbral de Otsu: separa la imagen en claro y oscuro buscando el corte que
 * mas separa ambos grupos. Se usa este y no un valor fijo porque la luz de
 * una foto de bar cambia muchisimo de una a otra.
 */
export function otsuThreshold(gray: Uint8Array): number {
  const histogram = new Uint32Array(256);
  for (const value of gray) histogram[value]!++;

  const total = gray.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * histogram[i]!;

  let sumBackground = 0;
  let weightBackground = 0;
  let best = 0;
  let bestVariance = -1;

  for (let t = 0; t < 256; t++) {
    weightBackground += histogram[t]!;
    if (weightBackground === 0) continue;

    const weightForeground = total - weightBackground;
    if (weightForeground === 0) break;

    sumBackground += t * histogram[t]!;
    const meanBackground = sumBackground / weightBackground;
    const meanForeground = (sum - sumBackground) / weightForeground;

    const variance =
      weightBackground * weightForeground * (meanBackground - meanForeground) ** 2;
    if (variance > bestVariance) {
      bestVariance = variance;
      best = t;
    }
  }

  return best;
}

/**
 * Tramo contiguo mas largo del perfil que supera la cobertura minima.
 *
 * Se busca el tramo mas largo y no simplemente el primero y el ultimo pixel
 * claro: un reflejo suelto en la mesa desplazaria los extremos y el recorte
 * saldria enorme.
 */
export function longestSpan(profile: Float32Array, minCoverage: number): [number, number] | null {
  let bestStart = -1;
  let bestLength = 0;
  let start = -1;

  for (let i = 0; i <= profile.length; i++) {
    const inside = i < profile.length && profile[i]! >= minCoverage;
    if (inside) {
      if (start === -1) start = i;
    } else if (start !== -1) {
      const length = i - start;
      if (length > bestLength) { bestLength = length; bestStart = start; }
      start = -1;
    }
  }

  return bestLength > 0 ? [bestStart, bestStart + bestLength] : null;
}

/**
 * Propone el recorte del papel a partir de una imagen en escala de grises.
 *
 * Devuelve null cuando no hay una deteccion en la que confiar, que es mejor
 * que proponer un recorte malo: un recorte equivocado destroza la lectura y
 * encima parece que la app ha hecho algo inteligente.
 */
export function detectDocumentBounds(
  gray: Uint8Array,
  width: number,
  height: number,
): CropRect | null {
  if (width < 8 || height < 8 || gray.length !== width * height) return null;

  const threshold = otsuThreshold(gray);

  // El perfil mide la EXTENSION del papel en cada fila y columna -de su
  // primer pixel claro al ultimo-, no cuantos pixeles claros tiene.
  //
  // La diferencia es la que hace que el metodo funcione con un ticket de
  // verdad: un ticket esta lleno de lineas de texto oscuras, asi que una fila
  // con texto tiene pocos pixeles claros y un recuento la descartaria. Sus
  // margenes, en cambio, siguen siendo papel, y de margen a margen la
  // extension es la misma que en una fila en blanco.
  const columns = new Float32Array(width);
  const rows = new Float32Array(height);

  for (let y = 0; y < height; y++) {
    let first = -1;
    let last = -1;
    for (let x = 0; x < width; x++) {
      if (gray[y * width + x]! > threshold) {
        if (first === -1) first = x;
        last = x;
      }
    }
    rows[y] = first === -1 ? 0 : (last - first + 1) / width;
  }

  for (let x = 0; x < width; x++) {
    let first = -1;
    let last = -1;
    for (let y = 0; y < height; y++) {
      if (gray[y * width + x]! > threshold) {
        if (first === -1) first = y;
        last = y;
      }
    }
    columns[x] = first === -1 ? 0 : (last - first + 1) / height;
  }

  const columnPeak = Math.max(...columns);
  const rowPeak = Math.max(...rows);
  if (columnPeak === 0 || rowPeak === 0) return null;

  const horizontal = longestSpan(columns, columnPeak * COVERAGE_RATIO);
  const vertical = longestSpan(rows, rowPeak * COVERAGE_RATIO);
  if (!horizontal || !vertical) return null;

  const crop: CropRect = {
    x: Math.max(0, horizontal[0] / width - PADDING),
    y: Math.max(0, vertical[0] / height - PADDING),
    width: 0,
    height: 0,
  };
  crop.width = Math.min(1 - crop.x, horizontal[1] / width + PADDING - crop.x);
  crop.height = Math.min(1 - crop.y, vertical[1] / height + PADDING - crop.y);

  const area = crop.width * crop.height;
  if (area < MIN_AREA || area > MAX_AREA) return null;

  return crop;
}

/**
 * Reduce la foto a una escala de grises pequeña y detecta el papel.
 *
 * Se trabaja sobre una version diminuta a proposito: la deteccion no gana
 * nada con mas resolucion y una foto de 12 megapixeles en memoria es justo lo
 * que no conviene con el motor de OCR al lado.
 */
export async function detectDocumentInImage(source: Blob): Promise<CropRect | null> {
  const ANALYSIS_SIDE = 240;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(source, { imageOrientation: 'from-image' });
  } catch {
    return null;
  }

  try {
    const scale = ANALYSIS_SIDE / Math.max(bitmap.width, bitmap.height);
    const width = Math.max(8, Math.round(bitmap.width * Math.min(1, scale)));
    const height = Math.max(8, Math.round(bitmap.height * Math.min(1, scale)));

    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    ctx.drawImage(bitmap, 0, 0, width, height);
    const { data } = ctx.getImageData(0, 0, width, height);

    const gray = new Uint8Array(width * height);
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      // Coeficientes de luminancia de Rec. 601.
      gray[p] = (data[i]! * 299 + data[i + 1]! * 587 + data[i + 2]! * 114) / 1000;
    }

    return detectDocumentBounds(gray, width, height);
  } catch {
    return null;
  } finally {
    bitmap.close();
  }
}
