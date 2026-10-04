// Vercel's @vercel/node runtime compiles TypeScript natively.
// Wrap in try-catch to surface initialization errors clearly.

let app: any;
let initError: Error | null = null;

try {
  app = require('../server/src/app').default || require('../server/src/app');
} catch (err: any) {
  initError = err;
  console.error('=== FATAL: Failed to initialize Express app ===');
  console.error(err?.message);
  console.error(err?.stack);
}

export default function handler(req: any, res: any) {
  if (initError || !app) {
    res.status(500).json({
      error: 'INIT_FAILED',
      message: initError?.message || 'App failed to initialize',
      stack: initError?.stack?.split('\n').slice(0, 10),
    });
    return;
  }
  return app(req, res);
}
