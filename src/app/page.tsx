"use client";

import { ReactNode } from "react";
import InsightsIcon from "@mui/icons-material/Insights";
import LanIcon from "@mui/icons-material/Lan";
import LayersIcon from "@mui/icons-material/Layers";
import TerminalIcon from "@mui/icons-material/Terminal";
import { Avatar, Box, Chip, Divider, Paper, Stack, Typography } from "@mui/material";
import Grid from "@mui/material/GridLegacy";
import { styled } from "@mui/material/styles";
import ContainerList from "@/features/containers/components/container-list";
import { useContainerMetrics } from "@/features/containers/hooks/use-containers";
import { useImageStorage } from "@/features/images/hooks/use-images";
import { useNetworks } from "@/features/networks/hooks/use-networks";
import { useVolumes } from "@/features/volumes/hooks/use-volumes";

const MetricCard = styled(Paper)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(2),
  padding: theme.spacing(2.5),
  borderRadius:
    typeof theme.shape.borderRadius === "number"
      ? theme.shape.borderRadius * 2
      : theme.shape.borderRadius
}));

const MetricIcon = styled(Avatar)(({ theme }) => ({
  backgroundColor: theme.palette.mode === "dark" ? "rgba(56, 189, 248, 0.16)" : theme.palette.primary.light,
  width: 44,
  height: 44
}));

const OverviewMetric = ({ label, value, icon }: { label: string; value: string; icon: ReactNode }) => (
  <MetricCard elevation={0}>
    <MetricIcon variant="rounded">{icon}</MetricIcon>
    <Box>
      <Typography variant="h5">
        {value}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
    </Box>
  </MetricCard>
);

const activityFeed = [
  { id: "deploy-1", title: "api-gateway redeploy", time: "2 minutes ago", detail: "Image node:20-alpine" },
  { id: "deploy-2", title: "postgres backup", time: "24 minutes ago", detail: "Snapshot stored to volume" },
  { id: "deploy-3", title: "redis cache prune", time: "1 hour ago", detail: "Reclaimed 1.8 GB" }
];

const upcomingJobs = [
  { id: "job-1", label: "nightly-report", schedule: "Today · 22:00", status: "ready" },
  { id: "job-2", label: "image-cleanup", schedule: "Tomorrow · 03:00", status: "queued" }
];

const DashboardPage = () => {
  const { metrics } = useContainerMetrics();
  const { storage } = useImageStorage();
  const { data: networks } = useNetworks();
  const { data: volumes } = useVolumes();

  return (
    <Stack spacing={3.5}>
      <Grid container spacing={2.5}>
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
      <Grid container spacing={2.5}>
        <Grid item xs={12} lg={8}>
          <Paper sx={{ mb: 2.5, display: "flex", flexDirection: "column", gap: 1.5 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography variant="h6">Active containers</Typography>
              <Chip size="small" label={`${metrics.running + metrics.stopped} total`} color="primary" variant="outlined" />
            </Stack>
            <ContainerList />
          </Paper>
        </Grid>
        <Grid item xs={12} lg={4}>
          <Paper sx={{ mb: 2.5 }}>
            <Typography variant="h6" gutterBottom>
              Resource snapshot
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
              <Typography variant="body2" color="text.secondary">
                Networks configured: {networks?.length ?? 0}
              </Typography>
            </Stack>
          </Paper>
          <Paper sx={{ mb: 2.5 }}>
            <Typography variant="h6" gutterBottom>
              Recent activity
            </Typography>
            <Stack spacing={1.5}>
              {activityFeed.map((item) => (
                <Box key={item.id}>
                  <Typography variant="subtitle2">
                    {item.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {item.detail}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {item.time}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </Paper>
          <Paper>
            <Typography variant="h6" gutterBottom>
              Upcoming jobs
            </Typography>
            <Stack spacing={1.5}>
              {upcomingJobs.map((job) => (
                <Stack key={job.id} direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="subtitle2">
                      {job.label}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {job.schedule}
                    </Typography>
                  </Box>
                  <Chip size="small" label={job.status} variant="outlined" />
                </Stack>
              ))}
            </Stack>
          </Paper>
        </Grid>
      </Grid>
    </Stack>
  );
};

export default DashboardPage;
