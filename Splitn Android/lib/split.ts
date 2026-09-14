import type { ItemInstance, ParsedItem, Participant, Receipt } from '../types';

/**
 * Aritmetica del reparto.
 *
 * Funciones puras a proposito: son la unica parte de la app donde un error
 * se traduce en que alguien pague de mas, asi que conviene poder testearlas
 * sin montar React ni IndexedDB.
 */

/** Crea el estado inicial: una unidad sin repartir por cada unidad comprada. */
export function createItemStates(items: ParsedItem[]): Record<string, ItemInstance[]> {
  const states: Record<string, ItemInstance[]> = {};
  for (const item of items) {
    const units = Math.max(1, Math.round(item.quantity));
    states[item.id] = Array.from({ length: units }, (_, instanceId) => ({
      instanceId,
      totalParts: 1,
      claims: {},
    }));
  }
  return states;
}

/** Partes ya reclamadas de una unidad. */
export function claimedParts(instance: ItemInstance): number {
  return Object.values(instance.claims).reduce((sum, parts) => sum + parts, 0);
}

/** Partes libres de una unidad. Nunca negativo. */
export function freeParts(instance: ItemInstance): number {
  return Math.max(0, instance.totalParts - claimedParts(instance));
}

/** Una unidad esta cubierta cuando no le quedan partes libres. */
export function isFullyClaimed(instance: ItemInstance): boolean {
  return freeParts(instance) === 0;
}

export interface Totals {
  /** Suma de todas las lineas del ticket. */
  bill: number;
  /** Parte del ticket que ya tiene dueno. */
  claimed: number;
  /** Parte sin asignar. */
  remaining: number;
  /** Cuanto debe cada participante. */
  perParticipant: Record<string, number>;
  /** Cuantas unidades toca cada participante, para el subtitulo de la ficha. */
  unitsPerParticipant: Record<string, number>;
  /** Porcentaje repartido, 0..100. */
  progress: number;
}

/** Calcula todos los totales de un ticket en una sola pasada. */
export function computeTotals(receipt: Receipt): Totals {
  const perParticipant: Record<string, number> = {};
  const unitsPerParticipant: Record<string, number> = {};
  for (const participant of receipt.participants) {
    perParticipant[participant.id] = 0;
    unitsPerParticipant[participant.id] = 0;
  }

  let bill = 0;
  let claimed = 0;

  for (const item of receipt.items) {
    bill += item.totalPrice;
    const instances = receipt.itemStates[item.id] ?? [];

    for (const instance of instances) {
      // Un denominador invalido haria que el coste se fuera a infinito y se
      // propagara a todos los totales, asi que se acota aqui.
      const parts = Math.max(1, instance.totalParts);

      for (const [participantId, claimedShare] of Object.entries(instance.claims)) {
        const cost = (item.unitPrice / parts) * claimedShare;
        claimed += cost;
        // Un reparto puede apuntar a alguien ya borrado: su coste sigue
        // contando como asignado, pero no hay a quien sumarselo.
        const current = perParticipant[participantId];
        if (current !== undefined) {
          perParticipant[participantId] = current + cost;
          unitsPerParticipant[participantId] = (unitsPerParticipant[participantId] ?? 0) + claimedShare / parts;
        }
      }
    }
  }

  const round = (value: number) => Math.round(value * 100) / 100;
  for (const [id, value] of Object.entries(perParticipant)) perParticipant[id] = round(value);

  bill = round(bill);
  claimed = round(claimed);

  return {
    bill,
    claimed,
    remaining: round(bill - claimed),
    perParticipant,
    unitsPerParticipant,
    // Un ticket vacio daria 0/0 = NaN y romperia el ancho de la barra.
    progress: bill > 0 ? Math.min(100, (claimed / bill) * 100) : 0,
  };
}

/**
 * Reclama o suelta una parte de una unidad para un participante.
 *
 * Un solo gesto alterna entre los dos estados: si ya tengo parte, la suelto;
 * si no y queda sitio, la cojo.
 */
export function togglePart(
  instance: ItemInstance,
  participantId: string,
): ItemInstance {
  const mine = instance.claims[participantId] ?? 0;
  const claims = { ...instance.claims };

  if (mine > 0) {
    if (mine === 1) delete claims[participantId];
    else claims[participantId] = mine - 1;
  } else if (freeParts(instance) > 0) {
    claims[participantId] = 1;
  } else {
    return instance;
  }

  return { ...instance, claims };
}

/**
 * Cambia en cuantas partes se divide una unidad.
 *
 * Los repartos previos se descartan: mantenerlos produciria fracciones sin
 * sentido como "2 partes de 1". A cambio, quien parte se queda una parte,
 * que es lo que quiere el 99% de las veces.
 */
export function setInstanceParts(
  instance: ItemInstance,
  parts: number,
  participantId: string,
): ItemInstance {
  const totalParts = Math.max(1, Math.min(12, Math.round(parts)));
  return { ...instance, totalParts, claims: { [participantId]: 1 } };
}

/** Asigna la unidad entera a un participante, descartando repartos previos. */
export function takeWholeUnit(instance: ItemInstance, participantId: string): ItemInstance {
  return { ...instance, totalParts: 1, claims: { [participantId]: 1 } };
}

/** Reparte todas las unidades sin asignar a partes iguales entre todos. */
export function splitRemainderEvenly(receipt: Receipt): Record<string, ItemInstance[]> {
  const participants = receipt.participants;
  if (participants.length === 0) return receipt.itemStates;

  const next: Record<string, ItemInstance[]> = {};
  for (const [itemId, instances] of Object.entries(receipt.itemStates)) {
    next[itemId] = instances.map((instance) => {
      if (claimedParts(instance) > 0) return instance;
      return {
        ...instance,
        totalParts: participants.length,
        claims: Object.fromEntries(participants.map((p) => [p.id, 1])),
      };
    });
  }
  return next;
}

/** Quita a un participante de todo el ticket, liberando lo que tenia. */
export function removeParticipantClaims(
  itemStates: Record<string, ItemInstance[]>,
  participantId: string,
): Record<string, ItemInstance[]> {
  const next: Record<string, ItemInstance[]> = {};
  for (const [itemId, instances] of Object.entries(itemStates)) {
    next[itemId] = instances.map((instance) => {
      if (instance.claims[participantId] === undefined) return instance;
      const claims = { ...instance.claims };
      delete claims[participantId];
      return { ...instance, claims };
    });
  }
  return next;
}

/** Desglose de lo que le toca a una persona, para compartir el resumen. */
export interface ParticipantBreakdown {
  participant: Participant;
  lines: Array<{ name: string; share: number; cost: number }>;
  total: number;
}

export function breakdownFor(receipt: Receipt, participant: Participant): ParticipantBreakdown {
  const lines: ParticipantBreakdown['lines'] = [];
  let total = 0;

  for (const item of receipt.items) {
    let share = 0;
    let cost = 0;

    for (const instance of receipt.itemStates[item.id] ?? []) {
      const claimedShare = instance.claims[participant.id];
      if (!claimedShare) continue;
      const parts = Math.max(1, instance.totalParts);
      share += claimedShare / parts;
      cost += (item.unitPrice / parts) * claimedShare;
    }

    if (share > 0) {
      const rounded = Math.round(cost * 100) / 100;
      lines.push({ name: item.name, share, cost: rounded });
      total += rounded;
    }
  }

  return { participant, lines, total: Math.round(total * 100) / 100 };
}
