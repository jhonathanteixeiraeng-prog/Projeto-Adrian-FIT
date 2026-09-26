import { whatsappLink } from '@/lib/whatsapp';

/** Links to the places a trainer jumps to from the chat and the dashboard. */
export const studentPaths = {
    /** CRM list with the student's side drawer open. */
    crm: (studentId: string) => `/personal/students?student=${encodeURIComponent(studentId)}`,
    workoutEditor: (studentId: string) => `/personal/students/${studentId}/workout`,
    dietEditor: (studentId: string) => `/personal/students/${studentId}/diet`,
    report: (studentId: string) => `/personal/students/${studentId}/report`,
};

/** WhatsApp link for a phone number, optionally with a pre-filled message (rules in lib/whatsapp). */
export const whatsappHref = whatsappLink;

export function formatCurrency(value: number, fractionDigits = 0): string {
    return value.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
    });
}
