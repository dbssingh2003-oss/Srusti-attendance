import { Request, Response, NextFunction } from 'express';
import * as reportService from './service';

export async function getDailyReport(req: Request, res: Response, next: NextFunction) {
  try {
    const filters = {
      subjectId: req.query.subjectId as string,
      from: req.query.from as string,
      to: req.query.to as string,
      teacherId: req.user!.id,
    };
    const format = (req.query.format as string)?.toLowerCase() ?? 'json';

    const data = await reportService.getDailyReport(filters);

    if (format === 'csv') {
      const csv = reportService.exportCsv(data);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="attendance-${data.subject.code}-${data.from}.csv"`);
      res.send(csv);
      return;
    }

    if (format === 'xlsx' || format === 'excel') {
      const buffer = await reportService.exportDailyExcel(data);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="attendance-${data.subject.code}-${data.from}.xlsx"`);
      res.send(buffer);
      return;
    }

    res.json(data);
  } catch (error) {
    next(error);
  }
}

export async function getSummaryReport(req: Request, res: Response, next: NextFunction) {
  try {
    const format = (req.query.format as string)?.toLowerCase() ?? 'json';
    const data = await reportService.getSummaryReport({
      subjectId: req.query.subjectId as string,
      from: req.query.from as string,
      to: req.query.to as string,
      teacherId: req.user!.id,
    });

    if (format === 'csv') {
      const csv = reportService.exportSummaryCsv(data);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="summary-${data.subject.code}-${data.from}.csv"`);
      res.send(csv);
      return;
    }

    if (format === 'xlsx' || format === 'excel') {
      const buffer = await reportService.exportSummaryExcel(data);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="summary-${data.subject.code}-${data.from}.xlsx"`);
      res.send(buffer);
      return;
    }

    res.json(data);
  } catch (error) {
    next(error);
  }
}
