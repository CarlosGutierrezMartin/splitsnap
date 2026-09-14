import React from 'react';
import { ArrowLeft, Languages, Moon, Sun } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';

interface NavbarProps {
  title?: string | undefined;
  onBack?: (() => void) | undefined;
}

export const Navbar: React.FC<NavbarProps> = ({ title, onBack }) => {
  const { theme, toggleTheme } = useTheme();
  const { t, language, setLanguage } = useLanguage();

  return (
    <nav className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 backdrop-blur dark:border-gray-800 dark:bg-gray-950/90">
      <div className="mx-auto flex h-14 max-w-xl items-center gap-2 px-3">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            aria-label={t.common.back}
            className="rounded-lg p-2 text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </button>
        ) : (
          <span className="w-2" />
        )}

        <span className="min-w-0 flex-1 truncate font-bold">{title ?? 'Splitn'}</span>

        <button
          type="button"
          onClick={() => setLanguage(language === 'es' ? 'en' : 'es')}
          aria-label={t.settings.language}
          className="flex items-center gap-1 rounded-lg px-2 py-2 text-xs font-bold uppercase text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          <Languages className="h-4 w-4" aria-hidden="true" />
          {language}
        </button>

        <button
          type="button"
          onClick={toggleTheme}
          aria-label={t.settings.theme}
          className="rounded-lg p-2 text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          {theme === 'dark'
            ? <Sun className="h-5 w-5" aria-hidden="true" />
            : <Moon className="h-5 w-5" aria-hidden="true" />}
        </button>
      </div>
    </nav>
  );
};
