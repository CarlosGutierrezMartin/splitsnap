import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function detectTheme(): Theme {
  try {
    const saved = localStorage.getItem('splitn:theme');
    if (saved === 'dark' || saved === 'light') return saved;
  } catch {
    // Sin almacenamiento se sigue la preferencia del sistema.
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(detectTheme);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem('splitn:theme', theme);
    } catch {
      // Ignorable: el tema se recalcula en el proximo arranque.
    }
  }, [theme]);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, toggleTheme: () => setTheme((current) => (current === 'dark' ? 'light' : 'dark')) }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme debe usarse dentro de ThemeProvider');
  return context;
}
