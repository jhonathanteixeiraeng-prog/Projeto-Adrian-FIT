import { NextResponse } from 'next/server';
import { withAuth } from 'next-auth/middleware';

/**
 * Sends signed-out visitors (or expired sessions) to the login page, keeping the page they asked for
 * in `callbackUrl`, and keeps each role inside its own area.
 * API routes are not matched: they keep doing their own session checks (used by the iOS app too).
 */
export default withAuth(
    function middleware(request) {
        const role = request.nextauth.token?.role;
        const { pathname } = request.nextUrl;

        if (pathname.startsWith('/personal') && role !== 'PERSONAL') {
            return NextResponse.redirect(new URL(role === 'STUDENT' ? '/student/home' : '/login', request.url));
        }
        if (pathname.startsWith('/student') && role !== 'STUDENT') {
            return NextResponse.redirect(new URL(role === 'PERSONAL' ? '/personal/dashboard' : '/login', request.url));
        }
        return NextResponse.next();
    },
    {
        callbacks: {
            authorized: ({ token }) => Boolean(token),
        },
        pages: {
            signIn: '/login',
        },
    }
);

export const config = {
    matcher: ['/personal/:path*', '/student/:path*'],
};
