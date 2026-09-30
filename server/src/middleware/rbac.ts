import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { AppError } from '../lib/errors';

/**
 * Middleware factory: require one or more roles.
 */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('UNAUTHORIZED', 401));
    }
    if (!roles.includes(req.user.role)) {
      return next(new AppError('FORBIDDEN', 403, `Requires role: ${roles.join(' or ')}`));
    }
    next();
  };
}
