import { prisma } from '../../lib/prisma';
import { AppError } from '../../lib/errors';
import { formatDate, formatTime } from '../../lib/time';
import { stringify } from 'csv-stringify/sync';
import ExcelJS from 'exceljs';

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

/**
 * Export daily report as Excel workbook.
 */
export async function exportDailyExcel(data: Awaited<ReturnType<typeof getDailyReport>>): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Srusti Attendance Portal';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(`Daily - ${data.subject.code}`);

  worksheet.columns = [
    { header: 'Roll No', key: 'rollNo', width: 16 },
    { header: 'Name', key: 'name', width: 28 },
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Session Time', key: 'sessionTime', width: 24 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Marked At', key: 'markedAt', width: 16 },
  ];

  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4F46E5' },
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 24;

  data.rows.forEach((r) => {
    const row = worksheet.addRow(r);
    row.height = 20;
    const statusCell = row.getCell('status');
    if (r.status === 'PRESENT') {
      statusCell.font = { color: { argb: 'FF16A34A' }, bold: true };
    } else if (r.status === 'ABSENT') {
      statusCell.font = { color: { argb: 'FFDC2626' }, bold: true };
    } else if (r.status === 'LATE') {
      statusCell.font = { color: { argb: 'FFD97706' }, bold: true };
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Export summary report as CSV.
 */
export function exportSummaryCsv(data: Awaited<ReturnType<typeof getSummaryReport>>): string {
  return stringify(data.students, {
    header: true,
    columns: [
      { key: 'rollNo', header: 'Roll No' },
      { key: 'name', header: 'Student Name' },
      { key: 'present', header: 'Attended' },
      { key: 'total', header: 'Total Sessions' },
      { key: 'pct', header: 'Percentage (%)' },
    ],
  });
}

/**
 * Export summary report as Excel workbook.
 */
export async function exportSummaryExcel(data: Awaited<ReturnType<typeof getSummaryReport>>): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Srusti Attendance Portal';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(`Summary - ${data.subject.code}`);

  worksheet.columns = [
    { header: 'Roll No', key: 'rollNo', width: 16 },
    { header: 'Student Name', key: 'name', width: 28 },
    { header: 'Attended', key: 'present', width: 14 },
    { header: 'Total Sessions', key: 'total', width: 16 },
    { header: 'Percentage (%)', key: 'pct', width: 16 },
  ];

  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4F46E5' },
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 24;

  data.students.forEach((s) => {
    const row = worksheet.addRow(s);
    row.height = 20;
    const pctCell = row.getCell('pct');
    if (s.pct < 75) {
      pctCell.font = { color: { argb: 'FFDC2626' }, bold: true };
    } else {
      pctCell.font = { color: { argb: 'FF16A34A' }, bold: true };
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
