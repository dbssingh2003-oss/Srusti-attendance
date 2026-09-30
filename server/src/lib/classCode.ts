import { randomInt } from 'node:crypto';

// Alphabet without O, 0, I, 1, L to avoid confusion
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/**
 * Generate a cryptographically random class code.
 * @param len Length of the code (default: 6)
 */
export function generateClassCode(len = 6): string {
  return Array.from({ length: len }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
}

/**
 * Regex pattern for validating a class code.
 */
export const CLASS_CODE_PATTERN = /^[A-HJ-KM-NP-Z2-9]{6}$/;
