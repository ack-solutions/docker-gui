"use client";

import { useMemo, useState } from "react";
import RefreshIcon from "@mui/icons-material/Refresh";
import MemoryIcon from "@mui/icons-material/Memory";
import StorageIcon from "@mui/icons-material/Storage";
import SettingsIcon from "@mui/icons-material/Settings";
import SpeedIcon from "@mui/icons-material/Speed";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  Skeleton,
  Stack,
  Tooltip,
  Typography
} from "@mui/material";
import Grid from "@mui/material/Grid";
import { useTheme } from "@mui/material/styles";
import { useContainerMetrics } from "@/features/docker/containers/hooks/use-containers";
import { useSystemMetrics } from "@/features/system/hooks/use-system-metrics";
import MetricCardWithChart from "@/features/system/components/metric-card-with-chart";
import ResourceDetailsDialog from "@/features/system/components/resource-details-dialog";
import ContainerStatsCard from "@/features/docker/components/container-stats-card";
import QuickStatsCard from "@/features/system/components/quick-stats-card";
import ResourceAllocationCard from "@/features/system/components/resource-allocation-card";
import RecentLogsCard from "@/features/system/components/recent-logs-card";
import MetricsSettingsDialog from "@/features/system/components/metrics-settings-dialog";

const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;

  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[exponent]}`;
};

const formatRelativeTime = (timestamp: number | null) => {
  if (!timestamp) {
    return "never";
  }

  const diffSeconds = Math.max(Math.floor((Date.now() - timestamp) / 1000), 0);

  if (diffSeconds < 5) {
    return "just now";
  }
  if (diffSeconds < 60) {
    return `${diffSeconds}s ago`;
  }

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
};

const LoadingSkeleton = () => (
      <Grid container spacing={2.5}>
        {Array.from({ length: 4 }).map((_, index) => (
          <Grid key={index} size={{ xs: 12, sm: 6, lg: 3 }}>
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
  const [settingsOpen, setSettingsOpen] = useState(false);

  const {
    metrics: systemMetrics,
    status,
    history,
    isFetching: isMetricsFetching,
    lastFetchedAt,
    error: metricsError,
    refetch: refetchSystemMetrics
  } = useSystemMetrics();
  const { data: containers = [], metrics: containerMetrics } = useContainerMetrics({ refetchIntervalMs: 10_000 });

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
          value: point.diskUsagePercent ?? 0
        })),
    [history]
  );

  const lastUpdatedLabel = useMemo(() => formatRelativeTime(lastFetchedAt), [lastFetchedAt]);
  const lastUpdatedExact = useMemo(
    () => (lastFetchedAt ? new Date(lastFetchedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : null),
    [lastFetchedAt]
  );

  const isInitialLoading = status === "idle" || (status === "loading" && !systemMetrics);
  const showErrorBanner = status === "failed" && metricsError && !systemMetrics;

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", md: "center" }}
        gap={2}
      >
        <Box>
          <Typography variant="h5" fontWeight={600}>
            Operational Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Live view of host performance, Docker workloads, and recent activity.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <Tooltip title={lastUpdatedExact ? `Last updated at ${lastUpdatedExact}` : "No metrics collected yet"}>
            <Chip
              size="small"
              variant="outlined"
              color={isMetricsFetching ? "primary" : "default"}
              label={isMetricsFetching ? "Updating…" : `Updated ${lastUpdatedLabel}`}
            />
          </Tooltip>
          <Tooltip title="Refresh metrics now">
            <span>
              <Button
                size="small"
                variant="outlined"
                startIcon={<RefreshIcon fontSize="small" />}
                disabled={isMetricsFetching}
                onClick={() => {
                  void refetchSystemMetrics();
                }}
              >
                Refresh
              </Button>
            </span>
          </Tooltip>
          <Tooltip title="Metrics settings">
            <IconButton size="small" onClick={() => setSettingsOpen(true)}>
              <SettingsIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      {showErrorBanner ? (
        <Alert severity="error" variant="outlined">
          {metricsError?.message ?? "Unable to collect system metrics. Check the server agent and try again."}
        </Alert>
      ) : null}

      {isInitialLoading ? (
        <LoadingSkeleton />
      ) : systemMetrics ? (
        <>
          <Grid container spacing={2.5}>
          <Grid size={{ xs: 12, md: 6, lg: 4 }}>
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

          <Grid size={{ xs: 12, md: 6, lg: 4 }}>
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

            <Grid size={{ xs: 12, md: 6, lg: 4 }}>
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
          </Grid>

          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, md: 6 }}>
              <QuickStatsCard
                metrics={systemMetrics}
                containerCount={containerMetrics.running + containerMetrics.stopped}
                runningContainers={containerMetrics.running}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <ResourceAllocationCard
                metrics={systemMetrics}
                totalContainerCpu={containerMetrics.totalCpu}
                totalContainerMemory={containerMetrics.totalMemory}
              />
            </Grid>
          </Grid>

          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, md: 6, lg: 4 }}>
              <ContainerStatsCard containers={containers} />
            </Grid>
            <Grid size={{ xs: 12, md: 6, lg: 8 }}>
              <RecentLogsCard autoRefreshIntervalMs={30_000} />
            </Grid>
          </Grid>

        </>
      ) : (
        <Card>
          <CardContent sx={{ textAlign: "center" }}>
            <Stack spacing={2} alignItems="center">
              <Typography variant="h6">No metrics available</Typography>
              <Typography variant="body2" color="text.secondary">
                We could not retrieve any system metrics yet. Ensure the metrics service is running and try again.
              </Typography>
              <Button
                variant="contained"
                size="small"
                onClick={() => {
                  void refetchSystemMetrics();
                }}
              >
                Retry now
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}

      <ResourceDetailsDialog
        open={dialogType !== null}
        onClose={() => setDialogType(null)}
        metrics={systemMetrics ?? null}
        type={dialogType ?? "cpu"}
      />

      <MetricsSettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </Stack>
  );
};

const DashboardPage = () => {
  return <DashboardPageContent />;
};

export default DashboardPage;
