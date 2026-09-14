import { useState, useEffect, useCallback } from 'react';
import { sessionService } from '../services/sessionService';
import { ParsedItem, ReceiptSession, ItemInstance, Participant, AppState } from '../types';
import { useAuth } from './useAuth';

export function useSession() {
    const { user } = useAuth();
    const [session, setSession] = useState<ReceiptSession | null>(null);
    const [userSessions, setUserSessions] = useState<ReceiptSession[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingUserSessions, setLoadingUserSessions] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Subscribe to session updates when we have a session ID
    useEffect(() => {
        if (!session?.id) return;

        const unsubscribe = sessionService.subscribeToSession(session.id, (updatedSession) => {
            if (updatedSession) {
                setSession(updatedSession);
                // If session is completed, maybe handle it?
            } else {
                // Session deleted or lost permissions
                setSession(null);
                setError("Session no longer exists");
            }
        });

        return () => unsubscribe();
    }, [session?.id]);

    const createSession = useCallback(async (items: ParsedItem[], name?: string) => {
        if (!user) {
            setError("You must be signed in to create a session");
            return null;
        }
        setLoading(true);
        setError(null);
        try {
            // 6-character random code
            const joinCode = Math.random().toString(36).substring(2, 8).toUpperCase();
            const sessionId = await sessionService.createSession(items, user.uid, joinCode, name);
            // Determine initial state? subscribeToSession will pick it up, but we might want faster feedback
            // preventing race condition, let's wait for subscription
            return sessionId;
        } catch (err: any) {
            console.error(err);
            setError("Failed to create session");
            return null;
        } finally {
            setLoading(false);
        }
    }, [user]);

    const joinSession = useCallback(async (code: string) => {
        if (!user) {
            setError("You must be signed in to join");
            return false;
        }
        setLoading(true);
        setError(null);
        try {
            const sessionId = await sessionService.joinSessionByCode(code);
            if (!sessionId) {
                setError("Session not found or invalid code");
                return false;
            }

            // We don't manually set session here, we let the external app logic set the session ID 
            // which triggers the subscription effect. 
            // But wait, my design up top relies on `session` state being local to this hook 
            // which implies this hook manages the current active session.
            // So I should probably set a temporary session object OR just return the ID 
            // and let the caller handle the UI transition which ultimately mounts a component that uses this hook?
            // Actually, a better pattern for this single-session app is:
            // This hook should probably expose a method to "enter" a session given an ID.

            // For now, let's return the ID so the App can decide to "enter" this session mode.
            return sessionId;
        } catch (err: any) {
            console.error(err);
            setError("Failed to join session");
            return false;
        } finally {
            setLoading(false);
        }
    }, [user]);

    const updateItemStates = useCallback(async (itemStates: Record<string, ItemInstance[]>) => {
        if (!session) return;
        try {
            // Optimistic update could happen here in local state if we wanted
            await sessionService.updateItemStates(session.id, itemStates);
        } catch (err) {
            console.error(err);
            setError("Failed to save changes");
        }
    }, [session]);

    const addParticipant = useCallback(async (name: string) => {
        if (!session || !user) return;
        try {
            const newParticipant: Participant = {
                id: `participant-${Date.now()}`, // Fallback to random for manual adds
                name
            };

            // If adding SELF (joining), we might want to use user.uid
            // But let's stick to the manual flow for now to preserve UI behavior
            await sessionService.addParticipant(session.id, newParticipant);
        } catch (err) {
            console.error(err);
            setError("Failed to add participant");
        }
    }, [session, user]);

    // Fetch all sessions for the current user (owned + joined)
    const fetchUserSessions = useCallback(async () => {
        if (!user) {
            setUserSessions([]);
            return;
        }
        setLoadingUserSessions(true);
        try {
            const [owned, joined] = await Promise.all([
                sessionService.getUserSessions(user.uid),
                sessionService.getJoinedSessions(user.uid)
            ]);

            // Merge and sort by creation date (desc)
            const all = [...owned, ...joined].sort((a, b) => b.createdAt - a.createdAt);
            // Remove duplicates just in case (e.g. if owner is somehow in guest list)
            const unique = Array.from(new Map(all.map(s => [s.id, s])).values());

            setUserSessions(unique);
        } catch (err) {
            console.error(err);
            setError("Failed to load sessions");
        } finally {
            setLoadingUserSessions(false);
        }
    }, [user]);

    // Delete a session
    const deleteSession = useCallback(async (sessionId: string) => {
        if (!user) return;
        try {
            await sessionService.deleteSession(sessionId);
            // Optimistically update local list
            setUserSessions(prev => prev.filter(s => s.id !== sessionId));
        } catch (err) {
            console.error(err);
            setError("Failed to delete session");
        }
    }, [user]);

    const claimParticipant = useCallback(async (participantId: string) => {
        if (!session || !user) return;
        try {
            await sessionService.claimParticipant(session.id, participantId, user.uid, session.participants);
        } catch (err) {
            console.error(err);
            setError("Failed to claim participant");
        }
    }, [session, user]);

    const addGuest = useCallback(async () => {
        if (!session || !user) return;
        try {
            await sessionService.addGuestToSession(session.id, user.uid);
        } catch (err) {
            console.error(err);
        }
    }, [session, user]);

    return {
        session,
        userSessions,
        loadingUserSessions,
        loadSession: (id: string) => setSession({ id } as ReceiptSession), // Placeholder to trigger effect
        createSession,
        joinSession,
        updateItemStates,
        addParticipant,
        fetchUserSessions,
        deleteSession,
        claimParticipant,
        addGuest,
        loading,
        error,
        clearError: () => setError(null)
    };
}
