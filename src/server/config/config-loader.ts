/**
 * Configuration Loader
 * 
 * Loads configuration from config.yml with fallback to environment variables.
 * Provides a single source of truth for all application configuration.
 * 
 * Usage:
 *   import { config } from '@/server/config/config-loader';
 *   const port = config.app.port;
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { parse as parseYaml } from 'yaml';
import type { Config, PartialConfig } from './types';
import { getDefaultConfig } from './defaults';
import { validateConfig } from './validator';

class ConfigLoader {
  private static instance: ConfigLoader;
  private _config: Config | null = null;
  private configPath: string;

  private constructor() {
    // Determine config file path
    const rootDir = process.cwd();
    this.configPath = process.env.CONFIG_FILE || join(rootDir, 'config.yml');
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): ConfigLoader {
    if (!ConfigLoader.instance) {
      ConfigLoader.instance = new ConfigLoader();
    }
    return ConfigLoader.instance;
  }

  /**
   * Load configuration from config.yml
   */
  private loadFromYaml(): PartialConfig {
    try {
      if (!existsSync(this.configPath)) {
        console.warn(`Config file not found at ${this.configPath}, using defaults`);
        return {};
      }

      const fileContents = readFileSync(this.configPath, 'utf8');
      const yamlConfig = parseYaml(fileContents) as PartialConfig;
      const interpolated = this.interpolateEnvVariables(yamlConfig);

      console.log('✓ Loaded configuration from config.yml');
      return interpolated || {};
    } catch (error) {
      console.error(`Error loading config.yml: ${error}`);
      console.warn('Falling back to environment variables');
      return {};
    }
  }

  /**
   * Merge configurations with priority: YAML > ENV > Defaults
   */
  private mergeConfigs(...configs: PartialConfig[]): Config {
    const merged: any = {};

    // Deep merge utility
    const deepMerge = (target: any, source: any) => {
      for (const key in source) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          target[key] = deepMerge(target[key] || {}, source[key]);
        } else if (source[key] !== undefined && source[key] !== null && source[key] !== '') {
          target[key] = source[key];
        }
      }
      return target;
    };

    // Merge all configs
    for (const config of configs) {
      deepMerge(merged, config);
    }

    // Post-merge fixes: Ensure jwtSecret is long enough
    if (merged.security?.jwtSecret && merged.security.jwtSecret.length < 32) {
      console.warn('[config] JWT secret too short, generating secure random secret');
      const crypto = require('crypto');
      merged.security.jwtSecret = crypto.randomBytes(32).toString('hex');
    }

    if (merged.setup?.initialSecret && merged.setup.initialSecret.length < 12) {
      console.warn('[config] setup.initialSecret too short, generating secure random secret');
      const crypto = require('crypto');
      merged.setup.initialSecret = crypto.randomBytes(12).toString('hex');
    }

    return merged as Config;
  }

  /**
   * Get the current configuration
   * Loads and caches config on first access
   */
  public get config(): Config {
    if (!this._config) {
      this._config = this.load();
    }
    return this._config;
  }

  /**
   * Load and validate configuration
   */
  public load(): Config {
    // Load from different sources
    const defaultConfig = getDefaultConfig();
    const yamlConfig = this.loadFromYaml();

    // Merge with priority: defaults < config.yml < env
    const config = this.mergeConfigs(defaultConfig, yamlConfig);
    this.applyProcessEnv(config);

    // Validate configuration
    const validation = validateConfig(config);
    
    if (!validation.valid) {
      console.error('Configuration validation errors:');
      validation.errors.forEach(error => console.error(`  - ${error}`));
      throw new Error('Invalid configuration');
    }

    // Cache the config
    this._config = config;

    return config;
  }

  /**
   * Reload configuration
   * Useful for hot-reloading config changes
   */
  public reload(): Config {
    this._config = null;
    return this.load();
  }

  /**
   * Get a specific config value by path
   * Example: get('app.port') returns config.app.port
   */
  public get<T = any>(path: string): T {
    const keys = path.split('.');
    let value: any = this.config;

    for (const key of keys) {
      if (value === undefined || value === null) {
        throw new Error(`Config path not found: ${path}`);
      }
      value = value[key];
    }

    return value as T;
  }

  /**
   * Check if a feature is enabled
   */
  public isFeatureEnabled(feature: keyof Config['features']): boolean {
    return this.config.features[feature];
  }

  private applyProcessEnv(config: Config): void {
    if (config.app?.port && !process.env.PORT) {
      process.env.PORT = String(config.app.port);
    }
    if (config.app?.hostname && !process.env.HOSTNAME) {
      process.env.HOSTNAME = config.app.hostname;
    }
    if (config.app?.environment && !process.env.NODE_ENV) {
      (process.env as any).NODE_ENV = config.app.environment;
    }
    if (config.app?.baseUrl && !process.env.BASE_URL) {
      process.env.BASE_URL = config.app.baseUrl;
    }
  }

  /**
   * Replace ${ENV_VAR} or ${ENV_VAR:-fallback} tokens inside YAML config values.
   */
  private interpolateEnvVariables<T>(input: T): T {
    const envPattern = /\$\{([^}:]+)(?::-(.*?))?\}/g;

    const substitute = (value: unknown): unknown => {
      if (Array.isArray(value)) {
        return value.map((entry) => substitute(entry));
      }

      if (value && typeof value === 'object') {
        return Object.entries(value as Record<string, unknown>).reduce<Record<string, unknown>>((acc, [key, entry]) => {
          acc[key] = substitute(entry);
          return acc;
        }, {});
      }

      if (typeof value !== 'string') {
        return value;
      }

      if (!envPattern.test(value)) {
        return value;
      }

      const replaced = value.replace(envPattern, (_match, name, fallback) => {
        const envValue = process.env[name];
        if (envValue === undefined || envValue === '') {
          return fallback ?? '';
        }
        return envValue;
      });

      const trimmedOriginal = value.trim();
      const trimmedResult = replaced.trim();
      const isPurePlaceholder = /^\$\{[^}]+\}$/.test(trimmedOriginal);

      if (isPurePlaceholder) {
        if (/^(true|false)$/i.test(trimmedResult)) {
          return trimmedResult.toLowerCase() === 'true';
        }
        if (trimmedResult !== '' && !Number.isNaN(Number(trimmedResult))) {
          return Number(trimmedResult);
        }
      }

      return trimmedResult;
    };

    return substitute(input) as T;
  }
}

// Export singleton instance
const configLoader = ConfigLoader.getInstance();

/**
 * Main config export
 * Use this throughout the application
 */
export const config = configLoader.config;

/**
 * Config loader export
 * Use for advanced operations like reload()
 */
export { configLoader };

/**
 * Convenience exports
 */
export const getConfig = () => configLoader.config;
export const reloadConfig = () => configLoader.reload();
export const getConfigValue = <T = any>(path: string): T => configLoader.get<T>(path);
export const isFeatureEnabled = (feature: keyof Config['features']) => 
  configLoader.isFeatureEnabled(feature);
