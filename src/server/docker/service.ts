import { Readable } from "node:stream";
import docker from "@/server/docker/client";
import type {
  ContainerFileNode,
  DockerContainer,
  DockerImage,
  DockerLogEntry,
  DockerNetwork,
  DockerVolume
} from "@/types/docker";
import tar from "tar-stream";

const isReadable = (value: unknown): value is Readable =>
  Boolean(value) && typeof (value as Readable).pipe === "function";

const readStream = async (stream: Readable) => {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf-8");
};

const formatBytes = (bytes: number) => {
  if (!bytes || Number.isNaN(bytes)) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[exponent]}`;
};

const calculateCpu = (stats: any) => {
  if (!stats?.cpu_stats || !stats?.precpu_stats) {
    return 0;
  }

  const cpuDelta =
    (stats.cpu_stats.cpu_usage?.total_usage ?? 0) - (stats.precpu_stats.cpu_usage?.total_usage ?? 0);
  const systemDelta = (stats.cpu_stats.system_cpu_usage ?? 0) - (stats.precpu_stats.system_cpu_usage ?? 0);

  if (cpuDelta <= 0 || systemDelta <= 0) {
    return 0;
  }

  const cores = stats.cpu_stats.cpu_usage?.percpu_usage?.length ?? 1;
  return ((cpuDelta / systemDelta) * cores * 100);
};

const safeNumber = (value: number) => (Number.isFinite(value) ? Number(value.toFixed(1)) : 0);

export const listContainers = async (): Promise<DockerContainer[]> => {
  const containers = await docker.listContainers({ all: true });

  const results = await Promise.all(
    containers.map(async (container) => {
      let cpuUsage = 0;
      let memoryUsage = 0;

      try {
        const statsPayload = await docker.getContainer(container.Id).stats({ stream: false });
        const stats = isReadable(statsPayload)
          ? JSON.parse(await readStream(statsPayload))
          : statsPayload;

        cpuUsage = calculateCpu(stats);
        const memoryBytes = stats?.memory_stats?.usage ?? 0;
        memoryUsage = memoryBytes / (1024 * 1024);
      } catch (error) {
        console.warn(`Failed to read stats for container ${container.Id}`, error);
      }

      const ports = (container.Ports ?? []).map((port) =>
        port.PublicPort
          ? `${port.PrivatePort}/${port.Type} -> ${port.IP || "0.0.0.0"}:${port.PublicPort}`
          : `${port.PrivatePort}/${port.Type}`
      );

      return {
        id: container.Id,
        name: container.Names?.[0]?.replace(/^\//, "") ?? container.Id,
        image: container.Image,
        state: (container.State ?? "running") as DockerContainer["state"],
        status: container.Status ?? container.State ?? "Unknown",
        ports,
        createdAt: new Date((container.Created ?? 0) * 1000).toISOString(),
        cpuUsage: safeNumber(cpuUsage),
        memoryUsage: safeNumber(memoryUsage)
      } satisfies DockerContainer;
    })
  );

  return results;
};

export const listImages = async (): Promise<DockerImage[]> => {
  const images = await docker.listImages();

  return images.map((image) => ({
    id: image.Id,
    repoTags: image.RepoTags?.filter(Boolean) ?? ["<none>:latest"],
    size: image.Size ?? 0,
    createdAt: new Date((image.Created ?? 0) * 1000).toISOString(),
    containers: image.Containers ?? 0
  } satisfies DockerImage));
};

export const listVolumes = async (): Promise<DockerVolume[]> => {
  const { Volumes } = await docker.listVolumes();

  if (!Volumes) {
    return [];
  }

  return Volumes.map((volume) => ({
    name: volume.Name,
    driver: volume.Driver,
    mountpoint: volume.Mountpoint,
    createdAt: volume.CreatedAt ?? new Date().toISOString(),
    size: formatBytes(volume.UsageData?.Size ?? 0)
  } satisfies DockerVolume));
};

export const listNetworks = async (): Promise<DockerNetwork[]> => {
  const networks = await docker.listNetworks();

  return networks.map((network) => ({
    id: network.Id,
    name: network.Name,
    driver: network.Driver,
    scope: network.Scope ?? "local",
    createdAt: network.Created ?? new Date().toISOString(),
    containers: network.Containers ? Object.keys(network.Containers).length : 0
  } satisfies DockerNetwork));
};

const inferLogLevel = (message: string): DockerLogEntry["level"] => {
  const value = message.toLowerCase();
  if (value.includes("error") || value.includes("exception")) {
    return "error";
  }
  if (value.includes("warn")) {
    return "warn";
  }
  return "info";
};

const parseDockerLogLines = (payload: Buffer | string, containerId: string): DockerLogEntry[] => {
  if (!payload || payload.length === 0) {
    return [];
  }

  const buffer = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
  const entries: DockerLogEntry[] = [];
  let cursor = 0;

  while (cursor < buffer.length) {
    if (cursor + 8 > buffer.length) {
      break;
    }

    const streamType = buffer[cursor];
    const size = buffer.readUInt32BE(cursor + 4);
    const start = cursor + 8;
    const end = start + size;

    const content = buffer.slice(start, end).toString("utf-8");
    const lines = content.split(/\r?\n/).filter(Boolean);

    lines.forEach((line, index) => {
      const [timestamp, ...rest] = line.split(/\s/);
      const ts = Number.isNaN(Date.parse(timestamp)) ? new Date().toISOString() : new Date(timestamp).toISOString();
      const message = rest.join(" ") || line;
      entries.push({
        id: `${containerId}-${cursor}-${index}`,
        containerId,
        timestamp: ts,
        message,
        level: streamType === 2 ? "error" : inferLogLevel(message)
      });
    });

    cursor = end;
  }

  return entries;
};

export const getContainerLogs = async (
  containerId: string,
  options: { tail?: number; since?: Date } = {}
): Promise<DockerLogEntry[]> => {
  const container = docker.getContainer(containerId);
  const payload = await container.logs({
    stdout: true,
    stderr: true,
    follow: false,
    tail: options.tail ?? 200,
    timestamps: true,
    since: options.since ? Math.floor(options.since.getTime() / 1000) : undefined
  });

  return parseDockerLogLines(payload, containerId);
};

export const listContainerFiles = async (containerId: string, targetPath: string): Promise<ContainerFileNode[]> => {
  const container = docker.getContainer(containerId);
  const absolute = targetPath.startsWith("/") ? targetPath : `/${targetPath}`;
  const normalized = absolute === "/" ? "/" : absolute.replace(/\/$/, "");
  const archiveStream = (await container.getArchive({ path: normalized })) as Readable;
  const extract = tar.extract();

  const nodes = new Map<string, ContainerFileNode>();
  const base = normalized === "/" ? "" : normalized.replace(/^\/+/, "").concat("/");

  return await new Promise<ContainerFileNode[]>((resolve, reject) => {
    extract.on("entry", (header, stream, next) => {
      stream.resume();

      const fullName = header.name.replace(/^\.\//, "");
      if (!fullName) {
        next();
        return;
      }

      const relative = base ? fullName.replace(base, "") : fullName;
      const segments = relative.split("/").filter(Boolean);
      if (segments.length === 0) {
        next();
        return;
      }

      const name = segments[0];
      const isDirectory = header.type === "directory" || segments.length > 1;
      const absolutePath = normalized === "/" ? `/${name}` : `${normalized}/${name}`;

      if (!nodes.has(absolutePath)) {
        nodes.set(absolutePath, {
          name,
          path: absolutePath,
          type: isDirectory ? "directory" : "file",
          size: header.size ?? 0,
          modifiedAt: header.mtime ? header.mtime.toISOString() : new Date().toISOString()
        });
      }

      next();
    });

    extract.on("finish", () => {
      const ordered = Array.from(nodes.values()).sort((a, b) => {
        if (a.type === b.type) {
          return a.name.localeCompare(b.name);
        }
        return a.type === "directory" ? -1 : 1;
      });
      resolve(ordered);
    });

    extract.on("error", reject);

    archiveStream.on("error", reject);
    archiveStream.pipe(extract);
  });
};

export const execInContainer = async (containerId: string, command: string[]) => {
  const container = docker.getContainer(containerId);
  const exec = await container.exec({
    Cmd: command,
    AttachStdout: true,
    AttachStderr: true
  });

  const stream = await exec.start({ hijack: true, stdin: false });

  const chunks: Buffer[] = [];

  return await new Promise<string>((resolve, reject) => {
    stream.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });

    stream.on("end", () => {
      const output = Buffer.concat(chunks).toString("utf-8");
      resolve(output.trim());
    });

    stream.on("error", reject);
  });
};

export const removeImage = async (imageId: string) => {
  await docker.getImage(imageId).remove({ force: true });
};

export const removeContainer = async (containerId: string) => {
  await docker.getContainer(containerId).remove({ force: true });
};

export const pruneDanglingVolumes = async () => {
  await docker.pruneVolumes();
};
