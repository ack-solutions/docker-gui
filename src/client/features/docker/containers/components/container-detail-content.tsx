"use client";

import { useState, useMemo, useCallback } from "react";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { 
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  Paper,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography
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
import { useRouter } from "next/navigation";

interface ContainerDetailContentProps {
  containerId: string;
  showInDialog?: boolean;
}

const ContainerDetailContent = ({ containerId, showInDialog = false }: ContainerDetailContentProps) => {
  const [tab, setTab] = useState("overview");
  
  const { data: containers } = useContainers();
  const container = useMemo(() => containers?.find((item) => item.id === containerId), [containers, containerId]);
  const inspectQuery = useContainerInspect(containerId);
  const actions = useContainerActions();
  const containerState = useContainerState();
  const { confirm } = useConfirmationDialog();
  const router = useRouter();

  const handleExecuteCommand = useCallback(
    async (tokens: string[]) => {
      return executeContainerCommand(containerId, tokens);
    },
    [containerId]
  );

  const inspect = inspectQuery.data;
  const name = container?.name ?? inspect?.name ?? "Unknown";
  const status = container?.state ?? inspect?.state.status ?? "unknown";
  const isRunning = inspect?.state.running ?? (container?.state === "running");
  const isBusy = containerState.isContainerActionInFlight(containerId);

  const handleStart = async () => {
    await toast.promise(actions.start({ id: containerId, name }), {
      loading: `Starting ${name}...`,
      success: `Started ${name}`,
      error: (error) => error instanceof Error ? error.message : `Unable to start ${name}`
    });
  };

  const handleStop = async () => {
    await toast.promise(actions.stop({ id: containerId, name }), {
      loading: `Stopping ${name}...`,
      success: `Stopped ${name}`,
      error: (error) => error instanceof Error ? error.message : `Unable to stop ${name}`
    });
  };

  const handleRestart = async () => {
    await toast.promise(actions.restart({ id: containerId, name }), {
      loading: `Restarting ${name}...`,
      success: `Restarted ${name}`,
      error: (error) => error instanceof Error ? error.message : `Unable to restart ${name}`
    });
  };

  const handleRemove = async () => {
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
        router.push("/docker/containers");
        return `Removed ${name}`;
      },
      error: (error) => error instanceof Error ? error.message : `Unable to remove ${name}`
    });
  };

  if (inspectQuery.isLoading) {
    return (
      <Stack alignItems="center" justifyContent="center" py={6} spacing={2}>
        <CircularProgress />
        <Typography variant="body2" color="text.secondary">
          Loading container details...
        </Typography>
      </Stack>
    );
  }

  if (inspectQuery.isError || !inspect) {
    return (
      <Paper sx={{ p: 4 }}>
        <Typography variant="h6" gutterBottom>
          Container details unavailable
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {inspectQuery.error instanceof Error ? inspectQuery.error.message : "Unable to inspect container. It may have been removed."}
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 3, borderRadius: 3 }}>
      <Stack spacing={3}>
        {/* Header section with container info and actions */}
        <Stack spacing={2}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ xs: "flex-start", md: "center" }}>
            <Stack spacing={1} flex={1}>
              <Typography variant="h5">
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
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {!isRunning ? (
                <Tooltip title="Start container">
                  <Button
                    variant="contained"
                    color="success"
                    startIcon={<PlayArrowIcon fontSize="small" />}
                    onClick={handleStart}
                    disabled={isBusy}
                  >
                    Start
                  </Button>
                </Tooltip>
              ) : (
                <Tooltip title="Stop container">
                  <Button
                    variant="contained"
                    color="warning"
                    startIcon={<StopIcon fontSize="small" />}
                    onClick={handleStop}
                    disabled={isBusy}
                  >
                    Stop
                  </Button>
                </Tooltip>
              )}
              <Tooltip title="Restart container">
                <Button
                  variant="outlined"
                  startIcon={<RestartAltIcon fontSize="small" />}
                  onClick={handleRestart}
                  disabled={isBusy}
                >
                  Restart
                </Button>
              </Tooltip>
              <Tooltip title="Remove container">
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteOutlineIcon fontSize="small" />}
                  onClick={handleRemove}
                  disabled={isBusy}
                >
                  Remove
                </Button>
              </Tooltip>
            </Stack>
          </Stack>
        </Stack>

        <Divider />

        {/* Tabs */}
        <Box>
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
        </Box>

        {/* Tab content */}
        <Box>
          {tab === "overview" && <ContainerOverviewPanel inspect={inspect} />}
          {tab === "logs" && <LogsPanel containerId={containerId} containerName={name} />}
          {tab === "files" && <FileBrowser containerId={containerId} />}
          {tab === "terminal" && (
            <Box sx={{ display: "flex", flexDirection: "column" }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Interactive shell session for {name}.
              </Typography>
              <Box sx={{ minHeight: 400 }}>
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
        </Box>
      </Stack>
    </Paper>
  );
};

export default ContainerDetailContent;

