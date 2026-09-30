import { Router } from 'express';
import * as controller from './controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';

const router = Router();

router.use(authenticate, requireRole('TEACHER'));

router.get('/daily', controller.getDailyReport);
router.get('/summary', controller.getSummaryReport);

export default router;
