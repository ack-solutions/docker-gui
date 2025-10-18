"use client";

import { useMemo } from "react";
import RefreshIcon from "@mui/icons-material/Refresh";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import {
  Box,
  Card,
  CardContent,
  IconButton,
  LinearProgress,
  Skeleton,
  Stack,
  Tooltip,
  Typography
} from "@mui/material";
import Grid from "@mui/material/Grid";
import { styled, useTheme, type Theme } from "@mui/material/styles";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip
} from "recharts";
import { useSystemMetrics } from "@/features/system/hooks/use-system-metrics";

const ChartContainer = styled(Box)(({ theme }: { theme: Theme }) => ({
  width: "100%",
  height: 220,
  "& .recharts-default-tooltip": {
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`
  }
}));

const ProgressBar = styled(LinearProgress)(({ theme }: { theme: Theme }) => ({
  height: 8,
  borderRadius: 999,
  "& .MuiLinearProgress-bar": {
    borderRadius: 999
  }
}));

const SkeletonCard = () => (
  <Card>
    <CardContent>
      <Stack spacing={2}>
        <Skeleton variant="text" width={140} />
        <Skeleton variant="rectangular" height={160} />
        <Skeleton variant="text" />
        <Skeleton variant="text" width="60%" />
      </Stack>
    </CardContent>
  </Card>
);

const formatBytes = (bytes: number, precision = 1) => {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }
  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(value >= 10 ? 0 : precision)} ${units[exponent]}`;
};

const formatDuration = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "Just started";
  }

  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const parts = [];
  if (days > 0) {
    parts.push(`${days}d`);
  }
  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  if (minutes > 0) {
    parts.push(`${minutes}m`);
  }
  if (!parts.length) {
    parts.push(`${Math.floor(seconds)}s`);
  }
  return parts.join(" ");
};

const formatPercent = (value: number) => `${value.toFixed(1)}%`;

const formatTimeLabel = (timestamp: string) => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
};

const colorPalette = (theme: Theme) => ({
  primary: theme.palette.primary.main,
  secondary: theme.palette.mode === "dark" ? theme.palette.grey[500] : theme.palette.grey[300],
  success: theme.palette.success.main
});

const SystemMetricsPanel = () => {
  const theme = useTheme();
  const { metrics, status, isFetching, history, refetch } = useSystemMetrics();

  const palette = colorPalette(theme);

  const cpuLineData = useMemo(
    () =>
      history.map((point) => ({
        timestamp: formatTimeLabel(point.timestamp),
        cpu: Number(point.cpuUsagePercent.toFixed(1))
      })),
    [history]
  );

  const memoryLineData = useMemo(
    () =>
      history.map((point) => ({
        timestamp: formatTimeLabel(point.timestamp),
        memory: Number(point.memoryUsagePercent.toFixed(1))
      })),
    [history]
  );

  const storageLineData = useMemo(
    () =>
      history
        .filter((point) => point.diskUsagePercent !== null)
        .map((point) => ({
          timestamp: formatTimeLabel(point.timestamp),
          storage: point.diskUsagePercent ? Number(point.diskUsagePercent.toFixed(1)) : 0
        })),
    [history]
  );

  const storagePartitions = useMemo(() => {
    if (!metrics?.disks) {
      return [];
    }

    return metrics.disks.partitions.map((partition) => ({
      ...partition,
      usedLabel: formatBytes(partition.usedBytes),
      totalLabel: formatBytes(partition.sizeBytes)
    }));
  }, [metrics]);

  const isLoading = status === "idle" || status === "loading";
  const showSkeleton = isLoading && !metrics;
  const showBackgroundIndicator = isFetching && status === "succeeded";

  if (showSkeleton) {
    return (
      <Grid container spacing={2.5}>
        <Grid xs={12} md={6} lg={4}>
          <SkeletonCard />
        </Grid>
        <Grid xs={12} md={6} lg={4}>
          <SkeletonCard />
        </Grid>
        <Grid xs={12} lg={4}>
          <SkeletonCard />
        </Grid>
      </Grid>
    );
  }

  if (!metrics) {
    return null;
  }

  return (
    <Stack spacing={2.5}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Box>
          <Typography variant="h6">Server Health</Typography>
          <Typography variant="body2" color="text.secondary">
            {metrics.hostname} · {metrics.platform} {metrics.release} · Uptime {formatDuration(metrics.uptimeSeconds)}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          {showBackgroundIndicator ? (
            <Tooltip title="Refreshing metrics">
              <FiberManualRecordIcon fontSize="small" color="success" />
            </Tooltip>
          ) : null}
          <Tooltip title="Refresh now">
            <IconButton size="small" onClick={() => refetch()}>
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      <Grid container spacing={2.5}>
        <Grid xs={12} md={6} lg={4}>
          <Card>
            <CardContent sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="subtitle2" color="text.secondary">
                  CPU Load
                </Typography>
                <Typography variant="subtitle2">
                  {formatPercent(metrics.cpu.overallUsagePercent)}
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Load average (1m / 5m / 15m): {metrics.cpu.loadAverage.map((value) => value.toFixed(2)).join(" / ")}
              </Typography>
              <ChartContainer>
                <ResponsiveContainer>
                  <LineChart data={cpuLineData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.palette.divider} />
                    <XAxis dataKey="timestamp" stroke={theme.palette.text.secondary} fontSize={12} minTickGap={24} />
                    <YAxis
                      unit="%"
                      stroke={theme.palette.text.secondary}
                      fontSize={12}
                      domain={[0, 100]}
                    />
                    <RechartsTooltip formatter={(value: number) => [`${value.toFixed(1)}%`, "CPU"]} />
                    <Line type="monotone" dataKey="cpu" stroke={palette.primary} strokeWidth={2} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
              <Stack spacing={0.5}>
                {metrics.cpu.cores.map((core) => (
                  <Stack key={core.id} direction="row" justifyContent="space-between">
                    <Typography variant="body2">{core.id.replace("cpu-", "Core ")}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatPercent(core.usagePercent)}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid xs={12} md={6} lg={4}>
          <Card>
            <CardContent sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="subtitle2" color="text.secondary">
                  Memory Usage
                </Typography>
                <Typography variant="subtitle2">
                  {formatPercent(metrics.memory.usagePercent)}
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                {formatBytes(metrics.memory.usedBytes)} used of {formatBytes(metrics.memory.totalBytes)}
              </Typography>
              <ChartContainer>
                <ResponsiveContainer>
                  <LineChart data={memoryLineData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.palette.divider} />
                    <XAxis dataKey="timestamp" stroke={theme.palette.text.secondary} fontSize={12} minTickGap={24} />
                    <YAxis unit="%" stroke={theme.palette.text.secondary} fontSize={12} domain={[0, 100]} />
                    <RechartsTooltip formatter={(value: number) => [`${value.toFixed(1)}%`, "Memory"]} />
                    <Line type="monotone" dataKey="memory" stroke={palette.primary} strokeWidth={2} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
              <Stack spacing={0.5}>
                <Typography variant="body2" color="text.secondary">
                  Free: {formatBytes(metrics.memory.freeBytes)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total RAM: {formatBytes(metrics.memory.totalBytes)}
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid xs={12} lg={4}>
          <Card>
            <CardContent sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="subtitle2" color="text.secondary">
                  Storage
                </Typography>
                <Typography variant="subtitle2">
                  {metrics.disks ? formatPercent(metrics.disks.usagePercent) : "Unavailable"}
                </Typography>
              </Box>
              {metrics.disks ? (
                <>
                  <Typography variant="body2" color="text.secondary">
                    {formatBytes(metrics.disks.usedBytes)} used of {formatBytes(metrics.disks.totalBytes)}
                  </Typography>
                  <ChartContainer>
                    <ResponsiveContainer>
                      <LineChart data={storageLineData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.palette.divider} />
                        <XAxis dataKey="timestamp" stroke={theme.palette.text.secondary} fontSize={12} minTickGap={24} />
                        <YAxis unit="%" stroke={theme.palette.text.secondary} fontSize={12} domain={[0, 100]} />
                        <RechartsTooltip formatter={(value: number) => [`${value.toFixed(1)}%`, "Storage"]} />
                        <Line type="monotone" dataKey="storage" stroke={palette.success} strokeWidth={2} dot={false} isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                  <Stack spacing={1.5}>
                    {storagePartitions.map((partition) => (
                      <Stack key={`${partition.filesystem}-${partition.mountpoint}`} spacing={0.5}>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="body2">{partition.mountpoint}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {partition.usedLabel} / {partition.totalLabel}
                          </Typography>
                        </Stack>
                        <ProgressBar
                          variant="determinate"
                          value={Math.min(Math.max(partition.usagePercent, 0), 100)}
                          sx={{
                            backgroundColor: theme.palette.action.hover,
                            "& .MuiLinearProgress-bar": {
                              backgroundColor: partition.usagePercent > 85
                                ? theme.palette.error.main
                                : palette.success
                            }
                          }}
                        />
                      </Stack>
                    ))}
                  </Stack>
                </>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Disk metrics are not available in the current environment.
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Stack>
  );
};

export default SystemMetricsPanel;
