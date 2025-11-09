import { initializeDefaultSettings } from "../src/server/system/settings-service";
import { prisma } from "../src/server/database/client";

const main = async () => {
  console.info("[seed] Ensuring default settings exist...");
  await initializeDefaultSettings();
  console.info("[seed] Default settings ready.");
};

main()
  .catch((error) => {
    console.error("[seed] Failed to run Prisma seed", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
