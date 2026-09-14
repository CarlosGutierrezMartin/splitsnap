import React from 'react';
import { motion } from 'framer-motion';

interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onAnimationStart' | 'onDragStart' | 'onDragEnd' | 'onDrag'> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  fullWidth?: boolean;
}

const VARIANTS: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-primary text-white hover:brightness-110 focus-visible:ring-primary shadow-lg shadow-primary/25',
  secondary: 'bg-secondary text-white hover:brightness-110 focus-visible:ring-secondary shadow-lg shadow-secondary/25',
  outline:
    'border-2 border-gray-300 text-gray-700 hover:bg-gray-50 focus-visible:ring-gray-400 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800',
  ghost: 'text-gray-600 hover:bg-gray-100 focus-visible:ring-gray-400 dark:text-gray-300 dark:hover:bg-gray-800',
  danger: 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500',
};

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  fullWidth = false,
  className = '',
  ...props
}) => (
  <motion.button
    whileTap={{ scale: 0.97 }}
    transition={{ type: 'spring', stiffness: 400, damping: 17 }}
    // min-h-11 mantiene el area tactil en el minimo recomendado de 44px.
    className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold transition-[filter,background-color,border-color] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-offset-gray-950 ${VARIANTS[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
    {...props}
  >
    {children}
  </motion.button>
);
