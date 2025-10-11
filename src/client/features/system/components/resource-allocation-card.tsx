"use client";

import { Box, Card, CardContent, LinearProgress, Stack, Typography } from "@mui/material";
import { styled, useTheme } from "@mui/material/styles";
import type { SystemMetrics } from "@/types/system";

interface ResourceAllocationCardProps {
  metrics: SystemMetrics;
  totalContainerCpu: number;
  totalContainerMemory: number;
}

const ProgressBar = styled(LinearProgress)(({ theme }) => ({
  height: 10,
  borderRadius: 999,
  "& .MuiLinearProgress-bar": {
    borderRadius: 999
  }
}));

const formatBytes = (bytes: number) => {
  if (bytes === 0) return "0 GB";
  const gb = bytes / (1024 * 1024 * 1024);
  return `${gb.toFixed(1)} GB`;
};

const ResourceAllocationCard = ({ metrics, totalContainerCpu, totalContainerMemory }: ResourceAllocationCardProps) => {
  const theme = useTheme();

  const diskUsagePercent = metrics.disks?.usagePercent || 0;
  const containerMemoryGB = totalContainerMemory / 1024;

  return (
    <Card sx={{ height: "100%" }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Resource Usage
        </Typography>

        <Stack spacing={3}>
          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="baseline" mb={1}>
              <Typography variant="body2" color="text.secondary">
                CPU Usage
              </Typography>
              <Typography variant="h6" color={metrics.cpu.overallUsagePercent > 80 ? "error.main" : "text.primary"}>
                {metrics.cpu.overallUsagePercent.toFixed(1)}%
              </Typography>
            </Stack>
            <ProgressBar
              variant="determinate"
              value={Math.min(metrics.cpu.overallUsagePercent, 100)}
              color={metrics.cpu.overallUsagePercent > 80 ? "error" : "primary"}
            />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
              Load: {metrics.cpu.loadAverage[0].toFixed(2)} · {metrics.cpu.cores.length} cores
            </Typography>
          </Box>

          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="baseline" mb={1}>
              <Typography variant="body2" color="text.secondary">
                Memory Usage
              </Typography>
              <Typography variant="h6" color={metrics.memory.usagePercent > 85 ? "error.main" : "text.primary"}>
                {metrics.memory.usagePercent.toFixed(1)}%
              </Typography>
            </Stack>
            <ProgressBar
              variant="determinate"
              value={metrics.memory.usagePercent}
              color={metrics.memory.usagePercent > 85 ? "error" : "primary"}
            />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
              {formatBytes(metrics.memory.usedBytes)} / {formatBytes(metrics.memory.totalBytes)}
            </Typography>
          </Box>

          {metrics.disks && (
            <Box>
              <Stack direction="row" justifyContent="space-between" alignItems="baseline" mb={1}>
                <Typography variant="body2" color="text.secondary">
                  Disk Usage
                </Typography>
                <Typography variant="h6" color={diskUsagePercent > 90 ? "error.main" : "text.primary"}>
                  {diskUsagePercent.toFixed(1)}%
                </Typography>
              </Stack>
              <ProgressBar
                variant="determinate"
                value={diskUsagePercent}
                color={diskUsagePercent > 90 ? "error" : "success"}
              />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                {formatBytes(metrics.disks.usedBytes)} / {formatBytes(metrics.disks.totalBytes)}
              </Typography>
            </Box>
          )}

          <Box sx={{ pt: 1, borderTop: `1px solid ${theme.palette.divider}` }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Container Overhead
            </Typography>
            <Stack spacing={0.5}>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">
                  CPU
                </Typography>
                <Typography variant="body2">{totalContainerCpu.toFixed(1)}%</Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">
                  Memory
                </Typography>
                <Typography variant="body2">{containerMemoryGB.toFixed(1)} GB</Typography>
              </Stack>
            </Stack>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
};

export default ResourceAllocationCard;
