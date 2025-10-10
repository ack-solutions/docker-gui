import "reflect-metadata";
import fs from "node:fs";
import path from "node:path";
import { DataSource } from "typeorm";
import { UserEntity } from "../user/user.entity";
import { InitUsers1708064400000 } from "./migrations/1708064400000-InitUsers";

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
  entities: [UserEntity],
  migrations: [InitUsers1708064400000],
  migrationsTableName: "migrations",
  logging: process.env.TYPEORM_LOGGING === "true"
});

let dataSource: DataSource | null = null;
let initializing: Promise<DataSource> | null = null;

export const getDataSource = async (): Promise<DataSource> => {
  if (dataSource && dataSource.isInitialized) {
    return dataSource;
  }

  if (!initializing) {
    initializing = AppDataSource.initialize()
      .then((initialized) => {
        dataSource = initialized;
        return initialized;
      })
      .catch((error) => {
        initializing = null;
        throw error;
      });
  }

  return initializing;
};
