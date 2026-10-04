import { env } from '../config/env';

// In serverless environments (Vercel), socket.io cannot work because:
// 1. There's no persistent HTTP server
// 2. Each function invocation is isolated
// So we lazy-load socket.io and return a no-op getIO() when not initialized.

let _io: any = null;

/**
 * Initialize socket.io on an HTTP server.
 * Only called in the standalone server (index.ts), never on Vercel.
 */
export async function initSocket(httpServer: any): Promise<any> {
  try {
    const { Server } = await import('socket.io');
    const jwt = await import('jsonwebtoken');
    const { prisma } = await import('../lib/prisma');
    const { logger } = await import('../lib/logger');

    _io = new Server(httpServer, {
      cors: { origin: env.CLIENT_ORIGIN, credentials: true },
      pingTimeout: 10000,
      pingInterval: 25000,
    });

    _io.use(async (socket: any, next: any) => {
      try {
        const token = socket.handshake.auth.token;
        if (!token) return next(new Error('Authentication required'));
        const payload = jwt.default.verify(token, env.JWT_ACCESS_SECRET) as any;
        const user = await prisma.user.findUnique({
          where: { id: payload.sub },
          select: { id: true, role: true, isActive: true },
        });
        if (!user || !user.isActive) return next(new Error('User not found or deactivated'));
        socket.userId = user.id;
        socket.userRole = user.role;
        next();
      } catch {
        next(new Error('Invalid token'));
      }
    });

    _io.on('connection', async (socket: any) => {
      const { logger: log } = await import('../lib/logger');
      const userId = socket.userId as string;
      const userRole = socket.userRole as string;
      log.debug({ userId, socketId: socket.id }, 'Socket connected');
      socket.join(`user:${userId}`);
      try {
        if (userRole === 'STUDENT') {
          const enrollments = await prisma.enrollment.findMany({
            where: { studentId: userId },
            select: { subjectId: true },
          });
          for (const e of enrollments) socket.join(`subject:${e.subjectId}`);
        } else if (userRole === 'TEACHER') {
          const subjects = await prisma.subject.findMany({
            where: { teacherId: userId },
            select: { id: true },
          });
          for (const s of subjects) socket.join(`subject:${s.id}`);
        }
      } catch (err) {
        log.error({ err, userId }, 'Failed to join rooms');
      }
      socket.on('join:session', (sessionId: string) => {
        if (userRole === 'TEACHER') socket.join(`session:${sessionId}`);
      });
      socket.on('leave:session', (sessionId: string) => socket.leave(`session:${sessionId}`));
      socket.on('disconnect', () => log.debug({ userId, socketId: socket.id }, 'Socket disconnected'));
    });

    return _io;
  } catch (err) {
    const { logger } = await import('../lib/logger');
    logger.warn({ err }, 'Socket.io failed to initialize (serverless environment?)');
    return null;
  }
}

/**
 * Get the socket.io server instance.
 * Returns null in serverless environments — callers must handle null gracefully.
 */
export function getIO(): any {
  return _io;
}
