import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../password.js';

describe('password', () => {
  it('hashes and verifies a password', async () => {
    const hash = await hashPassword('CorrectHorseBatteryStaple');
    expect(hash.startsWith('scrypt:')).toBe(true);
    expect(await verifyPassword('CorrectHorseBatteryStaple', hash)).toBe(true);
  });

  it('rejects wrong password', async () => {
    const hash = await hashPassword('right-pw');
    expect(await verifyPassword('wrong-pw', hash)).toBe(false);
  });

  it('produces different hashes for same password (random salt)', async () => {
    const a = await hashPassword('same');
    const b = await hashPassword('same');
    expect(a).not.toBe(b);
    expect(await verifyPassword('same', a)).toBe(true);
    expect(await verifyPassword('same', b)).toBe(true);
  });

  it('rejects empty password on hash', async () => {
    await expect(hashPassword('')).rejects.toThrow();
  });

  it('returns false on malformed stored hash', async () => {
    expect(await verifyPassword('x', 'not-a-real-hash')).toBe(false);
    expect(await verifyPassword('x', 'scrypt:salt')).toBe(false);
    expect(await verifyPassword('x', 'bcrypt:salt:key')).toBe(false);
  });

  it('returns false when stored hash has bad hex', async () => {
    expect(await verifyPassword('x', 'scrypt:zzz:nothex')).toBe(false);
  });

  it('returns false on type mismatch', async () => {
    // @ts-expect-error -- testing runtime guard
    expect(await verifyPassword(undefined, 'scrypt:a:b')).toBe(false);
    // @ts-expect-error -- testing runtime guard
    expect(await verifyPassword('x', null)).toBe(false);
  });
});
