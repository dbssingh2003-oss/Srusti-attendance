import { Router } from 'express';
import * as controller from './controller';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import { loginLimiter, forgotPasswordLimiter } from '../../middleware/rateLimit';
import { loginSchema, registerSchema, changePasswordSchema, forgotPasswordSchema, resetPasswordSchema } from './schema';

const router = Router();

router.post('/login', loginLimiter, validate({ body: loginSchema }), controller.login);
router.post('/register', validate({ body: registerSchema }), controller.register);
router.post('/refresh', controller.refreshToken);
router.post('/logout', controller.logout);
router.post('/change-password', authenticate, validate({ body: changePasswordSchema }), controller.changePassword);
router.post('/forgot-password', forgotPasswordLimiter, validate({ body: forgotPasswordSchema }), controller.forgotPassword);
router.post('/reset-password', validate({ body: resetPasswordSchema }), controller.resetPassword);
router.get('/me', authenticate, controller.getMe);

export default router;
