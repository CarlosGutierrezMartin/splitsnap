import React from 'react';
import { Loader2, Download, ScanLine, AlertTriangle } from 'lucide-react';
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
        <p className="mb-6 text-gray-500 dark:text-gray-400">{t.scanning.failedBody}</p>
        <div className="w-full space-y-3">
          <Button fullWidth onClick={onRetry}>{t.common.retry}</Button>
          <Button fullWidth variant="outline" onClick={onEnterManually}>{t.review.addLine}</Button>
        </div>
        {/* El mensaje tecnico se muestra pero sin protagonismo: ayuda a
            diagnosticar sin asustar a quien solo quiere repartir una cena. */}
        <p className="mt-6 break-words text-xs text-gray-400 dark:text-gray-600">{error}</p>
      </div>
    );
  }

  const downloading = status.phase === 'downloading';

  return (
    <div
      className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col items-center justify-center px-6 text-center animate-fade-in"
      role="status"
      aria-live="polite"
    >
      <div className="relative mb-6">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10 text-primary">
          {downloading ? <Download className="h-9 w-9" aria-hidden="true" /> : <ScanLine className="h-9 w-9" aria-hidden="true" />}
        </div>
        <Loader2 className="absolute -bottom-1 -right-1 h-7 w-7 animate-spin text-primary" aria-hidden="true" />
      </div>

      <h2 className="mb-2 text-xl font-bold">
        {downloading ? t.scanning.downloadingModel : status.phase === 'ready' ? t.scanning.reading : t.scanning.preparing}
      </h2>

      {downloading && (
        <p className="max-w-xs text-sm text-gray-500 dark:text-gray-400">{t.scanning.downloadingHint}</p>
      )}
    </div>
  );
};
