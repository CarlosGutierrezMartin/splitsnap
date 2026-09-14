import { useState, useEffect, useCallback } from 'react';
import {
    signInAnonymously,
    onAuthStateChanged,
    User,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut as firebaseSignOut,
    linkWithCredential,
    EmailAuthProvider,
    GoogleAuthProvider,
    signInWithPopup,
    AuthError
} from 'firebase/auth';
import { auth } from '../firebase/config';
import { userService, UserProfile } from '../services/userService';

export function useAuth() {
    const [user, setUser] = useState<User | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<AuthError | null>(null);

    useEffect(() => {
        // Listen for auth state changes
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);

            // Fetch profile for non-anonymous users
            if (currentUser && !currentUser.isAnonymous) {
                try {
                    const profile = await userService.getProfile(currentUser.uid);
                    setUserProfile(profile);
                } catch (err) {
                    console.error('Failed to fetch profile:', err);
                    setUserProfile(null);
                }
            } else {
                setUserProfile(null);
            }

            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const signInAnon = useCallback(async () => {
        setLoading(true);
        try {
            await signInAnonymously(auth);
        } catch (err: any) {
            console.error("Auth error:", err);
            setError(err);
        } finally {
            setLoading(false);
        }
    }, []);

    const signUpEmail = useCallback(async (email: string, pass: string, displayName: string) => {
        setLoading(true);
        try {
            const result = await createUserWithEmailAndPassword(auth, email, pass);
            // Create user profile in Firestore
            const { userService } = await import('../services/userService');
            await userService.createProfile(result.user.uid, displayName, email);
        } catch (err: any) {
            setError(err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const signInEmail = useCallback(async (email: string, pass: string) => {
        setLoading(true);
        try {
            await signInWithEmailAndPassword(auth, email, pass);
        } catch (err: any) {
            setError(err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const signInWithGoogle = useCallback(async () => {
        setLoading(true);
        try {
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);
        } catch (err: any) {
            setError(err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const linkEmail = useCallback(async (email: string, pass: string) => {
        if (!auth.currentUser) throw new Error("No user to link");
        setLoading(true);
        try {
            const credential = EmailAuthProvider.credential(email, pass);
            await linkWithCredential(auth.currentUser, credential);
        } catch (err: any) {
            setError(err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const updateProfile = useCallback(async (displayName: string) => {
        if (!user) return;
        try {
            await userService.updateProfile(user.uid, { displayName });
            setUserProfile(prev => prev ? { ...prev, displayName } : null);
        } catch (err: any) {
            setError(err);
            throw err;
        }
    }, [user]);

    const signOut = useCallback(async () => {
        setLoading(true);
        try {
            await firebaseSignOut(auth);
        } catch (err: any) {
            setError(err);
        } finally {
            // We don't strictly need to set loading false here because onAuthStateChanged triggers null user
            // But if there's no state change (already out?), we should ensure it stops loading.
            setLoading(false);
        }
    }, []);

    const completeOnboarding = useCallback(async () => {
        if (!user) return;
        try {
            await userService.markOnboardingComplete(user.uid);
            setUserProfile(prev => prev ? { ...prev, hasSeenOnboarding: true } : null);
        } catch (err: any) {
            console.error('Failed to mark onboarding complete:', err);
        }
    }, [user]);

    return {
        user,
        userProfile,
        loading,
        error,
        signInAnon,
        signUpEmail,
        signInEmail,
        signInWithGoogle,
        linkEmail,
        updateProfile,
        completeOnboarding,
        signOut,
        clearError: () => setError(null)
    };
}

