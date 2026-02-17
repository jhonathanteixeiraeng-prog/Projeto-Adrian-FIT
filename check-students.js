const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkStudents() {
    const students = await prisma.student.findMany({
        include: { user: true, anamnesis: true }
    });

    console.log('Total students:', students.length);

    const validStudents = students.filter(s => s.weight && s.height && (s.birthDate || s.user.birthDate));
    console.log('Students with valid metrics:', validStudents.length);

    if (validStudents.length > 0) {
        console.log('Valid student example:', validStudents[0].user.email);
    } else if (students.length > 0) {
        console.log('No valid students found. Updating the first one...');
        const s = students[0];
        await prisma.student.update({
            where: { id: s.id },
            data: {
                weight: 80,
                height: 180,
                birthDate: new Date('1995-05-15'),
                gender: 'MALE',
                goal: 'HYPERTROPHY'
            }
        });
        console.log('Updated student:', s.user.email);
    } else {
        console.log('No students found at all.');
    }
}

checkStudents()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
