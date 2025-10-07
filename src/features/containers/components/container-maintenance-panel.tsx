"use client";

import { Button, CircularProgress, Paper, Stack, Typography } from "@mui/material";
import CleaningServicesIcon from "@mui/icons-material/CleaningServices";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";

interface ContainerMaintenancePanelProps {
  onPruneContainers: () => void;
  onPruneImages: () => void;
  isPruningContainers?: boolean;
  isPruningImages?: boolean;
}

const ContainerMaintenancePanel = ({
  onPruneContainers,
  onPruneImages,
  isPruningContainers = false,
  isPruningImages = false
}: ContainerMaintenancePanelProps) => {
  return (
    <Paper sx={{ p: 3, borderRadius: 3 }}>
      <Stack spacing={1.5}>
        <Typography variant="subtitle1">Container & image maintenance</Typography>
        <Typography variant="body2" color="text.secondary">
          Clean up stopped workloads and dangling artifacts to keep your Docker host healthy.
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Button
            variant="outlined"
            color="error"
            startIcon={isPruningContainers ? <CircularProgress size={20} /> : <DeleteSweepIcon />}
            onClick={onPruneContainers}
            disabled={isPruningContainers}
          >
            {isPruningContainers ? "Removing..." : "Remove stopped containers"}
          </Button>
          <Button
            variant="outlined"
            color="primary"
            startIcon={isPruningImages ? <CircularProgress size={20} /> : <CleaningServicesIcon />}
            onClick={onPruneImages}
            disabled={isPruningImages}
          >
            {isPruningImages ? "Removing..." : "Remove unused images"}
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
};

export default ContainerMaintenancePanel;

