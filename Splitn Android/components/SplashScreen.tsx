import React, { useEffect, useRef, useState } from 'react';
import { ChevronRight, WifiOff } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface SplashScreenProps {
 onDone: () => void;
}

/** Instantes en los que aparece cada linea del ticket dibujado, en segundos. */
const LINE_DELAYS = [0.5, 0.85, 1.2, 1.55, 1.9];

/** Cuando arranca el desvanecido y cuanto dura, en milisegundos. */
const FADE_AT_MS = 3500;
const FADE_MS = 500;

/**
 * Presentacion de arranque.
 *
 * No es decoracion: en los dos segundos que tarda el navegador en montar la
 * app cuenta lo que hace (foto, lectura, reparto) y lo que la distingue, que
 * es que funciona sin conexion. Un toque la salta, porque a la decima vez ya
 * no aporta nada.
 */
export const SplashScreen: React.FC<SplashScreenProps> = ({ onDone }) => {
 const { t } = useLanguage();
 const [leaving, setLeaving] = useState(false);
  // onDone cambia de identidad en cada render del padre; guardarlo en una
  // ref evita que los temporizadores se reinicien por eso.
 const done = useRef(onDone);
 done.current = onDone;

 useEffect(() => {
 const fade = setTimeout(() => setLeaving(true), FADE_AT_MS);
 const finish = setTimeout(() => done.current(), FADE_AT_MS + FADE_MS);
 return () => { clearTimeout(fade); clearTimeout(finish); };
  }, []);

 return (
    <div
 role="button"
 tabIndex={0}
 aria-label={t.common.close}
 onClick={() => onDone()}
 onKeyDown={(e) => { if (e.key === 'Enter' || e.key ===' ') onDone(); }}
 className="fixed inset-0 z-[70] grid place-items-center bg-canvas transition-opacity duration-500"
 style={{ opacity: leaving ? 0 : 1 }}
    >
      <div className="flex w-72 flex-col items-center gap-7">
        <div className="splash-mark flex items-center gap-3">
          <img
 src={`${import.meta.env.BASE_URL}logo.png`}
 alt=""
 width={48}
 height={48}
 className="block rounded-control"
          />
          <span className="text-3xl font-black leading-none tracking-[-0.03em]">Splitn</span>
        </div>

        <svg viewBox="0 0 120 150" className="block h-35 w-28" aria-hidden="true">
          {/* El borde inferior dentado es lo que hace que se lea como un
 ticket de papel y no como una hoja cualquiera. */}
          <path
 d="M18 8 h84 a4 4 0 0 1 4 4 v126 l-11 -7 -11 7 -11 -7 -11 7 -11 -7 -11 7 -11 -7 v-119 a4 4 0 0 1 4 -4 z"
 fill="var(--color-surface)"
 stroke="var(--color-line)"
 strokeWidth="2"
          />

          {LINE_DELAYS.map((delay, i) => {
 const y = 34 + i * 18;
 const last = i === LINE_DELAYS.length - 1;
            // La ultima linea sale en verde: es el total, el momento en que
            // el ticket pasa de leido a repartible.
 const fill = last ? 'var(--color-secondary)' :'var(--color-primary)';
 const opacity = last ? 1 : 0.7;
 const style = { animationDelay: `${delay}s` };
 return (
              <g key={y}>
                <rect
 x="30" y={y} rx="3" height="7" width={i % 2 === 0 ? 44 : 32}
 fill={fill} opacity={opacity} className="splash-line" style={style}
                />
                <rect
 x="78" y={y} rx="3" height="7" width="16"
 fill={fill} opacity={opacity} className="splash-line" style={style}
                />
              </g>
            );
          })}

          <defs>
            <linearGradient id="splash-beam-grad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#2a7de1" stopOpacity="0" />
              <stop offset="50%" stopColor="#2a7de1" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#2a7de1" stopOpacity="0" />
            </linearGradient>
          </defs>
          <rect
 x="10" y="4" width="100" height="5" rx="2.5"
 fill="url(#splash-beam-grad)" className="splash-beam"
          />
        </svg>

        <div className="splash-rise flex flex-col items-center gap-2.5">
          <p className="flex items-center gap-2.5 text-[15px] font-semibold text-muted">
            <span>{t.splash.photo}</span>
            <ChevronRight className="h-3.5 w-3.5 text-ghost" strokeWidth={2.5} aria-hidden="true" />
            <span>{t.splash.read}</span>
            <ChevronRight className="h-3.5 w-3.5 text-ghost" strokeWidth={2.5} aria-hidden="true" />
            <span>{t.splash.split}</span>
          </p>
          <p className="flex items-center gap-1.5 text-[13px] text-faint">
            <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
            {t.splash.offline}
          </p>
        </div>
      </div>
    </div>
  );
};
