/**
 * Default Configuration Values
 * 
 * Provides sensible defaults for all configuration options.
 * These are used as fallback values when not specified in config.yml or .env
 */

import type { Config } from './types';
import { randomBytes } from 'crypto';
/**
 * Get default configuration
 */
export function getDefaultConfig(): Config {
  const isDevelopment = process.env.NODE_ENV !== 'production';

  return {
    app: {
      port: 3000,
      hostname: '0.0.0.0',
      environment: isDevelopment ? 'development' : 'production',
      baseUrl: undefined,
    },

    docker: {
      host: process.platform === 'win32'
        ? 'npipe:////./pipe/docker_engine'
        : 'unix:///var/run/docker.sock',
      tlsVerify: false,
      certPath: undefined,
    },

    nginx: {
      enabled: false,
      containerName: 'nginx-proxy',
      configPath: '/etc/nginx-managed',
      sitesPath: '/etc/nginx-managed/sites',
      reloadCommand: 'nginx -s reload',
    },

    email: {
      enabled: false,
      smtp: {
        host: 'localhost',
        port: 1025,
        secure: false,
        user: undefined,
        pass: undefined,
      },
      from: {
        name: 'Docker GUI',
        address: 'noreply@docker-gui.local',
      },
    },

    dns: {
      enabled: false,
      provider: 'manual',
      apiUrl: undefined,
      apiKey: undefined,
      cloudflare: undefined,
      route53: undefined,
    },

    proxies: {
      enabled: false,
      autoDiscovery: false,
    },

    features: {
      containerManagement: true,
      imageManagement: true,
      volumeManagement: true,
      networkManagement: true,
      nginxManagement: false,
      emailManagement: false,
      dnsManagement: false,
      sslManagement: false,
      proxyManagement: false,
      userManagement: true,
      systemMetrics: true,
      storageManagement: false,
    },

    performance: {
      metricsRefreshInterval: 5000,
      logsRefreshInterval: 2000,
      containerStatsInterval: 3000,
      metricsRetentionDays: 30,
      logsRetentionDays: 7,
      maxLogLines: 1000,
    },

    backup: {
      enabled: false,
      schedule: '0 2 * * *', // 2 AM daily
      path: '/var/backups/docker-gui',
      retention: 30,
      includeDatabase: true,
      includeConfigs: true,
      includeLogs: false,
    },

    security: {
      jwtSecret: process.env.JWT_SECRET,
      jwtExpiresIn: '24h',
      bcryptRounds: 10,
      cookieSecure: !isDevelopment,
      corsOrigins: isDevelopment ? ['http://localhost:3000'] : undefined,
      rateLimitEnabled: !isDevelopment,
      rateLimitMax: 100,
      rateLimitWindow: 15 * 60 * 1000, // 15 minutes
    },

    setup: {
      initialSecret: '',
    },

    minio: {
      enabled: false,
      endpoint: 'localhost',
      port: 9000,
      useSSL: false,
      accessKey: 'minioadmin',
      secretKey: 'minioadmin',
      console: {
        port: 9001,
      },
    },
  };
}
