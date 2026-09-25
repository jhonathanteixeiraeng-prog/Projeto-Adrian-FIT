import type { EditorState } from './editor-state';

/**
 * After creating a plan the editor navigates to the plan's edit URL; the new page picks the
 * editor state up from here, so there is no reload flash and edits typed during the save survive.
 */
export interface EditorHandoff {
    state: EditorState;
    baseline: string;
    version: number | null;
    active: boolean;
    updatedAt: string | null;
    studentName: string | null;
}

const handoffs = new Map<string, EditorHandoff>();

export function setEditorHandoff(entityId: string, handoff: EditorHandoff) {
    handoffs.set(entityId, handoff);
}

export function takeEditorHandoff(entityId: string): EditorHandoff | null {
    const handoff = handoffs.get(entityId) ?? null;
    // Kept briefly: React Strict Mode runs the loading effect twice in development.
    if (handoff) window.setTimeout(() => handoffs.delete(entityId), 5000);
    return handoff;
}

/** Local drafts: unsaved editor content kept per browser in case the tab closes or the session expires. */
export interface EditorDraft {
    savedAt: number;
    version: number | null;
    state: EditorState;
}

const DRAFT_PREFIX = 'personal:workout-draft:';
const DRAFT_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

export function readDraft(key: string): EditorDraft | null {
    try {
        const raw = window.localStorage.getItem(DRAFT_PREFIX + key);
        if (!raw) return null;
        const draft = JSON.parse(raw) as EditorDraft;
        if (!draft?.state?.days || Date.now() - draft.savedAt > DRAFT_MAX_AGE_MS) {
            window.localStorage.removeItem(DRAFT_PREFIX + key);
            return null;
        }
        return draft;
    } catch {
        return null;
    }
}

export function writeDraft(key: string, draft: EditorDraft) {
    try {
        window.localStorage.setItem(DRAFT_PREFIX + key, JSON.stringify(draft));
    } catch {
        // Storage full or blocked: drafts are a safety net only.
    }
}

export function clearDraft(key: string) {
    try {
        window.localStorage.removeItem(DRAFT_PREFIX + key);
    } catch {
        // ignore
    }
}
