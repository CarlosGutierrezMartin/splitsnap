import React, { useEffect, useState } from 'react';
import { Check, X, Eye, EyeOff } from 'lucide-react';
import { Button } from './Button';
import { useLanguage } from '../contexts/LanguageContext';
import type { RowDiagnostic } from '../ocr/parseReceipt';
import type { OcrOutput } from '../ocr/types';

export interface ScanDiagnostics {
  image: Blob;
  output: OcrOutput;
  rows: RowDiagnostic[];
  skewDegrees: number;
}

interface DiagnosticsViewProps {
  data: ScanDiagnostics;
  onClose: () => void;
}

/**
 * Banco de pruebas del ultimo escaneo.
 *
 * Es la herramienta que convierte un "no lo ha leido bien" en un caso
 * concreto: enseña las cajas que encontro el detector sobre la propia foto y,
 * fila a fila, la puntuacion y los motivos por los que el parser la acepto o
 * la descarto. Sin esto, mejorar la deteccion es adivinar.
 */
export const DiagnosticsView: React.FC<DiagnosticsViewProps> = ({ data, onClose }) => {
  const { t } = useLanguage();
  const [url, setUrl] = useState<string | null>(null);
  const [showBoxes, setShowBoxes] = useState(true);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(data.image);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [data.image]);

  const { width, height } = data.output.image;

  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-28 pt-6 animate-fade-in">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-2xl font-black tracking-tight">{t.diagnostics.title}</h2>
        <Button variant="ghost" onClick={onClose} aria-label={t.common.close}>
          <X className="h-5 w-5" aria-hidden="true" />
        </Button>
      </div>

      <dl className="mb-4 grid grid-cols-3 gap-2 text-center">
        {[
          [t.diagnostics.boxes, String(data.output.lines.length)],
          [t.diagnostics.rows, String(data.rows.length)],
          [t.diagnostics.elapsed, `${Math.round(data.output.elapsedMs)} ms`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-white p-3 dark:bg-gray-900">
            <dt className="text-[11px] font-bold uppercase tracking-wide text-gray-500">{label}</dt>
            <dd className="mt-0.5 font-black tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      {data.skewDegrees !== 0 && (
        <p className="mb-4 rounded-xl bg-white p-3 text-sm text-gray-600 dark:bg-gray-900 dark:text-gray-300">
          {t.review.straightened(Math.abs(data.skewDegrees))}
        </p>
      )}

      <div className="mb-3 flex justify-end">
        <Button variant="outline" onClick={() => setShowBoxes((v) => !v)}>
          {showBoxes ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
          {showBoxes ? t.diagnostics.hideBoxes : t.diagnostics.showBoxes}
        </Button>
      </div>

      {/* Las cajas se dibujan en un SVG con el mismo sistema de coordenadas
          que devolvio el detector, asi encajan sin conversiones. */}
      <div className="relative mb-6 overflow-hidden rounded-2xl bg-gray-900">
        {url && <img src={url} alt={t.diagnostics.title} className="block w-full" />}
        {showBoxes && (
          <svg viewBox={`0 0 ${width} ${height}`} className="absolute inset-0 h-full w-full" aria-hidden="true">
            {data.output.lines.map((line, i) => (
              <rect
                key={i}
                x={line.box.x} y={line.box.y}
                width={line.box.width} height={line.box.height}
                fill="none"
                stroke={line.score < 0.75 ? '#f59e0b' : '#2a7de1'}
                strokeWidth={Math.max(1, width / 400)}
              />
            ))}
          </svg>
        )}
      </div>

      <h3 className="mb-2 px-1 text-sm font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {t.diagnostics.decisions}
      </h3>

      <ul className="space-y-2">
        {data.rows.map((row, i) => (
          <li
            key={i}
            className={`rounded-xl border p-3 ${
              row.accepted
                ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20'
                : 'border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900'
            }`}
          >
            <div className="flex items-start gap-2">
              {row.accepted
                ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                : <X className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />}
              <span className="min-w-0 flex-1 break-words font-mono text-sm">{row.text || '—'}</span>
              <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-xs font-bold tabular-nums dark:bg-gray-800">
                {row.score.toFixed(2)}
              </span>
            </div>
            <p className="mt-1.5 pl-6 text-xs text-gray-500 dark:text-gray-400">
              {row.reasons.join(' · ')}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
};
