"use client";

import { useMemo } from "react";
import { Box, Card, CardContent, Chip, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import FolderIcon from "@mui/icons-material/Folder";
import StorageIcon from "@mui/icons-material/Storage";
import type { DockerVolume } from "@/types/docker";

interface VolumeInfoCardProps {
  volumes: DockerVolume[];
}

const formatSize = (size: string) => {
  const bytes = parseInt(size, 10);
  if (isNaN(bytes) || bytes === 0) return "Unknown";
  
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
};

const VolumeInfoCard = ({ volumes }: VolumeInfoCardProps) => {
  const stats = useMemo(() => {
    const byDriver = volumes.reduce((acc, vol) => {
      acc[vol.driver] = (acc[vol.driver] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const sortedByDate = [...volumes].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return {
      total: volumes.length,
      byDriver,
      recent: sortedByDate.slice(0, 5)
    };
  }, [volumes]);

  return (
    <Card sx={{ height: "100%" }}>
      <CardContent>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1} alignItems="center">
            <FolderIcon color="primary" />
            <Typography variant="h6">Volume Status</Typography>
          </Stack>

          <Box>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Chip
                icon={<StorageIcon />}
                label={`${stats.total} Volumes`}
                color="primary"
                variant="outlined"
                size="small"
              />
            </Stack>
          </Box>

          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Volume Drivers
            </Typography>
            <Stack spacing={0.5}>
              {Object.entries(stats.byDriver).map(([driver, count]) => (
                <Stack key={driver} direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">
                    {driver}
                  </Typography>
                  <Typography variant="body2">{count}</Typography>
                </Stack>
              ))}
            </Stack>
          </Box>

          {stats.recent.length > 0 && (
            <Box>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Recent Volumes
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell align="right">Size</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {stats.recent.map((volume) => (
                    <TableRow key={volume.name}>
                      <TableCell>
                        <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                          {volume.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {volume.driver}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="caption">{formatSize(volume.size)}</Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};

export default VolumeInfoCard;

