import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * En GitHub Pages el sitio cuelga de /<repo>/, asi que el build de CI pasa
 * BASE_PATH. En local se sirve desde la raiz.
 */
const base = process.env.BASE_PATH ?? '/';

/**
 * Descarta los binarios de ONNX Runtime que Rollup emite por los `new URL()`
 * internos del SDK.
 *
 * Son duplicados: el motor arranca con `wasmPaths` apuntando a /ort/, que
 * `scripts/copy-ort.mjs` rellena desde node_modules. Dejar ademas la copia
 * que emite Rollup en /assets/ duplicaria ~42 MB por despliegue sin que nadie
 * la pida.
 *
 * Se borra la copia de /assets/, NUNCA la de /ort/: esa es la que carga ORT.
 */
function dropUnusedOnnxBinaries() {
  return {
    name: 'splitn:drop-unused-onnx-binaries',
    generateBundle(_options: unknown, bundle: Record<string, unknown>) {
      for (const fileName of Object.keys(bundle)) {
        if (/ort-wasm.*\.wasm$/.test(fileName)) delete bundle[fileName];
      }
    },
  };
}

export default defineConfig({
  base,
  server: {
    port: 3000,
    // 0.0.0.0 para poder abrir la app desde el movil en la misma red wifi,
    // que es la unica forma de probar la camara de verdad.
    host: '0.0.0.0',
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, '.'),
      // El punto de entrada por defecto de onnxruntime-web es el build JSEP,
      // que arrastra WebGPU: 26,5 MB de wasm frente a 13,3 MB del build WASM
      // puro. No usamos WebGPU (el motor arranca con `backend: 'wasm'`), asi
      // que ese peso es heap desperdiciado en el movil ademas de descarga.
      'onnxruntime-web': 'onnxruntime-web/wasm',
    },
  },
  worker: {
    // El SDK de OCR arranca un module worker; sin esto Vite lo empaqueta en
    // formato IIFE y el import dinamico de dentro revienta.
    format: 'es',
  },
  optimizeDeps: {
    // onnxruntime-web trae binarios wasm que el pre-bundle de Vite no sabe
    // tratar y acaba rompiendo las rutas del runtime.
    exclude: ['onnxruntime-web', '@paddleocr/paddleocr-js'],
  },
  build: {
    // El SDK de OCR es grande de por si; avisar a 500 kB solo genera ruido.
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Sin esto el SDK sale con nombre generico (index-<hash>.js) y no
          // se puede distinguir del bundle de la app en las reglas del
          // service worker. Con nombre propio se excluye del precache y se
          // cachea solo tras el primer escaneo.
          if (/node_modules\/(@paddleocr|onnxruntime-web|@techstark\/opencv-js|clipper-lib)/.test(id)) {
            return 'ocr-engine';
          }
          return undefined;
        },
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    dropUnusedOnnxBinaries(),
    VitePWA({
      registerType: 'prompt',
      // Los modelos y el runtime wasm suman decenas de MB. Precachearlos
      // haria que instalar la app descargase todo de golpe; se cachean en
      // caliente tras el primer escaneo, que es cuando de verdad hacen falta.
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,svg,png,ico}'],
        // El motor de OCR se carga bajo demanda y pesa mas de 10 MB; entra en
        // cache la primera vez que se escanea, no al instalar la app.
        globIgnores: ['**/models/**', '**/ort/**', '**/worker-entry-*.js', '**/ocr-engine-*.js'],
        navigateFallback: `${base}index.html`,
        runtimeCaching: [
          {
            // Los chunks del motor de OCR, excluidos del precache arriba.
            urlPattern: ({ url }) => /worker-entry-|ocr-engine-/.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'splitn-ocr-engine',
              expiration: { maxEntries: 6, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url }) => url.pathname.includes('/models/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'splitn-ocr-models',
              // Los modelos estan versionados en el nombre del fichero, asi
              // que una vez cacheados no caducan por tiempo.
              expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url }) => url.pathname.includes('/ort/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'splitn-onnx-runtime',
              expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      manifest: {
        name: 'Splitn · Reparte la cuenta',
        short_name: 'Splitn',
        description:
          'Escanea el ticket y reparte la cuenta. Funciona sin conexión y sin cuentas: todo se queda en tu móvil.',
        lang: 'es',
        dir: 'ltr',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f3f4f6',
        theme_color: '#2a7de1',
        categories: ['finance', 'utilities', 'productivity'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            // El icono maskable evita que Android recorte el logo al meterlo
            // en su plantilla de forma.
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        shortcuts: [
          {
            name: 'Escanear ticket',
            short_name: 'Escanear',
            url: `${base}?action=scan`,
            icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }],
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
});
