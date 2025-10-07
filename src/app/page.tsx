"use client";

import { ReactNode } from "react";
import InsightsIcon from "@mui/icons-material/Insights";
import LanIcon from "@mui/icons-material/Lan";
import LayersIcon from "@mui/icons-material/Layers";
import TerminalIcon from "@mui/icons-material/Terminal";
import { Box, Paper, Stack, Typography } from "@mui/material";
import Grid from "@mui/material/GridLegacy";
import ContainerList from "@/features/containers/components/container-list";
import { useContainerMetrics } from "@/features/containers/hooks/use-containers";
import { useImageStorage } from "@/features/images/hooks/use-images";
import { useNetworks } from "@/features/networks/hooks/use-networks";
import { useVolumes } from "@/features/volumes/hooks/use-volumes";

const OverviewMetric = ({ label, value, icon }: { label: string; value: string; icon: ReactNode }) => (
  <Paper sx={{ p: 3, borderRadius: 3, height: "100%" }}>
    <Stack direction="row" spacing={2} alignItems="center">
      <Box
        sx={{
          width: 48,
          height: 48,
          borderRadius: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "rgba(56, 189, 248, 0.16)"
        }}
      >
        {icon}
      </Box>
      <Box>
        <Typography variant="h5" fontWeight={700}>
          {value}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
      </Box>
    </Stack>
  </Paper>
);

const DashboardPage = () => {
  const { metrics } = useContainerMetrics();
  const { storage } = useImageStorage();
  const { data: networks } = useNetworks();
  const { data: volumes } = useVolumes();

  return (
    <Stack spacing={4}>
      <Grid container spacing={3}>
        <Grid item xs={12} md={3}>
          <OverviewMetric
            label="Running containers"
            value={`${metrics.running}`}
            icon={<InsightsIcon color="primary" />}
          />
        </Grid>
        <Grid item xs={12} md={3}>
          <OverviewMetric label="Stopped containers" value={`${metrics.stopped}`} icon={<TerminalIcon color="warning" />} />
        </Grid>
        <Grid item xs={12} md={3}>
          <OverviewMetric
            label="Image storage"
            value={`${(storage.totalSize / (1024 * 1024 * 1024)).toFixed(2)} GB`}
            icon={<LayersIcon color="secondary" />}
          />
        </Grid>
        <Grid item xs={12} md={3}>
          <OverviewMetric
            label="Networks"
            value={`${networks?.length ?? 0}`}
            icon={<LanIcon color="success" />}
          />
        </Grid>
      </Grid>
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Typography variant="h6" gutterBottom>
            Active Containers
          </Typography>
          <ContainerList />
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, borderRadius: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Resource Snapshot
            </Typography>
            <Stack spacing={1}>
              <Typography variant="body2" color="text.secondary">
                Total CPU usage across running containers: {metrics.totalCpu.toFixed(1)}%
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total memory consumption: {metrics.totalMemory.toFixed(0)} MiB
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Persistent volumes provisioned: {volumes?.length ?? 0}
              </Typography>
            </Stack>
          </Paper>
          <Paper sx={{ p: 3, borderRadius: 3 }}>
            <Typography variant="h6" gutterBottom>
              Quick Tips
            </Typography>
            <Stack spacing={1}>
              <Typography variant="body2" color="text.secondary">
                Configure <code>NEXT_PUBLIC_DOCKER_API_URL</code> to point to your Docker Engine or remote daemon.
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Use the logs tab to follow live container output and debug deployments rapidly.
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Volume pruning removes unused data—review before executing destructive operations.
              </Typography>
            </Stack>
          </Paper>
        </Grid>
      </Grid>
    </Stack>
  );
};

export default DashboardPage;
