"use client";

import { Box, Chip, CircularProgress, TableCell, TableRow, Tooltip, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import TerminalIcon from "@mui/icons-material/Terminal";
import ArticleIcon from "@mui/icons-material/Article";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import ActionIconButton from "@/components/common/action-icon-button";
import type { DockerContainer } from "@/types/docker";

const UsageBar = styled("div")(({ theme }) => ({
  height: 8,
  borderRadius: 4,
  backgroundColor: theme.palette.mode === "dark" ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
  position: "relative",
  overflow: "hidden"
}));

const UsageBarFill = styled("div")<{ value: number }>(({ theme, value }) => ({
  height: "100%",
  width: `${Math.min(value, 100)}%`,
  backgroundColor: theme.palette.primary.main,
  transition: "width 0.3s ease"
}));

interface ContainerTableRowProps {
  container: DockerContainer;
  isLoading?: boolean;
  onStart: (id: string, name: string) => void;
  onStop: (id: string, name: string) => void;
  onRestart: (id: string, name: string) => void;
  onOpenTerminal: (id: string, name: string) => void;
  onOpenLogs: (id: string, name: string) => void;
  onMenuOpen: (id: string, anchor: HTMLElement) => void;
}

const ContainerTableRow = ({
  container,
  isLoading = false,
  onStart,
  onStop,
  onRestart,
  onOpenTerminal,
  onOpenLogs,
  onMenuOpen
}: ContainerTableRowProps) => {
  return (
    <TableRow hover>
      <TableCell>
        <Box>
          <Typography variant="body2">{container.name}</Typography>
          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block", maxWidth: 200 }}>
            {container.id}
          </Typography>
        </Box>
      </TableCell>
      <TableCell>
        <Chip
          size="small"
          label={container.state === "running" ? "Running" : "Stopped"}
          color={container.state === "running" ? "success" : "default"}
        />
      </TableCell>
      <TableCell>
        <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
          {container.image}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="body2" noWrap sx={{ maxWidth: 150 }}>
          {container.ports.length > 0 ? container.ports.join(", ") : "None"}
        </Typography>
      </TableCell>
      <TableCell>
        <Box sx={{ minWidth: 80 }}>
          <UsageBar>
            <UsageBarFill value={Math.min(container.cpuUsage, 100)} />
          </UsageBar>
          <Typography variant="caption" color="text.secondary">
            {container.cpuUsage.toFixed(1)}%
          </Typography>
        </Box>
      </TableCell>
      <TableCell>
        <Typography variant="body2">{container.memoryUsage.toFixed(0)} MiB</Typography>
      </TableCell>
      <TableCell align="right">
        <Box sx={{ display: "flex", gap: 0.5, justifyContent: "flex-end" }}>
          {container.state !== "running" && (
            <Tooltip title="Start container">
              <ActionIconButton 
                color="primary" 
                size="small"
                onClick={() => onStart(container.id, container.name)}
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
                  onClick={() => onStop(container.id, container.name)}
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
                  onClick={() => onRestart(container.id, container.name)}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <CircularProgress size={16} color="inherit" />
                  ) : (
                    <RestartAltIcon fontSize="small" />
                  )}
                </ActionIconButton>
              </Tooltip>
              <Tooltip title="Open terminal">
                <ActionIconButton
                  color="default"
                  size="small"
                  onClick={() => onOpenTerminal(container.id, container.name)}
                >
                  <TerminalIcon fontSize="small" />
                </ActionIconButton>
              </Tooltip>
              <Tooltip title="View logs">
                <ActionIconButton
                  color="default"
                  size="small"
                  onClick={() => onOpenLogs(container.id, container.name)}
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
              onClick={(event) => onMenuOpen(container.id, event.currentTarget)}
            >
              <MoreHorizIcon fontSize="small" />
            </ActionIconButton>
          </Tooltip>
        </Box>
      </TableCell>
    </TableRow>
  );
};

export default ContainerTableRow;

