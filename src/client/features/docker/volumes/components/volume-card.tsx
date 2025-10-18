"use client";

import StorageIcon from "@mui/icons-material/Storage";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import FolderIcon from "@mui/icons-material/Folder";
import { Box, Card, CardContent, Chip, Skeleton, Stack, Typography } from "@mui/material";
import moment from "moment";
import type { DockerVolume } from "@/types/docker";

interface VolumeCardProps {
  volume?: DockerVolume | null;
}

const VolumeCard = ({ volume }: VolumeCardProps) => {
  if (!volume) {
    return (
      <Card sx={{ height: "100%" }}>
        <CardContent sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Skeleton variant="circular" width={32} height={32} />
            <Skeleton variant="text" width="60%" />
          </Stack>
          <Skeleton variant="text" width="40%" />
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
            {Array.from({ length: 2 }).map((_, index) => (
              <Skeleton key={index} variant="rounded" width={80} height={24} />
            ))}
          </Box>
          <Skeleton variant="text" width="70%" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card sx={{ height: "100%" }}>
      <CardContent sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <StorageIcon color="primary" sx={{ fontSize: 32 }} />
          <Typography variant="subtitle1" fontWeight={600} noWrap sx={{ flex: 1 }}>
            {volume.name}
          </Typography>
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace", wordBreak: "break-all" }}>
          {volume.mountpoint}
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
          <Chip 
            icon={<FolderIcon fontSize="small" />}
            label={volume.driver} 
            size="small" 
            variant="outlined" 
          />
          <Chip 
            label={volume.size} 
            size="small" 
            variant="outlined"
            color="primary"
          />
        </Box>
        <Stack direction="row" alignItems="center" spacing={1}>
          <AccessTimeIcon fontSize="small" color="action" />
          <Typography variant="body2" color="text.secondary">
            Created {moment(volume.createdAt).fromNow()}
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
};

export default VolumeCard;

