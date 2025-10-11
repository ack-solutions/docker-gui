"use client";

import { Box, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningIcon from "@mui/icons-material/Warning";
import ErrorIcon from "@mui/icons-material/Error";
import type { SystemMetrics } from "@/types/system";

interface QuickStatsCardProps {
  metrics: SystemMetrics;
  containerCount: number;
  runningContainers: number;
}

const StatItem = styled(Box)(({ theme }) => ({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: theme.spacing(1.5),
  borderRadius: theme.shape.borderRadius,
  backgroundColor: theme.palette.mode === "dark" ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.02)"
}));

const getHealthStatus = (metrics: SystemMetrics) => {
  const cpuHigh = metrics.cpu.overallUsagePercent > 80;
  const memoryHigh = metrics.memory.usagePercent > 85;
  const diskHigh = metrics.disks ? metrics.disks.usagePercent > 90 : false;

  if (cpuHigh || memoryHigh || diskHigh) {
    return { status: "warning", label: "Warning", icon: <WarningIcon fontSize="small" />, color: "warning" as const };
  }

  return { status: "healthy", label: "Healthy", icon: <CheckCircleIcon fontSize="small" />, color: "success" as const };
};

const formatUptime = (seconds: number) => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

const QuickStatsCard = ({ metrics, containerCount, runningContainers }: QuickStatsCardProps) => {
  const health = getHealthStatus(metrics);

  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">System Health</Typography>
              <Chip
                icon={health.icon}
                label={health.label}
                color={health.color}
                size="small"
              />
            </Stack>
          </Box>

          <Stack spacing={1.5}>
            <StatItem>
              <Typography variant="body2" color="text.secondary">
                Hostname
              </Typography>
              <Typography variant="body2" fontWeight={500}>
                {metrics.hostname}
              </Typography>
            </StatItem>

            <StatItem>
              <Typography variant="body2" color="text.secondary">
                Platform
              </Typography>
              <Typography variant="body2" fontWeight={500}>
                {metrics.platform} {metrics.architecture}
              </Typography>
            </StatItem>

            <StatItem>
              <Typography variant="body2" color="text.secondary">
                Uptime
              </Typography>
              <Typography variant="body2" fontWeight={500}>
                {formatUptime(metrics.uptimeSeconds)}
              </Typography>
            </StatItem>

            <StatItem>
              <Typography variant="body2" color="text.secondary">
                Active Containers
              </Typography>
              <Typography variant="body2" fontWeight={500}>
                {runningContainers} / {containerCount}
              </Typography>
            </StatItem>

            <StatItem>
              <Typography variant="body2" color="text.secondary">
                CPU Cores
              </Typography>
              <Typography variant="body2" fontWeight={500}>
                {metrics.cpu.cores.length}
              </Typography>
            </StatItem>

            <StatItem>
              <Typography variant="body2" color="text.secondary">
                Load Average
              </Typography>
              <Typography variant="body2" fontWeight={500}>
                {metrics.cpu.loadAverage[0].toFixed(2)}
              </Typography>
            </StatItem>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
};

export default QuickStatsCard;

