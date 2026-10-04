import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

async function main() {
  console.log('🌱 Seeding database...');

  // Clear existing data (order matters due to FK constraints)
  await prisma.auditLog.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.classSession.deleteMany();
  await prisma.enrollment.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.user.deleteMany();

  const defaultPassword = await hashPassword('Password123');

  // ===== CREATE ADMIN =====
  const admin = await prisma.user.create({
    data: {
      email: 'admin@college.edu',
      name: 'System Admin',
      role: 'ADMIN',
      passwordHash: defaultPassword,
      mustChangePassword: false,
    },
  });
  console.log(`  ✅ Admin: admin@college.edu / Password123`);

  // ===== CREATE TEACHERS =====
  const teacherConfigs = [
    { email: 'rajesh.kumar@college.edu', name: 'Dr. Rajesh Kumar', role: 'TEACHER' as Role, passwordHash: defaultPassword, mustChangePassword: false },
    { email: 'priya.sharma@college.edu', name: 'Prof. Priya Sharma', role: 'TEACHER' as Role, passwordHash: defaultPassword, mustChangePassword: false },
    { email: 'anand.patel@college.edu', name: 'Dr. Anand Patel', role: 'TEACHER' as Role, passwordHash: defaultPassword, mustChangePassword: false },
  ];
  const teachers = [];
  for (const tc of teacherConfigs) {
    teachers.push(await prisma.user.create({ data: tc }));
  }
  console.log(`  ✅ 3 Teachers created (password: Password123)`);

  // ===== CREATE SUBJECTS =====
  const subjectConfigs = [
    { code: 'CS301', name: 'Data Structures & Algorithms', teacherId: teachers[0].id },
    { code: 'CS302', name: 'Database Management Systems', teacherId: teachers[0].id },
    { code: 'CS303', name: 'Operating Systems', teacherId: teachers[1].id },
    { code: 'CS304', name: 'Computer Networks', teacherId: teachers[2].id },
  ];
  const subjects = [];
  for (const sc of subjectConfigs) {
    subjects.push(await prisma.subject.create({ data: sc }));
  }
  console.log(`  ✅ 4 Subjects created`);

  // ===== CREATE STUDENTS =====
  const students = [];
  for (let i = 1; i <= 60; i++) {
    const rollNo = `21CS${String(i).padStart(3, '0')}`;
    const firstName = FIRST_NAMES[i % FIRST_NAMES.length];
    const lastName = LAST_NAMES[i % LAST_NAMES.length];
    const name = `${firstName} ${lastName}`;
    const email = `${rollNo.toLowerCase()}@college.edu`;

    const student = await prisma.user.create({
      data: {
        email,
        name,
        rollNo,
        role: 'STUDENT',
        passwordHash: defaultPassword,
        mustChangePassword: false,
      },
    });
    students.push(student);
  }
  console.log(`  ✅ 60 Students created (password: Password123)`);

  // ===== CREATE ENROLLMENTS =====
  // Enroll all students in CS301 and CS302, first 40 in CS303, first 30 in CS304
  for (const student of students) {
    await prisma.enrollment.create({
      data: { studentId: student.id, subjectId: subjects[0].id },
    });
    await prisma.enrollment.create({
      data: { studentId: student.id, subjectId: subjects[1].id },
    });
  }
  for (const student of students.slice(0, 40)) {
    await prisma.enrollment.create({
      data: { studentId: student.id, subjectId: subjects[2].id },
    });
  }
  for (const student of students.slice(0, 30)) {
    await prisma.enrollment.create({
      data: { studentId: student.id, subjectId: subjects[3].id },
    });
  }
  console.log(`  ✅ Enrollments created`);

  // ===== CREATE SOME FINALIZED SESSIONS WITH ATTENDANCE =====
  const now = new Date();
  const oneDayMs = 24 * 60 * 60 * 1000;

  for (let dayOffset = 5; dayOffset >= 1; dayOffset--) {
    const dayDate = new Date(now.getTime() - dayOffset * oneDayMs);
    dayDate.setHours(10, 0, 0, 0);

    const session = await prisma.classSession.create({
      data: {
        subjectId: subjects[0].id,
        classCode: `SEED${String(dayOffset).padStart(2, '0')}`,
        startsAt: new Date(dayDate),
        endsAt: new Date(dayDate.getTime() + 60 * 60_000),
        windowOpensAt: new Date(dayDate),
        windowClosesAt: new Date(dayDate.getTime() + 10 * 60_000),
        status: 'FINALIZED',
        finalizedAt: new Date(dayDate.getTime() + 60 * 60_000),
        createdById: teachers[0].id,
      },
    });

    // Mark ~80% of students present (random)
    for (const student of students) {
      const isPresent = Math.random() < 0.8;
      await prisma.attendance.create({
        data: {
          sessionId: session.id,
          studentId: student.id,
          status: isPresent ? 'PRESENT' : 'ABSENT',
          markedAt: isPresent ? new Date(dayDate.getTime() + Math.random() * 10 * 60_000) : null,
        },
      });
    }
  }
  console.log(`  ✅ 5 finalized sessions with mixed attendance created`);

  console.log('\n🎉 Seed complete!\n');
  console.log('Login credentials (all passwords: Password123):');
  console.log('  Admin:   admin@college.edu');
  console.log('  Teacher: rajesh.kumar@college.edu');
  console.log('  Teacher: priya.sharma@college.edu');
  console.log('  Teacher: anand.patel@college.edu');
  console.log('  Student: 21cs001@college.edu (Roll: 21CS001)');
  console.log('  ... through 21cs060@college.edu (Roll: 21CS060)');
}

const FIRST_NAMES = [
  'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Ayaan',
  'Krishna', 'Ishaan', 'Shaurya', 'Atharva', 'Advait', 'Dhruv', 'Kabir',
  'Ananya', 'Diya', 'Myra', 'Sara', 'Aadhya', 'Isha', 'Kiara', 'Riya',
  'Prisha', 'Anika', 'Nisha', 'Meera', 'Kavya', 'Tara', 'Zara',
];

const LAST_NAMES = [
  'Patel', 'Sharma', 'Gupta', 'Singh', 'Kumar', 'Reddy', 'Joshi', 'Rao',
  'Desai', 'Mehta', 'Shah', 'Nair', 'Pillai', 'Menon', 'Iyer', 'Chopra',
  'Verma', 'Mishra', 'Saxena', 'Bhat', 'Hegde', 'Kulkarni', 'Patil', 'Kaur',
  'Das', 'Mukherjee', 'Roy', 'Sen', 'Ghosh', 'Banerjee',
];

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
