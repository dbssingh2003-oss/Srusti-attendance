import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { AppError } from '../lib/errors';

/**
 * Middleware factory: validate request body, query, and params against a Zod schema.
 */
export function validate(schema: {
  body?: z.ZodTypeAny;
  query?: z.ZodTypeAny;
  params?: z.ZodTypeAny;
}) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schema.body) {
        req.body = schema.body.parse(req.body);
      }
      if (schema.query) {
        const parsedQuery = schema.query.parse(req.query);
        Object.defineProperty(req, 'query', {
          value: parsedQuery,
          writable: true,
          configurable: true,
          enumerable: true,
        });
      }
      if (schema.params) {
        const parsedParams = schema.params.parse(req.params);
        Object.defineProperty(req, 'params', {
          value: parsedParams,
          writable: true,
          configurable: true,
          enumerable: true,
        });
      }
      next();
    } catch (error: any) {
      if (error instanceof ZodError || error?.issues) {
        const issues: any[] = error.issues ?? error.errors ?? [];
        const message = issues.map((e: any) => `${e.path?.join('.')}: ${e.message}`).join('; ');
        next(new AppError('VALIDATION_ERROR', 400, message));
      } else {
        next(error);
      }
    }
  };
}
