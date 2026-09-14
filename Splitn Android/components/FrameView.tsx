import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RotateCcw, RotateCw, Check, X, Maximize, Sparkles } from 'lucide-react';
import { Button } from './Button';
import { useLanguage } from '../contexts/LanguageContext';
import { applyCrop, FULL_CROP, rotatedBounds, type CropRect } from '../lib/imageCrop';
import { detectDocumentInImage } from '../lib/detectEdges';

interface FrameViewProps {
  file: File;
  onConfirm: (framed: Blob) => void;
  onCancel: () => void;
}

/** Esquinas arrastrables del marco. */
type Handle = 'nw' | 'ne' | 'sw' | 'se';

/** Lado minimo del recorte, en fraccion de la imagen. */
const MIN_SIZE = 0.1;

/** Giro fino en grados por toque. Los tickets salen torcidos, no del reves. */
const FINE_STEP = 2;

/**
 * Pantalla para ajustar la foto antes de leerla.
 *
 * Recortar al ticket multiplica la resolucion efectiva del detector, que
 * trabaja a 960 px de lado: si el ticket ocupa el 40% de la foto, el 60% de
 * esos pixeles se gasta en mantel. Enderezar evita que las filas se partan al
 * agruparlas por coordenada Y.
 */
export const FrameView: React.FC<FrameViewProps> = ({ file, onConfirm, onCancel }) => {
  const { t } = useLanguage();
  const [url, setUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState<CropRect>(FULL_CROP);
  const [degrees, setDegrees] = useState(0);
  const [working, setWorking] = useState(false);
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  // Recorte propuesto automaticamente. Se guarda aparte del actual para poder
  // volver a el despues de tocarlo a mano.
  const [suggested, setSuggested] = useState<CropRect | null>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ handle: Handle | 'move'; startX: number; startY: number; start: CropRect } | null>(null);

  /**
   * Se propone el recorte del papel nada mas abrir.
   *
   * Es una propuesta, no una imposicion: se aplica sola porque acertar es lo
   * habitual y ahorra el trabajo, pero queda el boton de deshacer para volver
   * a la foto entera de un toque.
   */
  useEffect(() => {
    let cancelled = false;
    void detectDocumentInImage(file).then((detected) => {
      if (cancelled || !detected) return;
      setSuggested(detected);
      setCrop(detected);
    });
    return () => { cancelled = true; };
  }, [file]);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    // Liberar el objeto es obligatorio: una foto de movil son decenas de MB
    // retenidos hasta que se revoque.
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  const onPointerMove = useCallback((event: PointerEvent) => {
    const drag = dragRef.current;
    const box = areaRef.current?.getBoundingClientRect();
    if (!drag || !box) return;

    const dx = (event.clientX - drag.startX) / box.width;
    const dy = (event.clientY - drag.startY) / box.height;
    const s = drag.start;

    setCrop(() => {
      if (drag.handle === 'move') {
        // Al mover, el marco conserva su tamaño y no se sale de la imagen.
        return {
          ...s,
          x: Math.max(0, Math.min(1 - s.width, s.x + dx)),
          y: Math.max(0, Math.min(1 - s.height, s.y + dy)),
        };
      }

      let { x, y, width, height } = s;
      if (drag.handle === 'nw' || drag.handle === 'sw') {
        const nx = Math.max(0, Math.min(s.x + s.width - MIN_SIZE, s.x + dx));
        width = s.x + s.width - nx;
        x = nx;
      } else {
        width = Math.max(MIN_SIZE, Math.min(1 - s.x, s.width + dx));
      }
      if (drag.handle === 'nw' || drag.handle === 'ne') {
        const ny = Math.max(0, Math.min(s.y + s.height - MIN_SIZE, s.y + dy));
        height = s.y + s.height - ny;
        y = ny;
      } else {
        height = Math.max(MIN_SIZE, Math.min(1 - s.y, s.height + dy));
      }
      return { x, y, width, height };
    });
  }, []);

  const endDrag = useCallback(() => {
    dragRef.current = null;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', endDrag);
  }, [onPointerMove]);

  const startDrag = (handle: Handle | 'move') => (event: React.PointerEvent) => {
    event.preventDefault();
    dragRef.current = { handle, startX: event.clientX, startY: event.clientY, start: crop };
    // Los listeners van en window para que arrastrar fuera del marco siga
    // funcionando: en un movil el dedo se sale constantemente.
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', endDrag);
  };

  useEffect(() => endDrag, [endDrag]);

  const confirm = async (): Promise<void> => {
    setWorking(true);
    try {
      onConfirm(await applyCrop(file, crop, degrees));
    } catch {
      // Si el recorte falla se sigue con la foto original: mejor leer algo
      // peor que no leer nada.
      onConfirm(file);
    }
  };

  // La caja envolvente de la imagen rotada, con el mismo calculo que usa el
  // recorte. Es lo que mantiene alineado lo que se ve con lo que se recorta.
  const bounds = natural ? rotatedBounds(natural.width, natural.height, degrees) : null;

  const handleStyle = 'absolute h-11 w-11 touch-none';
  const corner = 'absolute h-6 w-6 border-primary';

  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-44 pt-3 animate-fade-in">
      <header className="mb-3 text-center">
        <h2 className="text-lg font-bold">{t.frame.title}</h2>
        <p className="mt-0.5 text-sm text-muted">
          {suggested ? t.frame.detected : t.frame.subtitle}
        </p>
      </header>

      {/* El area de vista tiene que coincidir EXACTAMENTE con lo que compone
          `applyCrop`: la imagen ya rotada, dentro de su caja envolvente. Una
          rotacion por CSS no cambia la caja de maquetacion, asi que sin esto
          el marco se dibujaria sobre una region distinta de la que se acaba
          recortando, y estarias recortando a ciegas.

          Tampoco se limita el alto: con aspect-ratio y ancho fijo, un
          max-height no encoge la caja, la recorta, y una zona recortada es
          una zona que el marco no puede alcanzar. Antes eso que esconder
          parte del ticket. */}
      <div className="flex justify-center">
        <div
          ref={areaRef}
          style={bounds ? { aspectRatio: `${bounds.width} / ${bounds.height}` } : undefined}
          className="relative w-full max-w-md touch-none select-none overflow-hidden rounded-card bg-gray-900"
        >
          {url && (
            <img
              src={url}
              alt={t.frame.title}
              draggable={false}
              onLoad={(e) => setNatural({
                width: e.currentTarget.naturalWidth,
                height: e.currentTarget.naturalHeight,
              })}
              style={{
                transform: `translate(-50%, -50%) rotate(${degrees}deg)`,
                width: bounds && natural ? `${(natural.width / bounds.width) * 100}%` : 'auto',
              }}
              className="absolute left-1/2 top-1/2 h-auto max-w-none"
            />
          )}

          {/* Zona oscurecida fuera del marco, para que se vea qué se conserva. */}
          <div
            className="absolute inset-0"
            style={{
              background: 'rgba(0,0,0,0.55)',
              clipPath: `polygon(0% 0%, 0% 100%, ${crop.x * 100}% 100%, ${crop.x * 100}% ${crop.y * 100}%, ${(crop.x + crop.width) * 100}% ${crop.y * 100}%, ${(crop.x + crop.width) * 100}% ${(crop.y + crop.height) * 100}%, ${crop.x * 100}% ${(crop.y + crop.height) * 100}%, ${crop.x * 100}% 100%, 100% 100%, 100% 0%)`,
            }}
          />

          <div
            onPointerDown={startDrag('move')}
            className="absolute cursor-move border-2 border-primary"
            style={{
              left: `${crop.x * 100}%`, top: `${crop.y * 100}%`,
              width: `${crop.width * 100}%`, height: `${crop.height * 100}%`,
            }}
          >
            {/* Areas tactiles de 44 px con la esquina dibujada dentro: el dedo
                necesita sitio, pero la marca visual debe quedar fina. */}
            {([
              ['nw', '-top-5 -left-5', 'top-3 left-3 border-t-4 border-l-4 rounded-tl'],
              ['ne', '-top-5 -right-5', 'top-3 right-3 border-t-4 border-r-4 rounded-tr'],
              ['sw', '-bottom-5 -left-5', 'bottom-3 left-3 border-b-4 border-l-4 rounded-bl'],
              ['se', '-bottom-5 -right-5', 'bottom-3 right-3 border-b-4 border-r-4 rounded-br'],
            ] as const).map(([handle, position, mark]) => (
              <div
                key={handle}
                role="slider"
                tabIndex={0}
                aria-label={t.frame.corner}
                aria-valuenow={Math.round(crop.width * 100)}
                aria-valuemin={10}
                aria-valuemax={100}
                onPointerDown={(e) => { e.stopPropagation(); startDrag(handle)(e); }}
                className={`${handleStyle} ${position}`}
              >
                <span className={`${corner} ${mark}`} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-center gap-2">
        <Button variant="outline" onClick={() => setDegrees((d) => d - FINE_STEP)} aria-label={t.frame.rotateLeft}>
          <RotateCcw className="h-5 w-5" aria-hidden="true" />
        </Button>
        <span className="min-w-16 text-center text-sm font-bold tabular-nums">{degrees}°</span>
        <Button variant="outline" onClick={() => setDegrees((d) => d + FINE_STEP)} aria-label={t.frame.rotateRight}>
          <RotateCw className="h-5 w-5" aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          onClick={() => { setCrop(FULL_CROP); setDegrees(0); }}
          aria-label={t.frame.reset}
        >
          <Maximize className="h-5 w-5" aria-hidden="true" />
        </Button>

        {suggested && (
          <Button
            variant="ghost"
            onClick={() => setCrop(suggested)}
            aria-label={t.frame.useSuggestion}
          >
            <Sparkles className="h-5 w-5" aria-hidden="true" />
          </Button>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-canvas/95 p-4 backdrop-blur">
        <div className="mx-auto flex max-w-xl gap-3">
          <Button variant="outline" onClick={onCancel} aria-label={t.common.cancel}>
            <X className="h-5 w-5" aria-hidden="true" />
          </Button>
          <Button fullWidth className="py-4 text-lg" onClick={confirm} disabled={working}>
            <Check className="h-5 w-5" aria-hidden="true" />
            {working ? t.frame.working : t.frame.confirm}
          </Button>
        </div>
      </div>
    </div>
  );
};
