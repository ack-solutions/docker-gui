import type { Setting as SettingModel } from "@prisma/client";
import { prisma } from "../database/client";

export interface Setting {
  key: string;
  value: string;
  valueType: "string" | "number" | "boolean" | "json";
  description?: string | null;
  updatedAt: Date;
}

export class SettingsService {
  private static instance: SettingsService;
  private defaultsInitialized = false;

  private constructor() {}

  static getInstance(): SettingsService {
    if (!SettingsService.instance) {
      SettingsService.instance = new SettingsService();
    }
    return SettingsService.instance;
  }

  async get(key: string): Promise<Setting | null> {
    const setting = await prisma.setting.findUnique({ where: { key } });
    return setting ? this.mapSetting(setting) : null;
  }

  async getValue<T = string>(key: string, defaultValue: T): Promise<T> {
    const setting = await this.get(key);
    if (!setting) {
      return defaultValue;
    }
    return this.parseValue<T>(setting.value, setting.valueType);
  }

  async set(
    key: string,
    value: string | number | boolean | object,
    description?: string
  ): Promise<Setting> {
    const { stringValue, valueType } = this.serializeValue(value);

    const setting = await prisma.setting.upsert({
      where: { key },
      update: {
        value: stringValue,
        valueType,
        description: description ?? undefined
      },
      create: {
        key,
        value: stringValue,
        valueType,
        description: description ?? null
      }
    });

    return this.mapSetting(setting);
  }

  async getAll(): Promise<Setting[]> {
    const settings = await prisma.setting.findMany({ orderBy: { key: "asc" } });
    return settings.map((setting) => this.mapSetting(setting));
  }

  async delete(key: string): Promise<boolean> {
    try {
      await prisma.setting.delete({ where: { key } });
      return true;
    } catch (error: any) {
      if (error?.code === "P2025") {
        return false;
      }
      throw error;
    }
  }

  async ensureDefaults(): Promise<void> {
    if (this.defaultsInitialized) {
      return;
    }

    this.defaultsInitialized = true;
    try {
      await Promise.all(
        Object.entries(DEFAULT_SETTINGS).map(async ([key, value]) => {
          const existing = await prisma.setting.findUnique({ where: { key } });
          if (!existing) {
            await this.set(key, value);
          }
        })
      );
    } catch (error) {
      this.defaultsInitialized = false;
      throw error;
    }
  }

  private mapSetting(setting: SettingModel): Setting {
    return {
      key: setting.key,
      value: setting.value,
      valueType: setting.valueType as Setting["valueType"],
      description: setting.description,
      updatedAt: setting.updatedAt
    };
  }

  private serializeValue(value: string | number | boolean | object): {
    stringValue: string;
    valueType: "string" | "number" | "boolean" | "json";
  } {
    if (typeof value === "string") {
      return { stringValue: value, valueType: "string" };
    }
    if (typeof value === "number") {
      return { stringValue: String(value), valueType: "number" };
    }
    if (typeof value === "boolean") {
      return { stringValue: String(value), valueType: "boolean" };
    }
    return { stringValue: JSON.stringify(value), valueType: "json" };
  }

  private parseValue<T>(value: string, valueType: string): T {
    switch (valueType) {
      case "number":
        return Number(value) as T;
      case "boolean":
        return (value === "true") as T;
      case "json":
        return JSON.parse(value) as T;
      default:
        return value as T;
    }
  }
}

export const DEFAULT_SETTINGS = {
  METRICS_LOG_RETENTION_DAYS_CPU: 7,
  METRICS_LOG_BATCH_SIZE_CPU: 10,
  METRICS_LOG_BATCH_INTERVAL_MS_CPU: 30000,
  METRICS_CLEANUP_ENABLED_CPU: true,
  METRICS_CLEANUP_INTERVAL_HOURS_CPU: 24,

  METRICS_LOG_RETENTION_DAYS_MEMORY: 7,
  METRICS_LOG_BATCH_SIZE_MEMORY: 10,
  METRICS_LOG_BATCH_INTERVAL_MS_MEMORY: 30000,
  METRICS_CLEANUP_ENABLED_MEMORY: true,
  METRICS_CLEANUP_INTERVAL_HOURS_MEMORY: 24,

  METRICS_LOG_RETENTION_DAYS_DISK: 30,
  METRICS_LOG_BATCH_SIZE_DISK: 1,
  METRICS_LOG_BATCH_INTERVAL_MS_DISK: 3600000,
  METRICS_CLEANUP_ENABLED_DISK: true,
  METRICS_CLEANUP_INTERVAL_HOURS_DISK: 24
} as const;

export const initializeDefaultSettings = async () => {
  await SettingsService.getInstance().ensureDefaults();
};
