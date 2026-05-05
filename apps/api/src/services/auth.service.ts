import type { PrismaClient } from '@prisma/client';
import { verifyPassword } from '../lib/password.js';
import {
  signAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  buildRefreshExpiry,
  type JwtConfig,
} from '../lib/jwt.js';
import { AppError, UnauthorizedError } from '../lib/errors.js';
import { stripPassword, type SafeUser } from './user.service.js';

export interface LoginInput {
  email: string;
  password: string;
}

export interface LoginResult {
  user: SafeUser;
  accessToken: string;
  accessExpiresAt: Date;
  refreshToken: string;
  refreshExpiresAt: Date;
}

export class AuthService {
  constructor(
    private readonly db: PrismaClient,
    private readonly jwtConfig: JwtConfig,
  ) {}

  async login(input: LoginInput): Promise<LoginResult> {
    const email = input.email.trim().toLowerCase();
    const user = await this.db.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      // Same error message either way to avoid leaking which emails exist
      throw new UnauthorizedError('Invalid email or password');
    }
    const ok = await verifyPassword(input.password, user.passwordHash);
    if (!ok) throw new UnauthorizedError('Invalid email or password');

    return this.issueTokens(user.id, user.email, user.role).then((tokens) => ({
      user: stripPassword(user),
      ...tokens,
    }));
  }

  async refresh(refreshToken: string): Promise<LoginResult> {
    const tokenHash = hashRefreshToken(refreshToken);
    const stored = await this.db.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedError('Refresh token is invalid or expired');
    }
    if (!stored.user.isActive) {
      throw new UnauthorizedError('User is no longer active');
    }

    // Rotate: revoke the used refresh token, issue a fresh pair
    await this.db.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const tokens = await this.issueTokens(stored.user.id, stored.user.email, stored.user.role);
    return { user: stripPassword(stored.user), ...tokens };
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = hashRefreshToken(refreshToken);
    await this.db.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.db.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issueTokens(
    userId: string,
    email: string,
    role: string,
  ): Promise<{
    accessToken: string;
    accessExpiresAt: Date;
    refreshToken: string;
    refreshExpiresAt: Date;
  }> {
    const access = signAccessToken({ sub: userId, email, role }, this.jwtConfig);
    const refresh = generateRefreshToken();
    const refreshExpiresAt = buildRefreshExpiry(this.jwtConfig.refreshTtlSeconds);

    await this.db.refreshToken.create({
      data: {
        userId,
        tokenHash: refresh.hash,
        expiresAt: refreshExpiresAt,
      },
    });

    return {
      accessToken: access.token,
      accessExpiresAt: access.expiresAt,
      refreshToken: refresh.token,
      refreshExpiresAt,
    };
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}
