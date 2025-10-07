"use client";

import { useCallback, useMemo, useState } from "react";
import ArticleIcon from "@mui/icons-material/Article";
import CleaningServicesIcon from "@mui/icons-material/CleaningServices";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import StopIcon from "@mui/icons-material/Stop";
import TerminalIcon from "@mui/icons-material/Terminal";
import TimelineIcon from "@mui/icons-material/Timeline";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  LinearProgress,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Snackbar,
  Stack,
  Tooltip,
  Typography
} from "@mui/material";
import type { AlertColor } from "@mui/material/Alert";
import Grid from "@mui/material/Grid";
import { styled } from "@mui/material/styles";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import moment from "moment";
import { containerQueryKeys, useContainers } from "@/features/containers/hooks/use-containers";
import { imageQueryKeys } from "@/features/images/hooks/use-images";
import ActionIconButton from "@/components/common/action-icon-button";
import { useBottomPanel } from "@/components/common/bottom-panel-context";
import { pruneStoppedContainers, pruneUnusedImages, removeContainer } from "@/lib/api/docker";

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

const formatBytes = (bytes: number) => {
  if (!bytes || Number.isNaN(bytes)) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[exponent]}`;
};

const ContainerList = () => {
  const { data, isLoading, isError, error } = useContainers();
  const { openLogs, openTerminal } = useBottomPanel();
  const queryClient = useQueryClient();
  const [menuAnchor, setMenuAnchor] = useState<{ id: string; anchor: HTMLElement } | null>(null);
  const [feedback, setFeedback] = useState<{ message: string; severity: AlertColor } | null>(null);

  const handleMenuOpen = (containerId: string, anchor: HTMLElement) => {
    setMenuAnchor({ id: containerId, anchor });
  };

  const handleMenuClose = useCallback(() => {
    setMenuAnchor(null);
  }, []);

  const handleFeedbackClose = () => {
    setFeedback(null);
  };

  const removeContainerMutation = useMutation({
    mutationFn: async ({ id }: { id: string; name: string }) => removeContainer(id),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: containerQueryKeys.all });
      setFeedback({ message: `Removed container ${variables.name}`, severity: "success" });
    },
    onError: (mutationError, variables) => {
      const message =
        mutationError instanceof Error
          ? mutationError.message
          : `Unable to remove container ${variables.name}`;
      setFeedback({ message, severity: "error" });
    }
  });

  const pruneContainersMutation = useMutation({
    mutationFn: pruneStoppedContainers,
    onSuccess: (summary) => {
      queryClient.invalidateQueries({ queryKey: containerQueryKeys.all });
      setFeedback({
        message: summary.removedCount
          ? `Removed ${summary.removedCount} stopped container${summary.removedCount > 1 ? "s" : ""} and reclaimed ${formatBytes(summary.reclaimedSpace)}.`
          : "No stopped containers to remove.",
        severity: "success"
      });
    },
    onError: (mutationError) => {
      const message =
        mutationError instanceof Error
          ? mutationError.message
          : "Unable to remove stopped containers.";
      setFeedback({ message, severity: "error" });
    }
  });

  const pruneImagesMutation = useMutation({
    mutationFn: pruneUnusedImages,
    onSuccess: (summary) => {
      queryClient.invalidateQueries({ queryKey: imageQueryKeys.all });
      setFeedback({
        message: summary.removedCount
          ? `Removed ${summary.removedCount} unused image${summary.removedCount > 1 ? "s" : ""} and reclaimed ${formatBytes(summary.reclaimedSpace)}.`
          : "No unused images to clean up.",
        severity: "success"
      });
    },
    onError: (mutationError) => {
      const message =
        mutationError instanceof Error
          ? mutationError.message
          : "Unable to remove unused images.";
      setFeedback({ message, severity: "error" });
    }
  });

  const handleRemoveContainer = (containerId: string, containerName: string) => {
    const confirmed = window.confirm(
      `Remove container "${containerName}"? This will force delete the container and any ephemeral data.`
    );

    if (!confirmed) {
      return;
    }

    handleMenuClose();
    removeContainerMutation.mutate({ id: containerId, name: containerName });
  };

  const quickActions = useMemo(
    () => ({
      openTerminalDrawer: (containerId: string, containerName: string) => {
        openTerminal(containerId, containerName);
        handleMenuClose();
      },
      openLogsDrawer: (containerId: string, containerName: string) => {
        openLogs(containerId, containerName);
        handleMenuClose();
      },
      openTerminalNewTab: (containerId: string) => {
        window.open(`/containers/${containerId}/shell`, "_blank", "noopener,noreferrer");
        handleMenuClose();
      },
      openLogsNewTab: (containerId: string) => {
        window.open(`/logs?containerId=${containerId}`, "_blank", "noopener,noreferrer");
        handleMenuClose();
      }
    }), [handleMenuClose, openLogs, openTerminal]);

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
    <>
      <Stack spacing={3}>
        <Grid container spacing={2.5}>
          {data.map((container) => (
            <Grid key={container.id} size={{ xs: 12, md: 6, lg: 4 }}>
              <Card sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
                <CardContent sx={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
                  <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1.5}>
                    <Box>
                      <Typography variant="subtitle1">{container.name}</Typography>
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
                  <Box
                    sx={{
                      display: "flex",
                      gap: 1,
                      mt: "auto"
                    }}
                  >
                    {container.state !== "running" && (
                      <Tooltip title="Start container">
                        <ActionIconButton color="primary" size="small">
                          <PlayArrowIcon fontSize="small" />
                        </ActionIconButton>
                      </Tooltip>
                    )}
                    {container.state === "running" && (
                      <>
                        <Tooltip title="Stop container">
                          <ActionIconButton color="warning" size="small">
                            <StopIcon fontSize="small" />
                          </ActionIconButton>
                        </Tooltip>
                        <Tooltip title="Restart container">
                          <ActionIconButton color="secondary" size="small">
                            <RestartAltIcon fontSize="small" />
                          </ActionIconButton>
                        </Tooltip>
                        <Tooltip title="Open terminal in drawer">
                          <ActionIconButton
                            color="default"
                            size="small"
                            onClick={() => openTerminal(container.id, container.name)}
                          >
                            <TerminalIcon fontSize="small" />
                          </ActionIconButton>
                        </Tooltip>
                        <Tooltip title="View logs in drawer">
                          <ActionIconButton
                            color="default"
                            size="small"
                            onClick={() => openLogs(container.id, container.name)}
                          >
                            <ArticleIcon fontSize="small" />
                          </ActionIconButton>
                        </Tooltip>
                      </>
                    )}
                    <Tooltip title="More actions">
                      <ActionIconButton
                        color="default"
                        size="small"
                        onClick={(event) => handleMenuOpen(container.id, event.currentTarget)}
                      >
                        <MoreHorizIcon fontSize="small" />
                      </ActionIconButton>
                    </Tooltip>
                    <Menu
                      anchorEl={menuAnchor?.anchor ?? null}
                      open={menuAnchor?.id === container.id}
                      onClose={handleMenuClose}
                      anchorOrigin={{ vertical: "top", horizontal: "right" }}
                      transformOrigin={{ vertical: "top", horizontal: "right" }}
                      keepMounted
                    >
                      <MenuItem
                        onClick={() => quickActions.openTerminalDrawer(container.id, container.name)}
                        disabled={container.state !== "running"}
                      >
                        <ListItemIcon>
                          <TerminalIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText primary="Open terminal in drawer" />
                      </MenuItem>
                      <MenuItem
                        onClick={() => quickActions.openTerminalNewTab(container.id)}
                        disabled={container.state !== "running"}
                      >
                        <ListItemIcon>
                          <OpenInNewIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText primary="Open terminal in new tab" />
                      </MenuItem>
                      <MenuItem onClick={() => quickActions.openLogsDrawer(container.id, container.name)}>
                        <ListItemIcon>
                          <ArticleIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText primary="View logs in drawer" />
                      </MenuItem>
                      <MenuItem onClick={() => quickActions.openLogsNewTab(container.id)}>
                        <ListItemIcon>
                          <OpenInNewIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText primary="View logs in new tab" />
                      </MenuItem>
                      <Divider sx={{ my: 0.5 }} />
                      <MenuItem onClick={() => handleRemoveContainer(container.id, container.name)}>
                        <ListItemIcon>
                          <DeleteOutlineIcon fontSize="small" color="error" />
                        </ListItemIcon>
                        <ListItemText primary="Remove container" />
                      </MenuItem>
                    </Menu>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
        <Paper sx={{ p: 3, borderRadius: 3 }}>
          <Stack spacing={1.5}>
            <Typography variant="subtitle1">Container & image maintenance</Typography>
            <Typography variant="body2" color="text.secondary">
              Clean up stopped workloads and dangling artifacts to keep your Docker host healthy.
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteSweepIcon />}
                onClick={() => pruneContainersMutation.mutate()}
                disabled={pruneContainersMutation.isPending}
              >
                Remove stopped containers
              </Button>
              <Button
                variant="outlined"
                color="primary"
                startIcon={<CleaningServicesIcon />}
                onClick={() => pruneImagesMutation.mutate()}
                disabled={pruneImagesMutation.isPending}
              >
                Remove unused images
              </Button>
            </Stack>
          </Stack>
        </Paper>
      </Stack>
      {feedback && (
        <Snackbar
          open={true}
          autoHideDuration={6000}
          onClose={handleFeedbackClose}
          anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        >
          <Alert onClose={handleFeedbackClose} severity={feedback.severity} sx={{ width: "100%" }}>
            {feedback.message}
          </Alert>
        </Snackbar>
      )}
    </>
  );
};

export default ContainerList;
