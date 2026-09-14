# Splitn

Reparte la cuenta escaneando el ticket. Funciona **sin cuentas, sin servidores y sin conexión**:
la foto se lee en tu propio móvil y nada sale del dispositivo.

## Cómo funciona

1. **Foto** del ticket (cámara o galería).
2. **Lectura** con PP-OCRv5 mobile, que corre dentro del navegador.
3. **Revisión**: corriges lo que el lector haya leído mal. Esta pantalla es parte del flujo, no un extra
   — ningún OCR acierta el 100% en papel térmico.
4. **Reparto**: añades a las personas y cada una elige lo que ha tomado. Se puede partir cualquier unidad
   en fracciones ("esta pizza a medias", "de los 3 cafés, uno es mío").
5. **Compartir**: el desglose sale como texto y como imagen, listo para el grupo de WhatsApp.

## Arquitectura

| Capa | Qué hay |
|---|---|
| Interfaz | React 19 + TypeScript, Vite 6, Tailwind 4 (en build, no CDN) |
| OCR | [`@paddleocr/paddleocr-js`](https://github.com/PaddlePaddle/PaddleOCR) (PP-OCRv5 mobile, Apache-2.0) sobre ONNX Runtime Web, en un worker |
| Interpretación | `ocr/parseReceipt.ts` — reglas deterministas, sin LLM |
| Datos | IndexedDB en el dispositivo. Sin backend |
| Distribución | PWA instalable, service worker vía `vite-plugin-pwa` |

### Por qué no hay ningún LLM

El OCR devuelve texto con coordenadas; convertirlo en `{artículo, cantidad, precio}` lo hace
`ocr/parseReceipt.ts` agrupando cajas en filas, anclando el precio a la derecha y descartando líneas que
no son artículos (totales, IVA, formas de pago, cabeceras). Es determinista, corre en microsegundos, no
cuesta dinero y —a diferencia de un LLM— **se puede testear**: ver `ocr/__tests__/`.

### Los pesos, con honestidad

| Qué | Cuándo se descarga | Tamaño |
|---|---|---|
| La aplicación | Al abrirla | ~550 KB |
| Motor de OCR (SDK + OpenCV + ONNX Runtime) | Al escanear por primera vez | ~22 MB |
| Modelos PP-OCRv5 (detección + reconocimiento) | Al escanear por primera vez | ~21 MB |

Solo la primera vez. Después queda todo en caché y la aplicación funciona sin conexión.

## Desarrollo

```bash
npm install
npm run dev          # http://localhost:3000 (y accesible desde el móvil en la misma wifi)
```

`npm run dev` y `npm run build` ejecutan antes `prepare-assets`, que descarga los modelos ONNX a
`public/models/` y copia el runtime WASM a `public/ort/`. **Si esa descarga falla el build no se rompe**:
la aplicación pasa a usar el CDN oficial de PaddleX, aunque entonces el escaneo necesita conexión.
Para reintentarlo:

```bash
npm run fetch-models
```

Otros comandos:

```bash
npm test             # tests del parser y de la aritmética del reparto
npm run typecheck
npm run build
npm run make-icons   # regenera los iconos de la PWA desde scripts/make-icons.mjs
```

## Despliegue

`.github/workflows/deploy.yml` publica en GitHub Pages en cada push a `main`, pasando `BASE_PATH` para
que las rutas cuelguen de `/<repo>/`.

> GitHub Pages en un repositorio **privado** requiere GitHub Pro. Si no lo tienes, el mismo `dist/`
> se puede publicar en Cloudflare Pages o Netlify sin tocar el código: solo cambia el workflow.

## Licencia de los modelos

PP-OCRv5 es Apache-2.0, del proyecto oficial [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR).
Los pesos se descargan del host oficial de PaddleX.
