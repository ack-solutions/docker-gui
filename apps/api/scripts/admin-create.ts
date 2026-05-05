#!/usr/bin/env node
/**
 * Create a new admin user.
 *
 * Usage:
 *   docker compose exec api npx tsx scripts/admin-create.ts <email> <name> <password>
 *
 * Or via the CLI wrapper:
 *   docker-gui admin create <email> <name> <password>
 *
 * Bypasses the setup-secret guard — intended for ops use after install.
 */

import { PrismaClient } from '@prisma/client';
import { UserService } from '../src/services/user.service.js';

async function main() {
  const [email, name, password] = process.argv.slice(2);
  if (!email || !name || !password) {
    console.error('Usage: admin-create <email> <name> <password>');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const users = new UserService(prisma);
    const user = await users.create({ email, name, password, role: 'owner' });
    console.log(`Created ${user.role}: ${user.email} (id ${user.id})`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
