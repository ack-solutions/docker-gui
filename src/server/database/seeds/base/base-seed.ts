import type { DataSource } from "typeorm";

export interface SeedOptions {
  includeDummy: boolean;
  action: "up" | "down" | "reseed";
  skipIfSeeded: boolean;
  targetSeedName: string | null;
}

export type SeedConstructor = new (dataSource: DataSource, options: SeedOptions) => BaseSeed;

export abstract class BaseSeed {
  readonly name: string;
  readonly tags: string[];
  protected dataSource: DataSource;
  protected options: SeedOptions;

  constructor(dataSource: DataSource, options: SeedOptions) {
    this.dataSource = dataSource;
    this.options = options;
    this.name = this.constructor.name;
    this.tags = [];
  }

  abstract up(): Promise<void>;

  abstract down(): Promise<void>;

  async isSeeded?(): Promise<boolean> {
    return false;
  }

  protected shouldIncludeDummy(): boolean {
    return this.options.includeDummy;
  }
}
