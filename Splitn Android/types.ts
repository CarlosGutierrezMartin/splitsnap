export interface ParsedItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface Participant {
  id: string;
  name: string;
  claimedBy?: string; // Firebase UID of user who claimed this participant
  // Claims are now stored centrally in the session to handle instance logic
}

export interface InstanceClaim {
  [userId: string]: number; // userId -> number of parts claimed
}

export interface ItemInstance {
  instanceId: number; // 0-indexed index of the unit (e.g., Steak 0, Steak 1)
  totalParts: number; // Denominator. Default 1.
  claims: InstanceClaim;
}

export interface ReceiptSession {
  id: string;
  name?: string; // User-defined session name
  items: ParsedItem[];
  participants: Participant[];
  // The core state: itemId -> Array of instances (length = item.quantity)
  itemStates: Record<string, ItemInstance[]>;
  createdAt: number;
  joinCode?: string; // Short code for joining
  status: 'active' | 'completed';
  ownerId?: string; // User ID of the creator (admin)
  guestIds?: string[]; // User IDs who have joined as guests
  lastActivityAt?: number; // Timestamp of last update for retention policy
}

export type FirestoreSession = Omit<ReceiptSession, 'createdAt' | 'lastActivityAt'> & {
  createdAt: any; // firebase.firestore.Timestamp
  lastActivityAt?: any; // firebase.firestore.Timestamp
};

export enum AppState {
  HOME = 'HOME',
  UPLOAD = 'UPLOAD',
  PROCESSING = 'PROCESSING',
  DASHBOARD = 'DASHBOARD',
  SPLIT_PARTICIPANT = 'SPLIT_PARTICIPANT',
}

export interface ProcessingError {
  message: string;
}

export interface SplitItem {
  id: string;
  name: string;
  unitPrice: number;
  claimedQuantity: number;
}