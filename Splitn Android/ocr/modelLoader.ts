/**
 * Descarga de los modelos con progreso real.
 *
 * El SDK se descarga los modelos por su cuenta y no ofrece ningun callback de
 * progreso, asi que la pantalla de carga solo podia enseñar una rueda girando.
 * Para 44 MB eso es inaceptable: no sabes si vas por el 5% o el 90%, ni si se
 * ha quedado colgado.
 *
 * La solucion es pedirlos nosotros primero, leyendo el flujo de bytes para
 * contar el avance. Los trozos se descartan segun llegan: no acumulamos nada
 * en memoria, que con un motor de OCR al lado es justo lo que no conviene.
 * El service worker cachea la respuesta por el camino, asi que cuando el SDK
 * los pida despues salen de cache.
 *
 * Si algo falla aqui no pasa nada: el SDK los descargara como siempre. Se
 * pierde la barra de progreso, no la funcionalidad.
 */

export interface DownloadProgress {
  /** Bytes recibidos hasta ahora. */
  loaded: number;
  /** Bytes totales, o 0 si el servidor no lo dice. */
  total: number;
}

/** Descarga una URL contando bytes, sin quedarse con el contenido. */
async function measureDownload(
  url: string,
  onChunk: (bytes: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  const options: RequestInit = signal ? { signal } : {};
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const body = response.body;
  if (!body) {
    // Sin flujo legible no hay progreso posible, pero conviene consumir la
    // respuesta igualmente para que quede cacheada.
    await response.arrayBuffer();
    return;
  }

  const reader = body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) onChunk(value.byteLength);
  }
}

/** Pregunta el tamaño sin descargar, para poder dar un porcentaje. */
async function sizeOf(url: string, signal?: AbortSignal): Promise<number> {
  try {
    const options: RequestInit = signal ? { method: 'HEAD', signal } : { method: 'HEAD' };
    const response = await fetch(url, options);
    const length = response.headers.get('content-length');
    return length ? Number(length) : 0;
  } catch {
    return 0;
  }
}

/**
 * Precarga las URLs indicadas informando del progreso.
 *
 * Devuelve true si se completo. Un false solo significa que no se pudo medir:
 * quien llame debe seguir adelante igualmente.
 */
export async function prefetchWithProgress(
  urls: string[],
  onProgress: (progress: DownloadProgress) => void,
  signal?: AbortSignal,
): Promise<boolean> {
  try {
    const sizes = await Promise.all(urls.map((url) => sizeOf(url, signal)));
    const total = sizes.reduce((sum, size) => sum + size, 0);

    let loaded = 0;
    onProgress({ loaded: 0, total });

    for (const url of urls) {
      await measureDownload(url, (bytes) => {
        loaded += bytes;
        // Con total desconocido se informa igual: la vista enseñara los MB
        // descargados en vez de un porcentaje.
        onProgress({ loaded, total });
      }, signal);
    }

    onProgress({ loaded: total || loaded, total });
    return true;
  } catch {
    return false;
  }
}

/** Formatea bytes en MB con un decimal, para enseñarlo tal cual. */
export function formatMegabytes(bytes: number): string {
  return (bytes / 1_048_576).toFixed(1);
}
