"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchContainerInspect } from "@/lib/api/docker";
import { containerQueryKeys } from "@/features/docker/containers/constants";
import type { DockerContainerInspect } from "@/types/docker";

export const useContainerInspect = (containerId: string | undefined) => {
  return useQuery<DockerContainerInspect>({
    queryKey: containerQueryKeys.detail(containerId ?? ""),
    queryFn: () => {
      if (!containerId) {
        return Promise.reject(new Error("Container id is required"));
      }
      return fetchContainerInspect(containerId);
    },
    enabled: Boolean(containerId)
  });
};
