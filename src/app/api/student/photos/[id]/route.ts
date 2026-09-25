import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
        }

        const photoId = params.id;
        const photo = await prisma.progressPhoto.findUnique({
            where: { id: photoId },
            include: { student: true },
        });

        if (!photo) {
            return NextResponse.json({ success: false, error: 'Foto não encontrada' }, { status: 404 });
        }

        // Permissão: somente o próprio aluno ou o personal dele pode excluir
        const isOwnerStudent = session.user.role === 'STUDENT' && session.user.studentId === photo.studentId;
        const isPersonal = session.user.role === 'PERSONAL' && session.user.personalId === photo.student.personalId;

        if (!isOwnerStudent && !isPersonal) {
            return NextResponse.json({ success: false, error: 'Acesso negado' }, { status: 403 });
        }

        await prisma.progressPhoto.delete({
            where: { id: photoId },
        });

        return NextResponse.json({ success: true, message: 'Foto excluída com sucesso' });
    } catch (error) {
        console.error('Erro ao excluir foto:', error);
        return NextResponse.json({ success: false, error: 'Erro ao excluir foto' }, { status: 500 });
    }
}
