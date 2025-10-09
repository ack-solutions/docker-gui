"use client";

import { Stack, Typography } from "@mui/material";
import NetworkList from "@/features/docker/networks/components/network-list";

const NetworksPage = () => {
  return (
    <Stack spacing={3}>
      <Typography variant="h5">
        Network Management
      </Typography>
      <Typography variant="body1" color="text.secondary">
        Visualize Docker networks, understand connectivity, and ensure containers communicate securely.
      </Typography>
      <NetworkList />
    </Stack>
  );
};

export default NetworksPage;
