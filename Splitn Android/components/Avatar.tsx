import React, { useMemo } from 'react';

interface AvatarProps {
  name: string;
  /** Indice estable del participante: fija el color aunque se le renombre. */
  colorSeed?: number;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const GRADIENTS = [
  'from-rose-400 to-orange-400',
  'from-amber-400 to-yellow-400',
  'from-lime-400 to-emerald-400',
  'from-teal-400 to-cyan-400',
  'from-sky-400 to-blue-500',
  'from-indigo-400 to-violet-500',
  'from-fuchsia-400 to-pink-500',
  'from-slate-400 to-slate-600',
];

const SIZES = {
  // xs es el de la pila solapada del historial, donde solo hace falta
  // reconocer de un vistazo cuanta gente hay en cada ticket.
  xs: 'w-[26px] h-[26px] text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-11 h-11 text-sm',
  lg: 'w-14 h-14 text-lg',
};

export const Avatar: React.FC<AvatarProps> = ({ name, colorSeed, size = 'md', className = '' }) => {
  const initials = useMemo(() => {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    return parts.slice(0, 2).map((part) => part[0] ?? '').join('').toUpperCase();
  }, [name]);

  // Si hay indice se usa; si no, se deriva del nombre para que dos avatares
  // del mismo nombre salgan siempre iguales.
  const gradient = useMemo(() => {
    if (colorSeed !== undefined) return GRADIENTS[colorSeed % GRADIENTS.length]!;
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return GRADIENTS[Math.abs(hash) % GRADIENTS.length]!;
  }, [name, colorSeed]);

  return (
    <div
      aria-hidden="true"
      className={`${SIZES[size]} shrink-0 rounded-full bg-gradient-to-br ${gradient} flex select-none items-center justify-center font-bold text-white shadow-sm ${className}`}
    >
      {initials}
    </div>
  );
};
