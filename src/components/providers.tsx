'use client';

import { SessionProvider } from 'next-auth/react';
import { ReactNode, createContext, useContext, useEffect, useState } from 'react';

interface ProvidersProps {
    children: ReactNode;
}

interface ThemeContextType {
    theme: 'light' | 'dark';
    toggleTheme: () => void;
    setTheme: (theme: 'light' | 'dark') => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}

function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setThemeState] = useState<'light' | 'dark'>('dark');
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        // Check localStorage or system preference
        const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
        if (savedTheme) {
            setThemeState(savedTheme);
            document.documentElement.classList.toggle('dark', savedTheme === 'dark');
        } else {
            // Default to dark mode
            setThemeState('dark');
            document.documentElement.classList.add('dark');
        }
    }, []);

    const toggleTheme = () => {
        const newTheme = theme === 'dark' ? 'light' : 'dark';
        setThemeState(newTheme);
        localStorage.setItem('theme', newTheme);
        document.documentElement.classList.toggle('dark', newTheme === 'dark');
    };

    const setTheme = (newTheme: 'light' | 'dark') => {
        setThemeState(newTheme);
        localStorage.setItem('theme', newTheme);
        document.documentElement.classList.toggle('dark', newTheme === 'dark');
    };

    // Prevent flash
    if (!mounted) {
        return null;
    }

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function Providers({ children }: ProvidersProps) {
    return (
        <SessionProvider>
            <ThemeProvider>
                {children}
            </ThemeProvider>
        </SessionProvider>
    );
}
