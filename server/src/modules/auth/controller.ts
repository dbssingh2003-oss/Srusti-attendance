import { Request, Response, NextFunction } from 'express';
import * as authService from './service';
import { env } from '../../config/env';

const COOKIE_NAME = 'refreshToken';
const cookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  ...(env.COOKIE_DOMAIN && env.COOKIE_DOMAIN !== 'localhost' ? { domain: env.COOKIE_DOMAIN } : {}),
  path: '/api/v1/auth',
  maxAge: env.REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000,
};

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body;
    const meta = { ip: req.ip ?? 'unknown', userAgent: req.headers['user-agent'] ?? '' };

    const result = await authService.login(email, password, meta);

    res.cookie(COOKIE_NAME, result.refreshToken, cookieOptions);
    res.json({ accessToken: result.accessToken, user: result.user });
  } catch (error) {
    next(error);
  }
}

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const meta = { ip: req.ip ?? 'unknown', userAgent: req.headers['user-agent'] ?? '' };
    const result = await authService.register(req.body, meta);

    res.cookie(COOKIE_NAME, result.refreshToken, cookieOptions);
    res.status(201).json({ accessToken: result.accessToken, user: result.user });
  } catch (error) {
    next(error);
  }
}

export async function refreshToken(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'No refresh token' } });
      return;
    }

    const meta = { ip: req.ip ?? 'unknown', userAgent: req.headers['user-agent'] ?? '' };
    const result = await authService.refresh(token, meta);

    res.cookie(COOKIE_NAME, result.refreshToken, cookieOptions);
    res.json({ accessToken: result.accessToken });
  } catch (error) {
    next(error);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[COOKIE_NAME];
    await authService.logout(token);

    res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: 0 });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function changePassword(req: Request, res: Response, next: NextFunction) {
  try {
    const { currentPassword, newPassword } = req.body;
    await authService.changePassword(req.user!.id, currentPassword, newPassword);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function forgotPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const rawToken = await authService.forgotPassword(req.body.email);
    res.json({
      message: 'If an account exists, a reset token has been generated.',
      devToken: env.NODE_ENV !== 'production' ? (rawToken ?? undefined) : undefined,
    });
  } catch (error) {
    next(error);
  }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const { token, newPassword } = req.body;
    await authService.resetPassword(token, newPassword);
    res.json({ message: 'Password has been successfully updated. You may now sign in.' });
  } catch (error) {
    next(error);
  }
}

export async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await authService.getMe(req.user!.id);
    res.json({ user });
  } catch (error) {
    next(error);
  }
}
