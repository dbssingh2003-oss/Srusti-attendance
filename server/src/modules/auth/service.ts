import { prisma } from '../../lib/prisma';
import { AppError } from '../../lib/errors';
import { hashPassword, verifyPassword, generateToken, hashToken } from '../../lib/hash';
import { signAccessToken } from '../../middleware/auth';
import { logger } from '../../lib/logger';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../../config/env';
import { RegisterInput } from './schema';
import { Role } from '@prisma/client';

const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MINUTES = 15;

interface LoginMeta {
  ip: string;
  userAgent: string;
}

/**
 * Login: validate credentials, enforce lockout, issue tokens.
 */
export async function login(email: string, password: string, meta: LoginMeta) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

  if (!user || !user.isActive) {
    await auditLog(null, 'LOGIN_FAILED', 'User', undefined, { email, reason: 'not_found' }, meta.ip);
    throw new AppError('INVALID_CREDENTIALS', 401, 'Invalid email or password');
  }

  // Check lockout
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    await auditLog(user.id, 'LOGIN_FAILED', 'User', user.id, { reason: 'locked' }, meta.ip);
    throw new AppError('ACCOUNT_LOCKED', 423, 'Account is temporarily locked. Try again later.');
  }

  const valid = await verifyPassword(user.passwordHash, password);
  if (!valid) {
    const newFailedCount = user.failedLogins + 1;
    const updateData: Record<string, unknown> = { failedLogins: newFailedCount };

    if (newFailedCount >= MAX_FAILED_LOGINS) {
      updateData.lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60_000);
      logger.warn({ userId: user.id, email }, 'Account locked after failed attempts');
    }

    await prisma.user.update({ where: { id: user.id }, data: updateData });
    await auditLog(user.id, 'LOGIN_FAILED', 'User', user.id, { attempt: newFailedCount }, meta.ip);
    throw new AppError('INVALID_CREDENTIALS', 401, 'Invalid email or password');
  }

  // Reset failed login counter
  if (user.failedLogins > 0 || user.lockedUntil) {
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLogins: 0, lockedUntil: null },
    });
  }

  // Issue tokens
  const accessToken = signAccessToken({ id: user.id, role: user.role, email: user.email });
  const { rawToken: refreshToken } = await createRefreshToken(user.id, meta);

  await auditLog(user.id, 'LOGIN_SUCCESS', 'User', user.id, undefined, meta.ip);

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      rollNo: user.rollNo,
      mustChangePassword: user.mustChangePassword,
    },
  };
}

/**
 * Refresh: rotate the refresh token. Detect reuse and revoke the family.
 */
export async function refresh(rawToken: string, meta: LoginMeta) {
  const tokenHash = hashToken(rawToken);

  const existing = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (!existing) {
    throw new AppError('UNAUTHORIZED', 401, 'Invalid refresh token');
  }

  // Reuse detection: if the token is already revoked, revoke the entire family
  if (existing.revokedAt) {
    logger.warn({ familyId: existing.familyId, userId: existing.userId }, 'Refresh token reuse detected! Revoking family.');
    await prisma.refreshToken.updateMany({
      where: { familyId: existing.familyId },
      data: { revokedAt: new Date() },
    });
    await auditLog(existing.userId, 'TOKEN_REUSE_DETECTED', 'RefreshToken', existing.familyId, undefined, meta.ip);
    throw new AppError('UNAUTHORIZED', 401, 'Token reuse detected. Please log in again.');
  }

  if (existing.expiresAt < new Date()) {
    throw new AppError('UNAUTHORIZED', 401, 'Refresh token expired');
  }

  const user = await prisma.user.findUnique({
    where: { id: existing.userId },
    select: { id: true, role: true, email: true, isActive: true },
  });

  if (!user || !user.isActive) {
    throw new AppError('UNAUTHORIZED', 401, 'User not found or deactivated');
  }

  // Rotate: revoke old, issue new in the same family
  const { rawToken: newRefreshToken } = await createRefreshToken(user.id, meta, existing.familyId);

  await prisma.refreshToken.update({
    where: { id: existing.id },
    data: { revokedAt: new Date(), replacedBy: newRefreshToken },
  });

  const accessToken = signAccessToken(user);

  return { accessToken, refreshToken: newRefreshToken };
}

/**
 * Logout: revoke the refresh token.
 */
export async function logout(rawToken: string) {
  if (!rawToken) return;

  const tokenHash = hashToken(rawToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/**
 * Change password (authenticated).
 */
export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  const valid = await verifyPassword(user.passwordHash, currentPassword);
  if (!valid) {
    throw new AppError('INVALID_CREDENTIALS', 401, 'Current password is incorrect');
  }

  const newHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: newHash, mustChangePassword: false },
  });

  // Revoke all refresh tokens (force re-login on other devices)
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  await auditLog(userId, 'PASSWORD_CHANGED', 'User', userId);
}

/**
 * Register a new user (Student, Teacher, Admin), issue tokens immediately.
 */
export async function register(input: RegisterInput, meta: LoginMeta) {
  const normalizedEmail = input.email.toLowerCase();

  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });
  if (existing) {
    throw new AppError('CONFLICT', 409, 'An account with this email already exists');
  }

  if (input.rollNo) {
    const existingRoll = await prisma.user.findUnique({
      where: { rollNo: input.rollNo.toUpperCase() },
    });
    if (existingRoll) {
      throw new AppError('CONFLICT', 409, 'An account with this roll number already exists');
    }
  }

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      name: input.name,
      role: input.role as Role,
      rollNo: input.role === 'STUDENT' && input.rollNo ? input.rollNo.toUpperCase() : null,
      passwordHash,
      mustChangePassword: false,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      rollNo: true,
      mustChangePassword: true,
    },
  });

  const accessToken = signAccessToken({ id: user.id, role: user.role, email: user.email });
  const { rawToken: refreshToken } = await createRefreshToken(user.id, meta);

  await auditLog(user.id, 'USER_REGISTERED', 'User', user.id, { role: user.role }, meta.ip);

  return { accessToken, refreshToken, user };
}

/**
 * Forgot password: generate a reset token and (TODO) send email.
 */
export async function forgotPassword(email: string) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  // Always return success to prevent user enumeration
  if (!user || !user.isActive) return null;

  const rawToken = generateToken();
  const tokenHash = hashToken(rawToken);

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 60 * 60_000), // 1 hour
    },
  });

  logger.info({ userId: user.id, token: rawToken }, 'Password reset token generated');
  await auditLog(user.id, 'PASSWORD_RESET_REQUESTED', 'User', user.id);

  return rawToken;
}

/**
 * Reset password using a reset token.
 */
export async function resetPassword(rawToken: string, newPassword: string) {
  const tokenHash = hashToken(rawToken);

  const resetToken = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
    throw new AppError('UNAUTHORIZED', 401, 'Invalid or expired reset token');
  }

  const newHash = await hashPassword(newPassword);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash: newHash, mustChangePassword: false, failedLogins: 0, lockedUntil: null },
    }),
    prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    }),
    prisma.refreshToken.updateMany({
      where: { userId: resetToken.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  await auditLog(resetToken.userId, 'PASSWORD_RESET_COMPLETED', 'User', resetToken.userId);
}

/**
 * Get current user profile.
 */
export async function getMe(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      rollNo: true,
      mustChangePassword: true,
      createdAt: true,
    },
  });
  return user;
}

// --- Internal helpers ---

async function createRefreshToken(userId: string, meta: LoginMeta, familyId?: string) {
  const rawToken = generateToken();
  const tokenHash = hashToken(rawToken);
  const family = familyId ?? uuidv4();

  await prisma.refreshToken.create({
    data: {
      userId,
      familyId: family,
      tokenHash,
      expiresAt: new Date(Date.now() + env.REFRESH_TTL_DAYS * 24 * 60 * 60_000),
      ip: meta.ip,
      userAgent: meta.userAgent,
    },
  });

  return { rawToken };
}

async function auditLog(
  actorId: string | null,
  action: string,
  entity: string,
  entityId?: string,
  meta?: Record<string, unknown>,
  ip?: string
) {
  try {
    await prisma.auditLog.create({
      data: { actorId, action, entity, entityId, meta: (meta as any) ?? undefined, ip },
    });
  } catch (err) {
    logger.error({ err, action, entity }, 'Failed to write audit log');
  }
}
