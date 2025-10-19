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
      
      console.log('✓ Loaded configuration from config.yml');
      return yamlConfig || {};
    } catch (error) {
      console.error(`Error loading config.yml: ${error}`);
      console.warn('Falling back to environment variables');
      return {};
    }
  }

  /**
   * Load configuration from environment variables
   * Provides backward compatibility with .env files
   */
  private loadFromEnv(): PartialConfig {
    const env = process.env;

    return {
      app: {
        port: env.PORT ? parseInt(env.PORT, 10) : undefined,
        hostname: env.HOSTNAME,
        environment: env.NODE_ENV as any,
        baseUrl: env.BASE_URL,
      },
      admin: {
        email: env.DEFAULT_ADMIN_EMAIL || '',
        password: env.DEFAULT_ADMIN_PASSWORD || '',
        name: env.DEFAULT_ADMIN_NAME || '',
      },
      docker: {
        host: env.DOCKER_HOST || '',
        tlsVerify: env.DOCKER_TLS_VERIFY === '1',
        certPath: env.DOCKER_CERT_PATH,
      },
      database: {
        type: 'sqlite',
        path: env.DATABASE_URL?.replace('file:', ''),
      },
      nginx: {
        enabled: env.NGINX_ENABLED === 'true',
        containerName: env.NGINX_CONTAINER_NAME,
        configPath: env.NGINX_CONFIG_PATH,
      },
      email: {
        enabled: env.EMAIL_ENABLED === 'true',
        smtp: {
          host: env.SMTP_HOST || '',
          port: env.SMTP_PORT ? parseInt(env.SMTP_PORT, 10) : 587,
          secure: env.SMTP_SECURE === 'true',
          user: env.SMTP_USER,
          pass: env.SMTP_PASSWORD,
        },
        from: env.EMAIL_FROM_ADDRESS ? {
          name: env.EMAIL_FROM_NAME || 'Docker GUI',
          address: env.EMAIL_FROM_ADDRESS,
        } : undefined,
      },
      dns: {
        enabled: env.DNS_ENABLED === 'true',
        provider: env.DNS_PROVIDER as any,
        apiUrl: env.DNS_API_URL,
        apiKey: env.DNS_API_KEY,
      },
      ssl: {
        enabled: env.SSL_ENABLED === 'true',
        provider: env.SSL_PROVIDER as any,
        email: env.SSL_EMAIL,
        staging: env.SSL_STAGING === 'true',
      },
      security: {
        jwtSecret: env.JWT_SECRET || '',
        jwtExpiresIn: env.JWT_EXPIRES_IN || '24h',
        bcryptRounds: env.BCRYPT_SALT_ROUNDS ? parseInt(env.BCRYPT_SALT_ROUNDS, 10) : 10,
        cookieSecure: env.AUTH_COOKIE_SECURE === 'true',
      },
    } as PartialConfig;
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
    const envConfig = this.loadFromEnv();
    const yamlConfig = this.loadFromYaml();

    // Merge with priority: YAML > ENV > Defaults
    const config = this.mergeConfigs(defaultConfig, envConfig, yamlConfig);

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
