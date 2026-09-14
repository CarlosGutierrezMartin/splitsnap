/** Una linea de texto reconocida por el OCR, con su caja delimitadora. */
export interface OcrLine {
  text: string;
  /** Confianza del reconocedor, 0..1. */
  score: number;
  /** Caja normalizada a partir del poligono devuelto por el detector. */
  box: BoundingBox;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Centro vertical, precalculado porque el agrupador lo usa en bucle. */
  centerY: number;
}

export interface OcrOutput {
  lines: OcrLine[];
  image: { width: number; height: number };
  /** Milisegundos totales de inferencia, para el panel de diagnostico. */
  elapsedMs: number;
}

/** Progreso de la carga del motor, para poder enseñar algo mientras baja 21 MB. */
export type OcrLoadPhase = 'idle' | 'downloading' | 'initializing' | 'ready' | 'error';

export interface OcrStatus {
  phase: OcrLoadPhase;
  /** De donde salen los modelos: auto-hospedados o CDN oficial. */
  source: 'local' | 'remote' | 'unknown';
  message?: string;
}
