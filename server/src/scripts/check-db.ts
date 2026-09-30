import { prisma } from '../lib/prisma';

async function main() {
  const teachers = await prisma.user.findMany({
    where: { role: 'TEACHER' },
    select: { id: true, name: true, email: true },
  });
  console.log('--- ALL TEACHERS ---');
  console.log(teachers);

  const subjects = await prisma.subject.findMany({
    include: { teacher: { select: { id: true, name: true, email: true } } },
  });
  console.log('\n--- ALL SUBJECTS IN NEON DB ---');
  console.log(
    subjects.map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      teacherId: s.teacherId,
      teacherName: s.teacher.name,
      teacherEmail: s.teacher.email,
    }))
  );
}

main().then(() => prisma.$disconnect());
