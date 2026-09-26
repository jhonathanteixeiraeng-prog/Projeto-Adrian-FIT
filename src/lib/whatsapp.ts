/**
 * WhatsApp links (wa.me) for the phone numbers typed in the student's record.
 *
 * Brazilian numbers can be typed with or without the country code: "(92) 99999-9999",
 * "92999999999", "0 92 99999-9999", "55 92 99999-9999". National numbers (10-11 digits,
 * including area code 55) get the 55 country code; longer numbers already carry one.
 * A leading "+" marks a full international number ("+1 415 555 1234"), kept as typed.
 */
export function whatsappNumber(phone: string | null | undefined): string | null {
    const raw = (phone ?? '').trim();
    const digits = raw.replace(/\D/g, '');
    if (raw.startsWith('+')) return digits.length >= 8 && digits.length <= 15 ? digits : null;

    // Trunk and international prefixes: "0 92 …", "00 55 92 …".
    const national = digits.replace(/^0+/, '');
    if (national.length === 10 || national.length === 11) return `55${national}`;
    if (national.length >= 12 && national.length <= 15) return national;
    return null;
}

/** "(92) 99999-9999" / "(92) 3232-1234" for Brazilian numbers, however they were typed; other numbers as typed. */
export function formatPhone(phone: string | null | undefined): string | null {
    const raw = (phone ?? '').trim();
    if (!raw) return null;
    const number = whatsappNumber(raw);
    if (!number || !number.startsWith('55') || (number.length !== 12 && number.length !== 13)) return raw;
    const national = number.slice(2);
    const split = national.length === 11 ? 7 : 6;
    return `(${national.slice(0, 2)}) ${national.slice(2, split)}-${national.slice(split)}`;
}

/** wa.me link, optionally with a pre-filled message; null when the phone can't be a WhatsApp number. */
export function whatsappLink(phone: string | null | undefined, text?: string): string | null {
    const number = whatsappNumber(phone);
    if (!number) return null;
    return `https://wa.me/${number}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}
