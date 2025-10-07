export interface DockerContainer {
  id: string;
  name: string;
  image: string;
  state: "running" | "exited" | "paused" | "created" | "restarting" | "removing" | "dead";
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

export interface DockerPruneSummary {
  removedCount: number;
  reclaimedSpace: number;
}
