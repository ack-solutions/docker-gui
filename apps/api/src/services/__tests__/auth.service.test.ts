import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { AuthService } from '../auth.service.js';
import { hashPassword } from '../../lib/password.js';
import { generateRefreshToken } from '../../lib/jwt.js';
import { UnauthorizedError } from '../../lib/errors.js';

const jwtConfig = {
  secret: 'test-secret-long-enough-for-tests-1234567890',
  accessTtlSeconds: 900,
  refreshTtlSeconds: 604800,
};

function mockDb() {
  return {
    user: { findUnique: vi.fn() },
    refreshToken: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  };
}

describe('AuthService.login', () => {
  let db: ReturnType<typeof mockDb>;
  let svc: AuthService;

  beforeEach(() => {
    db = mockDb();
    svc = new AuthService(db as unknown as PrismaClient, jwtConfig);
  });

  it('issues tokens for a valid login', async () => {
    const passwordHash = await hashPassword('correct');
    db.user.findUnique.mockResolvedValue({
      id: 'u-1',
      email: 'a@b.co',
      passwordHash,
      name: 'A',
      role: 'admin',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    db.refreshToken.create.mockResolvedValue({});

    const r = await svc.login({ email: 'A@B.co', password: 'correct' });
    expect(r.user.email).toBe('a@b.co');
    expect((r.user as { passwordHash?: string }).passwordHash).toBeUndefined();
    expect(r.accessToken).toBeDefined();
    expect(r.refreshToken.length).toBeGreaterThan(40);
    expect(db.refreshToken.create).toHaveBeenCalledOnce();
  });

  it('rejects unknown email', async () => {
    db.user.findUnique.mockResolvedValue(null);
    await expect(svc.login({ email: 'no@one.co', password: 'whatever' })).rejects.toThrow(
      UnauthorizedError,
    );
  });

  it('rejects wrong password', async () => {
    const passwordHash = await hashPassword('right');
    db.user.findUnique.mockResolvedValue({
      id: 'u-1',
      email: 'a@b.co',
      passwordHash,
      name: 'A',
      role: 'admin',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await expect(svc.login({ email: 'a@b.co', password: 'wrong' })).rejects.toThrow(
      UnauthorizedError,
    );
  });

  it('rejects inactive users', async () => {
    const passwordHash = await hashPassword('right');
    db.user.findUnique.mockResolvedValue({
      id: 'u-1',
      email: 'a@b.co',
      passwordHash,
      name: 'A',
      role: 'admin',
      isActive: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await expect(svc.login({ email: 'a@b.co', password: 'right' })).rejects.toThrow(
      UnauthorizedError,
    );
  });
});

describe('AuthService.refresh', () => {
  let db: ReturnType<typeof mockDb>;
  let svc: AuthService;

  beforeEach(() => {
    db = mockDb();
    svc = new AuthService(db as unknown as PrismaClient, jwtConfig);
  });

  it('rotates a valid refresh token', async () => {
    const t = generateRefreshToken();
    const future = new Date(Date.now() + 60_000);
    db.refreshToken.findUnique.mockResolvedValue({
      id: 'rt-1',
      tokenHash: t.hash,
      expiresAt: future,
      revokedAt: null,
      user: {
        id: 'u-1',
        email: 'a@b.co',
        passwordHash: 'x',
        name: 'A',
        role: 'admin',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    db.refreshToken.update.mockResolvedValue({});
    db.refreshToken.create.mockResolvedValue({});

    const r = await svc.refresh(t.token);
    expect(r.accessToken).toBeDefined();
    expect(r.refreshToken).not.toBe(t.token);
    expect(db.refreshToken.update).toHaveBeenCalledWith({
      where: { id: 'rt-1' },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('rejects unknown refresh token', async () => {
    db.refreshToken.findUnique.mockResolvedValue(null);
    await expect(svc.refresh('bogus')).rejects.toThrow(UnauthorizedError);
  });

  it('rejects revoked refresh token', async () => {
    const t = generateRefreshToken();
    db.refreshToken.findUnique.mockResolvedValue({
      id: 'rt-1',
      tokenHash: t.hash,
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: new Date(),
      user: { isActive: true, id: 'u', email: 'a@b.co', role: 'admin' },
    });
    await expect(svc.refresh(t.token)).rejects.toThrow(UnauthorizedError);
  });

  it('rejects expired refresh token', async () => {
    const t = generateRefreshToken();
    db.refreshToken.findUnique.mockResolvedValue({
      id: 'rt-1',
      tokenHash: t.hash,
      expiresAt: new Date(Date.now() - 1000),
      revokedAt: null,
      user: { isActive: true, id: 'u', email: 'a@b.co', role: 'admin' },
    });
    await expect(svc.refresh(t.token)).rejects.toThrow(UnauthorizedError);
  });

  it('rejects refresh for inactive users', async () => {
    const t = generateRefreshToken();
    db.refreshToken.findUnique.mockResolvedValue({
      id: 'rt-1',
      tokenHash: t.hash,
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      user: { isActive: false, id: 'u', email: 'a@b.co', role: 'admin' },
    });
    await expect(svc.refresh(t.token)).rejects.toThrow(UnauthorizedError);
  });
});

describe('AuthService.logout', () => {
  it('revokes the refresh token', async () => {
    const db = mockDb();
    const svc = new AuthService(db as unknown as PrismaClient, jwtConfig);
    db.refreshToken.updateMany.mockResolvedValue({ count: 1 });
    await svc.logout('some-token');
    expect(db.refreshToken.updateMany).toHaveBeenCalled();
  });
});
