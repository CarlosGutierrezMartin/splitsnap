import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, PencilLine, Users, ShieldCheck } from 'lucide-react';
import { Button } from './Button';
import { useLanguage } from '../contexts/LanguageContext';

interface OnboardingViewProps {
  onDone: () => void;
}

/**
 * Presentacion de tres pasos la primera vez.
 *
 * El tercero no es relleno: explicar que la foto no sale del movil es
 * justamente lo que diferencia esta app, y si no se cuenta nadie lo supone.
 */
export const OnboardingView: React.FC<OnboardingViewProps> = ({ onDone }) => {
  const { t } = useLanguage();
  const [step, setStep] = useState(0);

  const steps = [
    { icon: Camera, title: t.onboarding.scanTitle, body: t.onboarding.scanBody },
    { icon: PencilLine, title: t.onboarding.reviewTitle, body: t.onboarding.reviewBody },
    { icon: Users, title: t.onboarding.splitTitle, body: t.onboarding.splitBody },
  ];

  const current = steps[step]!;
  const Icon = current.icon;
  const last = step === steps.length - 1;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-between px-6 py-10">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col items-center"
          >
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10 text-primary">
              <Icon className="h-9 w-9" aria-hidden="true" />
            </div>
            <h2 className="mb-3 text-2xl font-black tracking-tight">{current.title}</h2>
            <p className="max-w-xs text-gray-500 dark:text-gray-400">{current.body}</p>
          </motion.div>
        </AnimatePresence>
      </div>

      <div>
        <div className="mb-6 flex justify-center gap-2" aria-hidden="true">
          {steps.map((_, i) => (
            <span
              key={i}
              className={`h-2 rounded-full transition-all ${
                i === step ? 'w-6 bg-primary' : 'w-2 bg-gray-300 dark:bg-gray-700'
              }`}
            />
          ))}
        </div>

        <p className="mb-4 flex items-center justify-center gap-2 text-center text-xs text-gray-400 dark:text-gray-500">
          <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
          {t.onboarding.privacy}
        </p>

        <Button fullWidth className="py-4 text-lg" onClick={() => (last ? onDone() : setStep(step + 1))}>
          {last ? t.onboarding.start : t.common.next}
        </Button>

        {!last && (
          <Button variant="ghost" fullWidth className="mt-2" onClick={onDone}>
            {t.onboarding.skip}
          </Button>
        )}
      </div>
    </div>
  );
};
