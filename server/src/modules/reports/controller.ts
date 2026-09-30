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
    const format = (req.query.format as string) ?? 'json';

    const data = await reportService.getDailyReport(filters);

    if (format === 'csv') {
      const csv = reportService.exportCsv(data);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="attendance-${data.subject.code}-${data.from}.csv"`);
      res.send(csv);
      return;
    }

    res.json(data);
  } catch (error) {
    next(error);
  }
}

export async function getSummaryReport(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await reportService.getSummaryReport({
      subjectId: req.query.subjectId as string,
      from: req.query.from as string,
      to: req.query.to as string,
      teacherId: req.user!.id,
    });
    res.json(data);
  } catch (error) {
    next(error);
  }
}
