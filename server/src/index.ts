import http from 'http';
import app from './app';
import { env } from './config/env';
import { logger } from './lib/logger';
import { initSocket } from './realtime/socket';
import { startReconciler } from './jobs/reconcile';

const server = http.createServer(app);

// Initialize Socket.IO
initSocket(server);

// Start the reconciler (session state machine sweeper)
startReconciler();

server.listen(env.PORT, () => {
  logger.info({
    port: env.PORT,
    env: env.NODE_ENV,
    timezone: env.APP_TIMEZONE,
  }, `🚀 Server running on port ${env.PORT}`);
});

// Graceful shutdown
const shutdown = async (signal: string) => {
  logger.info({ signal }, 'Shutting down...');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
  // Force exit after 10s
  setTimeout(() => process.exit(1), 10_000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (err) => {
  logger.error({ err }, 'Unhandled rejection');
});
