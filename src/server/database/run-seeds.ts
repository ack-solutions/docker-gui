import "reflect-metadata";
import { AppDataSource } from "./data-source";
import seeds from "./seeds";
import type { SeedOptions } from "./seeds/base/base-seed";

const args = process.argv.slice(2);
const hasFlag = (...flags: string[]) => flags.some((flag) => args.includes(flag));

const getFlagValue = (...flags: string[]): string | null => {
  for (const flag of flags) {
    const index = args.indexOf(flag);
    if (index !== -1 && args[index + 1]) {
      return args[index + 1];
    }
  }
  return null;
};

const getAction = () => {
  if (hasFlag("-r", "--reseed")) {
    return "reseed" as const;
  }
  if (hasFlag("-u", "--down", "--undo")) {
    return "down" as const;
  }
  return "up" as const;
};

const shouldIncludeDummySeeds = () =>
  hasFlag("-d", "--dummy", "--with-dummy", "--include-dummy") ||
  process.env.SEED_INCLUDE_DUMMY === "true";

const shouldSkipIfSeeded = () =>
  hasFlag("-s", "--skip", "--skip-if-seeded") ||
  process.env.SEED_SKIP_IF_SEEDED === "true";

const getTargetSeedName = (): string | null =>
  getFlagValue("-n", "--name");

const showHelp = () => {
  console.log(`
Database Seeding Tool

Usage: yarn db:seed [options]

Options:
  -d, --dummy              Include dummy/test data
  -r, --reseed             Remove and re-run seeds
  -u, --down, --undo       Remove seeded data
  -s, --skip               Skip if already seeded
  -n, --name <seed>        Run specific seed by name
  -h, --help               Show this help message

Examples:
  yarn db:seed             Run all seeds
  yarn db:seed -d          Run seeds with dummy data
  yarn db:seed -r          Reseed (remove and re-run)
  yarn db:seed -u          Remove seeded data
  yarn db:seed -d -s       Run with dummy data, skip if seeded
  yarn db:seed -n UserSeed Run only UserSeed

Environment Variables:
  SEED_INCLUDE_DUMMY       Include dummy data (true/false)
  SEED_SKIP_IF_SEEDED      Skip if already seeded (true/false)

Available Seeds:
${seeds.map(SeedClass => {
    return `  - ${SeedClass.name}`;
  }).join('\n')}
`);
  process.exit(0);
};

const run = async () => {
  if (hasFlag("-h", "--help")) {
    showHelp();
  }

  const options: SeedOptions = {
    includeDummy: shouldIncludeDummySeeds(),
    action: getAction(),
    skipIfSeeded: shouldSkipIfSeeded(),
    targetSeedName: getTargetSeedName()
  };

  const dataSource = await AppDataSource.initialize();


  let allSeeds = seeds.map((SeedClass: any) => new SeedClass(dataSource, options));

  // Filter by specific seed name if provided
  if (options.targetSeedName) {
    const filteredSeeds = allSeeds.filter(seed => seed.constructor.name === options.targetSeedName);
    if (filteredSeeds.length === 0) {
      console.error(`[seed] Error: Seed "${options.targetSeedName}" not found.`);
      console.log("\nAvailable seeds:");
      allSeeds.forEach(seed => console.log(`  - ${seed.constructor.name}`));
      process.exit(1);
    }
    allSeeds = filteredSeeds;
  }

  // Filter by dummy tag if not including dummy data
  const applicableSeeds = allSeeds.filter((seed) => {
    if (!options.includeDummy && seed.tags?.includes("dummy")) {
      return false;
    }
    return true;
  });

  process.env.SEED_INCLUDE_DUMMY = options.includeDummy ? "true" : "false";

  const seedInfo = options.targetSeedName ? ` (${options.targetSeedName} only)` : ` (${applicableSeeds.length} seed${applicableSeeds.length !== 1 ? 's' : ''})`;
  console.log(`[seed] Action: ${options.action}${seedInfo}${options.includeDummy ? " (with dummy data)" : ""}${options.skipIfSeeded ? " (skip if seeded)" : ""}`);


  try {
    const runUp = async () => {
      for (const seed of applicableSeeds) {
        if (options.skipIfSeeded && seed.isSeeded) {
          const seeded = await seed.isSeeded();
          if (seeded) {
            console.info(`[seed:${seed.name}] Skipped (already seeded).`);
            continue;
          }
        }
        console.info(`[seed:${seed.name}] Running up()`);
        await seed.up();
      }
    };

    const runDown = async () => {
      for (const seed of [...applicableSeeds].reverse()) {
        console.info(`[seed:${seed.name}] Running down()`);
        await seed.down();
      }
    };

    if (options.action === "reseed") {
      await runDown();
      await runUp();
    } else if (options.action === "down") {
      await runDown();
    } else {
      await runUp();
    }

    console.info(`[seed] Completed action: ${options.action}`);
    process.exit(0);
  } catch (error) {
    console.error("[seed] Seed execution failed", error);
    process.exit(1);
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
};

void run();
