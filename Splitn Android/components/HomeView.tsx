import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera, Check, ChevronRight, CloudDownload, Images, Pencil, Receipt, ShieldCheck, Trash2, WifiOff,
} from 'lucide-react';
import { Avatar } from './Avatar';
import { useLanguage } from '../contexts/LanguageContext';
import { formatEuros } from '../ocr/money';
import { computeTotals } from '../lib/split';
import type { Receipt as ReceiptModel } from '../types';

interface HomeViewProps {
  history: ReceiptModel[];
  loading: boolean;
  onScan: () => void;
  /** Foto ya elegida de la galeria, saltandose la pantalla de captura. */
  onPickFile: (file: File) => void;
  onOpen: (receipt: ReceiptModel) => void;
  onDelete: (receiptId: string) => void;
  onRename: (receipt: ReceiptModel) => void;
  /** Estado de la preparacion para uso sin conexion. */
  offline: 'idle' | 'downloading' | 'ready';
  offlineProgress: number | null;
  onPrepareOffline: () => void;
}

/** Caras que caben en la pila antes de que se amontonen sin decir nada. */
const MAX_FACES = 4;

function formatWhen(timestamp: number, locale: string): string {
  const diffMinutes = Math.round((Date.now() - timestamp) / 60000);
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  if (diffMinutes < 60) return relative.format(-diffMinutes, 'minute');
  if (diffMinutes < 60 * 24) return relative.format(-Math.round(diffMinutes / 60), 'hour');
  if (diffMinutes < 60 * 24 * 7) return relative.format(-Math.round(diffMinutes / 1440), 'day');
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(timestamp);
}

export const HomeView: React.FC<HomeViewProps> = ({
  history, loading, onScan, onPickFile, onOpen, onDelete, onRename,
  offline, offlineProgress, onPrepareOffline,
}) => {
  const { t, language } = useLanguage();
  const galleryRef = useRef<HTMLInputElement>(null);

  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-28 animate-fade-in-up">
      {/* Tarjeta principal: dice en una linea que hace la app y lleva dentro
          el boton de escanear, en vez de dejarlo suelto sobre el fondo. */}
      <section className="rounded-hero bg-primary p-[22px] shadow-hero">
        <p className="max-w-[18ch] text-[22px] font-extrabold leading-[29px] tracking-[-0.01em] text-white">
          {t.home.heroTitle}
        </p>
        <p className="mb-[18px] mt-2 max-w-[30ch] text-[15px] font-semibold leading-[21px] text-white">
          {t.capture.subtitle}
        </p>

        <div className="flex gap-2.5">
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={onScan}
            className="inline-flex min-h-[52px] flex-1 items-center justify-center gap-2.5 rounded-control bg-white text-[17px] font-bold text-primary-deep transition-colors hover:bg-[#f0f6ff]"
          >
            <Camera className="h-[22px] w-[22px]" aria-hidden="true" />
            {t.home.scanShort}
          </motion.button>

          {/* Atajo para quien ya tiene la foto hecha: se salta la camara y
              cae directo en el encuadre. */}
          <input
            ref={galleryRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file && file.type.startsWith('image/')) onPickFile(file);
              // Se limpia para que elegir dos veces la misma foto siga
              // disparando el cambio.
              e.target.value = '';
            }}
          />
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={() => galleryRef.current?.click()}
            aria-label={t.capture.chooseFile}
            className="inline-flex min-h-[52px] w-[52px] items-center justify-center rounded-control border border-white/70 bg-white/15 text-white transition-colors hover:bg-white/25"
          >
            <Images className="h-[21px] w-[21px]" aria-hidden="true" />
          </motion.button>
        </div>
      </section>

      {/* La descarga del lector son 44 MB. En vez de gastarlos sin permiso al
          abrir la app, se ofrece adelantarlos cuando a la persona le venga
          bien; quien no lo toque los descarga igual al primer escaneo. */}
      {offline === 'ready' ? (
        <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-faint">
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
          {t.home.offlineReady}
        </p>
      ) : (
        <button
          type="button"
          onClick={onPrepareOffline}
          disabled={offline === 'downloading'}
          className="mt-3 flex w-full items-center gap-3 rounded-card border border-line bg-surface p-3 text-left transition-colors hover:border-primary disabled:cursor-progress"
        >
          {offline === 'downloading'
            ? <CloudDownload className="h-5 w-5 shrink-0 animate-pulse text-primary" aria-hidden="true" />
            : <WifiOff className="h-5 w-5 shrink-0 text-faint" aria-hidden="true" />}
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">
              {offline === 'downloading' && offlineProgress !== null
                ? t.home.preparingOffline(Math.round(offlineProgress * 100))
                : t.home.prepareOffline}
            </span>
            <span className="block text-xs text-muted">{t.home.prepareOfflineHint}</span>
          </span>
        </button>
      )}

      <div className="mb-3 mt-7 flex items-baseline justify-between gap-2 px-0.5">
        <h2 className="text-[13px] font-bold uppercase tracking-[0.08em] text-muted">
          {t.home.recent}
        </h2>
        {history.length > 0 && (
          <span className="text-xs text-faint">{t.home.saved(history.length)}</span>
        )}
      </div>

      {loading ? (
        <ul className="space-y-2.5" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <li key={i} className="h-[92px] animate-pulse rounded-card bg-surface" />
          ))}
        </ul>
      ) : history.length === 0 ? (
        <div className="rounded-card border-2 border-dashed border-ghost p-8 text-center">
          <Receipt className="mx-auto mb-3 h-10 w-10 text-ghost" aria-hidden="true" />
          <p className="font-semibold">{t.home.empty}</p>
          <p className="mt-1 text-sm text-muted">{t.home.emptyHint}</p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          <AnimatePresence initial={false}>
            {history.map((receipt) => {
              const totals = computeTotals(receipt);
              // El estado se mide en dinero, no en articulos: lo que se
              // quiere saber de un vistazo es cuanto queda por reclamar.
              // El margen de medio centimo evita que un redondeo deje un
              // ticket entero marcado como pendiente.
              const status = totals.claimed <= 0
                ? t.home.statusUnsplit
                : totals.remaining <= 0.005
                  ? t.home.statusSettled
                  : t.home.statusMissing(formatEuros(totals.remaining));

              return (
                <motion.li
                  key={receipt.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden rounded-card border border-line bg-surface"
                >
                  <button
                    type="button"
                    onClick={() => onOpen(receipt)}
                    className="flex w-full items-center gap-3 px-3.5 pb-3 pt-4 text-left"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base font-bold">{receipt.name}</span>
                      <span className="mt-0.5 block text-xs leading-4 text-muted">
                        {t.home.items(receipt.items.length)}
                        {receipt.participants.length > 0 && ` · ${t.home.people(receipt.participants.length)}`}
                        {` · ${formatWhen(receipt.updatedAt, language)}`}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-[17px] font-extrabold tabular-nums">
                        {formatEuros(totals.bill)}
                      </span>
                      <span className="mt-0.5 block text-[11px] font-bold uppercase tracking-[0.04em] text-muted">
                        {status}
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-ghost" aria-hidden="true" />
                  </button>

                  <div className="flex items-center gap-2.5 px-3.5 pb-3.5">
                    <div className="flex shrink-0">
                      {receipt.participants.slice(0, MAX_FACES).map((participant, index) => (
                        <Avatar
                          key={participant.id}
                          name={participant.name}
                          colorSeed={index}
                          size="xs"
                          className="-ml-1.5 ring-2 ring-surface first:ml-0"
                        />
                      ))}
                    </div>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-hair">
                      <div
                        className="h-full rounded-full bg-secondary transition-[width]"
                        style={{ width: `${totals.progress}%` }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => onRename(receipt)}
                      aria-label={`${t.common.edit}: ${receipt.name}`}
                      className="rounded-lg p-1.5 text-ghost transition-colors hover:bg-hair hover:text-primary"
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(receipt.id)}
                      aria-label={`${t.common.delete}: ${receipt.name}`}
                      className="rounded-lg p-1.5 text-ghost transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/40"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}

      <p className="mt-6 flex items-center gap-1.5 px-0.5 text-xs text-faint">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {t.capture.privacy}
      </p>
    </div>
  );
};
