import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, ChevronRight, Pencil, Receipt, Trash2, WifiOff } from 'lucide-react';
import { Button } from './Button';
import { useLanguage } from '../contexts/LanguageContext';
import { formatEuros } from '../ocr/money';
import type { Receipt as ReceiptModel } from '../types';

interface HomeViewProps {
  history: ReceiptModel[];
  loading: boolean;
  onScan: () => void;
  onOpen: (receipt: ReceiptModel) => void;
  onDelete: (receiptId: string) => void;
  onRename: (receipt: ReceiptModel) => void;
}

function formatWhen(timestamp: number, locale: string): string {
  const diffMinutes = Math.round((Date.now() - timestamp) / 60000);
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  if (diffMinutes < 60) return relative.format(-diffMinutes, 'minute');
  if (diffMinutes < 60 * 24) return relative.format(-Math.round(diffMinutes / 60), 'hour');
  if (diffMinutes < 60 * 24 * 7) return relative.format(-Math.round(diffMinutes / 1440), 'day');
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(timestamp);
}

export const HomeView: React.FC<HomeViewProps> = ({
  history, loading, onScan, onOpen, onDelete, onRename,
}) => {
  const { t, language } = useLanguage();

  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-12 pt-6 animate-fade-in">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-black tracking-tight">Splitn</h1>
        <p className="mt-1 text-gray-500 dark:text-gray-400">{t.home.tagline}</p>
      </header>

      <Button fullWidth className="mb-3 py-5 text-lg" onClick={onScan}>
        <Camera className="h-6 w-6" aria-hidden="true" />
        {t.home.scanReceipt}
      </Button>

      <p className="mb-8 flex items-center justify-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
        <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
        {t.home.offlineReady}
      </p>

      <h2 className="mb-3 px-1 text-sm font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {t.home.recent}
      </h2>

      {loading ? (
        <ul className="space-y-2" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <li key={i} className="h-[72px] animate-pulse rounded-2xl bg-white dark:bg-gray-900" />
          ))}
        </ul>
      ) : history.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-300 p-8 text-center dark:border-gray-700">
          <Receipt className="mx-auto mb-3 h-10 w-10 text-gray-300 dark:text-gray-600" aria-hidden="true" />
          <p className="font-semibold">{t.home.empty}</p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t.home.emptyHint}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {history.map((receipt) => {
              const total = receipt.items.reduce((sum, item) => sum + item.totalPrice, 0);
              return (
                <motion.li
                  key={receipt.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-1 rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
                >
                  <button
                    type="button"
                    onClick={() => onOpen(receipt)}
                    className="flex min-w-0 flex-1 items-center gap-3 p-4 text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold">{receipt.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {t.home.items(receipt.items.length)} · {formatWhen(receipt.updatedAt, language)}
                      </p>
                    </div>
                    <span className="shrink-0 font-bold tabular-nums">{formatEuros(total)}</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onRename(receipt)}
                    aria-label={`${t.common.edit}: ${receipt.name}`}
                    className="rounded-lg p-2 text-gray-300 transition-colors hover:bg-gray-100 hover:text-primary dark:hover:bg-gray-800"
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(receipt.id)}
                    aria-label={`${t.common.delete}: ${receipt.name}`}
                    className="mr-2 rounded-lg p-2 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/40"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
};
