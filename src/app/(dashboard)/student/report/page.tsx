'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Loader2 } from 'lucide-react';

export default function StudentSelfReportPage() {
    const { data: session, status } = useSession();
    const router = useRouter();

    useEffect(() => {
        if (status === 'authenticated') {
            if (session?.user?.studentId) {
                router.replace(`/personal/students/${session.user.studentId}/report`);
            } else {
                router.replace('/student/progress');
            }
        } else if (status === 'unauthenticated') {
            router.replace('/login');
        }
    }, [status, session, router]);

    return (
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-[#F88022]" />
            <p className="text-sm text-muted-foreground">Abrindo relatório de evolução...</p>
        </div>
    );
}
