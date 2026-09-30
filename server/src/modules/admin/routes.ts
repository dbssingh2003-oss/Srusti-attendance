import { Router } from 'express';
import * as controller from './controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import {
  createUserSchema, updateUserSchema,
  createSubjectSchema, updateSubjectSchema,
  enrollmentSchema, bulkEnrollmentSchema,
  idParamSchema,
} from './schema';

const router = Router();

// All admin routes require ADMIN role
router.use(authenticate, requireRole('ADMIN'));

// Users
router.get('/users', controller.listUsers);
router.post('/users', validate({ body: createUserSchema }), controller.createUser);
router.patch('/users/:id', validate({ params: idParamSchema, body: updateUserSchema }), controller.updateUser);
router.post('/users/:id/reset-password', validate({ params: idParamSchema }), controller.resetUserPassword);

// Subjects
router.get('/subjects', controller.listSubjects);
router.post('/subjects', validate({ body: createSubjectSchema }), controller.createSubject);
router.patch('/subjects/:id', validate({ params: idParamSchema, body: updateSubjectSchema }), controller.updateSubject);

// Enrollments
router.get('/enrollments', controller.listEnrollments);
router.post('/enrollments', validate({ body: enrollmentSchema }), controller.enrollStudent);
router.post('/enrollments/bulk', validate({ body: bulkEnrollmentSchema }), controller.bulkEnroll);
router.delete('/enrollments/:studentId/:subjectId', controller.unenrollStudent);

// Audit logs
router.get('/audit-logs', controller.getAuditLogs);

export default router;
