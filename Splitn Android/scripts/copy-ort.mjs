#!/usr/bin/env node
/**
 * Copia el runtime WASM de ONNX a public/ort/.
 *
 * Se auto-hospeda en lugar de usar el CDN por lo mismo que los modelos: sin
 * esto el service worker no puede cachearlo y la app no arranca sin conexion.
 *
 * Se copian DOS variantes, y las dos hacen falta:
 *
 *  - `ort-wasm-simd-threaded.*`  el build WASM puro.
 *  - `ort-wasm-simd-threaded.jsep.*`  el build JSEP.
 *
 * ONNX Runtime resuelve el nombre del fichero por su propio build, no por el
 * `backend` que pidamos: la distribucion por defecto es la JSEP y la busca
 * aunque se fuerce `backend: 'wasm'`. Copiar solo la primera rompia el motor
 * con "no available backend found ... Failed to fetch dynamically imported
 * module: ort-wasm-simd-threaded.jsep.mjs".
 *
 * Las variantes asyncify y jspi si se quedan fuera: suman mas de 40 MB y
 * ninguna ruta del SDK las pide.
 */
import { mkdir, copyFile, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'node_modules', 'onnxruntime-web', 'dist');
const DEST = join(ROOT, 'public', 'ort');

const FILES = [
  'ort-wasm-simd-threaded.wasm',
  'ort-wasm-simd-threaded.mjs',
  'ort-wasm-simd-threaded.jsep.wasm',
  'ort-wasm-simd-threaded.jsep.mjs',
];

async function main() {
  try {
    await access(SRC);
  } catch {
    console.warn('copy-ort: falta onnxruntime-web; ejecuta npm install primero.');
    return;
  }

  await mkdir(DEST, { recursive: true });
  for (const file of FILES) {
    await copyFile(join(SRC, file), join(DEST, file));
    console.log(`  copiado  ort/${file}`);
  }
}

main().catch((err) => {
  console.warn(`copy-ort: ${err.message}`);
});
