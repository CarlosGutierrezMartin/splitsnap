import React from 'react';
import { Moon, Sun, Languages, Trash2, FlaskConical, FileText, ShieldCheck, ChevronRight } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';

interface SettingsViewProps {
  receiptCount: number;
  onClearData: () => void;
  onOpenDiagnostics: () => void;
  hasDiagnostics: boolean;
}

/** Fila de ajuste, para que todas se comporten igual. */
const Row: React.FC<{
  icon: React.ElementType;
  label: string;
  hint?: string | undefined;
  onClick?: (() => void) | undefined;
  value?: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
}> = ({ icon: Icon, label, hint, onClick, value, danger, disabled }) => {
  const content = (
    <>
      <Icon
        className={`h-5 w-5 shrink-0 ${danger ? 'text-red-500' : 'text-gray-400'}`}
        aria-hidden="true"
      />
      <span className="min-w-0 flex-1 text-left">
        <span className={`block font-semibold ${danger ? 'text-red-600 dark:text-red-400' : ''}`}>
          {label}
        </span>
        {hint && <span className="block text-xs text-gray-500 dark:text-gray-400">{hint}</span>}
      </span>
      {value}
    </>
  );

  const shared =
    'flex w-full min-h-14 items-center gap-3 px-4 py-3 text-left transition-colors disabled:opacity-40';

  // Siempre un boton, tambien cuando esta deshabilitado: un div sin rol no
  // se anuncia ni se enfoca, y quien usa lector de pantalla no llegaria a
  // saber que la opcion existe.
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || !onClick}
      className={`${shared} hover:bg-gray-50 dark:hover:bg-gray-800`}
    >
      {content}
    </button>
  );
};

export const SettingsView: React.FC<SettingsViewProps> = ({
  receiptCount, onClearData, onOpenDiagnostics, hasDiagnostics,
}) => {
  const { theme, toggleTheme } = useTheme();
  const { t, language, setLanguage } = useLanguage();

  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-28 pt-6 animate-fade-in">
      <h2 className="mb-5 text-2xl font-black tracking-tight">{t.tabs.settings}</h2>

      <section className="mb-4 divide-y divide-gray-100 overflow-hidden rounded-2xl bg-white dark:divide-gray-800 dark:bg-gray-900">
        <Row
          icon={theme === 'dark' ? Moon : Sun}
          label={t.settings.theme}
          onClick={toggleTheme}
          value={
            <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">
              {theme === 'dark' ? t.settings.dark : t.settings.light}
            </span>
          }
        />
        <Row
          icon={Languages}
          label={t.settings.language}
          onClick={() => setLanguage(language === 'es' ? 'en' : 'es')}
          value={
            <span className="text-sm font-semibold uppercase text-gray-500 dark:text-gray-400">
              {language}
            </span>
          }
        />
      </section>

      <section className="mb-4 divide-y divide-gray-100 overflow-hidden rounded-2xl bg-white dark:divide-gray-800 dark:bg-gray-900">
        {/* El banco de pruebas es la herramienta que convierte un "falla" en
            un caso concreto: enseña que leyo el OCR y por que el parser
            acepto o rechazo cada fila. */}
        <Row
          icon={FlaskConical}
          label={t.settings.diagnostics}
          hint={hasDiagnostics ? t.settings.diagnosticsHint : t.settings.diagnosticsEmpty}
          onClick={hasDiagnostics ? onOpenDiagnostics : undefined}
          disabled={!hasDiagnostics}
          value={hasDiagnostics ? <ChevronRight className="h-4 w-4 text-gray-300" aria-hidden="true" /> : undefined}
        />
        <Row
          icon={Trash2}
          label={t.settings.clearData}
          hint={t.settings.clearDataHint(receiptCount)}
          onClick={receiptCount > 0 ? onClearData : undefined}
          disabled={receiptCount === 0}
          danger
        />
      </section>

      <section className="divide-y divide-gray-100 overflow-hidden rounded-2xl bg-white dark:divide-gray-800 dark:bg-gray-900">
        <a
          href={`${import.meta.env.BASE_URL}privacy.html`}
          className="flex min-h-14 w-full items-center gap-3 px-4 py-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          <ShieldCheck className="h-5 w-5 shrink-0 text-gray-400" aria-hidden="true" />
          <span className="flex-1 font-semibold">{t.settings.privacy}</span>
          <ChevronRight className="h-4 w-4 text-gray-300" aria-hidden="true" />
        </a>
        <a
          href={`${import.meta.env.BASE_URL}terms.html`}
          className="flex min-h-14 w-full items-center gap-3 px-4 py-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          <FileText className="h-5 w-5 shrink-0 text-gray-400" aria-hidden="true" />
          <span className="flex-1 font-semibold">{t.settings.terms}</span>
          <ChevronRight className="h-4 w-4 text-gray-300" aria-hidden="true" />
        </a>
      </section>

      <p className="mt-6 text-center text-xs text-gray-400 dark:text-gray-500">
        {t.settings.offlineNote}
      </p>
    </div>
  );
};
