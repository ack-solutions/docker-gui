import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import UserRepository from "@/server/user/user-repository";
import { rolePermissions } from "@/types/user";
import type { User, UserPermission, UserRecord, UserRole } from "@/types/user";

interface AuthCredentials {
  email: string;
  password: string;
  name?: string;
}

interface AuthTokenPayload extends jwt.JwtPayload {
  sub: string;
  email: string;
}

interface AuthResult {
  user: User;
  token: string;
}

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
    this.jwtSecret = options.jwtSecret ?? process.env.JWT_SECRET ?? process.env.AUTH_SECRET ?? "development-secret";
    this.tokenExpiresIn = options.tokenExpiresIn ?? process.env.JWT_EXPIRES_IN ?? "12h";
    this.saltRounds = options.saltRounds ?? Number.parseInt(process.env.BCRYPT_SALT_ROUNDS ?? "10", 10);
  }

  register(credentials: AuthCredentials): AuthResult {
    const email = credentials.email.trim().toLowerCase();
    if (!email || !credentials.password) {
      throw new AuthError("Email and password are required.");
    }

    if (this.repository.count() > 0) {
      throw new AuthError("Registration is disabled. Ask an administrator to provision your account.", 403);
    }

    const existing = this.repository.findByEmail(email);
    if (existing) {
      throw new AuthError("Email is already registered.", 409);
    }

    const passwordHash = bcrypt.hashSync(credentials.password, this.saltRounds);
    const role: UserRole = "admin";
    const permissions: UserPermission[] = rolePermissions[role] ?? [];
    const record = this.repository.create({
      email,
      passwordHash,
      name: credentials.name ?? null,
      role,
      permissions
    });

    return {
      user: this.toUser(record),
      token: this.createToken(record)
    } satisfies AuthResult;
  }

  login(credentials: AuthCredentials): AuthResult {
    const email = credentials.email.trim().toLowerCase();
    const record = this.repository.findByEmail(email);

    if (!record || !bcrypt.compareSync(credentials.password, record.passwordHash)) {
      throw new AuthError("Invalid email or password.", 401);
    }

    return {
      user: this.toUser(record),
      token: this.createToken(record)
    } satisfies AuthResult;
  }

  verify(token: string): User {
    try {
      const payload = jwt.verify(token, this.jwtSecret) as AuthTokenPayload;
      const record = this.repository.findById(payload.sub);

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
      createdAt: record.createdAt
    } satisfies User;
  }
}

const authService = new AuthService();

export { AuthError, AuthService, authService };
