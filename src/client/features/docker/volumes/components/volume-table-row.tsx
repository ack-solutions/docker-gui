"use client";

import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { Chip, IconButton, Skeleton, Stack, TableCell, TableRow, Tooltip, Typography } from "@mui/material";
import moment from "moment";
import type { DockerVolume } from "@/types/docker";

interface VolumeTableRowProps {
  volume?: DockerVolume | null;
  onDelete?: (name: string, volumeName: string) => void;
  onView?: (name: string) => void;
}

const VolumeTableRow = ({ volume, onDelete, onView }: VolumeTableRowProps) => {
  if (!volume) {
    return (
      <TableRow>
        <TableCell><Skeleton variant="text" width="80%" /></TableCell>
        <TableCell><Skeleton variant="text" width="60%" /></TableCell>
        <TableCell><Skeleton variant="text" width="70%" /></TableCell>
        <TableCell><Skeleton variant="text" width="50%" /></TableCell>
        <TableCell align="right"><Skeleton variant="circular" width={32} height={32} /></TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow hover>
      <TableCell>
        <Typography variant="body2" fontWeight={500}>
          {volume.name}
        </Typography>
      </TableCell>
      <TableCell>
        <Chip label={volume.driver} size="small" variant="outlined" />
      </TableCell>
      <TableCell>
        <Typography variant="body2" color="text.secondary" sx={{ fontFamily: "monospace", fontSize: "0.75rem" }}>
          {volume.mountpoint}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="body2" color="text.secondary">
          {moment(volume.createdAt).fromNow()}
        </Typography>
      </TableCell>
      <TableCell align="right">
        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
          <Tooltip title="View details">
            <IconButton size="small" onClick={() => onView?.(volume.name)}>
              <InfoOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete volume">
            <IconButton size="small" color="error" onClick={() => onDelete?.(volume.name, volume.name)}>
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </TableCell>
    </TableRow>
  );
};

export default VolumeTableRow;

