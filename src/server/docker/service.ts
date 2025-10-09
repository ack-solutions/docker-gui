import { Readable } from "node:stream";
import tar from "tar-stream";
import docker from "@/server/docker/client";
import type Dockerode from "dockerode";
import type { ContainerInspectInfo } from "dockerode";
import type {
  ContainerFileNode,
  CreateContainerRequest,
  DockerContainer,
  DockerContainerInspect,
  DockerImage,
  DockerImageInspect,
  DockerLogEntry,
  DockerNetwork,
  DockerPruneSummary,
  DockerVolume
} from "@/types/docker";

class DockerService {
  constructor(private readonly client = docker) {}

  private static isReadable(value: unknown): value is Readable {
    return Boolean(value) && typeof (value as Readable).pipe === "function";
  }

  private static async readStream(stream: Readable) {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString("utf-8");
  }

  private static formatBytes(bytes: number) {
    if (!bytes || Number.isNaN(bytes)) {
      return "0 B";
    }

    const units = ["B", "KB", "MB", "GB", "TB"];
    const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / 1024 ** exponent;
    return `${value.toFixed(value < 10 ? 1 : 0)} ${units[exponent]}`;
  }

  private static summarizePrune(result: any, key: "ContainersDeleted" | "ImagesDeleted" | "VolumesDeleted") {
    const removed = Array.isArray(result?.[key]) ? result[key].filter(Boolean).length : 0;
    const reclaimed = Number.isFinite(result?.SpaceReclaimed) ? Number(result.SpaceReclaimed) : 0;

    return {
      removedCount: removed,
      reclaimedSpace: reclaimed
    } satisfies DockerPruneSummary;
  }

  private static calculateCpu(stats: any) {
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
    return (cpuDelta / systemDelta) * cores * 100;
  }

  private static safeNumber(value: number) {
    return Number.isFinite(value) ? Number(value.toFixed(1)) : 0;
  }

  private static inferLogLevel(message: string): DockerLogEntry["level"] {
    const value = message.toLowerCase();
    if (value.includes("error") || value.includes("exception")) {
      return "error";
    }
    if (value.includes("warn")) {
      return "warn";
    }
    return "info";
  }

  private static parseDockerLogLines(payload: Buffer | string, containerId: string): DockerLogEntry[] {
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
          level: streamType === 2 ? "error" : DockerService.inferLogLevel(message)
        });
      });

      cursor = end;
    }

    return entries;
  }

  private static normalizeEnvVars(env?: CreateContainerRequest["env"]) {
    if (!env?.length) {
      return undefined;
    }

    const entries = env
      .map(({ key, value }) => ({ key: key?.trim(), value: value ?? "" }))
      .filter(({ key }) => Boolean(key));

    if (!entries.length) {
      return undefined;
    }

    return entries.map(({ key, value }) => `${key}=${value}`);
  }

  private static buildPortConfiguration(ports?: CreateContainerRequest["ports"]) {
    if (!ports?.length) {
      return {};
    }

    const exposedPorts: Record<string, Record<string, never>> = {};
    const portBindings: Record<string, Array<{ HostPort?: string; HostIp?: string }>> = {};

    ports.forEach((port) => {
      const containerPort = Number(port.containerPort);
      if (!Number.isFinite(containerPort) || containerPort <= 0) {
        return;
      }

      const protocol = port.protocol ?? "tcp";
      const key = `${containerPort}/${protocol}`;
      exposedPorts[key] = {};

      const binding: { HostPort?: string; HostIp?: string } = {};

      const hostPort = Number(port.hostPort);
      if (Number.isFinite(hostPort) && hostPort > 0) {
        binding.HostPort = String(hostPort);
      }

      if (typeof port.hostIp === "string" && port.hostIp.trim().length > 0) {
        binding.HostIp = port.hostIp.trim();
      }

      if (binding.HostPort || binding.HostIp) {
        if (!portBindings[key]) {
          portBindings[key] = [];
        }
        portBindings[key]!.push(binding);
      }
    });

    return {
      exposedPorts: Object.keys(exposedPorts).length ? exposedPorts : undefined,
      portBindings: Object.keys(portBindings).length ? portBindings : undefined
    };
  }

  private static mapInspectToContainer(inspect: ContainerInspectInfo): DockerContainer {
    const labels = inspect.Config?.Labels ?? {};
    const project = labels["com.docker.compose.project"] || labels["com.docker.stack.namespace"] || null;
    const service =
      labels["com.docker.compose.service"] || labels["com.docker.swarm.service.name"] || null;

    const ports: string[] = [];
    const networkPorts = inspect.NetworkSettings?.Ports ?? {};
    Object.entries(networkPorts).forEach(([key, bindings]) => {
      if (!bindings || bindings.length === 0) {
        ports.push(key);
        return;
      }

      bindings.forEach((binding) => {
        const [privatePort, protocol] = key.split("/");
        const hostIp = binding.HostIp && binding.HostIp !== "0.0.0.0" ? binding.HostIp : binding.HostIp ?? "0.0.0.0";
        const hostInfo = binding.HostPort ? `${hostIp}:${binding.HostPort}` : hostIp;
        ports.push(`${privatePort}/${protocol} -> ${hostInfo}`);
      });
    });

    const createdAt = inspect.Created ? new Date(inspect.Created).toISOString() : new Date().toISOString();
    const status = inspect.State?.Status ?? "created";

    return {
      id: inspect.Id,
      name: inspect.Name ? inspect.Name.replace(/^\//, "") : inspect.Id,
      project,
      service,
      image: inspect.Config?.Image ?? inspect.Image ?? "",
      state: (status as DockerContainer["state"]) ?? "created",
      status,
      ports,
      createdAt,
      cpuUsage: 0,
      memoryUsage: 0
    };
  }

  private static normalizeInspect(inspect: ContainerInspectInfo): DockerContainerInspect {
    const env = Array.isArray(inspect.Config?.Env)
      ? inspect.Config.Env.filter((value): value is string => Boolean(value))
      : [];
    const cmd = Array.isArray(inspect.Config?.Cmd)
      ? inspect.Config.Cmd.filter((value): value is string => Boolean(value))
      : [];
    const entrypoint = Array.isArray(inspect.Config?.Entrypoint)
      ? inspect.Config.Entrypoint.filter((value): value is string => Boolean(value))
      : [];
    const labels = inspect.Config?.Labels ?? {};

    const networks = inspect.NetworkSettings?.Networks ?? {};
    const normalizedNetworks = Object.fromEntries(
      Object.entries(networks).map(([name, value]) => [
        name,
        {
          ipAddress: value?.IPAddress || undefined,
          macAddress: value?.MacAddress || undefined,
          gateway: value?.Gateway || undefined,
          globalIPv6Address: value?.GlobalIPv6Address || undefined,
          ipv6Gateway: value?.IPv6Gateway || undefined
        }
      ])
    );

    const portDefinitions = inspect.NetworkSettings?.Ports ?? {};
    const ports = Object.keys(portDefinitions).length
      ? Object.fromEntries(
          Object.entries(portDefinitions).map(([key, value]) => {
            const bindings = Array.isArray(value)
              ? value.map((binding) => ({
                  hostIp: binding?.HostIp || undefined,
                  hostPort: binding?.HostPort || undefined
                }))
              : null;
            return [key, bindings];
          })
        )
      : undefined;

    const mounts = Array.isArray(inspect.Mounts)
      ? inspect.Mounts.map((mount) => {
          const typed = mount as any;
          return {
            type: typed?.Type,
            source: typed?.Source,
            destination: typed?.Destination ?? "",
            mode: typed?.Mode,
            rw: Boolean(typed?.RW),
            propagation: typed?.Propagation,
            name: typed?.Name ?? null,
            driver: typed?.Driver ?? undefined
          };
        })
      : [];

    const state = inspect.State;
    const health = state?.Health;

    const hostRestartPolicy = inspect.HostConfig?.RestartPolicy;
    const hostLogConfig = inspect.HostConfig?.LogConfig;
    const hostPortEntries = inspect.HostConfig?.PortBindings ?? undefined;
    const hostPortBindings = hostPortEntries
      ? Object.fromEntries(
          Object.entries(hostPortEntries).map(([key, value]) => {
            const bindings = Array.isArray(value)
              ? value.map((binding) => ({
                  hostIp: binding?.HostIp || undefined,
                  hostPort: binding?.HostPort || undefined
                }))
              : [];
            return [key, bindings];
          })
        )
      : undefined;

    return {
      id: inspect.Id,
      name: inspect.Name ? inspect.Name.replace(/^\//, "") : inspect.Id,
      createdAt: inspect.Created ? new Date(inspect.Created).toISOString() : new Date().toISOString(),
      path: inspect.Path ?? "",
      args: Array.isArray(inspect.Args) ? inspect.Args : [],
      image: inspect.Config?.Image ?? inspect.Image ?? "",
      imageId: (inspect as any).ImageID ?? inspect.Image ?? "",
      platform: (inspect as any).Platform ?? undefined,
      driver: inspect.Driver ?? undefined,
      config: {
        hostname: inspect.Config?.Hostname || undefined,
        domainname: inspect.Config?.Domainname || undefined,
        user: inspect.Config?.User || undefined,
        env,
        cmd,
        entrypoint,
        workingDir: inspect.Config?.WorkingDir || undefined,
        labels
      },
      state: {
        status: state?.Status ?? "unknown",
        running: Boolean(state?.Running),
        paused: Boolean(state?.Paused),
        restarting: Boolean(state?.Restarting),
        oomKilled: Boolean(state?.OOMKilled),
        dead: Boolean(state?.Dead),
        pid: state?.Pid ?? 0,
        exitCode: state?.ExitCode ?? 0,
        restartCount: (state as any)?.RestartCount ?? undefined,
        startedAt: state?.StartedAt ? new Date(state.StartedAt).toISOString() : undefined,
        finishedAt: state?.FinishedAt ? new Date(state.FinishedAt).toISOString() : undefined,
        health: health
          ? {
              status: health.Status,
              failingStreak: health.FailingStreak,
              log: Array.isArray(health.Log)
                ? health.Log.map((entry) => ({
                    start: entry.Start ? new Date(entry.Start).toISOString() : new Date(0).toISOString(),
                    end: entry.End ? new Date(entry.End).toISOString() : new Date(0).toISOString(),
                    exitCode: entry.ExitCode ?? 0,
                    output: entry.Output ?? ""
                  }))
                : []
            }
          : undefined
      },
      networkSettings: {
        ipAddress: inspect.NetworkSettings?.IPAddress || undefined,
        macAddress: inspect.NetworkSettings?.MacAddress || undefined,
        networks: normalizedNetworks,
        ports
      },
      mounts,
      hostConfig: {
        networkMode: inspect.HostConfig?.NetworkMode || undefined,
        restartPolicy: hostRestartPolicy
          ? {
              name: hostRestartPolicy.Name,
              maximumRetryCount: hostRestartPolicy.MaximumRetryCount
            }
          : undefined,
        binds: inspect.HostConfig?.Binds ?? undefined,
        extraHosts: inspect.HostConfig?.ExtraHosts ?? undefined,
        logConfig: hostLogConfig
          ? {
              type: hostLogConfig.Type,
              config: hostLogConfig.Config
            }
          : undefined,
        portBindings: hostPortBindings
      }
    } satisfies DockerContainerInspect;
  }

  private static normalizeImageInspect(inspect: any, historyRaw: any[] = []): DockerImageInspect {
    const repoTags = Array.isArray(inspect?.RepoTags)
      ? inspect.RepoTags.filter((tag: unknown): tag is string => Boolean(tag))
      : [];
    const repoDigests = Array.isArray(inspect?.RepoDigests)
      ? inspect.RepoDigests.filter((digest: unknown): digest is string => Boolean(digest))
      : [];

    const config = inspect?.Config ?? {};
    const env = Array.isArray(config.Env)
      ? config.Env.filter((value: unknown): value is string => Boolean(value))
      : [];
    const cmd = Array.isArray(config.Cmd)
      ? config.Cmd.filter((value: unknown): value is string => Boolean(value))
      : [];
    const entrypoint = Array.isArray(config.Entrypoint)
      ? config.Entrypoint.filter((value: unknown): value is string => Boolean(value))
      : [];
    const exposedPorts = config.ExposedPorts ? Object.keys(config.ExposedPorts) : [];
    const labels = config.Labels ?? {};

    const rootFs = inspect?.RootFS ?? {};
    const rootLayers = Array.isArray(rootFs.Layers)
      ? rootFs.Layers.filter((value: unknown): value is string => Boolean(value))
      : [];
    const diffIds = Array.isArray((rootFs as any).DiffIDs)
      ? (rootFs as any).DiffIDs.filter((value: unknown): value is string => Boolean(value))
      : [];

    const history = Array.isArray(historyRaw)
      ? historyRaw.map((entry, index) => ({
          id:
            typeof entry?.Id === "string" && entry.Id !== "<missing>"
              ? entry.Id
              : `${inspect?.Id ?? "layer"}-${index}`,
          created: entry?.Created
            ? new Date(Number(entry.Created) * 1000).toISOString()
            : new Date(0).toISOString(),
          createdBy: entry?.CreatedBy ?? undefined,
          comment: entry?.Comment ?? undefined,
          tags: Array.isArray(entry?.Tags)
            ? entry.Tags.filter((tag: unknown): tag is string => Boolean(tag))
            : [],
          size: Number(entry?.Size) || 0
        }))
      : [];

    const layersFromHistory = history
      .filter((entry) => entry.id && entry.id !== "<missing>")
      .map((entry) => ({
        digest: entry.id,
        size: entry.size,
        createdAt: entry.created
      }));

    const layers = layersFromHistory.length
      ? layersFromHistory
      : rootLayers.map((digest) => ({
          digest,
          size: 0,
          createdAt: undefined
        }));

    return {
      id: inspect?.Id ?? "",
      repoTags,
      repoDigests,
      size: Number(inspect?.Size) || 0,
      virtualSize: Number(inspect?.VirtualSize) || Number(inspect?.Size) || 0,
      createdAt: inspect?.Created ? new Date(inspect.Created).toISOString() : new Date().toISOString(),
      author: inspect?.Author ?? undefined,
      architecture: inspect?.Architecture ?? undefined,
      os: inspect?.Os ?? undefined,
      osVersion: inspect?.OsVersion ?? undefined,
      dockerVersion: inspect?.DockerVersion ?? undefined,
      variant: inspect?.Variant ?? undefined,
      config: {
        env,
        cmd,
        entrypoint,
        workingDir: config.WorkingDir || undefined,
        user: config.User || undefined,
        labels,
        exposedPorts
      },
      rootFS: {
        type: rootFs?.Type ?? undefined,
        layers: rootLayers,
        diffIds
      },
      history,
      layers
    } satisfies DockerImageInspect;
  }

  private static isMissingImageError(error: unknown) {
    if (!error || typeof error !== "object") {
      return false;
    }

    const statusCode = "statusCode" in error ? (error as any).statusCode : undefined;
    const reason = "reason" in error ? String((error as any).reason ?? "") : "";
    const message = "message" in error ? String((error as any).message ?? "") : "";

    return statusCode === 404 || /not found/i.test(reason) || /no such image/i.test(message);
  }

  async listContainers(): Promise<DockerContainer[]> {
    const containers = await this.client.listContainers({ all: true });

    return Promise.all(
      containers.map(async (container) => {
        let cpuUsage = 0;
        let memoryUsage = 0;

        try {
          const statsPayload = await this.client.getContainer(container.Id).stats({ stream: false });
          const stats = DockerService.isReadable(statsPayload)
            ? JSON.parse(await DockerService.readStream(statsPayload))
            : statsPayload;

          cpuUsage = DockerService.calculateCpu(stats);
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

        const labels = container.Labels ?? {};
        const composeProject = labels["com.docker.compose.project"];
        const stackNamespace = labels["com.docker.stack.namespace"];
        const project = composeProject || stackNamespace || null;
        const service =
          labels["com.docker.compose.service"] || labels["com.docker.swarm.service.name"] || null;

        return {
          id: container.Id,
          name: container.Names?.[0]?.replace(/^\//, "") ?? container.Id,
          project,
          service,
          image: container.Image,
          state: (container.State ?? "running") as DockerContainer["state"],
          status: container.Status ?? container.State ?? "Unknown",
          ports,
          createdAt: new Date((container.Created ?? 0) * 1000).toISOString(),
          cpuUsage: DockerService.safeNumber(cpuUsage),
          memoryUsage: DockerService.safeNumber(memoryUsage)
        } satisfies DockerContainer;
      })
    );
  }

  async listImages(): Promise<DockerImage[]> {
    const images = await this.client.listImages();

    return images.map((image) => ({
      id: image.Id,
      repoTags: image.RepoTags?.filter(Boolean) ?? ["<none>:latest"],
      size: image.Size ?? 0,
      createdAt: new Date((image.Created ?? 0) * 1000).toISOString(),
      containers: image.Containers ?? 0
    } satisfies DockerImage));
  }

  async listVolumes(): Promise<DockerVolume[]> {
    const { Volumes } = await this.client.listVolumes();

    if (!Volumes) {
      return [];
    }

    return Volumes.map((volume) => ({
      name: volume.Name,
      driver: volume.Driver,
      mountpoint: volume.Mountpoint,
      createdAt: "CreatedAt" in volume && typeof volume.CreatedAt === "string"
        ? new Date(volume.CreatedAt).toISOString()
        : new Date().toISOString(),
      size: DockerService.formatBytes(volume.UsageData?.Size ?? 0)
    } satisfies DockerVolume));
  }

  async listNetworks(): Promise<DockerNetwork[]> {
    const networks = await this.client.listNetworks();

    return networks.map((network) => ({
      id: network.Id,
      name: network.Name,
      driver: network.Driver,
      scope: network.Scope ?? "local",
      createdAt: network.Created ?? new Date().toISOString(),
      containers: network.Containers ? Object.keys(network.Containers).length : 0
    } satisfies DockerNetwork));
  }

  async getContainerLogs(
    containerId: string,
    options: { tail?: number; since?: Date } = {}
  ): Promise<DockerLogEntry[]> {
    const container = this.client.getContainer(containerId);
    const payload = await container.logs({
      stdout: true,
      stderr: true,
      follow: false,
      tail: options.tail ?? 200,
      timestamps: true,
      since: options.since ? Math.floor(options.since.getTime() / 1000) : undefined
    });

    return DockerService.parseDockerLogLines(payload, containerId);
  }

  async listContainerFiles(containerId: string, targetPath: string): Promise<ContainerFileNode[]> {
    const container = this.client.getContainer(containerId);
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
  }

  async execInContainer(containerId: string, command: string[]) {
    const container = this.client.getContainer(containerId);
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
  }

  async removeImage(imageId: string) {
    await this.client.getImage(imageId).remove({ force: true });
  }

  async removeContainer(containerId: string) {
    await this.client.getContainer(containerId).remove({ force: true });
  }

  async startContainer(containerId: string) {
    await this.client.getContainer(containerId).start();
  }

  async stopContainer(containerId: string) {
    await this.client.getContainer(containerId).stop();
  }

  async restartContainer(containerId: string) {
    await this.client.getContainer(containerId).restart();
  }

  async inspectContainer(containerId: string): Promise<DockerContainerInspect> {
    const container = this.client.getContainer(containerId);
    const inspect = await container.inspect();
    return DockerService.normalizeInspect(inspect);
  }

  async inspectImage(imageId: string): Promise<DockerImageInspect> {
    const image = this.client.getImage(imageId);
    const inspect = await image.inspect();
    let history: any[] = [];
    try {
      history = await image.history();
    } catch (error) {
      console.warn(`Failed to read history for image ${imageId}`, error);
    }

    return DockerService.normalizeImageInspect(inspect, history);
  }

  async createContainer(options: CreateContainerRequest): Promise<DockerContainer> {
    if (!options.image || !options.image.trim()) {
      throw new Error("Image is required to create a container.");
    }

    const env = DockerService.normalizeEnvVars(options.env);
    const ports = DockerService.buildPortConfiguration(options.ports);
    const restartPolicyName = options.restartPolicy && options.restartPolicy !== "no"
      ? options.restartPolicy
      : undefined;

    const hostConfig: Record<string, unknown> = {};
    if (ports.portBindings) {
      hostConfig.PortBindings = ports.portBindings;
    }
    if (restartPolicyName) {
      hostConfig.RestartPolicy = { Name: restartPolicyName };
    } else if (options.restartPolicy === "no") {
      hostConfig.RestartPolicy = { Name: "no" };
    }

    const createPayload = {
      name: options.name?.trim() || undefined,
      Image: options.image,
      Cmd: options.command ? ["/bin/sh", "-c", options.command] : undefined,
      Env: env,
      ExposedPorts: ports.exposedPorts,
      HostConfig: Object.keys(hostConfig).length ? hostConfig : undefined
    } as const;

    let container: Dockerode.Container;

    try {
      container = await this.client.createContainer(createPayload);
    } catch (error) {
      if (!DockerService.isMissingImageError(error)) {
        throw error;
      }

      await this.pullImage(options.image);
      container = await this.client.createContainer(createPayload);
    }

    if (options.autoStart ?? true) {
      await container.start();
    }

    try {
      const containers = await this.listContainers();
      const created = containers.find((entry) => entry.id === container.id);
      if (created) {
        return created;
      }
    } catch (error) {
      console.warn("Unable to refresh container list after creation", error);
    }

    try {
      const inspect = await container.inspect();
      return DockerService.mapInspectToContainer(inspect);
    } catch (error) {
      console.warn("Unable to inspect container after creation", error);
    }

    return {
      id: container.id,
      name: options.name?.trim() || container.id,
      project: null,
      service: null,
      image: options.image,
      state: (options.autoStart ?? true) ? "running" : "created",
      status: (options.autoStart ?? true) ? "running" : "created",
      ports: [],
      createdAt: new Date().toISOString(),
      cpuUsage: 0,
      memoryUsage: 0
    };
  }

  async pruneStoppedContainers(): Promise<DockerPruneSummary> {
    const result = await this.client.pruneContainers({ filters: { status: { exited: true } } });
    return DockerService.summarizePrune(result, "ContainersDeleted");
  }

  async pruneUnusedImages(): Promise<DockerPruneSummary> {
    const result = await this.client.pruneImages({ filters: { dangling: { "true": true } } });
    const removed = Array.isArray(result?.ImagesDeleted)
      ? result.ImagesDeleted.filter(Boolean).length
      : 0;
    const reclaimed = Number.isFinite(result?.SpaceReclaimed) ? Number(result.SpaceReclaimed) : 0;

    return {
      removedCount: removed,
      reclaimedSpace: reclaimed
    } satisfies DockerPruneSummary;
  }

  async pruneDanglingVolumes(): Promise<DockerPruneSummary> {
    const result = await this.client.pruneVolumes();
    return DockerService.summarizePrune(result, "VolumesDeleted");
  }

  async pullImage(imageName: string, onProgress?: (progress: string) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client.pull(imageName, (pullError: Error | null, stream: NodeJS.ReadableStream) => {
        if (pullError) {
          return reject(pullError);
        }

        const onFinished = (finishError: Error | null) => {
          if (finishError) {
            return reject(finishError);
          }
          resolve();
        };

        const onStreamProgress = (event: any) => {
          if (onProgress && event.status) {
            const progress = event.progress
              ? `${event.status}: ${event.progress}`
              : event.status;
            onProgress(progress);
          }
        };

        this.client.modem.followProgress(stream, onFinished, onStreamProgress);
      });
    });
  }
}

const dockerService = new DockerService();

export { DockerService, dockerService };
