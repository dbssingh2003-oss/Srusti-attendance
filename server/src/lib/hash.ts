import bcrypt from 'bcryptjs';
import { randomBytes, createHash } from 'node:crypto';
import { logger } from './logger';

const BCRYPT_ROUNDS = 12; // OWASP recommended minimum for bcrypt

/**
 * Hash a password using bcrypt.
 * Uses 12 rounds (OWASP recommended) — pure JS, works on all platforms.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Verify a password against a bcrypt hash.
 * Safely catches corrupted/invalid hashes and returns false instead of throwing 500 errors.
 */
export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  if (!hash || !password) return false;
  try {
    return await bcrypt.compare(password, hash);
  } catch (err: any) {
    logger.warn({ err: err?.message }, 'Bcrypt password verification exception caught safely');
    return false;
  }
}

/**
 * Generate a cryptographically random token (hex-encoded).
 * @param bytes Number of random bytes (default: 32 = 256 bits)
 */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}

/**
 * Hash a token with SHA-256 for safe storage.
 * Only the hash is stored; the raw token is sent to the user.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
