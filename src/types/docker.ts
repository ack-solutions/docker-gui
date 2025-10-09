export interface DockerContainer {
  id: string;
  name: string;
  project?: string | null;
  service?: string | null;
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

export type DockerRestartPolicy = "no" | "always" | "on-failure" | "unless-stopped";

export interface ContainerPortBindingInput {
  containerPort: number;
  hostPort?: number;
  protocol?: "tcp" | "udp";
  hostIp?: string | null;
}

export interface ContainerEnvVarInput {
  key: string;
  value?: string;
}

export interface CreateContainerRequest {
  image: string;
  name?: string;
  command?: string;
  env?: ContainerEnvVarInput[];
  ports?: ContainerPortBindingInput[];
  autoStart?: boolean;
  restartPolicy?: DockerRestartPolicy;
}

export interface DockerHealthLogEntry {
  start: string;
  end: string;
  exitCode: number;
  output: string;
}

export interface DockerContainerInspect {
  id: string;
  name: string;
  createdAt: string;
  path: string;
  args: string[];
  image: string;
  imageId: string;
  platform?: string;
  driver?: string;
  config: {
    hostname?: string;
    domainname?: string;
    user?: string;
    env: string[];
    cmd: string[];
    entrypoint: string[];
    workingDir?: string;
    labels: Record<string, string>;
  };
  state: {
    status: string;
    running: boolean;
    paused: boolean;
    restarting: boolean;
    oomKilled: boolean;
    dead: boolean;
    pid: number;
    exitCode: number;
    restartCount?: number;
    startedAt?: string;
    finishedAt?: string;
    health?: {
      status?: string;
      failingStreak?: number;
      log: DockerHealthLogEntry[];
    };
  };
  networkSettings: {
    ipAddress?: string;
    macAddress?: string;
    networks: Record<string, {
      ipAddress?: string;
      macAddress?: string;
      gateway?: string;
      globalIPv6Address?: string;
      ipv6Gateway?: string;
    }>;
    ports?: Record<string, Array<{ hostIp?: string; hostPort?: string }> | null>;
  };
  mounts: Array<{
    type?: string;
    source?: string;
    destination: string;
    mode?: string;
    rw?: boolean;
    propagation?: string;
    name?: string | null;
    driver?: string;
  }>;
  hostConfig: {
    networkMode?: string;
    restartPolicy?: {
      name?: string;
      maximumRetryCount?: number;
    };
    binds?: string[];
    extraHosts?: string[];
    logConfig?: {
      type?: string;
      config?: Record<string, string>;
    };
    portBindings?: Record<string, Array<{ hostIp?: string; hostPort?: string }>>;
  };
}

export interface DockerImageHistoryEntry {
  id: string;
  created: string;
  createdBy?: string;
  comment?: string;
  tags: string[];
  size: number;
}

export interface DockerImageInspect {
  id: string;
  repoTags: string[];
  repoDigests: string[];
  size: number;
  virtualSize: number;
  createdAt: string;
  author?: string;
  architecture?: string;
  os?: string;
  osVersion?: string;
  dockerVersion?: string;
  variant?: string;
  config: {
    env: string[];
    cmd: string[];
    entrypoint: string[];
    workingDir?: string;
    user?: string;
    labels: Record<string, string>;
    exposedPorts: string[];
  };
  rootFS: {
    type?: string;
    layers: string[];
    diffIds: string[];
  };
  history: DockerImageHistoryEntry[];
  layers: Array<{
    digest: string;
    size: number;
    createdAt?: string;
  }>;
}
