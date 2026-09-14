import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Receipt } from '../types';

/**
 * Historial de tickets en el propio dispositivo.
 *
 * IndexedDB y no localStorage porque guardamos miniaturas en base64 y el
 * limite de ~5 MB de localStorage se agotaria en pocos tickets.
 */

const DB_NAME = 'splitn';
const DB_VERSION = 1;
const STORE = 'receipts';

interface SplitnDB extends DBSchema {
  receipts: {
    key: string;
    value: Receipt;
    indexes: { 'by-updated': number };
  };
}

let dbPromise: Promise<IDBPDatabase<SplitnDB>> | null = null;

function getDb(): Promise<IDBPDatabase<SplitnDB>> {
  if (!dbPromise) {
    dbPromise = openDB<SplitnDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('by-updated', 'updatedAt');
      },
    });
  }
  return dbPromise;
}

/**
 * Todo el almacenamiento se envuelve en try/catch porque IndexedDB no esta
 * disponible en navegacion privada de algunos navegadores ni con las cookies
 * bloqueadas. Perder el historial es aceptable; que la app no arranque, no.
 */
async function safely<T>(operation: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await operation();
  } catch (err) {
    console.warn('almacenamiento no disponible:', err);
    return fallback;
  }
}

/** Tickets guardados, del mas reciente al mas antiguo. */
export async function listReceipts(): Promise<Receipt[]> {
  return safely(async () => {
    const db = await getDb();
    const all = await db.getAllFromIndex(STORE, 'by-updated');
    return all.reverse();
  }, []);
}

export async function getReceipt(id: string): Promise<Receipt | null> {
  return safely(async () => {
    const db = await getDb();
    return (await db.get(STORE, id)) ?? null;
  }, null);
}

export async function saveReceipt(receipt: Receipt): Promise<void> {
  await safely(async () => {
    const db = await getDb();
    await db.put(STORE, receipt);
  }, undefined);
}

export async function deleteReceipt(id: string): Promise<void> {
  await safely(async () => {
    const db = await getDb();
    await db.delete(STORE, id);
  }, undefined);
}
