import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PhotoStorageUnavailableError, photoTypeOf, savePhoto } from '@/lib/photo-storage';
import { MAX_PHOTO_BYTES } from '@/lib/photo-url';

export const dynamic = 'force-dynamic';

// POST /api/upload - Stores a progress photo privately and returns its /api/photos/<name> URL,
// which only the uploader can open until it's attached to a check-in, an assessment or the gallery.
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, error: 'Acesso não autorizado' }, { status: 401 });
        }

        const formData = await request.formData();
        const file = formData.get('file');

        if (!file || typeof file === 'string') {
            return NextResponse.json({ success: false, error: 'Nenhum arquivo enviado' }, { status: 400 });
        }

        if (file.size > MAX_PHOTO_BYTES) {
            return NextResponse.json(
                { success: false, error: 'A foto passa de 4,5 MB. Envie uma foto menor.' },
                { status: 400 }
            );
        }

        // The file's first bytes say what it is; the declared type is whatever the client sent.
        const mimeType = photoTypeOf(new Uint8Array(await file.slice(0, 12).arrayBuffer()));
        if (!mimeType) {
            return NextResponse.json(
                { success: false, error: 'Formato de imagem não suportado. Use JPG, PNG ou WEBP.' },
                { status: 400 }
            );
        }

        try {
            const url = await savePhoto(file, session.user.id, mimeType);
            return NextResponse.json({ success: true, url, filename: url.slice(url.lastIndexOf('/') + 1) });
        } catch (error) {
            if (!(error instanceof PhotoStorageUnavailableError)) throw error;
            console.error('Photo storage is not configured (BLOB_READ_WRITE_TOKEN).');
            return NextResponse.json(
                { success: false, error: 'O armazenamento de fotos não está disponível agora. Tente mais tarde.' },
                { status: 503 }
            );
        }
    } catch (error) {
        console.error('Erro no upload de arquivo:', error);
        return NextResponse.json(
            { success: false, error: 'Erro interno ao processar upload' },
            { status: 500 }
        );
    }
}
