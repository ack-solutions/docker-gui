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
import { getStoppedContainers, pruneStoppedContainers, type DockerContainer } from "@/lib/api/docker";
import { formatBytes } from "@/lib/utils/format";

interface ContainerPruneDialogProps {
  open: boolean;
  onClose: () => void;
  onPruned: () => void;
}

const ContainerPruneDialog = ({ open, onClose, onPruned }: ContainerPruneDialogProps) => {
  const [containers, setContainers] = useState<DockerContainer[]>([]);
  const [loading, setLoading] = useState(false);
  const [pruning, setPruning] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (open) {
      loadStoppedContainers();
    } else {
      setContainers([]);
      setSelectedIds(new Set());
      setSearchQuery("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const loadStoppedContainers = useCallback(async () => {
    setLoading(true);
    try {
      const stoppedContainers = await getStoppedContainers();
      setContainers(stoppedContainers);
      setSelectedIds(new Set(stoppedContainers.map((container) => container.id)));
    } catch (error) {
      console.error("Failed to load stopped containers:", error);
      toast.error("Failed to load stopped containers");
    } finally {
      setLoading(false);
    }
  }, []);

  const filteredContainers = useMemo(() => {
    if (!searchQuery.trim()) {
      return containers;
    }
    const query = searchQuery.toLowerCase();
    return containers.filter(
      (container) =>
        container.id.toLowerCase().includes(query) ||
        container.name.toLowerCase().includes(query) ||
        container.image.toLowerCase().includes(query)
    );
  }, [containers, searchQuery]);

  const handleToggleAll = useCallback(() => {
    if (selectedIds.size === filteredContainers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredContainers.map((container) => container.id)));
    }
  }, [filteredContainers, selectedIds.size]);

  const handleToggleContainer = useCallback((containerId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(containerId)) {
        next.delete(containerId);
      } else {
        next.add(containerId);
      }
      return next;
    });
  }, []);

  const handlePrune = useCallback(async () => {
    if (selectedIds.size === 0) {
      toast.error("Please select at least one container to prune");
      return;
    }

    setPruning(true);
    try {
      const containerIds = Array.from(selectedIds);
      const summary = await pruneStoppedContainers(containerIds);
      
      toast.success(
        `Successfully pruned ${summary.removedCount} container(s) and reclaimed ${formatBytes(summary.reclaimedSpace)}`
      );
      
      onPruned();
      onClose();
    } catch (error) {
      console.error("Failed to prune containers:", error);
      toast.error(error instanceof Error ? error.message : "Failed to prune containers");
    } finally {
      setPruning(false);
    }
  }, [selectedIds, onPruned, onClose]);
  const selectedFilteredCount = filteredContainers.filter(c => selectedIds.has(c.id)).length;
  const allSelected = filteredContainers.length > 0 && selectedFilteredCount === filteredContainers.length;
  const someSelected = selectedFilteredCount > 0 && selectedFilteredCount < filteredContainers.length;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Prune Stopped Containers</DialogTitle>
      <DialogContent>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        ) : containers.length === 0 ? (
          <Box sx={{ py: 4, textAlign: "center" }}>
            <Typography variant="body1" color="text.secondary">
              No stopped containers found. All containers are currently running.
            </Typography>
          </Box>
        ) : (
          <Stack spacing={2}>
            <TextField
              size="small"
              placeholder="Search containers..."
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
                    {selectedIds.size === 0
                      ? "Select all"
                      : `Selected ${selectedIds.size} of ${filteredContainers.length} container(s)`}
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
                    <TableCell sx={{ fontWeight: 600 }}>Image</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>State</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>ID</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredContainers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
                        <Typography variant="body2" color="text.secondary">
                          No containers match your search
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredContainers.map((container) => (
                      <TableRow key={container.id} hover>
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={selectedIds.has(container.id)}
                            onChange={() => handleToggleContainer(container.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                            {container.name}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                            {container.image}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{container.state}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" fontFamily="monospace" noWrap sx={{ maxWidth: 150 }}>
                            {container.id.substring(0, 12)}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Box>

            <Typography variant="caption" color="text.secondary">
              Selected containers will be permanently deleted. This action cannot be undone.
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
          disabled={pruning || selectedIds.size === 0 || loading}
        >
          {pruning ? "Pruning..." : `Prune ${selectedIds.size} Container(s)`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ContainerPruneDialog;

