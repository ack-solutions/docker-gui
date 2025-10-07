"use client";

import { Stack, Typography } from "@mui/material";
import VolumeList from "@/features/volumes/components/volume-list";

const VolumesPage = () => {
  return (
    <Stack spacing={3}>
      <Typography variant="h5">
        Volume Management
      </Typography>
      <Typography variant="body1" color="text.secondary">
        Explore persistent storage, monitor utilization, and prune unused volumes to reclaim disk space.
      </Typography>
      <VolumeList />
    </Stack>
  );
};

export default VolumesPage;
