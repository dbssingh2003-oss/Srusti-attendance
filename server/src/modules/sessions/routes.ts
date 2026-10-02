import { Router } from 'express';
import * as controller from './controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { createSessionSchema, extendWindowSchema, sessionQuerySchema, sessionParamsSchema } from './schema';

const router = Router();

// All routes require authentication and TEACHER role
router.use(authenticate, requireRole('TEACHER'));

router.post('/', validate({ body: createSessionSchema }), controller.createSession);
router.get('/', validate({ query: sessionQuerySchema }), controller.getSessions);
router.get('/:id', validate({ params: sessionParamsSchema }), controller.getSession);
router.post('/:id/open', validate({ params: sessionParamsSchema }), controller.openSession);
router.post('/:id/extend', validate({ params: sessionParamsSchema, body: extendWindowSchema }), controller.extendWindow);
router.post('/:id/close', validate({ params: sessionParamsSchema }), controller.closeWindow);
router.post('/:id/finalize', validate({ params: sessionParamsSchema }), controller.finalizeSession);
router.post('/:id/cancel', validate({ params: sessionParamsSchema }), controller.cancelSession);
router.get('/:id/live', validate({ params: sessionParamsSchema }), controller.getLiveSession);


export default router;
