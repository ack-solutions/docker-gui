"use client";

import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import StorageIcon from "@mui/icons-material/Storage";
import { Button, CircularProgress, List, ListItem, ListItemIcon, ListItemText, Paper, Stack, Typography } from "@mui/material";
import { useVolumes } from "@/features/volumes/hooks/useVolumes";

const VolumeList = () => {
  const { data, isLoading } = useVolumes();

  if (isLoading) {
    return (
      <Stack alignItems="center" justifyContent="center" py={6}>
        <CircularProgress />
        <Typography variant="body2" color="text.secondary" mt={2}>
          Loading volumes from Docker daemon...
        </Typography>
      </Stack>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Paper sx={{ p: 6, textAlign: "center" }}>
        <Typography variant="h6" gutterBottom>
          No volumes detected
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Volumes provide persistent storage for containers. Create one with <code>docker volume create</code>.
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 2, borderRadius: 3 }}>
      <Stack direction="row" justifyContent="flex-end" mb={1}>
        <Button startIcon={<DeleteSweepIcon />} color="warning">
          Prune unused volumes
        </Button>
      </Stack>
      <List>
        {data.map((volume) => (
          <ListItem key={volume.name} divider>
            <ListItemIcon>
              <StorageIcon color="primary" />
            </ListItemIcon>
            <ListItemText
              primary={volume.name}
              secondary={`Driver: ${volume.driver} • Size: ${volume.size} • Mount: ${volume.mountpoint}`}
            />
          </ListItem>
        ))}
      </List>
    </Paper>
  );
};

export default VolumeList;
