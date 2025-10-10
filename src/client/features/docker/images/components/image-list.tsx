"use client";

import { Paper, Stack, Typography } from "@mui/material";
import EmptyState from "@/components/common/empty-state";
import ImageListItem from "@/features/docker/images/components/image-list-item";
import { useImages } from "@/features/docker/images/hooks/use-images";
import { useRouter } from "next/navigation";
import type { DockerImage } from "@/lib/api/docker";

const ImageList = () => {
  const { data, isLoading, isError, error } = useImages();
  const router = useRouter();
  const images = data as DockerImage[] | undefined;

  if (isError && (!images || images.length === 0)) {
    return (
      <Paper sx={{ p: 4 }}>
        <Typography variant="subtitle1" gutterBottom>
          Unable to load images
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {error instanceof Error ? error.message : "Check your Docker connection and try again."}
        </Typography>
      </Paper>
    );
  }

  if (!isLoading && (!images || images.length === 0)) {
    return (
      <EmptyState
        title="No images available"
        description="Pull images from registries or build a new image to get started."
      />
    );
  }

  return (
    <Stack spacing={2.5}>
      {isLoading && (!images || images.length === 0)
        ? Array.from({ length: 4 }).map((_, index) => <ImageListItem key={`image-skeleton-${index}`} />)
        : images?.map((image) => (
            <ImageListItem
              key={image.id}
              image={image}
              onOpenDetails={(imageId) => router.push(`/docker/images/${encodeURIComponent(imageId)}`)}
            />
          ))}
    </Stack>
  );
};

export default ImageList;
