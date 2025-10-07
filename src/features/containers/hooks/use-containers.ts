"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { DockerContainer, fetchContainers } from "@/lib/api/docker";

export const containerQueryKeys = {
  all: ["containers"] as const
};

export const useContainers = () =>
  useQuery<DockerContainer[]>({
    queryKey: containerQueryKeys.all,
    queryFn: fetchContainers
  });

export const useContainerMetrics = () => {
  const { data, ...rest } = useContainers();

  const metrics = useMemo(() => {
    if (!data) {
      return {
        running: 0,
        stopped: 0,
        totalCpu: 0,
        totalMemory: 0
      };
    }

    const running = data.filter((container) => container.state === "running").length;
    const stopped = data.length - running;
    const totalCpu = data.reduce((sum, container) => sum + container.cpuUsage, 0);
    const totalMemory = data.reduce((sum, container) => sum + container.memoryUsage, 0);

    return { running, stopped, totalCpu, totalMemory };
  }, [data]);

  return { data, metrics, ...rest };
};
