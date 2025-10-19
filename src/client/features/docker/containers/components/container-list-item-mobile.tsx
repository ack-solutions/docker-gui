"use client";

import {
  Card,
  CardContent,
  Chip,
  Stack,
  Typography,
  Tooltip,
  Box,
  Divider,
  CircularProgress
} from "@mui/material";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import TerminalIcon from "@mui/icons-material/Terminal";
import ArticleIcon from "@mui/icons-material/Article";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import ActionIconButton from "@/components/common/action-icon-button";
import type { DockerContainer } from "@/types/docker";

interface ContainerListItemMobileProps {
  container: DockerContainer;
  isBusy?: boolean;
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
  isBusy,
  isLoading,
  onStart,
  onStop,
  onRestart,
  onOpenTerminal,
  onOpenLogs,
  onMenuOpen,
  onViewDetail
}: ContainerListItemMobileProps) => {
  const isRunning = container.state === "running";
  const statusColor =
    container.state === "running"
      ? "success"
      : container.state === "exited"
        ? "default"
        : "warning";
  const busy = Boolean(isBusy ?? isLoading);

  return (
    <Card
      onClick={() => onViewDetail?.(container.id)}
      sx={{
        borderRadius: 2,
        boxShadow: "none",
        border: (theme) => `1px solid ${theme.palette.divider}`
      }}
    >
      <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
        <Stack spacing={1.5}>
          <Stack direction="row" alignItems="flex-start" spacing={1.5}>
            <Box flex={1} minWidth={0}>
              <Typography variant="subtitle1" fontSize="0.95rem" fontWeight={600} noWrap>
                {container.name}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                {container.image}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                #{container.id.slice(0, 12)}
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip
                size="small"
                color={statusColor as any}
                label={container.state.toUpperCase()}
                sx={{ fontSize: "0.65rem" }}
              />
              <ChevronRightIcon fontSize="small" color="action" />
            </Stack>
          </Stack>

          <Stack direction="row" spacing={1.5} alignItems="center" divider={<Divider orientation="vertical" flexItem />}>
            <Typography variant="caption" color="text.secondary">
              CPU&nbsp;
              <Typography component="span" variant="body2" fontWeight={600}>
                {container.cpuUsage.toFixed(1)}%
              </Typography>
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Memory&nbsp;
              <Typography component="span" variant="body2" fontWeight={600}>
                {container.memoryUsage.toFixed(0)} MiB
              </Typography>
            </Typography>
            {(container.project || container.service) && (
              <Typography variant="caption" color="text.secondary" noWrap>
                {container.project ?? container.service}
              </Typography>
            )}
          </Stack>

          <Stack
            direction="row"
            spacing={0.75}
            justifyContent="flex-end"
            onClick={(event) => event.stopPropagation()}
          >
            {isRunning ? (
              <>
                <Tooltip title="Stop container">
                  <ActionIconButton
                    color="warning"
                    size="small"
                    onClick={() => onStop?.(container.id, container.name)}
                    disabled={busy}
                  >
                    {busy ? <CircularProgress size={16} color="inherit" /> : <StopIcon fontSize="small" />}
                  </ActionIconButton>
                </Tooltip>
                <Tooltip title="Restart container">
                  <ActionIconButton
                    color="secondary"
                    size="small"
                    onClick={() => onRestart?.(container.id, container.name)}
                    disabled={busy}
                  >
                    {busy ? <CircularProgress size={16} color="inherit" /> : <RestartAltIcon fontSize="small" />}
                  </ActionIconButton>
                </Tooltip>
                <Tooltip title="Open terminal">
                  <ActionIconButton
                    size="small"
                    onClick={() => onOpenTerminal?.(container.id, container.name)}
                  >
                    <TerminalIcon fontSize="small" />
                  </ActionIconButton>
                </Tooltip>
                <Tooltip title="View logs">
                  <ActionIconButton
                    size="small"
                    onClick={() => onOpenLogs?.(container.id, container.name)}
                  >
                    <ArticleIcon fontSize="small" />
                  </ActionIconButton>
                </Tooltip>
              </>
            ) : (
              <Tooltip title="Start container">
                <ActionIconButton
                  color="primary"
                  size="small"
                  onClick={() => onStart?.(container.id, container.name)}
                  disabled={busy}
                >
                  {busy ? <CircularProgress size={16} color="inherit" /> : <PlayArrowIcon fontSize="small" />}
                </ActionIconButton>
              </Tooltip>
            )}
            <Tooltip title="More actions">
              <ActionIconButton
                size="small"
                onClick={(event) => onMenuOpen?.(container.id, event.currentTarget)}
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
