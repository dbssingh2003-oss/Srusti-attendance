import { z } from 'zod';

export const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  role: z.enum(['TEACHER', 'STUDENT']),
  rollNo: z.string().optional(),
  password: z.string().min(10).optional(), // auto-generated if not provided
});

export const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
  rollNo: z.string().optional(),
});

export const createSubjectSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  teacherId: z.string().uuid(),
});

export const updateSubjectSchema = z.object({
  code: z.string().min(1).max(20).optional(),
  name: z.string().min(1).max(100).optional(),
  teacherId: z.string().uuid().optional(),
});

export const enrollmentSchema = z.object({
  studentId: z.string().uuid(),
  subjectId: z.string().uuid(),
});

export const bulkEnrollmentSchema = z.object({
  subjectId: z.string().uuid(),
  studentIds: z.array(z.string().uuid()).min(1),
});

export const idParamSchema = z.object({
  id: z.string().uuid(),
});

export const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1).optional(),
  limit: z.coerce.number().min(1).max(100).default(20).optional(),
  search: z.string().optional(),
});
