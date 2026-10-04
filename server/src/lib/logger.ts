import pino from 'pino';

// Use process.env directly — don't import from env.ts to avoid circular/ordering issues.
const isProduction = process.env.NODE_ENV === 'production' ||
                     process.env.VERCEL === '1' ||
                     !!process.env.VERCEL_ENV;

let logger: pino.Logger;

if (isProduction) {
  // Production: plain JSON logs, no transports needed
  logger = pino({ level: 'info' });
} else {
  // Development: try pino-pretty, fall back to plain pino
  try {
    logger = pino({
      level: 'debug',
      transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } },
    });
  } catch {
    logger = pino({ level: 'debug' });
  }
}

export { logger };
