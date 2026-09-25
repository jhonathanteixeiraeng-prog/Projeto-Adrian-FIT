import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// DELETE /api/diet-templates/[id] - Remove a model owned by the signed-in personal.
export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.personalId || session.user.role !== 'PERSONAL') {
            return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
        }

        const template = await prisma.dietTemplate.findFirst({
            where: { id: params.id, personalId: session.user.personalId },
            select: { id: true },
        });

        if (!template) {
            return NextResponse.json({ success: false, error: 'Modelo não encontrado' }, { status: 404 });
        }

        await prisma.dietTemplate.delete({ where: { id: template.id } });
        return NextResponse.json({ success: true, message: 'Modelo alimentar excluído com sucesso' });
    } catch (error) {
        console.error('Error deleting diet template:', error);
        return NextResponse.json({ success: false, error: 'Erro ao excluir modelo alimentar' }, { status: 500 });
    }
}
