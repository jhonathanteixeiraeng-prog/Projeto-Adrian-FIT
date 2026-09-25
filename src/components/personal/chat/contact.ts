/** Links to the places a trainer jumps to from the chat and the dashboard. */
export const studentPaths = {
    /** CRM list with the student's side drawer open. */
    crm: (studentId: string) => `/personal/students?student=${encodeURIComponent(studentId)}`,
    workoutEditor: (studentId: string) => `/personal/students/${studentId}/workout`,
    dietEditor: (studentId: string) => `/personal/students/${studentId}/diet`,
    report: (studentId: string) => `/personal/students/${studentId}/report`,
};

/**
 * WhatsApp link for a phone number, optionally with a pre-filled message.
 * Local Brazilian numbers (10-11 digits) get the 55 country code.
 */
export function whatsappHref(phone: string | null | undefined, text?: string): string | null {
    const digits = (phone || '').replace(/\D/g, '');
    if (digits.length < 10) return null;
    const full = digits.length >= 12 ? digits : `55${digits}`;
    return text ? `https://wa.me/${full}?text=${encodeURIComponent(text)}` : `https://wa.me/${full}`;
}

export function formatCurrency(value: number, fractionDigits = 0): string {
    return value.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
    });
}
