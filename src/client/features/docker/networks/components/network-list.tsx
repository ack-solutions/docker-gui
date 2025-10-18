"use client";

import { Paper, Stack, Typography } from "@mui/material";
import Grid from "@mui/material/Grid2";
import EmptyState from "@/components/common/empty-state";
import { useNetworks } from "@/features/docker/networks/hooks/use-networks";
import NetworkCard from "@/features/docker/networks/components/network-card";
import type { DockerNetwork } from "@/lib/api/docker";

const NetworkList = () => {
  const { data, isLoading, isError, error } = useNetworks();
  const networks = data as DockerNetwork[] | undefined;

  if (isError && (!networks || networks.length === 0)) {
    return (
      <Paper sx={{ p: 4 }}>
        <Typography variant="subtitle1" gutterBottom>
          Unable to load networks
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {error instanceof Error ? error.message : "Check your Docker connection and try again."}
        </Typography>
      </Paper>
    );
  }

  if (!isLoading && (!networks || networks.length === 0)) {
    return (
      <EmptyState
        title="No networks discovered"
        description="Create an overlay or bridge network to connect containers securely."
      />
    );
  }

  return (
    <Grid container spacing={2.5}>
      {isLoading && (!networks || networks.length === 0)
        ? Array.from({ length: 6 }).map((_, index) => (
            <Grid key={`network-skeleton-${index}`} xs={12} md={6} lg={4}>
              <NetworkCard />
            </Grid>
          ))
        : networks?.map((network) => (
            <Grid key={network.id} xs={12} md={6} lg={4}>
              <NetworkCard network={network} />
            </Grid>
          ))}
    </Grid>
  );
};

export default NetworkList;
