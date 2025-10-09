"use client";

import { Divider, ListItemIcon, ListItemText, Menu, MenuItem } from "@mui/material";
import TerminalIcon from "@mui/icons-material/Terminal";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import ArticleIcon from "@mui/icons-material/Article";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import type { DockerContainer } from "@/types/docker";

interface ContainerContextMenuProps {
  anchorEl: HTMLElement | null;
  container: DockerContainer | undefined;
  onClose: () => void;
  onOpenTerminalDrawer: (id: string, name: string) => void;
  onOpenTerminalTab: (id: string) => void;
  onOpenLogsDrawer: (id: string, name: string) => void;
  onOpenLogsTab: (id: string) => void;
  onRemove: (id: string, name: string) => void;
  onViewDetails?: (id: string) => void;
}

const ContainerContextMenu = ({
  anchorEl,
  container,
  onClose,
  onOpenTerminalDrawer,
  onOpenTerminalTab,
  onOpenLogsDrawer,
  onOpenLogsTab,
  onRemove,
  onViewDetails
}: ContainerContextMenuProps) => {
  if (!container) {
    return null;
  }

  return (
    <Menu
      anchorEl={anchorEl}
      open={Boolean(anchorEl)}
      onClose={onClose}
      anchorOrigin={{ vertical: "top", horizontal: "right" }}
      transformOrigin={{ vertical: "top", horizontal: "right" }}
      keepMounted
    >
      <MenuItem
        onClick={() => {
          if (onViewDetails) {
            onViewDetails(container.id);
          } else {
            window.open(`/containers/${container.id}`, "_blank", "noopener,noreferrer");
          }
          onClose();
        }}
      >
        <ListItemIcon>
          <InfoOutlinedIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText primary="View details" />
      </MenuItem>
      <MenuItem
        onClick={() => {
          onOpenTerminalDrawer(container.id, container.name);
          onClose();
        }}
        disabled={container.state !== "running"}
      >
        <ListItemIcon>
          <TerminalIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText primary="Open terminal in drawer" />
      </MenuItem>
      <MenuItem
        onClick={() => {
          onOpenTerminalTab(container.id);
          onClose();
        }}
        disabled={container.state !== "running"}
      >
        <ListItemIcon>
          <OpenInNewIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText primary="Open terminal in new tab" />
      </MenuItem>
      <MenuItem onClick={() => {
        onOpenLogsDrawer(container.id, container.name);
        onClose();
      }}>
        <ListItemIcon>
          <ArticleIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText primary="View logs in drawer" />
      </MenuItem>
      <MenuItem onClick={() => {
        onOpenLogsTab(container.id);
        onClose();
      }}>
        <ListItemIcon>
          <OpenInNewIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText primary="View logs in new tab" />
      </MenuItem>
      <Divider sx={{ my: 0.5 }} />
      <MenuItem onClick={() => {
        onRemove(container.id, container.name);
        onClose();
      }}>
        <ListItemIcon>
          <DeleteOutlineIcon fontSize="small" color="error" />
        </ListItemIcon>
        <ListItemText primary="Remove container" />
      </MenuItem>
    </Menu>
  );
};

export default ContainerContextMenu;
