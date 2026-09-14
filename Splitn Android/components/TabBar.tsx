import React from 'react';
import { Home, Camera, Settings } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export type Tab = 'home' | 'scan' | 'settings';

interface TabBarProps {
  active: Tab;
  onChange: (tab: Tab) => void;
}

/**
 * Barra inferior de pestañas.
 *
 * Antes la app era una sola columna sin sitios a los que ir: se entraba, se
 * escaneaba y se salia. Las pestañas le dan forma de aplicacion y, sobre
 * todo, un lugar donde vivan los ajustes y el diagnostico.
 */
export const TabBar: React.FC<TabBarProps> = ({ active, onChange }) => {
  const { t } = useLanguage();

  const tabs: Array<{ id: Tab; icon: typeof Home; label: string }> = [
    { id: 'home', icon: Home, label: t.tabs.home },
    { id: 'scan', icon: Camera, label: t.tabs.scan },
    { id: 'settings', icon: Settings, label: t.tabs.settings },
  ];

  return (
    <nav
      aria-label={t.tabs.label}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-canvas/95 backdrop-blur"
    >
      {/* El padding inferior respeta la barra de gestos del movil. */}
      <ul className="mx-auto flex max-w-xl" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {tabs.map(({ id, icon: Icon, label }) => {
          const current = active === id;
          return (
            <li key={id} className="flex-1">
              <button
                type="button"
                onClick={() => onChange(id)}
                aria-current={current ? 'page' : undefined}
                className={`flex min-h-14 w-full flex-col items-center justify-center gap-0.5 transition-colors ${
                  current ? 'text-primary' : 'text-faint hover:text-ink'
                }`}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                <span className="text-[11px] font-semibold">{label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
