"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
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
import { getUnusedVolumes, pruneVolumes, type DockerVolume } from "@/lib/api/docker";

interface VolumePruneDialogProps {
  open: boolean;
  onClose: () => void;
  onPruned: () => void;
}

const VolumePruneDialog = ({ open, onClose, onPruned }: VolumePruneDialogProps) => {
  const [volumes, setVolumes] = useState<DockerVolume[]>([]);
  const [loading, setLoading] = useState(false);
  const [pruning, setPruning] = useState(false);
  const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  const loadUnusedVolumes = useCallback(async () => {
    setLoading(true);
    try {
      const unusedVolumes = await getUnusedVolumes();
      setVolumes(unusedVolumes);
      setSelectedNames(new Set(unusedVolumes.map((vol) => vol.name)));
    } catch (error) {
      console.error("Failed to load unused volumes:", error);
      toast.error("Failed to load unused volumes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      void loadUnusedVolumes();
    } else {
      setVolumes([]);
      setSelectedNames(new Set());
      setSearchQuery("");
    }
  }, [open, loadUnusedVolumes]);

  const filteredVolumes = useMemo(() => {
    if (!searchQuery.trim()) {
      return volumes;
    }
    const query = searchQuery.toLowerCase();
    return volumes.filter(
      (vol) =>
        vol.name.toLowerCase().includes(query) ||
        (vol.driver && vol.driver.toLowerCase().includes(query)) ||
        (vol.mountpoint && vol.mountpoint.toLowerCase().includes(query))
    );
  }, [volumes, searchQuery]);

  const handleToggleAll = useCallback(() => {
    if (selectedNames.size === filteredVolumes.length) {
      setSelectedNames(new Set());
    } else {
      setSelectedNames(new Set(filteredVolumes.map((vol) => vol.name)));
    }
  }, [filteredVolumes, selectedNames.size]);

  const handleToggleVolume = useCallback((volumeName: string) => {
    setSelectedNames((prev) => {
      const next = new Set(prev);
      if (next.has(volumeName)) {
        next.delete(volumeName);
      } else {
        next.add(volumeName);
      }
      return next;
    });
  }, []);

  const handlePrune = useCallback(async () => {
    if (selectedNames.size === 0) {
      toast.error("Please select at least one volume to prune");
      return;
    }

    setPruning(true);
    try {
      const volumeNames = Array.from(selectedNames);
      const summary = await pruneVolumes(volumeNames);
      
      toast.success(`Successfully pruned ${summary.removedCount} volume(s)`);
      
      onPruned();
      onClose();
    } catch (error) {
      console.error("Failed to prune volumes:", error);
      toast.error(error instanceof Error ? error.message : "Failed to prune volumes");
    } finally {
      setPruning(false);
    }
  }, [selectedNames, onPruned, onClose]);

  const allSelected = filteredVolumes.length > 0 && selectedNames.size === filteredVolumes.length;
  const someSelected = selectedNames.size > 0 && selectedNames.size < filteredVolumes.length;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Prune Unused Volumes</DialogTitle>
      <DialogContent>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        ) : volumes.length === 0 ? (
          <Box sx={{ py: 4, textAlign: "center" }}>
            <Typography variant="body1" color="text.secondary">
              No unused volumes found.
            </Typography>
          </Box>
        ) : (
          <Stack spacing={2}>
            <TextField
              size="small"
              placeholder="Search volumes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              fullWidth
            />

            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={allSelected}
                    indeterminate={someSelected}
                    onChange={handleToggleAll}
                  />
                }
                label={
                  <Typography variant="body2">
                    {selectedNames.size === 0
                      ? "Select all"
                      : `Selected ${selectedNames.size} of ${filteredVolumes.length} volume(s)`}
                  </Typography>
                }
              />
            </Box>

            <Box sx={{ maxHeight: 400, overflow: "auto", border: 1, borderColor: "divider", borderRadius: 1 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox" sx={{ width: 50 }}>
                      <Checkbox
                        checked={allSelected}
                        indeterminate={someSelected}
                        onChange={handleToggleAll}
                      />
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Driver</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Mount Point</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredVolumes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ py: 3 }}>
                        <Typography variant="body2" color="text.secondary">
                          No volumes match your search
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredVolumes.map((volume) => (
                      <TableRow key={volume.name} hover>
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={selectedNames.has(volume.name)}
                            onChange={() => handleToggleVolume(volume.name)}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" noWrap sx={{ maxWidth: 250 }}>
                            {volume.name}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{volume.driver}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" noWrap sx={{ maxWidth: 200 }}>
                            {volume.mountpoint}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Box>

            <Typography variant="caption" color="text.secondary">
              Selected volumes will be permanently deleted. This action cannot be undone and may result in data loss.
            </Typography>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={pruning}>
          Cancel
        </Button>
        <Button
          onClick={handlePrune}
          variant="contained"
          color="warning"
          disabled={pruning || selectedNames.size === 0 || loading}
        >
          {pruning ? "Pruning..." : `Prune ${selectedNames.size} Volume(s)`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default VolumePruneDialog;

