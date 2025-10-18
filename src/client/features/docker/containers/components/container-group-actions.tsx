"use client";

import { CircularProgress, Stack, Tooltip } from "@mui/material";
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
  loadingAction?: 'start' | 'stop' | 'restart' | 'delete' | null;
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
  loadingAction = null,
  onGroupStart,
  onGroupStop,
  onGroupRestart,
  onGroupLogs,
  onGroupDelete
}: ContainerGroupActionsProps) => {
  const isAnyLoading = loadingAction !== null;
  
  return (
    <Stack direction="row" alignItems="center" spacing={0.5}>
        <Tooltip title="Start all stopped containers">
          <ActionIconButton 
            color="primary" 
            size="small"
            onClick={() => onGroupStart(containers)}
            disabled={isAnyLoading}
          >
            {loadingAction === 'start' ? (
              <CircularProgress size={16} color="inherit" />
            ) : (
              <PlayArrowIcon fontSize="small" />
            )}
          </ActionIconButton>
        </Tooltip>
        <Tooltip title="Stop all running containers">
          <ActionIconButton 
            color="warning" 
            size="small"
            onClick={() => onGroupStop(containers)}
            disabled={isAnyLoading}
          >
            {loadingAction === 'stop' ? (
              <CircularProgress size={16} color="inherit" />
            ) : (
              <StopIcon fontSize="small" />
            )}
          </ActionIconButton>
        </Tooltip>
        <Tooltip title="Restart all running containers">
          <ActionIconButton 
            color="secondary" 
            size="small"
            onClick={() => onGroupRestart(containers)}
            disabled={isAnyLoading}
          >
            {loadingAction === 'restart' ? (
              <CircularProgress size={16} color="inherit" />
            ) : (
              <RestartAltIcon fontSize="small" />
            )}
          </ActionIconButton>
        </Tooltip>
        <Tooltip title="View logs for all containers">
          <ActionIconButton 
            color="default" 
            size="small"
            onClick={() => onGroupLogs(containers)}
            disabled={isAnyLoading}
          >
            <ArticleIcon fontSize="small" />
          </ActionIconButton>
        </Tooltip>
        <Tooltip title="Delete all containers">
          <ActionIconButton 
            color="error" 
            size="small"
            onClick={() => onGroupDelete(containers, groupLabel)}
            disabled={isAnyLoading}
          >
            {loadingAction === 'delete' ? (
              <CircularProgress size={16} color="inherit" />
            ) : (
              <DeleteOutlineIcon fontSize="small" />
            )}
          </ActionIconButton>
        </Tooltip>
    </Stack>
  );
};

export default ContainerGroupActions;

