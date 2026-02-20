import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

type ExerciseSeed = {
    name: string;
    muscleGroup: string;
    equipment: string;
    difficulty: 'INICIANTE' | 'INTERMEDIARIO' | 'AVANCADO';
    instructions: string;
    tips: string;
};

const EXERCISE_LIBRARY: ExerciseSeed[] = [
    // Peito
    {
        name: 'Supino Reto',
        muscleGroup: 'Peito',
        equipment: 'Barra Reta',
        difficulty: 'INTERMEDIARIO',
        instructions: 'Deite no banco reto, desca a barra ate a linha do peito e empurre ate estender os cotovelos.',
        tips: 'Mantenha escapulas retraidas e pes firmes no chao.',
    },
    {
        name: 'Supino Inclinado',
        muscleGroup: 'Peito',
        equipment: 'Halteres',
        difficulty: 'INTERMEDIARIO',
        instructions: 'No banco inclinado, desca os halteres em direcao ao peito superior e empurre controlado.',
        tips: 'Nao deixe os cotovelos abrirem demais.',
    },
    {
        name: 'Supino Declinado com Barra',
        muscleGroup: 'Peito',
        equipment: 'Barra Reta',
        difficulty: 'INTERMEDIARIO',
        instructions: 'No banco declinado, desca a barra ate o peitoral inferior e retorne.',
        tips: 'Controle a fase de descida para maior estimulo muscular.',
    },
    {
        name: 'Crucifixo Reto com Halteres',
        muscleGroup: 'Peito',
        equipment: 'Halteres',
        difficulty: 'INICIANTE',
        instructions: 'Com leve flexao dos cotovelos, abra os bracos e feche mantendo tensao no peito.',
        tips: 'Evite bater halteres no topo do movimento.',
    },
    {
        name: 'Crucifixo Inclinado com Halteres',
        muscleGroup: 'Peito',
        equipment: 'Halteres',
        difficulty: 'INICIANTE',
        instructions: 'Em banco inclinado, abra os bracos lateralmente e volte com controle.',
        tips: 'Foque no alongamento do peitoral na fase excêntrica.',
    },
    {
        name: 'Crossover na Polia Alta',
        muscleGroup: 'Peito',
        equipment: 'Polia Dupla',
        difficulty: 'INTERMEDIARIO',
        instructions: 'Puxe as manoplas da polia alta para frente do corpo, cruzando levemente as maos.',
        tips: 'Mantenha o tronco estavel e sem balanco.',
    },
    {
        name: 'Peck Deck',
        muscleGroup: 'Peito',
        equipment: 'Fly Machine',
        difficulty: 'INICIANTE',
        instructions: 'Sente na maquina e aproxime os bracos na frente do peito com controle.',
        tips: 'Ajuste o banco para alinhar pegada com a linha do peito.',
    },
    {
        name: 'Chest Press Maquina Articulada',
        muscleGroup: 'Peito',
        equipment: 'Chest Press',
        difficulty: 'INICIANTE',
        instructions: 'Empurre os bracos da maquina a frente ate estender os cotovelos sem travar.',
        tips: 'Desca devagar para manter a tensao.',
    },
    {
        name: 'Flexao de Braco',
        muscleGroup: 'Peito',
        equipment: 'Peso Corporal',
        difficulty: 'INICIANTE',
        instructions: 'Com maos no chao na linha do peito, desca o tronco e empurre para cima.',
        tips: 'Mantenha corpo alinhado durante todo o movimento.',
    },

    // Costas
    {
        name: 'Puxada Frontal Aberta',
        muscleGroup: 'Costas',
        equipment: 'Pulldown',
        difficulty: 'INICIANTE',
        instructions: 'Puxe a barra da polia alta em direcao ao peito, trazendo cotovelos para baixo.',
        tips: 'Evite jogar o tronco para tras excessivamente.',
    },
    {
        name: 'Puxada Frontal Supinada',
        muscleGroup: 'Costas',
        equipment: 'Pulldown',
        difficulty: 'INTERMEDIARIO',
        instructions: 'Com pegada supinada, puxe a barra ao peito com controle.',
        tips: 'Foque em fechar as escapulas no final.',
    },
    {
        name: 'Remada Curvada',
        muscleGroup: 'Costas',
        equipment: 'Barra Reta',
        difficulty: 'INTERMEDIARIO',
        instructions: 'Com tronco inclinado, puxe a barra em direcao ao umbigo.',
        tips: 'Mantenha coluna neutra e abdomen ativo.',
    },
    {
        name: 'Remada Unilateral com Halter',
        muscleGroup: 'Costas',
        equipment: 'Halteres',
        difficulty: 'INICIANTE',
        instructions: 'Com um joelho apoiado no banco, puxe o halter em direcao ao quadril.',
        tips: 'Evite rotacionar o tronco.',
    },
    {
        name: 'Remada Baixa na Polia',
        muscleGroup: 'Costas',
        equipment: 'Polia Baixa',
        difficulty: 'INICIANTE',
        instructions: 'Puxe a manopla para perto do abdomen mantendo peito aberto.',
        tips: 'Nao deixe os ombros avancarem no inicio da puxada.',
    },
    {
        name: 'Remada Cavalinho',
        muscleGroup: 'Costas',
        equipment: 'Barra T',
        difficulty: 'INTERMEDIARIO',
        instructions: 'Com o peito apoiado ou tronco inclinado, puxe a carga ate o tronco.',
        tips: 'Conduza com os cotovelos e nao com os punhos.',
    },
    {
        name: 'Pulldown com Bracos Estendidos',
        muscleGroup: 'Costas',
        equipment: 'Polia Alta',
        difficulty: 'INTERMEDIARIO',
        instructions: 'Com bracos estendidos, desca a barra ate a linha da coxa.',
        tips: 'Mantenha leve inclinacao do tronco e cotovelos sem dobrar demais.',
    },
    {
        name: 'Barra Fixa Pronada',
        muscleGroup: 'Costas',
        equipment: 'Barra Fixa',
        difficulty: 'AVANCADO',
        instructions: 'Pendure na barra e eleve o corpo ate o queixo passar da barra.',
        tips: 'Evite impulso com pernas para priorizar dorsais.',
    },
    {
        name: 'Remada Maquina Articulada',
        muscleGroup: 'Costas',
        equipment: 'Remada Maquina',
        difficulty: 'INICIANTE',
        instructions: 'Sente e puxe os bracos da maquina em direcao ao tronco.',
        tips: 'Mantenha peito apoiado para reduzir compensacoes.',
    },

    // Ombro
    {
        name: 'Desenvolvimento Militar com Barra',
        muscleGroup: 'Ombro',
        equipment: 'Barra Reta',
        difficulty: 'INTERMEDIARIO',
        instructions: 'Empurre a barra acima da cabeca ate estender os cotovelos.',
        tips: 'Nao hiperestenda a lombar.',
    },
    {
        name: 'Desenvolvimento com Halteres',
        muscleGroup: 'Ombro',
        equipment: 'Halteres',
        difficulty: 'INTERMEDIARIO',
        instructions: 'Sentado ou em pe, empurre os halteres para cima e desca controlado.',
        tips: 'Mantenha antebracos alinhados com os cotovelos.',
    },
    {
        name: 'Desenvolvimento na Maquina',
        muscleGroup: 'Ombro',
        equipment: 'Shoulder Press Maquina',
        difficulty: 'INICIANTE',
        instructions: 'Empurre os bracos da maquina ate quase estender totalmente os cotovelos.',
        tips: 'Ajuste o assento para ombros ficarem alinhados com a pegada.',
    },
    {
        name: 'Elevacao Lateral com Halteres',
        muscleGroup: 'Ombro',
        equipment: 'Halteres',
        difficulty: 'INICIANTE',
        instructions: 'Eleve os bracos lateralmente ate a altura dos ombros.',
        tips: 'Suba com cotovelos levemente acima das maos.',
    },
    {
        name: 'Elevacao Lateral na Polia',
        muscleGroup: 'Ombro',
        equipment: 'Polia Baixa',
        difficulty: 'INTERMEDIARIO',
        instructions: 'Com uma mao por vez, eleve a manopla lateralmente com controle.',
        tips: 'Mantenha ombros baixos e sem encolher trapezio.',
    },
    {
        name: 'Elevacao Frontal com Halteres',
        muscleGroup: 'Ombro',
        equipment: 'Halteres',
        difficulty: 'INICIANTE',
        instructions: 'Eleve os halteres a frente ate a altura dos ombros e retorne.',
        tips: 'Evite impulso do quadril.',
    },
    {
        name: 'Crucifixo Inverso no Peck Deck',
        muscleGroup: 'Ombro',
        equipment: 'Fly Machine',
        difficulty: 'INICIANTE',
        instructions: 'Sentado invertido na maquina, abra os bracos para tras.',
        tips: 'Foque no deltoide posterior e escápulas.',
    },
    {
        name: 'Face Pull na Polia',
        muscleGroup: 'Ombro',
        equipment: 'Polia Alta',
        difficulty: 'INTERMEDIARIO',
        instructions: 'Puxe a corda em direcao ao rosto abrindo os cotovelos.',
        tips: 'Mantenha punhos neutros e controle o retorno.',
    },

    // Biceps
    {
        name: 'Rosca Direta Barra Reta',
        muscleGroup: 'Bíceps',
        equipment: 'Barra Reta',
        difficulty: 'INICIANTE',
        instructions: 'Flexione os cotovelos levando a barra em direcao ao peito.',
        tips: 'Evite balancar o tronco.',
    },
    {
        name: 'Rosca Direta Barra W',
        muscleGroup: 'Bíceps',
        equipment: 'Barra W',
        difficulty: 'INICIANTE',
        instructions: 'Com pegada confortavel na barra W, eleve e desca com controle.',
        tips: 'Mantenha cotovelos fixos ao lado do corpo.',
    },
    {
        name: 'Rosca Alternada com Halteres',
        muscleGroup: 'Bíceps',
        equipment: 'Halteres',
        difficulty: 'INICIANTE',
        instructions: 'Alterne os bracos realizando flexao de cotovelo com supinacao.',
        tips: 'Nao deixe o ombro participar do movimento.',
    },
    {
        name: 'Rosca Martelo com Halteres',
        muscleGroup: 'Bíceps',
        equipment: 'Halteres',
        difficulty: 'INICIANTE',
        instructions: 'Com pegada neutra, flexione os cotovelos e retorne devagar.',
        tips: 'Mantenha punhos neutros durante toda a execucao.',
    },
    {
        name: 'Rosca Concentrada Unilateral',
        muscleGroup: 'Bíceps',
        equipment: 'Halteres',
        difficulty: 'INTERMEDIARIO',
        instructions: 'Sentado, apoie o cotovelo na coxa e flexione o halter.',
        tips: 'Segure 1 segundo na contracao maxima.',
    },
    {
        name: 'Rosca Scott Maquina',
        muscleGroup: 'Bíceps',
        equipment: 'Banco Scott',
        difficulty: 'INICIANTE',
        instructions: 'Apoie os bracos no banco e realize a flexao completa do cotovelo.',
        tips: 'Nao estenda totalmente os cotovelos no final da descida.',
    },
    {
        name: 'Rosca Scott com Barra W',
        muscleGroup: 'Bíceps',
        equipment: 'Barra W',
        difficulty: 'INTERMEDIARIO',
        instructions: 'No banco Scott, eleve a barra W com controle da descida.',
        tips: 'Evite tirar os bracos do apoio.',
    },
    {
        name: 'Rosca na Polia Baixa',
        muscleGroup: 'Bíceps',
        equipment: 'Polia Baixa',
        difficulty: 'INTERMEDIARIO',
        instructions: 'Puxe a barra da polia baixa ate contrair os biceps.',
        tips: 'Mantenha tensao continua sem relaxar no fundo.',
    },

    // Triceps
    {
        name: 'Tríceps Pulley Barra Reta',
        muscleGroup: 'Tríceps',
        equipment: 'Polia Alta',
        difficulty: 'INICIANTE',
        instructions: 'Empurre a barra para baixo estendendo os cotovelos.',
        tips: 'Nao mova os ombros durante o exercicio.',
    },
    {
        name: 'Tríceps Pulley Corda',
        muscleGroup: 'Tríceps',
        equipment: 'Polia Alta',
        difficulty: 'INICIANTE',
        instructions: 'Empurre a corda para baixo e abra as pontas no final.',
        tips: 'Mantenha cotovelos fixos ao lado do tronco.',
    },
    {
        name: 'Tríceps Francês Unilateral',
        muscleGroup: 'Tríceps',
        equipment: 'Halteres',
        difficulty: 'INTERMEDIARIO',
        instructions: 'Com um halter acima da cabeca, flexione e estenda o cotovelo.',
        tips: 'Controle a descida para maior recrutamento.',
    },
    {
        name: 'Tríceps Testa Barra W',
        muscleGroup: 'Tríceps',
        equipment: 'Barra W',
        difficulty: 'INTERMEDIARIO',
        instructions: 'Deitado no banco, leve a barra em direcao a testa e estenda os cotovelos.',
        tips: 'Cotovelos apontados para cima durante o movimento.',
    },
    {
        name: 'Tríceps Banco',
        muscleGroup: 'Tríceps',
        equipment: 'Banco Reto',
        difficulty: 'INICIANTE',
        instructions: 'Com as maos no banco atras do corpo, desca e suba flexionando cotovelos.',
        tips: 'Mantenha quadril proximo ao banco.',
    },
    {
        name: 'Mergulho nas Paralelas',
        muscleGroup: 'Tríceps',
        equipment: 'Paralelas',
        difficulty: 'AVANCADO',
        instructions: 'Nas barras paralelas, desca o corpo e empurre para cima.',
        tips: 'Mantenha tronco mais vertical para focar mais em triceps.',
    },
    {
        name: 'Tríceps Coice com Halter',
        muscleGroup: 'Tríceps',
        equipment: 'Halteres',
        difficulty: 'INICIANTE',
        instructions: 'Com tronco inclinado, estenda o cotovelo para tras.',
        tips: 'Evite movimentar o ombro.',
    },
    {
        name: 'Extensão de Tríceps Acima da Cabeça na Polia',
        muscleGroup: 'Tríceps',
        equipment: 'Polia Alta',
        difficulty: 'INTERMEDIARIO',
        instructions: 'De costas para a polia, estenda os cotovelos acima da cabeca.',
        tips: 'Mantenha cotovelos fechados para maior isolamento.',
    },

    // Pernas
    {
        name: 'Agachamento Livre',
        muscleGroup: 'Pernas',
        equipment: 'Barra Reta',
        difficulty: 'AVANCADO',
        instructions: 'Agache mantendo coluna neutra e joelhos alinhados com os pes.',
        tips: 'Desca com controle e suba sem perder estabilidade.',
    },
    {
        name: 'Agachamento no Smith',
        muscleGroup: 'Pernas',
        equipment: 'Smith Machine',
        difficulty: 'INTERMEDIARIO',
        instructions: 'Posicione a barra no trapézio e agache guiado pela maquina.',
        tips: 'Ajuste os pes levemente a frente da barra para conforto.',
    },
    {
        name: 'Leg Press 45°',
        muscleGroup: 'Pernas',
        equipment: 'Leg Press 45°',
        difficulty: 'INICIANTE',
        instructions: 'Empurre a plataforma sem travar joelhos e desca controlando.',
        tips: 'Mantenha lombar apoiada no encosto.',
    },
    {
        name: 'Leg Press Horizontal',
        muscleGroup: 'Pernas',
        equipment: 'Leg Press Horizontal',
        difficulty: 'INICIANTE',
        instructions: 'Empurre a plataforma do leg horizontal mantendo alinhamento dos joelhos.',
        tips: 'Nao permita valgo de joelhos.',
    },
    {
        name: 'Cadeira Extensora',
        muscleGroup: 'Pernas',
        equipment: 'Cadeira Extensora',
        difficulty: 'INICIANTE',
        instructions: 'Estenda os joelhos ate contrair quadriceps e retorne devagar.',
        tips: 'Evite impulso no inicio do movimento.',
    },
    {
        name: 'Cadeira Flexora',
        muscleGroup: 'Pernas',
        equipment: 'Cadeira Flexora',
        difficulty: 'INICIANTE',
        instructions: 'Flexione os joelhos contraindo posteriores de coxa.',
        tips: 'Segure 1 segundo na contracao maxima.',
    },
    {
        name: 'Mesa Flexora',
        muscleGroup: 'Pernas',
        equipment: 'Mesa Flexora',
        difficulty: 'INICIANTE',
        instructions: 'Deitado na mesa, flexione os joelhos levando os calcanhares para cima.',
        tips: 'Mantenha quadril apoiado durante todo o exercicio.',
    },
    {
        name: 'Hack Machine',
        muscleGroup: 'Pernas',
        equipment: 'Hack Machine',
        difficulty: 'INTERMEDIARIO',
        instructions: 'Desca em agachamento guiado e empurre com os pes na plataforma.',
        tips: 'Mantenha joelhos apontando para a ponta dos pes.',
    },
    {
        name: 'Stiff com Barra',
        muscleGroup: 'Pernas',
        equipment: 'Barra Reta',
        difficulty: 'INTERMEDIARIO',
        instructions: 'Com leve flexao de joelhos, desca a barra proxima ao corpo e retorne.',
        tips: 'Mantenha coluna neutra e foco em posteriores.',
    },
    {
        name: 'Levantamento Terra Romeno com Halteres',
        muscleGroup: 'Pernas',
        equipment: 'Halteres',
        difficulty: 'INTERMEDIARIO',
        instructions: 'Desca os halteres proximo as pernas com quadril para tras e retorne.',
        tips: 'Evite arredondar as costas.',
    },
    {
        name: 'Afundo com Halteres',
        muscleGroup: 'Pernas',
        equipment: 'Halteres',
        difficulty: 'INTERMEDIARIO',
        instructions: 'Dê um passo a frente e flexione os joelhos ate quase tocar o joelho no chao.',
        tips: 'Mantenha tronco ereto e passada estavel.',
    },
    {
        name: 'Panturrilha em Pé na Máquina',
        muscleGroup: 'Pernas',
        equipment: 'Panturrilha em Pé',
        difficulty: 'INICIANTE',
        instructions: 'Eleve os calcanhares ao maximo e desca com controle.',
        tips: 'Use amplitude completa do movimento.',
    },
    {
        name: 'Panturrilha Sentado na Máquina',
        muscleGroup: 'Pernas',
        equipment: 'Panturrilha Sentado',
        difficulty: 'INICIANTE',
        instructions: 'Com joelhos flexionados, eleve os calcanhares e retorne lentamente.',
        tips: 'Evite quicar no fundo do movimento.',
    },
    {
        name: 'Cadeira Adutora',
        muscleGroup: 'Pernas',
        equipment: 'Cadeira Adutora',
        difficulty: 'INICIANTE',
        instructions: 'Aproxime as pernas vencendo a resistencia da maquina.',
        tips: 'Controle a abertura na volta.',
    },
    {
        name: 'Cadeira Abdutora',
        muscleGroup: 'Pernas',
        equipment: 'Cadeira Abdutora',
        difficulty: 'INICIANTE',
        instructions: 'Afaste as pernas contra a resistencia e retorne com controle.',
        tips: 'Mantenha quadril apoiado no encosto.',
    },

    // Gluteos
    {
        name: 'Elevacao Pelvica com Barra',
        muscleGroup: 'Glúteos',
        equipment: 'Barra Reta',
        difficulty: 'INTERMEDIARIO',
        instructions: 'Apoie costas no banco, eleve o quadril ate alinhar tronco e coxas.',
        tips: 'Contraia gluteos no topo por 1 segundo.',
    },
    {
        name: 'Hip Thrust na Maquina',
        muscleGroup: 'Glúteos',
        equipment: 'Hip Thrust Maquina',
        difficulty: 'INICIANTE',
        instructions: 'Empurre a carga com o quadril ate extensao completa.',
        tips: 'Mantenha pes na largura dos ombros.',
    },
    {
        name: 'Glute Bridge no Smith',
        muscleGroup: 'Glúteos',
        equipment: 'Smith Machine',
        difficulty: 'INTERMEDIARIO',
        instructions: 'Com barra no quadril, eleve e desca o quadril controlando o movimento.',
        tips: 'Nao hiperestenda a lombar no topo.',
    },
    {
        name: 'Coice na Polia',
        muscleGroup: 'Glúteos',
        equipment: 'Polia Baixa',
        difficulty: 'INICIANTE',
        instructions: 'Com tornozeleira, estenda a perna para tras contra a carga.',
        tips: 'Evite balancar o tronco.',
    },
    {
        name: 'Extensao de Quadril na Maquina',
        muscleGroup: 'Glúteos',
        equipment: 'Extensao de Quadril Maquina',
        difficulty: 'INICIANTE',
        instructions: 'Empurre a alavanca para tras com o pe, focando na contracao do gluteo.',
        tips: 'Use amplitude controlada e sem impulso.',
    },
    {
        name: 'Abducao de Quadril no Cabo',
        muscleGroup: 'Glúteos',
        equipment: 'Polia Baixa',
        difficulty: 'INTERMEDIARIO',
        instructions: 'Com tornozeleira, afaste a perna lateralmente contra resistencia.',
        tips: 'Mantenha quadril estavel e tronco ereto.',
    },
    {
        name: 'Step-up com Halteres',
        muscleGroup: 'Glúteos',
        equipment: 'Halteres',
        difficulty: 'INTERMEDIARIO',
        instructions: 'Suba em um banco com uma perna de cada vez, empurrando pelo calcanhar.',
        tips: 'Evite impulso da perna de tras.',
    },
    {
        name: 'Avanco Reverso com Halteres',
        muscleGroup: 'Glúteos',
        equipment: 'Halteres',
        difficulty: 'INTERMEDIARIO',
        instructions: 'Dê um passo para tras e flexione os joelhos, retornando em seguida.',
        tips: 'Mantenha tronco levemente inclinado para foco em gluteos.',
    },

    // Core
    {
        name: 'Prancha Frontal',
        muscleGroup: 'Core',
        equipment: 'Peso Corporal',
        difficulty: 'INICIANTE',
        instructions: 'Apoie antebracos e ponta dos pes mantendo corpo alinhado.',
        tips: 'Ative abdomen e gluteos para evitar queda do quadril.',
    },
    {
        name: 'Prancha Lateral',
        muscleGroup: 'Core',
        equipment: 'Peso Corporal',
        difficulty: 'INICIANTE',
        instructions: 'Apoie um antebraco no chao e mantenha o corpo alinhado lateralmente.',
        tips: 'Evite girar o tronco durante a execucao.',
    },
    {
        name: 'Abdominal Crunch no Solo',
        muscleGroup: 'Core',
        equipment: 'Peso Corporal',
        difficulty: 'INICIANTE',
        instructions: 'Flexione o tronco elevando os ombros do chao.',
        tips: 'Nao puxe o pescoco com as maos.',
    },
    {
        name: 'Abdominal Infra no Banco',
        muscleGroup: 'Core',
        equipment: 'Banco Reto',
        difficulty: 'INTERMEDIARIO',
        instructions: 'Eleve os joelhos em direcao ao peito e retorne devagar.',
        tips: 'Mantenha lombar estabilizada no banco.',
    },
    {
        name: 'Elevacao de Pernas na Barra Fixa',
        muscleGroup: 'Core',
        equipment: 'Barra Fixa',
        difficulty: 'AVANCADO',
        instructions: 'Suspenso na barra, eleve as pernas ate a altura do quadril ou mais.',
        tips: 'Evite embalo excessivo para manter foco no abdômen.',
    },
    {
        name: 'Abdominal na Maquina',
        muscleGroup: 'Core',
        equipment: 'Prancha de Abdominais',
        difficulty: 'INICIANTE',
        instructions: 'Flexione o tronco contra a resistencia da maquina.',
        tips: 'Exale o ar ao aproximar caixa toracica da pelve.',
    },
    {
        name: 'Cable Crunch na Polia Alta',
        muscleGroup: 'Core',
        equipment: 'Polia Alta',
        difficulty: 'INTERMEDIARIO',
        instructions: 'Ajoelhado, flexione o tronco puxando a corda para baixo.',
        tips: 'Movimento deve vir do abdomen, nao dos bracos.',
    },
    {
        name: 'Russian Twist com Anilha',
        muscleGroup: 'Core',
        equipment: 'Anilhas',
        difficulty: 'INTERMEDIARIO',
        instructions: 'Sentado, rotacione o tronco para os lados levando a anilha.',
        tips: 'Mantenha abdomen ativo e coluna neutra.',
    },
];

async function main() {
    console.log('🌱 Starting seed...');

    // Create Personal Trainer - Adrian Santos
    const hashedPassword = await hash('Adrian@2024', 10);

    const personalUser = await prisma.user.upsert({
        where: { email: 'adrian@adriansantos.com.br' },
        update: {},
        create: {
            email: 'adrian@adriansantos.com.br',
            name: 'Adrian Santos',
            password: hashedPassword,
            role: 'PERSONAL',
            phone: '11999999999',
            personal: {
                create: {},
            },
        },
        include: { personal: true },
    });

    console.log('✅ Personal Trainer created:', personalUser.name);

    let created = 0;
    let updated = 0;

    for (const exercise of EXERCISE_LIBRARY) {
        const existing = await prisma.exercise.findUnique({
            where: { name: exercise.name },
            select: { id: true },
        });

        await prisma.exercise.upsert({
            where: { name: exercise.name },
            update: {
                muscleGroup: exercise.muscleGroup,
                equipment: exercise.equipment,
                difficulty: exercise.difficulty,
                instructions: exercise.instructions,
                tips: exercise.tips,
            },
            create: {
                name: exercise.name,
                muscleGroup: exercise.muscleGroup,
                equipment: exercise.equipment,
                difficulty: exercise.difficulty,
                instructions: exercise.instructions,
                tips: exercise.tips,
            },
        });

        if (existing) {
            updated += 1;
        } else {
            created += 1;
        }
    }

    const totalsByGroup = EXERCISE_LIBRARY.reduce<Record<string, number>>((acc, item) => {
        acc[item.muscleGroup] = (acc[item.muscleGroup] || 0) + 1;
        return acc;
    }, {});

    console.log(`✅ Exercicios processados: ${EXERCISE_LIBRARY.length}`);
    console.log(`🆕 Criados: ${created} | ♻️ Atualizados: ${updated}`);
    console.log('📊 Total por grupo muscular:', totalsByGroup);

    console.log('🌱 Seed completed!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
