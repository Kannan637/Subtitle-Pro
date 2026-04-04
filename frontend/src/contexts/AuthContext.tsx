import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { type User, onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';
import { api } from '@/lib/api';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    isNewUser: boolean;
    onboardingCompleted: boolean;
    plan: string;
    creditsRemaining: number;
    signInWithGoogle: () => Promise<{ isNew: boolean }>;
    signOut: () => Promise<void>;
    refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [isNewUser, setIsNewUser] = useState(false);
    const [onboardingCompleted, setOnboardingCompleted] = useState(false);
    const [plan, setPlan] = useState('free');
    const [creditsRemaining, setCreditsRemaining] = useState(60);

    const _syncProfile = useCallback(async () => {
        try {
            const { data } = await api.get('/v1/users/me');
            setIsNewUser(data.is_new_user ?? false);
            setOnboardingCompleted(data.onboarding_completed ?? false);
            setPlan(data.plan ?? 'free');
            setCreditsRemaining(data.credits_remaining ?? 60);
            return data;
        } catch {
            setIsNewUser(false);
            setOnboardingCompleted(false);
            setPlan('free');
            setCreditsRemaining(60);
            return null;
        }
    }, []);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            setUser(firebaseUser);
            if (firebaseUser) {
                await _syncProfile();
            } else {
                setIsNewUser(false);
                setOnboardingCompleted(false);
                setPlan('free');
                setCreditsRemaining(60);
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, [_syncProfile]);

    const signInWithGoogle = useCallback(async () => {
        await signInWithPopup(auth, googleProvider);
        const data = await _syncProfile();
        return { isNew: data?.is_new_user ?? false };
    }, [_syncProfile]);

    const signOut = useCallback(async () => {
        await firebaseSignOut(auth);
        setIsNewUser(false);
        setOnboardingCompleted(false);
        setPlan('free');
        setCreditsRemaining(60);
    }, []);

    const refreshProfile = useCallback(async () => {
        if (auth.currentUser) {
            await _syncProfile();
        }
    }, [_syncProfile]);

    return (
        <AuthContext.Provider value={{ user, loading, isNewUser, onboardingCompleted, plan, creditsRemaining, signInWithGoogle, signOut, refreshProfile }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth(): AuthContextType {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
