import "reflect-metadata";
import fs from "node:fs";
import path from "node:path";
import { DataSource } from "typeorm";
import { UserEntity } from "../user/user.entity";
import { CpuMetricsLogEntity } from "../system/cpu-metrics-log.entity";
import { MemoryMetricsLogEntity } from "../system/memory-metrics-log.entity";
import { DiskMetricsLogEntity } from "../system/disk-metrics-log.entity";
import { SettingsEntity } from "../system/settings.entity";
import { NginxSiteEntity } from "@/server/nginx/nginx-site.entity";
import { NginxProvisionLogEntity } from "@/server/nginx/nginx-provision-log.entity";
import { DomainEntity } from "@/server/domain/domain.entity";
import { DomainRecordEntity } from "@/server/domain/domain-record.entity";
import { InitUsers1708064400000 } from "./migrations/1708064400000-InitUsers";
import { AddSettingsAndMetricsLogs1760790304940 } from "./migrations/1760790304940-AddSettingsAndMetricsLogs";
import { AddNginxSitesAndProvisionLogs1761400000000 } from "./migrations/1761400000000-AddNginxSitesAndProvisionLogs";
import { AddDomainsAndRecords1761500000000 } from "./migrations/1761500000000-AddDomainsAndRecords";
import { initializeDefaultSettings } from "../system/settings-service";

// Load config with error handling for early initialization
let dbConfig: any;
try {
  const { config } = require("../config");
  dbConfig = config.database;
} catch (error) {
  // Fallback to environment variables if config system fails
  console.warn('[database] Config system not available, using environment variables');
  const databaseUrl = process.env.DATABASE_URL ?? `file:${path.join(process.cwd(), ".data", "docker-gui.db")}`;
  dbConfig = {
    type: 'sqlite',
    path: databaseUrl.replace(/^file:/, ''),
  };
}

const resolveDatabasePath = () => {
  if (dbConfig.type === 'sqlite') {
    const filesystemPath = dbConfig.path || path.join(process.cwd(), ".data", "docker-gui.db");
    const directory = path.dirname(filesystemPath);
    fs.mkdirSync(directory, { recursive: true });
    return filesystemPath;
  }
  
  // For other database types, construct connection string
  return `${dbConfig.type}://${dbConfig.username}:${dbConfig.password}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`;
};

const isDevelopment = process.env.NODE_ENV !== 'production';

export const AppDataSource = new DataSource({
  type: dbConfig.type || 'sqlite',
  database: (!dbConfig.type || dbConfig.type === 'sqlite') ? resolveDatabasePath() : undefined,
  host: dbConfig.type && dbConfig.type !== 'sqlite' ? dbConfig.host : undefined,
  port: dbConfig.type && dbConfig.type !== 'sqlite' ? dbConfig.port : undefined,
  username: dbConfig.type && dbConfig.type !== 'sqlite' ? dbConfig.username : undefined,
  password: dbConfig.type && dbConfig.type !== 'sqlite' ? dbConfig.password : undefined,
  ...(dbConfig.type && dbConfig.type !== 'sqlite' && { database: dbConfig.database }),
  entities: [
    UserEntity,
    CpuMetricsLogEntity,
    MemoryMetricsLogEntity,
    DiskMetricsLogEntity,
    SettingsEntity,
    NginxSiteEntity,
    NginxProvisionLogEntity,
    DomainEntity,
    DomainRecordEntity
  ],
  // migrations: [
  //   InitUsers1708064400000,
  //   AddSettingsAndMetricsLogs1760790304940,
  //   AddNginxSitesAndProvisionLogs1761400000000,
  //   AddDomainsAndRecords1761500000000
  // ],
  synchronize: true,
  migrationsTableName: "migrations",
  logging: false,
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
