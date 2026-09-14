import React from 'react';
import { ArrowLeft, Languages, Moon, Pencil, Sun } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';

interface NavbarProps {
  title?: string | undefined;
  onBack?: (() => void) | undefined;
  /** Si se pasa, el titulo se convierte en el boton de renombrar. */
  onEditTitle?: (() => void) | undefined;
}

/** Control redondo de la cabecera: mismo tamaño y mismo trato para todos. */
const PILL =
  'flex h-[34px] items-center border border-line bg-surface text-muted transition-colors hover:border-primary hover:text-primary';

export const Navbar: React.FC<NavbarProps> = ({ title, onBack, onEditTitle }) => {
  const { theme, toggleTheme } = useTheme();
  const { t, language, setLanguage } = useLanguage();

  return (
    <nav className="sticky top-0 z-40 bg-canvas/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-xl items-center gap-2.5 px-4">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            aria-label={t.common.back}
            className={`${PILL} w-[34px] shrink-0 justify-center rounded-full`}
          >
            <ArrowLeft className="h-[17px] w-[17px]" aria-hidden="true" />
          </button>
        ) : (
          // La marca solo aparece donde no hay a donde volver: dentro de un
          // ticket lo que importa es su nombre, no el de la app.
          <img
            src={`${import.meta.env.BASE_URL}logo.png`}
            alt=""
            width={34}
            height={34}
            className="block shrink-0 rounded-[9px]"
          />
        )}

        {/* Renombrar vive en el propio titulo: antes la pantalla de reparto
            repetia el nombre del ticket debajo de la cabecera solo para poder
            llevar el lapiz al lado. */}
        {onEditTitle ? (
          <button
            type="button"
            onClick={onEditTitle}
            className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg py-1 text-left transition-colors hover:text-primary"
          >
            <span className="min-w-0 truncate text-xl font-extrabold tracking-[-0.02em]">
              {title ?? 'Splitn'}
            </span>
            <Pencil className="h-3.5 w-3.5 shrink-0 text-faint" aria-hidden="true" />
            <span className="sr-only">{t.review.receiptName}</span>
          </button>
        ) : (
          <span className="min-w-0 flex-1 truncate text-xl font-extrabold tracking-[-0.02em]">
            {title ?? 'Splitn'}
          </span>
        )}

        <button
          type="button"
          onClick={() => setLanguage(language === 'es' ? 'en' : 'es')}
          aria-label={t.settings.language}
          className={`${PILL} gap-1.5 rounded-full px-2.5 text-[11px] font-bold uppercase tracking-[0.06em]`}
        >
          <Languages className="h-3.5 w-3.5" aria-hidden="true" />
          {language}
        </button>

        <button
          type="button"
          onClick={toggleTheme}
          aria-label={t.settings.theme}
          className={`${PILL} w-[34px] shrink-0 justify-center rounded-full`}
        >
          {theme === 'dark'
            ? <Sun className="h-[17px] w-[17px]" aria-hidden="true" />
            : <Moon className="h-[17px] w-[17px]" aria-hidden="true" />}
        </button>
      </div>
    </nav>
  );
};
