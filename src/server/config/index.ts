/**
 * Configuration Module
 * 
 * Central export point for all configuration-related functionality.
 * 
 * Usage:
 *   import { config } from '@/server/config';
 *   const port = config.app.port;
 *   
 *   import { getConfigValue } from '@/server/config';
 *   const port = getConfigValue<number>('app.port');
 */

export * from './types';
export * from './config-loader';
export * from './defaults';
export * from './validator';

// Re-export main config for convenience
export { config } from './config-loader';

