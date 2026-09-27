import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

/**
 * Terms of use and privacy policy (LGPD), public. Written from what the system actually does; every
 * statement here should stay true when the code changes (photos, deletion, providers, AI).
 * The responsible party and contact are filled in by the trainer before publishing.
 */

const RESPONSIBLE_NAME = '';
const CONTACT_EMAIL = '';
const LAST_UPDATED = '26/09/2026';

export const metadata: Metadata = {
    title: 'Termos de Uso e Privacidade · Adrian Fit',
    description: 'Como o Adrian Fit funciona e como cuidamos dos seus dados.',
};

/** A value still to be filled in: highlighted so it can't go unnoticed. */
function Pending({ children }: { children: string }) {
    return <mark className="rounded bg-amber-200 px-1 text-amber-950 dark:bg-amber-500/30 dark:text-amber-100">[{children}]</mark>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">{title}</h2>
            <div className="space-y-3 text-[15px] leading-relaxed text-muted-foreground">{children}</div>
        </section>
    );
}

export default function TermsPage() {
    const responsible = RESPONSIBLE_NAME || <Pending>nome do personal responsável</Pending>;
    const contact = CONTACT_EMAIL ? (
        <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-[#F88022] hover:underline">
            {CONTACT_EMAIL}
        </a>
    ) : (
        <Pending>e-mail de contato</Pending>
    );

    return (
        <main className="min-h-screen bg-background px-4 py-10 sm:px-6">
            <article className="mx-auto max-w-2xl space-y-8">
                <header className="space-y-3">
                    <Link href="/login" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                        <ArrowLeft className="h-4 w-4" />
                        Voltar
                    </Link>
                    <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Termos de Uso e Política de Privacidade</h1>
                    <p className="text-sm text-muted-foreground">Última atualização: {LAST_UPDATED}</p>
                </header>

                <Section title="1. O que é o Adrian Fit">
                    <p>
                        O Adrian Fit é o sistema que o personal trainer {responsible} usa para acompanhar seus alunos: fichas de treino,
                        planos alimentares, avaliações físicas, fotos de evolução e mensagens. O personal monta os treinos e as dietas no
                        sistema e pode enviá-los ao aluno em PDF pelo WhatsApp.
                    </p>
                    <p>
                        Não existe cadastro aberto: o acesso de cada aluno é criado pelo personal. Ao usar o sistema, você concorda com
                        estes termos.
                    </p>
                </Section>

                <Section title="2. Quem cuida dos seus dados">
                    <p>
                        O responsável pelos dados (controlador, na LGPD) é {responsible}. Para qualquer pedido ou dúvida sobre os seus
                        dados, escreva para {contact}.
                    </p>
                </Section>

                <Section title="3. Quais dados usamos">
                    <ul className="list-disc space-y-2 pl-5">
                        <li>
                            <strong className="text-foreground">Identificação e contato:</strong> nome, e-mail e telefone (WhatsApp).
                        </li>
                        <li>
                            <strong className="text-foreground">Dados físicos e de saúde</strong> informados ao personal: data de nascimento,
                            sexo, altura, peso, medidas, avaliações físicas, fotos de evolução e a anamnese (objetivo, nível de atividade,
                            restrições, lesões, medicamentos e observações). Na LGPD, dados de saúde são dados pessoais sensíveis e recebem
                            cuidado redobrado.
                        </li>
                        <li>
                            <strong className="text-foreground">Acompanhamento:</strong> fichas de treino, planos alimentares, check-ins,
                            registros de treino e mensagens com o personal.
                        </li>
                        <li>
                            <strong className="text-foreground">Segurança:</strong> registros técnicos necessários para proteger a conta,
                            como a contagem de tentativas de login. Não usamos cookies de publicidade nem rastreamento de terceiros.
                        </li>
                    </ul>
                    <p>Alunos menores de 18 anos usam o sistema com a autorização de um responsável legal.</p>
                </Section>

                <Section title="4. Para que usamos">
                    <p>
                        Somente para o seu acompanhamento com o personal: montar e ajustar treinos e dietas, acompanhar a sua evolução,
                        gerar os PDFs que você recebe, permitir a conversa entre vocês e manter a sua conta segura. Não vendemos dados
                        nem os usamos para publicidade.
                    </p>
                </Section>

                <Section title="5. Quem tem acesso">
                    <p>
                        Você e o seu personal. As fotos de evolução ficam em armazenamento privado e só abrem para você e para ele. Os PDFs
                        de treino, dieta e relatório são enviados pelo personal pelo WhatsApp e, a partir daí, ficam também nas conversas de
                        vocês.
                    </p>
                    <p>Para funcionar, o sistema usa serviços de tecnologia que tratam os dados apenas para operá-lo:</p>
                    <ul className="list-disc space-y-2 pl-5">
                        <li>
                            <strong className="text-foreground">Vercel</strong>: hospedagem do site e armazenamento privado das fotos.
                        </li>
                        <li>
                            <strong className="text-foreground">Neon</strong>: banco de dados.
                        </li>
                        <li>
                            <strong className="text-foreground">Resend</strong>: envio dos e-mails de redefinição de senha.
                        </li>
                        <li>
                            <strong className="text-foreground">OpenAI</strong>: quando o personal pede um rascunho de dieta com inteligência
                            artificial, recebe idade, sexo, altura, peso, objetivo, nível de atividade, restrições, medicamentos e as
                            observações do personal, sem o seu nome nem contato. Todo rascunho é revisado pelo personal antes de chegar a
                            você.
                        </li>
                    </ul>
                    <p>Esses serviços podem guardar dados em servidores fora do Brasil, dentro das regras da LGPD.</p>
                </Section>

                <Section title="6. Por quanto tempo guardamos">
                    <p>
                        Enquanto você for acompanhado pelo personal. Quando ele exclui um aluno, o sistema apaga o acesso, os treinos, as
                        dietas, as avaliações, as fotos (inclusive os arquivos) e as mensagens. Cópias de segurança do banco de dados podem
                        manter informações por um período curto até serem substituídas.
                    </p>
                </Section>

                <Section title="7. Segurança">
                    <p>
                        As senhas são guardadas de forma cifrada, e ninguém consegue lê-las no sistema. As conexões usam HTTPS, as fotos são
                        privadas, trocar a senha encerra as sessões abertas em outros aparelhos e há um limite de tentativas de login. Se o
                        personal criou a sua senha, troque-a no seu perfil, e não a compartilhe com ninguém.
                    </p>
                </Section>

                <Section title="8. Seus direitos">
                    <p>
                        Pela LGPD, você pode pedir a confirmação de que tratamos seus dados, acesso a eles, correção, exclusão, portabilidade,
                        informações sobre com quem são compartilhados e revogar um consentimento que tenha dado. Para isso, escreva para{' '}
                        {contact}.
                    </p>
                </Section>

                <Section title="9. Uso do sistema">
                    <p>
                        O acesso é pessoal. Os treinos e as dietas são orientações do seu personal, que é o profissional responsável por
                        eles; o sistema é a ferramenta que organiza esse acompanhamento. Em caso de dor, lesão ou qualquer condição de saúde,
                        procure também um profissional de saúde.
                    </p>
                </Section>

                <Section title="10. Mudanças neste texto">
                    <p>Se estes termos mudarem, a data no topo da página será atualizada.</p>
                </Section>
            </article>
        </main>
    );
}
