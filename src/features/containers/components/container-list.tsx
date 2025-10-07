"use client";

import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import StopIcon from "@mui/icons-material/Stop";
import TerminalIcon from "@mui/icons-material/Terminal";
import TimelineIcon from "@mui/icons-material/Timeline";
import { Box, Button, Chip, CircularProgress, Divider, LinearProgress, Paper, Stack, Tooltip, Typography } from "@mui/material";
import Grid from "@mui/material/GridLegacy";
import { styled } from "@mui/material/styles";
import moment from "moment";
import { useContainers } from "@/features/containers/hooks/use-containers";

const UsageBar = styled(LinearProgress)(({ theme }) => ({
  height: 8,
  borderRadius:
    typeof theme.shape.borderRadius === "number"
      ? theme.shape.borderRadius * 3
      : theme.shape.borderRadius
}));

const EmptyState = styled(Paper)(({ theme }) => ({
  textAlign: "center",
  padding: theme.spacing(6)
}));

const ContainerList = () => {
  const { data, isLoading, isError, error } = useContainers();

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

  if (isError) {
    return (
      <Paper sx={{ p: 4 }}>
        <Typography variant="subtitle1" gutterBottom>
          Unable to load containers
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {error instanceof Error ? error.message : "Check your Docker connection and try again."}
        </Typography>
      </Paper>
    );
  }

  if (!data || data.length === 0) {
    return (
      <EmptyState>
        <Typography variant="h6" gutterBottom>
          No containers found
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Connect to a Docker daemon to see running containers and orchestrate workloads.
        </Typography>
      </EmptyState>
    );
  }

  return (
    <Grid container spacing={2.5}>
      {data.map((container) => (
        <Grid key={container.id} item xs={12} md={6} lg={4}>
          <Paper sx={{ display: "flex", flexDirection: "column", gap: 2, height: "100%" }}>
            <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1.5}>
              <Box>
                <Typography variant="subtitle1">
                  {container.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {container.id}
                </Typography>
              </Box>
              <Chip
                size="small"
                label={container.state === "running" ? "Running" : "Stopped"}
                color={container.state === "running" ? "success" : "default"}
              />
            </Stack>
            <Stack spacing={0.75}>
              <Typography variant="body2" color="text.secondary">
                Image · {container.image}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Ports · {container.ports.length > 0 ? container.ports.join(", ") : "None"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {container.status} · created {moment(container.createdAt).fromNow()}
              </Typography>
            </Stack>
            <Divider flexItem light />
            <Stack spacing={1.25}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <TimelineIcon fontSize="small" color="primary" />
                <Typography variant="caption" color="text.secondary">
                  CPU usage
                </Typography>
              </Stack>
              <UsageBar variant="determinate" value={Math.min(container.cpuUsage, 100)} />
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
                  <Button
                    startIcon={<PlayArrowIcon fontSize="small" />}
                    disabled={container.state === "running"}
                    size="small"
                  >
                    Start
                  </Button>
                </span>
              </Tooltip>
              <Tooltip title="Stop">
                <span>
                  <Button
                    startIcon={<StopIcon fontSize="small" />}
                    color="warning"
                    disabled={container.state !== "running"}
                    size="small"
                  >
                    Stop
                  </Button>
                </span>
              </Tooltip>
              <Tooltip title="Restart">
                <Button startIcon={<RestartAltIcon fontSize="small" />} color="secondary" size="small">
                  Restart
                </Button>
              </Tooltip>
              <Tooltip title="Open shell">
                <Button startIcon={<TerminalIcon fontSize="small" />} variant="outlined" size="small">
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
