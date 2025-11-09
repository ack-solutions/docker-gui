import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import UserRepository from "@/server/user/user-repository";
import type { User, UserRecord } from "@/types/user";
import { config } from "@/server/config";

interface AuthCredentials {
  email: string;
  password: string;
}

interface AuthTokenPayload extends jwt.JwtPayload {
  sub: string;
  email: string;
}

interface AuthResult {
  user: User;
  token: string;
}

export const AUTH_COOKIE_NAME = "auth_token";

class AuthError extends Error {
  constructor(message: string, readonly statusCode = 400) {
    super(message);
    this.name = "AuthError";
  }
}

class AuthService {
  private readonly jwtSecret: string;
  private readonly tokenExpiresIn: string;
  private readonly saltRounds: number;

  constructor(
    private readonly repository = new UserRepository(),
    options: { jwtSecret?: string; tokenExpiresIn?: string; saltRounds?: number } = {}
  ) {
    this.jwtSecret = options.jwtSecret ?? config.security.jwtSecret;
    this.tokenExpiresIn = options.tokenExpiresIn ?? config.security.jwtExpiresIn;
    this.saltRounds = options.saltRounds ?? config.security.bcryptRounds;
  }

  async login(credentials: AuthCredentials): Promise<AuthResult> {
    const email = credentials.email.trim().toLowerCase();
    const record = await this.repository.findByEmail(email);

    if (!record || !bcrypt.compareSync(credentials.password, record.passwordHash)) {
      throw new AuthError("Invalid email or password.", 401);
    }

    return {
      user: this.toUser(record),
      token: this.createToken(record)
    };
  }

  async verify(token: string): Promise<User> {
    try {
      const payload = jwt.verify(token, this.jwtSecret) as AuthTokenPayload;
      const record = await this.repository.findById(payload.sub);

      if (!record) {
        throw new AuthError("User not found.", 404);
      }

      return this.toUser(record);
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }

      throw new AuthError("Invalid authentication token.", 401);
    }
  }

  private createToken(record: UserRecord) {
    return jwt.sign(
      {
        sub: record.id,
        email: record.email,
        role: record.role
      },
      this.jwtSecret,
      { expiresIn: this.tokenExpiresIn }
    );
  }

  private toUser(record: UserRecord): User {
    return {
      id: record.id,
      email: record.email,
      name: record.name,
      role: record.role,
      permissions: record.permissions,
      isSuperAdmin: record.isSuperAdmin,
      createdAt: record.createdAt
    };
  }
}

const authService = new AuthService();

export { AuthError, AuthService, authService };
