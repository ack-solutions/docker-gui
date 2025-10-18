"use client";

import { Box, Card, CardContent, Chip, CircularProgress, Stack, Tooltip, Typography } from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import TerminalIcon from "@mui/icons-material/Terminal";
import ArticleIcon from "@mui/icons-material/Article";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ActionIconButton from "@/components/common/action-icon-button";
import UsageBar from "@/features/docker/containers/components/usage-bar";
import type { DockerContainer } from "@/types/docker";

interface ContainerListItemMobileProps {
  container: DockerContainer;
  isLoading?: boolean;
  onStart?: (id: string, name: string) => void;
  onStop?: (id: string, name: string) => void;
  onRestart?: (id: string, name: string) => void;
  onOpenTerminal?: (id: string, name: string) => void;
  onOpenLogs?: (id: string, name: string) => void;
  onMenuOpen?: (id: string, anchor: HTMLElement) => void;
  onViewDetail?: (id: string) => void;
}

const ContainerListItemMobile = ({
  container,
  isLoading = false,
  onStart,
  onStop,
  onRestart,
  onOpenTerminal,
  onOpenLogs,
  onMenuOpen,
  onViewDetail
}: ContainerListItemMobileProps) => {
  const isRunning = container.state === "running";

  return (
    <Card 
      onClick={() => onViewDetail?.(container.id)}
      sx={{ 
        touchAction: "manipulation",
        cursor: "pointer",
        transition: "transform 0.15s, box-shadow 0.15s",
        "&:active": {
          transform: "scale(0.99)",
          boxShadow: 1
        }
      }}
    >
      <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
        <Stack spacing={1.5}>
          {/* Header */}
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
            <Box flex={1} minWidth={0}>
              <Typography variant="subtitle1" fontWeight={600} noWrap>
                {container.name}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                {container.image}
              </Typography>
            </Box>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Chip
                size="small"
                label={isRunning ? "Running" : "Stopped"}
                color={isRunning ? "success" : "default"}
                sx={{ fontSize: "0.7rem", height: 20 }}
              />
              <ChevronRightIcon fontSize="small" color="action" />
            </Stack>
          </Stack>

          {/* Metrics */}
          <Stack spacing={1}>
            <Stack spacing={0.5}>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="caption" color="text.secondary">CPU</Typography>
                <Typography variant="caption" color="text.secondary" fontWeight={500}>
                  {container.cpuUsage.toFixed(1)}%
                </Typography>
              </Stack>
              <UsageBar value={container.cpuUsage} />
            </Stack>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="caption" color="text.secondary">Memory</Typography>
              <Chip 
                size="small" 
                label={`${container.memoryUsage.toFixed(0)} MiB`} 
                variant="outlined"
                sx={{ fontSize: "0.7rem", height: 20 }}
              />
            </Stack>
          </Stack>

          {/* Quick Actions */}
          <Stack 
            direction="row" 
            spacing={0.5} 
            justifyContent="flex-end"
            onClick={(e) => e.stopPropagation()}
          >
            {!isRunning && (
              <Tooltip title="Start">
                <ActionIconButton
                  color="primary"
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    onStart?.(container.id, container.name);
                  }}
                  disabled={isLoading}
                >
                  {isLoading ? <CircularProgress size={16} /> : <PlayArrowIcon fontSize="small" />}
                </ActionIconButton>
              </Tooltip>
            )}
            {isRunning && (
              <>
                <Tooltip title="Stop">
                  <ActionIconButton
                    color="warning"
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      onStop?.(container.id, container.name);
                    }}
                    disabled={isLoading}
                  >
                    {isLoading ? <CircularProgress size={16} /> : <StopIcon fontSize="small" />}
                  </ActionIconButton>
                </Tooltip>
                <Tooltip title="Terminal">
                  <ActionIconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenTerminal?.(container.id, container.name);
                    }}
                  >
                    <TerminalIcon fontSize="small" />
                  </ActionIconButton>
                </Tooltip>
                <Tooltip title="Logs">
                  <ActionIconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenLogs?.(container.id, container.name);
                    }}
                  >
                    <ArticleIcon fontSize="small" />
                  </ActionIconButton>
                </Tooltip>
              </>
            )}
            <Tooltip title="More">
              <ActionIconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onMenuOpen?.(container.id, e.currentTarget);
                }}
              >
                <MoreHorizIcon fontSize="small" />
              </ActionIconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
};

export default ContainerListItemMobile;

