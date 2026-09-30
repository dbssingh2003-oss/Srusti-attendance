import { prisma } from '../../lib/prisma';
import { AppError, isUniqueViolation } from '../../lib/errors';
import { now as serverNow } from '../../lib/time';
import { logger } from '../../lib/logger';

interface CheckinMeta {
  ip: string;
  deviceId?: string;
  userAgent?: string;
}

/**
 * Mark attendance: single atomic operation with all validations.
 * Server time only, unique constraint prevents double marking.
 */
export async function markAttendance(studentId: string, code: string, meta: CheckinMeta) {
  const currentTime = serverNow();

  // Find the active session with this code
  const session = await prisma.classSession.findFirst({
    where: { classCode: code.toUpperCase(), status: 'OPEN' },
    include: { subject: { select: { code: true, name: true } } },
  });

  if (!session) {
    throw new AppError('INVALID_OR_EXPIRED_CODE', 400, 'Code not found. Check and try again.');
  }

  // Validate window
  if (currentTime < session.windowOpensAt || currentTime > session.windowClosesAt) {
    throw new AppError(
      'CHECKIN_WINDOW_CLOSED',
      400,
      `Check-in closed at ${session.windowClosesAt.toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      })}.`
    );
  }

  // Verify enrollment
  const enrolled = await prisma.enrollment.findUnique({
    where: { studentId_subjectId: { studentId, subjectId: session.subjectId } },
  });

  if (!enrolled) {
    throw new AppError('NOT_ENROLLED', 403, "You're not enrolled in this subject.");
  }

  // Create attendance record (unique constraint prevents duplicates)
  try {
    const record = await prisma.attendance.create({
      data: {
        sessionId: session.id,
        studentId,
        status: 'PRESENT',
        markedAt: currentTime,
        ip: meta.ip,
        deviceId: meta.deviceId,
        userAgent: meta.userAgent,
      },
    });

    logger.info({ sessionId: session.id, studentId }, 'Attendance marked');

    return {
      status: record.status,
      subject: { code: session.subject.code, name: session.subject.name },
      markedAt: record.markedAt,
      sessionId: session.id,
      subjectId: session.subjectId,
    };
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError('ALREADY_MARKED', 409, "You're already marked present.");
    }
    throw error;
  }
}

/**
 * Get attendance summary for a student: overall and per-subject percentages.
 * Only finalized sessions count.
 */
export async function getStudentSummary(studentId: string) {
  const results = await prisma.$queryRaw<
    Array<{
      subjectId: string;
      code: string;
      name: string;
      present: bigint;
      total: bigint;
      pct: number;
    }>
  >`
    SELECT s.id AS "subjectId", s.code, s.name,
      COUNT(*) FILTER (WHERE a.status IN ('PRESENT','LATE'))::bigint  AS present,
      COUNT(*)::bigint                                                 AS total,
      ROUND(100.0 * COUNT(*) FILTER (WHERE a.status IN ('PRESENT','LATE'))
            / NULLIF(COUNT(*), 0), 1)                                  AS pct
    FROM "Attendance" a
    JOIN "ClassSession" cs ON cs.id = a."sessionId" AND cs.status = 'FINALIZED'
    JOIN "Subject" s       ON s.id = cs."subjectId"
    WHERE a."studentId" = ${studentId}
    GROUP BY s.id, s.code, s.name
    ORDER BY s.name
  `;

  const subjects = results.map((r) => ({
    subjectId: r.subjectId,
    code: r.code,
    name: r.name,
    present: Number(r.present),
    total: Number(r.total),
    pct: Number(r.pct),
  }));

  const totalPresent = subjects.reduce((sum, s) => sum + s.present, 0);
  const totalSessions = subjects.reduce((sum, s) => sum + s.total, 0);
  const overallPct = totalSessions > 0 ? Math.round((1000 * totalPresent) / totalSessions) / 10 : 0;

  return {
    overall: { present: totalPresent, total: totalSessions, pct: overallPct },
    subjects,
  };
}

/**
 * Get per-session attendance history for a student in a specific subject.
 */
export async function getStudentSubjectHistory(studentId: string, subjectId: string) {
  // Verify enrollment
  const enrolled = await prisma.enrollment.findUnique({
    where: { studentId_subjectId: { studentId, subjectId } },
  });
  if (!enrolled) {
    throw new AppError('NOT_ENROLLED', 403, 'Not enrolled in this subject');
  }

  const records = await prisma.attendance.findMany({
    where: {
      studentId,
      session: { subjectId, status: 'FINALIZED' },
    },
    include: {
      session: { select: { startsAt: true, endsAt: true, classCode: true } },
    },
    orderBy: { session: { startsAt: 'desc' } },
  });

  return records.map((r) => ({
    sessionId: r.sessionId,
    startsAt: r.session.startsAt,
    endsAt: r.session.endsAt,
    status: r.status,
    markedAt: r.markedAt,
  }));
}

/**
 * Get today's classes for a student.
 */
export async function getStudentToday(studentId: string) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60_000);

  // Get enrolled subject IDs
  const enrollments = await prisma.enrollment.findMany({
    where: { studentId },
    select: { subjectId: true },
  });

  const subjectIds = enrollments.map((e) => e.subjectId);

  const sessions = await prisma.classSession.findMany({
    where: {
      subjectId: { in: subjectIds },
      startsAt: { gte: todayStart, lt: todayEnd },
      status: { not: 'CANCELLED' },
    },
    include: {
      subject: { select: { code: true, name: true } },
      attendance: {
        where: { studentId },
        select: { status: true, markedAt: true },
      },
    },
    orderBy: { startsAt: 'asc' },
  });

  return sessions.map((s) => ({
    id: s.id,
    subject: { code: s.subject.code, name: s.subject.name },
    startsAt: s.startsAt,
    endsAt: s.endsAt,
    status: s.status,
    attendance: s.attendance[0] ?? null,
  }));
}
