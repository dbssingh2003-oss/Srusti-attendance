import { prisma } from '../../lib/prisma';
import { AppError } from '../../lib/errors';
import { formatDate, formatTime } from '../../lib/time';
import { stringify } from 'csv-stringify/sync';

interface ReportFilters {
  subjectId: string;
  from: string;
  to: string;
  teacherId: string;
}

/**
 * Get day-wise attendance data (JSON).
 */
export async function getDailyReport(filters: ReportFilters) {
  // Ownership check
  const subject = await prisma.subject.findUnique({ where: { id: filters.subjectId } });
  if (!subject || subject.teacherId !== filters.teacherId) {
    throw new AppError('FORBIDDEN', 403, 'You do not own this subject');
  }

  const fromDate = new Date(filters.from);
  const toDate = new Date(filters.to);

  const rows = await prisma.$queryRaw<
    Array<{
      rollNo: string | null;
      name: string;
      subjectCode: string;
      startsAt: Date;
      endsAt: Date;
      status: string;
      markedAt: Date | null;
    }>
  >`
    SELECT u."rollNo", u.name, s.code AS "subjectCode",
           cs."startsAt", cs."endsAt", a.status, a."markedAt"
    FROM "ClassSession" cs
    JOIN "Subject" s     ON s.id = cs."subjectId"
    JOIN "Attendance" a  ON a."sessionId" = cs.id
    JOIN "User" u        ON u.id = a."studentId"
    WHERE cs.status = 'FINALIZED'
      AND cs."subjectId" = ${filters.subjectId}
      AND cs."startsAt" >= ${fromDate} AND cs."startsAt" < ${toDate}
    ORDER BY cs."startsAt", u."rollNo"
  `;

  return {
    subject: { code: subject.code, name: subject.name },
    from: filters.from,
    to: filters.to,
    rows: rows.map((r) => ({
      rollNo: r.rollNo ?? '-',
      name: r.name,
      date: formatDate(r.startsAt),
      sessionTime: `${formatTime(r.startsAt)} to ${formatTime(r.endsAt)}`,
      status: r.status,
      markedAt: r.markedAt ? formatTime(r.markedAt) : '-',
    })),
  };
}

/**
 * Get summary report: per-student totals.
 */
export async function getSummaryReport(filters: ReportFilters) {
  const subject = await prisma.subject.findUnique({ where: { id: filters.subjectId } });
  if (!subject || subject.teacherId !== filters.teacherId) {
    throw new AppError('FORBIDDEN', 403, 'You do not own this subject');
  }

  const fromDate = new Date(filters.from);
  const toDate = new Date(filters.to);

  const rows = await prisma.$queryRaw<
    Array<{
      studentId: string;
      rollNo: string | null;
      name: string;
      present: bigint;
      total: bigint;
      pct: number;
    }>
  >`
    SELECT u.id AS "studentId", u."rollNo", u.name,
      COUNT(*) FILTER (WHERE a.status IN ('PRESENT','LATE'))::bigint AS present,
      COUNT(*)::bigint AS total,
      ROUND(100.0 * COUNT(*) FILTER (WHERE a.status IN ('PRESENT','LATE'))
            / NULLIF(COUNT(*), 0), 1) AS pct
    FROM "Attendance" a
    JOIN "ClassSession" cs ON cs.id = a."sessionId" AND cs.status = 'FINALIZED'
    JOIN "User" u ON u.id = a."studentId"
    WHERE cs."subjectId" = ${filters.subjectId}
      AND cs."startsAt" >= ${fromDate} AND cs."startsAt" < ${toDate}
    GROUP BY u.id, u."rollNo", u.name
    ORDER BY u."rollNo"
  `;

  return {
    subject: { code: subject.code, name: subject.name },
    from: filters.from,
    to: filters.to,
    students: rows.map((r) => ({
      studentId: r.studentId,
      rollNo: r.rollNo ?? '-',
      name: r.name,
      present: Number(r.present),
      total: Number(r.total),
      pct: Number(r.pct),
    })),
  };
}

/**
 * Export daily report as CSV.
 */
export function exportCsv(data: Awaited<ReturnType<typeof getDailyReport>>): string {
  return stringify(data.rows, {
    header: true,
    columns: [
      { key: 'rollNo', header: 'Roll No' },
      { key: 'name', header: 'Name' },
      { key: 'date', header: 'Date' },
      { key: 'sessionTime', header: 'Session Time' },
      { key: 'status', header: 'Status' },
      { key: 'markedAt', header: 'Marked At' },
    ],
  });
}
