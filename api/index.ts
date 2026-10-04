import type { VercelRequest, VercelResponse } from '@vercel/node';
import app from '../server/src/app';

export default function handler(req: VercelRequest, res: VercelResponse) {
  try {
    return app(req as any, res as any);
  } catch (err: any) {
    console.error('Unhandled Vercel serverless handler error:', err);
    if (!res.headersSent) {
      res.status(500).json({
        error: {
          code: 'SERVERLESS_ERROR',
          message: 'An error occurred processing the request on Vercel.',
          detail: err?.message || String(err),
        },
      });
    }
  }
}


