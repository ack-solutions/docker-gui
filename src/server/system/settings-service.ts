import { getDataSource } from "../database/data-source";
import { SettingsEntity } from "./settings.entity";

export interface Setting {
  key: string;
  value: string;
  valueType: "string" | "number" | "boolean" | "json";
  description?: string | null;
  updatedAt: Date;
}

export class SettingsService {
  private static instance: SettingsService;

  private constructor() {}

  static getInstance(): SettingsService {
    if (!SettingsService.instance) {
      SettingsService.instance = new SettingsService();
    }
    return SettingsService.instance;
  }

  async get(key: string): Promise<Setting | null> {
    const dataSource = await getDataSource();
    const repository = dataSource.getRepository(SettingsEntity);
    const setting = await repository.findOne({ where: { key } });
    
    if (!setting) {
      return null;
    }

    return {
      key: setting.key,
      value: setting.value,
      valueType: setting.valueType,
      description: setting.description,
      updatedAt: setting.updatedAt
    };
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
    const dataSource = await getDataSource();
    const repository = dataSource.getRepository(SettingsEntity);

    const { stringValue, valueType } = this.serializeValue(value);

    let setting = await repository.findOne({ where: { key } });

    if (setting) {
      setting.value = stringValue;
      setting.valueType = valueType;
      if (description !== undefined) {
        setting.description = description;
      }
    } else {
      setting = repository.create({
        key,
        value: stringValue,
        valueType,
        description: description || null
      });
    }

    await repository.save(setting);

    return {
      key: setting.key,
      value: setting.value,
      valueType: setting.valueType,
      description: setting.description,
      updatedAt: setting.updatedAt
    };
  }

  async getAll(): Promise<Setting[]> {
    const dataSource = await getDataSource();
    const repository = dataSource.getRepository(SettingsEntity);
    const settings = await repository.find();

    return settings.map((s) => ({
      key: s.key,
      value: s.value,
      valueType: s.valueType,
      description: s.description,
      updatedAt: s.updatedAt
    }));
  }

  async delete(key: string): Promise<boolean> {
    const dataSource = await getDataSource();
    const repository = dataSource.getRepository(SettingsEntity);
    const result = await repository.delete({ key });
    return (result.affected ?? 0) > 0;
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

// Default settings - separate for each metric type
export const DEFAULT_SETTINGS = {
  // CPU metrics - fast changing, frequent sampling
  METRICS_LOG_RETENTION_DAYS_CPU: 7,
  METRICS_LOG_BATCH_SIZE_CPU: 10,           // Every 10 samples
  METRICS_LOG_BATCH_INTERVAL_MS_CPU: 30000, // 30 seconds max
  METRICS_CLEANUP_ENABLED_CPU: true,
  METRICS_CLEANUP_INTERVAL_HOURS_CPU: 24,

  // Memory metrics - fast changing, frequent sampling  
  METRICS_LOG_RETENTION_DAYS_MEMORY: 7,
  METRICS_LOG_BATCH_SIZE_MEMORY: 10,           // Every 10 samples
  METRICS_LOG_BATCH_INTERVAL_MS_MEMORY: 30000, // 30 seconds max
  METRICS_CLEANUP_ENABLED_MEMORY: true,
  METRICS_CLEANUP_INTERVAL_HOURS_MEMORY: 24,

  // Disk metrics - slow changing, less frequent sampling
  METRICS_LOG_RETENTION_DAYS_DISK: 30,
  METRICS_LOG_BATCH_SIZE_DISK: 1,              // Every sample
  METRICS_LOG_BATCH_INTERVAL_MS_DISK: 3600000, // 1 hour
  METRICS_CLEANUP_ENABLED_DISK: true,
  METRICS_CLEANUP_INTERVAL_HOURS_DISK: 24
};

export const initializeDefaultSettings = async () => {
  const service = SettingsService.getInstance();
  
  const entries = Object.entries(DEFAULT_SETTINGS);
  
  for (const [key, value] of entries) {
    const existing = await service.get(key);
    if (!existing) {
      await service.set(key, value);
    }
  }
};

