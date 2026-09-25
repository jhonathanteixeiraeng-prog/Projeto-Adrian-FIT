'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useDialogs } from '@/components/ui/dialogs';

const DEFAULT_MESSAGE = 'As alterações feitas nesta tela ainda não foram salvas e serão perdidas.';

let activeGuard: (() => Promise<boolean>) | null = null;

export async function confirmNavigation(): Promise<boolean> {
    if (!activeGuard) return true;
    return activeGuard();
}

/**
 * Protects editors from losing work:
 * - closing/reloading the tab shows the browser's "leave site?" prompt;
 * - clicking an internal link (sidebar, breadcrumbs, palette results rendered as links) asks for confirmation first.
 *   Cmd/Ctrl/middle-clicks that open a new tab are never blocked.
 *
 * For buttons that navigate programmatically (e.g. "Voltar" calling router.push/back), use
 * `confirmLeave()`: `if (await confirmLeave()) router.back();`
 */
export function useUnsavedChangesGuard(
    isDirty: boolean,
    messageOrOptions?: string | { message?: string; onDiscard?: () => void }
) {
    const router = useRouter();
    const { confirm } = useDialogs();
    const message = typeof messageOrOptions === 'string' ? messageOrOptions : messageOrOptions?.message ?? DEFAULT_MESSAGE;
    const onDiscard = typeof messageOrOptions === 'object' ? messageOrOptions?.onDiscard : undefined;
    const onDiscardRef = useRef(onDiscard);
    onDiscardRef.current = onDiscard;
    const dirtyRef = useRef(isDirty);
    dirtyRef.current = isDirty;

    const confirmLeave = useCallback(async () => {
        if (!dirtyRef.current) return true;
        const ok = await confirm({
            title: 'Sair sem salvar?',
            description: message,
            confirmText: 'Sair sem salvar',
            cancelText: 'Continuar editando',
            variant: 'danger',
        });
        if (ok) {
            dirtyRef.current = false;
            activeGuard = null;
            onDiscardRef.current?.();
        }
        return ok;
    }, [confirm, message]);

    useEffect(() => {
        if (!isDirty) {
            if (activeGuard === confirmLeave) activeGuard = null;
            return;
        }
        activeGuard = confirmLeave;

        const onBeforeUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = '';
        };

        const onClickCapture = (event: MouseEvent) => {
            if (!dirtyRef.current || event.defaultPrevented) return;
            if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            const anchor = (event.target as HTMLElement | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
            if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;

            const url = new URL(anchor.href, window.location.href);
            if (url.origin !== window.location.origin) return;
            if (url.pathname === window.location.pathname && url.search === window.location.search) return;

            // Stop Next's <Link> from navigating, ask, then navigate ourselves.
            event.preventDefault();
            event.stopPropagation();
            confirmLeave().then((ok) => {
                if (ok) {
                    dirtyRef.current = false;
                    router.push(url.pathname + url.search + url.hash);
                }
            });
        };

        window.addEventListener('beforeunload', onBeforeUnload);
        document.addEventListener('click', onClickCapture, true);
        return () => {
            if (activeGuard === confirmLeave) activeGuard = null;
            window.removeEventListener('beforeunload', onBeforeUnload);
            document.removeEventListener('click', onClickCapture, true);
        };
    }, [isDirty, confirmLeave, router]);

    return { confirmLeave };
}
