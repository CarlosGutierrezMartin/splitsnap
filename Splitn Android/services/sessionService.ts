import {
    collection,
    doc,
    setDoc,
    getDocs,
    query,
    where,
    orderBy,
    onSnapshot,
    updateDoc,
    arrayUnion,
    serverTimestamp,
    Timestamp,
    deleteDoc
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { ParsedItem, ReceiptSession, FirestoreSession, Participant, ItemInstance } from '../types';

const SESSIONS_COL = 'receipt_sessions';

export const sessionService = {
    // Create a new session
    async createSession(items: ParsedItem[], ownerId: string, joinCode: string, name?: string): Promise<string> {
        const sessionId = doc(collection(db, SESSIONS_COL)).id;

        // Initialize item states
        const initialItemStates: Record<string, ItemInstance[]> = {};
        items.forEach(item => {
            initialItemStates[item.id] = Array.from({ length: item.quantity }).map((_, idx) => ({
                instanceId: idx,
                totalParts: 1,
                claims: {}
            }));
        });

        const newSession: FirestoreSession = {
            id: sessionId,
            name: name || undefined,
            items,
            participants: [],
            itemStates: initialItemStates,
            createdAt: serverTimestamp(),
            lastActivityAt: serverTimestamp(),
            joinCode,
            status: 'active',
            ownerId
        };

        await setDoc(doc(db, SESSIONS_COL, sessionId), newSession);
        return sessionId;
    },

    // Join a session by code
    async joinSessionByCode(code: string): Promise<string | null> {
        const q = query(collection(db, SESSIONS_COL), where("joinCode", "==", code), where("status", "==", "active"));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            return null;
        }

        // Return the first match's ID
        return querySnapshot.docs[0].id;
    },

    // Subscribe to session updates
    subscribeToSession(sessionId: string, callback: (session: ReceiptSession | null) => void) {
        return onSnapshot(doc(db, SESSIONS_COL, sessionId), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data() as FirestoreSession;
                // Convert Timestamp to number for client usage
                const session: ReceiptSession = {
                    ...data,
                    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toMillis() : Date.now(),
                    lastActivityAt: data.lastActivityAt instanceof Timestamp ? data.lastActivityAt.toMillis() : undefined
                };
                callback(session);
            } else {
                callback(null);
            }
        });
    },

    // Update item states (splitting logic)
    async updateItemStates(sessionId: string, itemStates: Record<string, ItemInstance[]>) {
        const sessionRef = doc(db, SESSIONS_COL, sessionId);
        await updateDoc(sessionRef, {
            itemStates,
            lastActivityAt: serverTimestamp()
        });
    },

    // Add a participant
    async addParticipant(sessionId: string, participant: Participant) {
        const sessionRef = doc(db, SESSIONS_COL, sessionId);
        await updateDoc(sessionRef, {
            participants: arrayUnion(participant),
            lastActivityAt: serverTimestamp()
        });
    },

    // Delete a session
    async deleteSession(sessionId: string) {
        await deleteDoc(doc(db, SESSIONS_COL, sessionId));
    },

    // Get all sessions for a user (ordered by most recent first)
    async getUserSessions(userId: string): Promise<ReceiptSession[]> {
        const q = query(
            collection(db, SESSIONS_COL),
            where("ownerId", "==", userId),
            orderBy("createdAt", "desc")
        );
        const querySnapshot = await getDocs(q);

        return querySnapshot.docs.map(docSnap => {
            const data = docSnap.data() as FirestoreSession;
            return {
                ...data,
                id: docSnap.id,
                createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toMillis() : Date.now(),
                lastActivityAt: data.lastActivityAt instanceof Timestamp ? data.lastActivityAt.toMillis() : undefined
            } as ReceiptSession;
        });
    },

    // Get sessions where user is a guest (joined via code)
    async getJoinedSessions(userId: string): Promise<ReceiptSession[]> {
        const q = query(
            collection(db, SESSIONS_COL),
            where("guestIds", "array-contains", userId),
            orderBy("createdAt", "desc")
        );
        const querySnapshot = await getDocs(q);

        return querySnapshot.docs.map(docSnap => {
            const data = docSnap.data() as FirestoreSession;
            return {
                ...data,
                id: docSnap.id,
                createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toMillis() : Date.now(),
                lastActivityAt: data.lastActivityAt instanceof Timestamp ? data.lastActivityAt.toMillis() : undefined
            } as ReceiptSession;
        });
    },

    // Add a user to the guest list when they join
    async addGuestToSession(sessionId: string, userId: string) {
        const sessionRef = doc(db, SESSIONS_COL, sessionId);
        await updateDoc(sessionRef, {
            guestIds: arrayUnion(userId),
            lastActivityAt: serverTimestamp()
        });
    },

    // Claim a participant (link participant to user's Firebase UID)
    async claimParticipant(sessionId: string, participantId: string, userId: string, participants: Participant[]) {
        const sessionRef = doc(db, SESSIONS_COL, sessionId);
        // Update the participant with claimedBy
        const updatedParticipants = participants.map(p =>
            p.id === participantId ? { ...p, claimedBy: userId } : p
        );
        await updateDoc(sessionRef, {
            participants: updatedParticipants,
            guestIds: arrayUnion(userId),
            lastActivityAt: serverTimestamp()
        });
    }
};
