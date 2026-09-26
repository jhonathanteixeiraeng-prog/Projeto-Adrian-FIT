import type { Metadata } from 'next';
import { ResetPasswordForm } from './reset-password-form';

// The link's token is in the address: never send it to other sites as a referrer, and keep the page out of search.
export const metadata: Metadata = {
    title: 'Criar nova senha',
    referrer: 'no-referrer',
    robots: { index: false, follow: false },
};

export default function ResetPasswordPage() {
    return <ResetPasswordForm />;
}
