import { prisma } from '../../lib/prisma';
import { AppError, isUniqueViolation } from '../../lib/errors';
import { generateClassCode } from '../../lib/classCode';
import { addMinutes } from '../../lib/time';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';
import { SessionStatus, Prisma } from '@prisma/client';
import { emitSessionFinalized } from '../../realtime/emitters';

/**
 * Schedule a new class session.
 */
export async function createSession(
  teacherId: string,
  input: { subjectId: string; startsAt: string; endsAt: string; windowMinutes?: number }
) {
  const subject = await prisma.subject.findUnique({ where: { id: input.subjectId } });
  if (!subject) {
    throw new AppError('NOT_FOUND', 404, 'Subject not found');
  }

  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);

  if (startsAt >= endsAt) {
    throw new AppError('VALIDATION_ERROR', 400, 'Start time must be before end time');
  }

  const windowMinutes = input.windowMinutes ?? env.DEFAULT_WINDOW_MINUTES;
  const windowOpensAt = startsAt;
  const windowClosesAt = addMinutes(startsAt, windowMinutes);

  if (windowClosesAt > endsAt) {
    throw new AppError('VALIDATION_ERROR', 400, 'Check-in window cannot extend beyond class end time');
  }

  // Generate unique class code with retries
  let session = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const classCode = generateClassCode();
    try {
      session = await prisma.classSession.create({
        data: {
          subjectId: input.subjectId,
          classCode,
          startsAt,
          endsAt,
          windowOpensAt,
          windowClosesAt,
          status: 'SCHEDULED',
          createdById: teacherId,
        },
      });
      break;
    } catch (err) {
      if (isUniqueViolation(err) && attempt < 4) {
        logger.warn({ classCode, attempt }, 'Class code collision, retrying');
        continue;
      }
      throw err;
    }
  }

  if (!session) {
    throw new AppError('INTERNAL_ERROR', 500, 'Failed to generate unique class code');
  }

  // Audit log
  await writeAudit(teacherId, 'SESSION_CREATED', 'ClassSession', session.id, {
    subjectId: input.subjectId,
    classCode: session.classCode,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
  });

  return session;
}

/**
 * Open a session (manually or by job).
 */
export async function openSession(sessionId: string, actorId?: string) {
  const session = await prisma.classSession.findUniqueOrThrow({ where: { id: sessionId } });

  if (session.status !== 'SCHEDULED') {
    if (session.status === 'OPEN') return session; // Idempotent
    throw new AppError('INVALID_STATE_TRANSITION', 400, `Cannot open a ${session.status} session`);
  }

  const updated = await prisma.classSession.update({
    where: { id: sessionId },
    data: { status: 'OPEN' },
  });

  await writeAudit(actorId ?? 'SYSTEM', 'SESSION_OPENED', 'ClassSession', sessionId);
  return updated;
}

/**
 * Extend the check-in window (allowed once, max +10 min, never beyond endsAt).
 */
export async function extendWindow(sessionId: string, minutes: number, teacherId: string) {
  const session = await prisma.classSession.findUniqueOrThrow({ where: { id: sessionId } });

  // Ownership check
  const subject = await prisma.subject.findUnique({ where: { id: session.subjectId } });
  if (!subject || subject.teacherId !== teacherId) {
    throw new AppError('FORBIDDEN', 403, 'You do not own this subject');
  }

  if (session.status !== 'OPEN') {
    throw new AppError('INVALID_STATE_TRANSITION', 400, 'Can only extend an OPEN session');
  }

  if (session.windowExtended) {
    throw new AppError('WINDOW_ALREADY_EXTENDED', 400, 'Window can only be extended once');
  }

  if (minutes > env.MAX_EXTEND_MINUTES) {
    throw new AppError('VALIDATION_ERROR', 400, `Cannot extend more than ${env.MAX_EXTEND_MINUTES} minutes`);
  }

  let newClosesAt = addMinutes(session.windowClosesAt, minutes);
  if (newClosesAt > session.endsAt) {
    newClosesAt = session.endsAt;
  }

  const updated = await prisma.classSession.update({
    where: { id: sessionId },
    data: { windowClosesAt: newClosesAt, windowExtended: true },
  });

  await writeAudit(teacherId, 'WINDOW_EXTENDED', 'ClassSession', sessionId, {
    oldClosesAt: session.windowClosesAt.toISOString(),
    newClosesAt: newClosesAt.toISOString(),
    minutes,
  });

  return updated;
}

/**
 * Close the check-in window (manually or by job).
 */
export async function closeWindow(sessionId: string, actorId?: string) {
  const session = await prisma.classSession.findUniqueOrThrow({ where: { id: sessionId } });

  if (session.status !== 'OPEN') {
    if (session.status === 'CLOSED') return session; // Idempotent
    throw new AppError('INVALID_STATE_TRANSITION', 400, `Cannot close a ${session.status} session`);
  }

  const updated = await prisma.classSession.update({
    where: { id: sessionId },
    data: { status: 'CLOSED' },
  });

  await writeAudit(actorId ?? 'SYSTEM', 'SESSION_CLOSED', 'ClassSession', sessionId);
  return updated;
}

/**
 * Finalize a session: insert ABSENT for enrolled students who didn't check in, then lock.
 * This is idempotent — calling it on an already-finalized session is a no-op.
 */
export async function finalizeSession(sessionId: string, teacherId?: string) {
  const session = await prisma.classSession.findUniqueOrThrow({
    where: { id: sessionId },
    include: { subject: { select: { teacherId: true, code: true, name: true } } },
  });

  if (teacherId && session.subject.teacherId !== teacherId) {
    throw new AppError('FORBIDDEN', 403, 'You do not own this subject');
  }

  if (session.status !== 'FINALIZED' && session.status !== 'CANCELLED') {
    await prisma.$transaction(async (tx) => {
      // Insert ABSENT records for enrolled students who don't have attendance yet
      await tx.$executeRaw`
        INSERT INTO "Attendance"(id, "sessionId", "studentId", status)
        SELECT gen_random_uuid()::text, ${sessionId}, e."studentId", 'ABSENT'::"AttendanceStatus"
        FROM "Enrollment" e
        WHERE e."subjectId" = ${session.subjectId}
          AND NOT EXISTS (
            SELECT 1 FROM "Attendance" a
            WHERE a."sessionId" = ${sessionId}
            AND a."studentId" = e."studentId"
          )
      `;

      await tx.classSession.update({
        where: { id: sessionId },
        data: { status: 'FINALIZED', finalizedAt: new Date() },
      });
    });

    await writeAudit(teacherId || 'SYSTEM', 'SESSION_FINALIZED', 'ClassSession', sessionId);
    logger.info({ sessionId }, 'Session finalized');
  }

  // Real-time broadcast
  emitSessionFinalized(session.subjectId, sessionId);

  return prisma.classSession.findUnique({
    where: { id: sessionId },
    include: { subject: { select: { code: true, name: true } } },
  });
}

/**
 * Cancel a session (only if SCHEDULED).
 */
export async function cancelSession(sessionId: string, teacherId: string) {
  const session = await prisma.classSession.findUniqueOrThrow({ where: { id: sessionId } });

  const subject = await prisma.subject.findUnique({ where: { id: session.subjectId } });
  if (!subject || subject.teacherId !== teacherId) {
    throw new AppError('FORBIDDEN', 403, 'You do not own this subject');
  }

  if (session.status !== 'SCHEDULED') {
    throw new AppError('INVALID_STATE_TRANSITION', 400, 'Can only cancel a SCHEDULED session');
  }

  const updated = await prisma.classSession.update({
    where: { id: sessionId },
    data: { status: 'CANCELLED' },
  });

  await writeAudit(teacherId, 'SESSION_CANCELLED', 'ClassSession', sessionId);
  return updated;
}

/**
 * Get sessions for a teacher (filtered).
 */
export async function getTeacherSessions(
  teacherId: string,
  filters: { subjectId?: string; date?: string; status?: SessionStatus }
) {
  const where: Prisma.ClassSessionWhereInput = {};

  // Only sessions for subjects owned by this teacher
  const ownSubjectIds = await prisma.subject.findMany({
    where: { teacherId },
    select: { id: true },
  });
  where.subjectId = { in: ownSubjectIds.map((s) => s.id) };

  if (filters.subjectId) {
    if (!ownSubjectIds.find((s) => s.id === filters.subjectId)) {
      throw new AppError('FORBIDDEN', 403, 'You do not own this subject');
    }
    where.subjectId = filters.subjectId;
  }

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.date) {
    const dayStart = new Date(filters.date);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60_000);
    where.startsAt = { gte: dayStart, lt: dayEnd };
  }

  return prisma.classSession.findMany({
    where,
    include: { subject: { select: { code: true, name: true } } },
    orderBy: { startsAt: 'desc' },
  });
}

/**
 * Get session detail with attendance info.
 */
export async function getSessionDetail(sessionId: string, teacherId: string) {
  const session = await prisma.classSession.findUniqueOrThrow({
    where: { id: sessionId },
    include: {
      subject: { select: { code: true, name: true, teacherId: true } },
    },
  });

  if (session.subject.teacherId !== teacherId) {
    throw new AppError('FORBIDDEN', 403, 'You do not own this subject');
  }

  return session;
}

/**
 * Get live check-in data for a session.
 */
export async function getLiveSession(sessionId: string, teacherId: string) {
  const session = await prisma.classSession.findUniqueOrThrow({
    where: { id: sessionId },
    include: { subject: { select: { teacherId: true } } },
  });

  if (session.subject.teacherId !== teacherId) {
    throw new AppError('FORBIDDEN', 403);
  }

  const totalEnrolled = await prisma.enrollment.count({
    where: { subjectId: session.subjectId },
  });

  const attendees = await prisma.attendance.findMany({
    where: { sessionId, status: 'PRESENT' },
    include: { student: { select: { id: true, name: true, rollNo: true } } },
    orderBy: { markedAt: 'asc' },
  });

  return {
    session,
    count: attendees.length,
    total: totalEnrolled,
    students: attendees.map((a) => ({
      id: a.student.id,
      name: a.student.name,
      rollNo: a.student.rollNo,
      markedAt: a.markedAt,
    })),
  };
}

// --- Internal ---

async function writeAudit(
  actorId: string,
  action: string,
  entity: string,
  entityId: string,
  meta?: Record<string, unknown>
) {
  try {
    await prisma.auditLog.create({
      data: { actorId, action, entity, entityId, meta: (meta as any) ?? undefined },
    });
  } catch (err) {
    logger.error({ err, action }, 'Audit log write failed');
  }
}
