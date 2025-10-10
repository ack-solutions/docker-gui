import "reflect-metadata";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { AppDataSource } from "./data-source";
import { UserEntity } from "../user/user.entity";
import { rolePermissions } from "@/types/user";

const generatePassword = () => {
  let candidate = "";
  while (candidate.length < 12) {
    candidate += randomBytes(24)
      .toString("base64")
      .replace(/[^a-zA-Z0-9]/g, "");
  }
  return candidate.slice(0, 18);
};

const seedSuperAdmin = async () => {
  const dataSource = await AppDataSource.initialize();

  try {
    const repository = dataSource.getRepository(UserEntity);
    const existingSuperAdmin = await repository.findOne({ where: { isSuperAdmin: true } });

    if (existingSuperAdmin) {
      console.info("[seed] Super administrator already present. Skipping seed.");
      return;
    }

    const email = (process.env.DEFAULT_ADMIN_EMAIL ?? "admin@example.com").trim().toLowerCase();
    const name = process.env.DEFAULT_ADMIN_NAME ?? "Super Administrator";
    let password = process.env.DEFAULT_ADMIN_PASSWORD?.trim();

    if (!password || password.length < 8) {
      password = generatePassword();
      console.warn("[seed] DEFAULT_ADMIN_PASSWORD not provided; generated temporary password. Update it after sign-in.");
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

    console.info(`[seed] Super administrator created (${email}).`);
    if (!process.env.DEFAULT_ADMIN_PASSWORD || process.env.DEFAULT_ADMIN_PASSWORD.trim().length < 8) {
      console.info(`[seed] Temporary administrator password: ${password}`);
    }
  } finally {
    await dataSource.destroy();
  }
};

seedSuperAdmin()
  .then(() => {
    console.info("[seed] Seed completed.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("[seed] Seed failed.", error);
    process.exit(1);
  });
