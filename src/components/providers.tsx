'use client';

import { SessionProvider } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { ReactNode, createContext, useCallback, useContext, useEffect, useLayoutEffect, useState } from 'react';
import {
    THEME_STORAGE_KEY,
    defaultThemePreference,
    isPersonalArea,
    isThemePreference,
    type Theme,
    type ThemePreference,
} from '@/lib/theme';

interface ProvidersProps {
    children: ReactNode;
}

interface ThemeContextType {
    /** Theme in use. */
    theme: Theme;
    preference: ThemePreference;
    /** Switches to the other theme (an explicit choice, no longer following the system). */
    toggleTheme: () => void;
    setTheme: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}

function readSavedPreference(): ThemePreference | null {
    try {
        const saved = localStorage.getItem(THEME_STORAGE_KEY);
        return isThemePreference(saved) ? saved : null;
    } catch {
        return null;
    }
}

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

function ThemeProvider({ children }: { children: ReactNode }) {
    const personal = isPersonalArea(usePathname());
    // null = nothing saved: the area's default applies.
    const [saved, setSaved] = useState<ThemePreference | null>(null);
    const [systemDark, setSystemDark] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setSaved(readSavedPreference());
        const media = window.matchMedia('(prefers-color-scheme: dark)');
        setSystemDark(media.matches);
        const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
        media.addEventListener('change', onChange);
        setMounted(true);
        return () => media.removeEventListener('change', onChange);
    }, []);

    const preference: ThemePreference = saved ?? defaultThemePreference(personal);
    const theme: Theme = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;

    // Before paint, so a page never shows the other area's palette or the other theme.
    useIsomorphicLayoutEffect(() => {
        if (!mounted) return;
        const root = document.documentElement;
        root.classList.toggle('dark', theme === 'dark');
        if (personal) root.setAttribute('data-area', 'personal');
        else root.removeAttribute('data-area');
    }, [mounted, theme, personal]);

    const setTheme = useCallback((next: ThemePreference) => {
        setSaved(next);
        try {
            localStorage.setItem(THEME_STORAGE_KEY, next);
        } catch {
            // Private mode: the choice lasts until the page is closed.
        }
    }, []);

    const toggleTheme = useCallback(() => setTheme(theme === 'dark' ? 'light' : 'dark'), [setTheme, theme]);

    // Prevent flash
    if (!mounted) {
        return null;
    }

    return (
        <ThemeContext.Provider value={{ theme, preference, toggleTheme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

import { ToastProvider } from '@/components/ui/toast';
import { DialogsProvider } from '@/components/ui/dialogs';

export function Providers({ children }: ProvidersProps) {
    return (
        <SessionProvider>
            <ThemeProvider>
                <ToastProvider>
                    <DialogsProvider>{children}</DialogsProvider>
                </ToastProvider>
            </ThemeProvider>
        </SessionProvider>
    );
}
