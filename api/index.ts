// Pre-bundled server entry point for Vercel.
// The server is compiled to api/server.cjs during vercel-build.

let app: any;
let initError: any = null;

try {
  const mod = require('./server.cjs');
  app = mod.default || mod;
} catch (err: any) {
  initError = err;
  console.error('[Vercel] FATAL — server bundle failed to load:', err?.message);
  console.error(err?.stack);
}

export default function handler(req: any, res: any) {
  if (initError || !app) {
    return res.status(500).json({
      error: 'INIT_FAILED',
      message: initError?.message || 'Server failed to initialize',
    });
  }
  return app(req, res);
}
