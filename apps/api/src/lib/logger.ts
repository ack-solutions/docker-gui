import type { Config } from '../config.js';
import type { LoggerOption } from '../app.js';

/**
 * Build the Fastify logger options from app config. Fastify owns the pino
 * instance lifecycle; this just shapes the config.
 */
export function buildLoggerOptions(config: Config): LoggerOption {
  if (config.LOG_PRETTY) {
    return {
      level: config.LOG_LEVEL,
      transport: {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l', ignore: 'pid,hostname' },
      },
    };
  }
  return { level: config.LOG_LEVEL };
}
