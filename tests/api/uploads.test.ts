import { NextRequest } from 'next/server';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next-auth', async (importOriginal) => ({ ...(await importOriginal<typeof import('next-auth')>()), getServerSession: vi.fn() }));

import { POST as upload } from '@/app/api/upload/route';
import { photoTypeOf } from '@/lib/photo-storage';
import { MAX_PHOTO_BYTES } from '@/lib/photo-url';
import { createPersonal, resetDatabase } from '../helpers/db';
import { json, signIn } from '../helpers/http';
import { removeTestPhotos } from '../helpers/photos';

// Local photo storage (the tests' folder): no Blob token, not on Vercel.
delete process.env.BLOB_READ_WRITE_TOKEN;
delete process.env.VERCEL;

beforeEach(resetDatabase);
afterAll(removeTestPhotos);

/** Bytes from numbers and latin1 text. */
const bytes = (...parts: Array<number[] | string>) =>
    new Uint8Array(parts.flatMap((part) => (typeof part === 'string' ? Array.from(Buffer.from(part, 'latin1')) : part)));
const JPEG = bytes([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10], 'JFIF', [0x00, 0xff, 0xd9]);
const PNG = bytes([0x89], 'PNG\r\n\x1a\n', [0, 0, 0, 0x0d], 'IHDR');

const send = (content: Uint8Array, type: string) => {
    const form = new FormData();
    form.append('file', new File([Buffer.from(content)], 'foto', { type }));
    return upload(new NextRequest('http://localhost:3000/api/upload', { method: 'POST', body: form }));
};

describe('photo uploads (A20)', () => {
    it('recognizes JPEG, PNG, WebP and HEIC/HEIF by their first bytes', () => {
        expect(photoTypeOf(JPEG)).toBe('image/jpeg');
        expect(photoTypeOf(PNG)).toBe('image/png');
        expect(photoTypeOf(bytes('RIFF', [0x24, 0, 0, 0], 'WEBPVP8 '))).toBe('image/webp');
        expect(photoTypeOf(bytes([0, 0, 0, 0x18], 'ftypheic', [0, 0, 0, 0]))).toBe('image/heic');
        expect(photoTypeOf(bytes([0, 0, 0, 0x18], 'ftypmif1'))).toBe('image/heif');
        expect(photoTypeOf(bytes([0, 0, 0, 0x1c], 'ftypavif'))).toBeNull();
        expect(photoTypeOf(bytes('<svg xmlns="http://www.w3.org/2000/svg">'))).toBeNull();
        expect(photoTypeOf(bytes([0xff, 0xd8]))).toBeNull();
    });

    it('stores what the file is, whatever type it declares', async () => {
        signIn((await createPersonal()).session);
        const png = await json(await send(PNG, 'image/jpeg'));
        expect(png.status).toBe(200);
        expect(png.body.url).toMatch(/^\/api\/photos\/.+\.png$/);

        const page = await json(await send(bytes('<html><script>alert(1)</script></html>'), 'image/jpeg'));
        expect(page.status).toBe(400);
    });

    it('refuses files above the limit and anyone signed out', async () => {
        signIn((await createPersonal()).session);
        const big = new Uint8Array(MAX_PHOTO_BYTES + 1);
        big.set(JPEG);
        const tooBig = await json(await send(big, 'image/jpeg'));
        expect(tooBig.status).toBe(400);
        expect(tooBig.body.error).toContain('4,5 MB');
        expect((await send(JPEG, 'image/jpeg')).status).toBe(200);

        signIn(null);
        expect((await send(JPEG, 'image/jpeg')).status).toBe(401);
    });
});
