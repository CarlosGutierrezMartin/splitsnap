import { describe, it, expect } from 'vitest';
import { rotatedBounds, cropToPixels, outputScale, FULL_CROP } from '../imageCrop';

describe('rotatedBounds', () => {
  it('no cambia el tamaño sin rotación', () => {
    expect(rotatedBounds(800, 600, 0)).toEqual({ width: 800, height: 600 });
  });

  it('intercambia los lados al girar un cuarto de vuelta', () => {
    expect(rotatedBounds(800, 600, 90)).toEqual({ width: 600, height: 800 });
  });

  it('crece al girar en diagonal', () => {
    // Un cuadrado girado 45° necesita un lienzo mayor para no recortarse.
    const b = rotatedBounds(100, 100, 45);
    expect(b.width).toBeCloseTo(141, 0);
    expect(b.height).toBeCloseTo(141, 0);
  });

  it('da el mismo tamaño girando a un lado o al otro', () => {
    expect(rotatedBounds(800, 600, 7)).toEqual(rotatedBounds(800, 600, -7));
  });
});

describe('cropToPixels', () => {
  it('convierte el recorte completo a la imagen entera', () => {
    expect(cropToPixels(FULL_CROP, 800, 600)).toEqual({ x: 0, y: 0, width: 800, height: 600 });
  });

  it('convierte un recorte parcial', () => {
    const area = cropToPixels({ x: 0.25, y: 0.5, width: 0.5, height: 0.25 }, 800, 600);
    expect(area).toEqual({ x: 200, y: 300, width: 400, height: 150 });
  });

  it('no deja que el recorte se salga de la imagen', () => {
    const area = cropToPixels({ x: 0.9, y: 0.9, width: 0.5, height: 0.5 }, 800, 600);
    expect(area.x + area.width).toBeLessThanOrEqual(800);
    expect(area.y + area.height).toBeLessThanOrEqual(600);
  });

  it('nunca devuelve un recorte de tamaño cero', () => {
    // Un lienzo de ancho cero haría que el navegador lanzara al dibujar.
    const area = cropToPixels({ x: 0, y: 0, width: 0, height: 0 }, 800, 600);
    expect(area.width).toBeGreaterThanOrEqual(1);
    expect(area.height).toBeGreaterThanOrEqual(1);
  });

  it('acota coordenadas fuera de rango sin salirse de la imagen', () => {
    const area = cropToPixels({ x: -0.5, y: 2, width: 1, height: 1 }, 800, 600);
    expect(area.x).toBe(0);
    expect(area.x + area.width).toBeLessThanOrEqual(800);
    expect(area.y + area.height).toBeLessThanOrEqual(600);
  });
});

describe('outputScale', () => {
  it('no escala lo que ya cabe', () => {
    expect(outputScale(1200, 900)).toBe(1);
  });

  it('reduce lo que se pasa del lado máximo', () => {
    // El preprocesado baja luego a 1600, así que más resolución solo gastaría
    // memoria, que es lo que tumbaba la pestaña.
    expect(outputScale(4000, 3000)).toBe(0.5);
  });

  it('mide por el lado más largo, sea cual sea', () => {
    expect(outputScale(3000, 4000)).toBe(0.5);
  });
});
