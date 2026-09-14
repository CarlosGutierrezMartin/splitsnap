import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Share, X } from 'lucide-react';
import { Button } from './Button';
import { useLanguage } from '../contexts/LanguageContext';

/** Evento no estandar de Chromium; no existe en lib.dom. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'splitn:install-dismissed';

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // Safari en iOS no soporta display-mode y usa esta propiedad propia.
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * Invitacion a instalar la PWA.
 *
 * En Android se usa el evento del navegador. En iOS no existe ese evento:
 * Safari obliga a pasar por Compartir > Anadir a pantalla de inicio, asi que
 * ahi lo unico que se puede hacer es explicarlo.
 */
export const InstallPrompt: React.FC = () => {
  const { t } = useLanguage();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;

    try {
      if (localStorage.getItem(DISMISSED_KEY)) return;
    } catch {
      // Sin almacenamiento se vuelve a ofrecer. Molesto pero no roto.
    }

    if (isIos()) {
      setShowIosHint(true);
      return;
    }

    const handler = (event: Event) => {
      // Hay que impedir el mini-infobar del navegador para poder ofrecer la
      // instalacion en nuestro propio momento.
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // Ignorable.
    }
    setDeferred(null);
    setShowIosHint(false);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    dismiss();
  };

  const visible = Boolean(deferred) || showIosHint;

  return (
    <AnimatePresence>
      {visible && (
        <motion.aside
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          className="fixed inset-x-0 bottom-0 z-50 p-4"
        >
          <div className="mx-auto flex max-w-xl items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-xl dark:border-gray-700 dark:bg-gray-900">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              {showIosHint ? <Share className="h-5 w-5" aria-hidden="true" /> : <Download className="h-5 w-5" aria-hidden="true" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold">{showIosHint ? t.install.iosTitle : t.install.title}</p>
              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                {showIosHint ? t.install.iosBody : t.install.body}
              </p>
              {!showIosHint && (
                <Button className="mt-3" onClick={install}>{t.install.action}</Button>
              )}
            </div>
            <button
              type="button"
              onClick={dismiss}
              aria-label={t.install.dismiss}
              className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
};
