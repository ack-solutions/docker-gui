"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchImageInspect } from "@/lib/api/docker";
import { imageQueryKeys } from "@/features/docker/images/hooks/use-images";
import type { DockerImageInspect } from "@/types/docker";

export const useImageInspect = (imageId: string | undefined) => {
  return useQuery<DockerImageInspect>({
    queryKey: imageQueryKeys.detail(imageId ?? ""),
    queryFn: () => {
      if (!imageId) {
        return Promise.reject(new Error("Image id is required"));
      }
      return fetchImageInspect(imageId);
    },
    enabled: Boolean(imageId)
  });
};
