/**
 * Theme rules shared by ThemeProvider (client) and the root layout's init script (runs before the first paint).
 * A saved choice wins; otherwise the personal area follows the system (light by day, dark at night) and the
 * rest of the app opens dark. Personal pages also get `data-area="personal"` on <html> (their palette in globals.css).
 */

export type Theme = 'light' | 'dark';
/** The person's choice; 'system' follows the operating system. */
export type ThemePreference = Theme | 'system';

export const THEME_STORAGE_KEY = 'theme';

export const isPersonalArea = (pathname: string | null | undefined) =>
    pathname === '/personal' || Boolean(pathname?.startsWith('/personal/'));

export const defaultThemePreference = (personal: boolean): ThemePreference => (personal ? 'system' : 'dark');

export const isThemePreference = (value: unknown): value is ThemePreference =>
    value === 'light' || value === 'dark' || value === 'system';

/** Inline <head> script with the same rules, so the page never paints with the wrong theme or palette. */
export const THEME_INIT_SCRIPT = `(function(){try{var r=document.documentElement;var p=/^\\/personal(\\/|$)/.test(location.pathname);var s=localStorage.getItem('${THEME_STORAGE_KEY}');var pref=s==='light'||s==='dark'||s==='system'?s:(p?'system':'dark');var d=pref==='system'?window.matchMedia('(prefers-color-scheme: dark)').matches:pref==='dark';r.classList.toggle('dark',d);if(p){r.setAttribute('data-area','personal')}else{r.removeAttribute('data-area')}}catch(e){}})();`;
