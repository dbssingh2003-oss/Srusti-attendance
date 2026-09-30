import { prisma } from '../../lib/prisma';
import { AppError, isUniqueViolation } from '../../lib/errors';
import { hashPassword } from '../../lib/hash';
import { generateToken } from '../../lib/hash';
import { logger } from '../../lib/logger';
import { Role, Prisma } from '@prisma/client';

// =========== USERS ===========

export async function listUsers(filters: { page?: number; limit?: number; search?: string; role?: Role }) {
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 200;
  const skip = (page - 1) * limit;

  const where: Prisma.UserWhereInput = {};
  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { email: { contains: filters.search, mode: 'insensitive' } },
      { rollNo: { contains: filters.search, mode: 'insensitive' } },
    ];
  }
  if (filters.role) {
    where.role = filters.role;
  }

  const [rawUsers, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        rollNo: true,
        isActive: true,
        createdAt: true,
        taughtSubjects: {
          select: {
            id: true,
            code: true,
            name: true,
            _count: { select: { enrollments: true, sessions: true } },
          },
          orderBy: { code: 'asc' },
        },
        enrollments: {
          select: {
            subject: {
              select: {
                id: true,
                code: true,
                name: true,
                _count: { select: { sessions: true } },
              },
            },
          },
          orderBy: { subject: { code: 'asc' } },
        },
        attendance: {
          select: {
            id: true,
            status: true,
            sessionId: true,
            session: {
              select: {
                id: true,
                status: true,
                subjectId: true,
              },
            },
          },
        },
      },
      skip,
      take: limit,
      orderBy: { name: 'asc' },
    }),
    prisma.user.count({ where }),
  ]);

  const users = rawUsers.map((u) => {
    if (u.role === 'STUDENT') {
      const presentCount = u.attendance.filter(
        (a) => a.status === 'PRESENT' || a.status === 'LATE'
      ).length;

      const totalEnrolledSessions = u.enrollments.reduce(
        (acc, curr) => acc + (curr.subject._count?.sessions || 0),
        0
      );

      const attendancePercentage = totalEnrolledSessions > 0
        ? Math.round((presentCount / totalEnrolledSessions) * 100)
        : 100;

      return {
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        rollNo: u.rollNo,
        isActive: u.isActive,
        createdAt: u.createdAt,
        enrollments: u.enrollments,
        attendanceStats: {
          totalAttended: presentCount,
          totalSessions: totalEnrolledSessions,
          percentage: attendancePercentage,
        },
      };
    } else if (u.role === 'TEACHER') {
      const totalStudentsTaught = u.taughtSubjects.reduce(
        (acc, curr) => acc + (curr._count?.enrollments || 0),
        0
      );
      const totalSessionsConducted = u.taughtSubjects.reduce(
        (acc, curr) => acc + (curr._count?.sessions || 0),
        0
      );

      return {
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        rollNo: u.rollNo,
        isActive: u.isActive,
        createdAt: u.createdAt,
        taughtSubjects: u.taughtSubjects,
        totalStudentsTaught,
        totalSessionsConducted,
      };
    }
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      rollNo: u.rollNo,
      isActive: u.isActive,
      createdAt: u.createdAt,
    };
  });

  return { users, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function createUser(input: {
  email: string;
  name: string;
  role: 'TEACHER' | 'STUDENT';
  rollNo?: string;
  password?: string;
}) {
  const password = input.password ?? generateToken(8); // Random default password
  const passwordHash = await hashPassword(password);

  try {
    const user = await prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        name: input.name,
        role: input.role,
        rollNo: input.rollNo,
        passwordHash,
        mustChangePassword: true,
      },
      select: { id: true, email: true, name: true, role: true, rollNo: true, isActive: true },
    });

    // Log the generated password for dev (in production, send email)
    logger.info({ userId: user.id, password }, 'User created with password');

    return { ...user, generatedPassword: password };
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError('VALIDATION_ERROR', 400, 'Email or roll number already exists');
    }
    throw error;
  }
}

export async function updateUser(id: string, input: { name?: string; isActive?: boolean; rollNo?: string }) {
  try {
    return await prisma.user.update({
      where: { id },
      data: input,
      select: { id: true, email: true, name: true, role: true, rollNo: true, isActive: true },
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError('VALIDATION_ERROR', 400, 'Roll number already exists');
    }
    throw error;
  }
}

export async function resetUserPassword(id: string) {
  const password = generateToken(8);
  const passwordHash = await hashPassword(password);

  await prisma.user.update({
    where: { id },
    data: { passwordHash, mustChangePassword: true, failedLogins: 0, lockedUntil: null },
  });

  // Revoke all refresh tokens
  await prisma.refreshToken.updateMany({
    where: { userId: id, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  return { password };
}

// =========== SUBJECTS ===========

export async function listSubjects() {
  return prisma.subject.findMany({
    include: {
      teacher: { select: { id: true, name: true, email: true } },
      _count: { select: { enrollments: true, sessions: true } },
    },
    orderBy: { code: 'asc' },
  });
}

export async function createSubject(input: { code: string; name: string; teacherId: string }) {
  // Verify teacher exists and is a TEACHER
  const teacher = await prisma.user.findUnique({ where: { id: input.teacherId } });
  if (!teacher || teacher.role !== 'TEACHER') {
    throw new AppError('VALIDATION_ERROR', 400, 'Teacher not found or is not a teacher');
  }

  try {
    return await prisma.subject.create({
      data: { code: input.code.toUpperCase(), name: input.name, teacherId: input.teacherId },
      include: { teacher: { select: { id: true, name: true } } },
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError('VALIDATION_ERROR', 400, 'Subject code already exists');
    }
    throw error;
  }
}

export async function updateSubject(id: string, input: { code?: string; name?: string; teacherId?: string }) {
  if (input.teacherId) {
    const teacher = await prisma.user.findUnique({ where: { id: input.teacherId } });
    if (!teacher || teacher.role !== 'TEACHER') {
      throw new AppError('VALIDATION_ERROR', 400, 'Teacher not found or is not a teacher');
    }
  }

  const data: Prisma.SubjectUpdateInput = {};
  if (input.code) data.code = input.code.trim().toUpperCase();
  if (input.name) data.name = input.name.trim();
  if (input.teacherId) data.teacher = { connect: { id: input.teacherId } };

  try {
    return await prisma.subject.update({
      where: { id },
      data,
      include: {
        teacher: { select: { id: true, name: true, email: true } },
        _count: { select: { enrollments: true, sessions: true } },
      },
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError('VALIDATION_ERROR', 400, 'Subject code already exists');
    }
    throw error;
  }
}

// =========== ENROLLMENTS ===========

export async function listEnrollments(subjectId?: string) {
  return prisma.enrollment.findMany({
    where: subjectId ? { subjectId } : undefined,
    include: {
      student: { select: { id: true, name: true, email: true, rollNo: true } },
      subject: { select: { id: true, code: true, name: true } },
    },
    orderBy: { student: { name: 'asc' } },
  });
}

export async function enrollStudent(studentId: string, subjectId: string) {
  // Verify student exists and is a STUDENT
  const student = await prisma.user.findUnique({ where: { id: studentId } });
  if (!student || student.role !== 'STUDENT') {
    throw new AppError('VALIDATION_ERROR', 400, 'Student not found or is not a student');
  }

  // Verify subject exists
  const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
  if (!subject) {
    throw new AppError('NOT_FOUND', 404, 'Subject not found');
  }

  try {
    return await prisma.enrollment.create({
      data: { studentId, subjectId },
      include: {
        student: { select: { id: true, name: true, rollNo: true } },
        subject: { select: { id: true, code: true, name: true } },
      },
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError('VALIDATION_ERROR', 400, 'Student already enrolled in this subject');
    }
    throw error;
  }
}

export async function bulkEnroll(subjectId: string, studentIds: string[]) {
  const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
  if (!subject) throw new AppError('NOT_FOUND', 404, 'Subject not found');

  const results = { enrolled: 0, skipped: 0, errors: [] as string[] };

  for (const studentId of studentIds) {
    try {
      await prisma.enrollment.create({ data: { studentId, subjectId } });
      results.enrolled++;
    } catch (error) {
      if (isUniqueViolation(error)) {
        results.skipped++;
      } else {
        results.errors.push(studentId);
      }
    }
  }

  return results;
}

export async function unenrollStudent(studentId: string, subjectId: string) {
  await prisma.enrollment.delete({
    where: { studentId_subjectId: { studentId, subjectId } },
  });
}

// =========== AUDIT LOGS ===========

export async function getAuditLogs(filters: { page?: number; limit?: number }) {
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 50;
  const skip = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.auditLog.count(),
  ]);

  return { logs, total, page, limit };
}
