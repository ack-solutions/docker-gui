import { randomBytes } from 'node:crypto';
import type Docker from 'dockerode';
import type { PrismaClient } from '@prisma/client';
import { AppError, NotFoundError } from '../lib/errors.js';
import type { CryptoBox } from '../lib/crypto-box.js';
import { isPublicIpv4 } from './public-ip.service.js';
import type { DnsRecordInput } from '../lib/dns/types.js';

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
  /** Per-enable generated secrets (e.g. MinIO root creds). */
  secrets?: Record<string, string>;
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
      'S3-compatible object storage. Enabling it launches MinIO on the internal network and auto-registers a "Local MinIO" connection on the Storage page (with generated root credentials). To reach the S3 API or console from a browser, front it with a Site (reverse proxy).',
    ports: [],
    containerName: 'docker-gui-minio',
    volumes: [`${PROJECT}_minio-data`],
    configHref: '/storage',
    build: ({ network, secrets }) => ({
      name: 'docker-gui-minio',
      Image: 'minio/minio:latest',
      Cmd: ['server', '/data', '--console-address', ':9001'],
      Env: [
        `MINIO_ROOT_USER=${secrets?.['accessKey'] ?? 'minioadmin'}`,
        `MINIO_ROOT_PASSWORD=${secrets?.['secretKey'] ?? 'minioadmin'}`,
      ],
      Labels: {
        'docker-gui.managed-by': 'features-service',
        'docker-gui.feature': 'minio',
      },
      ExposedPorts: { '9000/tcp': {}, '9001/tcp': {} },
      HostConfig: {
        RestartPolicy: { Name: 'unless-stopped' },
        // No host port bindings — the panel reaches MinIO over the docker
        // network (docker-gui-minio:9000), avoiding host port conflicts.
        // Front with the reverse proxy for external/browser access.
        Binds: [`${PROJECT}_minio-data:/data`],
        NetworkMode: network,
      },
    }),
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
      'Browser-based Postgres explorer (pgweb). Runs on the internal network with no exposed host port — front it with a Site (reverse proxy + auth), then paste a connection string for any reachable Postgres, including your Docker-native databases. Stores nothing server-side.',
    ports: [],
    containerName: 'docker-gui-pgweb',
    volumes: [],
    build: ({ network }) => ({
      name: 'docker-gui-pgweb',
      Image: 'sosedoff/pgweb:latest',
      // pgweb binds 127.0.0.1 by default — bind all interfaces so the reverse
      // proxy on the docker network can reach it. No DB URL is baked in; the
      // user enters a connection string in pgweb's own UI (stateless).
      Cmd: ['pgweb', '--bind=0.0.0.0', '--listen=8081'],
      Labels: {
        'docker-gui.managed-by': 'features-service',
        'docker-gui.feature': 'postgres-gui',
      },
      ExposedPorts: { '8081/tcp': {} },
      HostConfig: {
        RestartPolicy: { Name: 'unless-stopped' },
        // No host port binding — reached over the docker network as
        // docker-gui-pgweb:8081. Front with a Site for browser access.
        NetworkMode: network,
      },
    }),
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
  /** Used to auto-register the "Local MinIO" S3 connection on enable. */
  prisma?: PrismaClient;
  cryptoBox?: CryptoBox;
  /** This server's public IPv4 — drives the email prerequisites checklist. */
  getPublicIp?: () => string | undefined;
}

/** One auto-determined prerequisite for hosting email. */
export interface EmailChecklistItem {
  label: string;
  met: boolean;
  detail: string;
}

/** Prerequisites report for the (deliberately gated) on-prem email feature. */
export interface EmailPreconditions {
  /** All auto-checkable hard requirements are satisfied. */
  ready: boolean;
  domain: string | null;
  /** This server's detected public IPv4, or null. */
  publicIp: string | null;
  /** Hard blockers (no public IP, no domain). */
  blockers: string[];
  /** Auto-determined prerequisites. */
  checklist: EmailChecklistItem[];
  /** Steps the operator must verify themselves (can't be auto-checked). */
  manualSteps: string[];
  /** DNS records to create (DKIM is a placeholder until first start). */
  dnsRecords: DnsRecordInput[];
  dkimNote: string;
  /** Honest explanation of why this isn't one-click. */
  why: string;
}

/** Host ports a mail server must own (and which clouds/ISPs often block). */
const EMAIL_PORTS = [25, 465, 587, 143, 993];

/** The MX/SPF/DMARC records (plus a DKIM placeholder) a mail domain needs. */
function buildEmailDnsRecords(domain: string): DnsRecordInput[] {
  const mailHost = `mail.${domain}`;
  return [
    // Mail exchanger → this server's mail host.
    { type: 'MX', name: '@', value: mailHost, priority: 10, ttl: 3600 },
    // The mail host's A record is created when you set up the Site / DNS for it.
    // SPF: only this server's MX may send for the domain.
    { type: 'TXT', name: '@', value: 'v=spf1 mx -all', ttl: 3600 },
    // DMARC: quarantine failures, mailto report address on the same domain.
    { type: 'TXT', name: '_dmarc', value: `v=DMARC1; p=quarantine; rua=mailto:postmaster@${domain}`, ttl: 3600 },
    // DKIM placeholder — replace <generated> after the server creates the key.
    { type: 'TXT', name: 'mail._domainkey', value: 'v=DKIM1; k=rsa; p=<generated-after-first-start>', ttl: 3600 },
  ];
}

const MINIO_CONNECTION_NAME = 'Local MinIO';
const MINIO_ENDPOINT = 'http://docker-gui-minio:9000';

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
   * Prerequisites for hosting on-prem email. On a single box behind NAT this is
   * NOT a one-click feature: it needs a static public IP, open inbound ports
   * (esp. :25, which most clouds/ISPs block), valid reverse DNS (PTR), a real
   * domain, and MX/SPF/DKIM/DMARC records. Rather than ship a mail server that
   * silently can't deliver, we surface exactly what's required. Pure function:
   * only reads the injected public-IP seam.
   */
  emailPreconditions(domain: string | null): EmailPreconditions {
    const rawIp = this.opts.getPublicIp?.();
    const publicIp = rawIp && isPublicIpv4(rawIp) ? rawIp : null;
    const dom = domain && domain.trim().length > 0 ? domain.trim().toLowerCase() : null;

    const blockers: string[] = [];
    if (!publicIp) {
      blockers.push('No public IPv4 detected — a mail server needs a static, routable public IP.');
    }
    if (!dom) {
      blockers.push('No domain supplied — provide the domain you will send/receive mail for.');
    }

    const checklist: EmailChecklistItem[] = [
      {
        label: 'Static public IPv4',
        met: !!publicIp,
        detail: publicIp ?? 'not detected (set SYSTEM_PUBLIC_IP or run on a box with a public IP)',
      },
      {
        label: 'Mail domain provided',
        met: !!dom,
        detail: dom ?? 'pass ?domain=example.com',
      },
    ];

    const manualSteps = [
      `Open inbound ports ${EMAIL_PORTS.join(', ')} to this server. Port 25 is blocked by most clouds and residential ISPs — confirm yours allows it.`,
      `Set reverse DNS (PTR) for ${publicIp ?? 'your public IP'} to mail.${dom ?? 'example.com'} at your hosting/IP provider — this cannot be set via Cloudflare/Route 53.`,
      'After the mail server first starts it generates a DKIM key — add the DKIM TXT record then (shown below as a placeholder until then).',
    ];

    const dnsRecords = dom ? buildEmailDnsRecords(dom) : [];

    return {
      ready: blockers.length === 0,
      domain: dom,
      publicIp,
      blockers,
      checklist,
      manualSteps,
      dnsRecords,
      dkimNote:
        'DKIM: the public key only exists after the mail server runs once. Generate it then and publish a TXT record at mail._domainkey — the row below is a placeholder.',
      why:
        'Running your own mail server on a single box is operationally heavy and often impossible behind NAT or on hosts that block port 25. docker-gui surfaces the exact prerequisites instead of launching a server that silently fails to deliver.',
    };
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

      // MinIO needs root credentials: generate them, launch with them, then
      // register a Storage connection so the Storage page works immediately.
      const secrets = key === 'minio' ? this.generateMinioSecrets() : undefined;

      const spec = def.build({
        network: this.opts.network,
        hostInstallDir: this.opts.hostInstallDir,
        ...(secrets ? { secrets } : {}),
      });
      const created = await this.createWithPull(spec);
      await created.start();

      if (key === 'minio' && secrets) {
        // Best-effort: a failure here shouldn't undo a running MinIO.
        await this.registerMinioConnection(secrets).catch((e: unknown) =>
          this.errors.set(key, `MinIO started, but registering the Storage connection failed: ${String(e)}`),
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to enable feature';
      this.errors.set(key, message);
      throw new AppError('feature.enable_failed', message, 500);
    }
    return this.toView(def);
  }

  /** createContainer, pulling the image first if it isn't present locally
   *  (dockerode's createContainer never auto-pulls). Keeps already-local
   *  images network-free. */
  private async createWithPull(
    spec: DockerCreateContainerOpts,
  ): Promise<{ start: () => Promise<void> }> {
    const create = () =>
      (
        this.docker as unknown as {
          createContainer: (s: DockerCreateContainerOpts) => Promise<{ start: () => Promise<void> }>;
        }
      ).createContainer(spec);
    try {
      return await create();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!/no such image/i.test(msg)) throw err;
      await this.pullImage(spec.Image);
      return create();
    }
  }

  private pullImage(image: string): Promise<void> {
    const docker = this.docker as unknown as {
      pull: (img: string, cb: (err: Error | null, stream?: NodeJS.ReadableStream) => void) => void;
      modem: { followProgress: (s: NodeJS.ReadableStream, done: (e: Error | null) => void) => void };
    };
    return new Promise((resolve, reject) => {
      docker.pull(image, (err, stream) => {
        if (err || !stream) return reject(err ?? new Error(`Could not pull ${image}`));
        docker.modem.followProgress(stream, (e) => (e ? reject(e) : resolve()));
      });
    });
  }

  private generateMinioSecrets(): { accessKey: string; secretKey: string } {
    return {
      accessKey: `dgui-${randomBytes(6).toString('hex')}`,
      secretKey: randomBytes(24).toString('base64url'),
    };
  }

  /** Upsert the managed "Local MinIO" S3 connection with the launch creds, so
   *  Storage works out of the box. No-op if persistence wasn't wired in. */
  private async registerMinioConnection(secrets: { accessKey: string; secretKey: string }): Promise<void> {
    const { prisma, cryptoBox } = this.opts;
    if (!prisma || !cryptoBox) return;
    const secretKeyCipher = cryptoBox.seal(secrets.secretKey);
    const existing = await prisma.s3Connection.findUnique({ where: { name: MINIO_CONNECTION_NAME } });
    const data = {
      endpoint: MINIO_ENDPOINT,
      region: 'us-east-1',
      flavor: 'minio',
      pathStyle: true,
      accessKey: secrets.accessKey,
      secretKeyCipher,
      verified: false,
      lastError: null,
    };
    if (existing) {
      await prisma.s3Connection.update({ where: { id: existing.id }, data });
    } else {
      await prisma.s3Connection.create({ data: { name: MINIO_CONNECTION_NAME, ...data } });
    }
    // Claim default only when no connection is the default yet — never steal it
    // from an operator-chosen one (idempotent across re-enables).
    const hasDefault = await prisma.s3Connection.findFirst({ where: { isDefault: true } });
    if (!hasDefault) {
      await prisma.s3Connection.update({
        where: { name: MINIO_CONNECTION_NAME },
        data: { isDefault: true },
      });
    }
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
