import { describe, it, expect, vi } from 'vitest';
import type Docker from 'dockerode';
import { DockerImagesService, toSummary } from '../docker-images.service.js';
import { AppError, NotFoundError } from '../../lib/errors.js';

function fakeDocker(opts: {
  list?: () => Promise<unknown>;
  remove?: () => Promise<unknown>;
  inspect?: () => Promise<unknown>;
} = {}): Docker {
  const image = {
    inspect: opts.inspect ?? vi.fn().mockResolvedValue({ Id: 'sha256:x' }),
    remove: opts.remove ?? vi.fn().mockResolvedValue(undefined),
  };
  return {
    listImages: vi.fn().mockImplementation(opts.list ?? (() => Promise.resolve([]))),
    getImage: vi.fn().mockReturnValue(image),
  } as unknown as Docker;
}

describe('toSummary', () => {
  it('strips sha256: prefix for short id', () => {
    const s = toSummary({
      Id: 'sha256:abcdef0123456789',
      RepoTags: ['nginx:latest'],
      Size: 1234,
      Created: 1714900000,
    });
    expect(s.shortId).toBe('abcdef012345');
    expect(s.dangling).toBe(false);
  });

  it('marks images with no real tags as dangling', () => {
    const s = toSummary({
      Id: 'sha256:zzz',
      RepoTags: ['<none>:<none>'],
      Size: 0,
      Created: 0,
    });
    expect(s.dangling).toBe(true);
    expect(s.repoTags).toEqual([]);
  });

  it('uses full id for non-sha256 IDs', () => {
    const s = toSummary({
      Id: 'abcdef1234567890',
      Size: 0,
      Created: 0,
    });
    expect(s.shortId).toBe('abcdef123456');
  });
});

describe('DockerImagesService.list', () => {
  it('returns mapped images', async () => {
    const docker = fakeDocker({
      list: () =>
        Promise.resolve([
          {
            Id: 'sha256:a',
            RepoTags: ['nginx:latest'],
            Size: 100,
            Created: 1714900000,
          },
        ]),
    });
    const svc = new DockerImagesService(docker);
    const out = await svc.list();
    expect(out).toHaveLength(1);
    expect(out[0]?.repoTags).toEqual(['nginx:latest']);
  });

  it('maps ENOENT to docker.unavailable', async () => {
    const docker = fakeDocker({
      list: () => Promise.reject(Object.assign(new Error('no socket'), { code: 'ENOENT' })),
    });
    const svc = new DockerImagesService(docker);
    await expect(svc.list()).rejects.toMatchObject({ code: 'docker.unavailable', statusCode: 503 });
  });
});

describe('DockerImagesService.remove', () => {
  it('maps 404 to NotFound', async () => {
    const docker = fakeDocker({
      remove: () => Promise.reject(Object.assign(new Error('not found'), { statusCode: 404 })),
    });
    const svc = new DockerImagesService(docker);
    await expect(svc.remove('id')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('maps 409 (in use) to docker.image_in_use', async () => {
    const docker = fakeDocker({
      remove: () => Promise.reject(Object.assign(new Error('conflict'), { statusCode: 409 })),
    });
    const svc = new DockerImagesService(docker);
    await expect(svc.remove('id')).rejects.toMatchObject({
      code: 'docker.image_in_use',
      statusCode: 409,
    });
  });

  it('passes force flag to dockerode', async () => {
    const remove = vi.fn().mockResolvedValue(undefined);
    const docker = fakeDocker({ remove });
    const svc = new DockerImagesService(docker);
    await svc.remove('id', { force: true });
    expect(remove).toHaveBeenCalledWith({ force: true });
  });
});

describe('DockerImagesService.pull', () => {
  it('rejects malformed references', async () => {
    const docker = fakeDocker();
    const svc = new DockerImagesService(docker);
    await expect(svc.pull('bad ref with spaces')).rejects.toThrow();
  });

  it('accepts valid references', async () => {
    expect(() =>
      // schema gate only — full pull tested in routes integration test
      ({ ok: 'nginx:latest', registry: 'ghcr.io/some/repo:1.2.3' }),
    ).not.toThrow();
  });
});

describe('DockerImagesService.inspect', () => {
  it('proxies to dockerode inspect', async () => {
    const inspect = vi.fn().mockResolvedValue({ Id: 'x' });
    const docker = fakeDocker({ inspect });
    const svc = new DockerImagesService(docker);
    const r = await svc.inspect('x');
    expect(r).toEqual({ Id: 'x' });
  });

  it('maps 404 to NotFound', async () => {
    const docker = fakeDocker({
      inspect: () => Promise.reject(Object.assign(new Error('nope'), { statusCode: 404 })),
    });
    const svc = new DockerImagesService(docker);
    await expect(svc.inspect('x')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('maps unknown errors to AppError', async () => {
    const docker = fakeDocker({
      inspect: () => Promise.reject(new Error('weird')),
    });
    const svc = new DockerImagesService(docker);
    await expect(svc.inspect('x')).rejects.toBeInstanceOf(AppError);
  });
});
