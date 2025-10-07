import apiClient from "@/lib/api/client";
import type {
  ContainerFileNode,
  DockerContainer,
  DockerImage,
  DockerLogEntry,
  DockerNetwork,
  DockerVolume
} from "@/types/docker";

const useMockData = process.env.NEXT_PUBLIC_USE_MOCKS === "true";

const mockContainers: DockerContainer[] = [
  {
    id: "1a2b3c",
    name: "web-frontend",
    image: "nginx:1.27",
    state: "running",
    status: "Up 3 hours",
    ports: ["80/tcp -> 0.0.0.0:8080"],
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    cpuUsage: 12.3,
    memoryUsage: 256
  },
  {
    id: "4d5e6f",
    name: "api-gateway",
    image: "node:20-alpine",
    state: "running",
    status: "Up 47 minutes",
    ports: ["3000/tcp -> 127.0.0.1:3000"],
    createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    cpuUsage: 32.1,
    memoryUsage: 512
  },
  {
    id: "7g8h9i",
    name: "postgresql",
    image: "postgres:16",
    state: "exited",
    status: "Exited (0) 2 hours ago",
    ports: ["5432/tcp"],
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
    cpuUsage: 0,
    memoryUsage: 128
  }
];

const mockImages: DockerImage[] = [
  {
    id: "sha256:123",
    repoTags: ["nginx:1.27"],
    size: 134_217_728,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    containers: 2
  },
  {
    id: "sha256:456",
    repoTags: ["node:20-alpine"],
    size: 256_000_000,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    containers: 1
  }
];

const mockVolumes: DockerVolume[] = [
  {
    name: "postgres-data",
    driver: "local",
    mountpoint: "/var/lib/docker/volumes/postgres-data",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
    size: "12.4 GiB"
  },
  {
    name: "redis-cache",
    driver: "local",
    mountpoint: "/var/lib/docker/volumes/redis-cache",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
    size: "2.1 GiB"
  }
];

const mockNetworks: DockerNetwork[] = [
  {
    id: "net-01",
    name: "frontend",
    driver: "bridge",
    scope: "local",
    containers: 2,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString()
  },
  {
    id: "net-02",
    name: "backend",
    driver: "overlay",
    scope: "swarm",
    containers: 4,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString()
  }
];

const mockLogs: DockerLogEntry[] = Array.from({ length: 25 }).map((_, index) => ({
  id: `log-${index}`,
  containerId: index % 2 === 0 ? "1a2b3c" : "4d5e6f",
  timestamp: new Date(Date.now() - index * 60000).toISOString(),
  level: index % 5 === 0 ? "error" : index % 3 === 0 ? "warn" : "info",
  message:
    index % 5 === 0
      ? "Unhandled exception while processing request /api/projects"
      : index % 3 === 0
        ? "High memory usage detected"
        : "Request completed in 24ms"
}));

const mockFiles: ContainerFileNode[] = [
  {
    name: "app",
    path: "/app",
    type: "directory",
    size: 0,
    modifiedAt: new Date().toISOString()
  },
  {
    name: "package.json",
    path: "/app/package.json",
    type: "file",
    size: 1024,
    modifiedAt: new Date().toISOString()
  },
  {
    name: "src",
    path: "/app/src",
    type: "directory",
    size: 0,
    modifiedAt: new Date().toISOString()
  }
];

const withMockFallback = async <T>(request: () => Promise<T>, mockFactory: () => T): Promise<T> => {
  if (useMockData) {
    return mockFactory();
  }

  try {
    return await request();
  } catch (error) {
    console.error("Failed to communicate with Docker API", error);
    return mockFactory();
  }
};

export const fetchContainers = async () =>
  withMockFallback(
    async () => {
      const { data } = await apiClient.get<DockerContainer[]>("/containers");
      return data;
    },
    () => mockContainers
  );

export const fetchImages = async () =>
  withMockFallback(
    async () => {
      const { data } = await apiClient.get<DockerImage[]>("/images");
      return data;
    },
    () => mockImages
  );

export const fetchVolumes = async () =>
  withMockFallback(
    async () => {
      const { data } = await apiClient.get<DockerVolume[]>("/volumes");
      return data;
    },
    () => mockVolumes
  );

export const fetchNetworks = async () =>
  withMockFallback(
    async () => {
      const { data } = await apiClient.get<DockerNetwork[]>("/networks");
      return data;
    },
    () => mockNetworks
  );

export const fetchContainerLogs = async (
  containerId: string,
  options: { tail?: number; since?: string } = {}
) =>
  withMockFallback(
    async () => {
      const { data } = await apiClient.get<DockerLogEntry[]>(`/containers/${containerId}/logs`, {
        params: options
      });

      return data.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    },
    () =>
      mockLogs
        .filter((log) => log.containerId === containerId)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  );

export const fetchContainerFiles = async (containerId: string, path = "/") =>
  withMockFallback(
    async () => {
      const { data } = await apiClient.get<ContainerFileNode[]>(`/containers/${containerId}/files`, {
        params: { path }
      });
      return data;
    },
    () =>
      mockFiles.map((file) => ({
        ...file,
        path: `${path === "/" ? "" : path}/${file.name}`.replace(/\/\//g, "/")
      }))
  );

export const executeContainerCommand = async (containerId: string, command: string[]) =>
  withMockFallback(
    async () => {
      const { data } = await apiClient.post<{ output: string }>(`/containers/${containerId}/exec`, {
        command
      });

      return data.output;
    },
    () => `Executed ${command.join(" ")} inside ${containerId}`
  );

export const removeImage = async (imageId: string) => {
  if (useMockData) {
    return true;
  }

  await apiClient.delete(`/images/${imageId}`);
  return true;
};

export const removeContainer = async (containerId: string) => {
  if (useMockData) {
    return true;
  }

  await apiClient.delete(`/containers/${containerId}`);
  return true;
};

export const pruneVolumes = async () => {
  if (useMockData) {
    return true;
  }

  await apiClient.post("/volumes/prune");
  return true;
};

interface AttachLogOptions {
  since?: string;
  intervalMs?: number;
}

export const attachToContainerLogs = (
  containerId: string,
  onLog: (log: DockerLogEntry) => void,
  options: AttachLogOptions = {}
) => {
  if (useMockData) {
    const interval = setInterval(() => {
      const log: DockerLogEntry = {
        id: `mock-${Date.now()}`,
        containerId,
        timestamp: new Date().toISOString(),
        level: "info",
        message: "Heartbeat: container is running"
      };
      onLog(log);
    }, options.intervalMs ?? 5000);

    return () => clearInterval(interval);
  }

  let disposed = false;
  let timer: NodeJS.Timeout | null = null;
  let lastSeen = options.since ? Date.parse(options.since) : undefined;

  const poll = async () => {
    if (disposed) {
      return;
    }

    try {
      const params: Record<string, string | number> = {};
      if (lastSeen) {
        params.since = new Date(lastSeen).toISOString();
      }

      const { data } = await apiClient.get<DockerLogEntry[]>(`/containers/${containerId}/logs`, {
        params
      });

      if (data.length) {
        const ordered = data.sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        ordered.forEach((log) => {
          const timestamp = Date.parse(log.timestamp);
          if (!Number.isFinite(timestamp)) {
            return;
          }

          if (!lastSeen || timestamp > lastSeen) {
            lastSeen = timestamp;
            onLog(log);
          }
        });
      }
    } catch (error) {
      console.error(`Failed to stream logs for ${containerId}`, error);
    } finally {
      if (!disposed) {
        timer = setTimeout(poll, options.intervalMs ?? 4000);
      }
    }
  };

  poll();

  return () => {
    disposed = true;
    if (timer) {
      clearTimeout(timer);
    }
  };
};

export type {
  DockerContainer,
  DockerImage,
  DockerVolume,
  DockerNetwork,
  DockerLogEntry,
  ContainerFileNode
} from "@/types/docker";
