import type { PrismaClient, User } from '@prisma/client';
import { hashPassword } from '../lib/password.js';
import { AppError, NotFoundError, ValidationError } from '../lib/errors.js';

export type SafeUser = Omit<User, 'passwordHash'>;

const VALID_ROLES = ['owner', 'admin', 'operator', 'viewer'] as const;
export type UserRole = (typeof VALID_ROLES)[number];

/** Privilege rank — higher can manage strictly-lower; only owner manages owner. */
const ROLE_RANK: Record<UserRole, number> = { owner: 3, admin: 2, operator: 1, viewer: 0 };

export function isValidRole(role: string): role is UserRole {
  return (VALID_ROLES as readonly string[]).includes(role);
}

/** Who is performing an action — drives authorization decisions in the service. */
export interface ActorContext {
  id: string;
  role: UserRole;
}

export interface CreateUserInput {
  email: string;
  password: string;
  name: string;
  role?: UserRole;
}

export interface UpdateUserInput {
  name?: string;
  role?: UserRole;
  isActive?: boolean;
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

  /**
   * Create a user on behalf of an actor, enforcing privilege rules:
   *  - only an owner may mint another owner
   *  - an admin may create admin/operator/viewer but never owner
   */
  async createAsActor(input: CreateUserInput, actor: ActorContext): Promise<SafeUser> {
    const role: UserRole = input.role ?? 'operator';
    if (!isValidRole(role)) throw new ValidationError(`Invalid role: ${role}`);
    if (role === 'owner' && actor.role !== 'owner') {
      throw new AppError('user.forbidden_role', 'Only an owner can create another owner', 403);
    }
    return this.create({ ...input, role });
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

  async list(): Promise<SafeUser[]> {
    const users = await this.db.user.findMany({ orderBy: [{ role: 'asc' }, { createdAt: 'asc' }] });
    return users.map(stripPassword);
  }

  /** Number of owners who can currently sign in. */
  async countActiveOwners(): Promise<number> {
    return this.db.user.count({ where: { role: 'owner', isActive: true } });
  }

  /**
   * Update a user's name / role / active flag with full authorization +
   * last-owner protection. Returns the updated safe user. The caller is
   * responsible for revoking sessions when role changes or the account is
   * deactivated (see users.routes).
   */
  async update(id: string, changes: UpdateUserInput, actor: ActorContext): Promise<SafeUser> {
    const target = await this.db.user.findUnique({ where: { id } });
    if (!target) throw new NotFoundError('User not found');
    const targetRole = target.role as UserRole;

    // Admins cannot touch owner accounts at all.
    if (targetRole === 'owner' && actor.role !== 'owner') {
      throw new AppError('user.forbidden', 'Only an owner can modify an owner account', 403);
    }

    const data: { name?: string; role?: UserRole; isActive?: boolean } = {};

    if (changes.name !== undefined) {
      if (changes.name.trim().length === 0) throw new ValidationError('Name cannot be empty');
      data.name = changes.name.trim();
    }

    if (changes.role !== undefined && changes.role !== targetRole) {
      if (!isValidRole(changes.role)) throw new ValidationError(`Invalid role: ${changes.role}`);
      // Only an owner may grant the owner role.
      if (changes.role === 'owner' && actor.role !== 'owner') {
        throw new AppError('user.forbidden_role', 'Only an owner can grant the owner role', 403);
      }
      // An actor cannot grant a role higher than their own.
      if (ROLE_RANK[changes.role] > ROLE_RANK[actor.role]) {
        throw new AppError('user.forbidden_role', 'You cannot grant a role above your own', 403);
      }
      data.role = changes.role;
    }

    if (changes.isActive !== undefined) {
      data.isActive = changes.isActive;
    }

    if (Object.keys(data).length === 0) {
      // Nothing to change — return current state rather than a no-op write.
      return stripPassword(target);
    }

    // Last-owner protection. This must be atomic with the write: a plain
    // check-then-update is a TOCTOU race — two concurrent demotions/
    // deactivations could each see "2 active owners", both pass, and both
    // commit, leaving ZERO owners (permanent lockout). We instead apply the
    // change inside a transaction and re-assert the invariant AFTER the write;
    // if it would drop the active-owner count below 1 we throw, rolling back.
    const losesActiveOwner =
      targetRole === 'owner' &&
      target.isActive &&
      ((data.role !== undefined && data.role !== 'owner') || data.isActive === false);

    if (losesActiveOwner) {
      const updated = await this.db.$transaction(async (tx) => {
        const row = await tx.user.update({ where: { id }, data });
        const remaining = await tx.user.count({ where: { role: 'owner', isActive: true } });
        if (remaining < 1) {
          throw new AppError(
            'user.last_owner',
            'Cannot demote or deactivate the last active owner',
            409,
          );
        }
        return row;
      });
      return stripPassword(updated);
    }

    const updated = await this.db.user.update({ where: { id }, data });
    return stripPassword(updated);
  }

  /** Delete a user with self-deletion + last-owner + privilege guards. */
  async delete(id: string, actor: ActorContext): Promise<void> {
    if (id === actor.id) {
      throw new AppError('user.self_delete', 'You cannot delete your own account', 400);
    }
    const target = await this.db.user.findUnique({ where: { id } });
    if (!target) throw new NotFoundError('User not found');
    const targetRole = target.role as UserRole;

    if (targetRole === 'owner' && actor.role !== 'owner') {
      throw new AppError('user.forbidden', 'Only an owner can delete an owner account', 403);
    }

    if (targetRole === 'owner' && target.isActive) {
      // Same atomic act-then-check as update() to defeat the TOCTOU race.
      // Refresh tokens cascade-delete via the schema relation.
      await this.db.$transaction(async (tx) => {
        await tx.user.delete({ where: { id } });
        const remaining = await tx.user.count({ where: { role: 'owner', isActive: true } });
        if (remaining < 1) {
          throw new AppError('user.last_owner', 'Cannot delete the last active owner', 409);
        }
      });
      return;
    }

    await this.db.user.delete({ where: { id } });
  }

  /**
   * Set a user's password (admin reset). Authorization (who may reset whom) is
   * enforced by the caller; this method only validates + writes.
   */
  async setPassword(id: string, newPassword: string): Promise<void> {
    if (newPassword.length < 8) throw new ValidationError('Password must be at least 8 characters');
    const target = await this.db.user.findUnique({ where: { id } });
    if (!target) throw new NotFoundError('User not found');
    const passwordHash = await hashPassword(newPassword);
    await this.db.user.update({ where: { id }, data: { passwordHash } });
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
