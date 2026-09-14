#!/usr/bin/env node
/**
 * Descarga los modelos ONNX de PP-OCRv5 mobile para auto-hospedarlos.
 *
 * Auto-hospedarlos importa por tres razones:
 *  - el service worker puede precachearlos, que es lo que hace que la PWA
 *    funcione sin conexion;
 *  - evita depender en tiempo de ejecucion de un CDN de terceros;
 *  - la latencia desde Europa al host de Baidu es mala.
 *
 * Si la descarga falla (red cortada, politica de egress, CI sin salida) el
 * script NO rompe el build: avisa y sigue. La app detecta que no hay modelos
 * locales leyendo manifest.json y cae al CDN oficial del SDK, que funciona
 * con conexion. Asi un fallo de red degrada la app en vez de tumbarla.
 *
 * Modelos: PaddleOCR PP-OCRv5 mobile (Apache-2.0), host oficial de PaddleX.
 */
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'public', 'models');
const BASE = 'https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0';

const MODELS = [
  { name: 'PP-OCRv5_mobile_det', file: 'PP-OCRv5_mobile_det_onnx_infer.tar' },
  { name: 'PP-OCRv5_mobile_rec', file: 'PP-OCRv5_mobile_rec_onnx_infer.tar' },
];

const TIMEOUT_MS = 120_000;

async function alreadyDownloaded(path) {
  try {
    const info = await stat(path);
    // Un .tar de verdad pesa MB. Un fichero diminuto es un error HTTP guardado
    // por error en un intento anterior, asi que lo tratamos como ausente.
    return info.size > 512 * 1024;
  } catch {
    return false;
  }
}

async function download(model) {
  const dest = join(OUT_DIR, model.file);

  if (await alreadyDownloaded(dest)) {
    console.log(`  ya presente  ${model.file}`);
    return true;
  }

  const url = `${BASE}/${model.file}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length < 512 * 1024) throw new Error(`respuesta demasiado pequena (${bytes.length} B)`);
    await writeFile(dest, bytes);
    console.log(`  descargado   ${model.file} (${(bytes.length / 1024 / 1024).toFixed(1)} MB)`);
    return true;
  } catch (err) {
    console.warn(`  FALLO        ${model.file}: ${err.message}`);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  console.log('Modelos PP-OCRv5 mobile:');

  const results = await Promise.all(MODELS.map(download));
  const complete = results.every(Boolean);

  // El manifest es el contrato con el runtime: solo si dice "local" la app
  // usa los ficheros de public/models/.
  await writeFile(
    join(OUT_DIR, 'manifest.json'),
    JSON.stringify(
      {
        source: complete ? 'local' : 'remote',
        generatedAt: new Date().toISOString(),
        models: MODELS.map((m, i) => ({
          name: m.name,
          file: m.file,
          available: results[i],
        })),
      },
      null,
      2,
    ),
  );

  if (complete) {
    console.log('Listo: los modelos se serviran en local y la PWA funcionara sin conexion.');
  } else {
    console.warn(
      '\nNo se pudieron auto-hospedar los modelos.\n' +
        'La app seguira funcionando descargandolos del CDN oficial de PaddleX,\n' +
        'pero NO podra escanear sin conexion. Vuelve a ejecutar `npm run fetch-models`\n' +
        'cuando tengas salida a paddle-model-ecology.bj.bcebos.com.\n',
    );
  }
}

main().catch((err) => {
  console.warn(`fetch-models: ${err.message} (se continua sin modelos locales)`);
});
