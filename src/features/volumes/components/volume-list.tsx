"use client";

import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import StorageIcon from "@mui/icons-material/Storage";
import { Button, Card, CardContent, CircularProgress, Divider, List, ListItem, ListItemIcon, ListItemText, Paper, Stack, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import { useVolumes } from "@/features/volumes/hooks/use-volumes";

const EmptyState = styled(Paper)(({ theme }) => ({
  textAlign: "center",
  padding: theme.spacing(6)
}));

const VolumeList = () => {
  const { data, isLoading, isError, error } = useVolumes();

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

  if (isError) {
    return (
      <Paper sx={{ p: 4 }}>
        <Typography variant="subtitle1" gutterBottom>
          Unable to load volumes
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {error instanceof Error ? error.message : "Check your Docker connection and try again."}
        </Typography>
      </Paper>
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
    <Stack spacing={2.5}>
      <Stack direction="row" justifyContent="flex-end">
        <Button startIcon={<DeleteSweepIcon />} color="warning" variant="outlined">
          Prune unused volumes
        </Button>
      </Stack>
      <Card>
        <List disablePadding>
          {data.map((volume, index) => (
            <ListItem 
              key={volume.name}
              divider={index !== data.length - 1}
              sx={{ py: 2 }}
            >
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
      </Card>
    </Stack>
  );
};

export default VolumeList;
