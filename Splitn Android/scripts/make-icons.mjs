#!/usr/bin/env node
/**
 * Genera los iconos de la PWA a partir de un unico SVG.
 *
 * Se generan en vez de commitearse como binarios para que cambiar el logo sea
 * editar un SVG y volver a ejecutar el script.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DEST = join(ROOT, 'public', 'icons');

/** Un ticket partido en dos: el gesto que resume la app. */
function logoSvg({ padding }) {
  const size = 512;
  const inner = size - padding * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#2a7de1"/>
      <stop offset="100%" stop-color="#10b981"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#bg)"/>
  <g transform="translate(${padding} ${padding}) scale(${inner / 512})">
    <path d="M140 60 h232 a12 12 0 0 1 12 12 v368 l-40 -26 -40 26 -40 -26 -40 26 -40 -26 -40 26 -40 -26 v-342 a12 12 0 0 1 12 -12 z"
          fill="#ffffff" opacity="0.96"/>
    <rect x="176" y="150" width="160" height="22" rx="11" fill="#2a7de1"/>
    <rect x="176" y="212" width="120" height="22" rx="11" fill="#94a3b8"/>
    <rect x="176" y="274" width="140" height="22" rx="11" fill="#94a3b8"/>
    <path d="M256 96 v330" stroke="#2a7de1" stroke-width="14" stroke-dasharray="26 22" stroke-linecap="round" opacity="0.85"/>
  </g>
</svg>`;
}

async function main() {
  await mkdir(DEST, { recursive: true });

  // Icono normal: poco margen, se ve grande en la pantalla de inicio.
  const standard = Buffer.from(logoSvg({ padding: 32 }));
  // Maskable: Android recorta hasta un 20% por cada lado, asi que el dibujo
  // tiene que caber dentro de la "zona segura" central.
  const maskable = Buffer.from(logoSvg({ padding: 102 }));

  await writeFile(join(DEST, 'icon.svg'), standard);

  const outputs = [
    { file: 'icon-192.png', size: 192, source: standard },
    { file: 'icon-512.png', size: 512, source: standard },
    { file: 'icon-maskable-512.png', size: 512, source: maskable },
    // iOS no admite transparencia en el icono de inicio: la pinta de negro.
    { file: 'apple-touch-icon.png', size: 180, source: standard },
  ];

  for (const { file, size, source } of outputs) {
    await sharp(source).resize(size, size).png().toFile(join(DEST, file));
    console.log(`  generado  icons/${file}`);
  }
}

main().catch((err) => {
  console.error(`make-icons: ${err.message}`);
  process.exitCode = 1;
});
