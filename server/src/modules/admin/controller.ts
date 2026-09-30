import { Request, Response, NextFunction } from 'express';
import * as adminService from './service';

// ===== USERS =====

export async function listUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.listUsers({
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
      search: req.query.search as string | undefined,
      role: req.query.role as any,
    });
    res.json(result);
  } catch (error) { next(error); }
}

export async function createUser(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await adminService.createUser(req.body);
    res.status(201).json(user);
  } catch (error) { next(error); }
}

export async function updateUser(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await adminService.updateUser(req.params.id as string, req.body);
    res.json(user);
  } catch (error) { next(error); }
}

export async function resetUserPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.resetUserPassword(req.params.id as string);
    res.json(result);
  } catch (error) { next(error); }
}

// ===== SUBJECTS =====

export async function listSubjects(_req: Request, res: Response, next: NextFunction) {
  try {
    const subjects = await adminService.listSubjects();
    res.json(subjects);
  } catch (error) { next(error); }
}

export async function createSubject(req: Request, res: Response, next: NextFunction) {
  try {
    const subject = await adminService.createSubject(req.body);
    res.status(201).json(subject);
  } catch (error) { next(error); }
}

export async function updateSubject(req: Request, res: Response, next: NextFunction) {
  try {
    const subject = await adminService.updateSubject(req.params.id as string, req.body);
    res.json(subject);
  } catch (error) { next(error); }
}

// ===== ENROLLMENTS =====

export async function listEnrollments(req: Request, res: Response, next: NextFunction) {
  try {
    const enrollments = await adminService.listEnrollments(req.query.subjectId as string | undefined);
    res.json(enrollments);
  } catch (error) { next(error); }
}

export async function enrollStudent(req: Request, res: Response, next: NextFunction) {
  try {
    const enrollment = await adminService.enrollStudent(req.body.studentId, req.body.subjectId);
    res.status(201).json(enrollment);
  } catch (error) { next(error); }
}

export async function bulkEnroll(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.bulkEnroll(req.body.subjectId, req.body.studentIds);
    res.json(result);
  } catch (error) { next(error); }
}

export async function unenrollStudent(req: Request, res: Response, next: NextFunction) {
  try {
    await adminService.unenrollStudent(req.params.studentId as string, req.params.subjectId as string);
    res.status(204).send();
  } catch (error) { next(error); }
}

// ===== AUDIT LOGS =====

export async function getAuditLogs(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.getAuditLogs({
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 50,
    });
    res.json(result);
  } catch (error) { next(error); }
}
