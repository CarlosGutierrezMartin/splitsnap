import type * as PaddleOcrModule from '@paddleocr/paddleocr-js';
import type { OcrLine, OcrOutput, OcrStatus } from './types';
import { preprocessReceipt } from './preprocess';

/**
 * Motor de OCR: PP-OCRv5 mobile (Apache-2.0) sobre ONNX Runtime Web.
 *
 * Corre entero en el dispositivo. No sale ni un byte de la foto del ticket a
 * ningun servidor, que es justo lo que buscabamos al quitar el LLM.
 */

/**
 * `PaddleOCR.create` devuelve la instancia directa o una respaldada por un
 * worker segun las opciones, y ambas no comparten tipo. Nos quedamos con lo
 * que promete el propio SDK en vez de forzar una de las dos.
 */
type OcrEngine = Awaited<ReturnType<typeof PaddleOcrModule.PaddleOCR.create>>;

const DET_MODEL = 'PP-OCRv5_mobile_det';
const REC_MODEL = 'PP-OCRv5_mobile_rec';

type ModelSource = 'local' | 'remote';

interface ModelManifest {
  source: ModelSource;
}

let enginePromise: Promise<OcrEngine> | null = null;
let statusListeners: Array<(status: OcrStatus) => void> = [];
let currentStatus: OcrStatus = { phase: 'idle', source: 'unknown' };

function setStatus(status: OcrStatus): void {
  currentStatus = status;
  for (const listener of statusListeners) listener(status);
}

export function getOcrStatus(): OcrStatus {
  return currentStatus;
}

export function onOcrStatus(listener: (status: OcrStatus) => void): () => void {
  statusListeners.push(listener);
  listener(currentStatus);
  return () => {
    statusListeners = statusListeners.filter((l) => l !== listener);
  };
}

function assetUrl(path: string): string {
  // BASE_URL importa porque en GitHub Pages el sitio cuelga de /<repo>/.
  return `${import.meta.env.BASE_URL}${path}`.replace(/([^:]\/)\/+/g, '$1');
}

/**
 * Decide si usamos los modelos auto-hospedados o el CDN oficial de PaddleX.
 * `scripts/fetch-models.mjs` escribe el manifest; si falto la descarga dice
 * "remote" y dejamos que el SDK tire de su URL por defecto.
 */
async function resolveModelSource(): Promise<ModelSource> {
  try {
    const res = await fetch(assetUrl('models/manifest.json'), { cache: 'no-cache' });
    if (!res.ok) return 'remote';
    const manifest = (await res.json()) as ModelManifest;
    return manifest.source === 'local' ? 'local' : 'remote';
  } catch {
    return 'remote';
  }
}

async function createEngine(): Promise<OcrEngine> {
  const source = await resolveModelSource();
  setStatus({ phase: 'downloading', source });

  // Import dinamico: el SDK con OpenCV y ONNX Runtime pesa mas de 10 MB. Si
  // se importase arriba entraria en el bundle inicial y abrir la app para
  // mirar un ticket antiguo costaria esa descarga. Asi solo se paga al
  // escanear, y a partir de ahi queda en cache.
  const { PaddleOCR } = await import('@paddleocr/paddleocr-js');

  // Con modelos locales pasamos la URL explicita; sin ellos omitimos el asset
  // y el SDK resuelve su host oficial.
  const modelAssets =
    source === 'local'
      ? {
          textDetectionModelAsset: { url: assetUrl(`models/${DET_MODEL}_onnx_infer.tar`) },
          textRecognitionModelAsset: { url: assetUrl(`models/${REC_MODEL}_onnx_infer.tar`) },
        }
      : {};

  const ocr = await PaddleOCR.create({
    textDetectionModelName: DET_MODEL,
    textRecognitionModelName: REC_MODEL,
    // El worker mantiene el hilo principal libre: sin esto la interfaz se
    // congela varios segundos en un movil de gama media.
    worker: true,
    ortOptions: {
      // WASM y no 'auto': WebGPU exigiria servir tambien la variante jsep
      // (27 MB extra) y su soporte en moviles sigue siendo irregular. Para
      // escanear un ticket una sola vez, WASM con SIMD va sobrado.
      backend: 'wasm',
      // Servimos el wasm de ORT desde nuestro propio origen para que el
      // service worker pueda cachearlo y la app arranque sin conexion.
      wasmPaths: assetUrl('ort/'),
      simd: true,
      // Los hilos necesitan SharedArrayBuffer, que solo existe con las
      // cabeceras COOP/COEP. GitHub Pages no las envia, asi que fuera de un
      // contexto aislado pedir varios hilos falla en vez de ir mas rapido.
      numThreads: globalThis.crossOriginIsolated
        ? Math.min(4, navigator.hardwareConcurrency || 2)
        : 1,
    },
    ...modelAssets,
  });

  setStatus({ phase: 'ready', source });
  return ocr;
}

/**
 * Carga el motor. Es idempotente: varias llamadas comparten la misma promesa,
 * asi que se puede precalentar desde la pantalla de inicio sin miedo.
 */
export function loadOcrEngine(): Promise<OcrEngine> {
  if (!enginePromise) {
    enginePromise = createEngine().catch((err) => {
      // Si falla, soltamos la promesa para que un reintento pueda funcionar
      // (caso tipico: se cayo la red a mitad de descarga).
      enginePromise = null;
      setStatus({
        phase: 'error',
        source: currentStatus.source,
        message: err instanceof Error ? err.message : String(err),
      });
      throw err;
    });
  }
  return enginePromise;
}

/** Convierte el poligono de 4 puntos del detector en una caja con centro. */
function toBoundingBox(poly: number[][]): OcrLine['box'] {
  const xs = poly.map((p) => p[0]!);
  const ys = poly.map((p) => p[1]!);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  const width = Math.max(...xs) - x;
  const height = Math.max(...ys) - y;
  return { x, y, width, height, centerY: y + height / 2 };
}

/**
 * Escanea una imagen de ticket y devuelve las lineas de texto detectadas.
 * No interpreta nada: la interpretacion es cosa de `parseReceipt`.
 */
export async function scanReceipt(image: Blob): Promise<OcrOutput> {
  const ocr = await loadOcrEngine();
  const { bitmap } = await preprocessReceipt(image);

  try {
    const [result] = await ocr.predict(bitmap, {
      // Los tickets son estrechos y muy altos; dejamos margen para que el
      // detector no recorte la parte de abajo, donde suele estar el total.
      textDetLimitSideLen: 960,
      textDetLimitType: 'max',
      // Umbral de caja algo bajo: en papel termico descolorido las cajas
      // salen con poca confianza y preferimos recuperarlas y filtrar despues.
      textDetBoxThresh: 0.5,
      textRecScoreThresh: 0.3,
    });

    if (!result) return { lines: [], image: { width: bitmap.width, height: bitmap.height }, elapsedMs: 0 };

    const lines: OcrLine[] = result.items
      .filter((item) => item.text.trim().length > 0)
      .map((item) => ({
        text: item.text.trim(),
        score: item.score,
        box: toBoundingBox(item.poly as unknown as number[][]),
      }));

    return {
      lines,
      image: { width: result.image.width, height: result.image.height },
      elapsedMs: result.metrics.totalMs,
    };
  } finally {
    bitmap.close();
  }
}
