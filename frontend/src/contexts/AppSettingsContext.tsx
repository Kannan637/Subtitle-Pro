/* eslint-disable react-refresh/only-export-components */
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useLayoutEffect,
    useMemo,
    useState,
    type ReactNode,
} from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

type StoredAppSettings = {
    themeMode?: ThemeMode;
    reduceMotion?: boolean;
};

type AppSettingsContextType = {
    themeMode: ThemeMode;
    resolvedTheme: ResolvedTheme;
    reduceMotion: boolean;
    setThemeMode: (theme: ThemeMode) => void;
    setReduceMotion: (value: boolean) => void;
    resetSettings: () => void;
};

const STORAGE_KEY = 'subtitlepro:app-settings';

const FALLBACK_SETTINGS: AppSettingsContextType = {
    themeMode: 'light',
    resolvedTheme: 'light',
    reduceMotion: false,
    setThemeMode: () => {},
    setReduceMotion: () => {},
    resetSettings: () => {},
};

const AppSettingsContext = createContext<AppSettingsContextType | undefined>(undefined);

function getSystemTheme(): ResolvedTheme {
    if (typeof window === 'undefined') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function readStoredSettings(): Required<StoredAppSettings> {
    if (typeof window === 'undefined') {
        return { themeMode: 'light', reduceMotion: false };
    }

    try {
        const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}') as StoredAppSettings;
        const themeMode: ThemeMode = parsed.themeMode === 'dark' || parsed.themeMode === 'system' ? parsed.themeMode : 'light';
        return {
            themeMode,
            reduceMotion: Boolean(parsed.reduceMotion),
        };
    } catch {
        return { themeMode: 'light', reduceMotion: false };
    }
}

function writeStoredSettings(settings: Required<StoredAppSettings>) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

function applyDocumentSettings(themeMode: ThemeMode, resolvedTheme: ResolvedTheme, reduceMotion: boolean) {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.classList.toggle('dark', resolvedTheme === 'dark');
    root.dataset.theme = resolvedTheme;
    root.dataset.themeMode = themeMode;
    root.dataset.reduceMotion = String(reduceMotion);
    root.style.colorScheme = resolvedTheme;
}

export function AppSettingsProvider({ children }: { children: ReactNode }) {
    const storedSettings = useMemo(() => readStoredSettings(), []);
    const [themeMode, setThemeModeState] = useState<ThemeMode>(storedSettings.themeMode);
    const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() => getSystemTheme());
    const [reduceMotion, setReduceMotionState] = useState(storedSettings.reduceMotion);

    const resolvedTheme: ResolvedTheme = themeMode === 'system' ? systemTheme : themeMode;

    useLayoutEffect(() => {
        applyDocumentSettings(themeMode, resolvedTheme, reduceMotion);
        writeStoredSettings({ themeMode, reduceMotion });
    }, [reduceMotion, resolvedTheme, themeMode]);

    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = () => setSystemTheme(mediaQuery.matches ? 'dark' : 'light');
        handleChange();
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, []);

    const setThemeMode = useCallback((theme: ThemeMode) => {
        setThemeModeState(theme);
    }, []);

    const setReduceMotion = useCallback((value: boolean) => {
        setReduceMotionState(value);
    }, []);

    const resetSettings = useCallback(() => {
        setThemeModeState('light');
        setReduceMotionState(false);
    }, []);

    const value = useMemo<AppSettingsContextType>(() => ({
        themeMode,
        resolvedTheme,
        reduceMotion,
        setThemeMode,
        setReduceMotion,
        resetSettings,
    }), [reduceMotion, resolvedTheme, setReduceMotion, setThemeMode, resetSettings, themeMode]);

    return (
        <AppSettingsContext.Provider value={value}>
            {children}
        </AppSettingsContext.Provider>
    );
}

export function useAppSettings(): AppSettingsContextType {
    return useContext(AppSettingsContext) ?? FALLBACK_SETTINGS;
}
