import { getIO } from './socket';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

/**
 * Emit when attendance is marked — sent to the session room (teacher live view)
 * and to the student's personal room (dashboard update).
 */
export async function emitAttendanceMarked(
  sessionId: string,
  subjectId: string,
  studentId: string,
  studentName: string,
  studentRollNo: string | null,
  markedAt: Date
) {
  try {
    const io = getIO();
    if (!io) return;

    // Count current attendees
    const count = await prisma.attendance.count({
      where: { sessionId, status: 'PRESENT' },
    });
    const total = await prisma.enrollment.count({
      where: { subjectId },
    });

    // Emit to teacher's live view
    io.to(`session:${sessionId}`).emit('attendance:marked', {
      count,
      total,
      student: { id: studentId, name: studentName, rollNo: studentRollNo },
      markedAt,
    });

    // Emit dashboard update to the student
    const summary = await getStudentQuickSummary(studentId, subjectId);
    io.to(`user:${studentId}`).emit('dashboard:updated', summary);
  } catch (err) {
    logger.error({ err }, 'Failed to emit attendance:marked');
  }
}

/**
 * Emit when a session is opened — sent to the subject room.
 */
export function emitSessionOpened(subjectId: string, sessionId: string, subjectName: string, closesAt: Date) {
  try {
    const io = getIO();
    if (!io) return;
    io.to(`subject:${subjectId}`).emit('session:opened', {
      sessionId,
      subjectName,
      closesAt,
    });
  } catch (err) {
    logger.error({ err }, 'Failed to emit session:opened');
  }
}

/**
 * Emit when a session window is extended.
 */
export function emitSessionExtended(subjectId: string, sessionId: string, closesAt: Date) {
  try {
    const io = getIO();
    if (!io) return;
    io.to(`subject:${subjectId}`).emit('session:extended', {
      sessionId,
      closesAt,
    });
  } catch (err) {
    logger.error({ err }, 'Failed to emit session:extended');
  }
}

/**
 * Emit when a session window is closed.
 */
export function emitSessionClosed(subjectId: string, sessionId: string) {
  try {
    const io = getIO();
    if (!io) return;
    io.to(`subject:${subjectId}`).emit('session:closed', { sessionId });
  } catch (err) {
    logger.error({ err }, 'Failed to emit session:closed');
  }
}

/**
 * Emit when a session is finalized — update all enrolled students' dashboards.
 */
export async function emitSessionFinalized(subjectId: string, sessionId: string) {
  try {
    const io = getIO();
    if (!io) return;

    io.to(`subject:${subjectId}`).emit('session:finalized', { sessionId });

    // Update each enrolled student's dashboard
    const enrollments = await prisma.enrollment.findMany({
      where: { subjectId },
      select: { studentId: true },
    });

    for (const e of enrollments) {
      const summary = await getStudentQuickSummary(e.studentId, subjectId);
      io.to(`user:${e.studentId}`).emit('dashboard:updated', summary);
    }
  } catch (err) {
    logger.error({ err }, 'Failed to emit session:finalized');
  }
}

// --- Internal helper ---

async function getStudentQuickSummary(studentId: string, subjectId: string) {
  const result = await prisma.$queryRaw<
    Array<{ present: bigint; total: bigint; pct: number }>
  >`
    SELECT
      COUNT(*) FILTER (WHERE a.status IN ('PRESENT','LATE'))::bigint AS present,
      COUNT(*)::bigint AS total,
      ROUND(100.0 * COUNT(*) FILTER (WHERE a.status IN ('PRESENT','LATE'))
            / NULLIF(COUNT(*), 0), 1) AS pct
    FROM "Attendance" a
    JOIN "ClassSession" cs ON cs.id = a."sessionId" AND cs.status = 'FINALIZED'
    WHERE a."studentId" = ${studentId} AND cs."subjectId" = ${subjectId}
  `;

  const r = result[0];
  return {
    subjectId,
    present: Number(r?.present ?? 0),
    total: Number(r?.total ?? 0),
    pct: Number(r?.pct ?? 0),
  };
}
