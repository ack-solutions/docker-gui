"use client";

import { useContext, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { DockerContainer, fetchContainers } from "@/lib/api/docker";
import { containerQueryKeys } from "@/features/docker/containers/constants";
import ContainerContext from "@/features/docker/containers/context/container-provider";

export const useContainers = () => {
  const context = useContext(ContainerContext);
  const query = useQuery<DockerContainer[]>({
    queryKey: containerQueryKeys.all,
    queryFn: fetchContainers,
    enabled: !context
  });

  return context ? context.query : query;
};

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
