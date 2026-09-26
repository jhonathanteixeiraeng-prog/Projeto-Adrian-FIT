'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';

/**
 * A session can end while a page is open: it expired, or the password changed on another device
 * (see passwordStamp in src/lib/auth.ts). Then the user goes to the login page with a notice and
 * comes back to the same page after signing in.
 */
export function useSessionGuard() {
    const { status } = useSession();
    useEffect(() => {
        if (status !== 'unauthenticated') return;
        const here = window.location.pathname + window.location.search;
        window.location.replace(`/login?reason=session&callbackUrl=${encodeURIComponent(here)}`);
    }, [status]);
}

/**
 * After a 401 from our API, asks NextAuth to check the session now instead of on the next tab focus:
 * its SessionProvider refetches on `visibilitychange` while the page is visible.
 */
export function recheckSession() {
    if (typeof document === 'undefined' || document.visibilityState !== 'visible') return;
    document.dispatchEvent(new Event('visibilitychange'));
}
