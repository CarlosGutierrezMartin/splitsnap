import { describe, it, expect } from 'vitest';
import { buildSummaryText } from '../share';
import { createItemStates } from '../split';
import type { Participant, Receipt } from '../../types';

const ana: Participant = { id: 'p1', name: 'Ana', colorSeed: 0 };
const luis: Participant = { id: 'p2', name: 'Luis', colorSeed: 1 };

function buildReceipt(): Receipt {
  const items = [
    { id: 'i1', name: 'Pizza', quantity: 1, unitPrice: 10, totalPrice: 10 },
    { id: 'i2', name: 'Cerveza', quantity: 2, unitPrice: 2.5, totalPrice: 5 },
  ];
  const receipt: Receipt = {
    id: 'r1', name: 'Cena del viernes', items, participants: [ana, luis],
    itemStates: createItemStates(items),
    detectedTotal: 15, createdAt: 0, updatedAt: 0,
  };
  receipt.itemStates['i1']![0] = { instanceId: 0, totalParts: 2, claims: { p1: 1, p2: 1 } };
  receipt.itemStates['i2']![0] = { instanceId: 0, totalParts: 1, claims: { p1: 1 } };
  return receipt;
}

describe('buildSummaryText', () => {
  it('incluye el nombre y el total del ticket', () => {
    const text = buildSummaryText(buildReceipt());
    expect(text).toContain('Cena del viernes');
    expect(text).toContain('15,00');
  });

  it('detalla el importe de cada participante', () => {
    const text = buildSummaryText(buildReceipt());
    expect(text).toMatch(/Ana: 7,50/);
    expect(text).toMatch(/Luis: 5,00/);
  });

  it('escribe las fracciones de forma legible', () => {
    // "1/2 Pizza" se entiende de un vistazo; "0.5x Pizza" no.
    expect(buildSummaryText(buildReceipt())).toContain('1/2 Pizza');
  });

  it('escribe las unidades enteras sin fraccion', () => {
    expect(buildSummaryText(buildReceipt())).toContain('1x Cerveza');
  });

  it('avisa de lo que queda sin asignar', () => {
    // Queda una cerveza de 2,50 sin dueno.
    expect(buildSummaryText(buildReceipt())).toContain('Sin asignar: 2,50');
  });

  it('no menciona lo pendiente cuando el ticket esta repartido entero', () => {
    const receipt = buildReceipt();
    receipt.itemStates['i2']![1] = { instanceId: 1, totalParts: 1, claims: { p2: 1 } };
    expect(buildSummaryText(receipt)).not.toContain('Sin asignar');
  });
});
