import { describe, it, expect } from 'vitest';
import { CryptoBox, maskSecret } from '../crypto-box.js';

const SECRET = 'a'.repeat(64);

describe('CryptoBox', () => {
  it('seals + opens round-trip', () => {
    const box = new CryptoBox(SECRET);
    const plain = 'super-secret-cf-token-123';
    const sealed = box.seal(plain);
    expect(sealed).not.toContain(plain);
    expect(box.open(sealed)).toBe(plain);
  });

  it('produces different ciphertext for the same plaintext (random IV)', () => {
    const box = new CryptoBox(SECRET);
    const a = box.seal('hello');
    const b = box.seal('hello');
    expect(a).not.toBe(b);
    expect(box.open(a)).toBe('hello');
    expect(box.open(b)).toBe('hello');
  });

  it('rejects ciphertext from a different master secret', () => {
    const a = new CryptoBox(SECRET);
    const b = new CryptoBox('z'.repeat(64));
    const sealed = a.seal('x');
    expect(() => b.open(sealed)).toThrow();
  });

  it('rejects truncated ciphertext', () => {
    const box = new CryptoBox(SECRET);
    expect(() => box.open('AAAA')).toThrow();
  });

  it('rejects tampered ciphertext (auth tag check)', () => {
    const box = new CryptoBox(SECRET);
    const sealed = box.seal('payload');
    // Flip a byte in the ciphertext portion
    const buf = Buffer.from(sealed, 'base64');
    const tampered = Buffer.from(buf);
    tampered[buf.length - 1] = tampered[buf.length - 1]! ^ 0xff;
    expect(() => box.open(tampered.toString('base64'))).toThrow();
  });

  it('refuses short master secrets', () => {
    expect(() => new CryptoBox('short')).toThrow(/at least 32/);
  });
});

describe('maskSecret', () => {
  it('masks long secrets keeping prefix + suffix', () => {
    expect(maskSecret('abcd1234567890wxyz')).toBe('abcd••••••wxyz');
  });

  it('fully masks short secrets', () => {
    expect(maskSecret('short')).toBe('••••••••');
  });
});
