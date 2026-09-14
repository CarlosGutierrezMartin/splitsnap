/** Un articulo del ticket, tal y como se reparte. */
export interface ParsedItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  /**
   * Confianza del OCR, 0..1. Ausente cuando la linea la ha escrito la
   * persona a mano, que es justamente el caso de confianza total.
   */
  confidence?: number;
}

/** Alguien entre quien se reparte la cuenta. Vive solo en este dispositivo. */
export interface Participant {
  id: string;
  name: string;
  /** Color estable para el avatar, asignado al crearlo. */
  colorSeed: number;
}

/** Reparto de una unidad concreta: participante -> numero de partes. */
export type InstanceClaim = Record<string, number>;

/**
 * Una unidad individual de un articulo.
 *
 * Modelar cada unidad por separado es lo que permite decir "de los 3 cafes,
 * uno es mio entero y otro lo parto contigo": `totalParts` es el denominador
 * de esa unidad y `claims` reparte el numerador.
 */
export interface ItemInstance {
  instanceId: number;
  /** Denominador de la unidad. 1 = sin partir. */
  totalParts: number;
  claims: InstanceClaim;
}

/** Un ticket escaneado con su reparto. Se guarda en IndexedDB. */
export interface Receipt {
  id: string;
  name: string;
  items: ParsedItem[];
  participants: Participant[];
  /** itemId -> una entrada por unidad (longitud = item.quantity). */
  itemStates: Record<string, ItemInstance[]>;
  /** Total impreso en el ticket, para contrastar con la suma de lineas. */
  detectedTotal: number | null;
  createdAt: number;
  updatedAt: number;
  /** Miniatura en dataURL, para la lista del historial. */
  thumbnail?: string;
}

export enum AppState {
  HOME = 'HOME',
  CAPTURE = 'CAPTURE',
  SCANNING = 'SCANNING',
  REVIEW = 'REVIEW',
  SPLIT = 'SPLIT',
  ASSIGN = 'ASSIGN',
}
