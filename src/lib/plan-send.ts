/**
 * Whether the student has the current version of a workout plan or diet.
 *
 * The trainer sends plans as PDF over WhatsApp; exporting one records sentAt and the plan version
 * it had (sentVersion). Workout plans and diets bump `version` when their content changes, so a
 * higher version than the one sent means the student's PDF is out of date.
 */

export type SendState = 'NOT_SENT' | 'SENT' | 'CHANGED';

export interface SendFields {
    version?: number | null;
    sentAt?: string | Date | null;
    sentVersion?: number | null;
}

/** What POST /api/workout-plans/[id]/sent and /api/diets/[id]/sent return. */
export interface SentInfo {
    version: number;
    sentAt: string;
    sentVersion: number;
}

export function sendState(plan: SendFields): SendState {
    if (!plan.sentAt || plan.sentVersion == null) return 'NOT_SENT';
    return (plan.version ?? 1) > plan.sentVersion ? 'CHANGED' : 'SENT';
}

/** Only the send fields, e.g. to keep them from a full plan in editor state. */
export function sendFieldsOf(plan: SendFields | null | undefined): SendFields {
    return { version: plan?.version ?? null, sentAt: plan?.sentAt ?? null, sentVersion: plan?.sentVersion ?? null };
}

/** "26/09" */
export const formatSentDate = (value: string | Date) => new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
const dateTime = (value: string | Date) =>
    new Date(value).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export interface SendStatus {
    state: SendState;
    /** "PDF enviado em 26/09" */
    label: string;
    /** "Enviado 26/09", for rows and tight headers. */
    short: string;
    /** Tooltip with what to do. */
    hint: string;
}

export function sendStatus(plan: SendFields): SendStatus {
    const state = sendState(plan);
    if (state === 'NOT_SENT') {
        return { state, label: 'PDF ainda não enviado', short: 'Não enviado', hint: 'Exporte o PDF e envie ao aluno pelo WhatsApp.' };
    }
    const date = formatSentDate(plan.sentAt!);
    if (state === 'SENT') {
        return { state, label: `PDF enviado em ${date}`, short: `Enviado ${date}`, hint: `Versão atual enviada ao aluno em ${dateTime(plan.sentAt!)}.` };
    }
    return {
        state,
        label: `Alterado depois do envio (${date})`,
        short: 'Alterado após envio',
        hint: `O plano mudou depois do PDF de ${dateTime(plan.sentAt!)}. Exporte de novo para o aluno ter a versão atual.`,
    };
}
