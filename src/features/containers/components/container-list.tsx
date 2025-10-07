"use client";

import { useCallback, useMemo, useState } from "react";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
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
import ViewListIcon from "@mui/icons-material/ViewList";
import ViewModuleIcon from "@mui/icons-material/ViewModule";
import {
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
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography
} from "@mui/material";
import { toast } from "sonner";
import Grid from "@mui/material/Grid";
import { styled } from "@mui/material/styles";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import moment from "moment";
import { containerQueryKeys, useContainers } from "@/features/containers/hooks/use-containers";
import { imageQueryKeys } from "@/features/images/hooks/use-images";
import ActionIconButton from "@/components/common/action-icon-button";
import { useBottomPanel } from "@/components/common/bottom-panel-context";
import { pruneStoppedContainers, pruneUnusedImages, removeContainer, startContainer, stopContainer, restartContainer } from "@/lib/api/docker";
import type { DockerContainer } from "@/types/docker";
import ContainerCard from "./container-card";
import ContainerGroupActions from "./container-group-actions";
import ContainerTableRow from "./container-table-row";
import ContainerContextMenu from "./container-context-menu";
import ContainerMaintenancePanel from "./container-maintenance-panel";
import { useGroupedContainers } from "../hooks/use-grouped-containers";

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
  const [loadingContainerId, setLoadingContainerId] = useState<string | null>(null);

  const handleMenuOpen = (containerId: string, anchor: HTMLElement) => {
    setMenuAnchor({ id: containerId, anchor });
  };

  const handleMenuClose = useCallback(() => {
    setMenuAnchor(null);
  }, []);

  const removeContainerMutation = useMutation({
    mutationFn: async ({ id }: { id: string; name: string }) => removeContainer(id),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: containerQueryKeys.all });
      toast.success(`Removed container ${variables.name}`);
    },
    onError: (mutationError, variables) => {
      const message =
        mutationError instanceof Error
          ? mutationError.message
          : `Unable to remove container ${variables.name}`;
      toast.error(message);
    }
  });

  const pruneContainersMutation = useMutation({
    mutationFn: pruneStoppedContainers,
    onSuccess: (summary) => {
      queryClient.invalidateQueries({ queryKey: containerQueryKeys.all });
      const message = summary.removedCount
        ? `Removed ${summary.removedCount} stopped container${summary.removedCount > 1 ? "s" : ""} and reclaimed ${formatBytes(summary.reclaimedSpace)}.`
        : "No stopped containers to remove.";
      toast.success(message);
    },
    onError: (mutationError) => {
      const message =
        mutationError instanceof Error
          ? mutationError.message
          : "Unable to remove stopped containers.";
      toast.error(message);
    }
  });

  const pruneImagesMutation = useMutation({
    mutationFn: pruneUnusedImages,
    onSuccess: (summary) => {
      queryClient.invalidateQueries({ queryKey: imageQueryKeys.all });
      const message = summary.removedCount
        ? `Removed ${summary.removedCount} unused image${summary.removedCount > 1 ? "s" : ""} and reclaimed ${formatBytes(summary.reclaimedSpace)}.`
        : "No unused images to clean up.";
      toast.success(message);
    },
    onError: (mutationError) => {
      const message =
        mutationError instanceof Error
          ? mutationError.message
          : "Unable to remove unused images.";
      toast.error(message);
    }
  });

  const startContainerMutation = useMutation({
    mutationFn: async ({ id }: { id: string; name: string }) => startContainer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: containerQueryKeys.all });
    }
  });

  const stopContainerMutation = useMutation({
    mutationFn: async ({ id }: { id: string; name: string }) => stopContainer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: containerQueryKeys.all });
    }
  });

  const restartContainerMutation = useMutation({
    mutationFn: async ({ id }: { id: string; name: string }) => restartContainer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: containerQueryKeys.all });
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

  const handleStartContainer = async (containerId: string, containerName: string) => {
    setLoadingContainerId(containerId);
    try {
      await toast.promise(
        startContainerMutation.mutateAsync({ id: containerId, name: containerName }),
        {
          loading: `Starting ${containerName}...`,
          success: `Started ${containerName}`,
          error: (error) => error instanceof Error ? error.message : `Unable to start ${containerName}`
        }
      );
    } finally {
      setLoadingContainerId(null);
    }
  };

  const handleStopContainer = async (containerId: string, containerName: string) => {
    setLoadingContainerId(containerId);
    try {
      await toast.promise(
        stopContainerMutation.mutateAsync({ id: containerId, name: containerName }),
        {
          loading: `Stopping ${containerName}...`,
          success: `Stopped ${containerName}`,
          error: (error) => error instanceof Error ? error.message : `Unable to stop ${containerName}`
        }
      );
    } finally {
      setLoadingContainerId(null);
    }
  };

  const handleRestartContainer = async (containerId: string, containerName: string) => {
    setLoadingContainerId(containerId);
    try {
      await toast.promise(
        restartContainerMutation.mutateAsync({ id: containerId, name: containerName }),
        {
          loading: `Restarting ${containerName}...`,
          success: `Restarted ${containerName}`,
          error: (error) => error instanceof Error ? error.message : `Unable to restart ${containerName}`
        }
      );
    } finally {
      setLoadingContainerId(null);
    }
  };

  // Group-level actions
  const handleGroupStart = async (containers: DockerContainer[]) => {
    const stoppedContainers = containers.filter(c => c.state !== "running");
    if (stoppedContainers.length === 0) {
      toast.info("All containers are already running");
      return;
    }

    const toastId = toast.loading(`Starting ${stoppedContainers.length} container${stoppedContainers.length > 1 ? "s" : ""}...`);
    
    try {
      await Promise.all(
        stoppedContainers.map(container => 
          startContainer(container.id)
        )
      );
      queryClient.invalidateQueries({ queryKey: containerQueryKeys.all });
      toast.success(`Started ${stoppedContainers.length} container${stoppedContainers.length > 1 ? "s" : ""}`, { id: toastId });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to start containers", { id: toastId });
    }
  };

  const handleGroupStop = async (containers: DockerContainer[]) => {
    const runningContainers = containers.filter(c => c.state === "running");
    if (runningContainers.length === 0) {
      toast.info("All containers are already stopped");
      return;
    }

    const toastId = toast.loading(`Stopping ${runningContainers.length} container${runningContainers.length > 1 ? "s" : ""}...`);
    
    try {
      await Promise.all(
        runningContainers.map(container => 
          stopContainer(container.id)
        )
      );
      queryClient.invalidateQueries({ queryKey: containerQueryKeys.all });
      toast.success(`Stopped ${runningContainers.length} container${runningContainers.length > 1 ? "s" : ""}`, { id: toastId });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to stop containers", { id: toastId });
    }
  };

  const handleGroupRestart = async (containers: DockerContainer[]) => {
    const runningContainers = containers.filter(c => c.state === "running");
    if (runningContainers.length === 0) {
      toast.info("No running containers to restart");
      return;
    }

    const toastId = toast.loading(`Restarting ${runningContainers.length} container${runningContainers.length > 1 ? "s" : ""}...`);
    
    try {
      await Promise.all(
        runningContainers.map(container => 
          restartContainer(container.id)
        )
      );
      queryClient.invalidateQueries({ queryKey: containerQueryKeys.all });
      toast.success(`Restarted ${runningContainers.length} container${runningContainers.length > 1 ? "s" : ""}`, { id: toastId });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to restart containers", { id: toastId });
    }
  };

  const handleGroupDelete = async (containers: DockerContainer[], groupName: string) => {
    const confirmed = window.confirm(
      `Delete all ${containers.length} container${containers.length > 1 ? "s" : ""} in "${groupName}"? This will force delete all containers and any ephemeral data.`
    );

    if (!confirmed) {
      return;
    }

    const toastId = toast.loading(`Removing ${containers.length} container${containers.length > 1 ? "s" : ""}...`);
    
    try {
      await Promise.all(
        containers.map(container => 
          removeContainer(container.id)
        )
      );
      queryClient.invalidateQueries({ queryKey: containerQueryKeys.all });
      toast.success(`Removed ${containers.length} container${containers.length > 1 ? "s" : ""}`, { id: toastId });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove containers", { id: toastId });
    }
  };

  const handleGroupLogs = (containers: DockerContainer[]) => {
    containers.forEach(container => {
      openLogs(container.id, container.name);
    });
    toast.success(`Opened logs for ${containers.length} container${containers.length > 1 ? "s" : ""}`);
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

  const [viewMode, setViewMode] = useState<"list" | "grid">("grid");

  const handleViewModeChange = (_event: unknown, value: "list" | "grid" | null) => {
    if (value) {
      setViewMode(value);
    }
  };

  const groupedContainers = useGroupedContainers(data);

  const renderContainerCard = (container: DockerContainer) => {
    return (
      <ContainerCard
        key={container.id}
        container={container}
        isLoading={loadingContainerId === container.id}
        onStart={handleStartContainer}
        onStop={handleStopContainer}
        onRestart={handleRestartContainer}
        onOpenTerminal={openTerminal}
        onOpenLogs={openLogs}
        onMenuOpen={handleMenuOpen}
      />
    );
  };

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
        <Stack direction="row" justifyContent="flex-end">
          <ToggleButtonGroup
            size="small"
            exclusive
            value={viewMode}
            onChange={handleViewModeChange}
            aria-label="container view switcher"
          >
            <ToggleButton value="grid" aria-label="grid view">
              <ViewModuleIcon fontSize="small" sx={{ mr: 1 }} />
              Grid
            </ToggleButton>
            <ToggleButton value="list" aria-label="list view">
              <ViewListIcon fontSize="small" sx={{ mr: 1 }} />
              List
            </ToggleButton>
          </ToggleButtonGroup>
        </Stack>
        {viewMode === "grid" ? (
          <Stack spacing={3}>
            {groupedContainers.map((group) => (
              <Box key={group.key}>
                <ContainerGroupActions
                  groupLabel={group.label}
                  containerCount={group.containers.length}
                  containers={group.containers}
                  onGroupStart={handleGroupStart}
                  onGroupStop={handleGroupStop}
                  onGroupRestart={handleGroupRestart}
                  onGroupLogs={handleGroupLogs}
                  onGroupDelete={handleGroupDelete}
                />
                <Grid container spacing={2.5}>
                  {group.containers.map(renderContainerCard)}
                </Grid>
              </Box>
            ))}
          </Stack>
        ) : (
          <Stack spacing={3}>
            {groupedContainers.map((group) => (
              <Box key={group.key}>
                <ContainerGroupActions
                  groupLabel={group.label}
                  containerCount={group.containers.length}
                  containers={group.containers}
                  onGroupStart={handleGroupStart}
                  onGroupStop={handleGroupStop}
                  onGroupRestart={handleGroupRestart}
                  onGroupLogs={handleGroupLogs}
                  onGroupDelete={handleGroupDelete}
                />
                <Paper>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Name</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Image</TableCell>
                        <TableCell>Ports</TableCell>
                        <TableCell>CPU</TableCell>
                        <TableCell>Memory</TableCell>
                        <TableCell align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {group.containers.map((container) => (
                        <ContainerTableRow
                          key={container.id}
                          container={container}
                          isLoading={loadingContainerId === container.id}
                          onStart={handleStartContainer}
                          onStop={handleStopContainer}
                          onRestart={handleRestartContainer}
                          onOpenTerminal={openTerminal}
                          onOpenLogs={openLogs}
                          onMenuOpen={handleMenuOpen}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </Paper>
              </Box>
            ))}
          </Stack>
        )}
        <ContainerMaintenancePanel
          onPruneContainers={() => pruneContainersMutation.mutate()}
          onPruneImages={() => pruneImagesMutation.mutate()}
          isPruningContainers={pruneContainersMutation.isPending}
          isPruningImages={pruneImagesMutation.isPending}
        />
      </Stack>
      <ContainerContextMenu
        anchorEl={menuAnchor?.anchor ?? null}
        container={menuAnchor ? data?.find(c => c.id === menuAnchor.id) : undefined}
        onClose={handleMenuClose}
        onOpenTerminalDrawer={quickActions.openTerminalDrawer}
        onOpenTerminalTab={quickActions.openTerminalNewTab}
        onOpenLogsDrawer={quickActions.openLogsDrawer}
        onOpenLogsTab={quickActions.openLogsNewTab}
        onRemove={handleRemoveContainer}
      />
    </>
  );
};

export default ContainerList;
