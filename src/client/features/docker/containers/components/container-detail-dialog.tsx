"use client";

import { useState, useCallback } from "react";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import CloseIcon from "@mui/icons-material/Close";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { 
  Dialog, 
  DialogContent, 
  IconButton, 
  Stack, 
  Tooltip,
  Chip,
  Typography,
  Tabs,
  Tab,
  Box,
  Divider,
  CircularProgress
} from "@mui/material";
import { useContainerInspect } from "@/features/docker/containers/hooks/use-container-inspect";
import { useContainers, useContainerActions, useContainerState } from "@/features/docker/containers/hooks/use-containers";
import { useConfirmationDialog } from "@/components/common/confirmation-dialog-provider";
import ContainerOverviewPanel from "@/features/docker/containers/components/detail/container-overview-panel";
import ContainerInspectViewer from "@/features/docker/containers/components/detail/container-inspect-viewer";
import ContainerConfigPanel from "@/features/docker/containers/components/detail/container-config-panel";
import CommandTerminal from "@/components/common/command-terminal";
import LogsPanel from "@/components/common/logs-panel";
import FileBrowser from "@/features/docker/files/components/file-browser";
import { executeContainerCommand } from "@/lib/api/docker";
import { toast } from "sonner";
import moment from "moment";

interface ContainerDetailDialogProps {
  open: boolean;
  onClose: () => void;
  containerId: string | null;
}

const ContainerDetailDialog = ({ open, onClose, containerId }: ContainerDetailDialogProps) => {
  const [tab, setTab] = useState("overview");
  
  const { data: containers } = useContainers();
  const container = containers?.find((item) => item.id === containerId);
  const inspectQuery = useContainerInspect(containerId || "");
  const actions = useContainerActions();
  const containerState = useContainerState();
  const { confirm } = useConfirmationDialog();

  const handleExecuteCommand = useCallback(
    async (tokens: string[]) => {
      if (!containerId) return null;
      return executeContainerCommand(containerId, tokens);
    },
    [containerId]
  );

  const handleOpenInNewTab = () => {
    if (containerId) {
      window.open(`/docker/containers/${encodeURIComponent(containerId)}`, "_blank", "noopener,noreferrer");
    }
  };

  const inspect = inspectQuery.data;
  const name = container?.name ?? inspect?.name ?? "Unknown";
  const status = container?.state ?? inspect?.state.status ?? "unknown";
  const isRunning = inspect?.state.running ?? (container?.state === "running");
  const isBusy = containerId ? containerState.isContainerActionInFlight(containerId) : false;

  const handleStart = async () => {
    if (!containerId) return;
    await toast.promise(actions.start({ id: containerId, name }), {
      loading: `Starting ${name}...`,
      success: `Started ${name}`,
      error: (error) => error instanceof Error ? error.message : `Unable to start ${name}`
    });
  };

  const handleStop = async () => {
    if (!containerId) return;
    await toast.promise(actions.stop({ id: containerId, name }), {
      loading: `Stopping ${name}...`,
      success: `Stopped ${name}`,
      error: (error) => error instanceof Error ? error.message : `Unable to stop ${name}`
    });
  };

  const handleRestart = async () => {
    if (!containerId) return;
    await toast.promise(actions.restart({ id: containerId, name }), {
      loading: `Restarting ${name}...`,
      success: `Restarted ${name}`,
      error: (error) => error instanceof Error ? error.message : `Unable to restart ${name}`
    });
  };

  const handleRemove = async () => {
    if (!containerId) return;

    const confirmed = await confirm({
      title: "Remove container",
      message: `Delete ${name}? This cannot be undone.`,
      confirmLabel: "Remove",
      tone: "danger"
    });

    if (!confirmed) return;

    await toast.promise(actions.remove({ id: containerId, name }), {
      loading: `Removing ${name}...`,
      success: () => {
        onClose();
        return `Removed ${name}`;
      },
      error: (error) => error instanceof Error ? error.message : `Unable to remove ${name}`
    });
  };

  return (
    <Dialog 
      open={open && Boolean(containerId)} 
      onClose={onClose} 
      maxWidth="lg" 
      fullWidth
      PaperProps={{
        sx: {
          height: "90vh",
          maxHeight: 900
        }
      }}
    >
      {/* Header with title and actions */}
      <Box sx={{ px: 3, pt: 2.5, pb: 0 }}>
        <Stack spacing={2}>
          {/* Title row with action buttons and close/open icons */}
          <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
            <Box flex={1}>
              {inspectQuery.isLoading ? (
                <Typography variant="h6" color="text.secondary">
                  Loading container details...
                </Typography>
              ) : inspectQuery.isError || !inspect ? (
                <Typography variant="h6" color="error">
                  Container details unavailable
                </Typography>
              ) : (
                <Stack spacing={1}>
                  <Typography variant="h6" sx={{ wordBreak: "break-all" }}>
                    {name}
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
                    <Chip label={status} size="small" color={isRunning ? "success" : "default"} />
                    {container?.image && (
                      <>
                        <Typography variant="body2" color="text.secondary">
                          Image:
                        </Typography>
                        <Chip label={container.image} size="small" variant="outlined" />
                      </>
                    )}
                    {inspect.state.startedAt && (
                      <Typography variant="body2" color="text.secondary">
                        Started {moment(inspect.state.startedAt).fromNow()}
                      </Typography>
                    )}
                  </Stack>
                </Stack>
              )}
            </Box>
            <Stack direction="row" spacing={0.5} ml={2}>
              {/* Action buttons */}
              {inspect && (
                <>
                  {!isRunning && (
                    <Tooltip title="Start container">
                      <IconButton
                        color="success"
                        size="small"
                        onClick={handleStart}
                        disabled={isBusy}
                      >
                        <PlayArrowIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                  {isRunning && (
                    <Tooltip title="Stop container">
                      <IconButton
                        color="warning"
                        size="small"
                        onClick={handleStop}
                        disabled={isBusy}
                      >
                        <StopIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                  <Tooltip title="Restart container">
                    <IconButton
                      size="small"
                      onClick={handleRestart}
                      disabled={isBusy}
                    >
                      <RestartAltIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Remove container">
                    <IconButton
                      color="error"
                      size="small"
                      onClick={handleRemove}
                      disabled={isBusy}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </>
              )}
              <Tooltip title="Open in new tab">
                <IconButton size="small" onClick={handleOpenInNewTab}>
                  <OpenInNewIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Close">
                <IconButton size="small" onClick={onClose}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>

          {/* Tabs */}
          {inspect && (
            <Tabs
              value={tab}
              onChange={(_event, value) => setTab(value)}
              variant="scrollable"
              scrollButtons="auto"
            >
              <Tab value="overview" label="Overview" />
              <Tab value="logs" label="Logs" />
              <Tab value="files" label="Files" />
              <Tab value="terminal" label="Terminal" />
              <Tab value="config" label="Config" />
              <Tab value="inspect" label="Inspect" />
            </Tabs>
          )}
        </Stack>
      </Box>
      <Divider />

      {/* Content */}
      <DialogContent sx={{ pb: 3, pt: 3 }}>
        {inspectQuery.isLoading && (
          <Stack alignItems="center" justifyContent="center" py={6} spacing={2}>
            <CircularProgress />
            <Typography variant="body2" color="text.secondary">
              Loading container details...
            </Typography>
          </Stack>
        )}
        
        {inspectQuery.isError && (
          <Typography variant="body2" color="text.secondary">
            {inspectQuery.error instanceof Error ? inspectQuery.error.message : "Unable to inspect container. It may have been removed."}
          </Typography>
        )}

        {inspect && containerId && (
          <>
            {tab === "overview" && <ContainerOverviewPanel inspect={inspect} />}
            {tab === "logs" && <LogsPanel containerId={containerId} containerName={name} />}
            {tab === "files" && <FileBrowser containerId={containerId} />}
            {tab === "terminal" && (
              <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Interactive shell session for {name}.
                </Typography>
                <Box sx={{ flex: 1, minHeight: 400 }}>
                  <CommandTerminal
                    sessionName={name}
                    promptLabel={`root@${name}:/app`}
                    welcomeMessage={`Welcome to the container shell. Connected to ${name}.`}
                    executeCommand={handleExecuteCommand}
                    fitParent={true}
                  />
                </Box>
              </Box>
            )}
            {tab === "config" && <ContainerConfigPanel inspect={inspect} />}
            {tab === "inspect" && <ContainerInspectViewer inspect={inspect} />}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ContainerDetailDialog;

