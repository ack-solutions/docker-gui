"use client";

import { useQuery } from "@tanstack/react-query";
import { DockerVolume, fetchVolumes } from "@/lib/api/docker";

export const volumeQueryKeys = {
  all: ["volumes"] as const
};

export const useVolumes = () =>
  useQuery<DockerVolume[]>({
    queryKey: volumeQueryKeys.all,
    queryFn: fetchVolumes
  });
