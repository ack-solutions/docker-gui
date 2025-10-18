"use client";

import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { Chip, IconButton, Skeleton, Stack, TableCell, TableRow, Tooltip, Typography } from "@mui/material";
import moment from "moment";
import { formatBytes } from "@/lib/utils/format";
import type { DockerImage } from "@/types/docker";

interface ImageTableRowProps {
  image?: DockerImage | null;
  onDelete?: (id: string, name: string) => void;
  onView?: (id: string) => void;
  onOpenInNewTab?: (id: string) => void;
}

const ImageTableRow = ({ image, onDelete, onView, onOpenInNewTab }: ImageTableRowProps) => {
  if (!image) {
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

  const displayName = image.repoTags[0] || image.id;

  return (
    <TableRow hover sx={{ cursor: "pointer" }} onClick={() => onView?.(image.id)}>
      <TableCell>
        <Typography variant="body2" fontWeight={500}>
          {image.repoTags.join(", ") || "<none>"}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="body2" color="text.secondary" sx={{ fontFamily: "monospace", fontSize: "0.75rem" }}>
          {image.id.slice(0, 12)}
        </Typography>
      </TableCell>
      <TableCell>
        <Chip label={formatBytes(image.size)} size="small" variant="outlined" color="primary" />
      </TableCell>
      <TableCell>
        <Chip 
          label={`${image.containers} container${image.containers !== 1 ? 's' : ''}`} 
          size="small" 
          variant="outlined"
          color={image.containers > 0 ? "success" : "default"}
        />
      </TableCell>
      <TableCell>
        <Typography variant="body2" color="text.secondary">
          {moment(image.createdAt).fromNow()}
        </Typography>
      </TableCell>
      <TableCell align="right">
        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
          <Tooltip title="View details in dialog">
            <IconButton 
              size="small" 
              onClick={(e) => {
                e.stopPropagation();
                onView?.(image.id);
              }}
            >
              <InfoOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Open in new tab">
            <IconButton 
              size="small" 
              onClick={(e) => {
                e.stopPropagation();
                onOpenInNewTab?.(image.id);
              }}
            >
              <OpenInNewIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete image">
            <IconButton 
              size="small" 
              color="error" 
              onClick={(e) => {
                e.stopPropagation();
                onDelete?.(image.id, displayName);
              }}
            >
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </TableCell>
    </TableRow>
  );
};

export default ImageTableRow;

