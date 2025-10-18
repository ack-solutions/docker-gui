"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Chip,
  Paper,
  Stack,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow
} from "@mui/material";
import Grid from "@mui/material/Grid";
import { toast } from "sonner";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useBottomPanel } from "@/components/common/bottom-panel-context";
import { useConfirmationDialog } from "@/components/common/confirmation-dialog-provider";
import EmptyState from "@/components/common/empty-state";
import ContainerCard from "@/features/docker/containers/components/container-card";
import ContainerContextMenu from "@/features/docker/containers/components/container-context-menu";
import ContainerGroupActions from "@/features/docker/containers/components/container-group-actions";
import ContainerListToolbar from "@/features/docker/containers/components/container-list-toolbar";
import ContainerMaintenancePanel from "@/features/docker/containers/components/container-maintenance-panel";
import ContainerTableRow from "@/features/docker/containers/components/container-table-row";
import CreateContainerDialog from "@/features/docker/containers/components/create-container-dialog";
import ContainerDetailDialog from "@/features/docker/containers/components/container-detail-dialog";
import {
  useContainerActions,
  useContainerState,
  useContainers
} from "@/features/docker/containers/hooks/use-containers";
import { useGroupedContainers } from "@/features/docker/containers/hooks/use-grouped-containers";
import { formatBytes } from "@/lib/utils/format";
import type { DockerContainer } from "@/types/docker";

const ContainerList = () => {
  const { data, isLoading, isError, error, isFetching } = useContainers({ refetchIntervalMs: 10_000 });
  const actions = useContainerActions();
  const containerState = useContainerState();
  const { openLogs, openTerminal } = useBottomPanel();
  const { confirm } = useConfirmationDialog();

  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [menuAnchor, setMenuAnchor] = useState<{ id: string; anchor: HTMLElement } | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [detailContainerId, setDetailContainerId] = useState<string | null>(null);

  const groupedContainers = useGroupedContainers(data);
  const showSkeleton = isLoading && (!data || data.length === 0);

  // Filter containers based on search query
  const filteredData = useMemo(() => {
    if (!data || !searchQuery.trim()) {
      return data;
    }
    
    const query = searchQuery.toLowerCase().trim();
    return data.filter((container) => {
      return (
        container.name.toLowerCase().includes(query) ||
        container.id.toLowerCase().includes(query) ||
        container.image.toLowerCase().includes(query) ||
        container.state.toLowerCase().includes(query) ||
        (container.project && container.project.toLowerCase().includes(query)) ||
        (container.service && container.service.toLowerCase().includes(query))
      );
    });
  }, [data, searchQuery]);

  const filteredGroupedContainers = useGroupedContainers(filteredData);

  const handleViewModeChange = useCallback((mode: "grid" | "list") => {
    setViewMode(mode);
  }, []);

  const selectedContainer = useMemo(() => {
    if (!menuAnchor?.id || !data) {
      return undefined;
    }
    return data.find((container) => container.id === menuAnchor.id);
  }, [data, menuAnchor]);

  const openCreateDialog = useCallback(() => {
    setIsCreateOpen(true);
  }, []);

  const closeCreateDialog = useCallback(() => {
    setIsCreateOpen(false);
  }, []);

  const handleViewContainer = useCallback((containerId: string) => {
    setDetailContainerId(containerId);
  }, []);

  const handleMenuOpen = useCallback((containerId: string, anchor: HTMLElement) => {
    setMenuAnchor({ id: containerId, anchor });
  }, []);

  const handleMenuClose = useCallback(() => {
    setMenuAnchor(null);
  }, []);

  const handleStart = useCallback(
    async (id: string, name: string) => {
      const confirmed = await confirm({
        title: "Start container",
        message: `Start container "${name}"? This will start the container and make it available to the network.`,
        confirmLabel: "Start",
        cancelLabel: "Cancel",
        tone: "default"
      });

      if (!confirmed) {
        return;
      }

      await toast.promise(actions.start({ id, name }), {
        loading: `Starting ${name}...`,
        success: `Started ${name}`,
        error: (err) => (err instanceof Error ? err.message : `Unable to start ${name}`)
      });
    },
    [actions, confirm]
  );

  const handleStop = useCallback(
    async (id: string, name: string) => {
      const confirmed = await confirm({
        title: "Stop container",
        message: `Stop container "${name}"? This will stop the container and make it unavailable to the network.`,
        confirmLabel: "Stop",
        cancelLabel: "Cancel",
        tone: "default"
      });

      if (!confirmed) {
        return;
      }

      await toast.promise(actions.stop({ id, name }), {
        loading: `Stopping ${name}...`,
        success: `Stopped ${name}`,
        error: (err) => (err instanceof Error ? err.message : `Unable to stop ${name}`)
      });
    },
    [actions, confirm]
  );

  const handleRestart = useCallback(
    async (id: string, name: string) => {
      await toast.promise(actions.restart({ id, name }), {
        loading: `Restarting ${name}...`,
        success: `Restarted ${name}`,
        error: (err) => (err instanceof Error ? err.message : `Unable to restart ${name}`)
      });
    },
    [actions]
  );

  const handleRemove = useCallback(
    async (id: string, name: string) => {
      const confirmed = await confirm({
        title: "Remove container",
        message: `Remove container "${name}"? This will delete the container and any ephemeral data.`,
        confirmLabel: "Remove",
        cancelLabel: "Cancel",
        tone: "danger"
      });

      if (!confirmed) {
        return;
      }

      await toast.promise(actions.remove({ id, name }), {
        loading: `Removing ${name}...`,
        success: `Removed ${name}`,
        error: (err) => (err instanceof Error ? err.message : `Unable to remove ${name}`)
      });
    },
    [actions, confirm]
  );

  const handleGroupStart = useCallback(
    async (containers: DockerContainer[]) => {
      const targets = containers.filter((container) => container.state !== "running");
      if (targets.length === 0) {
        toast.info("All containers are already running");
        return;
      }

      await toast.promise(actions.startMany(targets), {
        loading: `Starting ${targets.length} container${targets.length > 1 ? "s" : ""}...`,
        success: `Started ${targets.length} container${targets.length > 1 ? "s" : ""}`,
        error: (err) =>
          err instanceof Error ? err.message : "Unable to start selected containers"
      });
    },
    [actions]
  );

  const handleGroupStop = useCallback(
    async (containers: DockerContainer[]) => {
      const targets = containers.filter((container) => container.state === "running");
      if (targets.length === 0) {
        toast.info("All containers are already stopped");
        return;
      }

      await toast.promise(actions.stopMany(targets), {
        loading: `Stopping ${targets.length} container${targets.length > 1 ? "s" : ""}...`,
        success: `Stopped ${targets.length} container${targets.length > 1 ? "s" : ""}`,
        error: (err) =>
          err instanceof Error ? err.message : "Unable to stop selected containers"
      });
    },
    [actions]
  );

  const handleGroupRestart = useCallback(
    async (containers: DockerContainer[]) => {
      const targets = containers.filter((container) => container.state === "running");
      if (targets.length === 0) {
        toast.info("No running containers to restart");
        return;
      }

      await toast.promise(actions.restartMany(targets), {
        loading: `Restarting ${targets.length} container${targets.length > 1 ? "s" : ""}...`,
        success: `Restarted ${targets.length} container${targets.length > 1 ? "s" : ""}`,
        error: (err) =>
          err instanceof Error ? err.message : "Unable to restart selected containers"
      });
    },
    [actions]
  );

  const handleGroupRemove = useCallback(
    async (containers: DockerContainer[], groupLabel: string) => {
      const confirmed = await confirm({
        title: "Delete containers",
        message: `Delete all ${containers.length} container${containers.length > 1 ? "s" : ""} in "${groupLabel}"? This cannot be undone.`,
        confirmLabel: "Delete",
        cancelLabel: "Cancel",
        tone: "danger"
      });

      if (!confirmed) {
        return;
      }

      await toast.promise(actions.removeMany(containers), {
        loading: `Removing ${containers.length} container${containers.length > 1 ? "s" : ""}...`,
        success: `Removed ${containers.length} container${containers.length > 1 ? "s" : ""}`,
        error: (err) =>
          err instanceof Error ? err.message : "Unable to remove selected containers"
      });
    },
    [actions, confirm]
  );

  const handleGroupLogs = useCallback(
    (containers: DockerContainer[]) => {
      containers.forEach((container) => {
        openLogs(container.id, container.name);
      });
      toast.success(`Opened logs for ${containers.length} container${containers.length > 1 ? "s" : ""}`);
    },
    [openLogs]
  );

  const handlePruneContainers = useCallback(async () => {
    const confirmed = await confirm({
      title: "Prune stopped containers",
      message: "Remove all stopped containers? This will permanently delete containers that are not running.",
      confirmLabel: "Prune",
      cancelLabel: "Cancel",
      tone: "danger"
    });

    if (!confirmed) {
      return;
    }

    await toast.promise(actions.pruneContainers(), {
      loading: "Removing stopped containers...",
      success: (summary) =>
        summary.removedCount
          ? `Removed ${summary.removedCount} container${summary.removedCount > 1 ? "s" : ""} and reclaimed ${formatBytes(summary.reclaimedSpace)}.`
          : "No stopped containers to remove.",
      error: (err) => (err instanceof Error ? err.message : "Unable to prune containers")
    });
  }, [actions, confirm]);

  const handlePruneImages = useCallback(async () => {
    const confirmed = await confirm({
      title: "Prune unused images",
      message: "Remove all unused and dangling images? This will free up disk space but cannot be undone.",
      confirmLabel: "Prune",
      cancelLabel: "Cancel",
      tone: "danger"
    });

    if (!confirmed) {
      return;
    }

    await toast.promise(actions.pruneImages(), {
      loading: "Removing unused images...",
      success: (summary) =>
        summary.removedCount
          ? `Removed ${summary.removedCount} image${summary.removedCount > 1 ? "s" : ""} and reclaimed ${formatBytes(summary.reclaimedSpace)}.`
          : "No unused images to clean up.",
      error: (err) => (err instanceof Error ? err.message : "Unable to prune images")
    });
  }, [actions, confirm]);

  const totalCount = data?.length ?? 0;
  const filteredCount = filteredData?.length ?? 0;

  if (isError && !showSkeleton) {
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

  if (!showSkeleton && (!data || data.length === 0)) {
    return (
      <>
        <ContainerListToolbar
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          onCreate={openCreateDialog}
          onPruneContainers={handlePruneContainers}
          onPruneImages={handlePruneImages}
          isRefreshing={isFetching}
          isPruningContainers={containerState.isPruningContainers}
          isPruningImages={containerState.isPruningImages}
          totalCount={0}
          filteredCount={0}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
        <EmptyState
          title="No containers found"
          description="Connect to a Docker daemon to see running containers and orchestrate workloads."
        />
        <CreateContainerDialog open={isCreateOpen} onClose={closeCreateDialog} />
      </>
    );
  }

  return (
    <>
      <Stack spacing={3}>
        <ContainerListToolbar
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          onCreate={openCreateDialog}
          onPruneContainers={handlePruneContainers}
          onPruneImages={handlePruneImages}
          isRefreshing={isFetching}
          isPruningContainers={containerState.isPruningContainers}
          isPruningImages={containerState.isPruningImages}
          totalCount={totalCount}
          filteredCount={filteredCount}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
        {showSkeleton ? (
          viewMode === "grid" ? (
            <Grid container spacing={2}>
              {Array.from({ length: 6 }).map((_, index) => (
                <Grid key={`container-skeleton-${index}`} size={{ xs: 12, sm: 6, lg: 4 }}>
                  <ContainerCard container={null} />
                </Grid>
              ))}
            </Grid>
          ) : (
            <Paper variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>CPU</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Memory</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Array.from({ length: 5 }).map((_, index) => (
                    <ContainerTableRow key={`container-table-skeleton-${index}`} container={null} />
                  ))}
                </TableBody>
              </Table>
            </Paper>
          )
        ) : filteredCount === 0 && searchQuery ? (
          <EmptyState
            title="No containers match your search"
            description={`No containers found matching "${searchQuery}". Try a different search term.`}
          />
        ) : (
          filteredGroupedContainers.map((group) => {
            const bulkAction = containerState.bulkAction;
            const isGroupBusy =
              Boolean(bulkAction) &&
              group.containers.some((container) => bulkAction?.targetIds.includes(container.id));
            const loadingAction = isGroupBusy ? bulkAction?.action ?? null : null;
            const runningCount = group.containers.filter((container) => container.state === "running").length;
            const stoppedCount = group.containers.length - runningCount;

            return (
              <Accordion key={group.key} defaultExpanded disableGutters sx={{ borderRadius: 2, overflow: "hidden" }}>
                <AccordionSummary 
                  expandIcon={<ExpandMoreIcon />}
                  sx={{ 
                    '& .MuiAccordionSummary-content': { 
                      alignItems: 'center',
                      gap: 1,
                      my: 1
                    }
                  }}
                >
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ flex: 1, mr: 2 }}>
                    <Typography variant="subtitle1" fontWeight={600} noWrap>
                      {group.label}
                    </Typography>
                    <Chip size="small" label={`${group.containers.length} total`} variant="outlined" />
                    <Chip size="small" label={`${runningCount} running`} color="success" variant="outlined" />
                    <Chip size="small" label={`${stoppedCount} stopped`} variant="outlined" />
                  </Stack>
                  <Stack 
                    direction="row" 
                    spacing={0.5}
                    onClick={(e) => e.stopPropagation()}
                    sx={{ mr: 1 }}
                  >
                    <ContainerGroupActions
                      groupLabel={group.label}
                      containerCount={group.containers.length}
                      containers={group.containers}
                      loadingAction={loadingAction}
                      onGroupStart={handleGroupStart}
                      onGroupStop={handleGroupStop}
                      onGroupRestart={handleGroupRestart}
                      onGroupLogs={handleGroupLogs}
                      onGroupDelete={handleGroupRemove}
                    />
                  </Stack>
                </AccordionSummary>
                <AccordionDetails>
                  <Stack spacing={2}>
                    {viewMode === "grid" ? (
                      <Grid container spacing={2}>
                        {group.containers.map((container) => (
                          <Grid key={container.id} size={{ xs: 12, sm: 6, lg: 4 }}>
                            <ContainerCard
                              container={container}
                              isLoading={containerState.isContainerActionInFlight(container.id)}
                              onStart={handleStart}
                              onStop={handleStop}
                              onRestart={handleRestart}
                              onOpenTerminal={openTerminal}
                              onOpenLogs={openLogs}
                              onMenuOpen={handleMenuOpen}
                              onViewDetail={handleViewContainer}
                            />
                          </Grid>
                        ))}
                      </Grid>
                    ) : (
                      <Paper variant="outlined">
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                              <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                              <TableCell sx={{ fontWeight: 600 }}>CPU</TableCell>
                              <TableCell sx={{ fontWeight: 600 }}>Memory</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 600 }}>Actions</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {group.containers.map((container) => (
                              <ContainerTableRow
                                key={container.id}
                                container={container}
                                isLoading={containerState.isContainerActionInFlight(container.id)}
                                onStart={handleStart}
                                onStop={handleStop}
                              onRestart={handleRestart}
                              onOpenTerminal={openTerminal}
                              onOpenLogs={openLogs}
                              onMenuOpen={handleMenuOpen}
                              onRowClick={(rowContainer) => handleViewContainer(rowContainer.id)}
                            />
                          ))}
                        </TableBody>
                      </Table>
                    </Paper>
                    )}
                  </Stack>
                </AccordionDetails>
              </Accordion>
            );
          })
        )}
      </Stack>
      <ContainerContextMenu
        anchorEl={menuAnchor?.anchor ?? null}
        container={selectedContainer}
        onClose={handleMenuClose}
        onOpenTerminalDrawer={openTerminal}
        onOpenTerminalTab={(id) => window.open(`/docker/containers/${id}/shell`, "_blank", "noopener,noreferrer")}
        onOpenLogsDrawer={openLogs}
        onOpenLogsTab={(id) => window.open(`/docker/logs?containerId=${id}`, "_blank", "noopener,noreferrer")}
        onRemove={handleRemove}
      />
      <CreateContainerDialog open={isCreateOpen} onClose={closeCreateDialog} />
      <ContainerDetailDialog
        open={Boolean(detailContainerId)}
        onClose={() => setDetailContainerId(null)}
        containerId={detailContainerId}
      />
    </>
  );
};

export default ContainerList;
