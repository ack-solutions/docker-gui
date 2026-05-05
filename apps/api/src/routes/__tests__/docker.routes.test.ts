import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type Docker from 'dockerode';
import type { TestEnv } from '../../__tests__/test-helpers.js';
import { buildTestEnv, TEST_SETUP_SECRET } from '../../__tests__/test-helpers.js';

const sampleContainer = {
  Id: 'abc123abc123abc123',
  Names: ['/web'],
  Image: 'nginx:latest',
  ImageID: 'sha256:abc',
  Command: 'nginx',
  State: 'running',
  Status: 'Up 5m',
  Created: 1714900000,
  Ports: [{ IP: '0.0.0.0', PrivatePort: 80, PublicPort: 8080, Type: 'tcp' }],
  Labels: {},
};

const sampleImage = {
  Id: 'sha256:imageabcdef0123',
  RepoTags: ['nginx:latest'],
  Size: 1024,
  Created: 1714900000,
};

const sampleVolume = {
  Name: 'data',
  Driver: 'local',
  Mountpoint: '/var/lib/docker/volumes/data/_data',
  Scope: 'local',
};

const sampleNetwork = {
  Id: 'netabcdef0123456789',
  Name: 'bridge',
  Driver: 'bridge',
  Scope: 'local',
  Internal: false,
};

let env: TestEnv;
const stubs = {
  containers: {
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    restart: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    inspect: vi.fn().mockResolvedValue({ Id: sampleContainer.Id }),
    logs: vi.fn().mockResolvedValue(Buffer.from('hello\n')),
  },
  image: {
    inspect: vi.fn().mockResolvedValue({ Id: sampleImage.Id }),
    remove: vi.fn().mockResolvedValue(undefined),
  },
  volume: {
    inspect: vi.fn().mockResolvedValue({ Name: sampleVolume.Name }),
    remove: vi.fn().mockResolvedValue(undefined),
  },
  network: {
    inspect: vi.fn().mockResolvedValue({ Name: sampleNetwork.Name }),
    remove: vi.fn().mockResolvedValue(undefined),
  },
};

beforeAll(async () => {
  const docker = {
    ping: () => Promise.resolve('OK'),
    version: () =>
      Promise.resolve({ Version: 'test', ApiVersion: '1.43', Os: 'linux', Arch: 'amd64' }),
    listContainers: vi.fn().mockResolvedValue([sampleContainer]),
    listImages: vi.fn().mockResolvedValue([sampleImage]),
    listVolumes: vi.fn().mockResolvedValue({ Volumes: [sampleVolume] }),
    listNetworks: vi.fn().mockResolvedValue([sampleNetwork]),
    pruneVolumes: vi.fn().mockResolvedValue({ VolumesDeleted: ['orphan'], SpaceReclaimed: 1024 }),
    pruneNetworks: vi.fn().mockResolvedValue({ NetworksDeleted: ['stale'] }),
    getContainer: vi.fn().mockReturnValue(stubs.containers),
    getImage: vi.fn().mockReturnValue(stubs.image),
    getVolume: vi.fn().mockReturnValue(stubs.volume),
    getNetwork: vi.fn().mockReturnValue(stubs.network),
  } as unknown as Docker;

  env = await buildTestEnv({ docker });

  await env.app.inject({
    method: 'POST',
    url: '/api/v1/setup/bootstrap',
    headers: { 'x-setup-secret': TEST_SETUP_SECRET, 'content-type': 'application/json' },
    payload: { email: 'admin@example.com', password: 'StrongPass1', name: 'Admin' },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(() => {
  stubs.containers.start.mockClear();
  stubs.containers.stop.mockClear();
  stubs.containers.restart.mockClear();
  stubs.containers.remove.mockClear();
  stubs.image.remove.mockClear();
  stubs.volume.remove.mockClear();
  stubs.network.remove.mockClear();
});

async function getToken(): Promise<string> {
  const res = await env.app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    headers: { 'content-type': 'application/json' },
    payload: { email: 'admin@example.com', password: 'StrongPass1' },
  });
  return res.json().data.accessToken;
}

// ---------- Containers ----------

describe('GET /api/v1/docker/containers', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await env.app.inject({ method: 'GET', url: '/api/v1/docker/containers' });
    expect(res.statusCode).toBe(401);
  });

  it('returns mapped containers when authenticated', async () => {
    const token = await getToken();
    const res = await env.app.inject({
      method: 'GET',
      url: '/api/v1/docker/containers',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const list = res.json().data;
    expect(list).toHaveLength(1);
    expect(list[0].state).toBe('running');
  });
});

describe('container actions', () => {
  it('starts/stops/restarts/removes/logs with bearer auth', async () => {
    const token = await getToken();
    const auth = { authorization: `Bearer ${token}` };

    expect((await env.app.inject({ method: 'POST', url: '/api/v1/docker/containers/abc/start', headers: auth })).statusCode).toBe(200);
    expect(stubs.containers.start).toHaveBeenCalled();

    expect((await env.app.inject({ method: 'POST', url: '/api/v1/docker/containers/abc/stop', headers: auth })).statusCode).toBe(200);
    expect(stubs.containers.stop).toHaveBeenCalled();

    expect((await env.app.inject({ method: 'POST', url: '/api/v1/docker/containers/abc/restart', headers: auth })).statusCode).toBe(200);
    expect(stubs.containers.restart).toHaveBeenCalled();

    const rm = await env.app.inject({
      method: 'DELETE',
      url: '/api/v1/docker/containers/abc?force=true&volumes=true',
      headers: auth,
    });
    expect(rm.statusCode).toBe(200);
    expect(stubs.containers.remove).toHaveBeenCalledWith({ force: true, v: true });

    const logs = await env.app.inject({
      method: 'GET',
      url: '/api/v1/docker/containers/abc/logs?tail=50',
      headers: auth,
    });
    expect(logs.statusCode).toBe(200);
    expect(logs.json().data.text).toBe('hello\n');
  });

  it('rejects logs with invalid tail', async () => {
    const token = await getToken();
    const res = await env.app.inject({
      method: 'GET',
      url: '/api/v1/docker/containers/abc/logs?tail=99999',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(400);
  });
});

// ---------- Images ----------

describe('docker images endpoints', () => {
  it('lists images', async () => {
    const token = await getToken();
    const res = await env.app.inject({
      method: 'GET',
      url: '/api/v1/docker/images',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const list = res.json().data;
    expect(list).toHaveLength(1);
    expect(list[0].repoTags).toEqual(['nginx:latest']);
  });

  it('removes an image with force', async () => {
    const token = await getToken();
    const res = await env.app.inject({
      method: 'DELETE',
      url: '/api/v1/docker/images/sha256:image?force=true',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(stubs.image.remove).toHaveBeenCalledWith({ force: true });
  });

  it('rejects pull with malformed reference', async () => {
    const token = await getToken();
    const res = await env.app.inject({
      method: 'POST',
      url: '/api/v1/docker/images/pull',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      payload: { reference: 'has spaces' },
    });
    expect(res.statusCode).toBe(400);
  });
});

// ---------- Volumes ----------

describe('docker volumes endpoints', () => {
  it('lists volumes', async () => {
    const token = await getToken();
    const res = await env.app.inject({
      method: 'GET',
      url: '/api/v1/docker/volumes',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const list = res.json().data;
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('data');
  });

  it('removes a volume', async () => {
    const token = await getToken();
    const res = await env.app.inject({
      method: 'DELETE',
      url: '/api/v1/docker/volumes/data',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(stubs.volume.remove).toHaveBeenCalled();
  });

  it('prunes volumes', async () => {
    const token = await getToken();
    const res = await env.app.inject({
      method: 'POST',
      url: '/api/v1/docker/volumes/prune',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toEqual({ deleted: ['orphan'], spaceReclaimed: 1024 });
  });
});

// ---------- Networks ----------

describe('docker networks endpoints', () => {
  it('lists networks', async () => {
    const token = await getToken();
    const res = await env.app.inject({
      method: 'GET',
      url: '/api/v1/docker/networks',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const list = res.json().data;
    expect(list).toHaveLength(1);
    expect(list[0].driver).toBe('bridge');
  });

  it('removes a network', async () => {
    const token = await getToken();
    const res = await env.app.inject({
      method: 'DELETE',
      url: '/api/v1/docker/networks/netabcdef',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(stubs.network.remove).toHaveBeenCalled();
  });

  it('prunes networks', async () => {
    const token = await getToken();
    const res = await env.app.inject({
      method: 'POST',
      url: '/api/v1/docker/networks/prune',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toEqual({ deleted: ['stale'] });
  });
});
