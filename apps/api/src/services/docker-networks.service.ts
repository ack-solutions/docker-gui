import type Docker from 'dockerode';
import { AppError, NotFoundError } from '../lib/errors.js';
import type { NetworkSummary } from '../schemas/network.schema.js';

interface DockerodeNetwork {
  Id: string;
  Name: string;
  Driver: string;
  Scope: string;
  Internal: boolean;
  Created?: string;
  Labels?: Record<string, string> | null;
  IPAM?: {
    Driver?: string;
    Config?: Array<{ Subnet?: string }>;
  };
  Containers?: Record<string, unknown> | null;
}

export class DockerNetworksService {
  constructor(private readonly docker: Docker) {}

  async list(): Promise<NetworkSummary[]> {
    try {
      const raw = (await this.docker.listNetworks()) as DockerodeNetwork[];
      return raw.map(toSummary);
    } catch (err) {
      throw mapDockerError(err);
    }
  }

  async inspect(id: string): Promise<unknown> {
    try {
      return await this.docker.getNetwork(id).inspect();
    } catch (err) {
      throw mapDockerError(err);
    }
  }

  async remove(id: string): Promise<void> {
    try {
      await this.docker.getNetwork(id).remove();
    } catch (err) {
      throw mapDockerError(err);
    }
  }

  async prune(): Promise<{ deleted: string[] }> {
    try {
      const r = (await this.docker.pruneNetworks({})) as { NetworksDeleted?: string[] | null };
      return { deleted: r.NetworksDeleted ?? [] };
    } catch (err) {
      throw mapDockerError(err);
    }
  }
}

export function toSummary(n: DockerodeNetwork): NetworkSummary {
  const containerCount = n.Containers ? Object.keys(n.Containers).length : 0;
  const subnets = (n.IPAM?.Config ?? [])
    .map((c) => c.Subnet)
    .filter((s): s is string => Boolean(s));
  const ipam =
    n.IPAM?.Driver || subnets.length
      ? {
          ...(n.IPAM?.Driver ? { driver: n.IPAM.Driver } : {}),
          subnets,
        }
      : undefined;
  return {
    id: n.Id,
    shortId: n.Id.slice(0, 12),
    name: n.Name,
    driver: n.Driver,
    scope: n.Scope,
    internal: n.Internal,
    ...(ipam ? { ipam } : {}),
    containerCount,
    labels: n.Labels ?? {},
    ...(n.Created ? { createdAt: n.Created } : {}),
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
  if (isStatusError(err, 404)) return new NotFoundError('Network not found');
  if (isStatusError(err, 403)) {
    return new AppError(
      'docker.network_predefined',
      'Predefined networks (bridge, host, none) cannot be removed',
      403,
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
