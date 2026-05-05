#!/usr/bin/env node
/**
 * Reset an existing user's password.
 *
 * Usage:
 *   docker-gui admin reset <email> <new-password>
 */

import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/password.js';

async function main() {
  const [email, newPassword] = process.argv.slice(2);
  if (!email || !newPassword) {
    console.error('Usage: admin-reset <email> <new-password>');
    process.exit(1);
  }
  if (newPassword.length < 8) {
    console.error('Password must be at least 8 characters');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (!user) {
      console.error(`No user with email: ${email}`);
      process.exit(1);
    }
    const passwordHash = await hashPassword(newPassword);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    // Revoke all sessions
    await prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    console.log(`Password reset for ${user.email}. All active sessions revoked.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
