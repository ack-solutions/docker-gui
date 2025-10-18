"use client";

import { Box, Card, CardContent, Chip, CircularProgress, Skeleton, Stack, Tooltip, Typography } from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import TerminalIcon from "@mui/icons-material/Terminal";
import ArticleIcon from "@mui/icons-material/Article";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { useRouter } from "next/navigation";
import ActionIconButton from "@/components/common/action-icon-button";
import UsageBar from "@/features/docker/containers/components/usage-bar";
import type { DockerContainer } from "@/types/docker";

interface ContainerCardProps {
  container?: DockerContainer | null;
  isLoading?: boolean;
  onStart?: (id: string, name: string) => void;
  onStop?: (id: string, name: string) => void;
  onRestart?: (id: string, name: string) => void;
  onOpenTerminal?: (id: string, name: string) => void;
  onOpenLogs?: (id: string, name: string) => void;
  onMenuOpen?: (id: string, anchor: HTMLElement) => void;
  onViewDetail?: (id: string) => void;
}

const ContainerCard = ({
  container,
  isLoading = false,
  onStart,
  onStop,
  onRestart,
  onOpenTerminal,
  onOpenLogs,
  onMenuOpen,
  onViewDetail
}: ContainerCardProps) => {
  if (!container) {
    return (
      <Card sx={{ height: "100%" }}>
        <CardContent sx={{ display: "flex", flexDirection: "column", gap: 1.5, p: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1.5}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Skeleton variant="text" width="70%" height={22} />
              <Skeleton variant="text" width="50%" height={16} />
            </Box>
            <Skeleton variant="rounded" width={56} height={20} />
          </Stack>
          <Stack spacing={0.75}>
            <Skeleton variant="rounded" height={10} />
            <Skeleton variant="text" width="40%" height={14} />
          </Stack>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Skeleton variant="text" width={80} height={16} />
            <Skeleton variant="rounded" width={64} height={20} />
          </Stack>
          <Box sx={{ display: "flex", gap: 0.5, justifyContent: "flex-end" }}>
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} variant="circular" width={28} height={28} />
            ))}
          </Box>
        </CardContent>
      </Card>
    );
  }

  const isRunning = container.state === "running";

  return (
    <Card sx={{ height: "100%" }}>
        <CardContent sx={{ display: "flex", flexDirection: "column", gap: 1.5, p: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1.5}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle2" fontWeight={600} noWrap>
                {container.name}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                {container.image}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                #{container.id.slice(0, 12)}
              </Typography>
            </Box>
            <Chip
              size="small"
              label={isRunning ? "Running" : "Stopped"}
              color={isRunning ? "success" : "default"}
              sx={{ flexShrink: 0 }}
            />
          </Stack>

          <Stack spacing={0.75}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="caption" color="text.secondary">
                CPU
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {container.cpuUsage.toFixed(1)}%
              </Typography>
            </Stack>
            <UsageBar value={container.cpuUsage} />
          </Stack>

          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="caption" color="text.secondary">
              Memory
            </Typography>
            <Chip size="small" label={`${container.memoryUsage.toFixed(0)} MiB`} variant="outlined" />
          </Stack>

          <Box
            sx={{
              display: "flex",
              gap: 0.5,
              justifyContent: "flex-end",
              mt: 0.5
            }}
          >
            {container.state !== "running" && (
              <Tooltip title="Start container">
                <ActionIconButton
                  color="primary"
                  size="small"
                  onClick={() => onStart?.(container.id, container.name)}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <CircularProgress size={16} color="inherit" />
                  ) : (
                    <PlayArrowIcon fontSize="small" />
                  )}
                </ActionIconButton>
              </Tooltip>
            )}
            {container.state === "running" && (
              <>
                <Tooltip title="Stop container">
                  <ActionIconButton
                    color="warning"
                    size="small"
                    onClick={() => onStop?.(container.id, container.name)}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <CircularProgress size={16} color="inherit" />
                    ) : (
                      <StopIcon fontSize="small" />
                    )}
                  </ActionIconButton>
                </Tooltip>
                <Tooltip title="Restart container">
                  <ActionIconButton
                    color="secondary"
                    size="small"
                    onClick={() => onRestart?.(container.id, container.name)}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <CircularProgress size={16} color="inherit" />
                    ) : (
                      <RestartAltIcon fontSize="small" />
                    )}
                  </ActionIconButton>
                </Tooltip>
                <Tooltip title="Open terminal in drawer">
                  <ActionIconButton
                    color="default"
                    size="small"
                    onClick={() => onOpenTerminal?.(container.id, container.name)}
                  >
                    <TerminalIcon fontSize="small" />
                  </ActionIconButton>
                </Tooltip>
                <Tooltip title="View logs in drawer">
                  <ActionIconButton
                    color="default"
                    size="small"
                    onClick={() => onOpenLogs?.(container.id, container.name)}
                  >
                    <ArticleIcon fontSize="small" />
                  </ActionIconButton>
                </Tooltip>
              </>
            )}
            <Tooltip title="View details">
              <ActionIconButton
                color="default"
                size="small"
                onClick={() => onViewDetail?.(container.id)}
              >
                <InfoOutlinedIcon fontSize="small" />
              </ActionIconButton>
            </Tooltip>
            <Tooltip title="More actions">
              <ActionIconButton
                color="default"
                size="small"
                onClick={(event) => onMenuOpen?.(container.id, event.currentTarget)}
              >
                <MoreHorizIcon fontSize="small" />
              </ActionIconButton>
            </Tooltip>
          </Box>
        </CardContent>
      </Card>
  );
};

export default ContainerCard;
