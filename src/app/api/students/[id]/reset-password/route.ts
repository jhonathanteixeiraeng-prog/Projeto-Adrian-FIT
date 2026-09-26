import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { hasAppAccess } from '@/lib/student-access';
import { hash } from 'bcryptjs';

// PUT /api/students/[id]/reset-password - Reset student password
export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.personalId) {
            return NextResponse.json(
                { success: false, error: 'Acesso não autorizado' },
                { status: 401 }
            );
        }

        const studentId = params.id;

        // Verify student belongs to this personal
        const student = await prisma.student.findFirst({
            where: {
                id: studentId,
                personalId: session.user.personalId,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                    },
                },
            },
        });

        if (!student) {
            return NextResponse.json(
                { success: false, error: 'Aluno não encontrado' },
                { status: 404 }
            );
        }

        // A student registered without an e-mail has no login to reset (see student-access).
        if (!hasAppAccess(student.user.email)) {
            return NextResponse.json(
                { success: false, error: 'Este aluno não tem acesso ao app (foi cadastrado sem e-mail).' },
                { status: 400 }
            );
        }

        const body = await request.json();
        const { newPassword } = body;

        if (!newPassword || newPassword.length < 6) {
            return NextResponse.json(
                { success: false, error: 'A nova senha deve ter no mínimo 6 caracteres' },
                { status: 400 }
            );
        }

        // Hash the new password
        const hashedPassword = await hash(newPassword, 12);

        // Update the user's password
        await prisma.user.update({
            where: { id: student.userId },
            data: { password: hashedPassword },
        });

        // The new password also ends the sessions opened with the old one (see passwordStamp).
        return NextResponse.json({
            success: true,
            message: `Senha de ${student.user.name} redefinida. Os acessos abertos com a senha antiga foram encerrados.`,
        });
    } catch (error) {
        console.error('Error resetting password:', error);
        return NextResponse.json(
            { success: false, error: 'Erro ao redefinir senha' },
            { status: 500 }
        );
    }
}
