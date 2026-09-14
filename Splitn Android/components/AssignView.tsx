import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronDown, Split, X } from 'lucide-react';
import { MAX_PARTS } from '../lib/split';
import { Button } from './Button';
import { Avatar } from './Avatar';
import { useLanguage } from '../contexts/LanguageContext';
import { formatEuros } from '../ocr/money';
import {
  claimedParts, freeParts, isFullyClaimed, setInstanceParts, setParticipantParts,
  takeWholeUnit, togglePart,
} from '../lib/split';
import type { ItemInstance, Receipt } from '../types';

interface AssignViewProps {
  receipt: Receipt;
  participantId: string;
  onSave: (itemStates: Record<string, ItemInstance[]>) => void;
  onCancel: () => void;
}

/**
 * Atajos para partir una unidad. Cubren la mayoria de los casos; para el
 * resto hay un campo libre, porque una tortilla entre 14 es rara pero
 * legitima y no tiene por que ser imposible de expresar.
 */
const SPLIT_OPTIONS = [2, 3, 4, 5];

/**
 * Pantalla donde una persona elige qué ha tomado.
 *
 * Se edita sobre una copia local y solo se persiste al guardar: así se puede
 * cancelar sin dejar el reparto a medias.
 */
export const AssignView: React.FC<AssignViewProps> = ({ receipt, participantId, onSave, onCancel }) => {
  const { t } = useLanguage();
  const participant = receipt.participants.find((p) => p.id === participantId);

  const [itemStates, setItemStates] = useState<Record<string, ItemInstance[]>>(() =>
    structuredClone(receipt.itemStates),
  );
  const [expanded, setExpanded] = useState<string | null>(null);
  const [splitting, setSplitting] = useState<{ itemId: string; index: number } | null>(null);
  const [customParts, setCustomParts] = useState('');

  const myTotal = useMemo(() => {
    let total = 0;
    for (const item of receipt.items) {
      for (const instance of itemStates[item.id] ?? []) {
        const mine = instance.claims[participantId] ?? 0;
        if (mine > 0) total += (item.unitPrice / Math.max(1, instance.totalParts)) * mine;
      }
    }
    return Math.round(total * 100) / 100;
  }, [itemStates, receipt.items, participantId]);

  if (!participant) return null;

  const mutate = (itemId: string, index: number, next: ItemInstance) => {
    setItemStates((current) => {
      const instances = current[itemId];
      if (!instances?.[index]) return current;
      const updated = [...instances];
      updated[index] = next;
      return { ...current, [itemId]: updated };
    });
  };

  /** Nombre de quien ocupa una parte, para que se vea con quién se comparte. */
  /** Un denominador escrito a mano solo vale si es un entero en rango. */
  const isValidParts = (raw: string): boolean => {
    const value = Number(raw);
    return Number.isInteger(value) && value >= 2 && value <= MAX_PARTS;
  };

  const applySplit = (parts: number): void => {
    if (!splitting || !Number.isFinite(parts) || parts < 2) return;
    const instance = itemStates[splitting.itemId]?.[splitting.index];
    if (instance) {
      mutate(splitting.itemId, splitting.index, setInstanceParts(instance, parts, participantId));
    }
    setSplitting(null);
  };

  const otherHolders = (instance: ItemInstance): string[] =>
    Object.keys(instance.claims)
      .filter((id) => id !== participantId)
      .map((id) => receipt.participants.find((p) => p.id === id)?.name)
      .filter((name): name is string => Boolean(name));

  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-32 animate-fade-in">
      <header className="sticky top-0 z-30 -mx-4 mb-4 border-b border-line bg-canvas/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <Avatar name={participant.name} colorSeed={participant.colorSeed} />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-wide text-muted">
              {t.assign.selectingFor}
            </p>
            <p className="truncate text-lg font-bold leading-tight">{participant.name}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold uppercase tracking-wide text-muted">
              {t.assign.yourShare}
            </p>
            <p className="text-2xl font-black tabular-nums text-primary">{formatEuros(myTotal)}</p>
          </div>
        </div>
      </header>

      <ul className="space-y-2">
        {receipt.items.map((item) => {
          const instances = itemStates[item.id] ?? [];
          const available = instances.filter((instance) => !isFullyClaimed(instance)).length;
          const mineHere = instances.reduce(
            (sum, instance) => sum + (instance.claims[participantId] ?? 0) / Math.max(1, instance.totalParts),
            0,
          );
          const isOpen = expanded === item.id;
          const exhausted = available === 0 && mineHere === 0;

          return (
            <li
              key={item.id}
              className={`overflow-hidden rounded-card border transition-colors ${
                mineHere > 0
                  ? 'border-primary bg-surface ring-1 ring-primary/20'
                  : exhausted
                    ? 'border-line bg-hair opacity-60'
                    : 'border-line bg-surface'
              }`}
            >
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : item.id)}
                aria-expanded={isOpen}
                className="flex w-full items-center gap-3 p-4 text-left"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{item.name}</p>
                  <p className="mt-0.5 text-sm text-muted">
                    {formatEuros(item.unitPrice)}
                    {item.quantity > 1 && (
                      <span className="ml-2">
                        · {available > 0 ? t.assign.unitsLeft(available) : t.assign.allTaken}
                      </span>
                    )}
                  </p>
                </div>
                {mineHere > 0 && (
                  <span className="rounded-full bg-primary px-2.5 py-1 text-xs font-bold text-white tabular-nums">
                    {mineHere.toFixed(2).replace(/\.?0+$/, '')}
                  </span>
                )}
                <ChevronDown
                  className={`h-5 w-5 shrink-0 text-faint transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  aria-hidden="true"
                />
              </button>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-line"
                  >
                    <div className="space-y-2 p-3">
                      {instances.map((instance, index) => {
                        const mine = instance.claims[participantId] ?? 0;
                        const others = otherHolders(instance);
                        const free = freeParts(instance);
                        const locked = free === 0 && mine === 0;

                        return (
                          <div
                            key={instance.instanceId}
                            className={`rounded-control border p-3 ${
                              mine > 0
                                ? 'border-primary/40 bg-primary/5'
                                : 'border-line'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold">
                                  {item.quantity > 1 ? t.assign.unit(index + 1) : item.name}
                                  {instance.totalParts > 1 && (
                                    <span className="ml-1.5 text-xs font-normal text-muted">
                                      · {t.assign.splitInto(instance.totalParts)}
                                    </span>
                                  )}
                                </p>
                                <p className="mt-0.5 truncate text-xs text-muted">
                                  {others.length > 0
                                    ? `${t.assign.takenBy} ${others.join(', ')}`
                                    : claimedParts(instance) === 0
                                      ? t.assign.free
                                      : ''}
                                </p>
                              </div>
                              <span className="shrink-0 text-sm font-bold tabular-nums">
                                {formatEuros(item.unitPrice / Math.max(1, instance.totalParts))}
                              </span>
                            </div>

                            {/* Con la unidad partida se muestran las partes una a
                                una: tocar una libre la reclama y tocar una propia
                                la suelta. Asi se pueden coger 2 de 5, que con un
                                unico boton de si/no era inexpresable. */}
                            {instance.totalParts > 1 && (
                              <div className="mt-2.5 flex flex-wrap gap-1.5">
                                {Array.from({ length: instance.totalParts }, (_, part) => {
                                  const isMine = part < mine;
                                  const takenByOther = !isMine && part < mine + (claimedParts(instance) - mine);
                                  const target = isMine ? part : part + 1;

                                  return (
                                    <button
                                      key={part}
                                      type="button"
                                      disabled={takenByOther}
                                      onClick={() =>
                                        mutate(item.id, index, setParticipantParts(instance, participantId, target))
                                      }
                                      aria-label={`${target}/${instance.totalParts}`}
                                      aria-pressed={isMine}
                                      className={`flex h-10 min-w-10 flex-1 items-center justify-center rounded-lg text-sm font-bold transition-colors disabled:cursor-not-allowed ${
                                        isMine
                                          ? 'bg-primary text-white'
                                          : takenByOther
                                            ? 'bg-hair text-faint'
                                            : 'border-2 border-dashed border-ghost text-faint'
                                      }`}
                                    >
                                      {isMine ? <Check className="h-4 w-4" aria-hidden="true" /> : takenByOther ? '·' : '+'}
                                    </button>
                                  );
                                })}
                              </div>
                            )}

                            <div className="mt-2.5 flex gap-2">
                              {instance.totalParts === 1 && (
                                <button
                                  type="button"
                                  disabled={locked}
                                  onClick={() => mutate(item.id, index, togglePart(instance, participantId))}
                                  className={`flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors disabled:opacity-40 ${
                                    mine > 0
                                      ? 'bg-primary text-white'
                                      : 'bg-hair text-muted'
                                  }`}
                                >
                                  {mine > 0 && <Check className="h-4 w-4" aria-hidden="true" />}
                                  {t.assign.takeWhole}
                                </button>
                              )}

                              {instance.totalParts > 1 && (
                                <span className="flex min-h-10 flex-1 items-center px-1 text-sm font-semibold text-muted">
                                  {t.assign.yourParts(mine, instance.totalParts)}
                                </span>
                              )}

                              {instance.totalParts === 1 ? (
                                <button
                                  type="button"
                                  onClick={() => { setCustomParts(''); setSplitting({ itemId: item.id, index }); }}
                                  className="flex min-h-10 items-center gap-1.5 rounded-lg bg-hair px-3 text-sm font-semibold text-muted"
                                >
                                  <Split className="h-4 w-4" aria-hidden="true" />
                                  {t.assign.splitUnit}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => mutate(item.id, index, takeWholeUnit(instance, participantId))}
                                  className="flex min-h-10 items-center rounded-lg bg-hair px-3 text-sm font-semibold text-muted"
                                >
                                  {t.assign.takeWhole}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </li>
          );
        })}
      </ul>

      {/* Selector de en cuántas partes se divide una unidad. */}
      <AnimatePresence>
        {splitting && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 backdrop-blur-sm sm:items-center"
            onClick={() => setSplitting(null)}
          >
            <motion.div
              initial={{ y: 40 }} animate={{ y: 0 }} exit={{ y: 40 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-hero bg-surface p-5"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-bold">{t.assign.splitUnit}</h3>
                <button type="button" onClick={() => setSplitting(null)} aria-label={t.common.close} className="p-1 text-faint">
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {SPLIT_OPTIONS.map((parts) => (
                  <button
                    key={parts}
                    type="button"
                    onClick={() => applySplit(parts)}
                    className="aspect-square rounded-control bg-hair text-lg font-bold transition-colors hover:bg-primary hover:text-white"
                  >
                    {parts}
                  </button>
                ))}

                {/* Quinta casilla: en vez de un numero fijo mas, el campo
                    libre. Asi el atajo cubre lo habitual sin cerrar la puerta
                    a repartos poco corrientes. */}
                <input
                  type="number"
                  inputMode="numeric"
                  min={2}
                  max={MAX_PARTS}
                  value={customParts}
                  onChange={(e) => setCustomParts(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') applySplit(Number(customParts));
                  }}
                  placeholder="…"
                  aria-label={t.assign.customParts}
                  className="aspect-square w-full rounded-control border-2 border-dashed border-ghost bg-transparent text-center text-lg font-bold focus:border-primary focus:outline-none"
                />
              </div>

              <Button
                fullWidth
                className="mt-3"
                disabled={!isValidParts(customParts)}
                onClick={() => applySplit(Number(customParts))}
              >
                {isValidParts(customParts)
                  ? t.assign.splitInto(Number(customParts))
                  : t.assign.customParts}
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-canvas/95 p-4 backdrop-blur">
        <div className="mx-auto flex max-w-xl gap-3">
          <Button variant="outline" onClick={onCancel}>{t.common.cancel}</Button>
          <Button fullWidth className="py-4 text-lg" onClick={() => onSave(itemStates)}>
            {t.assign.saveSelection}
          </Button>
        </div>
      </div>
    </div>
  );
};
