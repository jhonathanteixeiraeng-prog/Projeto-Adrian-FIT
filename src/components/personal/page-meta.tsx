'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export interface Crumb {
    label: string;
    href?: string;
}

export interface PageMeta {
    /** Browser tab title, e.g. "João Silva · Treino". " · Adrian Fit" is appended automatically. */
    title?: string;
    /** Breadcrumbs shown in the top header (after "Painel"). The last item is the current page. */
    breadcrumbs?: Crumb[];
}

interface PageMetaContextValue {
    meta: PageMeta | null;
    setMeta: (meta: PageMeta | null) => void;
}

const PageMetaContext = createContext<PageMetaContextValue | undefined>(undefined);

export function PageMetaProvider({ children }: { children: React.ReactNode }) {
    const [meta, setMeta] = useState<PageMeta | null>(null);
    return <PageMetaContext.Provider value={{ meta, setMeta }}>{children}</PageMetaContext.Provider>;
}

/**
 * Lets a page name itself in the browser tab and in the header breadcrumbs,
 * typically with the student's name once it is loaded:
 *
 *   usePageMeta({
 *     title: student ? `${student.user.name} · Treino` : 'Treino',
 *     breadcrumbs: [
 *       { label: 'Alunos', href: '/personal/students' },
 *       { label: student?.user.name ?? 'Aluno', href: `/personal/students/${id}` },
 *       { label: 'Treino' },
 *     ],
 *   });
 *
 * Pages that don't call it get a title and breadcrumbs derived from the URL.
 */
export function usePageMeta(meta: PageMeta) {
    const context = useContext(PageMetaContext);
    const setMeta = context?.setMeta;
    const serialized = JSON.stringify(meta);

    useEffect(() => {
        if (!setMeta) return;
        setMeta(JSON.parse(serialized) as PageMeta);
        return () => setMeta(null);
    }, [serialized, setMeta]);
}

export function useCurrentPageMeta(): PageMeta | null {
    return useContext(PageMetaContext)?.meta ?? null;
}
