#!/usr/bin/env node
/**
 * Copia el runtime WASM de ONNX a public/ort/.
 *
 * Se auto-hospeda en lugar de usar el CDN por lo mismo que los modelos: sin
 * esto el service worker no puede cachearlo y la app no arranca sin conexion.
 *
 * Solo se copia la variante SIMD+threaded. Las otras (jsep para WebGPU,
 * asyncify, jspi) suman mas de 60 MB y no las necesitamos: para escanear un
 * ticket una vez, WASM va sobrado y funciona en todos los navegadores.
 */
import { mkdir, copyFile, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'node_modules', 'onnxruntime-web', 'dist');
const DEST = join(ROOT, 'public', 'ort');

const FILES = ['ort-wasm-simd-threaded.wasm', 'ort-wasm-simd-threaded.mjs'];

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
