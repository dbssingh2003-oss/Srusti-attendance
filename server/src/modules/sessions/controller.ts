import { Request, Response, NextFunction } from 'express';
import * as sessionService from './service';

export async function createSession(req: Request, res: Response, next: NextFunction) {
  try {
    const session = await sessionService.createSession(req.user!.id, req.body);
    res.status(201).json(session);
  } catch (error) {
    next(error);
  }
}

export async function getSessions(req: Request, res: Response, next: NextFunction) {
  try {
    const sessions = await sessionService.getTeacherSessions(req.user!.id, {
      subjectId: req.query.subjectId as string | undefined,
      date: req.query.date as string | undefined,
      status: req.query.status as any,
    });
    res.json(sessions);
  } catch (error) {
    next(error);
  }
}

export async function getSession(req: Request, res: Response, next: NextFunction) {
  try {
    const session = await sessionService.getSessionDetail(req.params.id as string, req.user!.id);
    res.json(session);
  } catch (error) {
    next(error);
  }
}

export async function openSession(req: Request, res: Response, next: NextFunction) {
  try {
    const session = await sessionService.openSession(req.params.id as string, req.user!.id);
    res.json(session);
  } catch (error) {
    next(error);
  }
}

export async function extendWindow(req: Request, res: Response, next: NextFunction) {
  try {
    const session = await sessionService.extendWindow(req.params.id as string, req.body.minutes, req.user!.id);
    res.json(session);
  } catch (error) {
    next(error);
  }
}

export async function closeWindow(req: Request, res: Response, next: NextFunction) {
  try {
    const session = await sessionService.closeWindow(req.params.id as string, req.user!.id);
    res.json(session);
  } catch (error) {
    next(error);
  }
}

export async function cancelSession(req: Request, res: Response, next: NextFunction) {
  try {
    const session = await sessionService.cancelSession(req.params.id as string, req.user!.id);
    res.json(session);
  } catch (error) {
    next(error);
  }
}

export async function getLiveSession(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await sessionService.getLiveSession(req.params.id as string, req.user!.id);
    res.json(data);
  } catch (error) {
    next(error);
  }
}
