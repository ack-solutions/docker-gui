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
 * Validate port number
 */
function isValidPort(port: number): boolean {
  return Number.isInteger(port) && port > 0 && port <= 65535;
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

  // Docker validation
  if (!config.docker) {
    errors.push('docker configuration is required');
  } else {
    if (!config.docker.host) {
      errors.push('docker.host is required');
    }
  }


  // DNS validation (if enabled)
  if (config.dns?.enabled) {
    if (!['cloudflare', 'route53', 'manual'].includes(config.dns.provider)) {
      errors.push(`dns.provider must be 'cloudflare', 'route53', or 'manual'`);
    }
    if (config.dns.provider === 'cloudflare' && !config.dns.cloudflare) {
      errors.push('dns.cloudflare configuration is required for Cloudflare provider');
    }
    if (config.dns.provider === 'route53' && !config.dns.route53) {
      errors.push('dns.route53 configuration is required for Route53 provider');
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

  if (!config.setup || !config.setup.initialSecret) {
    errors.push('setup.initialSecret is required');
  } else if (config.setup.initialSecret.length < 12) {
    errors.push('setup.initialSecret must be at least 12 characters long');
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
