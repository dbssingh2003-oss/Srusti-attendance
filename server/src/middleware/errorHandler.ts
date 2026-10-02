import { Request, Response, NextFunction } from 'express';
import { AppError, isUniqueViolation, isNotFound } from '../lib/errors';
import { logger } from '../lib/logger';
import { env } from '../config/env';

/**
 * Global error handler — must be the last middleware.
 * Converts AppErrors and recognized Prisma errors to JSON, logs unexpected errors.
 */
export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
      },
    });
    return;
  }

  // Handle Prisma unique constraint violations (P2002)
  if (isUniqueViolation(err)) {
    const target = Array.isArray(err.meta?.target) ? err.meta.target.join(', ') : err.meta?.target || 'record';
    res.status(409).json({
      error: {
        code: 'CONFLICT',
        message: `A conflict occurred: ${target} already exists.`,
      },
    });
    return;
  }

  // Handle Prisma record not found (P2025)
  if (isNotFound(err)) {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'The requested resource was not found.',
      },
    });
    return;
  }

  // Handle Prisma connection errors
  if (err?.name === 'PrismaClientInitializationError') {
    logger.error({ err: err.message }, 'Database connection initialization error');
    res.status(503).json({
      error: {
        code: 'DATABASE_UNAVAILABLE',
        message: 'Database connection failed. Please ensure the database server is running and reachable.',
      },
    });
    return;
  }

  // Unexpected error
  logger.error(
    {
      err: err?.message || err,
      stack: err?.stack,
      method: req.method,
      url: req.originalUrl,
      userId: req.user?.id,
    },
    'Unhandled error'
  );

  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred.',
      ...(env.NODE_ENV !== 'production' ? { detail: err?.message || String(err) } : {}),
    },
  });
}

