"use client";

import { Box, Card, CardContent, Chip, CircularProgress, Divider, Skeleton, Stack, Tooltip, Typography } from "@mui/material";
import Grid from "@mui/material/Grid";
import moment from "moment";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import TerminalIcon from "@mui/icons-material/Terminal";
import ArticleIcon from "@mui/icons-material/Article";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import TimelineIcon from "@mui/icons-material/Timeline";
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
}

const ContainerCard = ({
  container,
  isLoading = false,
  onStart,
  onStop,
  onRestart,
  onOpenTerminal,
  onOpenLogs,
  onMenuOpen
}: ContainerCardProps) => {
  const router = useRouter();
  if (!container) {
    return (
      <Grid size={{ xs: 12, md: 6, lg: 4 }}>
        <Card sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
          <CardContent sx={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
            <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1.5}>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Skeleton variant="text" width="70%" height={24} />
                <Skeleton variant="text" width="55%" height={18} />
              </Box>
              <Skeleton variant="rounded" width={72} height={24} />
            </Stack>
            <Stack spacing={0.75}>
              <Skeleton variant="text" width="80%" />
              <Skeleton variant="text" width="64%" />
              <Skeleton variant="text" width="50%" />
              <Skeleton variant="text" width="60%" />
            </Stack>
            <Divider flexItem light />
            <Stack spacing={1.25}>
              <Skeleton variant="text" width="35%" height={20} />
              <Skeleton variant="rounded" height={12} />
              <Skeleton variant="text" width="40%" height={18} />
            </Stack>
            <Box sx={{ display: "flex", gap: 1, mt: "auto" }}>
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} variant="circular" width={32} height={32} />
              ))}
            </Box>
          </CardContent>
        </Card>
      </Grid>
    );
  }

  const metadata: string[] = [];
  if (container.project) {
    metadata.push(`Project · ${container.project}`);
  }
  if (container.service) {
    metadata.push(`Service · ${container.service}`);
  }

  return (
    <Grid size={{ xs: 12, md: 6, lg: 4 }}>
      <Card sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <CardContent sx={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
          <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1.5}>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="subtitle1" noWrap>{container.name}</Typography>
              <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                {container.id}
              </Typography>
            </Box>
            <Chip
              size="small"
              label={container.state === "running" ? "Running" : "Stopped"}
              color={container.state === "running" ? "success" : "default"}
              sx={{ flexShrink: 0 }}
            />
          </Stack>
          <Stack spacing={0.75}>
            <Typography variant="body2" color="text.secondary">
              Image · {container.image}
            </Typography>
            {metadata.length > 0 && (
              <Typography variant="body2" color="text.secondary">
                {metadata.join(" · ")}
              </Typography>
            )}
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
            <UsageBar value={container.cpuUsage} />
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="caption" color="text.secondary">
                Memory
              </Typography>
              <Chip size="small" label={`${container.memoryUsage.toFixed(0)} MiB`} color="primary" variant="outlined" />
            </Stack>
          </Stack>
          <Box sx={{ display: "flex", gap: 1, mt: "auto" }}>
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
                onClick={() => router.push(`/containers/${container.id}`)}
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
    </Grid>
  );
};

export default ContainerCard;
