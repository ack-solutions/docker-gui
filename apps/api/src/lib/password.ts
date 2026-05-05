import { scrypt as scryptCb, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
) => Promise<Buffer>;

const KEY_LEN = 64;
const SALT_LEN = 16;
const ALGO = 'scrypt';

/**
 * Hash a password using scrypt (NIST-approved, built into Node, no native deps).
 * Output format: `scrypt:<salt-hex>:<key-hex>`
 */
export async function hashPassword(password: string): Promise<string> {
  if (typeof password !== 'string' || password.length === 0) {
    throw new Error('password must be a non-empty string');
  }
  const salt = randomBytes(SALT_LEN).toString('hex');
  const key = await scrypt(password, salt, KEY_LEN);
  return `${ALGO}:${salt}:${key.toString('hex')}`;
}

/**
 * Verify a password against a stored hash. Constant-time comparison.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (typeof password !== 'string' || typeof stored !== 'string') return false;
  const parts = stored.split(':');
  if (parts.length !== 3) return false;
  const [algo, salt, keyHex] = parts;
  if (algo !== ALGO || !salt || !keyHex) return false;
  let keyBuf: Buffer;
  try {
    keyBuf = Buffer.from(keyHex, 'hex');
  } catch {
    return false;
  }
  if (keyBuf.length !== KEY_LEN) return false;
  const candidate = await scrypt(password, salt, KEY_LEN);
  return candidate.length === keyBuf.length && timingSafeEqual(candidate, keyBuf);
}
