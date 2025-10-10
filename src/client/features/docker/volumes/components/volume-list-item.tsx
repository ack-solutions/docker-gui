"use client";

import StorageIcon from "@mui/icons-material/Storage";
import { ListItem, ListItemIcon, ListItemText, Skeleton } from "@mui/material";
import type { DockerVolume } from "@/types/docker";

interface VolumeListItemProps {
  volume?: DockerVolume | null;
  divider?: boolean;
}

const VolumeListItem = ({ volume, divider = false }: VolumeListItemProps) => {
  if (!volume) {
    return (
      <ListItem divider={divider} sx={{ py: 2 }}>
        <ListItemIcon>
          <Skeleton variant="circular" width={32} height={32} />
        </ListItemIcon>
        <ListItemText
          primary={<Skeleton variant="text" width="60%" />}
          secondary={<Skeleton variant="text" width="45%" />}
        />
      </ListItem>
    );
  }

  return (
    <ListItem divider={divider} sx={{ py: 2 }}>
      <ListItemIcon>
        <StorageIcon color="primary" />
      </ListItemIcon>
      <ListItemText
        primary={volume.name}
        secondary={`Driver: ${volume.driver} • Size: ${volume.size} • Mount: ${volume.mountpoint}`}
      />
    </ListItem>
  );
};

export default VolumeListItem;
