// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { prefetchWithProgress, formatMegabytes } from '../modelLoader';

/** Respuesta falsa que entrega el cuerpo en trozos, como haría la red. */
function streamedResponse(chunks: number[], contentLength?: number): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const size of chunks) controller.enqueue(new Uint8Array(size));
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: contentLength !== undefined ? { 'content-length': String(contentLength) } : {},
  });
}

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
beforeEach(() => vi.restoreAllMocks());

describe('prefetchWithProgress', () => {
  it('informa del avance según llegan los trozos', async () => {
    globalThis.fetch = vi.fn(async (_url, init?: RequestInit) =>
      init?.method === 'HEAD'
        ? new Response(null, { headers: { 'content-length': '300' } })
        : streamedResponse([100, 100, 100], 300),
    ) as typeof fetch;

    const avances: number[] = [];
    const ok = await prefetchWithProgress(['/models/a.tar'], (p) => avances.push(p.loaded));

    expect(ok).toBe(true);
    expect(avances).toContain(100);
    expect(avances).toContain(200);
    expect(avances[avances.length - 1]).toBe(300);
  });

  it('suma el tamaño de todos los ficheros para dar un total', async () => {
    globalThis.fetch = vi.fn(async (_url, init?: RequestInit) =>
      init?.method === 'HEAD'
        ? new Response(null, { headers: { 'content-length': '250' } })
        : streamedResponse([250], 250),
    ) as typeof fetch;

    let total = 0;
    await prefetchWithProgress(['/a.tar', '/b.tar'], (p) => { total = p.total; });
    expect(total).toBe(500);
  });

  it('sigue informando aunque el servidor no diga el tamaño', async () => {
    // Sin content-length no hay porcentaje, pero los MB descargados sí son
    // información real y la vista los enseña.
    globalThis.fetch = vi.fn(async (_url, init?: RequestInit) =>
      init?.method === 'HEAD' ? new Response(null) : streamedResponse([50, 50]),
    ) as typeof fetch;

    const avances: Array<{ loaded: number; total: number }> = [];
    await prefetchWithProgress(['/a.tar'], (p) => avances.push({ ...p }));

    expect(avances.some((p) => p.loaded === 100)).toBe(true);
    expect(avances.every((p) => p.total === 0)).toBe(true);
  });

  it('devuelve false si la descarga falla, sin lanzar', async () => {
    // Que falle la medición no puede impedir que el SDK lo intente por su
    // cuenta: se pierde la barra, no la funcionalidad.
    globalThis.fetch = vi.fn(async () => { throw new Error('sin red'); }) as typeof fetch;
    await expect(prefetchWithProgress(['/a.tar'], () => {})).resolves.toBe(false);
  });

  it('devuelve false ante un error del servidor', async () => {
    globalThis.fetch = vi.fn(async (_url, init?: RequestInit) =>
      init?.method === 'HEAD' ? new Response(null) : new Response('no', { status: 404 }),
    ) as typeof fetch;
    await expect(prefetchWithProgress(['/a.tar'], () => {})).resolves.toBe(false);
  });
});

describe('formatMegabytes', () => {
  it('formatea bytes como MB con un decimal', () => {
    expect(formatMegabytes(20_500_000)).toBe('19.6');
    expect(formatMegabytes(0)).toBe('0.0');
  });
});
