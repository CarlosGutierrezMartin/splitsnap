import React from 'react';

interface ScanAnimationProps {
  /** Avance de 0 a 1. Si es null, la espera es indeterminada. */
  progress: number | null;
}

/**
 * Ticket dibujado con una linea de escaneo recorriendolo.
 *
 * Sustituye a la rueda girando, que para una descarga de 44 MB no dice nada:
 * no sabes si vas por el 5% o el 90%, ni si se ha colgado. Aqui el relleno
 * del ticket avanza con la descarga real, asi que la animacion ES la barra
 * de progreso, y ademas cuenta de que va la app.
 */
export const ScanAnimation: React.FC<ScanAnimationProps> = ({ progress }) => {
  const indeterminate = progress === null;
  const fill = indeterminate ? 0 : Math.max(0, Math.min(1, progress));

  return (
    <svg
      viewBox="0 0 120 150"
      className="h-40 w-32"
      role="img"
      aria-label="Preparando el lector de tickets"
    >
      <defs>
        {/* El recorte deja ver en color solo la parte ya descargada. */}
        <clipPath id="scan-fill">
          <rect x="0" y={150 - fill * 150} width="120" height={fill * 150} />
        </clipPath>
        <linearGradient id="scan-beam" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0" />
          <stop offset="50%" stopColor="var(--color-primary)" stopOpacity="0.9" />
          <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Silueta del ticket con el borde inferior dentado. */}
      <g>
        <path
          d="M18 8 h84 a4 4 0 0 1 4 4 v126 l-11 -7 -11 7 -11 -7 -11 7 -11 -7 -11 7 -11 -7 v-119 a4 4 0 0 1 4 -4 z"
          className="fill-surface stroke-line"
          strokeWidth="2"
        />
        {/* Lineas de texto simuladas. */}
        {[34, 52, 70, 88, 106].map((y, i) => (
          <rect
            key={y}
            x="30" y={y} rx="3" height="7"
            width={i % 2 === 0 ? 44 : 32}
            className="fill-ghost"
          />
        ))}
        {[34, 52, 70, 88, 106].map((y) => (
          <rect key={`p${y}`} x="78" y={y} rx="3" width="16" height="7" className="fill-ghost" />
        ))}
      </g>

      {/* La misma silueta en color, recortada a lo ya descargado. */}
      <g clipPath="url(#scan-fill)">
        <path
          d="M18 8 h84 a4 4 0 0 1 4 4 v126 l-11 -7 -11 7 -11 -7 -11 7 -11 -7 -11 7 -11 -7 v-119 a4 4 0 0 1 4 -4 z"
          className="fill-primary/10 stroke-primary"
          strokeWidth="2"
        />
        {[34, 52, 70, 88, 106].map((y, i) => (
          <rect key={y} x="30" y={y} rx="3" height="7" width={i % 2 === 0 ? 44 : 32} className="fill-primary/70" />
        ))}
        {[34, 52, 70, 88, 106].map((y) => (
          <rect key={`p${y}`} x="78" y={y} rx="3" width="16" height="7" className="fill-primary/70" />
        ))}
      </g>

      {/* Haz de escaneo: recorre el ticket en bucle mientras se descarga. */}
      <rect x="10" y="0" width="100" height="5" rx="2.5" fill="url(#scan-beam)" className="scan-beam" />
    </svg>
  );
};
