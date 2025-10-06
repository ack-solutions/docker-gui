"use client";

import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import StorageIcon from "@mui/icons-material/Storage";
import { Button, CircularProgress, List, ListItem, ListItemIcon, ListItemText, Paper, Stack, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import { useVolumes } from "@/features/volumes/hooks/useVolumes";

const VolumePanel = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3)
}));

const EmptyState = styled(Paper)(({ theme }) => ({
  textAlign: "center",
  padding: theme.spacing(6)
}));

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
      <EmptyState>
        <Typography variant="h6" gutterBottom>
          No volumes detected
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Volumes provide persistent storage for containers. Create one with <code>docker volume create</code>.
        </Typography>
      </EmptyState>
    );
  }

  return (
    <VolumePanel>
      <Stack spacing={2}>
        <Stack direction="row" justifyContent="flex-end">
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
      </Stack>
    </VolumePanel>
  );
};

export default VolumeList;
