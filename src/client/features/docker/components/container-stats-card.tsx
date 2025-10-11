"use client";

import { useMemo } from "react";
import { Box, Card, CardContent, LinearProgress, Stack, Typography, Chip } from "@mui/material";
import { styled } from "@mui/material/styles";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import PauseIcon from "@mui/icons-material/Pause";
import type { DockerContainer } from "@/types/docker";

interface ContainerStatsCardProps {
  containers: DockerContainer[];
}

const ProgressBar = styled(LinearProgress)({
  height: 8,
  borderRadius: 999,
  "& .MuiLinearProgress-bar": {
    borderRadius: 999
  }
});

const formatMemory = (mb: number) => {
  if (mb === 0) return "0 MB";
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(1)} GB`;
  }
  return `${mb.toFixed(0)} MB`;
};

const ContainerStatsCard = ({ containers }: ContainerStatsCardProps) => {
  const stats = useMemo(() => {
    const running = containers.filter((c) => c.state === "running");
    const stopped = containers.filter((c) => c.state === "exited");
    const paused = containers.filter((c) => c.state === "paused");
    const other = containers.filter((c) => !["running", "exited", "paused"].includes(c.state));

    const totalCpu = running.reduce((sum, c) => sum + c.cpuUsage, 0);
    const totalMemory = running.reduce((sum, c) => sum + c.memoryUsage, 0);
    const avgCpu = running.length > 0 ? totalCpu / running.length : 0;
    const avgMemory = running.length > 0 ? totalMemory / running.length : 0;

    const topCpuContainer = running.length > 0 
      ? [...running].sort((a, b) => b.cpuUsage - a.cpuUsage)[0]
      : null;

    const topMemoryContainer = running.length > 0
      ? [...running].sort((a, b) => b.memoryUsage - a.memoryUsage)[0]
      : null;

    return {
      total: containers.length,
      running: running.length,
      stopped: stopped.length,
      paused: paused.length,
      other: other.length,
      totalCpu,
      totalMemory,
      avgCpu,
      avgMemory,
      topCpuContainer,
      topMemoryContainer
    };
  }, [containers]);

  return (
    <Card sx={{ height: "100%" }}>
      <CardContent>
        <Stack spacing={2.5}>
          <Box>
            <Typography variant="h6" gutterBottom>
              Container Statistics
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Chip
                icon={<PlayArrowIcon />}
                label={`${stats.running} Running`}
                color="success"
                size="small"
              />
              <Chip
                icon={<StopIcon />}
                label={`${stats.stopped} Stopped`}
                size="small"
              />
              {stats.paused > 0 && (
                <Chip
                  icon={<PauseIcon />}
                  label={`${stats.paused} Paused`}
                  color="warning"
                  size="small"
                />
              )}
            </Stack>
          </Box>

          {stats.running > 0 ? (
            <>
              <Box>
                <Stack direction="row" justifyContent="space-between" alignItems="baseline" mb={1}>
                  <Typography variant="body2" color="text.secondary">
                    Total CPU Usage
                  </Typography>
                  <Typography variant="h6">{stats.totalCpu.toFixed(1)}%</Typography>
                </Stack>
                <ProgressBar
                  variant="determinate"
                  value={Math.min(stats.totalCpu, 100)}
                  color="primary"
                />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                  Average: {stats.avgCpu.toFixed(1)}% per container
                </Typography>
              </Box>

              <Box>
                <Stack direction="row" justifyContent="space-between" alignItems="baseline" mb={1}>
                  <Typography variant="body2" color="text.secondary">
                    Total Memory Usage
                  </Typography>
                  <Typography variant="h6">{formatMemory(stats.totalMemory)}</Typography>
                </Stack>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                  Average: {formatMemory(stats.avgMemory)} per container
                </Typography>
              </Box>

              {stats.topCpuContainer && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Highest CPU Consumer
                  </Typography>
                  <Stack spacing={0.5}>
                    <Typography variant="body2" noWrap>
                      {stats.topCpuContainer.name}
                    </Typography>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="caption" color="text.secondary">
                        {stats.topCpuContainer.image}
                      </Typography>
                      <Chip 
                        label={`${stats.topCpuContainer.cpuUsage.toFixed(1)}%`} 
                        size="small" 
                        color="primary"
                      />
                    </Stack>
                  </Stack>
                </Box>
              )}

              {stats.topMemoryContainer && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Highest Memory Consumer
                  </Typography>
                  <Stack spacing={0.5}>
                    <Typography variant="body2" noWrap>
                      {stats.topMemoryContainer.name}
                    </Typography>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="caption" color="text.secondary">
                        {stats.topMemoryContainer.image}
                      </Typography>
                      <Chip 
                        label={formatMemory(stats.topMemoryContainer.memoryUsage)} 
                        size="small" 
                        color="secondary"
                      />
                    </Stack>
                  </Stack>
                </Box>
              )}
            </>
          ) : (
            <Box sx={{ py: 3, textAlign: "center" }}>
              <Typography variant="body2" color="text.secondary">
                No running containers
              </Typography>
            </Box>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};

export default ContainerStatsCard;

