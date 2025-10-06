"use client";

import { Stack, Typography } from "@mui/material";
import ImageList from "@/features/images/components/ImageList";

const ImagesPage = () => {
  return (
    <Stack spacing={3}>
      <Typography variant="h5" fontWeight={700}>
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
