import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { Prisma } from '@prisma/client';
import { hash } from 'bcryptjs';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { hasAppAccess, isPlaceholderEmail } from '@/lib/student-access';

export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_IN_USE = { success: false, code: 'EMAIL_IN_USE', error: 'Este e-mail já está em uso. Use outro e-mail.' };

// PUT /api/students/[id]/access - "Criar acesso ao app": a student registered without e-mail gets a real
// e-mail and a password to sign in with (see student-access). Students who already have access use
// reset-password instead.
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const session = await getServerSession(authOptions);
        if (session?.user?.role !== 'PERSONAL' || !session.user.personalId) {
            return NextResponse.json({ success: false, error: 'Acesso não autorizado' }, { status: 401 });
        }
        const student = await prisma.student.findFirst({
            where: { id: params.id, personalId: session.user.personalId },
            select: { id: true, userId: true, user: { select: { email: true } } },
        });
        if (!student) return NextResponse.json({ success: false, error: 'Aluno não encontrado' }, { status: 404 });
        if (hasAppAccess(student.user.email)) {
            return NextResponse.json(
                { success: false, error: 'Este aluno já tem acesso ao app. Para trocar a senha, use "Redefinir senha".' },
                { status: 409 }
            );
        }

        const body = await request.json().catch(() => null);
        const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
        const password = typeof body?.password === 'string' ? body.password : '';
        if (!email || email.length > 200 || !EMAIL_RE.test(email) || isPlaceholderEmail(email)) {
            return NextResponse.json({ success: false, error: 'Informe um e-mail válido' }, { status: 400 });
        }
        if (password.length < 6 || password.length > 200) {
            return NextResponse.json({ success: false, error: 'A senha deve ter entre 6 e 200 caracteres' }, { status: 400 });
        }

        // Case-insensitive on SQLite and Postgres alike (older accounts may have been saved with capitals).
        const taken = await prisma.$queryRaw<Array<{ id: string }>>`SELECT id FROM "User" WHERE LOWER(email) = ${email}`;
        if (taken.length > 0) return NextResponse.json(EMAIL_IN_USE, { status: 409 });

        try {
            await prisma.user.update({ where: { id: student.userId }, data: { email, password: await hash(password, 12) } });
        } catch (error) {
            // Another request took the address in the meantime.
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                return NextResponse.json(EMAIL_IN_USE, { status: 409 });
            }
            throw error;
        }
        return NextResponse.json({ success: true, data: { email } });
    } catch (error) {
        console.error('Error creating app access:', error);
        return NextResponse.json({ success: false, error: 'Erro ao criar o acesso' }, { status: 500 });
    }
}
