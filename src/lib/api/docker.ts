import axios from "axios";

export interface DockerContainer {
  id: string;
  name: string;
  image: string;
  state: "running" | "exited" | "paused" | "created";
  status: string;
  ports: string[];
  createdAt: string;
  cpuUsage: number;
  memoryUsage: number;
}

export interface DockerImage {
  id: string;
  repoTags: string[];
  size: number;
  createdAt: string;
  containers: number;
}

export interface DockerVolume {
  name: string;
  driver: string;
  mountpoint: string;
  createdAt: string;
  size: string;
}

export interface DockerNetwork {
  id: string;
  name: string;
  driver: string;
  scope: string;
  createdAt: string;
  containers: number;
}

export interface DockerLogEntry {
  id: string;
  containerId: string;
  timestamp: string;
  message: string;
  level: "info" | "warn" | "error";
}

export interface ContainerFileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  size: number;
  modifiedAt: string;
}

const dockerApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_DOCKER_API_URL ?? "http://localhost:2375",
  timeout: 15000
});

const useMockData = process.env.NEXT_PUBLIC_USE_MOCKS !== "false";

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
    size: 134217728,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    containers: 2
  },
  {
    id: "sha256:456",
    repoTags: ["node:20-alpine"],
    size: 256000000,
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

const withMockFallback = async <T,>(request: () => Promise<T>, mockValue: T): Promise<T> => {
  if (useMockData) {
    return mockValue;
  }

  try {
    return await request();
  } catch (error) {
    console.error("Failed to communicate with Docker API", error);
    return mockValue;
  }
};

export const fetchContainers = async () =>
  withMockFallback(async () => {
    const { data } = await dockerApi.get<DockerContainer[]>("/containers/json", { params: { all: true } });
    return data;
  }, mockContainers);

export const fetchImages = async () =>
  withMockFallback(async () => {
    const { data } = await dockerApi.get<DockerImage[]>("/images/json");
    return data;
  }, mockImages);

export const fetchVolumes = async () =>
  withMockFallback(async () => {
    const { data } = await dockerApi.get<{ Volumes: DockerVolume[] }>("/volumes");
    return data.Volumes;
  }, mockVolumes);

export const fetchNetworks = async () =>
  withMockFallback(async () => {
    const { data } = await dockerApi.get<DockerNetwork[]>("/networks");
    return data;
  }, mockNetworks);

export const fetchContainerLogs = async (containerId: string) =>
  withMockFallback(async () => {
    const { data } = await dockerApi.get<string>(`/containers/${containerId}/logs`, {
      params: { stdout: true, stderr: true, timestamps: true, tail: 500 }
    });

    return data
      .split("\n")
      .filter(Boolean)
      .map((line, index) => ({
        id: `${containerId}-log-${index}`,
        containerId,
        timestamp: line.slice(0, 30),
        message: line.slice(31),
        level: "info" as const
      }));
  }, mockLogs.filter((log) => log.containerId === containerId));

export const fetchContainerFiles = async (containerId: string, path = "/") =>
  withMockFallback(async () => {
    const { data } = await dockerApi.get<ContainerFileNode[]>(`/containers/${containerId}/archive`, {
      params: { path }
    });
    return data;
  }, mockFiles.map((file) => ({ ...file, path: `${path}${file.name}` })));

export const executeContainerCommand = async (containerId: string, command: string[]) =>
  withMockFallback(async () => {
    const { data } = await dockerApi.post<{ Output: string }>(`/containers/${containerId}/exec`, { Cmd: command });
    return data.Output;
  }, `Executed ${command.join(" ")} inside ${containerId}`);

export const removeImage = async (imageId: string) =>
  withMockFallback(async () => {
    await dockerApi.delete(`/images/${imageId}`);
    return true;
  }, true);

export const removeContainer = async (containerId: string) =>
  withMockFallback(async () => {
    await dockerApi.delete(`/containers/${containerId}`, { params: { force: true } });
    return true;
  }, true);

export const pruneVolumes = async () =>
  withMockFallback(async () => {
    await dockerApi.post("/volumes/prune");
    return true;
  }, true);

export const attachToContainerLogs = (containerId: string, onLog: (log: DockerLogEntry) => void) => {
  let interval: NodeJS.Timeout | undefined;

  if (useMockData) {
    interval = setInterval(() => {
      const nextLog: DockerLogEntry = {
        id: `live-${Date.now()}`,
        containerId,
        timestamp: new Date().toISOString(),
        level: "info",
        message: "Heartbeat: container is running"
      };
      onLog(nextLog);
    }, 5000);
  }

  return () => {
    if (interval) {
      clearInterval(interval);
    }
  };
};
