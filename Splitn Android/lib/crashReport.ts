/**
 * Deteccion de cierres inesperados durante el escaneo.
 *
 * Si el navegador mata la pestaña (tipicamente por memoria: el motor de OCR
 * ocupa decenas de MB), la app se recarga sola y aparece en el inicio como si
 * no hubiera pasado nada. Desde dentro no hay forma de capturar ese evento.
 *
 * El truco es dejar una marca antes de escanear y borrarla al terminar. Si al
 * arrancar la marca sigue ahi, el intento anterior murio a mitad, y eso se le
 * puede contar a la persona en vez de dejarla adivinando.
 */

const KEY = 'splitn:scan-in-progress';

/** Mas viejo que esto, la marca se considera basura de otro dia. */
const MAX_AGE_MS = 10 * 60 * 1000;

export function markScanStarted(): void {
  try {
    localStorage.setItem(KEY, String(Date.now()));
  } catch {
    // Sin almacenamiento simplemente no hay deteccion. No es critico.
  }
}

export function markScanFinished(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Ignorable.
  }
}

/**
 * Comprueba si el escaneo anterior quedo a medias. Consume la marca, asi que
 * el aviso se enseña una sola vez.
 */
export function consumeInterruptedScan(): boolean {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return false;
    localStorage.removeItem(KEY);
    return Date.now() - Number(raw) < MAX_AGE_MS;
  } catch {
    return false;
  }
}
