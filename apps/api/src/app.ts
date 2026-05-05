import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import { healthRoutes } from './routes/health.routes.js';
import { authRoutes } from './routes/auth.routes.js';
import { dockerRoutes } from './routes/docker.routes.js';
import { sitesRoutes } from './routes/sites.routes.js';
import { dnsRoutes } from './routes/dns.routes.js';
import { wsRoutes } from './routes/ws.routes.js';
import type { HealthDeps } from './services/health.service.js';
import type { AuthService } from './services/auth.service.js';
import type { UserService } from './services/user.service.js';
import type { DockerContainersService } from './services/docker-containers.service.js';
import type { DockerImagesService } from './services/docker-images.service.js';
import type { DockerVolumesService } from './services/docker-volumes.service.js';
import type { DockerNetworksService } from './services/docker-networks.service.js';
import type { SitesService } from './services/sites.service.js';
import type { DnsService } from './services/dns.service.js';
import type { JwtConfig } from './lib/jwt.js';
import { AppError } from './lib/errors.js';

export type LoggerOption = NonNullable<FastifyServerOptions['logger']>;

export interface BuildAppOptions {
  logger: LoggerOption;
  corsOrigins?: string[];
  healthDeps: HealthDeps;
  auth: AuthService;
  users: UserService;
  containers: DockerContainersService;
  images: DockerImagesService;
  volumes: DockerVolumesService;
  networks: DockerNetworksService;
  sites: SitesService;
  dns: DnsService;
  jwtConfig: JwtConfig;
  setupSecret: string;
}

function getStatusCode(err: unknown): number {
  if (
    typeof err === 'object' &&
    err !== null &&
    'statusCode' in err &&
    typeof (err as { statusCode: unknown }).statusCode === 'number'
  ) {
    return (err as { statusCode: number }).statusCode;
  }
  return 500;
}

function getDetails(err: unknown): Record<string, unknown> | undefined {
  if (
    typeof err === 'object' &&
    err !== null &&
    'details' in err &&
    typeof (err as { details: unknown }).details === 'object' &&
    (err as { details: unknown }).details !== null
  ) {
    return (err as { details: Record<string, unknown> }).details;
  }
  return undefined;
}

function getMessage(err: unknown): string | undefined {
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err !== null && 'message' in err) {
    const m = (err as { message: unknown }).message;
    if (typeof m === 'string') return m;
  }
  return undefined;
}

export async function buildApp(opts: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: opts.logger });

  await app.register(cors, {
    origin: opts.corsOrigins ?? ['http://localhost:3000'],
    credentials: true,
  });
  await app.register(sensible);

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof AppError) {
      return reply.status(err.statusCode).send({
        error: {
          code: err.code,
          message: err.message,
          ...(err.details ? { details: err.details } : {}),
        },
      });
    }
    const statusCode = getStatusCode(err);
    if (statusCode === 400) {
      const details = getDetails(err);
      return reply.status(400).send({
        error: {
          code: 'validation_error',
          message: getMessage(err) ?? 'Validation failed',
          ...(details ? { details } : {}),
        },
      });
    }
    req.log.error({ err }, 'Unhandled error');
    return reply.status(statusCode).send({
      error: {
        code: 'internal_error',
        message: 'An unexpected error occurred',
      },
    });
  });

  app.setNotFoundHandler((_req, reply) => {
    return reply.status(404).send({
      error: { code: 'not_found', message: 'Route not found' },
    });
  });

  await app.register(
    async (api) => {
      await api.register(healthRoutes, { deps: opts.healthDeps });
      await api.register(authRoutes, {
        auth: opts.auth,
        users: opts.users,
        authMiddleware: { jwtConfig: opts.jwtConfig },
        setupSecret: opts.setupSecret,
      });
      await api.register(dockerRoutes, {
        containers: opts.containers,
        images: opts.images,
        volumes: opts.volumes,
        networks: opts.networks,
        authMiddleware: { jwtConfig: opts.jwtConfig },
      });
      await api.register(sitesRoutes, {
        sites: opts.sites,
        authMiddleware: { jwtConfig: opts.jwtConfig },
      });
      await api.register(dnsRoutes, {
        dns: opts.dns,
        authMiddleware: { jwtConfig: opts.jwtConfig },
      });
      await api.register(wsRoutes, {
        containers: opts.containers,
        jwtConfig: opts.jwtConfig,
      });
    },
    { prefix: '/api/v1' },
  );

  return app;
}
