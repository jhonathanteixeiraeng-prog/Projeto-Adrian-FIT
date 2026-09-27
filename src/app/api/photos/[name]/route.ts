import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { canViewPhoto, deleteUnusedPhotoFiles, isPhotoAttached, readPhoto } from '@/lib/photo-storage';
import { PHOTO_ROUTE, isPhotoName, photoOwner, photoOwnerKey } from '@/lib/photo-url';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ name: string }> };

const UNAUTHORIZED = { success: false, error: 'Não autorizado' };
// Same answer for "doesn't exist" and "not yours", so names can't be probed.
const notFound = () => NextResponse.json({ success: false, error: 'Foto não encontrada' }, { status: 404 });

// GET /api/photos/[name] - Streams a progress photo to its uploader, the student in it or that student's trainer.
export async function GET(request: NextRequest, props: Params) {
    const params = await props.params;
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) return NextResponse.json(UNAUTHORIZED, { status: 401 });
        if (!isPhotoName(params.name) || !(await canViewPhoto(session.user, params.name))) return notFound();

        const photo = await readPhoto(params.name, request.headers.get('if-none-match'));
        if (!photo) return notFound();
        // Revalidated on every view: a browser shared by two people must not reuse a cached photo.
        const headers = { ETag: photo.etag, 'Cache-Control': 'private, no-cache' };
        if (photo.status === 304) return new NextResponse(null, { status: 304, headers });
        return new NextResponse(photo.body, {
            headers: { ...headers, 'Content-Type': photo.contentType, 'X-Content-Type-Options': 'nosniff' },
        });
    } catch (error) {
        console.error('Error reading photo:', error);
        return NextResponse.json({ success: false, error: 'Erro ao carregar a foto' }, { status: 500 });
    }
}

// DELETE /api/photos/[name] - The uploader discards a photo that was never attached (a cancelled assessment,
// a replaced upload). Attached photos are deleted through their gallery or assessment.
export async function DELETE(_request: NextRequest, props: Params) {
    const params = await props.params;
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) return NextResponse.json(UNAUTHORIZED, { status: 401 });
        if (!isPhotoName(params.name) || photoOwner(params.name) !== photoOwnerKey(session.user.id)) return notFound();
        if (await isPhotoAttached(params.name)) {
            return NextResponse.json({ success: false, error: 'A foto já está salva. Exclua pela galeria ou pela avaliação.' }, { status: 409 });
        }
        await deleteUnusedPhotoFiles([`${PHOTO_ROUTE}${params.name}`]);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error discarding photo:', error);
        return NextResponse.json({ success: false, error: 'Erro ao descartar a foto' }, { status: 500 });
    }
}
