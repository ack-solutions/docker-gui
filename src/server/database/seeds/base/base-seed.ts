import type { DataSource } from "typeorm";

export interface SeedOptions {
  includeDummy: boolean;
  action: "up" | "down" | "reseed";
  skipIfSeeded: boolean;
  targetSeedName: string | null;
}

export abstract class BaseSeed {

  protected dataSource: DataSource;

  constructor(dataSource: DataSource, options: SeedOptions) {
    this.dataSource = dataSource;
  }

  abstract up(): Promise<void>;
  
  abstract down(): Promise<void>;
  
  async isSeeded?(): Promise<boolean> {
    return false;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  protected shouldIncludeDummy(): boolean {
    return process.env.SEED_INCLUDE_DUMMY === "true" || process.env.SEED_INCLUDE_DUMMY === "1";
  }

}
