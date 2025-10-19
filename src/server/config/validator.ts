/**
 * Configuration Validator
 * 
 * Validates the configuration to ensure all required fields are present
 * and have valid values.
 */

import type { Config } from './types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate email address format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate port number
 */
function isValidPort(port: number): boolean {
  return Number.isInteger(port) && port > 0 && port <= 65535;
}

/**
 * Validate URL format
 */
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate configuration
 */
export function validateConfig(config: Config): ValidationResult {
  const errors: string[] = [];

  // App validation
  if (!config.app) {
    errors.push('app configuration is required');
  } else {
    if (!isValidPort(config.app.port)) {
      errors.push(`app.port must be a valid port number (1-65535), got: ${config.app.port}`);
    }
    if (!config.app.hostname) {
      errors.push('app.hostname is required');
    }
    if (!['development', 'production', 'test'].includes(config.app.environment)) {
      errors.push(`app.environment must be 'development', 'production', or 'test'`);
    }
  }

  // Admin validation
  if (!config.admin) {
    errors.push('admin configuration is required');
  } else {
    if (!config.admin.email) {
      errors.push('admin.email is required');
    } else if (!isValidEmail(config.admin.email)) {
      errors.push(`admin.email must be a valid email address, got: ${config.admin.email}`);
    }
    if (!config.admin.name) {
      errors.push('admin.name is required');
    }
  }

  // Docker validation
  if (!config.docker) {
    errors.push('docker configuration is required');
  } else {
    if (!config.docker.host) {
      errors.push('docker.host is required');
    }
  }

  // Database validation
  if (!config.database) {
    errors.push('database configuration is required');
  } else {
    if (!['sqlite', 'postgres', 'mysql'].includes(config.database.type)) {
      errors.push(`database.type must be 'sqlite', 'postgres', or 'mysql'`);
    }
    if (config.database.type === 'sqlite' && !config.database.path) {
      errors.push('database.path is required for SQLite');
    }
    if (['postgres', 'mysql'].includes(config.database.type)) {
      if (!config.database.host) {
        errors.push(`database.host is required for ${config.database.type}`);
      }
      if (!config.database.database) {
        errors.push(`database.database is required for ${config.database.type}`);
      }
    }
  }

  // Email validation (if enabled)
  if (config.email?.enabled) {
    if (!config.email.smtp.host) {
      errors.push('email.smtp.host is required when email is enabled');
    }
    if (!isValidPort(config.email.smtp.port)) {
      errors.push(`email.smtp.port must be a valid port number, got: ${config.email.smtp.port}`);
    }
    if (config.email.from?.address && !isValidEmail(config.email.from.address)) {
      errors.push(`email.from.address must be a valid email, got: ${config.email.from.address}`);
    }
  }

  // DNS validation (if enabled)
  if (config.dns?.enabled) {
    if (!['powerdns', 'cloudflare', 'route53', 'manual'].includes(config.dns.provider)) {
      errors.push(`dns.provider must be 'powerdns', 'cloudflare', 'route53', or 'manual'`);
    }
    if (config.dns.provider === 'powerdns' && !config.dns.apiUrl) {
      errors.push('dns.apiUrl is required for PowerDNS provider');
    }
    if (config.dns.provider === 'cloudflare' && !config.dns.cloudflare) {
      errors.push('dns.cloudflare configuration is required for Cloudflare provider');
    }
    if (config.dns.provider === 'route53' && !config.dns.route53) {
      errors.push('dns.route53 configuration is required for Route53 provider');
    }
  }

  // SSL validation (if enabled)
  if (config.ssl?.enabled) {
    if (!['letsencrypt', 'manual'].includes(config.ssl.provider)) {
      errors.push(`ssl.provider must be 'letsencrypt' or 'manual'`);
    }
    if (config.ssl.provider === 'letsencrypt' && !config.ssl.email) {
      errors.push('ssl.email is required for Let\'s Encrypt');
    }
  }

  // Security validation
  if (!config.security) {
    errors.push('security configuration is required');
  } else {
    if (!config.security.jwtSecret) {
      errors.push('security.jwtSecret is required');
    }
    // Note: jwtSecret length is auto-fixed in config loader, so we just warn here
    if (config.security.bcryptRounds < 4 || config.security.bcryptRounds > 31) {
      errors.push('security.bcryptRounds must be between 4 and 31');
    }
  }

  // Performance validation
  if (config.performance) {
    if (config.performance.metricsRefreshInterval < 1000) {
      errors.push('performance.metricsRefreshInterval must be at least 1000ms');
    }
    if (config.performance.logsRefreshInterval < 1000) {
      errors.push('performance.logsRefreshInterval must be at least 1000ms');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate and throw on error
 */
export function validateConfigOrThrow(config: Config): void {
  const result = validateConfig(config);
  if (!result.valid) {
    const errorMessage = 'Configuration validation failed:\n' + 
      result.errors.map(e => `  - ${e}`).join('\n');
    throw new Error(errorMessage);
  }
}

