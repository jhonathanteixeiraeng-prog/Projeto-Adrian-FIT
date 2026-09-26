import Link from 'next/link';
import { ArrowRight, Dumbbell } from 'lucide-react';

/** Public sign-up is closed (see /api/auth/register): the trainer creates every student's access. */
export default function RegisterPage() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-6">
            <div className="w-full max-w-sm animate-in text-center">
                <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-[#F88022] text-white shadow-lg shadow-[#F88022]/30">
                    <Dumbbell className="h-8 w-8" />
                </div>
                <h1 className="mb-2 text-2xl font-bold text-foreground">O acesso é criado pelo personal</h1>
                <p className="mb-8 text-muted-foreground">
                    Não há cadastro aberto. Se você é aluno, peça o seu acesso ao seu personal trainer.
                </p>
                <Link
                    href="/login"
                    className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#F88022] px-5 font-semibold text-white transition-colors hover:bg-[#F88022]/90"
                >
                    Ir para o login
                    <ArrowRight className="h-5 w-5" />
                </Link>
            </div>
        </div>
    );
}
