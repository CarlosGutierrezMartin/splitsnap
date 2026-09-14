import { useCallback, useEffect, useState } from 'react';
import type { ItemInstance, ParsedItem, Receipt } from '../types';
import { createItemStates, removeParticipantClaims } from '../lib/split';
import { deleteReceipt, listReceipts, saveReceipt } from '../storage/db';

/**
 * Estado del ticket activo y del historial.
 *
 * Sustituye a los antiguos useAuth + useSession: no hay usuarios, ni codigos
 * de union, ni suscripciones en tiempo real. Todo vive en este dispositivo,
 * asi que el guardado es un simple "escribe cuando cambie".
 */

function newId(prefix: string): string {
  // crypto.randomUUID no existe en contextos no seguros (http:// en LAN),
  // que es justo como se prueba la app desde el movil antes de desplegarla.
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${random}`;
}

export function useReceipt() {
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [history, setHistory] = useState<Receipt[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const refreshHistory = useCallback(async () => {
    setLoadingHistory(true);
    setHistory(await listReceipts());
    setLoadingHistory(false);
  }, []);

  useEffect(() => {
    void refreshHistory();
  }, [refreshHistory]);

  /**
   * Persiste cada cambio del ticket activo.
   *
   * Sin debounce a proposito: los cambios los genera un dedo tocando la
   * pantalla, no un bucle, y una escritura perdida significa un reparto
   * perdido si la persona cierra la app.
   */
  useEffect(() => {
    if (!receipt) return;
    void saveReceipt(receipt);
  }, [receipt]);

  const update = useCallback((mutate: (current: Receipt) => Receipt) => {
    setReceipt((current) => {
      if (!current) return current;
      const next = mutate(current);
      return next === current ? current : { ...next, updatedAt: Date.now() };
    });
  }, []);

  /** Crea un ticket a partir de lo que ha leido el OCR. */
  const createReceipt = useCallback(
    (
      items: ParsedItem[],
      options: {
        name?: string;
        detectedTotal?: number | null;
        thumbnail?: string;
        skewDegrees?: number;
      } = {},
    ) => {
      const now = Date.now();
      const created: Receipt = {
        id: newId('receipt'),
        name: options.name?.trim() || defaultReceiptName(),
        items,
        participants: [],
        itemStates: createItemStates(items),
        detectedTotal: options.detectedTotal ?? null,
        createdAt: now,
        updatedAt: now,
        ...(options.thumbnail ? { thumbnail: options.thumbnail } : {}),
        ...(options.skewDegrees ? { skewDegrees: options.skewDegrees } : {}),
      };
      setReceipt(created);
      return created;
    },
    [],
  );

  const openReceipt = useCallback((target: Receipt) => setReceipt(target), []);
  const closeReceipt = useCallback(() => {
    setReceipt(null);
    void refreshHistory();
  }, [refreshHistory]);

  const rename = useCallback((name: string) => update((current) => ({ ...current, name })), [update]);

  /**
   * Reemplaza la lista de articulos tras la revision manual.
   * Se regenera el reparto porque las unidades pueden haber cambiado.
   */
  const replaceItems = useCallback(
    (items: ParsedItem[]) =>
      update((current) => ({ ...current, items, itemStates: createItemStates(items) })),
    [update],
  );

  const addParticipant = useCallback(
    (name: string) =>
      update((current) => ({
        ...current,
        participants: [
          ...current.participants,
          { id: newId('p'), name: name.trim(), colorSeed: current.participants.length },
        ],
      })),
    [update],
  );

  const renameParticipant = useCallback(
    (participantId: string, name: string) =>
      update((current) => ({
        ...current,
        participants: current.participants.map((p) =>
          p.id === participantId ? { ...p, name: name.trim() } : p,
        ),
      })),
    [update],
  );

  /** Al borrar a alguien hay que liberar lo que tenia, o el dinero se evapora. */
  const removeParticipant = useCallback(
    (participantId: string) =>
      update((current) => ({
        ...current,
        participants: current.participants.filter((p) => p.id !== participantId),
        itemStates: removeParticipantClaims(current.itemStates, participantId),
      })),
    [update],
  );

  const updateItemStates = useCallback(
    (itemStates: Record<string, ItemInstance[]>) => update((current) => ({ ...current, itemStates })),
    [update],
  );

  /** Cambia una sola unidad, que es el 90% de las interacciones del reparto. */
  const updateInstance = useCallback(
    (itemId: string, instanceIndex: number, next: ItemInstance) =>
      update((current) => {
        const instances = current.itemStates[itemId];
        if (!instances?.[instanceIndex]) return current;
        const updated = [...instances];
        updated[instanceIndex] = next;
        return { ...current, itemStates: { ...current.itemStates, [itemId]: updated } };
      }),
    [update],
  );

  const discard = useCallback(
    async (receiptId: string) => {
      await deleteReceipt(receiptId);
      setHistory((current) => current.filter((r) => r.id !== receiptId));
      setReceipt((current) => (current?.id === receiptId ? null : current));
    },
    [],
  );

  return {
    receipt,
    history,
    loadingHistory,
    refreshHistory,
    createReceipt,
    openReceipt,
    closeReceipt,
    rename,
    replaceItems,
    addParticipant,
    renameParticipant,
    removeParticipant,
    updateItemStates,
    updateInstance,
    discard,
  };
}

function defaultReceiptName(): string {
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date());
}
