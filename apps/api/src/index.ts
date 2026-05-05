import { loadConfig, parseCorsOrigins } from './config.js';
import { buildLoggerOptions } from './lib/logger.js';
import { createDockerClient } from './lib/docker.js';
import { getPrisma, disconnectPrisma } from './lib/db.js';
import { buildApp } from './app.js';
import { AuthService } from './services/auth.service.js';
import { UserService } from './services/user.service.js';
import { DockerContainersService } from './services/docker-containers.service.js';
import { DockerImagesService } from './services/docker-images.service.js';
import { DockerVolumesService } from './services/docker-volumes.service.js';
import { DockerNetworksService } from './services/docker-networks.service.js';

const startedAt = Date.now();

async function main(): Promise<void> {
  const config = loadConfig();
  const docker = createDockerClient(config);
  const prisma = getPrisma();

  const jwtConfig = {
    secret: config.JWT_SECRET,
    accessTtlSeconds: config.ACCESS_TOKEN_TTL,
    refreshTtlSeconds: config.REFRESH_TOKEN_TTL,
  };

  const users = new UserService(prisma);
  const auth = new AuthService(prisma, jwtConfig);
  const containers = new DockerContainersService(docker);
  const images = new DockerImagesService(docker);
  const volumes = new DockerVolumesService(docker);
  const networks = new DockerNetworksService(docker);

  const app = await buildApp({
    logger: buildLoggerOptions(config),
    corsOrigins: parseCorsOrigins(config.CORS_ORIGINS),
    healthDeps: {
      docker,
      prisma,
      appVersion: process.env['npm_package_version'] ?? '0.1.0',
      startedAt,
    },
    auth,
    users,
    containers,
    images,
    volumes,
    networks,
    jwtConfig,
    setupSecret: config.SETUP_SECRET,
  });

  try {
    await app.listen({ host: config.API_HOST, port: config.API_PORT });
    app.log.info(
      { host: config.API_HOST, port: config.API_PORT, env: config.NODE_ENV },
      'API listening',
    );
  } catch (err) {
    app.log.error({ err }, 'Failed to start API');
    await disconnectPrisma();
    process.exit(1);
  }

  for (const sig of ['SIGINT', 'SIGTERM'] as const) {
    process.on(sig, () => {
      app.log.info({ signal: sig }, 'Shutting down');
      void app
        .close()
        .then(disconnectPrisma)
        .then(() => process.exit(0));
    });
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal startup error:', err);
  process.exit(1);
});
