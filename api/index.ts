import type { VercelRequest, VercelResponse } from '@vercel/node';

let appInstance: any;

function getApp() {
  if (!appInstance) {
    try {
      // Compiled JS in production / Vercel
      appInstance = require('../server/dist/app').default || require('../server/dist/app');
    } catch {
      // TypeScript fallback for tsx / dev
      appInstance = require('../server/src/app').default || require('../server/src/app');
    }
  }
  return appInstance;
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  return new Promise((resolve) => {
    res.on('finish', () => resolve(true));
    res.on('close', () => resolve(true));
    try {
      const app = getApp();
      app(req as any, res as any);
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
      resolve(false);
    }
  });
}


