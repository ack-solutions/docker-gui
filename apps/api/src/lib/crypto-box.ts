/**
 * Symmetric encryption for credentials at rest.
 *
 * AES-256-GCM with a key derived from a long-lived secret (JWT_SECRET) via
 * HKDF-SHA-256. Each ciphertext bundles a fresh 12-byte random IV with the
 * 16-byte auth tag, so repeated encryption of the same plaintext produces
 * different output and tampering is detected on decrypt.
 *
 * Layout (base64-encoded): IV (12) || TAG (16) || CIPHERTEXT (n)
 *
 * Key rotation: change JWT_SECRET → existing ciphertexts become unreadable.
 * That's the right behavior — credentials should be re-entered after a key
 * rotation. We don't carry an envelope key here; the install model is one
 * server, one secret.
 */
import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from 'node:crypto';

const ALGO = 'aes-256-gcm';
const KEY_LEN = 32;
const IV_LEN = 12;
const TAG_LEN = 16;
const HKDF_INFO = Buffer.from('docker-gui:crypto-box:v1');
// Static salt: rotating it would invalidate stored ciphertexts on every boot.
// Per HKDF spec, a fixed salt is acceptable when the IKM has high entropy,
// which JWT_SECRET (32+ random bytes) does.
const HKDF_SALT = Buffer.from('docker-gui:crypto-box:salt:v1');

export class CryptoBox {
  private readonly key: Buffer;

  constructor(masterSecret: string) {
    if (masterSecret.length < 32) {
      throw new Error('CryptoBox: master secret must be at least 32 chars');
    }
    const derived = hkdfSync(
      'sha256',
      Buffer.from(masterSecret, 'utf-8'),
      HKDF_SALT,
      HKDF_INFO,
      KEY_LEN,
    );
    this.key = Buffer.from(derived);
  }

  /** Encrypt UTF-8 string → base64 sealed bundle. */
  seal(plaintext: string): string {
    const iv = randomBytes(IV_LEN);
    const cipher = createCipheriv(ALGO, this.key, iv);
    const enc = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, enc]).toString('base64');
  }

  /** Decrypt base64 sealed bundle → UTF-8 string. Throws on tamper. */
  open(sealed: string): string {
    const buf = Buffer.from(sealed, 'base64');
    if (buf.length < IV_LEN + TAG_LEN + 1) {
      throw new Error('CryptoBox: ciphertext too short');
    }
    const iv = buf.subarray(0, IV_LEN);
    const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const enc = buf.subarray(IV_LEN + TAG_LEN);
    const decipher = createDecipheriv(ALGO, this.key, iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
    return dec.toString('utf-8');
  }
}

/**
 * Mask a secret for display. Returns a string like "abcd••••••wxyz" — useful
 * for showing the user *which* token is stored without revealing it.
 */
export function maskSecret(value: string): string {
  if (value.length <= 8) return '••••••••';
  const head = value.slice(0, 4);
  const tail = value.slice(-4);
  return `${head}••••••${tail}`;
}
