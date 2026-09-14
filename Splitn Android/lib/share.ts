import type { Receipt } from '../types';
import { breakdownFor, computeTotals } from './split';
import { formatEuros } from '../ocr/money';

/**
 * Exportar el reparto.
 *
 * Al no haber sesiones compartidas, este es el unico puente hacia el resto
 * del grupo: un texto para pegar en WhatsApp y una imagen para quien prefiera
 * verlo de un vistazo.
 */

/** Formatea "1/2" o "2" segun la parte que le toque a alguien de un articulo. */
function formatShare(share: number): string {
  if (Math.abs(share - Math.round(share)) < 0.001) return `${Math.round(share)}x`;

  // Denominadores pequenos cubren todos los repartos reales (mitades,
  // tercios, cuartos) y se leen mucho mejor que "0.33".
  for (const denominator of [2, 3, 4, 5, 6, 8, 10, 12]) {
    const numerator = share * denominator;
    if (Math.abs(numerator - Math.round(numerator)) < 0.01) {
      return `${Math.round(numerator)}/${denominator}`;
    }
  }
  return `${share.toFixed(2)}x`;
}

/** Resumen del reparto en texto plano, listo para pegar en un chat. */
export function buildSummaryText(receipt: Receipt): string {
  const totals = computeTotals(receipt);
  const lines: string[] = [`🧾 ${receipt.name}`, `Total: ${formatEuros(totals.bill)}`, ''];

  for (const participant of receipt.participants) {
    const breakdown = breakdownFor(receipt, participant);
    lines.push(`${participant.name}: ${formatEuros(breakdown.total)}`);
    for (const line of breakdown.lines) {
      lines.push(`  · ${formatShare(line.share)} ${line.name} — ${formatEuros(line.cost)}`);
    }
    lines.push('');
  }

  if (totals.remaining > 0.01) {
    lines.push(`⚠️ Sin asignar: ${formatEuros(totals.remaining)}`);
  }

  return lines.join('\n').trim();
}

/** Dibuja el mismo resumen como imagen, para compartir de un vistazo. */
export async function buildSummaryImage(receipt: Receipt): Promise<Blob | null> {
  const totals = computeTotals(receipt);
  const padding = 48;
  const width = 900;

  // Se mide la altura antes de pintar para que el lienzo se ajuste al
  // contenido en vez de recortarlo o dejar un hueco enorme.
  let height = padding * 2 + 130;
  for (const participant of receipt.participants) {
    height += 58 + breakdownFor(receipt, participant).lines.length * 34 + 18;
  }
  if (totals.remaining > 0.01) height += 56;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = Math.max(height, 400);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const font = (size: number, weight = '400') =>
    `${weight} ${size}px Geist, system-ui, -apple-system, sans-serif`;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let y = padding + 16;

  ctx.fillStyle = '#111827';
  ctx.font = font(38, '800');
  ctx.fillText(receipt.name, padding, y);
  y += 46;

  ctx.fillStyle = '#6b7280';
  ctx.font = font(24);
  ctx.fillText(`Total ${formatEuros(totals.bill)}`, padding, y);
  y += 30;

  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(padding, y);
  ctx.lineTo(width - padding, y);
  ctx.stroke();
  y += 48;

  for (const participant of receipt.participants) {
    const breakdown = breakdownFor(receipt, participant);

    ctx.fillStyle = '#111827';
    ctx.font = font(28, '700');
    ctx.fillText(participant.name, padding, y);

    ctx.fillStyle = '#2A7DE1';
    ctx.textAlign = 'right';
    ctx.fillText(formatEuros(breakdown.total), width - padding, y);
    ctx.textAlign = 'left';
    y += 38;

    ctx.fillStyle = '#6b7280';
    ctx.font = font(22);
    for (const line of breakdown.lines) {
      ctx.fillText(`${formatShare(line.share)} ${line.name}`, padding + 24, y);
      ctx.textAlign = 'right';
      ctx.fillText(formatEuros(line.cost), width - padding, y);
      ctx.textAlign = 'left';
      y += 34;
    }
    y += 38;
  }

  if (totals.remaining > 0.01) {
    ctx.fillStyle = '#b45309';
    ctx.font = font(24, '600');
    ctx.fillText(`Sin asignar: ${formatEuros(totals.remaining)}`, padding, y);
  }

  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/png'));
}

export type ShareOutcome = 'shared' | 'copied' | 'unavailable';

/**
 * Comparte el resumen por el canal que ofrezca el sistema.
 *
 * Web Share con fichero es lo ideal (abre WhatsApp directamente) pero solo
 * existe en movil; en escritorio se cae a compartir solo texto y, si tampoco,
 * al portapapeles. Se intenta de mejor a peor.
 */
export async function shareSummary(receipt: Receipt): Promise<ShareOutcome> {
  const text = buildSummaryText(receipt);

  try {
    const image = await buildSummaryImage(receipt);
    if (image && typeof navigator.canShare === 'function') {
      const file = new File([image], `${receipt.name}.png`, { type: 'image/png' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text, title: receipt.name });
        return 'shared';
      }
    }

    if (typeof navigator.share === 'function') {
      await navigator.share({ text, title: receipt.name });
      return 'shared';
    }
  } catch (err) {
    // Cancelar el dialogo de compartir lanza AbortError. No es un fallo:
    // la persona simplemente ha cambiado de idea, no hay que insistir.
    if (err instanceof DOMException && err.name === 'AbortError') return 'shared';
  }

  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'unavailable';
  }
}

/** Descarga el resumen como PNG (util en escritorio, donde no hay Web Share). */
export async function downloadSummaryImage(receipt: Receipt): Promise<boolean> {
  const blob = await buildSummaryImage(receipt);
  if (!blob) return false;

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${receipt.name.replace(/[^\w\s-]/g, '')}.png`;
  anchor.click();
  URL.revokeObjectURL(url);
  return true;
}
