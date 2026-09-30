import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AppError } from '../lib/errors';
import { prisma } from '../lib/prisma';
import { Role } from '@prisma/client';

export interface JwtPayload {
  sub: string; // userId
  role: Role;
  email: string;
  iat: number;
  exp: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: Role;
        email: string;
      };
    }
  }
}

/**
 * Middleware: verify the JWT access token from the Authorization header.
 */
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new AppError('UNAUTHORIZED', 401, 'Missing or invalid authorization header');
    }

    const token = header.slice(7);
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;

    // Verify user still exists and is active
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, email: true, isActive: true, mustChangePassword: true },
    });

    if (!user || !user.isActive) {
      throw new AppError('UNAUTHORIZED', 401, 'User not found or deactivated');
    }

    req.user = { id: user.id, role: user.role, email: user.email };
    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else if (error instanceof jwt.JsonWebTokenError) {
      next(new AppError('UNAUTHORIZED', 401, 'Invalid or expired token'));
    } else {
      next(error);
    }
  }
}

/**
 * Generate an access JWT.
 */
export function signAccessToken(user: { id: string; role: Role; email: string }): string {
  return jwt.sign(
    { sub: user.id, role: user.role, email: user.email },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_TTL as any }
  );
}
