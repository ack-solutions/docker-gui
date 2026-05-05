import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { UserService } from '../user.service.js';
import { AppError, ValidationError } from '../../lib/errors.js';

interface MockDb {
  user: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
}

function mockPrisma(): { db: MockDb; client: PrismaClient } {
  const db: MockDb = {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
  };
  return { db, client: db as unknown as PrismaClient };
}

describe('UserService.create', () => {
  let m: ReturnType<typeof mockPrisma>;
  let svc: UserService;

  beforeEach(() => {
    m = mockPrisma();
    svc = new UserService(m.client);
  });

  it('creates a user with hashed password', async () => {
    m.db.user.findUnique.mockResolvedValue(null);
    m.db.user.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'u-1',
      email: data['email'],
      passwordHash: data['passwordHash'],
      name: data['name'],
      role: data['role'],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    const user = await svc.create({
      email: 'Admin@Example.COM',
      password: 'goodpassword',
      name: 'Admin',
    });

    expect(user.email).toBe('admin@example.com'); // lowercased + trimmed
    expect(user.role).toBe('admin');
    expect((user as { passwordHash?: string }).passwordHash).toBeUndefined();

    const callArgs = m.db.user.create.mock.calls[0]?.[0] as { data: { passwordHash: string } };
    expect(callArgs.data.passwordHash.startsWith('scrypt:')).toBe(true);
  });

  it('rejects invalid email', async () => {
    await expect(svc.create({ email: 'no-at-sign', password: 'okayokay', name: 'X' })).rejects.toThrow(
      ValidationError,
    );
  });

  it('rejects short password', async () => {
    await expect(svc.create({ email: 'a@b.co', password: 'short', name: 'X' })).rejects.toThrow(
      ValidationError,
    );
  });

  it('rejects empty name', async () => {
    await expect(svc.create({ email: 'a@b.co', password: 'longenough', name: '   ' })).rejects.toThrow(
      ValidationError,
    );
  });

  it('rejects invalid role', async () => {
    await expect(
      svc.create({
        email: 'a@b.co',
        password: 'longenough',
        name: 'X',
        // @ts-expect-error -- testing runtime guard
        role: 'god',
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('rejects when email already taken', async () => {
    m.db.user.findUnique.mockResolvedValue({ id: 'existing' });
    await expect(
      svc.create({ email: 'a@b.co', password: 'longenough', name: 'X' }),
    ).rejects.toThrow(AppError);
  });
});

describe('UserService.findByEmail', () => {
  it('lowercases the email before lookup', async () => {
    const m = mockPrisma();
    m.db.user.findUnique.mockResolvedValue({ id: 'u' });
    const svc = new UserService(m.client);
    await svc.findByEmail('  Foo@Bar.com  ');
    expect(m.db.user.findUnique).toHaveBeenCalledWith({ where: { email: 'foo@bar.com' } });
  });
});

describe('UserService.countAll', () => {
  it('proxies to prisma count', async () => {
    const m = mockPrisma();
    m.db.user.count.mockResolvedValue(3);
    const svc = new UserService(m.client);
    expect(await svc.countAll()).toBe(3);
  });
});
