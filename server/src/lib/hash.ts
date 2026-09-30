import * as argon2 from 'argon2';
import { randomBytes, createHash } from 'node:crypto';

/**
 * Hash a password using argon2id.
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MB
    timeCost: 3,
    parallelism: 4,
  });
}

/**
 * Verify a password against an argon2id hash.
 */
export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password);
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
