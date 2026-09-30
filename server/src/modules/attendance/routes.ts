import { Router } from 'express';
import * as controller from './controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { checkinLimiter, checkinIpLimiter } from '../../middleware/rateLimit';
import { checkinSchema, subjectParamsSchema } from './schema';

const router = Router();

// Check-in (student only)
router.post(
  '/checkin',
  authenticate,
  requireRole('STUDENT'),
  checkinLimiter,
  checkinIpLimiter,
  validate({ body: checkinSchema }),
  controller.checkin
);

// Student summary
router.get('/students/me/attendance', authenticate, requireRole('STUDENT'), controller.getSummary);
router.get(
  '/students/me/attendance/:subjectId',
  authenticate,
  requireRole('STUDENT'),
  validate({ params: subjectParamsSchema }),
  controller.getSubjectHistory
);
router.get('/students/me/today', authenticate, requireRole('STUDENT'), controller.getToday);

export default router;
