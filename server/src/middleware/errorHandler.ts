import { Request, Response, NextFunction } from 'express';
import { AppError } from '../lib/errors';
import { logger } from '../lib/logger';

/**
 * Global error handler — must be the last middleware.
 * Converts AppErrors to JSON, logs unexpected errors.
 */
export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
      },
    });
    return;
  }

  // Unexpected error
  logger.error(
    {
      err,
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
    },
  });
}
