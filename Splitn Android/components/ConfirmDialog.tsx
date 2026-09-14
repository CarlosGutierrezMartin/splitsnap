import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './Button';
import { useLanguage } from '../contexts/LanguageContext';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string | undefined;
  confirmLabel?: string | undefined;
  destructive?: boolean | undefined;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open, title, description, confirmLabel, destructive, onConfirm, onCancel,
}) => {
  const { t } = useLanguage();

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-4 backdrop-blur-sm sm:items-center"
          onClick={onCancel}
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          <motion.div
            initial={{ y: 40, scale: 0.98 }} animate={{ y: 0, scale: 1 }} exit={{ y: 40, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl bg-white p-6 dark:bg-gray-900"
          >
            <h3 className="text-lg font-bold">{title}</h3>
            {description && (
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{description}</p>
            )}
            <div className="mt-6 flex gap-3">
              <Button variant="outline" fullWidth onClick={onCancel}>{t.common.cancel}</Button>
              <Button
                variant={destructive ? 'danger' : 'primary'}
                fullWidth
                onClick={onConfirm}
                autoFocus
              >
                {confirmLabel ?? t.common.confirm}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
