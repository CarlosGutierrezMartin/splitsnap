/**
 * Deteccion de cierres inesperados durante el escaneo.
 *
 * Si el navegador mata la pestaña (tipicamente por memoria: el motor de OCR
 * ocupa decenas de MB), la app se recarga sola y aparece en el inicio como si
 * no hubiera pasado nada. Desde dentro de la pagina no hay forma de capturar
 * ese evento: no se dispara ningun error, ni 'unload', ni nada.
 *
 * El truco es dejar una marca antes de escanear y borrarla al terminar. Si al
 * arrancar la marca sigue ahi, el intento anterior murio a mitad.
 *
 * La marca guarda ademas la FASE en la que iba, porque saber si murio
 * decodificando la foto, infiriendo, o pintando el resultado es la diferencia
 * entre arreglar el problema y seguir adivinando.
 */

const KEY = 'splitn:scan-progress';

/** Mas vieja que esto, la marca se considera basura de otra sesion. */
const MAX_AGE_MS = 10 * 60 * 1000;

/** Fases del escaneo, en orden. */
export type ScanPhase =
  /** Cargando el motor y los modelos (decenas de MB). */
  | 'engine'
  /** Decodificando y normalizando la foto. Pico de memoria de imagen. */
  | 'preprocess'
  /** Inferencia. Pico de memoria de WASM. */
  | 'inference'
  /** Interpretando las lineas leidas. Solo CPU, sin memoria relevante. */
  | 'parse'
  /** Pintando la pantalla de revision. */
  | 'render';

export interface InterruptedScan {
  phase: ScanPhase;
  /** Pixeles de la foto original, si se llegaron a conocer. */
  pixels?: number;
}

interface Mark extends InterruptedScan {
  at: number;
}

let current: Mark | null = null;

function persist(): void {
  try {
    if (current) localStorage.setItem(KEY, JSON.stringify(current));
    else localStorage.removeItem(KEY);
  } catch {
    // Sin almacenamiento no hay deteccion. No es critico.
  }
}

/** Marca el inicio del escaneo. Sustituye cualquier marca anterior. */
export function markScanStarted(): void {
  current = { phase: 'engine', at: Date.now() };
  persist();
}

/** Avanza la fase. Se llama justo antes de entrar en cada una. */
export function markScanPhase(phase: ScanPhase): void {
  if (!current) current = { phase, at: Date.now() };
  else current = { ...current, phase };
  persist();
}

/** Anota el tamaño de la foto, que es el factor que dispara la memoria. */
export function markScanImageSize(pixels: number): void {
  if (!current) return;
  current = { ...current, pixels };
  persist();
}

/** El escaneo termino (bien o con error controlado): se borra la marca. */
export function markScanFinished(): void {
  current = null;
  persist();
}

/**
 * Comprueba si el escaneo anterior quedo a medias y en que fase.
 * Consume la marca, asi que el aviso se enseña una sola vez.
 */
export function consumeInterruptedScan(): InterruptedScan | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    localStorage.removeItem(KEY);

    const mark = JSON.parse(raw) as Partial<Mark>;
    if (typeof mark.at !== 'number' || Date.now() - mark.at >= MAX_AGE_MS) return null;
    if (!mark.phase) return null;

    return mark.pixels !== undefined
      ? { phase: mark.phase, pixels: mark.pixels }
      : { phase: mark.phase };
  } catch {
    return null;
  }
}

/** Texto corto de la fase, para poder enseñarselo a la persona. */
export function describePhase(phase: ScanPhase, language: 'es' | 'en'): string {
  const es: Record<ScanPhase, string> = {
    engine: 'cargando el lector',
    preprocess: 'preparando la foto',
    inference: 'leyendo el ticket',
    parse: 'interpretando las líneas',
    render: 'mostrando el resultado',
  };
  const en: Record<ScanPhase, string> = {
    engine: 'loading the reader',
    preprocess: 'preparing the photo',
    inference: 'reading the receipt',
    parse: 'interpreting the lines',
    render: 'showing the result',
  };
  return (language === 'en' ? en : es)[phase];
}
