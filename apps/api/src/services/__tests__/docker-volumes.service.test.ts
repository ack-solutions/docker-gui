import { describe, it, expect, vi } from 'vitest';
import type Docker from 'dockerode';
import {
  DockerVolumesService,
  countVolumeUses,
  toSummary,
} from '../docker-volumes.service.js';
import { NotFoundError } from '../../lib/errors.js';

function fakeDocker(opts: {
  listVolumes?: () => Promise<unknown>;
  listContainers?: () => Promise<unknown>;
  remove?: () => Promise<unknown>;
  prune?: () => Promise<unknown>;
} = {}): Docker {
  const volume = {
    inspect: vi.fn().mockResolvedValue({ Name: 'v' }),
    remove: opts.remove ?? vi.fn().mockResolvedValue(undefined),
  };
  return {
    listVolumes: vi.fn().mockImplementation(opts.listVolumes ?? (() => Promise.resolve({ Volumes: [] }))),
    listContainers: vi
      .fn()
      .mockImplementation(opts.listContainers ?? (() => Promise.resolve([]))),
    getVolume: vi.fn().mockReturnValue(volume),
    pruneVolumes: vi.fn().mockImplementation(opts.prune ?? (() => Promise.resolve({ VolumesDeleted: [] }))),
  } as unknown as Docker;
}

describe('countVolumeUses', () => {
  it('counts named volume mounts across containers', () => {
    const counts = countVolumeUses([
      { Mounts: [{ Type: 'volume', Name: 'data' }] },
      { Mounts: [{ Type: 'volume', Name: 'data' }, { Type: 'bind', Name: 'ignored' }] },
      { Mounts: [{ Type: 'volume', Name: 'cache' }] },
    ]);
    expect(counts.get('data')).toBe(2);
    expect(counts.get('cache')).toBe(1);
    expect(counts.size).toBe(2); // bind not counted
  });

  it('returns empty map for no containers', () => {
    expect(countVolumeUses([]).size).toBe(0);
  });

  it('handles missing Mounts gracefully', () => {
    expect(countVolumeUses([{}]).size).toBe(0);
  });
});

describe('toSummary', () => {
  it('maps a typical volume', () => {
    const s = toSummary(
      {
        Name: 'data',
        Driver: 'local',
        Mountpoint: '/var/lib/docker/volumes/data/_data',
        Scope: 'local',
        CreatedAt: '2026-01-01T00:00:00Z',
        Labels: { app: 'demo' },
        Options: { type: 'tmpfs' },
      },
      3,
    );
    expect(s.name).toBe('data');
    expect(s.inUseBy).toBe(3);
    expect(s.options).toEqual({ type: 'tmpfs' });
  });

  it('omits options when not provided', () => {
    const s = toSummary(
      { Name: 'x', Driver: 'local', Mountpoint: '/m', Scope: 'local' },
      0,
    );
    expect(s.options).toBeUndefined();
  });
});

describe('DockerVolumesService.list', () => {
  it('combines volume and container info', async () => {
    const docker = fakeDocker({
      listVolumes: () =>
        Promise.resolve({
          Volumes: [{ Name: 'data', Driver: 'local', Mountpoint: '/m', Scope: 'local' }],
        }),
      listContainers: () => Promise.resolve([{ Mounts: [{ Type: 'volume', Name: 'data' }] }]),
    });
    const svc = new DockerVolumesService(docker);
    const list = await svc.list();
    expect(list[0]?.inUseBy).toBe(1);
  });

  it('handles null Volumes (no volumes)', async () => {
    const docker = fakeDocker({
      listVolumes: () => Promise.resolve({ Volumes: null }),
    });
    const svc = new DockerVolumesService(docker);
    expect(await svc.list()).toEqual([]);
  });
});

describe('DockerVolumesService.remove', () => {
  it('maps 404 to NotFound', async () => {
    const docker = fakeDocker({
      remove: () => Promise.reject(Object.assign(new Error('nope'), { statusCode: 404 })),
    });
    const svc = new DockerVolumesService(docker);
    await expect(svc.remove('v')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('maps 409 to docker.volume_in_use', async () => {
    const docker = fakeDocker({
      remove: () => Promise.reject(Object.assign(new Error('used'), { statusCode: 409 })),
    });
    const svc = new DockerVolumesService(docker);
    await expect(svc.remove('v')).rejects.toMatchObject({ code: 'docker.volume_in_use' });
  });
});

describe('DockerVolumesService.prune', () => {
  it('returns deleted list and reclaimed bytes', async () => {
    const docker = fakeDocker({
      prune: () => Promise.resolve({ VolumesDeleted: ['x', 'y'], SpaceReclaimed: 1024 }),
    });
    const svc = new DockerVolumesService(docker);
    expect(await svc.prune()).toEqual({ deleted: ['x', 'y'], spaceReclaimed: 1024 });
  });

  it('handles null VolumesDeleted', async () => {
    const docker = fakeDocker({
      prune: () => Promise.resolve({}),
    });
    const svc = new DockerVolumesService(docker);
    expect(await svc.prune()).toEqual({ deleted: [], spaceReclaimed: 0 });
  });
});
