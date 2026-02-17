import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';
import prisma from '@/lib/prisma';

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

                const user = await prisma.user.findUnique({
                    where: { email: credentials.email },
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
                    personalTrainerName: user.student?.personal?.user?.name
                };
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
                token.role = user.role;
                token.personalId = user.personalId;
                token.studentId = user.studentId;
                token.personalTrainerName = user.personalTrainerName;
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
    }
}
