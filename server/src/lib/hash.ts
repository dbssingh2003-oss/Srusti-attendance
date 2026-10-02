import * as argon2 from 'argon2';
import { randomBytes, createHash } from 'node:crypto';

import { logger } from './logger';

/**
 * Hash a password using argon2id.
 * Safe configuration: 19MB memory, 2 iterations, 1 parallelism thread.
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456, // 19 MB (OWASP recommended for container/serverless)
    timeCost: 2,
    parallelism: 1,
  });
}

/**
 * Verify a password against an argon2id hash.
 * Safely catches corrupted/invalid hashes and returns false instead of throwing 500 errors.
 */
export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  if (!hash || !password) return false;
  try {
    return await argon2.verify(hash, password);
  } catch (err: any) {
    logger.warn({ err: err?.message }, 'Argon2 password verification exception caught safely');
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
