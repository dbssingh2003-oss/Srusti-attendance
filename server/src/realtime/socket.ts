import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { JwtPayload } from '../middleware/auth';

let io: Server;

export function initSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: env.CLIENT_ORIGIN,
      credentials: true,
    },
    pingTimeout: 10000,
    pingInterval: 25000,
  });

  // JWT authentication handshake
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication required'));
      }

      const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, role: true, isActive: true },
      });

      if (!user || !user.isActive) {
        return next(new Error('User not found or deactivated'));
      }

      // Attach user data to socket
      (socket as any).userId = user.id;
      (socket as any).userRole = user.role;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket: Socket) => {
    const userId = (socket as any).userId as string;
    const userRole = (socket as any).userRole as string;

    logger.debug({ userId, socketId: socket.id }, 'Socket connected');

    // Auto-join personal room
    socket.join(`user:${userId}`);

    // Auto-join subject rooms
    try {
      if (userRole === 'STUDENT') {
        const enrollments = await prisma.enrollment.findMany({
          where: { studentId: userId },
          select: { subjectId: true },
        });
        for (const e of enrollments) {
          socket.join(`subject:${e.subjectId}`);
        }
      } else if (userRole === 'TEACHER') {
        const subjects = await prisma.subject.findMany({
          where: { teacherId: userId },
          select: { id: true },
        });
        for (const s of subjects) {
          socket.join(`subject:${s.id}`);
        }
      }
    } catch (err) {
      logger.error({ err, userId }, 'Failed to join rooms');
    }

    // Allow teacher to join session rooms for live view
    socket.on('join:session', (sessionId: string) => {
      if (userRole === 'TEACHER') {
        socket.join(`session:${sessionId}`);
        logger.debug({ userId, sessionId }, 'Teacher joined session room');
      }
    });

    socket.on('leave:session', (sessionId: string) => {
      socket.leave(`session:${sessionId}`);
    });

    socket.on('disconnect', () => {
      logger.debug({ userId, socketId: socket.id }, 'Socket disconnected');
    });
  });

  return io;
}

export function getIO(): Server | null {
  return io ?? null;
}

