const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting seed...');

    // Create Personal Trainer
    const hashedPassword = await bcrypt.hash('password123', 10);

    const personalUser = await prisma.user.upsert({
        where: { email: 'personal@enerflux.com' },
        update: {},
        create: {
            email: 'personal@enerflux.com',
            name: 'Carlos Silva',
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

    // Create Students
    const students = [
        { name: 'João Santos', email: 'joao@email.com', phone: '11988888888' },
        { name: 'Maria Oliveira', email: 'maria@email.com', phone: '11977777777' },
        { name: 'Pedro Costa', email: 'pedro@email.com', phone: '11966666666' },
    ];

    for (const studentData of students) {
        const studentUser = await prisma.user.upsert({
            where: { email: studentData.email },
            update: {},
            create: {
                email: studentData.email,
                name: studentData.name,
                password: hashedPassword,
                role: 'STUDENT',
                phone: studentData.phone,
                student: {
                    create: {
                        personalId: personalUser.personal.id,
                        birthDate: new Date('1995-01-15'),
                        height: 175,
                        weight: 80,
                        goal: 'Hipertrofia e definição muscular',
                    },
                },
            },
            include: { student: true },
        });
        console.log('✅ Student created:', studentUser.name);
    }

    // Create Exercises
    const exercises = [
        // Peito
        { name: 'Supino Reto', muscleGroup: 'Peito', equipment: 'Barra e Banco', difficulty: 'INTERMEDIARIO', instructions: 'Deite no banco, segure a barra na largura dos ombros, desça até o peito e empurre para cima.', tips: 'Mantenha os pés firmes no chão e as escápulas retraídas.' },
        { name: 'Supino Inclinado', muscleGroup: 'Peito', equipment: 'Halteres', difficulty: 'INTERMEDIARIO', instructions: 'No banco inclinado a 30-45°, empurre os halteres para cima.', tips: 'Controle a descida para maximizar a tensão.' },
        { name: 'Crucifixo', muscleGroup: 'Peito', equipment: 'Halteres', difficulty: 'INICIANTE', instructions: 'Deitado, abra os braços lateralmente com leve flexão de cotovelo.', tips: 'Foque no alongamento do peitoral.' },
        { name: 'Crossover', muscleGroup: 'Peito', equipment: 'Cabo', difficulty: 'INTERMEDIARIO', instructions: 'Com os cabos nas posições altas, cruze os braços à frente.', tips: 'Mantenha uma leve inclinação do tronco.' },

        // Costas
        { name: 'Puxada Frontal', muscleGroup: 'Costas', equipment: 'Máquina', difficulty: 'INICIANTE', instructions: 'Sente-se na máquina, puxe a barra até o peito contraindo as costas.', tips: 'Evite puxar com os braços, foque na contração das costas.' },
        { name: 'Remada Curvada', muscleGroup: 'Costas', equipment: 'Barra', difficulty: 'INTERMEDIARIO', instructions: 'Incline o tronco a 45°, puxe a barra em direção ao abdômen.', tips: 'Mantenha as costas retas durante todo o movimento.' },
        { name: 'Remada Unilateral', muscleGroup: 'Costas', equipment: 'Halteres', difficulty: 'INICIANTE', instructions: 'Apoie um joelho no banco, puxe o halter em direção ao quadril.', tips: 'Evite rotação do tronco.' },
        { name: 'Pulldown', muscleGroup: 'Costas', equipment: 'Cabo', difficulty: 'INICIANTE', instructions: 'Com os braços estendidos, puxe a barra até a altura do queixo.', tips: 'Foque na contração das escápulas.' },

        // Pernas
        { name: 'Agachamento Livre', muscleGroup: 'Pernas', equipment: 'Barra', difficulty: 'AVANCADO', instructions: 'Posicione a barra nos trapézios, desça até as coxas ficarem paralelas ao chão.', tips: 'Mantenha o core ativado e os joelhos alinhados com os pés.' },
        { name: 'Leg Press 45', muscleGroup: 'Pernas', equipment: 'Máquina', difficulty: 'INTERMEDIARIO', instructions: 'Posicione os pés na plataforma, empurre controladamente.', tips: 'Não trave os joelhos completamente no topo.' },
        { name: 'Extensora', muscleGroup: 'Pernas', equipment: 'Máquina', difficulty: 'INICIANTE', instructions: 'Sentado, estenda as pernas até a posição horizontal.', tips: 'Controle a descida para não perder tensão.' },
        { name: 'Flexora', muscleGroup: 'Pernas', equipment: 'Máquina', difficulty: 'INICIANTE', instructions: 'Deitado ou sentado, flexione os joelhos contraindo os posteriores.', tips: 'Mantenha a tensão constante.' },
        { name: 'Stiff', muscleGroup: 'Pernas', equipment: 'Barra', difficulty: 'INTERMEDIARIO', instructions: 'Com pernas semi-estendidas, desça o tronco mantendo a barra próxima às pernas.', tips: 'Sinta o alongamento nos posteriores.' },

        // Ombros
        { name: 'Desenvolvimento', muscleGroup: 'Ombro', equipment: 'Halteres', difficulty: 'INTERMEDIARIO', instructions: 'Sentado ou em pé, empurre os halteres para cima até os braços estenderem.', tips: 'Não arquee demais as costas, mantenha o core ativo.' },
        { name: 'Elevação Lateral', muscleGroup: 'Ombro', equipment: 'Halteres', difficulty: 'INICIANTE', instructions: 'Com os braços ao lado do corpo, eleve lateralmente até a altura dos ombros.', tips: 'Use peso moderado para manter a forma.' },
        { name: 'Elevação Frontal', muscleGroup: 'Ombro', equipment: 'Halteres', difficulty: 'INICIANTE', instructions: 'Eleve os halteres à frente do corpo até a altura dos ombros.', tips: 'Alterne os braços para manter estabilidade.' },

        // Bíceps
        { name: 'Rosca Direta', muscleGroup: 'Bíceps', equipment: 'Barra', difficulty: 'INICIANTE', instructions: 'Segure a barra com pegada supinada, flexione os cotovelos mantendo-os fixos.', tips: 'Não balance o corpo, mantenha o movimento controlado.' },
        { name: 'Rosca Alternada', muscleGroup: 'Bíceps', equipment: 'Halteres', difficulty: 'INICIANTE', instructions: 'Alterne a flexão dos braços com rotação do punho.', tips: 'Contraia o bíceps no pico do movimento.' },
        { name: 'Rosca Martelo', muscleGroup: 'Bíceps', equipment: 'Halteres', difficulty: 'INICIANTE', instructions: 'Com pegada neutra, flexione os cotovelos.', tips: 'Trabalha também o braquial.' },

        // Tríceps
        { name: 'Tríceps Pulley', muscleGroup: 'Tríceps', equipment: 'Cabo', difficulty: 'INICIANTE', instructions: 'Segure a barra do cabo, empurre para baixo estendendo os cotovelos.', tips: 'Mantenha os cotovelos fixos junto ao corpo.' },
        { name: 'Tríceps Francês', muscleGroup: 'Tríceps', equipment: 'Halteres', difficulty: 'INTERMEDIARIO', instructions: 'Deitado, estenda os braços segurando halteres acima da cabeça.', tips: 'Mantenha os cotovelos apontando para cima.' },
        { name: 'Mergulho', muscleGroup: 'Tríceps', equipment: 'Peso Corporal', difficulty: 'INTERMEDIARIO', instructions: 'Nas paralelas, desça flexionando os cotovelos e empurre para cima.', tips: 'Mantenha o tronco ligeiramente inclinado.' },

        // Core
        { name: 'Prancha', muscleGroup: 'Core', equipment: 'Peso Corporal', difficulty: 'INICIANTE', instructions: 'Apoie antebraços e pontas dos pés, mantenha o corpo alinhado.', tips: 'Não deixe o quadril subir ou descer.' },
        { name: 'Abdominal Crunch', muscleGroup: 'Core', equipment: 'Peso Corporal', difficulty: 'INICIANTE', instructions: 'Deitado, eleve os ombros do chão contraindo o abdômen.', tips: 'Não puxe a cabeça com as mãos.' },
        { name: 'Abdominal Infra', muscleGroup: 'Core', equipment: 'Peso Corporal', difficulty: 'INTERMEDIARIO', instructions: 'Deitado, eleve as pernas mantendo-as estendidas.', tips: 'Mantenha a lombar pressionada no chão.' },
    ];

    for (const exercise of exercises) {
        await prisma.exercise.upsert({
            where: { name: exercise.name },
            update: {},
            create: exercise,
        });
    }
    console.log('✅ Exercises created:', exercises.length);

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
