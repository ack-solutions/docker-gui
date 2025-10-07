"use client";

import { useEffect, useState } from "react";
import { ContainerFileNode, fetchContainerFiles } from "@/lib/api/docker";

interface UseFilesOptions {
  containerId: string;
  path: string;
  refreshToken?: number;
}

export const useFiles = ({ containerId, path, refreshToken = 0 }: UseFilesOptions) => {
  const [nodes, setNodes] = useState<ContainerFileNode[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    fetchContainerFiles(containerId, path)
      .then(setNodes)
      .finally(() => setIsLoading(false));
  }, [containerId, path, refreshToken]);

  return { nodes, isLoading };
};
