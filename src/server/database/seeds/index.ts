import { UserSeed } from "./user.seed";
import type { SeedConstructor } from "./base/base-seed";

/**
 * Register all seeds here in the order they should run.
 * Seeds will execute in the order defined below.
 */
export const seeds: SeedConstructor[] = [
  UserSeed
  // Add more seeds here as needed
];

export default seeds;
