import type Docker from 'dockerode';
import { AppError, NotFoundError } from '../lib/errors.js';

/**
 * Optional add-on capabilities (reverse proxy, object storage, …) that the
 * user enables on demand from /features. The api itself manages the
 * lifecycle of each feature container via the Docker socket — there's no
 * separate compose project to keep in sync.
 *
 * Each feature is defined statically below. To add one:
 *   1. Append to FEATURE_DEFINITIONS
 *   2. Implement `build(deps)` returning a dockerode createContainer spec
 *   3. Set `comingSoon: false` once it's actually wired up end-to-end
 */

export type FeatureKey = 'caddy' | 'minio' | 'email' | 'postgres-gui' | 'registry';
export type FeatureCategory = 'networking' | 'storage' | 'database' | 'email' | 'registry';
export type FeatureStatus =
  | 'stopped' // container does not exist or is exited
  | 'starting' // container exists, not yet healthy
  | 'running' // container exists and is up
  | 'error' // last operation failed; see lastError
  | 'coming-soon'; // not yet implementable

interface BuildDeps {
  network: string; // Docker network the api container is on
  hostInstallDir: string; // host path to /opt/docker-gui (for bind mounts)
}

interface FeatureDefinition {
  key: FeatureKey;
  displayName: string;
  category: FeatureCategory;
  description: string;
  ports: number[]; // host ports reserved when enabled
  containerName: string;
  /** Named volumes to create before starting (already prefixed). */
  volumes: string[];
  configHref?: string;
  /** Build the dockerode createContainer spec. Undefined → coming-soon. */
  build?: (deps: BuildDeps) => DockerCreateContainerOpts;
}

/**
 * Subset of dockerode's container-create options that we actually use.
 * Typed loosely — dockerode's own types are nominal `any` in many places.
 */
interface DockerCreateContainerOpts {
  name: string;
  Image: string;
  Cmd?: string[];
  Env?: string[];
  Labels?: Record<string, string>;
  ExposedPorts?: Record<string, Record<string, never>>;
  HostConfig: {
    RestartPolicy?: { Name: 'no' | 'on-failure' | 'always' | 'unless-stopped' };
    PortBindings?: Record<string, Array<{ HostIp?: string; HostPort: string }>>;
    Binds?: string[];
    NetworkMode?: string;
  };
}

const PROJECT = 'docker-gui';

const FEATURE_DEFINITIONS: FeatureDefinition[] = [
  {
    key: 'caddy',
    displayName: 'Reverse proxy + automatic HTTPS',
    category: 'networking',
    description:
      'Caddy v2 fronts public traffic on :80 and :443. Required for Sites — point a domain at this server, fill the form, and Caddy issues a Lets Encrypt cert in seconds.',
    ports: [80, 443],
    containerName: 'docker-gui-caddy',
    volumes: [`${PROJECT}_caddy-data`, `${PROJECT}_caddy-config`, `${PROJECT}_caddy-www`],
    configHref: '/sites',
    build: ({ network, hostInstallDir }) => ({
      name: 'docker-gui-caddy',
      Image: 'caddy:2-alpine',
      Cmd: ['caddy', 'run', '--config', '/etc/caddy/initial.json', '--resume'],
      Labels: {
        'docker-gui.managed-by': 'features-service',
        'docker-gui.feature': 'caddy',
      },
      ExposedPorts: {
        '80/tcp': {},
        '443/tcp': {},
        '443/udp': {},
        '2019/tcp': {},
      },
      HostConfig: {
        RestartPolicy: { Name: 'unless-stopped' },
        PortBindings: {
          '80/tcp': [{ HostPort: '80' }],
          '443/tcp': [{ HostPort: '443' }],
          '443/udp': [{ HostPort: '443' }],
          // Admin API: keep on loopback only — internal callers (the api
          // container) reach it via the docker network instead.
          '2019/tcp': [{ HostIp: '127.0.0.1', HostPort: '2019' }],
        },
        Binds: [
          `${hostInstallDir}/caddy/initial.json:/etc/caddy/initial.json:ro`,
          `${PROJECT}_caddy-data:/data`,
          `${PROJECT}_caddy-config:/config`,
          // Static-site web roots the api streams deploys into.
          `${PROJECT}_caddy-www:/srv`,
        ],
        NetworkMode: network,
      },
    }),
  },
  {
    key: 'minio',
    displayName: 'MinIO object storage',
    category: 'storage',
    description:
      'S3-compatible object storage with a custom UI for buckets, IAM, and visual policy editing. Coming soon — see the roadmap.',
    ports: [9000, 9001],
    containerName: 'docker-gui-minio',
    volumes: [`${PROJECT}_minio-data`],
    configHref: '/storage',
  },
  {
    key: 'email',
    displayName: 'On-premise email (Mailu)',
    category: 'email',
    description:
      'Self-hosted SMTP / IMAP / webmail with a setup wizard for DKIM, SPF, and DMARC. Coming soon.',
    ports: [25, 465, 587, 993],
    containerName: 'docker-gui-mailu',
    volumes: [`${PROJECT}_mailu-data`],
  },
  {
    key: 'postgres-gui',
    displayName: 'Postgres GUI',
    category: 'database',
    description:
      'Browser-based Postgres explorer (pgweb). Connects to your Docker-native Postgres containers automatically. Coming soon.',
    ports: [],
    containerName: 'docker-gui-pgweb',
    volumes: [],
  },
  {
    key: 'registry',
    displayName: 'Image registry',
    category: 'registry',
    description:
      'A private Docker image registry (registry:2) running on this server. Push images from CI (GitHub Actions) and pull them back to deploy. Browse and prune tags from the Registry page. For external push, front it with the reverse proxy (TLS + auth); on the internal network the panel reaches it directly.',
    ports: [5000],
    containerName: 'docker-gui-registry',
    volumes: [`${PROJECT}_registry-data`],
    configHref: '/registry',
    build: ({ network }) => ({
      name: 'docker-gui-registry',
      Image: 'registry:2',
      Env: [
        // Allow tag/manifest deletion so the panel's "delete tag" works.
        'REGISTRY_STORAGE_DELETE_ENABLED=true',
        // Permit the panel (and clients) to read across origins if fronted.
        'REGISTRY_HTTP_HEADERS_Access-Control-Allow-Origin=[*]',
      ],
      Labels: {
        'docker-gui.managed-by': 'features-service',
        'docker-gui.feature': 'registry',
      },
      ExposedPorts: {
        '5000/tcp': {},
      },
      HostConfig: {
        RestartPolicy: { Name: 'unless-stopped' },
        PortBindings: {
          // Bind to loopback by default: external push should go through the
          // reverse proxy (TLS + auth), not a raw open port. Operators who
          // want a LAN-reachable port can rebind later.
          '5000/tcp': [{ HostIp: '127.0.0.1', HostPort: '5000' }],
        },
        Binds: [`${PROJECT}_registry-data:/var/lib/registry`],
        NetworkMode: network,
      },
    }),
  },
];

export interface FeatureView {
  key: FeatureKey;
  displayName: string;
  category: FeatureCategory;
  description: string;
  ports: number[];
  status: FeatureStatus;
  comingSoon: boolean;
  configHref?: string;
  details?: {
    containerId?: string;
    image?: string;
    state?: string;
    startedAt?: string;
    lastError?: string;
  };
}

export interface FeaturesServiceOptions {
  network: string;
  hostInstallDir: string;
}

export class FeaturesService {
  private readonly errors = new Map<FeatureKey, string>();

  constructor(
    private readonly docker: Docker,
    private readonly opts: FeaturesServiceOptions,
  ) {}

  /** Snapshot of every feature plus its current status. */
  async list(): Promise<FeatureView[]> {
    return Promise.all(FEATURE_DEFINITIONS.map((def) => this.toView(def)));
  }

  /** Single feature, including transient errors from the last enable/disable. */
  async get(key: FeatureKey): Promise<FeatureView> {
    return this.toView(this.mustFind(key));
  }

  /**
   * Enable a feature: ensure named volumes exist, remove any stale container
   * with the same name, then create + start a fresh one. Idempotent — calling
   * this on an already-running feature restarts it cleanly.
   */
  async enable(key: FeatureKey): Promise<FeatureView> {
    const def = this.mustFind(key);
    if (!def.build) {
      throw new AppError(
        'feature.coming_soon',
        `${def.displayName} is not yet implemented — see the roadmap`,
        400,
      );
    }
    this.errors.delete(key);

    try {
      for (const volumeName of def.volumes) {
        await this.ensureVolume(volumeName);
      }
      await this.removeIfExists(def.containerName);

      const spec = def.build({
        network: this.opts.network,
        hostInstallDir: this.opts.hostInstallDir,
      });
      const created = (await (this.docker as unknown as {
        createContainer: (s: DockerCreateContainerOpts) => Promise<{ start: () => Promise<void> }>;
      }).createContainer(spec));
      await created.start();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to enable feature';
      this.errors.set(key, message);
      throw new AppError('feature.enable_failed', message, 500);
    }
    return this.toView(def);
  }

  /**
   * Disable a feature: stop and remove the container. Named volumes are
   * preserved so re-enable retains data.
   */
  async disable(key: FeatureKey): Promise<FeatureView> {
    const def = this.mustFind(key);
    this.errors.delete(key);
    try {
      await this.removeIfExists(def.containerName);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to disable feature';
      this.errors.set(key, message);
      throw new AppError('feature.disable_failed', message, 500);
    }
    return this.toView(def);
  }

  // ---------- helpers ----------

  private mustFind(key: FeatureKey): FeatureDefinition {
    const def = FEATURE_DEFINITIONS.find((d) => d.key === key);
    if (!def) throw new NotFoundError(`Unknown feature: ${key}`);
    return def;
  }

  private async toView(def: FeatureDefinition): Promise<FeatureView> {
    const lastError = this.errors.get(def.key);
    const view: FeatureView = {
      key: def.key,
      displayName: def.displayName,
      category: def.category,
      description: def.description,
      ports: def.ports,
      comingSoon: def.build === undefined,
      status: def.build === undefined ? 'coming-soon' : 'stopped',
      ...(def.configHref ? { configHref: def.configHref } : {}),
    };
    if (def.build === undefined) {
      if (lastError) view.details = { lastError };
      return view;
    }
    try {
      const info = await this.inspectContainer(def.containerName);
      if (info) {
        view.status = info.State.Running ? 'running' : 'stopped';
        view.details = {
          containerId: info.Id.slice(0, 12),
          state: info.State.Status,
          startedAt: info.State.StartedAt,
          ...(info.Config?.Image ? { image: info.Config.Image } : {}),
          ...(lastError ? { lastError } : {}),
        };
        return view;
      }
    } catch {
      // No container with that name → stopped (the default we already set).
    }
    if (lastError) view.details = { lastError };
    return view;
  }

  private async inspectContainer(
    name: string,
  ): Promise<DockerodeContainerInspect | null> {
    try {
      const c = this.docker.getContainer(name);
      return (await c.inspect()) as DockerodeContainerInspect;
    } catch (err) {
      if (isStatusError(err, 404)) return null;
      throw err;
    }
  }

  private async removeIfExists(name: string): Promise<void> {
    const info = await this.inspectContainer(name);
    if (!info) return;
    const c = this.docker.getContainer(name);
    try {
      if (info.State.Running) {
        await c.stop({ t: 5 });
      }
    } catch (err) {
      if (!isStatusError(err, 304)) throw err;
    }
    try {
      await c.remove({ force: true });
    } catch (err) {
      if (!isStatusError(err, 404)) throw err;
    }
  }

  private async ensureVolume(name: string): Promise<void> {
    const dockerWithVolumes = this.docker as unknown as {
      getVolume: (n: string) => { inspect: () => Promise<unknown> };
      createVolume: (opts: { Name: string }) => Promise<unknown>;
    };
    try {
      await dockerWithVolumes.getVolume(name).inspect();
    } catch (err) {
      if (!isStatusError(err, 404)) throw err;
      await dockerWithVolumes.createVolume({ Name: name });
    }
  }
}

// ---------- internal types ----------

interface DockerodeContainerInspect {
  Id: string;
  State: { Status: string; Running: boolean; StartedAt: string };
  Config?: { Image?: string };
}

function isStatusError(err: unknown, code: number): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'statusCode' in err &&
    (err as { statusCode: unknown }).statusCode === code
  );
}

// Exported for tests.
export const __FEATURES_FOR_TESTS = FEATURE_DEFINITIONS;
