import { describe, it, expect, vi } from 'vitest';
import type Docker from 'dockerode';
import {
  DockerContainersService,
  LogStreamDemuxer,
  toSummary,
  demuxLogs,
} from '../docker-containers.service.js';
import { AppError, NotFoundError } from '../../lib/errors.js';

interface ContainerStub {
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  restart: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
  inspect: ReturnType<typeof vi.fn>;
  logs: ReturnType<typeof vi.fn>;
}

function fakeDocker(stub: Partial<ContainerStub> = {}, listResponse: unknown[] = []): Docker {
  const container: ContainerStub = {
    start: stub.start ?? vi.fn().mockResolvedValue(undefined),
    stop: stub.stop ?? vi.fn().mockResolvedValue(undefined),
    restart: stub.restart ?? vi.fn().mockResolvedValue(undefined),
    remove: stub.remove ?? vi.fn().mockResolvedValue(undefined),
    inspect: stub.inspect ?? vi.fn().mockResolvedValue({ Id: 'x', State: { Running: true } }),
    logs: stub.logs ?? vi.fn().mockResolvedValue(Buffer.from('hello\n')),
  };
  return {
    listContainers: vi.fn().mockResolvedValue(listResponse),
    getContainer: vi.fn().mockReturnValue(container),
  } as unknown as Docker;
}

describe('toSummary', () => {
  it('maps a typical container info', () => {
    const s = toSummary({
      Id: 'abcdef1234567890',
      Names: ['/web-1'],
      Image: 'nginx:latest',
      ImageID: 'sha256:xyz',
      Command: 'nginx -g daemon off;',
      State: 'RUNNING',
      Status: 'Up 5 minutes',
      Created: 1714900000,
      Ports: [{ IP: '0.0.0.0', PrivatePort: 80, PublicPort: 8080, Type: 'tcp' }],
      Labels: { 'com.docker.compose.project': 'demo' },
    });
    expect(s.id).toBe('abcdef1234567890');
    expect(s.shortId).toBe('abcdef123456');
    expect(s.names).toEqual(['web-1']);
    expect(s.state).toBe('running');
    expect(s.ports[0]?.publicPort).toBe(8080);
    expect(s.labels['com.docker.compose.project']).toBe('demo');
    expect(s.createdAt).toMatch(/^\d{4}-/);
  });

  it('falls back to "unknown" for unrecognized state', () => {
    const s = toSummary({
      Id: 'a',
      Image: 'x',
      ImageID: 'y',
      Command: '',
      State: 'flummoxed',
      Status: '?',
      Created: 0,
    });
    expect(s.state).toBe('unknown');
  });
});

describe('demuxLogs', () => {
  it('handles plain TTY text', () => {
    expect(demuxLogs(Buffer.from('hello\n'))).toBe('hello\n');
  });

  it('demuxes multiplexed stream format', () => {
    // header: [1 (stdout), 0,0,0, size BE 5], then "hello"
    const header = Buffer.from([1, 0, 0, 0, 0, 0, 0, 5]);
    const payload = Buffer.from('hello');
    const buf = Buffer.concat([header, payload]);
    expect(demuxLogs(buf)).toBe('hello');
  });

  it('handles empty buffer', () => {
    expect(demuxLogs(Buffer.alloc(0))).toBe('');
  });
});

describe('DockerContainersService.list', () => {
  it('returns mapped summaries', async () => {
    const docker = fakeDocker({}, [
      {
        Id: 'a',
        Names: ['/n'],
        Image: 'i',
        ImageID: 'iid',
        Command: 'c',
        State: 'running',
        Status: 'Up',
        Created: 1714900000,
      },
    ]);
    const svc = new DockerContainersService(docker);
    const list = await svc.list();
    expect(list).toHaveLength(1);
    expect(list[0]?.state).toBe('running');
  });

  it('maps ENOENT to docker.unavailable', async () => {
    const docker = {
      listContainers: vi.fn().mockRejectedValue(Object.assign(new Error('no socket'), { code: 'ENOENT' })),
    } as unknown as Docker;
    const svc = new DockerContainersService(docker);
    await expect(svc.list()).rejects.toMatchObject({ code: 'docker.unavailable', statusCode: 503 });
  });
});

describe('DockerContainersService.start', () => {
  it('treats 304 (already started) as success', async () => {
    const docker = fakeDocker({
      start: vi.fn().mockRejectedValue(Object.assign(new Error('not modified'), { statusCode: 304 })),
    });
    const svc = new DockerContainersService(docker);
    await expect(svc.start('id')).resolves.toBeUndefined();
  });

  it('maps 404 to NotFound', async () => {
    const docker = fakeDocker({
      start: vi.fn().mockRejectedValue(Object.assign(new Error('no such'), { statusCode: 404 })),
    });
    const svc = new DockerContainersService(docker);
    await expect(svc.start('id')).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('DockerContainersService.stop', () => {
  it('treats 304 (already stopped) as success', async () => {
    const docker = fakeDocker({
      stop: vi.fn().mockRejectedValue(Object.assign(new Error('not modified'), { statusCode: 304 })),
    });
    const svc = new DockerContainersService(docker);
    await expect(svc.stop('id')).resolves.toBeUndefined();
  });
});

describe('DockerContainersService.remove', () => {
  it('passes force/volumes flags through', async () => {
    const remove = vi.fn().mockResolvedValue(undefined);
    const docker = fakeDocker({ remove });
    const svc = new DockerContainersService(docker);
    await svc.remove('id', { force: true, removeVolumes: true });
    expect(remove).toHaveBeenCalledWith({ force: true, v: true });
  });
});

describe('DockerContainersService.logs', () => {
  it('returns demuxed log text', async () => {
    const docker = fakeDocker({
      logs: vi.fn().mockResolvedValue(Buffer.from('line1\nline2\n')),
    });
    const svc = new DockerContainersService(docker);
    const text = await svc.logs('id', { tail: 100 });
    expect(text).toBe('line1\nline2\n');
  });

  it('maps generic errors to AppError', async () => {
    const docker = fakeDocker({
      logs: vi.fn().mockRejectedValue(Object.assign(new Error('boom'), { statusCode: 500 })),
    });
    const svc = new DockerContainersService(docker);
    await expect(svc.logs('id')).rejects.toBeInstanceOf(AppError);
  });
});

function frame(stream: 0 | 1 | 2, payload: string): Buffer {
  const data = Buffer.from(payload, 'utf-8');
  const header = Buffer.alloc(8);
  header.writeUInt8(stream, 0);
  header.writeUInt32BE(data.length, 4);
  return Buffer.concat([header, data]);
}

describe('LogStreamDemuxer', () => {
  it('demultiplexes stdout and stderr frames', () => {
    const out: Array<[string, string]> = [];
    const d = new LogStreamDemuxer();
    d.feed(frame(1, 'hello'), (k, t) => out.push([k, t]));
    d.feed(frame(2, 'oops'), (k, t) => out.push([k, t]));
    expect(out).toEqual([
      ['stdout', 'hello'],
      ['stderr', 'oops'],
    ]);
  });

  it('buffers across feed calls (split header)', () => {
    const out: Array<[string, string]> = [];
    const d = new LogStreamDemuxer();
    const full = frame(1, 'hi');
    d.feed(full.subarray(0, 4), (k, t) => out.push([k, t]));
    expect(out).toHaveLength(0);
    d.feed(full.subarray(4), (k, t) => out.push([k, t]));
    expect(out).toEqual([['stdout', 'hi']]);
  });

  it('buffers across feed calls (split payload)', () => {
    const out: Array<[string, string]> = [];
    const d = new LogStreamDemuxer();
    const full = frame(1, 'abcdef');
    d.feed(full.subarray(0, 10), (k, t) => out.push([k, t]));
    expect(out).toHaveLength(0);
    d.feed(full.subarray(10), (k, t) => out.push([k, t]));
    expect(out).toEqual([['stdout', 'abcdef']]);
  });

  it('falls back to TTY mode for non-multiplexed streams', () => {
    const out: Array<[string, string]> = [];
    const d = new LogStreamDemuxer();
    d.feed(Buffer.from('plain log line\n'), (k, t) => out.push([k, t]));
    expect(out).toEqual([['stdout', 'plain log line\n']]);
  });
});
