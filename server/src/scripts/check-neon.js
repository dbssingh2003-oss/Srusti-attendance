const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkNeon() {
  try {
    const userCount = await prisma.user.count();
    const subjectCount = await prisma.subject.count();
    const enrollmentCount = await prisma.enrollment.count();
    const sessionCount = await prisma.classSession.count();
    const attendanceCount = await prisma.attendance.count();

    console.log('=== NEON POSTGRESQL DATABASE SUMMARY ===');
    console.log('Total Users:', userCount);
    console.log('Total Subjects:', subjectCount);
    console.log('Total Enrollments:', enrollmentCount);
    console.log('Total Class Sessions:', sessionCount);
    console.log('Total Attendance Records:', attendanceCount);

    console.log('\n--- ALL USERS BY ROLE ---');
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, rollNo: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    console.log(
      'Admins:',
      users.filter((u) => u.role === 'ADMIN').map((u) => `${u.name} (${u.email})`)
    );
    console.log(
      'Teachers:',
      users
        .filter((u) => u.role === 'TEACHER')
        .map((u) => `${u.name} (${u.email}, ID: ${u.id})`)
    );
    console.log(
      'Students count:',
      users.filter((u) => u.role === 'STUDENT').length
    );

    console.log('\n--- ALL SUBJECTS IN NEON DB ---');
    const subjects = await prisma.subject.findMany({
      include: {
        teacher: { select: { id: true, name: true, email: true } },
        _count: { select: { enrollments: true, sessions: true } },
      },
      orderBy: { code: 'asc' },
    });
    subjects.forEach((s) => {
      console.log(
        `Subject [${s.code}] "${s.name}" | Teacher: ${s.teacher.name} (${s.teacher.email}) | Enrolled: ${s._count.enrollments} | Sessions: ${s._count.sessions}`
      );
    });

    console.log('\n--- ALL CLASS SESSIONS IN NEON DB ---');
    const sessions = await prisma.classSession.findMany({
      include: {
        subject: { select: { code: true, name: true } },
        _count: { select: { attendance: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    sessions.forEach((sess) => {
      console.log(
        `Session Code [${sess.classCode}] Subject: ${sess.subject.code} | Status: ${sess.status} | Attendees: ${sess._count.attendance} | Starts: ${sess.startsAt}`
      );
    });
  } catch (err) {
    console.error('Error querying Neon DB:', err);
  } finally {
    await prisma.$disconnect();
  }
}

checkNeon();
