import { loadConfig, loadConfigSnapshot, parseCorsOrigins } from './config.js';
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
import { SitesService } from './services/sites.service.js';
import { DnsService } from './services/dns.service.js';
import { FeaturesService } from './services/features.service.js';
import { StorageService } from './services/storage.service.js';
import { RegistryService } from './services/registry.service.js';
import { DatabaseService } from './services/database.service.js';
import { BackupService } from './services/backup.service.js';
import { BackupSchedulerService, NodeCronScheduler } from './services/backup-scheduler.service.js';
import { DbExplorerService } from './services/db-explorer.service.js';
import { AlertService, WebhookAlertSender } from './services/alert.service.js';
import { getCpuUsagePercent, getMemoryMetrics } from './services/system-metrics.service.js';
import { DockerBackupEngine } from './lib/backup-engine.js';
import { AuditLogService } from './services/audit-log.service.js';
import { CaddyClient } from './lib/caddy.js';
import { CryptoBox } from './lib/crypto-box.js';

const startedAt = Date.now();

async function main(): Promise<void> {
  const config = loadConfig();
  const configSnapshot = loadConfigSnapshot();
  for (const warning of configSnapshot.warnings()) {
    // eslint-disable-next-line no-console
    console.warn(`[config] ${warning}`);
  }
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
  const caddy = config.CADDY_ADMIN_URL
    ? new CaddyClient({ adminUrl: config.CADDY_ADMIN_URL })
    : null;
  const sites = new SitesService(prisma, caddy, {
    rendererDefaults: config.CADDY_DEFAULT_LE_EMAIL
      ? { defaultLetsEncryptEmail: config.CADDY_DEFAULT_LE_EMAIL }
      : {},
  });
  const cryptoBox = new CryptoBox(config.JWT_SECRET);
  const dns = new DnsService(prisma, cryptoBox, {
    ...(config.SYSTEM_PUBLIC_IP ? { publicIp: config.SYSTEM_PUBLIC_IP } : {}),
    ...(config.SYSTEM_PUBLIC_IP6 ? { publicIp6: config.SYSTEM_PUBLIC_IP6 } : {}),
  });
  const features = new FeaturesService(docker, {
    network: config.DOCKER_GUI_NETWORK,
    hostInstallDir: config.DOCKER_GUI_INSTALL_DIR,
  });
  const storage = new StorageService(prisma, cryptoBox);
  const registry = new RegistryService(prisma, cryptoBox);
  const databases = new DatabaseService(prisma, cryptoBox, docker);
  const backups = new BackupService(prisma, cryptoBox, storage, {
    engine: new DockerBackupEngine(docker, { network: config.DOCKER_GUI_NETWORK }),
  });
  const scheduler = new BackupSchedulerService(prisma, backups, new NodeCronScheduler());
  const explorer = new DbExplorerService(prisma, cryptoBox, docker, {
    network: config.DOCKER_GUI_NETWORK,
  });
  const alerts = new AlertService(prisma, { sender: new WebhookAlertSender() });
  const audit = new AuditLogService(prisma);

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
    sites,
    dns,
    features,
    storage,
    registry,
    databases,
    backups,
    scheduler,
    explorer,
    alerts,
    configSnapshot,
    audit,
    jwtConfig,
    setupSecret: config.SETUP_SECRET,
  });

  try {
    await app.listen({ host: config.API_HOST, port: config.API_PORT });
    app.log.info(
      { host: config.API_HOST, port: config.API_PORT, env: config.NODE_ENV },
      'API listening',
    );
    // Route fired-task failures to the app logger, then register schedules.
    scheduler.setErrorLogger((ctx, msg) => app.log.error(ctx, msg));
    await scheduler.start().catch((err: unknown) => app.log.error({ err }, 'scheduler start failed'));

    // Reap idle DB-explorer sidecars every 5 minutes.
    const reaper = setInterval(() => {
      void explorer.reapIdle().catch((err: unknown) => app.log.error({ err }, 'explorer reap failed'));
    }, 5 * 60 * 1000);
    reaper.unref();

    // Evaluate alert rules against a fresh metric snapshot every 60s.
    const alertTimer = setInterval(() => {
      void (async () => {
        try {
          const [cpu, mem] = [await getCpuUsagePercent(), getMemoryMetrics()];
          await alerts.evaluate({
            'system.cpu.percent': cpu,
            'system.memory.percent': mem.usagePercent,
          });
        } catch (err) {
          app.log.error({ err }, 'alert evaluation failed');
        }
      })();
    }, 60 * 1000);
    alertTimer.unref();
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
