import { createHash } from 'crypto';
import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';
import prisma from '@/lib/prisma';

/**
 * Fingerprint of the stored password hash, kept in the (encrypted) session JWT. Changing or resetting
 * the password changes it, so every session issued before stops working (audit A09).
 */
export function passwordStamp(passwordHash: string): string {
    return createHash('sha256').update(passwordHash).digest('base64url').slice(0, 22);
}

const SESSION_REVOKED = 'SESSION_REVOKED';

export const authOptions: NextAuthOptions = {
    providers: [
        CredentialsProvider({
            name: 'credentials',
            credentials: {
                email: { label: 'Email', type: 'email' },
                password: { label: 'Senha', type: 'password' },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    throw new Error('E-mail e senha são obrigatórios');
                }

                // Accounts created on the web are stored in lowercase; older ones may keep their original casing.
                const typedEmail = credentials.email.trim();
                const normalizedEmail = typedEmail.toLowerCase();
                const existing =
                    (await prisma.user.findUnique({ where: { email: typedEmail }, select: { id: true } })) ??
                    (normalizedEmail !== typedEmail
                        ? await prisma.user.findUnique({ where: { email: normalizedEmail }, select: { id: true } })
                        : null);

                const user = existing && await prisma.user.findUnique({
                    where: { id: existing.id },
                    include: {
                        personal: true,
                        student: {
                            include: {
                                personal: {
                                    include: {
                                        user: {
                                            select: { name: true }
                                        }
                                    }
                                }
                            }
                        },
                    },
                });

                if (!user) {
                    throw new Error('Usuário não encontrado');
                }

                const isPasswordValid = await compare(credentials.password, user.password);

                if (!isPasswordValid) {
                    throw new Error('Senha incorreta');
                }

                return {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role as 'PERSONAL' | 'STUDENT',
                    personalId: user.personal?.id,
                    studentId: user.student?.id,
                    personalTrainerName: user.student?.personal?.user?.name,
                    stamp: passwordStamp(user.password),
                };
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user, trigger }) {
            if (user) {
                token.id = user.id;
                token.role = user.role;
                token.personalId = user.personalId;
                token.studentId = user.studentId;
                token.personalTrainerName = user.personalTrainerName;
                token.stamp = user.stamp;
                return token;
            }
            // Every request: the account must still exist with the password this session was opened with.
            // Throwing makes NextAuth drop the session and clear its cookie (getServerSession returns null).
            if (!token.id || !token.stamp) throw new Error(SESSION_REVOKED);
            const current = await prisma.user
                .findUnique({ where: { id: token.id }, select: { password: true, name: true, email: true } })
                .catch((error) => {
                    // Database unavailable: keep the session, the request fails on its own anyway.
                    console.error('Could not check the session against the account:', error);
                    return undefined;
                });
            if (current === null || (current && passwordStamp(current.password) !== token.stamp)) {
                throw new Error(SESSION_REVOKED);
            }
            // useSession().update() after editing the profile: reload name/e-mail so the header shows them.
            if (trigger === 'update' && current) {
                token.name = current.name;
                token.email = current.email;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.id = token.id as string;
                session.user.role = token.role as 'PERSONAL' | 'STUDENT';
                session.user.personalId = token.personalId as string | undefined;
                session.user.studentId = token.studentId as string | undefined;
                session.user.personalTrainerName = token.personalTrainerName as string | undefined;
            }
            return session;
        },
    },
    pages: {
        signIn: '/login',
        error: '/login',
    },
    logger: {
        // A revoked session is expected (password changed elsewhere), not an error worth an alert.
        error(code, metadata) {
            const message = metadata instanceof Error ? metadata.message : (metadata as { message?: string } | undefined)?.message;
            if (code === 'JWT_SESSION_ERROR' && message === SESSION_REVOKED) {
                console.info('[auth] session ended: the password changed or the account is gone');
                return;
            }
            console.error(`[next-auth][error][${code}]`, metadata);
        },
    },
    session: {
        strategy: 'jwt',
        maxAge: 30 * 24 * 60 * 60, // 30 days
    },
    secret: process.env.NEXTAUTH_SECRET,
};

// Type augmentation for NextAuth
declare module 'next-auth' {
    interface User {
        id: string;
        role: 'PERSONAL' | 'STUDENT';
        personalId?: string;
        studentId?: string;
        personalTrainerName?: string;
        /** passwordStamp of the password used to sign in. */
        stamp?: string;
    }

    interface Session {
        user: User & {
            id: string;
            role: 'PERSONAL' | 'STUDENT';
            personalId?: string;
            studentId?: string;
            personalTrainerName?: string;
        };
    }
}

declare module 'next-auth/jwt' {
    interface JWT {
        id: string;
        role: 'PERSONAL' | 'STUDENT';
        personalId?: string;
        studentId?: string;
        personalTrainerName?: string;
        /** passwordStamp at sign-in; a different stamp now means the password changed (session ended). */
        stamp?: string;
    }
}
