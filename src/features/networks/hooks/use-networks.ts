"use client";

import { useQuery } from "@tanstack/react-query";
import { DockerNetwork, fetchNetworks } from "@/lib/api/docker";

export const networkQueryKeys = {
  all: ["networks"] as const
};

export const useNetworks = () =>
  useQuery<DockerNetwork[]>({
    queryKey: networkQueryKeys.all,
    queryFn: fetchNetworks
  });
