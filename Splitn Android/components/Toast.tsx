import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ToastProps {
  message: string | null;
  onDismiss: () => void;
  durationMs?: number;
}

/** Aviso efimero para confirmaciones que no merecen un dialogo. */
export const Toast: React.FC<ToastProps> = ({ message, onDismiss, durationMs = 3000 }) => {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(timer);
  }, [message, durationMs, onDismiss]);

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          role="status"
          aria-live="polite"
          className="fixed inset-x-0 bottom-24 z-[60] mx-auto w-fit max-w-[90vw] rounded-full bg-gray-900 px-5 py-3 text-sm font-medium text-white shadow-xl dark:bg-gray-100 dark:text-gray-900"
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
