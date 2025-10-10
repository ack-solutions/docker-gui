import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import type { DataSource, Repository } from "typeorm";
import { UserEntity } from "@/server/user/user.entity";
import { rolePermissions } from "@/types/user";
import { BaseSeed } from "./base/base-seed";

const DUMMY_USERS = [
  {
    email: "ops@example.com",
    name: "Operations Team",
    role: "admin" as const
  },
  {
    email: "developer@example.com",
    name: "Dev User",
    role: "developer" as const
  },
  {
    email: "viewer@example.com",
    name: "Read-Only",
    role: "viewer" as const
  }
];

const DUMMY_PASSWORD = "Password!23";

export class UserSeed extends BaseSeed {

  /**
   * Check if the seed has already been applied to the database
   * @returns true if seeded, false otherwise
   */
  async isSeeded(): Promise<boolean> {
    const repository = this.dataSource.getRepository(UserEntity);
    const includeDummy = this.shouldIncludeDummy();
    
    // Check if super admin exists
    const existingSuperAdmin = await repository.findOne({ where: { isSuperAdmin: true } });
    
    if (!includeDummy) {
      return Boolean(existingSuperAdmin);
    }

    // If including dummy data, check if dummy users also exist
    const dummyCount = await repository.count({ 
      where: DUMMY_USERS.map((user) => ({ email: user.email })) 
    });
    
    return Boolean(existingSuperAdmin) && dummyCount >= DUMMY_USERS.length;
  }

  /**
   * Apply the seed - create users in the database
   */
  async up(): Promise<void> {
    const repository = this.dataSource.getRepository(UserEntity);

    // 1. Create super administrator
    await this.createSuperAdmin();

    // 2. Optionally create dummy users for development/testing
    if (this.shouldIncludeDummy()) {
      await this.createDummyUsers();
    }
  }

  /**
   * Revert the seed - remove users from the database
   */
  async down(): Promise<void> {
    const repository = this.dataSource.getRepository(UserEntity);

    // 1. Remove super administrator
    await repository.delete({ isSuperAdmin: true });
    console.info("[seed:UserSeed] Removed super administrator.");

    // 2. Remove dummy users if they were seeded
    if (this.shouldIncludeDummy()) {
      await this.dataSource.getRepository(UserEntity).delete(DUMMY_USERS.map((user) => ({ email: user.email })));
      console.info("[seed:UserSeed] Removed dummy users.");
    }
  }

  /**
   * Create the super administrator account
   */
  private async createSuperAdmin(): Promise<void> {
    const repository = this.dataSource.getRepository(UserEntity);
    const existingSuperAdmin = await repository.findOne({ where: { isSuperAdmin: true } });

    if (existingSuperAdmin) {
      console.info("[seed:UserSeed] Super administrator already exists.");
      return;
    }

    const email = (process.env.DEFAULT_ADMIN_EMAIL ?? "admin@example.com").trim().toLowerCase();
    const name = process.env.DEFAULT_ADMIN_NAME ?? "Super Administrator";
    let password = process.env.DEFAULT_ADMIN_PASSWORD?.trim();

    if (!password || password.length < 8) {
      password = this.generatePassword();
      console.warn("[seed:UserSeed] DEFAULT_ADMIN_PASSWORD missing or too short. Generated temporary password.");
      console.warn(`[seed:UserSeed] Temporary administrator password: ${password}`);
    }

    const saltRounds = Number.parseInt(process.env.BCRYPT_SALT_ROUNDS ?? "10", 10);
    const passwordHash = bcrypt.hashSync(password, saltRounds);

    const superAdmin = repository.create({
      email,
      name,
      passwordHash,
      role: "admin",
      permissions: rolePermissions.admin,
      isSuperAdmin: true
    });

    await repository.save(superAdmin);

    console.info(`[seed:UserSeed] ✓ Super administrator created (${email}).`);
  }

  /**
   * Create dummy users for development/testing
   */
  private async createDummyUsers(): Promise<void> {
    const repository = this.dataSource.getRepository(UserEntity);
    const saltRounds = Number.parseInt(process.env.BCRYPT_SALT_ROUNDS ?? "10", 10);
    const passwordHash = bcrypt.hashSync(DUMMY_PASSWORD, saltRounds);

    for (const dummy of DUMMY_USERS) {
    
      const existing = await repository.findOne({ where: { email: dummy.email } });
      if (existing) {
        continue;
      }

      const entity = repository.create({
        ...dummy,
        passwordHash,
        permissions: rolePermissions[dummy.role] ?? [],
        isSuperAdmin: false
      } as UserEntity);

      await repository.save(entity);
    }


    console.info(`[seed:UserSeed] ✓ Dummy users created (password: ${DUMMY_PASSWORD}).`);
  }

  /**
   * Generate a random secure password
   */
  private generatePassword(): string {
    let candidate = "";
    while (candidate.length < 12) {
      candidate += randomBytes(24)
        .toString("base64")
        .replace(/[^a-zA-Z0-9]/g, "");
    }
    return candidate.slice(0, 18);
  }
}

