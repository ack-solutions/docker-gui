#!/usr/bin/env node
/**
 * List all users.
 *
 * Usage:
 *   docker-gui admin list
 */

import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
    });
    if (users.length === 0) {
      console.log('No users.');
      return;
    }
    console.log(
      'EMAIL'.padEnd(36) +
        'NAME'.padEnd(24) +
        'ROLE'.padEnd(12) +
        'ACTIVE'.padEnd(8) +
        'CREATED',
    );
    for (const u of users) {
      console.log(
        u.email.padEnd(36) +
          (u.name ?? '').padEnd(24) +
          u.role.padEnd(12) +
          (u.isActive ? 'yes' : 'no').padEnd(8) +
          u.createdAt.toISOString(),
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
