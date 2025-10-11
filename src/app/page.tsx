"use client";

import { useState, useMemo } from "react";
import MemoryIcon from "@mui/icons-material/Memory";
import StorageIcon from "@mui/icons-material/Storage";
import SpeedIcon from "@mui/icons-material/Speed";
import LayersIcon from "@mui/icons-material/Layers";
import LanIcon from "@mui/icons-material/Lan";
import FolderIcon from "@mui/icons-material/Folder";
import { Box, Card, CardContent, Chip, Grid, Stack, Typography, Skeleton } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import ContainerList from "@/features/docker/containers/components/container-list";
import { useContainerMetrics, useContainers } from "@/features/docker/containers/hooks/use-containers";
import { useImageStorage } from "@/features/docker/images/hooks/use-images";
import { useNetworks } from "@/features/docker/networks/hooks/use-networks";
import { useVolumes } from "@/features/docker/volumes/hooks/use-volumes";
import { useAppSelector } from "@/store/hooks";
import { selectSystemMetrics, selectSystemMetricsStatus, selectSystemMetricsHistory } from "@/store/system/slice";
import MetricCardWithChart from "@/features/system/components/metric-card-with-chart";
import ResourceDetailsDialog from "@/features/system/components/resource-details-dialog";
import ContainerStatsCard from "@/features/docker/components/container-stats-card";
import QuickStatsCard from "@/features/system/components/quick-stats-card";
import ResourceAllocationCard from "@/features/system/components/resource-allocation-card";
import NetworkInfoCard from "@/features/system/components/network-info-card";
import VolumeInfoCard from "@/features/system/components/volume-info-card";

const formatBytes = (bytes: number) => {
  if (bytes === 0) return "0 GB";
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb < 1) {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  }
  return `${gb.toFixed(2)} GB`;
};

const LoadingSkeleton = () => (
  <Grid container spacing={3}>
    {[1, 2, 3, 4].map((i) => (
      <Grid key={i} size={{ xs: 12, sm: 6, lg: 3 }}>
        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Skeleton variant="text" width="60%" />
              <Skeleton variant="rectangular" height={80} />
            </Stack>
          </CardContent>
        </Card>
      </Grid>
    ))}
  </Grid>
);

const DashboardPageContent = () => {
  const theme = useTheme();
  const [dialogType, setDialogType] = useState<"cpu" | "memory" | "disk" | null>(null);

  const systemMetrics = useAppSelector(selectSystemMetrics);
  const systemStatus = useAppSelector(selectSystemMetricsStatus);
  const history = useAppSelector(selectSystemMetricsHistory);

  const { metrics: containerMetrics } = useContainerMetrics();
  const { data: containers } = useContainers();
  const { storage } = useImageStorage();
  const { data: networks } = useNetworks();
  const { data: volumes } = useVolumes();

  const cpuChartData = useMemo(
    () =>
      history.slice(-60).map((point) => ({
        timestamp: new Date(point.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        value: point.cpuUsagePercent
      })),
    [history]
  );

  const memoryChartData = useMemo(
    () =>
      history.slice(-60).map((point) => ({
        timestamp: new Date(point.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        value: point.memoryUsagePercent
      })),
    [history]
  );

  const diskChartData = useMemo(
    () =>
      history
        .filter((point) => point.diskUsagePercent !== null)
        .slice(-60)
        .map((point) => ({
          timestamp: new Date(point.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          value: point.diskUsagePercent || 0
        })),
    [history]
  );

  const isLoading = systemStatus === "idle" || systemStatus === "loading";

  if (isLoading && !systemMetrics) {
    return <LoadingSkeleton />;
  }

  if (!systemMetrics) {
    return (
      <Box sx={{ p: 4, textAlign: "center" }}>
        <Typography variant="h6" color="text.secondary">
          Unable to load system metrics
        </Typography>
      </Box>
    );
  }

  return (
    <Stack spacing={3}>
      {/* Top Metrics Row */}
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <MetricCardWithChart
            title="CPU Usage"
            value={`${systemMetrics.cpu.overallUsagePercent.toFixed(1)}%`}
            subtitle={`Load: ${systemMetrics.cpu.loadAverage[0].toFixed(2)}`}
            icon={<SpeedIcon />}
            chartData={cpuChartData}
            color={theme.palette.primary.main}
            onClick={() => setDialogType("cpu")}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <MetricCardWithChart
            title="Memory Usage"
            value={`${systemMetrics.memory.usagePercent.toFixed(1)}%`}
            subtitle={`${formatBytes(systemMetrics.memory.usedBytes)} / ${formatBytes(systemMetrics.memory.totalBytes)}`}
            icon={<MemoryIcon />}
            chartData={memoryChartData}
            color={theme.palette.secondary.main}
            onClick={() => setDialogType("memory")}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <MetricCardWithChart
            title="Disk Usage"
            value={systemMetrics.disks ? `${systemMetrics.disks.usagePercent.toFixed(1)}%` : "N/A"}
            subtitle={
              systemMetrics.disks
                ? `${formatBytes(systemMetrics.disks.usedBytes)} / ${formatBytes(systemMetrics.disks.totalBytes)}`
                : "Not available"
            }
            icon={<StorageIcon />}
            chartData={diskChartData}
            color={theme.palette.success.main}
            onClick={systemMetrics.disks ? () => setDialogType("disk") : undefined}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Docker Resources
              </Typography>
              <Stack spacing={1.5} flex={1} justifyContent="center">
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Stack direction="row" spacing={1} alignItems="center">
                    <LayersIcon fontSize="small" color="action" />
                    <Typography variant="body2">Images</Typography>
                  </Stack>
                  <Typography variant="h6">{formatBytes(storage.totalSize)}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Stack direction="row" spacing={1} alignItems="center">
                    <LanIcon fontSize="small" color="action" />
                    <Typography variant="body2">Networks</Typography>
                  </Stack>
                  <Typography variant="h6">{networks?.length ?? 0}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Stack direction="row" spacing={1} alignItems="center">
                    <FolderIcon fontSize="small" color="action" />
                    <Typography variant="body2">Volumes</Typography>
                  </Stack>
                  <Typography variant="h6">{volumes?.length ?? 0}</Typography>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Middle Section - Stats and Info */}
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6, lg: 4 }}>
          <ContainerStatsCard containers={containers || []} />
        </Grid>
        <Grid size={{ xs: 12, md: 6, lg: 4 }}>
          <QuickStatsCard
            metrics={systemMetrics}
            containerCount={containerMetrics.running + containerMetrics.stopped}
            runningContainers={containerMetrics.running}
          />
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }}>
          <ResourceAllocationCard
            metrics={systemMetrics}
            totalContainerCpu={containerMetrics.totalCpu}
            totalContainerMemory={containerMetrics.totalMemory}
          />
        </Grid>
      </Grid>

      {/* Additional Info Section - Networks and Volumes */}
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <NetworkInfoCard networks={networks || []} />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <VolumeInfoCard volumes={volumes || []} />
        </Grid>
      </Grid>

      {/* Bottom Section - Container List */}
      <Grid container spacing={3}>
        <Grid size={{ xs: 12 }}>
          <Card>
            <CardContent sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Typography variant="h6">Active Containers</Typography>
                <Stack direction="row" spacing={1}>
                  <Chip
                    size="small"
                    label={`${containerMetrics.running} Running`}
                    color="success"
                    variant="outlined"
                  />
                  <Chip
                    size="small"
                    label={`${containerMetrics.stopped} Stopped`}
                    variant="outlined"
                  />
                </Stack>
              </Stack>
              <ContainerList />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Details Dialog */}
      <ResourceDetailsDialog
        open={dialogType !== null}
        onClose={() => setDialogType(null)}
        metrics={systemMetrics}
        type={dialogType || "cpu"}
      />
    </Stack>
  );
};

const DashboardPage = () => {
  return <DashboardPageContent />;
};

export default DashboardPage;
