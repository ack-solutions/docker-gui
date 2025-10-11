import apiClient from "@/lib/api/client";
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

export const fetchContainers = async () => {
  const { data } = await apiClient.get<DockerContainer[]>("/docker/containers");
  return data;
};

export const fetchImages = async () => {
  const { data } = await apiClient.get<DockerImage[]>("/docker/images");
  return data;
};

export const fetchVolumes = async () => {
  const { data } = await apiClient.get<DockerVolume[]>("/docker/volumes");
  return data;
};

export const fetchNetworks = async () => {
  const { data } = await apiClient.get<DockerNetwork[]>("/docker/networks");
  return data;
};

export const fetchContainerLogs = async (
  containerId: string,
  options: { tail?: number; since?: string } = {}
) => {
  const { data } = await apiClient.get<DockerLogEntry[]>(`/docker/containers/${containerId}/logs`, {
    params: options
  });

  return data.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
};

export const fetchContainerFiles = async (containerId: string, path = "/") => {
  const { data } = await apiClient.get<ContainerFileNode[]>(`/docker/containers/${containerId}/files`, {
    params: { path }
  });
  return data;
};

export const executeContainerCommand = async (containerId: string, command: string[]) => {
  const { data } = await apiClient.post<{ output: string }>(`/docker/containers/${containerId}/exec`, {
    command
  });

  return data.output;
};

export const removeImage = async (imageId: string) => {
  await apiClient.delete(`/docker/images/${imageId}`);
  return true;
};

export const removeContainer = async (containerId: string) => {
  await apiClient.delete(`/docker/containers/${containerId}`);
  return true;
};

export const startContainer = async (containerId: string) => {
  await apiClient.post(`/docker/containers/${containerId}/start`);
  return true;
};

export const stopContainer = async (containerId: string) => {
  await apiClient.post(`/docker/containers/${containerId}/stop`);
  return true;
};

export const restartContainer = async (containerId: string) => {
  await apiClient.post(`/docker/containers/${containerId}/restart`);
  return true;
};

export const createContainer = async (payload: CreateContainerRequest) => {
  const { data } = await apiClient.post<DockerContainer>("/docker/containers", payload);
  return data;
};

export const pruneStoppedContainers = async () => {
  const { data } = await apiClient.post<DockerPruneSummary>("/docker/containers/prune");
  return data;
};

export const pruneUnusedImages = async () => {
  const { data } = await apiClient.post<DockerPruneSummary>("/docker/images/prune");
  return data;
};

export const pruneVolumes = async () => {
  const { data } = await apiClient.post<DockerPruneSummary>("/docker/volumes/prune");
  return data;
};

export const pullImage = async (image: string) => {
  const { data } = await apiClient.post<{ success: boolean; image: string }>("/docker/images/pull", {
    image
  });
  return data;
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

      const { data } = await apiClient.get<DockerLogEntry[]>(`/docker/containers/${containerId}/logs`, {
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

export const fetchContainerInspect = async (containerId: string) => {
  const { data } = await apiClient.get<DockerContainerInspect>(`/docker/containers/${containerId}/inspect`);
  return data;
};

export const fetchImageInspect = async (imageId: string) => {
  const { data } = await apiClient.get<DockerImageInspect>(`/docker/images/${imageId}/inspect`);
  return data;
};

export type {
  DockerContainer,
  DockerImage,
  DockerVolume,
  DockerNetwork,
  DockerLogEntry,
  ContainerFileNode,
  DockerContainerInspect,
  DockerImageInspect
} from "@/types/docker";
