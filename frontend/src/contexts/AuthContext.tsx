/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut, type User } from 'firebase/auth';
import { auth, authPersistenceReady, googleProvider } from '@/lib/firebase';
import {
    api,
    getCurrentAuthToken,
    type ApiRequestConfig,
    AUTH_ERROR_STORAGE_KEY,
    AUTH_INVALID_EVENT,
    AUTH_SESSION_RETRY_MESSAGE,
    getApiErrorMessage,
    isAuthSessionError,
} from '@/lib/api';
import { clearFirebaseBrowserStorage } from '@/lib/authStorage';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    profileLoading: boolean;
    isNewUser: boolean;
    onboardingCompleted: boolean;
    plan: string;
    creditsRemaining: number;
    authError: string | null;
    clearAuthError: () => void;
    signInWithGoogle: () => Promise<{ isNew: boolean }>;
    signOut: () => Promise<void>;
    refreshProfile: () => Promise<void>;
}

type ProfilePayload = {
    uid?: string;
    is_new_user?: boolean;
    onboarding_completed?: boolean;
    plan?: string;
    credits_remaining?: number;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const PROFILE_CACHE_KEY = 'subtitleai:profile-cache';
const profileAuthConfig = (): ApiRequestConfig => ({
    _skipAuthInvalidation: true,
    _requiresAuth: true,
});

const FALLBACK_AUTH_CONTEXT: AuthContextType = {
    user: null,
    loading: false,
    profileLoading: false,
    isNewUser: false,
    onboardingCompleted: false,
    plan: 'free',
    creditsRemaining: 0,
    authError: null,
    clearAuthError: () => {},
    signInWithGoogle: async () => ({ isNew: false }),
    signOut: async () => {},
    refreshProfile: async () => {},
};

function readCachedProfile(uid: string): ProfilePayload | null {
    if (typeof window === 'undefined') return null;
    try {
        const parsed = JSON.parse(window.localStorage.getItem(PROFILE_CACHE_KEY) || 'null');
        return parsed?.uid === uid ? parsed : null;
    } catch {
        return null;
    }
}

function writeCachedProfile(uid: string, data: ProfilePayload) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({ ...data, uid }));
}

function clearCachedProfile() {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(PROFILE_CACHE_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [profileLoading, setProfileLoading] = useState(false);
    const [isNewUser, setIsNewUser] = useState(false);
    const [onboardingCompleted, setOnboardingCompleted] = useState(false);
    const [plan, setPlan] = useState('free');
    const [creditsRemaining, setCreditsRemaining] = useState(60);
    const [authError, setAuthError] = useState<string | null>(() => {
        if (typeof window === 'undefined') return null;
        const storedMessage = window.sessionStorage.getItem(AUTH_ERROR_STORAGE_KEY);
        if (storedMessage?.toLowerCase().includes('saved sign-in session is stale')) {
            window.sessionStorage.removeItem(AUTH_ERROR_STORAGE_KEY);
            window.localStorage.removeItem(AUTH_ERROR_STORAGE_KEY);
            return null;
        }
        return storedMessage;
    });
    const authRecoveryInFlightRef = useRef(false);

    const clearAuthError = useCallback(() => {
        setAuthError(null);
        if (typeof window !== 'undefined') {
            window.sessionStorage.removeItem(AUTH_ERROR_STORAGE_KEY);
        }
    }, []);

    const resetProfileState = useCallback(() => {
        setIsNewUser(false);
        setOnboardingCompleted(false);
        setPlan('free');
        setCreditsRemaining(60);
    }, []);

    const applyProfile = useCallback((data: ProfilePayload) => {
        setIsNewUser(data.is_new_user ?? false);
        setOnboardingCompleted(data.onboarding_completed ?? false);
        setPlan(data.plan ?? 'free');
        setCreditsRemaining(data.credits_remaining ?? 60);
    }, []);

    const hydrateCachedProfile = useCallback((uid: string) => {
        const cachedProfile = readCachedProfile(uid);
        if (cachedProfile) {
            applyProfile(cachedProfile);
        }
    }, [applyProfile]);

    const _syncProfile = useCallback(async (expectedUid?: string, prewarmToken = false) => {
        setProfileLoading(true);
        try {
            // Pre-warm a fresh token before the request to avoid stale-token 401s
            if (prewarmToken) {
                try {
                    await getCurrentAuthToken({ forceRefresh: true });
                } catch {
                    // If pre-warm fails, continue anyway — the request interceptor will try
                }
            }
            const { data } = await api.get<ProfilePayload>('/v1/users/me', profileAuthConfig());
            if (expectedUid && data.uid && data.uid !== expectedUid) {
                return null;
            }
            clearAuthError();
            applyProfile(data);
            if (expectedUid || data.uid) {
                writeCachedProfile(expectedUid || data.uid || '', data);
            }
            return data;
        } catch (error) {
            if (isAuthSessionError(error)) {
                throw error;
            }
            return null;
        } finally {
            setProfileLoading(false);
        }
    }, [applyProfile, clearAuthError]);

    const markProfileSyncFailed = useCallback((message: string, persist = true) => {
        setAuthError(message);
        if (typeof window !== 'undefined') {
            if (persist) {
                window.sessionStorage.setItem(AUTH_ERROR_STORAGE_KEY, message);
            } else {
                window.sessionStorage.removeItem(AUTH_ERROR_STORAGE_KEY);
            }
        }
    }, []);

    useEffect(() => {
        const onInvalidAuth = (event: Event) => {
            const message = (event as CustomEvent<{ message?: string }>).detail?.message
                || AUTH_SESSION_RETRY_MESSAGE;
            const activeUser = auth.currentUser;
            if (activeUser) {
                if (authRecoveryInFlightRef.current) return;
                authRecoveryInFlightRef.current = true;
                clearAuthError();
                void getCurrentAuthToken({ forceRefresh: true })
                    .then(() => _syncProfile(activeUser.uid, false))
                    .then((profile) => {
                        if (!profile) {
                            markProfileSyncFailed(AUTH_SESSION_RETRY_MESSAGE, false);
                        }
                    })
                    .catch((error) => {
                        markProfileSyncFailed(getApiErrorMessage(error, AUTH_SESSION_RETRY_MESSAGE), false);
                    })
                    .finally(() => {
                        authRecoveryInFlightRef.current = false;
                    });
                return;
            }
            markProfileSyncFailed(message);
        };

        window.addEventListener(AUTH_INVALID_EVENT, onInvalidAuth);
        return () => window.removeEventListener(AUTH_INVALID_EVENT, onInvalidAuth);
    }, [_syncProfile, clearAuthError, markProfileSyncFailed]);

    useEffect(() => {
        let active = true;
        let unsubscribe: (() => void) | undefined;

        authPersistenceReady.finally(() => {
            if (!active) return;

            unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
                if (!active) return;

                setUser(firebaseUser);
                setLoading(false);

                if (!firebaseUser) {
                    resetProfileState();
                    clearCachedProfile();
                    clearAuthError();
                    setProfileLoading(false);
                    return;
                }

                clearAuthError();
                hydrateCachedProfile(firebaseUser.uid);
                // Pass prewarmToken=true so _syncProfile force-refreshes the
                // Firebase ID token before the first /v1/users/me request.
                // This prevents stale cached tokens from producing a 401 banner.
                void _syncProfile(firebaseUser.uid, true).catch((error) => {
                    if (!active) return;
                    if (isAuthSessionError(error)) {
                        markProfileSyncFailed(
                            getApiErrorMessage(error, AUTH_SESSION_RETRY_MESSAGE),
                            false,
                        );
                    }
                });
            });
        });

        return () => {
            active = false;
            unsubscribe?.();
        };
    }, [_syncProfile, clearAuthError, hydrateCachedProfile, markProfileSyncFailed, resetProfileState]);

    const signInWithGoogle = useCallback(async () => {
        clearAuthError();
        setLoading(true);
        let result;
        try {
            await authPersistenceReady;
            result = await signInWithPopup(auth, googleProvider);
        } catch (error) {
            setLoading(false);
            throw error;
        }

        setUser(result.user);
        setLoading(false);
        hydrateCachedProfile(result.user.uid);

        void _syncProfile(result.user.uid, true).catch((error) => {
            markProfileSyncFailed(getApiErrorMessage(error, 'Your account session is signed in, but profile authorization could not be verified yet.'));
        });
        return { isNew: false };
    }, [_syncProfile, clearAuthError, hydrateCachedProfile, markProfileSyncFailed]);

    const signOut = useCallback(async () => {
        try {
            await authPersistenceReady;
            await firebaseSignOut(auth);
        } finally {
            await clearFirebaseBrowserStorage();
            setUser(null);
            resetProfileState();
            clearCachedProfile();
            clearAuthError();
            setLoading(false);
            setProfileLoading(false);
        }
    }, [resetProfileState, clearAuthError]);

    const refreshProfile = useCallback(async () => {
        const currentUser = auth.currentUser;
        if (!currentUser) return;
        try {
            await _syncProfile(currentUser.uid, true);
        } catch (error) {
            markProfileSyncFailed(getApiErrorMessage(error, AUTH_SESSION_RETRY_MESSAGE), false);
        }
    }, [_syncProfile, markProfileSyncFailed]);

    return (
        <AuthContext.Provider value={{ user, loading, profileLoading, isNewUser, onboardingCompleted, plan, creditsRemaining, authError, clearAuthError, signInWithGoogle, signOut, refreshProfile }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth(): AuthContextType {
    const context = useContext(AuthContext);
    if (!context) {
        return FALLBACK_AUTH_CONTEXT;
    }
    return context;
}
