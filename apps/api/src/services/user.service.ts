import type { PrismaClient, User } from '@prisma/client';
import { hashPassword } from '../lib/password.js';
import { AppError, ValidationError } from '../lib/errors.js';

export type SafeUser = Omit<User, 'passwordHash'>;

const VALID_ROLES = ['owner', 'admin', 'operator', 'viewer'] as const;
export type UserRole = (typeof VALID_ROLES)[number];

export interface CreateUserInput {
  email: string;
  password: string;
  name: string;
  role?: UserRole;
}

export class UserService {
  constructor(private readonly db: PrismaClient) {}

  async create(input: CreateUserInput): Promise<SafeUser> {
    const email = input.email.trim().toLowerCase();
    if (!isValidEmail(email)) throw new ValidationError('Invalid email address');
    if (input.password.length < 8) throw new ValidationError('Password must be at least 8 characters');
    if (input.name.trim().length === 0) throw new ValidationError('Name is required');
    const role: UserRole = input.role ?? 'admin';
    if (!VALID_ROLES.includes(role)) throw new ValidationError(`Invalid role: ${role}`);

    const existing = await this.db.user.findUnique({ where: { email } });
    if (existing) throw new AppError('user.email_taken', 'Email is already registered', 409);

    const passwordHash = await hashPassword(input.password);
    const created = await this.db.user.create({
      data: { email, passwordHash, name: input.name.trim(), role },
    });
    return stripPassword(created);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.db.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  }

  async findById(id: string): Promise<SafeUser | null> {
    const user = await this.db.user.findUnique({ where: { id } });
    return user ? stripPassword(user) : null;
  }

  async countAll(): Promise<number> {
    return this.db.user.count();
  }
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function stripPassword(user: User): SafeUser {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, ...safe } = user;
  return safe;
}
