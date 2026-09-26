import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PHOTO_EXTENSIONS, PhotoStorageUnavailableError, savePhoto } from '@/lib/photo-storage';

export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE_BYTES = 12 * 1024 * 1024; // 12 MB

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

        if (file.size > MAX_FILE_SIZE_BYTES) {
            return NextResponse.json(
                { success: false, error: 'O arquivo excede o limite máximo de 12 MB' },
                { status: 400 }
            );
        }

        const mimeType = (file.type || 'image/jpeg').toLowerCase();
        if (!PHOTO_EXTENSIONS[mimeType]) {
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
