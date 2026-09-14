/**
 * Recorte y enderezado de la foto antes de leerla.
 *
 * Las dos operaciones atacan causas reales de mala lectura:
 *
 *  - Recortar multiplica la resolucion efectiva. El detector trabaja a 960 px
 *    de lado; si el ticket ocupa el 40% de una foto con mesa y mantel
 *    alrededor, el 60% de esos pixeles se gasta en madera. Ajustado al
 *    ticket, los 960 px son todos utiles. Ademas desaparecen las cajas
 *    espurias del fondo.
 *  - Rotar endereza filas que de otro modo se parten: `groupIntoRows` agrupa
 *    por coordenada Y, asi que en un ticket torcido el nombre y su precio
 *    caen en filas distintas.
 */

/** Recorte en coordenadas normalizadas (0..1) sobre la imagen ya rotada. */
export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** El recorte que cubre la imagen entera. */
export const FULL_CROP: CropRect = { x: 0, y: 0, width: 1, height: 1 };

/**
 * Lado maximo de la imagen resultante.
 *
 * El preprocesado reduce despues a 1600, asi que pasar de aqui solo gasta
 * memoria. Y la memoria es precisamente lo que tumbaba la pestaña.
 */
const MAX_OUTPUT_SIDE = 2000;

/** Tamaño que ocupa una imagen al rotarla, que crece respecto al original. */
export function rotatedBounds(
  width: number,
  height: number,
  degrees: number,
): { width: number; height: number } {
  const rad = (degrees * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  return {
    width: Math.round(width * cos + height * sin),
    height: Math.round(width * sin + height * cos),
  };
}

/**
 * Pasa el recorte normalizado a pixeles, acotado a la imagen.
 *
 * Se garantiza un minimo de un pixel: un recorte degenerado daria un lienzo
 * de ancho cero y el navegador lanzaria al dibujar.
 */
export function cropToPixels(
  crop: CropRect,
  width: number,
  height: number,
): { x: number; y: number; width: number; height: number } {
  // El origen se deja siempre un pixel antes del borde: si se pegara al
  // limite, el minimo de un pixel de tamaño sacaria el recorte fuera de la
  // imagen y el navegador lanzaria al dibujar.
  const x = Math.min(width - 1, Math.round(Math.max(0, Math.min(1, crop.x)) * width));
  const y = Math.min(height - 1, Math.round(Math.max(0, Math.min(1, crop.y)) * height));
  const maxWidth = width - x;
  const maxHeight = height - y;

  return {
    x,
    y,
    width: Math.max(1, Math.min(maxWidth, Math.round(crop.width * width))),
    height: Math.max(1, Math.min(maxHeight, Math.round(crop.height * height))),
  };
}

/** Escala de salida para no pasarse del lado maximo. */
export function outputScale(width: number, height: number): number {
  const longest = Math.max(width, height);
  return longest > MAX_OUTPUT_SIDE ? MAX_OUTPUT_SIDE / longest : 1;
}

/**
 * Aplica rotacion y recorte a una foto y devuelve la imagen resultante.
 *
 * El orden importa: primero se rota y luego se recorta, que es justo lo que
 * la persona ve en pantalla (la imagen girada con el marco encima).
 */
export async function applyCrop(
  source: Blob,
  crop: CropRect,
  degrees: number,
): Promise<Blob> {
  const bitmap = await createImageBitmap(source, { imageOrientation: 'from-image' });

  try {
    const bounds = rotatedBounds(bitmap.width, bitmap.height, degrees);

    const rotated = new OffscreenCanvas(bounds.width, bounds.height);
    const rotatedCtx = rotated.getContext('2d');
    if (!rotatedCtx) return source;

    rotatedCtx.translate(bounds.width / 2, bounds.height / 2);
    rotatedCtx.rotate((degrees * Math.PI) / 180);
    rotatedCtx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);

    const area = cropToPixels(crop, bounds.width, bounds.height);
    const scale = outputScale(area.width, area.height);
    const outWidth = Math.max(1, Math.round(area.width * scale));
    const outHeight = Math.max(1, Math.round(area.height * scale));

    const output = new OffscreenCanvas(outWidth, outHeight);
    const outputCtx = output.getContext('2d');
    if (!outputCtx) return source;

    outputCtx.drawImage(
      rotated,
      area.x, area.y, area.width, area.height,
      0, 0, outWidth, outHeight,
    );

    // JPEG y no PNG: un PNG de un ticket a 2000 px son varios MB sin ninguna
    // ventaja, porque la foto ya venia comprimida con perdida.
    return await output.convertToBlob({ type: 'image/jpeg', quality: 0.92 });
  } finally {
    bitmap.close();
  }
}
