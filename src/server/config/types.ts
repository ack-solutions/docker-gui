/**
 * Configuration Types
 * 
 * Defines the structure of the application configuration.
 * All config values are strongly typed for better IDE support and type safety.
 */

export interface AppConfig {
  port: number;
  hostname: string;
  environment: 'development' | 'production' | 'test';
  baseUrl?: string;
}

export interface AdminConfig {
  email: string;
  password: string;
  name: string;
}

export interface DockerConfig {
  host: string;
  tlsVerify?: boolean;
  certPath?: string;
}

export interface DatabaseConfig {
  type: 'sqlite' | 'postgres' | 'mysql';
  path?: string;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  ssl?: boolean;
}

export interface NginxConfig {
  enabled: boolean;
  containerName?: string;
  configPath?: string;
  sitesPath?: string;
  reloadCommand?: string;
}

export interface EmailConfig {
  enabled: boolean;
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    user?: string;
    pass?: string;
  };
  from?: {
    name: string;
    address: string;
  };
}

export interface DnsConfig {
  enabled: boolean;
  provider: 'powerdns' | 'cloudflare' | 'route53' | 'manual';
  apiUrl?: string;
  apiKey?: string;
  cloudflare?: {
    email: string;
    apiToken: string;
  };
  route53?: {
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
  };
}

export interface SslConfig {
  enabled: boolean;
  provider: 'letsencrypt' | 'manual';
  email?: string;
  staging?: boolean;
  renewDays?: number;
}

export interface ProxiesConfig {
  enabled: boolean;
  autoDiscovery?: boolean;
}

export interface FeaturesConfig {
  containerManagement: boolean;
  imageManagement: boolean;
  volumeManagement: boolean;
  networkManagement: boolean;
  nginxManagement: boolean;
  emailManagement: boolean;
  dnsManagement: boolean;
  sslManagement: boolean;
  proxyManagement: boolean;
  userManagement: boolean;
  systemMetrics: boolean;
}

export interface PerformanceConfig {
  metricsRefreshInterval: number;
  logsRefreshInterval: number;
  containerStatsInterval: number;
  metricsRetentionDays: number;
  logsRetentionDays: number;
  maxLogLines: number;
}

export interface BackupConfig {
  enabled: boolean;
  schedule?: string;
  path?: string;
  retention?: number;
  includeDatabase?: boolean;
  includeConfigs?: boolean;
  includeLogs?: boolean;
}

export interface SecurityConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  bcryptRounds: number;
  cookieSecure: boolean;
  corsOrigins?: string[];
  rateLimitEnabled?: boolean;
  rateLimitMax?: number;
  rateLimitWindow?: number;
}

export interface SetupConfig {
  initialSecret: string;
}

/**
 * Main Configuration Interface
 * 
 * This represents the complete application configuration.
 * All sections are required by default, but can be made optional if needed.
 */
export interface Config {
  app: AppConfig;
  docker: DockerConfig;
  nginx: NginxConfig;
  email: EmailConfig;
  dns: DnsConfig;
  proxies: ProxiesConfig;
  features: FeaturesConfig;
  performance: PerformanceConfig;
  backup: BackupConfig;
  security: SecurityConfig;
  setup: SetupConfig;
}

/**
 * Partial configuration for development/overrides
 */
export type PartialConfig = Partial<Config>;

/**
 * Environment variable mappings
 * Used for backward compatibility with .env files
 */
export interface EnvMapping {
  [key: string]: string | undefined;
}
