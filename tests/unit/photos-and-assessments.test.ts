import { describe, expect, it } from 'vitest';
import { parseAssessmentBody } from '@/lib/assessments';
import { isOwnPhotoUrl, isPhotoName, photoNameFromUrl, photoOwner, photoOwnerKey } from '@/lib/photo-url';

const me = 'cmliga2zp0000t0ojz2fz1z74';
const other = 'cmotheruser0000abcdefghij';
const uuid = '3f2b8c1e-4d5a-4b6c-9d7e-8f9a0b1c2d3e';
const mine = `/api/photos/${me}-${uuid}.jpg`;

describe('private photo URLs', () => {
    it('accepts only "<owner>-<uuid>.<image ext>" names', () => {
        for (const ext of ['jpg', 'png', 'webp', 'heic', 'heif']) expect(isPhotoName(`${me}-${uuid}.${ext}`)).toBe(true);
        for (const bad of [
            `${me}-${uuid}.svg`,
            `${me}-${uuid}.jpg/..`,
            `../${me}-${uuid}.jpg`,
            `${me}-${uuid}.JPG`,
            `${me}-notauuid.jpg`,
            `-${uuid}.jpg`,
            `${me}_x-${uuid}.jpg`,
            `${me}-${uuid}.jpg.html`,
        ]) {
            expect(isPhotoName(bad), bad).toBe(false);
        }
    });

    it('reads the owner and the name from our URLs only', () => {
        expect(photoOwnerKey('abc_DEF-123')).toBe('abcDEF123');
        expect(photoOwner(`${me}-${uuid}.jpg`)).toBe(me);
        expect(photoNameFromUrl(mine)).toBe(`${me}-${uuid}.jpg`);
        for (const url of [
            'https://x.public.blob.vercel-storage.com/a.jpg',
            '/uploads/photos/a.jpg',
            'data:image/png;base64,AAA',
            `${mine}?x=1`,
            `https://evil.example/api/photos/${me}-${uuid}.jpg`,
            `/api/photos/../${me}-${uuid}.jpg`,
        ]) {
            expect(photoNameFromUrl(url), url).toBeNull();
        }
    });

    it("never lets a user attach someone else's upload", () => {
        expect(isOwnPhotoUrl(mine, me)).toBe(true);
        expect(isOwnPhotoUrl(mine, other)).toBe(false);
        expect(isOwnPhotoUrl('/uploads/photos/x.jpg', me)).toBe(false);
    });
});

describe('assessment payload', () => {
    const now = new Date('2026-09-26T15:00:00Z');
    const parse = (body: unknown, partial = false) => parseAssessmentBody(body, { partial, uploaderId: me, now });

    it('stores dates at noon UTC and parses Brazilian decimals', () => {
        const result = parse({ date: '2026-09-26', weight: '72,5', waist: 80, notes: '  ok  ', photos: [{ url: mine, angle: 'front' }] });
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.data.date?.toISOString()).toBe('2026-09-26T12:00:00.000Z');
        expect(result.data.measures).toMatchObject({ weight: 72.5, waist: 80 });
        expect(result.data.notes).toBe('ok');
        expect(result.data.addPhotos).toEqual([{ url: mine, angle: 'FRONT' }]);
    });

    it('rejects impossible values and future dates', () => {
        expect(parse({ date: '2026-02-30', weight: 70 })).toMatchObject({ ok: false });
        expect(parse({ date: '2026-12-01', weight: 70 })).toMatchObject({ ok: false });
        expect(parse({ date: '2026-09-26', weight: 10 })).toMatchObject({ ok: false });
        expect(parse({ date: '2026-09-26' })).toMatchObject({ ok: false });
    });

    it('only takes photos the trainer uploaded', () => {
        for (const url of [`/api/photos/${other}-${uuid}.jpg`, 'https://x.public.blob.vercel-storage.com/a.jpg', 'data:image/jpeg;base64,AAA']) {
            const result = parse({ date: '2026-09-26', photos: [{ url, angle: 'FRONT' }] });
            expect(result.ok, url).toBe(false);
        }
    });
});
