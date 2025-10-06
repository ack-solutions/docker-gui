"use client";

import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import StopIcon from "@mui/icons-material/Stop";
import TerminalIcon from "@mui/icons-material/Terminal";
import TimelineIcon from "@mui/icons-material/Timeline";
import { Box, Button, Chip, CircularProgress, Grid, LinearProgress, Paper, Stack, Tooltip, Typography } from "@mui/material";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { useContainers } from "@/features/containers/hooks/useContainers";

dayjs.extend(relativeTime);

const ContainerList = () => {
  const { data, isLoading } = useContainers();

  if (isLoading) {
    return (
      <Stack alignItems="center" justifyContent="center" py={6}>
        <CircularProgress />
        <Typography variant="body2" color="text.secondary" mt={2}>
          Loading container metadata...
        </Typography>
      </Stack>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Paper sx={{ p: 6, textAlign: "center" }}>
        <Typography variant="h6" gutterBottom>
          No containers found
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Connect to a Docker daemon to see running containers and orchestrate workloads.
        </Typography>
      </Paper>
    );
  }

  return (
    <Grid container spacing={3}>
      {data.map((container) => (
        <Grid key={container.id} item xs={12} md={6} lg={4}>
          <Paper sx={{ p: 3, borderRadius: 3, height: "100%", display: "flex", flexDirection: "column", gap: 2 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography variant="subtitle1" fontWeight={600}>
                  {container.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {container.id}
                </Typography>
              </Box>
              <Chip
                label={container.state === "running" ? "Running" : "Stopped"}
                color={container.state === "running" ? "success" : "default"}
                variant={container.state === "running" ? "filled" : "outlined"}
              />
            </Stack>
            <Stack spacing={1}>
              <Typography variant="body2" color="text.secondary">
                Image: {container.image}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Ports: {container.ports.length > 0 ? container.ports.join(", ") : "None"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Status: {container.status} (created {dayjs(container.createdAt).fromNow()})
              </Typography>
            </Stack>
            <Stack spacing={1.5}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <TimelineIcon fontSize="small" color="primary" />
                <Typography variant="caption" color="text.secondary">
                  CPU Usage
                </Typography>
              </Stack>
              <LinearProgress
                variant="determinate"
                value={Math.min(container.cpuUsage, 100)}
                sx={{ height: 8, borderRadius: 999 }}
              />
              <Stack direction="row" alignItems="center" spacing={1}>
                <Typography variant="caption" color="text.secondary">
                  Memory
                </Typography>
                <Chip size="small" label={`${container.memoryUsage.toFixed(0)} MiB`} color="primary" variant="outlined" />
              </Stack>
            </Stack>
            <Stack direction="row" spacing={1} mt="auto">
              <Tooltip title="Start">
                <span>
                  <Button startIcon={<PlayArrowIcon />} disabled={container.state === "running"}>
                    Start
                  </Button>
                </span>
              </Tooltip>
              <Tooltip title="Stop">
                <span>
                  <Button startIcon={<StopIcon />} color="warning" disabled={container.state !== "running"}>
                    Stop
                  </Button>
                </span>
              </Tooltip>
              <Tooltip title="Restart">
                <Button startIcon={<RestartAltIcon />} color="secondary">
                  Restart
                </Button>
              </Tooltip>
              <Tooltip title="Open shell">
                <Button startIcon={<TerminalIcon />} variant="outlined">
                  Shell
                </Button>
              </Tooltip>
            </Stack>
          </Paper>
        </Grid>
      ))}
    </Grid>
  );
};

export default ContainerList;
