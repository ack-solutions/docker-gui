"use client";

import { Stack, Typography } from "@mui/material";
import ContainerList from "@/features/containers/components/container-list";

const ContainersPage = () => {
  return (
    <Stack spacing={3}>
      <Typography variant="h5">
        Container Management
      </Typography>
      <Typography variant="body1" color="text.secondary">
        Start, stop, and inspect your Docker containers. Interact with logs, resource usage, and shell access to keep services healthy.
      </Typography>
      <ContainerList />
    </Stack>
  );
};

export default ContainersPage;
