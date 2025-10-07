"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { DockerImage, fetchImages } from "@/lib/api/docker";

export const imageQueryKeys = {
  all: ["images"] as const
};

export const useImages = () =>
  useQuery<DockerImage[]>({
    queryKey: imageQueryKeys.all,
    queryFn: fetchImages
  });

export const useImageStorage = () => {
  const { data, ...rest } = useImages();

  const storage = useMemo(() => {
    if (!data) {
      return { totalSize: 0, count: 0 };
    }

    const totalSize = data.reduce((sum, image) => sum + image.size, 0);
    return { totalSize, count: data.length };
  }, [data]);

  return { data, storage, ...rest };
};
