"use client";

import { useCallback, useMemo, useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import SearchIcon from "@mui/icons-material/Search";
import { 
  Button, 
  Chip,
  CircularProgress,
  InputAdornment,
  Paper, 
  Stack, 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography 
} from "@mui/material";
import { toast } from "sonner";
import EmptyState from "@/components/common/empty-state";
import { useConfirmationDialog } from "@/components/common/confirmation-dialog-provider";
import { useVolumes } from "@/features/docker/volumes/hooks/use-volumes";
import VolumeTableRow from "@/features/docker/volumes/components/volume-table-row";
import type { DockerVolume } from "@/lib/api/docker";

const VolumeList = () => {
  const { data, isLoading, isError, error, isFetching } = useVolumes();
  const { confirm } = useConfirmationDialog();
  const volumes = data as DockerVolume[] | undefined;
  const [searchQuery, setSearchQuery] = useState("");

  // Filter volumes based on search query
  const filteredVolumes = useMemo(() => {
    if (!volumes || !searchQuery.trim()) {
      return volumes;
    }
    
    const query = searchQuery.toLowerCase().trim();
    return volumes.filter((volume) => {
      return (
        volume.name.toLowerCase().includes(query) ||
        (volume.driver && volume.driver.toLowerCase().includes(query)) ||
        (volume.mountpoint && volume.mountpoint.toLowerCase().includes(query))
      );
    });
  }, [volumes, searchQuery]);

  const totalCount = volumes?.length ?? 0;
  const filteredCount = filteredVolumes?.length ?? 0;

  const handlePruneVolumes = useCallback(async () => {
    const confirmed = await confirm({
      title: "Prune unused volumes",
      message: "Remove all volumes not currently in use by containers? This action cannot be undone and may result in data loss.",
      confirmLabel: "Prune",
      cancelLabel: "Cancel",
      tone: "danger"
    });

    if (!confirmed) {
      return;
    }

    toast.info("Volume pruning not yet implemented");
    // TODO: Implement volume prune API call
  }, [confirm]);

  const handleDeleteVolume = useCallback(async (name: string, volumeName: string) => {
    const confirmed = await confirm({
      title: "Delete volume",
      message: `Delete volume "${volumeName}"? This will permanently remove the volume and all its data. This cannot be undone.`,
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      tone: "danger"
    });

    if (!confirmed) {
      return;
    }

    toast.info(`Volume deletion for ${volumeName} not yet implemented`);
    // TODO: Implement volume delete API call
  }, [confirm]);

  const handleViewVolume = useCallback((name: string) => {
    toast.info(`Volume details for ${name} not yet implemented`);
    // TODO: Implement volume details view
  }, []);

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
      <Stack
        direction={{ xs: "column", lg: "row" }}
        spacing={1.5}
        alignItems={{ xs: "stretch", lg: "center" }}
      >
        <TextField
          size="small"
          placeholder="Search by name, driver, or mount point..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            )
          }}
          sx={{ flex: 1, maxWidth: { lg: 500 } }}
        />
        
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <Chip
            size="small"
            label={searchQuery ? `${filteredCount} of ${totalCount}` : `${totalCount} total`}
            variant="outlined"
            color={searchQuery ? "primary" : "default"}
          />
          {isFetching && <CircularProgress size={16} />}
          <Button 
            startIcon={<DeleteSweepIcon />} 
            color="warning" 
            variant="outlined"
            size="small"
            onClick={handlePruneVolumes}
          >
            Prune
          </Button>
          <Button 
            startIcon={<AddIcon />} 
            variant="contained"
            size="small"
          >
            Create
          </Button>
        </Stack>
      </Stack>

      {filteredCount === 0 && searchQuery ? (
        <EmptyState
          title="No volumes match your search"
          description={`No volumes found matching "${searchQuery}". Try a different search term.`}
        />
      ) : (
        <Paper variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Driver</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Mount Point</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Created</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading && (!volumes || volumes.length === 0)
                ? Array.from({ length: 5 }).map((_, index) => (
                    <VolumeTableRow key={`volume-skeleton-${index}`} />
                  ))
                : filteredVolumes?.map((volume) => (
                    <VolumeTableRow
                      key={volume.name}
                      volume={volume}
                      onDelete={handleDeleteVolume}
                      onView={handleViewVolume}
                    />
                  ))}
            </TableBody>
          </Table>
        </Paper>
      )}
    </Stack>
  );
};

export default VolumeList;
