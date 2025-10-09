"use client";

import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import StopIcon from "@mui/icons-material/Stop";
import TerminalIcon from "@mui/icons-material/Terminal";
import DescriptionIcon from "@mui/icons-material/Description";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { Button, Chip, Stack, Tooltip, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import Link from "next/link";
import moment from "moment";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useContainerState, useContainerStore } from "@/features/docker/containers/context/container-provider";
import { useConfirmationDialog } from "@/components/common/confirmation-dialog-provider";
import type { DockerContainer, DockerContainerInspect } from "@/types/docker";

const HeaderShell = styled(Stack)(({ theme }) => ({
  padding: theme.spacing(3),
  borderRadius:
    typeof theme.shape.borderRadius === "number"
      ? theme.shape.borderRadius * 1.5
      : theme.shape.borderRadius,
  background: theme.palette.mode === "dark"
    ? "linear-gradient(135deg, rgba(56,189,248,0.08), rgba(59,130,246,0.12))"
    : "linear-gradient(135deg, rgba(59,130,246,0.12), rgba(37,99,235,0.08))",
  border: `1px solid ${theme.palette.divider}`
}));

interface ContainerDetailHeaderProps {
  container?: DockerContainer;
  inspect?: DockerContainerInspect;
}

const ContainerDetailHeader = ({ container, inspect }: ContainerDetailHeaderProps) => {
  const name = container?.name ?? inspect?.name ?? "Unknown container";
  const status = container?.state ?? inspect?.state.status ?? "unknown";
  const isRunning = inspect?.state.running ?? (container?.state === "running");
  const startedAt = inspect?.state.startedAt ?? container?.createdAt;
  const image = container?.image ?? inspect?.image;
  const { actions } = useContainerStore();
  const containerState = useContainerState();
  const { confirm } = useConfirmationDialog();
  const router = useRouter();
  const containerId = container?.id ?? inspect?.id ?? "";
  const isBusy = containerId ? containerState.isContainerActionInFlight(containerId) : false;

  const handleStart = async () => {
    if (!containerId || !name) {
      return;
    }
    await toast.promise(actions.start({ id: containerId, name }), {
      loading: `Starting ${name}...`,
      success: `Started ${name}`,
      error: (error) => error instanceof Error ? error.message : `Unable to start ${name}`
    });
  };

  const handleStop = async () => {
    if (!containerId || !name) {
      return;
    }
    await toast.promise(actions.stop({ id: containerId, name }), {
      loading: `Stopping ${name}...`,
      success: `Stopped ${name}`,
      error: (error) => error instanceof Error ? error.message : `Unable to stop ${name}`
    });
  };

  const handleRestart = async () => {
    if (!containerId || !name) {
      return;
    }
    await toast.promise(actions.restart({ id: containerId, name }), {
      loading: `Restarting ${name}...`,
      success: `Restarted ${name}`,
      error: (error) => error instanceof Error ? error.message : `Unable to restart ${name}`
    });
  };

  const handleRemove = async () => {
    if (!containerId || !name) {
      return;
    }

    const confirmed = await confirm({
      title: "Remove container",
      message: `Delete ${name}? This cannot be undone.`,
      confirmLabel: "Remove",
      tone: "danger"
    });

    if (!confirmed) {
      return;
    }

    await toast.promise(actions.remove({ id: containerId, name }), {
      loading: `Removing ${name}...`,
      success: () => {
        router.push("/containers");
        return `Removed ${name}`;
      },
      error: (error) => error instanceof Error ? error.message : `Unable to remove ${name}`
    });
  };

  return (
    <HeaderShell spacing={2}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ xs: "flex-start", md: "center" }}>
        <Stack spacing={0.5} flex={1}>
          <Typography variant="h5">{name}</Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip label={status} size="small" color={isRunning ? "success" : "default"} />
            {image && (
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="body2" color="text.secondary">
                  Image:
                </Typography>
                <Chip label={image} size="small" variant="outlined" />
              </Stack>
            )}
            {startedAt && (
              <Typography variant="body2" color="text.secondary">
                Started {moment(startedAt).fromNow()}
              </Typography>
            )}
          </Stack>
        </Stack>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          {isRunning ? (
            <>
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
            </>
          ) : (
            <Tooltip title="Start container">
              <Button
                variant="contained"
                color="primary"
                startIcon={<PlayArrowIcon fontSize="small" />}
                onClick={handleStart}
                disabled={isBusy}
              >
                Start
              </Button>
            </Tooltip>
          )}
          <Tooltip title="Open interactive shell">
            <Button
              component={Link}
              href={`/containers/${containerId}/shell`}
              variant="outlined"
              startIcon={<TerminalIcon fontSize="small" />}
            >
              Shell
            </Button>
          </Tooltip>
          <Tooltip title="View logs page">
            <Button
              component={Link}
              href={`/logs?containerId=${containerId}`}
              variant="outlined"
              startIcon={<DescriptionIcon fontSize="small" />}
            >
              Logs
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
    </HeaderShell>
  );
};

export default ContainerDetailHeader;
