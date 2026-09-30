import { Request, Response, NextFunction } from 'express';
import * as attendanceService from './service';

export async function checkin(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await attendanceService.markAttendance(req.user!.id, req.body.code, {
      ip: req.ip ?? 'unknown',
      deviceId: req.body.deviceId,
      userAgent: req.headers['user-agent'],
    });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function getSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const summary = await attendanceService.getStudentSummary(req.user!.id);
    res.json(summary);
  } catch (error) {
    next(error);
  }
}

export async function getSubjectHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const history = await attendanceService.getStudentSubjectHistory(
      req.user!.id,
      req.params.subjectId as string
    );
    res.json(history);
  } catch (error) {
    next(error);
  }
}

export async function getToday(req: Request, res: Response, next: NextFunction) {
  try {
    const classes = await attendanceService.getStudentToday(req.user!.id);
    res.json(classes);
  } catch (error) {
    next(error);
  }
}
