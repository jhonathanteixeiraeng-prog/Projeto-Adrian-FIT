import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { promises as fs } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const ALLOWED_MIME_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
]);

const MAX_FILE_SIZE_BYTES = 12 * 1024 * 1024; // 12 MB

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, error: 'Acesso não autorizado' }, { status: 401 });
        }

        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json({ success: false, error: 'Nenhum arquivo enviado' }, { status: 400 });
        }

        if (file.size > MAX_FILE_SIZE_BYTES) {
            return NextResponse.json(
                { success: false, error: 'O arquivo excede o limite máximo de 12 MB' },
                { status: 400 }
            );
        }

        const mimeType = file.type || 'image/jpeg';
        if (!ALLOWED_MIME_TYPES.has(mimeType.toLowerCase())) {
            return NextResponse.json(
                { success: false, error: 'Formato de imagem não suportado. Use JPG, PNG ou WEBP.' },
                { status: 400 }
            );
        }

        const extension = mimeType.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
        const sanitizedPrefix = (session.user.id || 'usr').replace(/[^a-zA-Z0-9]/g, '');
        const filename = `${sanitizedPrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;

        // 1. Se Vercel Blob estiver configurado, usa upload nativo em nuvem
        if (process.env.BLOB_READ_WRITE_TOKEN) {
            try {
                const { put } = await import('@vercel/blob');
                const blob = await put(`progress-photos/${filename}`, file, {
                    access: 'public',
                    contentType: mimeType,
                });
                return NextResponse.json({
                    success: true,
                    url: blob.url,
                    filename,
                    provider: 'vercel-blob',
                });
            } catch (blobErr) {
                console.warn('Vercel blob upload falhou, tentando fallback local:', blobErr);
            }
        }

        // 2. Fallback para ambiente local ou servidor com disco
        try {
            const bytes = await file.arrayBuffer();
            const buffer = Buffer.from(bytes);
            const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'photos');
            await fs.mkdir(uploadDir, { recursive: true });
            const filePath = path.join(uploadDir, filename);
            await fs.writeFile(filePath, buffer);

            return NextResponse.json({
                success: true,
                url: `/uploads/photos/${filename}`,
                filename,
                provider: 'local',
            });
        } catch (fsErr) {
            console.error('Erro ao salvar localmente:', fsErr);
            // 3. Fallback de emergência (Data URL compacta se sistema de arquivos for read-only)
            const bytes = await file.arrayBuffer();
            const base64 = Buffer.from(bytes).toString('base64');
            const dataUrl = `data:${mimeType};base64,${base64}`;
            return NextResponse.json({
                success: true,
                url: dataUrl,
                filename,
                provider: 'data-url',
            });
        }
    } catch (error) {
        console.error('Erro no upload de arquivo:', error);
        return NextResponse.json(
            { success: false, error: 'Erro interno ao processar upload' },
            { status: 500 }
        );
    }
}
