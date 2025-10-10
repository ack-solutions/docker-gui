"use client";

import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import { Button, Card, List, Paper, Stack, Typography } from "@mui/material";
import EmptyState from "@/components/common/empty-state";
import { useVolumes } from "@/features/docker/volumes/hooks/use-volumes";
import VolumeListItem from "@/features/docker/volumes/components/volume-list-item";
import type { DockerVolume } from "@/lib/api/docker";

const VolumeList = () => {
  const { data, isLoading, isError, error } = useVolumes();
  const volumes = data as DockerVolume[] | undefined;

  if (isError && (!volumes || volumes.length === 0)) {
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

  if (!isLoading && (!volumes || volumes.length === 0)) {
    return (
      <EmptyState
        title="No volumes detected"
        description="Volumes provide persistent storage for containers. Create one with docker volume create."
      />
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
          {isLoading && (!volumes || volumes.length === 0)
            ? Array.from({ length: 4 }).map((_, index, skeletons) => (
                <VolumeListItem
                  key={`volume-skeleton-${index}`}
                  divider={index !== skeletons.length - 1}
                />
              ))
            : volumes?.map((volume, index) => (
                <VolumeListItem
                  key={volume.name}
                  volume={volume}
                  divider={index !== (data?.length ?? 0) - 1}
                />
              ))}
        </List>
      </Card>
    </Stack>
  );
};

export default VolumeList;
