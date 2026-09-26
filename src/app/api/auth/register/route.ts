import { NextResponse } from 'next/server';

/**
 * Public sign-up is closed. Students get their access from the trainer (POST /api/students, which
 * also creates the student profile). Self-registered accounts had no profile, and routes that
 * filtered by the missing studentId exposed other students' data (audit A01); open trainer sign-up
 * also reached the paid diet generator with no quota (A10).
 */
export async function POST() {
    return NextResponse.json(
        { success: false, error: 'Cadastro indisponível. O acesso é criado pelo seu personal trainer.' },
        { status: 403 }
    );
}
