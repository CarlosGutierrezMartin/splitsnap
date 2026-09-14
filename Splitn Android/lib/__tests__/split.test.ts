import { describe, it, expect } from 'vitest';
import {
  createItemStates, computeTotals, togglePart, setInstanceParts, takeWholeUnit,
  splitRemainderEvenly, removeParticipantClaims, breakdownFor, freeParts, isFullyClaimed,
  MAX_PARTS,
} from '../split';
import type { ParsedItem, Participant, Receipt } from '../../types';

const ana: Participant = { id: 'p1', name: 'Ana', colorSeed: 0 };
const luis: Participant = { id: 'p2', name: 'Luis', colorSeed: 1 };

function item(id: string, name: string, quantity: number, unitPrice: number): ParsedItem {
  return { id, name, quantity, unitPrice, totalPrice: quantity * unitPrice };
}

function receipt(items: ParsedItem[], participants: Participant[] = [ana, luis]): Receipt {
  return {
    id: 'r1', name: 'Cena', items, participants,
    itemStates: createItemStates(items),
    detectedTotal: null, createdAt: 0, updatedAt: 0,
  };
}

describe('createItemStates', () => {
  it('crea una unidad independiente por cada unidad comprada', () => {
    const states = createItemStates([item('i1', 'Cerveza', 3, 2.5)]);
    expect(states['i1']).toHaveLength(3);
    expect(states['i1']![0]).toEqual({ instanceId: 0, totalParts: 1, claims: {} });
  });

  it('garantiza al menos una unidad aunque la cantidad sea cero', () => {
    expect(createItemStates([item('i1', 'Raro', 0, 5)])['i1']).toHaveLength(1);
  });
});

describe('computeTotals', () => {
  it('suma el ticket completo', () => {
    expect(computeTotals(receipt([item('i1', 'Cerveza', 2, 2.5)])).bill).toBe(5);
  });

  it('no devuelve NaN con un ticket vacio', () => {
    const totals = computeTotals(receipt([]));
    expect(totals.progress).toBe(0);
    expect(totals.bill).toBe(0);
  });

  it('reparte el coste de una unidad partida', () => {
    const base = receipt([item('i1', 'Pizza', 1, 10)]);
    base.itemStates['i1']![0] = { instanceId: 0, totalParts: 2, claims: { p1: 1, p2: 1 } };

    const totals = computeTotals(base);
    expect(totals.perParticipant['p1']).toBe(5);
    expect(totals.perParticipant['p2']).toBe(5);
    expect(totals.remaining).toBe(0);
    expect(totals.progress).toBe(100);
  });

  it('permite que una persona coja varias partes de la misma unidad', () => {
    const base = receipt([item('i1', 'Paella', 1, 12)]);
    base.itemStates['i1']![0] = { instanceId: 0, totalParts: 3, claims: { p1: 2, p2: 1 } };

    const totals = computeTotals(base);
    expect(totals.perParticipant['p1']).toBe(8);
    expect(totals.perParticipant['p2']).toBe(4);
  });

  it('mezcla unidades enteras y partidas del mismo articulo', () => {
    const base = receipt([item('i1', 'Cafe', 3, 1.2)]);
    base.itemStates['i1']![0] = { instanceId: 0, totalParts: 1, claims: { p1: 1 } };
    base.itemStates['i1']![1] = { instanceId: 1, totalParts: 2, claims: { p1: 1, p2: 1 } };

    const totals = computeTotals(base);
    expect(totals.perParticipant['p1']).toBe(1.8);
    expect(totals.perParticipant['p2']).toBe(0.6);
    expect(totals.remaining).toBe(1.2);
  });

  it('ignora repartos de participantes ya borrados', () => {
    const base = receipt([item('i1', 'Agua', 1, 2)], [ana]);
    base.itemStates['i1']![0] = { instanceId: 0, totalParts: 1, claims: { fantasma: 1 } };
    expect(computeTotals(base).perParticipant['p1']).toBe(0);
  });
});

describe('togglePart', () => {
  it('reclama una parte libre', () => {
    const result = togglePart({ instanceId: 0, totalParts: 1, claims: {} }, 'p1');
    expect(result.claims).toEqual({ p1: 1 });
  });

  it('suelta la parte si ya la tenia', () => {
    const result = togglePart({ instanceId: 0, totalParts: 1, claims: { p1: 1 } }, 'p1');
    expect(result.claims).toEqual({});
  });

  it('no reclama nada si la unidad esta llena', () => {
    const full = { instanceId: 0, totalParts: 1, claims: { p2: 1 } };
    expect(togglePart(full, 'p1')).toBe(full);
  });

  it('devuelve una copia en lugar de mutar', () => {
    const original = { instanceId: 0, totalParts: 1, claims: {} };
    expect(togglePart(original, 'p1')).not.toBe(original);
    expect(original.claims).toEqual({});
  });
});

describe('setInstanceParts', () => {
  it('parte la unidad y deja una parte a quien la parte', () => {
    const result = setInstanceParts({ instanceId: 0, totalParts: 1, claims: {} }, 4, 'p1');
    expect(result).toMatchObject({ totalParts: 4, claims: { p1: 1 } });
  });

  it('acota el denominador a un rango razonable', () => {
    expect(setInstanceParts({ instanceId: 0, totalParts: 1, claims: {} }, 0, 'p1').totalParts).toBe(1);
    expect(setInstanceParts({ instanceId: 0, totalParts: 1, claims: {} }, MAX_PARTS + 50, 'p1').totalParts)
      .toBe(MAX_PARTS);
  });
});

describe('takeWholeUnit', () => {
  it('deja la unidad entera para una persona', () => {
    const result = takeWholeUnit({ instanceId: 0, totalParts: 3, claims: { p2: 2 } }, 'p1');
    expect(result).toMatchObject({ totalParts: 1, claims: { p1: 1 } });
  });
});

describe('freeParts / isFullyClaimed', () => {
  it('cuenta las partes libres', () => {
    expect(freeParts({ instanceId: 0, totalParts: 3, claims: { p1: 1 } })).toBe(2);
  });

  it('nunca devuelve partes libres negativas', () => {
    expect(freeParts({ instanceId: 0, totalParts: 1, claims: { p1: 5 } })).toBe(0);
  });

  it('detecta la unidad completa', () => {
    expect(isFullyClaimed({ instanceId: 0, totalParts: 2, claims: { p1: 2 } })).toBe(true);
  });
});

describe('splitRemainderEvenly', () => {
  it('reparte a partes iguales solo lo que nadie ha cogido', () => {
    const base = receipt([item('i1', 'Nachos', 2, 6)]);
    base.itemStates['i1']![0] = { instanceId: 0, totalParts: 1, claims: { p1: 1 } };

    const next = splitRemainderEvenly(base);
    expect(next['i1']![0]!.claims).toEqual({ p1: 1 });
    expect(next['i1']![1]).toMatchObject({ totalParts: 2, claims: { p1: 1, p2: 1 } });
  });

  it('no hace nada si no hay participantes', () => {
    const base = receipt([item('i1', 'Nachos', 1, 6)], []);
    expect(splitRemainderEvenly(base)).toBe(base.itemStates);
  });
});

describe('removeParticipantClaims', () => {
  it('libera todo lo que tenia esa persona', () => {
    const states = { i1: [{ instanceId: 0, totalParts: 2, claims: { p1: 1, p2: 1 } }] };
    const next = removeParticipantClaims(states, 'p1');
    expect(next['i1']![0]!.claims).toEqual({ p2: 1 });
  });
});

describe('breakdownFor', () => {
  it('detalla lo que le toca a cada persona', () => {
    const base = receipt([item('i1', 'Pizza', 1, 10), item('i2', 'Cerveza', 2, 2.5)]);
    base.itemStates['i1']![0] = { instanceId: 0, totalParts: 2, claims: { p1: 1, p2: 1 } };
    base.itemStates['i2']![0] = { instanceId: 0, totalParts: 1, claims: { p1: 1 } };

    const result = breakdownFor(base, ana);
    expect(result.total).toBe(7.5);
    expect(result.lines).toEqual([
      { name: 'Pizza', share: 0.5, cost: 5 },
      { name: 'Cerveza', share: 1, cost: 2.5 },
    ]);
  });

  it('omite los articulos que esa persona no ha tocado', () => {
    const base = receipt([item('i1', 'Pulpo', 1, 14)]);
    expect(breakdownFor(base, ana).lines).toEqual([]);
  });
});

describe('división en un número libre de partes', () => {
  it('acepta denominadores por encima de los atajos de la interfaz', () => {
    // Una tortilla entre 14: raro, pero legítimo. Antes se recortaba a 12.
    const result = setInstanceParts({ instanceId: 0, totalParts: 1, claims: {} }, 14, 'p1');
    expect(result.totalParts).toBe(14);
  });

  it('reparte bien el coste con un denominador grande', () => {
    const base = receipt([item('i1', 'Tarta', 1, 30)]);
    base.itemStates['i1']![0] = { instanceId: 0, totalParts: 20, claims: { p1: 3 } };
    expect(computeTotals(base).perParticipant['p1']).toBe(4.5);
  });

  it('sigue acotando los denominadores absurdos', () => {
    expect(setInstanceParts({ instanceId: 0, totalParts: 1, claims: {} }, 5000, 'p1').totalParts).toBe(99);
    expect(setInstanceParts({ instanceId: 0, totalParts: 1, claims: {} }, -3, 'p1').totalParts).toBe(1);
  });
});
