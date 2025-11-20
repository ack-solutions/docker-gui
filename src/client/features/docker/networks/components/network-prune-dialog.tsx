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
import { getUnusedNetworks, pruneNetworks, type DockerNetwork } from "@/lib/api/docker";

interface NetworkPruneDialogProps {
  open: boolean;
  onClose: () => void;
  onPruned: () => void;
}

const NetworkPruneDialog = ({ open, onClose, onPruned }: NetworkPruneDialogProps) => {
  const [networks, setNetworks] = useState<DockerNetwork[]>([]);
  const [loading, setLoading] = useState(false);
  const [pruning, setPruning] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  const loadUnusedNetworks = useCallback(async () => {
    setLoading(true);
    try {
      const unusedNetworks = await getUnusedNetworks();
      setNetworks(unusedNetworks);
      setSelectedIds(new Set(unusedNetworks.map((net) => net.id)));
    } catch (error) {
      console.error("Failed to load unused networks:", error);
      toast.error("Failed to load unused networks");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      void loadUnusedNetworks();
    } else {
      setNetworks([]);
      setSelectedIds(new Set());
      setSearchQuery("");
    }
  }, [open, loadUnusedNetworks]);

  const filteredNetworks = useMemo(() => {
    if (!searchQuery.trim()) {
      return networks;
    }
    const query = searchQuery.toLowerCase();
    return networks.filter(
      (net) =>
        net.id.toLowerCase().includes(query) ||
        net.name.toLowerCase().includes(query) ||
        (net.driver && net.driver.toLowerCase().includes(query))
    );
  }, [networks, searchQuery]);

  const handleToggleAll = useCallback(() => {
    if (selectedIds.size === filteredNetworks.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredNetworks.map((net) => net.id)));
    }
  }, [filteredNetworks, selectedIds.size]);

  const handleToggleNetwork = useCallback((networkId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(networkId)) {
        next.delete(networkId);
      } else {
        next.add(networkId);
      }
      return next;
    });
  }, []);

  const handlePrune = useCallback(async () => {
    if (selectedIds.size === 0) {
      toast.error("Please select at least one network to prune");
      return;
    }

    setPruning(true);
    try {
      const networkIds = Array.from(selectedIds);
      const summary = await pruneNetworks(networkIds);
      
      toast.success(`Successfully pruned ${summary.removedCount} network(s)`);
      
      onPruned();
      onClose();
    } catch (error) {
      console.error("Failed to prune networks:", error);
      toast.error(error instanceof Error ? error.message : "Failed to prune networks");
    } finally {
      setPruning(false);
    }
  }, [selectedIds, onPruned, onClose]);

  const allSelected = filteredNetworks.length > 0 && selectedIds.size === filteredNetworks.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < filteredNetworks.length;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Prune Unused Networks</DialogTitle>
      <DialogContent>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        ) : networks.length === 0 ? (
          <Box sx={{ py: 4, textAlign: "center" }}>
            <Typography variant="body1" color="text.secondary">
              No unused networks found. All networks are currently in use or are default networks.
            </Typography>
          </Box>
        ) : (
          <Stack spacing={2}>
            <TextField
              size="small"
              placeholder="Search networks..."
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
                      : `Selected ${selectedIds.size} of ${filteredNetworks.length} network(s)`}
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
                    <TableCell sx={{ fontWeight: 600 }}>Scope</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>ID</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredNetworks.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
                        <Typography variant="body2" color="text.secondary">
                          No networks match your search
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredNetworks.map((network) => (
                      <TableRow key={network.id} hover>
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={selectedIds.has(network.id)}
                            onChange={() => handleToggleNetwork(network.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                            {network.name}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{network.driver}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{network.scope}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" fontFamily="monospace" noWrap sx={{ maxWidth: 150 }}>
                            {network.id.substring(0, 12)}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Box>

            <Typography variant="caption" color="text.secondary">
              Selected networks will be permanently deleted. Ensure no containers are using them.
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
          {pruning ? "Pruning..." : `Prune ${selectedIds.size} Network(s)`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default NetworkPruneDialog;

