import { randomBytes } from "node:crypto";
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
  private readonly bootstrapReady: Promise<void>;

  constructor(
    private readonly repository = new UserRepository(),
    options: { jwtSecret?: string; tokenExpiresIn?: string; saltRounds?: number } = {}
  ) {
    this.jwtSecret = options.jwtSecret ?? process.env.JWT_SECRET ?? process.env.AUTH_SECRET ?? "development-secret";
    this.tokenExpiresIn = options.tokenExpiresIn ?? process.env.JWT_EXPIRES_IN ?? "12h";
    this.saltRounds = options.saltRounds ?? Number.parseInt(process.env.BCRYPT_SALT_ROUNDS ?? "10", 10);
    this.bootstrapReady = this.bootstrapDefaultAdmin();
  }

  private async bootstrapDefaultAdmin(): Promise<void> {
    try {
      const existingUsers = await this.repository.all();
      const existingSuperAdmin = existingUsers.find((user) => user.isSuperAdmin);
      if (existingSuperAdmin) {
        return;
      }

      if (existingUsers.length > 0) {
        const promoted = existingUsers.find((user) => user.role === "admin") ?? existingUsers[0];
        await this.repository.update(promoted.id, {
          role: "admin",
          permissions: rolePermissions.admin,
          isSuperAdmin: true
        });
        console.warn(
          `[auth] Promoted existing account (${promoted.email}) to super administrator because none was configured.`
        );
        return;
      }

      const email = (process.env.DEFAULT_ADMIN_EMAIL ?? "admin@example.com").trim().toLowerCase();
      const name = process.env.DEFAULT_ADMIN_NAME ?? "Super Administrator";
      let password = process.env.DEFAULT_ADMIN_PASSWORD?.trim();

      if (!password || password.length < 8) {
        let candidate = "";
        while (candidate.length < 12) {
          candidate += randomBytes(24)
            .toString("base64")
            .replace(/[^a-zA-Z0-9]/g, "");
        }
        password = candidate.slice(0, 18);
        console.warn(
          `[auth] DEFAULT_ADMIN_PASSWORD not provided; generated temporary password for ${email}. Update the environment variables immediately.`
        );
        console.warn(`[auth] Temporary administrator password: ${password}`);
      }

      const passwordHash = bcrypt.hashSync(password, this.saltRounds);
      await this.repository.create({
        email,
        passwordHash,
        name,
        role: "admin",
        permissions: rolePermissions.admin,
        isSuperAdmin: true
      });

      console.info(`[auth] Bootstrapped default administrator account (${email}).`);
    } catch (error) {
      console.error("Failed to bootstrap default administrator", error);
    }
  }

  async register(credentials: AuthCredentials): Promise<AuthResult> {
    await this.bootstrapReady;

    const email = credentials.email.trim().toLowerCase();
    if (!email || !credentials.password) {
      throw new AuthError("Email and password are required.");
    }

    if ((await this.repository.count()) > 0) {
      throw new AuthError("Registration is disabled. Ask an administrator to provision your account.", 403);
    }

    const existing = await this.repository.findByEmail(email);
    if (existing) {
      throw new AuthError("Email is already registered.", 409);
    }

    const passwordHash = bcrypt.hashSync(credentials.password, this.saltRounds);
    const role: UserRole = "admin";
    const permissions: UserPermission[] = rolePermissions[role] ?? [];
    const record = await this.repository.create({
      email,
      passwordHash,
      name: credentials.name ?? null,
      role,
      permissions,
      isSuperAdmin: true
    });

    return {
      user: this.toUser(record),
      token: this.createToken(record)
    };
  }

  async login(credentials: AuthCredentials): Promise<AuthResult> {
    await this.bootstrapReady;

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
    await this.bootstrapReady;

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
