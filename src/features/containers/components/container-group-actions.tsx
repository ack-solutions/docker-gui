"use client";

import { Box, Chip, Stack, Tooltip, Typography } from "@mui/material";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import ArticleIcon from "@mui/icons-material/Article";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ActionIconButton from "@/components/common/action-icon-button";
import type { DockerContainer } from "@/types/docker";

interface ContainerGroupActionsProps {
  groupLabel: string;
  containerCount: number;
  containers: DockerContainer[];
  onGroupStart: (containers: DockerContainer[]) => void;
  onGroupStop: (containers: DockerContainer[]) => void;
  onGroupRestart: (containers: DockerContainer[]) => void;
  onGroupLogs: (containers: DockerContainer[]) => void;
  onGroupDelete: (containers: DockerContainer[], groupLabel: string) => void;
}

const ContainerGroupActions = ({
  groupLabel,
  containerCount,
  containers,
  onGroupStart,
  onGroupStop,
  onGroupRestart,
  onGroupLogs,
  onGroupDelete
}: ContainerGroupActionsProps) => {
  return (
    <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
      <AccountTreeIcon fontSize="small" color="primary" />
      <Typography variant="h6">{groupLabel}</Typography>
      <Chip
        size="small"
        label={`${containerCount} container${containerCount === 1 ? "" : "s"}`}
        variant="outlined"
      />
      <Box sx={{ flex: 1 }} />
      <Stack direction="row" spacing={0.5}>
        <Tooltip title="Start all stopped containers">
          <ActionIconButton 
            color="primary" 
            size="small"
            onClick={() => onGroupStart(containers)}
          >
            <PlayArrowIcon fontSize="small" />
          </ActionIconButton>
        </Tooltip>
        <Tooltip title="Stop all running containers">
          <ActionIconButton 
            color="warning" 
            size="small"
            onClick={() => onGroupStop(containers)}
          >
            <StopIcon fontSize="small" />
          </ActionIconButton>
        </Tooltip>
        <Tooltip title="Restart all running containers">
          <ActionIconButton 
            color="secondary" 
            size="small"
            onClick={() => onGroupRestart(containers)}
          >
            <RestartAltIcon fontSize="small" />
          </ActionIconButton>
        </Tooltip>
        <Tooltip title="View logs for all containers">
          <ActionIconButton 
            color="default" 
            size="small"
            onClick={() => onGroupLogs(containers)}
          >
            <ArticleIcon fontSize="small" />
          </ActionIconButton>
        </Tooltip>
        <Tooltip title="Delete all containers">
          <ActionIconButton 
            color="error" 
            size="small"
            onClick={() => onGroupDelete(containers, groupLabel)}
          >
            <DeleteOutlineIcon fontSize="small" />
          </ActionIconButton>
        </Tooltip>
      </Stack>
    </Stack>
  );
};

export default ContainerGroupActions;

