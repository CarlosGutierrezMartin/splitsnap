import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './Button';
import { useLanguage } from '../contexts/LanguageContext';

interface RenameDialogProps {
  open: boolean;
  title: string;
  initialValue: string;
  placeholder?: string | undefined;
  onSave: (value: string) => void;
  onCancel: () => void;
}

/** Dialogo para renombrar, reutilizable desde cualquier pantalla. */
export const RenameDialog: React.FC<RenameDialogProps> = ({
  open, title, initialValue, placeholder, onSave, onCancel,
}) => {
  const { t } = useLanguage();
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  // Al abrir se recarga el valor actual y se selecciona entero: lo habitual
  // es querer reescribir el nombre, no añadir al final.
  useEffect(() => {
    if (!open) return;
    setValue(initialValue);
    const timer = setTimeout(() => inputRef.current?.select(), 50);
    return () => clearTimeout(timer);
  }, [open, initialValue]);

  const save = (): void => {
    const trimmed = value.trim();
    // Un nombre vacio dejaria el ticket sin identificar en el historial.
    if (trimmed) onSave(trimmed);
    onCancel();
  };

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
            initial={{ y: 40 }} animate={{ y: 0 }} exit={{ y: 40, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-hero bg-surface p-6"
          >
            <h3 className="mb-4 text-lg font-bold">{title}</h3>
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') save();
                if (e.key === 'Escape') onCancel();
              }}
              placeholder={placeholder}
              aria-label={title}
              className="w-full rounded-control border-2 border-line bg-surface px-4 py-3 text-base focus:border-primary focus:outline-none"
            />
            <div className="mt-6 flex gap-3">
              <Button variant="outline" fullWidth onClick={onCancel}>{t.common.cancel}</Button>
              <Button fullWidth onClick={save} disabled={!value.trim()}>{t.common.save}</Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
