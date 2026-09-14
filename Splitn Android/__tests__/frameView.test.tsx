// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FrameView } from '../components/FrameView';
import { ThemeProvider } from '../contexts/ThemeContext';
import { LanguageProvider } from '../contexts/LanguageContext';

function renderFrame(onConfirm = vi.fn(), onCancel = vi.fn()) {
  const file = new File([new Uint8Array([1, 2, 3])], 'ticket.png', { type: 'image/png' });
  render(
    <ThemeProvider>
      <LanguageProvider>
        <FrameView file={file} onConfirm={onConfirm} onCancel={onCancel} />
      </LanguageProvider>
    </ThemeProvider>,
  );
  return { file, onConfirm, onCancel };
}

describe('pantalla de encuadre', () => {
  it('ofrece girar en ambos sentidos y deshacer', () => {
    renderFrame();
    expect(screen.getByRole('button', { name: /rotate left|girar a la izquierda/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /rotate right|girar a la derecha/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /undo|deshacer/i })).toBeTruthy();
  });

  it('el giro acumula y se ve en pantalla', () => {
    renderFrame();
    const derecha = screen.getByRole('button', { name: /rotate right|girar a la derecha/i });
    fireEvent.click(derecha);
    fireEvent.click(derecha);
    expect(screen.getByText('4°')).toBeTruthy();
  });

  it('gira también hacia el otro lado', () => {
    renderFrame();
    fireEvent.click(screen.getByRole('button', { name: /rotate left|girar a la izquierda/i }));
    expect(screen.getByText('-2°')).toBeTruthy();
  });

  it('deshacer devuelve el giro a cero', () => {
    renderFrame();
    fireEvent.click(screen.getByRole('button', { name: /rotate right|girar a la derecha/i }));
    fireEvent.click(screen.getByRole('button', { name: /undo|deshacer/i }));
    expect(screen.getByText('0°')).toBeTruthy();
  });

  it('las cuatro esquinas del recorte son manipulables', () => {
    renderFrame();
    expect(screen.getAllByRole('slider', { name: /crop corner|esquina del recorte/i })).toHaveLength(4);
  });

  it('confirmar entrega una imagen para leer', async () => {
    // En jsdom no hay canvas, así que applyCrop falla y se cae a la foto
    // original. Ese respaldo es justo lo que queremos comprobar: preferimos
    // leer algo peor a no leer nada.
    const { onConfirm, file } = renderFrame();
    fireEvent.click(screen.getByRole('button', { name: /read the receipt|leer el ticket/i }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(file));
  });

  it('cancelar no entrega nada', () => {
    const { onConfirm, onCancel } = renderFrame();
    fireEvent.click(screen.getByRole('button', { name: /cancel|cancelar/i }));
    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
