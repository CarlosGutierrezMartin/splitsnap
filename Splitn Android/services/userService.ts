import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';

export interface UserProfile {
    uid: string;
    displayName: string;
    email?: string;
    hasSeenOnboarding?: boolean;
    createdAt?: any;
    updatedAt?: any;
}

const USERS_COL = 'users';

export const userService = {
    /**
     * Get a user profile by UID
     */
    async getProfile(uid: string): Promise<UserProfile | null> {
        const docRef = doc(db, USERS_COL, uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return { uid, ...docSnap.data() } as UserProfile;
        }
        return null;
    },

    /**
     * Create a new user profile
     */
    async createProfile(uid: string, displayName: string, email?: string): Promise<void> {
        const docRef = doc(db, USERS_COL, uid);
        await setDoc(docRef, {
            displayName,
            email: email || null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
    },

    /**
     * Update an existing user profile
     */
    async updateProfile(uid: string, updates: Partial<Pick<UserProfile, 'displayName'>>): Promise<void> {
        const docRef = doc(db, USERS_COL, uid);
        await updateDoc(docRef, {
            ...updates,
            updatedAt: serverTimestamp()
        });
    },

    /**
     * Create profile if it doesn't exist (for migration/linking)
     */
    async ensureProfile(uid: string, displayName: string, email?: string): Promise<UserProfile> {
        const existing = await this.getProfile(uid);
        if (existing) {
            return existing;
        }
        await this.createProfile(uid, displayName, email);
        return { uid, displayName, email };
    },

    /**
     * Mark onboarding as completed for a user
     */
    async markOnboardingComplete(uid: string): Promise<void> {
        const docRef = doc(db, USERS_COL, uid);
        await updateDoc(docRef, {
            hasSeenOnboarding: true,
            updatedAt: serverTimestamp()
        });
    }
};
