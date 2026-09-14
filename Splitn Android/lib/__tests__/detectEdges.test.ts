import { describe, it, expect } from 'vitest';
import { otsuThreshold, longestSpan, detectDocumentBounds } from '../detectEdges';

/** Lienzo en gris con un rectángulo claro dentro, como un ticket sobre mesa. */
function scene(
  width: number, height: number,
  paper: { x: number; y: number; w: number; h: number },
  fondo = 70, papel = 230,
): Uint8Array {
  const gray = new Uint8Array(width * height).fill(fondo);
  for (let y = paper.y; y < paper.y + paper.h; y++) {
    for (let x = paper.x; x < paper.x + paper.w; x++) gray[y * width + x] = papel;
  }
  return gray;
}

describe('otsuThreshold', () => {
  it('encuentra el corte entre lo claro y lo oscuro', () => {
    const gray = new Uint8Array([10, 12, 15, 200, 210, 220]);
    // El umbral separa por encima: con este corte, lo claro es {200,210,220}.
    const t = otsuThreshold(gray);
    expect(t).toBeGreaterThanOrEqual(15);
    expect(t).toBeLessThan(200);
  });

  it('no revienta con una imagen de un solo tono', () => {
    expect(() => otsuThreshold(new Uint8Array(100).fill(128))).not.toThrow();
  });
});

describe('longestSpan', () => {
  it('encuentra el tramo que supera la cobertura', () => {
    expect(longestSpan(new Float32Array([0, 0, 1, 1, 1, 0]), 0.5)).toEqual([2, 5]);
  });

  it('se queda con el tramo más largo, no con el primero', () => {
    // Un reflejo suelto en la mesa no puede mandar sobre el papel entero.
    expect(longestSpan(new Float32Array([1, 0, 1, 1, 1, 1, 0]), 0.5)).toEqual([2, 6]);
  });

  it('devuelve null si nada supera la cobertura', () => {
    expect(longestSpan(new Float32Array([0, 0.1, 0.2]), 0.5)).toBeNull();
  });
});

describe('detectDocumentBounds', () => {
  it('encuentra un ticket centrado sobre la mesa', () => {
    const crop = detectDocumentBounds(scene(100, 100, { x: 25, y: 20, w: 50, h: 60 }), 100, 100);
    expect(crop).not.toBeNull();
    expect(crop!.x).toBeCloseTo(0.25, 1);
    expect(crop!.y).toBeCloseTo(0.20, 1);
    expect(crop!.width).toBeCloseTo(0.50, 1);
    expect(crop!.height).toBeCloseTo(0.60, 1);
  });

  it('encuentra un ticket estrecho, que es el caso normal', () => {
    // Un ticket de bar ocupa una franja estrecha. Con una cobertura absoluta
    // del 50% del ancho no se detectaria jamas.
    const crop = detectDocumentBounds(scene(100, 100, { x: 5, y: 30, w: 40, h: 55 }), 100, 100);
    expect(crop!.x).toBeCloseTo(0.05, 1);
    expect(crop!.width).toBeCloseTo(0.40, 1);
  });

  it('no se deja llevar por un reflejo suelto en el fondo', () => {
    const gray = scene(100, 100, { x: 30, y: 25, w: 40, h: 50 });
    // Un brillo pequeño en la esquina opuesta.
    for (let y = 90; y < 95; y++) for (let x = 90; x < 95; x++) gray[y * 100 + x] = 240;
    const crop = detectDocumentBounds(gray, 100, 100);
    expect(crop!.x + crop!.width).toBeLessThan(0.8);
  });

  it('no propone nada si el papel ocupa casi toda la foto', () => {
    // Recortar ahí no aportaría nada, y proponerlo parecería inteligencia
    // que no existe.
    expect(detectDocumentBounds(scene(100, 100, { x: 0, y: 0, w: 100, h: 100 }), 100, 100)).toBeNull();
  });

  it('no propone nada si la mancha es minúscula', () => {
    expect(detectDocumentBounds(scene(100, 100, { x: 40, y: 40, w: 8, h: 8 }), 100, 100)).toBeNull();
  });

  it('no propone nada con una imagen plana', () => {
    expect(detectDocumentBounds(new Uint8Array(10_000).fill(128), 100, 100)).toBeNull();
  });

  it('rechaza entradas incoherentes sin lanzar', () => {
    expect(detectDocumentBounds(new Uint8Array(10), 100, 100)).toBeNull();
    expect(detectDocumentBounds(new Uint8Array(4), 2, 2)).toBeNull();
  });
});

describe('ticket con texto dentro, que es el caso real', () => {
  /** Papel claro con líneas de texto oscuras, como un ticket de verdad. */
  function conTexto(): Uint8Array {
    const w = 100, h = 140;
    const gray = new Uint8Array(w * h).fill(70);
    for (let y = 20; y < 120; y++) {
      for (let x = 25; x < 75; x++) gray[y * w + x] = 235;
    }
    // Líneas de texto: ocupan la mayor parte del ancho del papel.
    for (let y = 24; y < 116; y += 6) {
      for (let x = 30; x < 70; x++) { gray[y * w + x] = 40; gray[(y + 1) * w + x] = 40; }
    }
    return gray;
  }

  it('encuentra el papel aunque esté lleno de texto oscuro', () => {
    // Contando píxeles claros, las filas con texto no llegan al umbral y el
    // ticket se detectaba partido o no se detectaba. Midiendo la extensión
    // del papel, el texto de dentro da igual.
    const crop = detectDocumentBounds(conTexto(), 100, 140);
    expect(crop).not.toBeNull();
    expect(crop!.x).toBeCloseTo(0.25, 1);
    expect(crop!.width).toBeCloseTo(0.50, 1);
    expect(crop!.y).toBeCloseTo(0.14, 1);
    expect(crop!.height).toBeCloseTo(0.71, 1);
  });
});
