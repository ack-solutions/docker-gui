"use client";

import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { Chip, IconButton, Skeleton, Stack, TableCell, TableRow, Tooltip, Typography } from "@mui/material";
import moment from "moment";
import type { DockerNetwork } from "@/types/docker";

interface NetworkTableRowProps {
  network?: DockerNetwork | null;
  onDelete?: (id: string, name: string) => void;
  onView?: (id: string) => void;
}

const NetworkTableRow = ({ network, onDelete, onView }: NetworkTableRowProps) => {
  if (!network) {
    return (
      <TableRow>
        <TableCell><Skeleton variant="text" width="70%" /></TableCell>
        <TableCell><Skeleton variant="text" width="50%" /></TableCell>
        <TableCell><Skeleton variant="text" width="40%" /></TableCell>
        <TableCell><Skeleton variant="text" width="30%" /></TableCell>
        <TableCell><Skeleton variant="text" width="50%" /></TableCell>
        <TableCell align="right"><Skeleton variant="circular" width={32} height={32} /></TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow hover>
      <TableCell>
        <Typography variant="body2" fontWeight={500}>
          {network.name}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="body2" color="text.secondary" sx={{ fontFamily: "monospace", fontSize: "0.75rem" }}>
          {network.id.slice(0, 12)}
        </Typography>
      </TableCell>
      <TableCell>
        <Chip label={network.driver} size="small" variant="outlined" />
      </TableCell>
      <TableCell>
        <Chip label={network.scope} size="small" variant="outlined" />
      </TableCell>
      <TableCell>
        <Typography variant="body2" color="text.secondary">
          {moment(network.createdAt).fromNow()}
        </Typography>
      </TableCell>
      <TableCell align="right">
        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
          <Tooltip title="View details">
            <IconButton size="small" onClick={() => onView?.(network.id)}>
              <InfoOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete network">
            <IconButton size="small" color="error" onClick={() => onDelete?.(network.id, network.name)}>
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </TableCell>
    </TableRow>
  );
};

export default NetworkTableRow;

