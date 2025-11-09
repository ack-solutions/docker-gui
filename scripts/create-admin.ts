import "tsconfig-paths/register";
import "dotenv/config";

import bcrypt from "bcryptjs";
import process from "node:process";
import { config } from "@/server/config";
import UserRepository from "@/server/user/user-repository";
import { rolePermissions } from "@/types/user";

const [, , emailArg, nameArg, passwordArg] = process.argv;

const exitWith = (message: string, code = 1) => {
  console.error(message);
  process.exit(code);
};

if (!emailArg || !nameArg || !passwordArg) {
  exitWith("Usage: tsx scripts/create-admin.ts <email> <name> <password>");
}

const normalizeEmail = (value: string) => value.trim().toLowerCase();

const isValidEmail = (value: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);

(async () => {
  const email = normalizeEmail(emailArg);
  const name = nameArg.trim();
  const password = passwordArg.trim();

  if (!isValidEmail(email)) {
    exitWith(`Invalid email address: ${email}`);
  }

  if (password.length < 8) {
    exitWith("Password must be at least 8 characters long.");
  }

  const repository = new UserRepository();
  const existing = await repository.findByEmail(email);

  if (existing) {
    exitWith(`User with email ${email} already exists.`, 0);
  }

  const rounds = config.security?.bcryptRounds ?? 10;
  const passwordHash = bcrypt.hashSync(password, rounds);

  await repository.create({
    email,
    passwordHash,
    name,
    role: "admin",
    permissions: rolePermissions.admin,
    isSuperAdmin: true
  });

  console.log(`Administrator ${email} created successfully.`);
  process.exit(0);
})().catch((error) => {
  console.error("Failed to create administrator:", error);
  process.exit(1);
});
