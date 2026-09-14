/**
 * Preprocesado de la foto antes del OCR.
 *
 * Los tickets son el peor caso posible para un OCR: papel termico, contraste
 * bajo, arrugas y sombras. Un pase de normalizacion barato aqui vale mas que
 * cualquier ajuste de parametros del modelo.
 */

/** Lado maximo tras redimensionar. Por encima de esto el detector no gana
 *  precision y el movil se arrastra. */
const MAX_SIDE = 1600;
/** Por debajo de esto el texto pequeno del ticket se pierde. */
const MIN_SIDE = 640;

export interface PreprocessResult {
  bitmap: ImageBitmap;
  /** Escala aplicada, por si hay que mapear cajas a la imagen original. */
  scale: number;
}

/**
 * Normaliza una foto de ticket: corrige la orientacion, la redimensiona a un
 * tamano razonable y aumenta el contraste en escala de grises.
 */
export async function preprocessReceipt(source: Blob): Promise<PreprocessResult> {
  // createImageBitmap aplica la rotacion EXIF, que en fotos de movil casi
  // siempre viene puesta. Sin esto el ticket llega tumbado y el OCR falla.
  const original = await createImageBitmap(source, { imageOrientation: 'from-image' });

  const longest = Math.max(original.width, original.height);
  const shortest = Math.min(original.width, original.height);

  let scale = 1;
  if (longest > MAX_SIDE) scale = MAX_SIDE / longest;
  else if (shortest < MIN_SIDE) scale = Math.min(MIN_SIDE / shortest, MAX_SIDE / longest);

  const width = Math.max(1, Math.round(original.width * scale));
  const height = Math.max(1, Math.round(original.height * scale));

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    // Sin canvas 2D no podemos normalizar, pero el OCR puede tirar con el
    // bitmap crudo. Degradar es mejor que reventar.
    return { bitmap: original, scale: 1 };
  }

  ctx.drawImage(original, 0, 0, width, height);
  original.close();

  const image = ctx.getImageData(0, 0, width, height);
  enhanceContrast(image.data);
  ctx.putImageData(image, 0, 0);

  return { bitmap: canvas.transferToImageBitmap(), scale };
}

/**
 * Escala de grises + estiramiento de contraste por percentiles.
 *
 * Usamos los percentiles 5 y 95 en lugar del minimo y el maximo absolutos
 * porque una sola sombra negra o un reflejo blanco bastarian para anular el
 * estiramiento si nos fiaramos de los extremos.
 */
function enhanceContrast(data: Uint8ClampedArray): void {
  const histogram = new Uint32Array(256);
  const luma = new Uint8ClampedArray(data.length / 4);

  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    // Coeficientes de luminancia de Rec. 601.
    const value = (data[i]! * 299 + data[i + 1]! * 587 + data[i + 2]! * 114) / 1000;
    const rounded = value | 0;
    luma[p] = rounded;
    histogram[rounded]!++;
  }

  const total = luma.length;
  const lowCut = total * 0.05;
  const highCut = total * 0.95;

  let low = 0;
  let high = 255;
  let seen = 0;
  for (let v = 0; v < 256; v++) {
    seen += histogram[v]!;
    if (seen >= lowCut) { low = v; break; }
  }
  seen = 0;
  for (let v = 0; v < 256; v++) {
    seen += histogram[v]!;
    if (seen >= highCut) { high = v; break; }
  }

  // Si la imagen ya es plana (o esta en blanco) el estiramiento dividiria por
  // cero o amplificaria solo ruido. Se deja tal cual.
  const span = high - low;
  if (span < 16) return;

  const scale = 255 / span;
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const stretched = Math.max(0, Math.min(255, (luma[p]! - low) * scale));
    data[i] = stretched;
    data[i + 1] = stretched;
    data[i + 2] = stretched;
  }
}
