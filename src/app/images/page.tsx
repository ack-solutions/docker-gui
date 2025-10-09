"use client";

import { Stack, Typography } from "@mui/material";
import ImageList from "@/features/docker/images/components/image-list";

const ImagesPage = () => {
  return (
    <Stack spacing={3}>
      <Typography variant="h5">
        Image Management
      </Typography>
      <Typography variant="body1" color="text.secondary">
        Inspect, export, and remove Docker images. Track disk usage and keep your registries tidy.
      </Typography>
      <ImageList />
    </Stack>
  );
};

export default ImagesPage;
