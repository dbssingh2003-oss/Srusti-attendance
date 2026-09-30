import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { prisma } from '../../lib/prisma';
import { AppError, isUniqueViolation } from '../../lib/errors';

const router = Router();

// All teacher routes require authentication and TEACHER role
router.use(authenticate, requireRole('TEACHER'));

const createSubjectSchema = z.object({
  code: z.string().min(1, 'Subject code is required').max(20),
  name: z.string().min(1, 'Subject name is required').max(100),
});

const updateSubjectSchema = z.object({
  code: z.string().min(1).max(20).optional(),
  name: z.string().min(1).max(100).optional(),
});

const idParamSchema = z.object({
  id: z.string().uuid(),
});

// List all subjects for teacher (with teacher's own prioritized)
router.get('/subjects', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const mineOnly = req.query.mineOnly === 'true';

    const subjects = await prisma.subject.findMany({
      where: mineOnly ? { teacherId: req.user!.id } : undefined,
      include: {
        teacher: { select: { id: true, name: true, email: true } },
        _count: {
          select: { enrollments: true, sessions: true },
        },
      },
      orderBy: { code: 'asc' },
    });

    const formatted = subjects.map((sub) => ({
      ...sub,
      isMine: sub.teacherId === req.user!.id,
    }));

    // Sort: teacher's own subjects first, then alphabetically
    formatted.sort((a, b) => {
      if (a.isMine && !b.isMine) return -1;
      if (!a.isMine && b.isMine) return 1;
      return a.code.localeCompare(b.code);
    });

    res.json(formatted);
  } catch (error) {
    next(error);
  }
});

// Create a new subject assigned to this teacher
router.post(
  '/subjects',
  validate({ body: createSubjectSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { code, name } = req.body;
      const formattedCode = code.trim().toUpperCase();

      const existing = await prisma.subject.findUnique({
        where: { code: formattedCode },
      });
      if (existing) {
        throw new AppError('VALIDATION_ERROR', 400, `Subject code "${formattedCode}" is already in use`);
      }

      const subject = await prisma.subject.create({
        data: {
          code: formattedCode,
          name: name.trim(),
          teacherId: req.user!.id,
        },
        include: {
          _count: {
            select: { enrollments: true, sessions: true },
          },
        },
      });

      res.status(201).json(subject);
    } catch (error) {
      if (isUniqueViolation(error)) {
        return next(new AppError('VALIDATION_ERROR', 400, 'Subject code already exists'));
      }
      next(error);
    }
  }
);

// Manually edit / update a subject by teacher
router.put(
  '/subjects/:id',
  validate({ params: idParamSchema, body: updateSubjectSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const subjectId = req.params.id as string;
      const { code, name } = req.body;

      // Verify the subject exists and belongs to this teacher
      const subject = await prisma.subject.findUnique({
        where: { id: subjectId },
      });

      if (!subject) {
        throw new AppError('NOT_FOUND', 404, 'Subject not found');
      }

      if (subject.teacherId !== req.user!.id && req.user!.role !== 'ADMIN') {
        throw new AppError('FORBIDDEN', 403, 'You can only edit your own assigned subjects');
      }

      const dataToUpdate: { code?: string; name?: string } = {};

      if (code && code.trim()) {
        const formattedCode = code.trim().toUpperCase();
        // Check uniqueness if changed
        if (formattedCode !== subject.code) {
          const codeTaken = await prisma.subject.findUnique({
            where: { code: formattedCode },
          });
          if (codeTaken) {
            throw new AppError('VALIDATION_ERROR', 400, `Subject code "${formattedCode}" is already taken`);
          }
        }
        dataToUpdate.code = formattedCode;
      }

      if (name && name.trim()) {
        dataToUpdate.name = name.trim();
      }

      const updated = await prisma.subject.update({
        where: { id: subjectId },
        data: dataToUpdate,
        include: {
          _count: {
            select: { enrollments: true, sessions: true },
          },
        },
      });

      res.json(updated);
    } catch (error) {
      if (isUniqueViolation(error)) {
        return next(new AppError('VALIDATION_ERROR', 400, 'Subject code already exists'));
      }
      next(error);
    }
  }
);

// Delete subject if no completed sessions
router.delete(
  '/subjects/:id',
  validate({ params: idParamSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const subjectId = req.params.id as string;
      const subject = await prisma.subject.findUnique({
        where: { id: subjectId },
        include: { _count: { select: { sessions: true } } },
      });

      if (!subject) {
        throw new AppError('NOT_FOUND', 404, 'Subject not found');
      }

      if (subject.teacherId !== req.user!.id && req.user!.role !== 'ADMIN') {
        throw new AppError('FORBIDDEN', 403, 'You can only delete your own subjects');
      }

      if (subject._count.sessions > 0) {
        throw new AppError('CONFLICT', 409, 'Cannot delete subject that already has attendance sessions');
      }

      // Delete enrollments first
      await prisma.enrollment.deleteMany({ where: { subjectId } });
      await prisma.subject.delete({ where: { id: subjectId } });

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

export default router;
