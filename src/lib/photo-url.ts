/**
 * Progress photo URLs. The files are private (see src/lib/photo-storage.ts): clients only get
 * /api/photos/<name>, and <name> starts with the uploader's user id, so the uploader can see a photo
 * before it is attached to a check-in or an assessment, and nobody can attach someone else's upload.
 */

export const PHOTO_ROUTE = '/api/photos/';

/**
 * Largest photo POST /api/upload takes. Vercel functions refuse request bodies above 4.5 MB before the
 * app sees them, so this leaves room for the multipart envelope.
 */
export const MAX_PHOTO_BYTES = 4 * 1024 * 1024;

// "<owner>-<uuid>.<ext>": no slashes or extra dots, so it's safe as a URL segment and a file name.
const PHOTO_NAME = /^([A-Za-z0-9]+)-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|heic|heif)$/;

/** User ids are cuids; the key keeps only letters and digits. */
export const photoOwnerKey = (userId: string) => userId.replace(/[^A-Za-z0-9]/g, '');

export const isPhotoName = (name: string) => PHOTO_NAME.test(name);

/** Owner key in a photo name, or null when it isn't one. */
export const photoOwner = (name: string) => PHOTO_NAME.exec(name)?.[1] ?? null;

/** The file name of a /api/photos/<name> URL, or null for anything else. */
export function photoNameFromUrl(url: string): string | null {
    if (!url.startsWith(PHOTO_ROUTE)) return null;
    const name = url.slice(PHOTO_ROUTE.length);
    return isPhotoName(name) ? name : null;
}

/** Only photos the user uploaded can be attached to a check-in, an assessment or the gallery. */
export function isOwnPhotoUrl(url: string, userId: string): boolean {
    const name = photoNameFromUrl(url);
    return name !== null && photoOwner(name) === photoOwnerKey(userId);
}
