import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { ScanAnimation } from './ScanAnimation';
import { formatMegabytes } from '../ocr/modelLoader';
import { Button } from './Button';
import { useLanguage } from '../contexts/LanguageContext';
import type { OcrStatus } from '../ocr/types';

interface ScanningViewProps {
  status: OcrStatus;
  error: string | null;
  onRetry: () => void;
  onEnterManually: () => void;
}

export const ScanningView: React.FC<ScanningViewProps> = ({ status, error, onRetry, onEnterManually }) => {
  const { t } = useLanguage();

  if (error) {
    return (
      <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col items-center justify-center px-6 text-center animate-fade-in">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400">
          <AlertTriangle className="h-8 w-8" aria-hidden="true" />
        </div>
        <h2 className="mb-2 text-xl font-bold">{t.scanning.failedTitle}</h2>
        <p className="mb-6 text-muted">{t.scanning.failedBody}</p>
        <div className="w-full space-y-3">
          <Button fullWidth onClick={onRetry}>{t.common.retry}</Button>
          <Button fullWidth variant="outline" onClick={onEnterManually}>{t.review.addLine}</Button>
        </div>
        {/* El mensaje tecnico se muestra pero sin protagonismo: ayuda a
            diagnosticar sin asustar a quien solo quiere repartir una cena. */}
        <p className="mt-6 break-words text-xs text-faint">{error}</p>
      </div>
    );
  }

  const downloading = status.phase === 'downloading';
  const { progress } = status;

  // Solo se enseña porcentaje cuando el servidor dijo el tamaño total. Con
  // total desconocido se enseñan los MB que llevan, que es informacion real,
  // en vez de una barra inventada.
  const ratio = progress && progress.total > 0 ? progress.loaded / progress.total : null;
  const percent = ratio !== null ? Math.round(ratio * 100) : null;

  return (
    <div
      className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col items-center justify-center px-6 text-center animate-fade-in"
      role="status"
      aria-live="polite"
    >
      <ScanAnimation progress={downloading ? ratio : null} />

      <h2 className="mb-2 mt-6 text-xl font-bold">
        {downloading
          ? t.scanning.downloadingModel
          : status.phase === 'initializing'
            ? t.scanning.preparing
            : t.scanning.reading}
      </h2>

      {downloading && (
        <>
          {percent !== null && (
            <div className="mt-2 w-full max-w-xs">
              <div
                className="h-2 overflow-hidden rounded-full bg-hair"
                role="progressbar"
                aria-valuenow={percent}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-300"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <p className="mt-2 text-sm font-semibold tabular-nums text-muted">
                {percent}% · {formatMegabytes(progress!.loaded)} / {formatMegabytes(progress!.total)} MB
              </p>
            </div>
          )}

          {percent === null && progress && progress.loaded > 0 && (
            <p className="mt-2 text-sm font-semibold tabular-nums text-muted">
              {formatMegabytes(progress.loaded)} MB
            </p>
          )}

          <p className="mt-3 max-w-xs text-sm text-muted">
            {t.scanning.downloadingHint}
          </p>
        </>
      )}
    </div>
  );
};
