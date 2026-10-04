// Vercel's @vercel/node runtime compiles TypeScript natively.
// We simply import the Express app and export it as the handler.
import app from '../server/src/app';

export default app;
