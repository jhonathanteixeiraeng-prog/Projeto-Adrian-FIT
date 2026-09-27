import { randomUUID } from 'crypto';
import { createReadStream, promises as fs } from 'fs';
import path from 'path';
import { Readable } from 'stream';
import prisma from '@/lib/prisma';
import { PHOTO_ROUTE, isPhotoName, photoNameFromUrl, photoOwner, photoOwnerKey } from '@/lib/photo-url';

/**
 * Server only. Where progress photos live:
 * - the private Vercel Blob store (BLOB_READ_WRITE_TOKEN), under progress-photos/;
 * - in local development without the token, .data/photos (outside public/, never served as is).
 * Every read goes through GET /api/photos/<name>, which asks canViewPhoto first.
 */

const BLOB_PREFIX = 'progress-photos/';
// Vitest runs with NODE_ENV=test: the tests get their own folder, apart from development's photos. Both
// paths stay literal: the deploy traces the files a function reads, and a computed path under
// process.cwd() makes it bundle the whole project.
const LOCAL_DIR =
    process.env.NODE_ENV === 'test' ? path.join(process.cwd(), '.data', 'test-photos') : path.join(process.cwd(), '.data', 'photos');

/** Accepted upload types and the extension each one is stored with. */
export const PHOTO_EXTENSIONS: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/heic': 'heic',
    'image/heif': 'heif',
};
const CONTENT_TYPES = Object.fromEntries(Object.entries(PHOTO_EXTENSIONS).map(([type, extension]) => [extension, type]));

const HEIC_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs']);
const HEIF_BRANDS = new Set(['mif1', 'msf1', 'heif']);

/**
 * The type of an image from its first 12 bytes (a PHOTO_EXTENSIONS key), or null when the file isn't a
 * JPEG, PNG, WebP or HEIC/HEIF image. Uploads are stored as what they are, not as the type they declare.
 */
export function photoTypeOf(bytes: Uint8Array): string | null {
    const head = Buffer.from(bytes.subarray(0, 12)).toString('latin1');
    if (head.startsWith('\xff\xd8\xff')) return 'image/jpeg';
    if (head.startsWith('\x89PNG\r\n\x1a\n')) return 'image/png';
    if (head.startsWith('RIFF') && head.slice(8, 12) === 'WEBP') return 'image/webp';
    if (head.slice(4, 8) === 'ftyp') {
        const brand = head.slice(8, 12);
        if (HEIC_BRANDS.has(brand)) return 'image/heic';
        if (HEIF_BRANDS.has(brand)) return 'image/heif';
    }
    return null;
}

export class PhotoStorageUnavailableError extends Error {}

function backend(): 'blob' | 'local' | null {
    if (process.env.BLOB_READ_WRITE_TOKEN) return 'blob';
    // Vercel functions can't keep files on disk: without the store there is nowhere to put photos.
    return process.env.VERCEL ? null : 'local';
}

/** Stores an upload and returns its /api/photos/<name> URL. `mimeType` must be a PHOTO_EXTENSIONS key. */
export async function savePhoto(file: Blob, userId: string, mimeType: string): Promise<string> {
    const name = `${photoOwnerKey(userId)}-${randomUUID()}.${PHOTO_EXTENSIONS[mimeType]}`;
    const target = backend();
    if (target === 'blob') {
        const { put } = await import('@vercel/blob');
        await put(`${BLOB_PREFIX}${name}`, file, { access: 'private', contentType: mimeType });
    } else if (target === 'local') {
        await fs.mkdir(LOCAL_DIR, { recursive: true });
        await fs.writeFile(path.join(LOCAL_DIR, name), Buffer.from(await file.arrayBuffer()));
    } else {
        throw new PhotoStorageUnavailableError('BLOB_READ_WRITE_TOKEN is not set');
    }
    return `${PHOTO_ROUTE}${name}`;
}

export type StoredPhoto =
    | { status: 200; body: ReadableStream<Uint8Array>; contentType: string; etag: string }
    | { status: 304; etag: string };

/** The file, or 304 when `ifNoneMatch` is its current ETag; null when it doesn't exist. */
export async function readPhoto(name: string, ifNoneMatch?: string | null): Promise<StoredPhoto | null> {
    if (!isPhotoName(name)) return null;
    const target = backend();
    if (target === 'blob') {
        const { get } = await import('@vercel/blob');
        const result = await get(`${BLOB_PREFIX}${name}`, { access: 'private', ifNoneMatch: ifNoneMatch ?? undefined });
        if (!result) return null;
        if (result.statusCode === 304) return { status: 304, etag: result.blob.etag };
        return { status: 200, body: result.stream, contentType: result.blob.contentType, etag: result.blob.etag };
    }
    if (target === 'local') {
        const file = path.join(LOCAL_DIR, name);
        const stat = await fs.stat(file).catch(() => null);
        if (!stat) return null;
        const etag = `"${stat.size.toString(36)}-${Math.round(stat.mtimeMs).toString(36)}"`;
        if (ifNoneMatch === etag) return { status: 304, etag };
        const extension = name.slice(name.lastIndexOf('.') + 1);
        const body = Readable.toWeb(createReadStream(file)) as unknown as ReadableStream<Uint8Array>;
        return { status: 200, body, contentType: CONTENT_TYPES[extension], etag };
    }
    return null;
}

/** The uploader, the student in the photo and that student's trainer. */
export async function canViewPhoto(user: { id: string; personalId?: string | null }, name: string): Promise<boolean> {
    if (photoOwner(name) === photoOwnerKey(user.id)) return true;
    const photo = await prisma.progressPhoto.findFirst({
        where: {
            url: `${PHOTO_ROUTE}${name}`,
            // Optional ids never go into a filter unset: Prisma would drop the condition.
            OR: [{ student: { userId: user.id } }, ...(user.personalId ? [{ student: { personalId: user.personalId } }] : [])],
        },
        select: { id: true },
    });
    return photo !== null;
}

export async function isPhotoAttached(name: string): Promise<boolean> {
    return (await prisma.progressPhoto.count({ where: { url: `${PHOTO_ROUTE}${name}` } })) > 0;
}

/**
 * Deletes the files behind photo rows that were just removed. Files another row still uses are kept;
 * older URLs (data URLs, public links) have no file here. Best effort: failures are only logged.
 */
export async function deleteUnusedPhotoFiles(urls: string[]): Promise<void> {
    const names = Array.from(new Set(urls.map(photoNameFromUrl).filter((name): name is string => name !== null)));
    if (names.length === 0) return;
    try {
        const used = await prisma.progressPhoto.findMany({
            where: { url: { in: names.map((name) => `${PHOTO_ROUTE}${name}`) } },
            select: { url: true },
        });
        const usedUrls = new Set(used.map((photo) => photo.url));
        const unused = names.filter((name) => !usedUrls.has(`${PHOTO_ROUTE}${name}`));
        if (unused.length === 0) return;

        const target = backend();
        if (target === 'blob') {
            const { del } = await import('@vercel/blob');
            await del(unused.map((name) => `${BLOB_PREFIX}${name}`));
        } else if (target === 'local') {
            await Promise.all(unused.map((name) => fs.rm(path.join(LOCAL_DIR, name), { force: true })));
        }
    } catch (error) {
        console.error('Could not delete photo files:', error);
    }
}
