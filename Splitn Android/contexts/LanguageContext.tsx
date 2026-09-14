import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { en, es } from '../i18n/dict';
import type { Translations } from '../i18n/translations';

type Language = 'es' | 'en';

interface LanguageContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: Translations;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

/** Español por defecto, pero respetando el idioma del navegador si es inglés. */
function detectLanguage(): Language {
  try {
    const saved = localStorage.getItem('splitn:language');
    if (saved === 'es' || saved === 'en') return saved;
  } catch {
    // Modo incógnito o cookies bloqueadas: se usa la deteccion automatica.
  }
  return navigator.language?.toLowerCase().startsWith('en') ? 'en' : 'es';
}

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>(detectLanguage);

  useEffect(() => {
    document.documentElement.lang = language;
    try {
      localStorage.setItem('splitn:language', language);
    } catch {
      // Sin almacenamiento el idioma dura lo que la sesion. Aceptable.
    }
  }, [language]);

  const value = useMemo<LanguageContextValue>(
    () => ({ language, setLanguage, t: language === 'en' ? en : es }),
    [language],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage debe usarse dentro de LanguageProvider');
  return context;
}
