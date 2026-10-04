// Vercel Serverless Function entry point.
// @vercel/node compiles TypeScript and all imports natively.

let app: any;
let initError: Error | null = null;

try {
  const mod = require('../server/src/app');
  app = mod.default || mod;
} catch (err: any) {
  initError = err;
  console.error('[Vercel] FATAL — Express app failed to initialize:', err.message);
  console.error(err.stack);
}

export default function handler(req: any, res: any) {
  if (initError || !app) {
    return res.status(500).json({
      error: 'INIT_FAILED',
      message: initError?.message || 'Unknown initialization error',
    });
  }
  return app(req, res);
}
