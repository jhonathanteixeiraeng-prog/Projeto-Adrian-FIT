/**
 * Progress photos from the trainer's computer: shrunk in the browser before POST /api/upload.
 * Phone photos are often 4–12 MB and a Vercel function refuses requests above 4.5 MB; 1600 px on
 * the longest side keeps before/after comparisons sharp at a few hundred KB.
 */

const MAX_SIDE = 1600;
const QUALITY = 0.85;
/** When the browser can't decode the file (e.g. HEIC outside Safari), the original must fit the request limit. */
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
        // Not decodable here: fall back to the original file.
    }
    if (file.size > MAX_ORIGINAL_BYTES) throw new Error('Foto grande demais ou em formato não suportado. Use JPG ou PNG.');
    return file;
}

/** Uploads one photo and returns its URL (to send in the assessment's `photos`). */
export async function uploadProgressPhoto(file: File): Promise<string> {
    if (!file.type.startsWith('image/')) throw new Error('Escolha um arquivo de imagem (JPG ou PNG).');
    const blob = await shrink(file);
    const form = new FormData();
    form.append('file', blob instanceof File ? blob : new File([blob], 'avaliacao.jpg', { type: 'image/jpeg' }));
    const response = await fetch('/api/upload', { method: 'POST', body: form });
    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.success || typeof body.url !== 'string') {
        throw new Error(body?.error || 'Não foi possível enviar a foto. Tente de novo.');
    }
    // The route's last resort is an inline data URL, which the assessment API doesn't store.
    if (body.url.startsWith('data:')) throw new Error('O armazenamento de fotos não está disponível agora. Tente mais tarde.');
    return body.url;
}
