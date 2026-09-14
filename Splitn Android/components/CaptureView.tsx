import React, { useRef, useState } from 'react';
import { Camera, Images, Lightbulb, ShieldCheck } from 'lucide-react';
import { Button } from './Button';
import { useLanguage } from '../contexts/LanguageContext';

interface CaptureViewProps {
  onSelect: (file: File) => void;
}

export const CaptureView: React.FC<CaptureViewProps> = ({ onSelect }) => {
  const { t } = useLanguage();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0];
    // Se filtra por tipo porque en escritorio se puede soltar cualquier cosa.
    if (file && file.type.startsWith('image/')) onSelect(file);
  };

  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-28 pt-6 animate-fade-in">
      <header className="mb-6 text-center">
        <h2 className="text-2xl font-black tracking-tight">{t.capture.title}</h2>
        <p className="mt-1 text-gray-500 dark:text-gray-400">{t.capture.subtitle}</p>
      </header>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={(e) => { e.preventDefault(); setDragging(false); }}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
        className={`mb-6 flex aspect-[4/5] w-full flex-col items-center justify-center rounded-3xl border-4 border-dashed transition-colors ${
          dragging
            ? 'border-primary bg-primary/5'
            : 'border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-900'
        }`}
      >
        <Camera className="mb-4 h-16 w-16 text-gray-300 dark:text-gray-600" aria-hidden="true" />
        <p className="px-8 text-center text-sm text-gray-400 dark:text-gray-500">
          {dragging ? t.capture.dropHere : t.capture.subtitle}
        </p>
      </div>

      {/* capture="environment" hace que Android e iOS abran la camara trasera
          directamente en vez del selector de ficheros. */}
      <input
        ref={cameraRef} type="file" accept="image/*" capture="environment"
        className="hidden" onChange={(e) => handleFiles(e.target.files)}
      />
      <input
        ref={galleryRef} type="file" accept="image/*"
        className="hidden" onChange={(e) => handleFiles(e.target.files)}
      />

      <div className="space-y-3">
        <Button fullWidth onClick={() => cameraRef.current?.click()} className="py-4 text-lg">
          <Camera className="h-5 w-5" aria-hidden="true" />
          {t.capture.takePhoto}
        </Button>
        <Button fullWidth variant="outline" onClick={() => galleryRef.current?.click()}>
          <Images className="h-5 w-5" aria-hidden="true" />
          {t.capture.chooseFile}
        </Button>
      </div>

      <section className="mt-8 rounded-2xl bg-white p-5 dark:bg-gray-900">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          <Lightbulb className="h-4 w-4" aria-hidden="true" />
          {t.capture.tips}
        </h3>
        <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
          {[t.capture.tipFlat, t.capture.tipLight, t.capture.tipFull].map((tip) => (
            <li key={tip} className="flex gap-2">
              <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              {tip}
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-gray-400 dark:text-gray-500">
        <ShieldCheck className="h-4 w-4" aria-hidden="true" />
        {t.capture.privacy}
      </p>
    </div>
  );
};
