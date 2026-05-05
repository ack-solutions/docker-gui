import type Docker from 'dockerode';
import { AppError, NotFoundError } from '../lib/errors.js';
import type { VolumeSummary } from '../schemas/volume.schema.js';

interface DockerodeVolume {
  Name: string;
  Driver: string;
  Mountpoint: string;
  Scope: string;
  CreatedAt?: string;
  Labels?: Record<string, string> | null;
  Options?: Record<string, string> | null;
  UsageData?: { RefCount: number; Size: number } | null;
}

interface DockerodeContainerInfo {
  Mounts?: Array<{ Type: string; Name?: string }>;
}

export class DockerVolumesService {
  constructor(private readonly docker: Docker) {}

  async list(): Promise<VolumeSummary[]> {
    try {
      const [{ Volumes }, containers] = await Promise.all([
        this.docker.listVolumes() as Promise<{ Volumes?: DockerodeVolume[] | null }>,
        this.docker.listContainers({ all: true }) as Promise<DockerodeContainerInfo[]>,
      ]);
      const inUseCounts = countVolumeUses(containers);
      return (Volumes ?? []).map((v) => toSummary(v, inUseCounts.get(v.Name) ?? 0));
    } catch (err) {
      throw mapDockerError(err);
    }
  }

  async inspect(name: string): Promise<unknown> {
    try {
      return await this.docker.getVolume(name).inspect();
    } catch (err) {
      throw mapDockerError(err);
    }
  }

  async remove(name: string, opts: { force?: boolean } = {}): Promise<void> {
    try {
      await this.docker.getVolume(name).remove({ force: opts.force ?? false });
    } catch (err) {
      throw mapDockerError(err);
    }
  }

  async prune(): Promise<{ deleted: string[]; spaceReclaimed: number }> {
    try {
      const result = (await this.docker.pruneVolumes({})) as {
        VolumesDeleted?: string[] | null;
        SpaceReclaimed?: number;
      };
      return {
        deleted: result.VolumesDeleted ?? [],
        spaceReclaimed: result.SpaceReclaimed ?? 0,
      };
    } catch (err) {
      throw mapDockerError(err);
    }
  }
}

export function countVolumeUses(containers: DockerodeContainerInfo[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const c of containers) {
    for (const m of c.Mounts ?? []) {
      if (m.Type === 'volume' && m.Name) {
        counts.set(m.Name, (counts.get(m.Name) ?? 0) + 1);
      }
    }
  }
  return counts;
}

export function toSummary(v: DockerodeVolume, inUseBy: number): VolumeSummary {
  return {
    name: v.Name,
    driver: v.Driver,
    mountpoint: v.Mountpoint,
    scope: v.Scope,
    ...(v.CreatedAt ? { createdAt: v.CreatedAt } : {}),
    labels: v.Labels ?? {},
    ...(v.Options ? { options: v.Options } : {}),
    inUseBy,
  };
}

function isStatusError(err: unknown, code: number): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'statusCode' in err &&
    (err as { statusCode: unknown }).statusCode === code
  );
}

function mapDockerError(err: unknown): AppError {
  if (isStatusError(err, 404)) return new NotFoundError('Volume not found');
  if (isStatusError(err, 409)) {
    return new AppError(
      'docker.volume_in_use',
      'Volume is in use by one or more containers',
      409,
    );
  }
  if (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === 'ENOENT'
  ) {
    return new AppError('docker.unavailable', 'Docker daemon is not reachable', 503);
  }
  const message = err instanceof Error ? err.message : 'Docker daemon error';
  const status =
    typeof err === 'object' && err !== null && 'statusCode' in err && typeof (err as { statusCode: unknown }).statusCode === 'number'
      ? (err as { statusCode: number }).statusCode
      : 500;
  return new AppError('docker.error', message, status >= 400 && status < 600 ? status : 500);
}
