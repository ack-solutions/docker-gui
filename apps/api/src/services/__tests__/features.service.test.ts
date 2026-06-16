import { describe, it, expect, vi, beforeEach } from 'vitest';
import type Docker from 'dockerode';
import { FeaturesService } from '../features.service.js';
import { AppError, NotFoundError } from '../../lib/errors.js';

interface MockedDocker {
  getContainer: ReturnType<typeof vi.fn>;
  getVolume: ReturnType<typeof vi.fn>;
  createContainer: ReturnType<typeof vi.fn>;
  createVolume: ReturnType<typeof vi.fn>;
}

function makeDocker(handlers: {
  containerExists?: boolean;
  containerRunning?: boolean;
  volumeExists?: boolean;
  inspectError?: { statusCode?: number };
  startThrows?: Error;
} = {}): MockedDocker {
  const container = {
    inspect: vi.fn().mockImplementation(async () => {
      if (handlers.inspectError) {
        const err = Object.assign(new Error('inspect'), handlers.inspectError);
        throw err;
      }
      if (!handlers.containerExists) {
        const err = Object.assign(new Error('no such'), { statusCode: 404 });
        throw err;
      }
      return {
        Id: 'abc1234567890def',
        State: {
          Status: handlers.containerRunning ? 'running' : 'exited',
          Running: !!handlers.containerRunning,
          StartedAt: '2026-05-05T00:00:00Z',
        },
        Config: { Image: 'caddy:2-alpine' },
      };
    }),
    stop: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    start: vi.fn().mockImplementation(async () => {
      if (handlers.startThrows) throw handlers.startThrows;
    }),
  };

  const volume = {
    inspect: vi.fn().mockImplementation(async () => {
      if (!handlers.volumeExists) {
        const err = Object.assign(new Error('no such'), { statusCode: 404 });
        throw err;
      }
      return { Name: 'vol' };
    }),
  };

  return {
    getContainer: vi.fn().mockReturnValue(container),
    getVolume: vi.fn().mockReturnValue(volume),
    createContainer: vi.fn().mockResolvedValue(container),
    createVolume: vi.fn().mockResolvedValue({ Name: 'vol' }),
  };
}

function buildSvc(docker: MockedDocker): FeaturesService {
  return new FeaturesService(docker as unknown as Docker, {
    network: 'docker-gui_dgui',
    hostInstallDir: '/opt/docker-gui',
  });
}

describe('FeaturesService.list', () => {
  it('returns all known features', async () => {
    const docker = makeDocker();
    const svc = buildSvc(docker);
    const list = await svc.list();
    expect(list.map((f) => f.key).sort()).toEqual(
      ['caddy', 'email', 'minio', 'postgres-gui', 'registry'].sort(),
    );
  });

  it('flags email as coming-soon (MinIO + pgweb are now implemented)', async () => {
    const docker = makeDocker();
    const svc = buildSvc(docker);
    const list = await svc.list();
    expect(list.find((f) => f.key === 'email')?.comingSoon).toBe(true);
    expect(list.find((f) => f.key === 'minio')?.comingSoon).toBe(false);
    expect(list.find((f) => f.key === 'postgres-gui')?.comingSoon).toBe(false);
  });

  it('postgres-gui is implemented (NOT coming-soon) and reports a real status', async () => {
    const docker = makeDocker({ containerExists: false });
    const svc = buildSvc(docker);
    const pgweb = (await svc.list()).find((f) => f.key === 'postgres-gui');
    expect(pgweb).toBeTruthy();
    expect(pgweb?.comingSoon).toBe(false);
    expect(pgweb?.status).toBe('stopped');
    expect(pgweb?.category).toBe('database');
  });

  it('registry is implemented (NOT coming-soon) and reports a real status', async () => {
    const docker = makeDocker({ containerExists: false });
    const svc = buildSvc(docker);
    const list = await svc.list();
    const registry = list.find((f) => f.key === 'registry');
    expect(registry).toBeTruthy();
    expect(registry?.comingSoon).toBe(false);
    expect(registry?.status).toBe('stopped');
    expect(registry?.category).toBe('registry');
    expect(registry?.ports).toContain(5000);
  });

  it('returns caddy as "stopped" when no container exists', async () => {
    const docker = makeDocker({ containerExists: false });
    const svc = buildSvc(docker);
    const list = await svc.list();
    expect(list.find((f) => f.key === 'caddy')?.status).toBe('stopped');
  });

  it('returns caddy as "running" when its container is up', async () => {
    const docker = makeDocker({ containerExists: true, containerRunning: true });
    const svc = buildSvc(docker);
    const caddy = (await svc.list()).find((f) => f.key === 'caddy');
    expect(caddy?.status).toBe('running');
    expect(caddy?.details?.containerId).toBe('abc123456789');
    expect(caddy?.details?.image).toBe('caddy:2-alpine');
  });
});

describe('FeaturesService.get', () => {
  it('throws NotFoundError for an unknown feature', async () => {
    const docker = makeDocker();
    const svc = buildSvc(docker);
    await expect(
      svc.get('does-not-exist' as never),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('FeaturesService.enable', () => {
  let docker: MockedDocker;

  beforeEach(() => {
    docker = makeDocker({ containerExists: false, volumeExists: false });
  });

  it('creates volumes that do not yet exist', async () => {
    const svc = buildSvc(docker);
    await svc.enable('caddy');
    expect(docker.createVolume).toHaveBeenCalledWith({ Name: 'docker-gui_caddy-data' });
    expect(docker.createVolume).toHaveBeenCalledWith({ Name: 'docker-gui_caddy-config' });
  });

  it('skips creating volumes that already exist', async () => {
    docker = makeDocker({ containerExists: false, volumeExists: true });
    const svc = buildSvc(docker);
    await svc.enable('caddy');
    expect(docker.createVolume).not.toHaveBeenCalled();
  });

  it('creates the caddy container with the right image, ports, and binds', async () => {
    const svc = buildSvc(docker);
    await svc.enable('caddy');
    expect(docker.createContainer).toHaveBeenCalledTimes(1);
    const spec = docker.createContainer.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(spec).toMatchObject({
      name: 'docker-gui-caddy',
      Image: 'caddy:2-alpine',
    });
    expect((spec.HostConfig as Record<string, unknown>).PortBindings).toMatchObject({
      '80/tcp': [{ HostPort: '80' }],
      '443/tcp': [{ HostPort: '443' }],
    });
    expect((spec.HostConfig as Record<string, unknown>).Binds).toContain(
      'docker-gui_caddy-data:/data',
    );
    expect((spec.HostConfig as Record<string, unknown>).Binds).toContain(
      '/opt/docker-gui/caddy/initial.json:/etc/caddy/initial.json:ro',
    );
    expect((spec.HostConfig as Record<string, unknown>).NetworkMode).toBe('docker-gui_dgui');
  });

  it('refuses to enable a coming-soon feature with a clear error', async () => {
    const svc = buildSvc(docker);
    await expect(svc.enable('email')).rejects.toMatchObject({
      code: 'feature.coming_soon',
      statusCode: 400,
    });
  });

  it('launches MinIO with generated root credentials (not the default)', async () => {
    const svc = buildSvc(docker);
    await svc.enable('minio');
    const spec = docker.createContainer.mock.calls[0]?.[0] as { Image: string; Env: string[] };
    expect(spec.Image).toBe('minio/minio:latest');
    const user = spec.Env.find((e) => e.startsWith('MINIO_ROOT_USER='));
    const pass = spec.Env.find((e) => e.startsWith('MINIO_ROOT_PASSWORD='));
    expect(user).toMatch(/^MINIO_ROOT_USER=dgui-[0-9a-f]{12}$/);
    expect(pass).toBeDefined();
    expect(pass).not.toBe('MINIO_ROOT_PASSWORD=minioadmin');
  });

  it('creates the pgweb container on the network with no host port binding', async () => {
    const svc = buildSvc(docker);
    await svc.enable('postgres-gui');
    const spec = docker.createContainer.mock.calls[0]?.[0] as {
      Image: string;
      ExposedPorts: Record<string, unknown>;
      HostConfig: { PortBindings?: unknown; NetworkMode?: string };
    };
    expect(spec.Image).toBe('sosedoff/pgweb:latest');
    expect(spec.HostConfig.NetworkMode).toBe('docker-gui_dgui');
    expect(spec.HostConfig.PortBindings).toBeUndefined();
    expect(spec.ExposedPorts).toHaveProperty('8081/tcp');
  });

  it('auto-registers a "Local MinIO" S3 connection with sealed credentials', async () => {
    const create = vi.fn().mockResolvedValue({});
    const fakePrisma = {
      s3Connection: { findUnique: vi.fn().mockResolvedValue(null), create, update: vi.fn() },
    };
    const cryptoBox = { seal: (s: string) => `sealed:${s}`, open: (s: string) => s };
    const svc = new FeaturesService(docker as unknown as Docker, {
      network: 'docker-gui_dgui',
      hostInstallDir: '/opt/docker-gui',
      prisma: fakePrisma as never,
      cryptoBox: cryptoBox as never,
    });
    await svc.enable('minio');
    expect(create).toHaveBeenCalledTimes(1);
    const data = create.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data).toMatchObject({
      name: 'Local MinIO',
      endpoint: 'http://docker-gui-minio:9000',
      flavor: 'minio',
      pathStyle: true,
    });
    expect(String(data.secretKeyCipher)).toMatch(/^sealed:/);
    expect(String(data.accessKey)).toMatch(/^dgui-/);
  });

  it('records the error and throws when start() fails', async () => {
    docker = makeDocker({
      containerExists: false,
      volumeExists: true,
      startThrows: new Error('port 80 already in use'),
    });
    const svc = buildSvc(docker);
    await expect(svc.enable('caddy')).rejects.toBeInstanceOf(AppError);
    const view = await svc.get('caddy');
    expect(view.details?.lastError).toContain('port 80 already in use');
  });
});

describe('FeaturesService.disable', () => {
  it('stops + removes a running container, leaves volumes alone', async () => {
    const docker = makeDocker({ containerExists: true, containerRunning: true });
    const svc = buildSvc(docker);
    await svc.disable('caddy');
    const container = docker.getContainer.mock.results[0]?.value;
    expect(container.stop).toHaveBeenCalled();
    expect(container.remove).toHaveBeenCalledWith({ force: true });
    // Volumes are not touched
    expect(docker.createVolume).not.toHaveBeenCalled();
  });

  it('is idempotent when no container exists', async () => {
    const docker = makeDocker({ containerExists: false });
    const svc = buildSvc(docker);
    await expect(svc.disable('caddy')).resolves.toBeDefined();
  });
});
