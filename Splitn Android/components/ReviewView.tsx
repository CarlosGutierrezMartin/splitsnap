import React, { useMemo, useState } from 'react';
import { Plus, Trash2, TriangleAlert, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './Button';
import { useLanguage } from '../contexts/LanguageContext';
import { formatEuros } from '../ocr/money';
import type { ParsedItem } from '../types';

interface ReviewViewProps {
  items: ParsedItem[];
  detectedTotal: number | null;
  receiptName: string;
  onChange: (items: ParsedItem[]) => void;
  onRename: (name: string) => void;
  onContinue: () => void;
}

/** Por debajo de esto la lectura se marca para que la persona la mire. */
const LOW_CONFIDENCE = 0.75;

/**
 * Revision y correccion de lo que ha leido el OCR.
 *
 * Es la pantalla mas importante de la app. Ningun lector acierta el 100% en
 * papel termico, asi que en vez de esconder el error lo ponemos delante y lo
 * hacemos trivial de corregir.
 */
export const ReviewView: React.FC<ReviewViewProps> = ({
  items, detectedTotal, receiptName, onChange, onRename, onContinue,
}) => {
  const { t } = useLanguage();
  const [nameDraft, setNameDraft] = useState(receiptName);

  const sum = useMemo(
    () => Math.round(items.reduce((acc, item) => acc + item.totalPrice, 0) * 100) / 100,
    [items],
  );

  const mismatch = detectedTotal !== null && Math.abs(sum - detectedTotal) > 0.02;

  /** Reescribe una linea manteniendo coherentes cantidad, precio y total. */
  const patchItem = (id: string, patch: Partial<ParsedItem>) => {
    onChange(
      items.map((item) => {
        if (item.id !== id) return item;
        const next = { ...item, ...patch };
        const quantity = Math.max(1, Math.min(99, Math.round(next.quantity || 1)));
        const unitPrice = Math.max(0, next.unitPrice || 0);
        return {
          ...next,
          quantity,
          unitPrice,
          totalPrice: Math.round(unitPrice * quantity * 100) / 100,
          // Editar a mano equivale a confirmar: deja de estar en duda.
          confidence: patch.confidence ?? undefined,
        };
      }),
    );
  };

  const addItem = () => {
    onChange([
      ...items,
      {
        id: `manual-${Date.now()}`,
        name: '',
        quantity: 1,
        unitPrice: 0,
        totalPrice: 0,
      },
    ]);
  };

  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-40 pt-5 animate-fade-in">
      <header className="mb-5">
        <h2 className="text-2xl font-black tracking-tight">{t.review.title}</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t.review.subtitle}</p>
      </header>

      <label className="mb-5 block">
        <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {t.review.receiptName}
        </span>
        <input
          type="text"
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
          onBlur={() => onRename(nameDraft.trim() || receiptName)}
          placeholder={t.review.receiptNamePlaceholder}
          className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-base focus:border-primary focus:outline-none dark:border-gray-700 dark:bg-gray-900"
        />
      </label>

      {items.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-300 p-8 text-center dark:border-gray-700">
          <p className="font-semibold">{t.review.noItems}</p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t.review.noItemsHint}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {items.map((item) => {
              const uncertain = item.confidence !== undefined && item.confidence < LOW_CONFIDENCE;
              return (
                <motion.li
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  className={`rounded-2xl border bg-white p-3 dark:bg-gray-900 ${
                    uncertain
                      ? 'border-amber-300 dark:border-amber-700/60'
                      : 'border-gray-200 dark:border-gray-800'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => patchItem(item.id, { name: e.target.value })}
                      placeholder={t.review.newItem}
                      aria-label={t.review.name}
                      className="min-w-0 flex-1 rounded-lg bg-transparent px-2 py-2 font-semibold focus:bg-gray-50 focus:outline-none dark:focus:bg-gray-800"
                    />
                    <button
                      type="button"
                      onClick={() => onChange(items.filter((i) => i.id !== item.id))}
                      aria-label={`${t.common.delete}: ${item.name || t.review.newItem}`}
                      className="rounded-lg p-2 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/40"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>

                  <div className="mt-1 flex items-end gap-2 pl-2">
                    <label className="w-16">
                      <span className="mb-1 block text-[10px] font-bold uppercase text-gray-400">{t.review.quantity}</span>
                      <input
                        type="number" inputMode="numeric" min={1} max={99} value={item.quantity}
                        onChange={(e) => patchItem(item.id, { quantity: Number(e.target.value) })}
                        className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-center tabular-nums focus:border-primary focus:outline-none dark:border-gray-700 dark:bg-gray-800"
                      />
                    </label>
                    <label className="w-24">
                      <span className="mb-1 block text-[10px] font-bold uppercase text-gray-400">{t.review.unitPrice}</span>
                      <input
                        type="number" inputMode="decimal" min={0} step={0.01} value={item.unitPrice}
                        onChange={(e) => patchItem(item.id, { unitPrice: Number(e.target.value) })}
                        className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-right tabular-nums focus:border-primary focus:outline-none dark:border-gray-700 dark:bg-gray-800"
                      />
                    </label>
                    <div className="ml-auto pb-1.5 text-right">
                      <span className="block text-[10px] font-bold uppercase text-gray-400">{t.review.lineTotal}</span>
                      <span className="font-bold tabular-nums">{formatEuros(item.totalPrice)}</span>
                    </div>
                  </div>

                  {uncertain && (
                    <p className="mt-2 flex items-center gap-1.5 pl-2 text-xs text-amber-600 dark:text-amber-400">
                      <TriangleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      {t.review.lowConfidence}
                    </p>
                  )}
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}

      <Button variant="outline" fullWidth className="mt-3" onClick={addItem}>
        <Plus className="h-5 w-5" aria-hidden="true" />
        {t.review.addLine}
      </Button>

      <section className="mt-6 rounded-2xl bg-white p-4 dark:bg-gray-900">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500 dark:text-gray-400">{t.review.sum}</span>
          <span className="text-xl font-black tabular-nums">{formatEuros(sum)}</span>
        </div>
        {detectedTotal !== null && (
          <div className="mt-1.5 flex items-center justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">{t.review.printedTotal}</span>
            <span className="tabular-nums text-gray-500 dark:text-gray-400">{formatEuros(detectedTotal)}</span>
          </div>
        )}

        {/* El desajuste se avisa pero nunca bloquea: el ticket puede llevar un
            servicio aparte y quien decide es la persona, no el parser. */}
        {mismatch && (
          <div className="mt-3 rounded-xl bg-amber-50 p-3 dark:bg-amber-950/30">
            <p className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-400">
              <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
              {t.review.mismatch}
            </p>
            <p className="mt-1 pl-6 text-xs text-amber-600 dark:text-amber-500">{t.review.mismatchHint}</p>
          </div>
        )}
      </section>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 p-4 backdrop-blur dark:border-gray-800 dark:bg-gray-950/95">
        <div className="mx-auto max-w-xl">
          <Button fullWidth className="py-4 text-lg" onClick={onContinue} disabled={items.length === 0}>
            {t.review.continueToSplit}
            <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
};
