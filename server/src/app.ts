import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { generalLimiter } from './middleware/rateLimit';
import { logger } from './lib/logger';

// Route imports
import authRoutes from './modules/auth/routes';
import sessionRoutes from './modules/sessions/routes';
import attendanceRoutes from './modules/attendance/routes';
import reportRoutes from './modules/reports/routes';
import adminRoutes from './modules/admin/routes';
import teacherRoutes from './modules/teacher/routes';

const app = express();

// Global middleware
app.use(helmet({
  contentSecurityPolicy: env.NODE_ENV === 'production' ? undefined : false,
}));
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (env.CLIENT_ORIGIN === '*' || origin === env.CLIENT_ORIGIN) return callback(null, true);
    if (origin.endsWith('.vercel.app')) return callback(null, true);
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) return callback(null, true);
    return callback(null, true);
  },
  credentials: true,
}));
app.use(compression());
app.use((req, res, next) => {
  if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
    return next();
  }
  return express.json({ limit: '2mb' })(req, res, next);
});
app.use(cookieParser());
app.use(generalLimiter);

// Request logging
app.use((req, _res, next) => {
  logger.debug({ method: req.method, url: req.url }, 'Request');
  next();
});

// Health check
app.get(['/api/health', '/health'], (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes mounted for both standard (/api/v1) and Vercel-stripped (/v1) paths
const registerRoutes = (prefix: string) => {
  app.use(`${prefix}/auth`, authRoutes);
  app.use(`${prefix}/sessions`, sessionRoutes);
  app.use(`${prefix}`, attendanceRoutes);
  app.use(`${prefix}/reports`, reportRoutes);
  app.use(`${prefix}/admin`, adminRoutes);
  app.use(`${prefix}/teacher`, teacherRoutes);
};

registerRoutes('/api/v1');
registerRoutes('/v1');

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
});

// Error handler (must be last)
app.use(errorHandler);

export default app;
