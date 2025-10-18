import "reflect-metadata";
import fs from "node:fs";
import path from "node:path";
import { DataSource } from "typeorm";
import { UserEntity } from "../user/user.entity";
import { CpuMetricsLogEntity } from "../system/cpu-metrics-log.entity";
import { MemoryMetricsLogEntity } from "../system/memory-metrics-log.entity";
import { DiskMetricsLogEntity } from "../system/disk-metrics-log.entity";
import { SettingsEntity } from "../system/settings.entity";
import { InitUsers1708064400000 } from "./migrations/1708064400000-InitUsers";
import { AddSettingsAndMetricsLogs1760790304940 } from "./migrations/1760790304940-AddSettingsAndMetricsLogs";
import { initializeDefaultSettings } from "../system/settings-service";

const resolveDatabasePath = () => {
  const defaultPath = path.join(process.cwd(), ".data", "docker-gui.db");
  const databaseUrl = process.env.DATABASE_URL ?? `file:${defaultPath}`;
  if (databaseUrl.startsWith("file:")) {
    const filesystemPath = databaseUrl.replace(/^file:/, "");
    const directory = path.dirname(filesystemPath);
    fs.mkdirSync(directory, { recursive: true });
    return filesystemPath;
  }
  return databaseUrl;
};

export const AppDataSource = new DataSource({
  type: "sqlite",
  database: resolveDatabasePath(),
  entities: [UserEntity, CpuMetricsLogEntity, MemoryMetricsLogEntity, DiskMetricsLogEntity, SettingsEntity],
  // migrations: [InitUsers1708064400000, AddSettingsAndMetricsLogs1760790304940],
  // synchronize: false,
  migrationsTableName: "migrations",
  // migrationsRun: false,
  logging: process.env.TYPEORM_LOGGING === "true"
});

let dataSource: DataSource | null = null;
let initializing: Promise<DataSource> | null = null;

let settingsInitialized = false;

export const getDataSource = async (): Promise<DataSource> => {
  if (dataSource && dataSource.isInitialized) {
    // Initialize default settings on first call after database is ready
    if (!settingsInitialized) {
      settingsInitialized = true;
      initializeDefaultSettings().catch((error) => {
        console.error("[database] Failed to initialize default settings", error);
      });
    }
    return dataSource;
  }

  if (!initializing) {
    initializing = AppDataSource.initialize()
      .then(async (initialized) => {
        dataSource = initialized;
        
        // Run pending migrations
        try {
          const pendingMigrations = await initialized.showMigrations();
          if (pendingMigrations) {
            console.log("[database] Running pending migrations...");
            await initialized.runMigrations();
            console.log("[database] Migrations completed successfully");
          }
        } catch (error) {
          console.error("[database] Migration error", error);
        }
        
        // Initialize default settings after database is ready
        if (!settingsInitialized) {
          settingsInitialized = true;
          try {
            await initializeDefaultSettings();
            console.log("[database] Default settings initialized");
          } catch (error) {
            console.error("[database] Failed to initialize default settings", error);
          }
        }
        
        return initialized;
      })
      .catch((error) => {
        initializing = null;
        throw error;
      });
  }

  return initializing;
};
