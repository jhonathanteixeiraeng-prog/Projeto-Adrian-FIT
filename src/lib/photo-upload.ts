/**
 * Browser only. Progress photos from the web pages (the trainer's assessments, the student's check-ins
 * and gallery): shrunk in the browser before POST /api/upload. Phone photos are often 4–12 MB and a Vercel
 * function refuses requests above 4.5 MB; 1600 px on the longest side keeps before/after comparisons sharp
 * at a few hundred KB.
 */

const MAX_SIDE = 1600;
const QUALITY = 0.85;
/** An original sent as is must leave room for the multipart envelope under the 4.5 MB request limit. */
const MAX_ORIGINAL_BYTES = 4 * 1024 * 1024;

async function shrink(file: File): Promise<Blob> {
    try {
        const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
        const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close();
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
        if (blob) return blob;
    } catch {
        // Not decodable here (e.g. HEIC outside Safari): the original goes as is, so it must fit the upload limit.
    }
    if (file.size > MAX_ORIGINAL_BYTES) throw new Error('Foto grande demais ou em formato não suportado. Use JPG ou PNG.');
    return file;
}

/** Uploads one photo and returns its private /api/photos/<name> URL (to send in the assessment's `photos`). */
export async function uploadProgressPhoto(file: File): Promise<string> {
    if (!file.type.startsWith('image/')) throw new Error('Escolha um arquivo de imagem (JPG ou PNG).');
    const blob = await shrink(file);
    const form = new FormData();
    form.append('file', blob instanceof File ? blob : new File([blob], 'avaliacao.jpg', { type: 'image/jpeg' }));
    const response = await fetch('/api/upload', { method: 'POST', body: form });
    // Refused by the platform before reaching the app, so there's no JSON message.
    if (response.status === 413) throw new Error('Foto grande demais para enviar. Use uma foto de até 4 MB.');
    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.success || typeof body.url !== 'string') {
        throw new Error(body?.error || 'Não foi possível enviar a foto. Tente de novo.');
    }
    return body.url;
}

/** Deletes an upload that won't be saved (replaced, removed or the dialog was cancelled). Best effort. */
export function discardUploadedPhoto(url: string) {
    void fetch(url, { method: 'DELETE' }).catch(() => undefined);
}
