import { PrismaClient } from "@prisma/client";

type GlobalPrisma = typeof globalThis & { __prisma?: PrismaClient };

const globalForPrisma = globalThis as GlobalPrisma;

const databaseUrl = process.env.DATABASE_URL.trim()


const prisma = globalForPrisma.__prisma ?? new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl
    }
  }
});

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__prisma = prisma;
}

export { prisma };
