import type { Config } from "tailwindcss";

/**
 * Theme colors are CSS variables (hex values in globals.css). color-mix lets Tailwind's opacity
 * modifiers work with them, e.g. bg-muted/60 or border-border/80.
 */
const withAlpha = (variable: string) =>
    `color-mix(in srgb, var(${variable}) calc(<alpha-value> * 100%), transparent)`;

const config: Config = {
    content: [
        "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                // Cores do sistema de design baseadas em variáveis CSS
                background: withAlpha('--background'),
                foreground: withAlpha('--foreground'),
                card: {
                    DEFAULT: withAlpha('--card'),
                    foreground: withAlpha('--card-foreground'),
                },
                popover: {
                    DEFAULT: withAlpha('--popover'),
                    foreground: withAlpha('--popover-foreground'),
                },
                primary: {
                    DEFAULT: withAlpha('--primary'),
                    foreground: withAlpha('--primary-foreground'),
                    50: '#E2E8F0',
                    100: '#CBD5E1',
                    200: '#94A3B8',
                    300: '#64748B',
                    400: '#475569',
                    500: '#334155',
                    600: '#1E293B',
                    700: '#0F172A',
                    800: '#0B1120',
                    900: '#060A14',
                },
                secondary: {
                    DEFAULT: withAlpha('--secondary'),
                    foreground: withAlpha('--secondary-foreground'),
                    50: '#DCFCE7',
                    100: '#BBF7D0',
                    200: '#86EFAC',
                    300: '#4ADE80',
                    400: '#22C55E',
                    500: '#16A34A',
                    600: '#15803D',
                    700: '#166534',
                    800: '#14532D',
                    900: '#052E16',
                },
                accent: {
                    DEFAULT: withAlpha('--accent'),
                    foreground: withAlpha('--accent-foreground'),
                    50: '#EFF6FF',
                    100: '#DBEAFE',
                    200: '#BFDBFE',
                    300: '#93C5FD',
                    400: '#60A5FA',
                    500: '#3B82F6',
                    600: '#2563EB',
                    700: '#1D4ED8',
                    800: '#1E40AF',
                    900: '#1E3A8A',
                },
                muted: {
                    DEFAULT: withAlpha('--muted'),
                    foreground: withAlpha('--muted-foreground'),
                },
                destructive: {
                    DEFAULT: withAlpha('--destructive'),
                    foreground: withAlpha('--destructive-foreground'),
                },
                border: withAlpha('--border'),
                input: withAlpha('--input'),
                ring: withAlpha('--ring'),
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
            },
            borderRadius: {
                lg: withAlpha('--radius'),
                md: 'calc(var(--radius) - 2px)',
                sm: 'calc(var(--radius) - 4px)',
            },
            boxShadow: {
                'soft': '0 4px 20px rgba(0, 0, 0, 0.08)',
            },
            animation: {
                'fade-in': 'fadeIn 0.5s ease-in-out',
                'slide-up': 'slideUp 0.3s ease-out',
                'slide-down': 'slideDown 0.3s ease-out',
                'pulse-soft': 'pulseSoft 2s infinite',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideUp: {
                    '0%': { transform: 'translateY(10px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                },
                slideDown: {
                    '0%': { transform: 'translateY(-10px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                },
                pulseSoft: {
                    '0%, 100%': { opacity: '1' },
                    '50%': { opacity: '0.7' },
                },
            },
        },
    },
    plugins: [],
};

export default config;
