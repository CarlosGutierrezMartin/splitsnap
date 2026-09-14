import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Share2, SplitSquareHorizontal, UserMinus, Check, Pencil } from 'lucide-react';
import { Button } from './Button';
import { Avatar } from './Avatar';
import { useLanguage } from '../contexts/LanguageContext';
import { formatEuros } from '../ocr/money';
import { computeTotals, splitRemainderEvenly } from '../lib/split';
import type { ItemInstance, Receipt } from '../types';

interface SplitViewProps {
  receipt: Receipt;
  onAddParticipant: (name: string) => void;
  onRemoveParticipant: (participantId: string) => void;
  onAssign: (participantId: string) => void;
  onUpdateItemStates: (itemStates: Record<string, ItemInstance[]>) => void;
  onShare: () => void;
  onRename: () => void;
}

/** Panel principal del reparto: quién paga qué y cuánto falta por asignar. */
export const SplitView: React.FC<SplitViewProps> = ({
  receipt, onAddParticipant, onRemoveParticipant, onAssign, onUpdateItemStates, onShare, onRename,
}) => {
  const { t } = useLanguage();
  const [newName, setNewName] = useState('');

  const totals = useMemo(() => computeTotals(receipt), [receipt]);
  const fullyAssigned = totals.remaining <= 0.01 && totals.bill > 0;

  const submitName = () => {
    const name = newName.trim();
    if (!name) return;
    onAddParticipant(name);
    setNewName('');
  };

  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-32 pt-5 animate-fade-in">
      {/* El nombre se puede cambiar tambien aqui: antes solo se podia al
          revisar, y pasado ese momento el ticket quedaba con el nombre para
          siempre. */}
      <button
        type="button"
        onClick={onRename}
        className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-center transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
      >
        <span className="truncate text-lg font-bold">{receipt.name}</span>
        <Pencil className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
        <span className="sr-only">{t.review.receiptName}</span>
      </button>

      <section className="mb-6 overflow-hidden rounded-3xl bg-white shadow-sm dark:bg-gray-900">
        <div className="border-b border-gray-100 bg-primary/5 p-6 text-center dark:border-gray-800 dark:bg-primary/10">
          <p className="mb-1 text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
            {t.split.total}
          </p>
          <p className="text-4xl font-black tabular-nums">{formatEuros(totals.bill)}</p>
        </div>

        <div className="p-5">
          <div className="mb-2 flex justify-between text-sm font-semibold">
            <span className="text-secondary">{t.split.assigned}: {formatEuros(totals.claimed)}</span>
            <span className="text-gray-500 dark:text-gray-400">
              {t.split.unassigned}: {formatEuros(Math.max(0, totals.remaining))}
            </span>
          </div>
          <div
            className="h-3 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"
            role="progressbar"
            aria-valuenow={Math.round(totals.progress)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t.split.assigned}
          >
            <motion.div
              className="h-full rounded-full bg-secondary"
              animate={{ width: `${totals.progress}%` }}
              transition={{ type: 'spring', stiffness: 120, damping: 20 }}
            />
          </div>
        </div>
      </section>

      <div className="mb-3 flex items-baseline justify-between px-1">
        <h3 className="text-lg font-bold">{t.split.people}</h3>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {t.split.perPerson(receipt.participants.length)}
        </span>
      </div>

      {receipt.participants.length === 0 && (
        <div className="mb-4 rounded-2xl border-2 border-dashed border-gray-300 p-6 text-center dark:border-gray-700">
          <p className="font-semibold">{t.split.noPeople}</p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t.split.noPeopleHint}</p>
        </div>
      )}

      <ul className="mb-4 space-y-2">
        <AnimatePresence initial={false}>
          {receipt.participants.map((participant) => (
            <motion.li
              key={participant.id}
              layout
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900"
            >
              <Avatar name={participant.name} colorSeed={participant.colorSeed} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{participant.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {(totals.unitsPerParticipant[participant.id] ?? 0).toFixed(2).replace(/\.?0+$/, '')}{' '}
                  {t.split.assignItems.toLowerCase()}
                </p>
              </div>
              <span className="font-bold tabular-nums">{formatEuros(totals.perParticipant[participant.id] ?? 0)}</span>
              <button
                type="button"
                onClick={() => onAssign(participant.id)}
                aria-label={`${t.split.assignItems}: ${participant.name}`}
                className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-primary/10 hover:text-primary"
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => onRemoveParticipant(participant.id)}
                aria-label={`${t.common.delete}: ${participant.name}`}
                className="rounded-lg p-2 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/40"
              >
                <UserMinus className="h-4 w-4" aria-hidden="true" />
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      <div className="flex gap-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submitName()}
          placeholder={t.split.personName}
          aria-label={t.split.addPerson}
          className="min-w-0 flex-1 rounded-xl border-2 border-gray-200 bg-white px-4 py-3 focus:border-primary focus:outline-none dark:border-gray-700 dark:bg-gray-900"
        />
        <Button onClick={submitName} disabled={!newName.trim()} aria-label={t.split.addPerson}>
          <Plus className="h-5 w-5" aria-hidden="true" />
        </Button>
      </div>

      {/* Atajo para el caso mas comun de todos: lo que nadie reclama se
          reparte entre todos a partes iguales. */}
      {receipt.participants.length > 1 && totals.remaining > 0.01 && (
        <button
          type="button"
          onClick={() => onUpdateItemStates(splitRemainderEvenly(receipt))}
          className="mt-4 flex w-full items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4 text-left transition-colors hover:border-primary/50 dark:border-gray-800 dark:bg-gray-900"
        >
          <SplitSquareHorizontal className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          <span>
            <span className="block font-semibold">{t.split.splitRest}</span>
            <span className="block text-xs text-gray-500 dark:text-gray-400">{t.split.splitRestHint}</span>
          </span>
        </button>
      )}

      {fullyAssigned && (
        <p className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-emerald-50 p-4 font-bold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
          <Check className="h-5 w-5" aria-hidden="true" />
          {t.split.allAssigned}
        </p>
      )}

      {receipt.participants.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 p-4 backdrop-blur dark:border-gray-800 dark:bg-gray-950/95">
          <div className="mx-auto max-w-xl">
            <Button fullWidth variant="secondary" className="py-4 text-lg" onClick={onShare}>
              <Share2 className="h-5 w-5" aria-hidden="true" />
              {t.split.share}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
