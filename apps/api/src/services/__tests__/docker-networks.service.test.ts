import { describe, it, expect, vi } from 'vitest';
import type Docker from 'dockerode';
import { DockerNetworksService, toSummary } from '../docker-networks.service.js';
import { AppError, NotFoundError } from '../../lib/errors.js';

function fakeDocker(opts: {
  list?: () => Promise<unknown>;
  remove?: () => Promise<unknown>;
  prune?: () => Promise<unknown>;
} = {}): Docker {
  const network = {
    inspect: vi.fn().mockResolvedValue({ Name: 'n' }),
    remove: opts.remove ?? vi.fn().mockResolvedValue(undefined),
  };
  return {
    listNetworks: vi.fn().mockImplementation(opts.list ?? (() => Promise.resolve([]))),
    getNetwork: vi.fn().mockReturnValue(network),
    pruneNetworks: vi.fn().mockImplementation(opts.prune ?? (() => Promise.resolve({ NetworksDeleted: [] }))),
  } as unknown as Docker;
}

describe('toSummary', () => {
  it('extracts subnets and counts containers', () => {
    const s = toSummary({
      Id: 'abcdef0123456789',
      Name: 'my-net',
      Driver: 'bridge',
      Scope: 'local',
      Internal: false,
      IPAM: { Driver: 'default', Config: [{ Subnet: '172.20.0.0/16' }] },
      Containers: { 'c1': {}, 'c2': {} },
    });
    expect(s.shortId).toBe('abcdef012345');
    expect(s.containerCount).toBe(2);
    expect(s.ipam?.subnets).toEqual(['172.20.0.0/16']);
  });

  it('omits ipam when no driver and no subnets', () => {
    const s = toSummary({
      Id: 'a',
      Name: 'n',
      Driver: 'host',
      Scope: 'local',
      Internal: false,
    });
    expect(s.ipam).toBeUndefined();
    expect(s.containerCount).toBe(0);
  });

  it('handles null Containers map', () => {
    const s = toSummary({
      Id: 'a',
      Name: 'n',
      Driver: 'bridge',
      Scope: 'local',
      Internal: false,
      Containers: null,
    });
    expect(s.containerCount).toBe(0);
  });
});

describe('DockerNetworksService.list', () => {
  it('returns mapped networks', async () => {
    const docker = fakeDocker({
      list: () =>
        Promise.resolve([
          { Id: 'a', Name: 'bridge', Driver: 'bridge', Scope: 'local', Internal: false },
        ]),
    });
    const svc = new DockerNetworksService(docker);
    const list = await svc.list();
    expect(list).toHaveLength(1);
    expect(list[0]?.driver).toBe('bridge');
  });

  it('maps ENOENT to docker.unavailable', async () => {
    const docker = fakeDocker({
      list: () => Promise.reject(Object.assign(new Error('no socket'), { code: 'ENOENT' })),
    });
    const svc = new DockerNetworksService(docker);
    await expect(svc.list()).rejects.toMatchObject({ code: 'docker.unavailable' });
  });
});

describe('DockerNetworksService.remove', () => {
  it('maps 404 to NotFound', async () => {
    const docker = fakeDocker({
      remove: () => Promise.reject(Object.assign(new Error('nope'), { statusCode: 404 })),
    });
    const svc = new DockerNetworksService(docker);
    await expect(svc.remove('x')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('maps 403 (predefined networks) to docker.network_predefined', async () => {
    const docker = fakeDocker({
      remove: () => Promise.reject(Object.assign(new Error('predefined'), { statusCode: 403 })),
    });
    const svc = new DockerNetworksService(docker);
    await expect(svc.remove('bridge')).rejects.toMatchObject({
      code: 'docker.network_predefined',
      statusCode: 403,
    });
  });

  it('maps generic errors to AppError', async () => {
    const docker = fakeDocker({
      remove: () => Promise.reject(new Error('boom')),
    });
    const svc = new DockerNetworksService(docker);
    await expect(svc.remove('x')).rejects.toBeInstanceOf(AppError);
  });
});

describe('DockerNetworksService.prune', () => {
  it('returns deleted networks list', async () => {
    const docker = fakeDocker({
      prune: () => Promise.resolve({ NetworksDeleted: ['old-net'] }),
    });
    const svc = new DockerNetworksService(docker);
    expect(await svc.prune()).toEqual({ deleted: ['old-net'] });
  });
});
