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
import { getUnusedImages, pruneUnusedImages, type DockerImage } from "@/lib/api/docker";
import { formatBytes } from "@/lib/utils/format";

interface ImagePruneDialogProps {
  open: boolean;
  onClose: () => void;
  onPruned: () => void;
}

const ImagePruneDialog = ({ open, onClose, onPruned }: ImagePruneDialogProps) => {
  const [images, setImages] = useState<DockerImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [pruning, setPruning] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  const loadUnusedImages = useCallback(async () => {
    setLoading(true);
    try {
      const unusedImages = await getUnusedImages();
      setImages(unusedImages);
      // Select all by default
      setSelectedIds(new Set(unusedImages.map((img) => img.id)));
    } catch (error) {
      console.error("Failed to load unused images:", error);
      toast.error("Failed to load unused images");
    } finally {
      setLoading(false);
    }
  }, []);

  // Load unused images when dialog opens
  useEffect(() => {
    if (open) {
      void loadUnusedImages();
    } else {
      // Reset state when dialog closes
      setImages([]);
      setSelectedIds(new Set());
      setSearchQuery("");
    }
  }, [open, loadUnusedImages]);

  const filteredImages = useMemo(() => {
    if (!searchQuery.trim()) {
      return images;
    }
    const query = searchQuery.toLowerCase();
    return images.filter(
      (img) =>
        img.id.toLowerCase().includes(query) ||
        img.repoTags.some((tag) => tag.toLowerCase().includes(query))
    );
  }, [images, searchQuery]);

  const handleToggleAll = useCallback(() => {
    if (selectedIds.size === filteredImages.length) {
      // Deselect all
      setSelectedIds(new Set());
    } else {
      // Select all filtered images
      setSelectedIds(new Set(filteredImages.map((img) => img.id)));
    }
  }, [filteredImages, selectedIds.size]);

  const handleToggleImage = useCallback((imageId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(imageId)) {
        next.delete(imageId);
      } else {
        next.add(imageId);
      }
      return next;
    });
  }, []);

  const handlePrune = useCallback(async () => {
    if (selectedIds.size === 0) {
      toast.error("Please select at least one image to prune");
      return;
    }

    setPruning(true);
    try {
      const imageIds = Array.from(selectedIds);
      const summary = await pruneUnusedImages(imageIds);
      
      toast.success(
        `Successfully pruned ${summary.removedCount} image(s) and reclaimed ${formatBytes(summary.reclaimedSpace)}`
      );
      
      onPruned();
      onClose();
    } catch (error) {
      console.error("Failed to prune images:", error);
      toast.error(error instanceof Error ? error.message : "Failed to prune images");
    } finally {
      setPruning(false);
    }
  }, [selectedIds, onPruned, onClose]);

  const totalSize = useMemo(() => {
    return filteredImages
      .filter((img) => selectedIds.has(img.id))
      .reduce((sum, img) => sum + img.size, 0);
  }, [filteredImages, selectedIds]);

  const allSelected = filteredImages.length > 0 && filteredImages.every((img) => selectedIds.has(img.id));
  const someSelected = !allSelected && filteredImages.some((img) => selectedIds.has(img.id));

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Prune Unused Images</DialogTitle>
      <DialogContent>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        ) : images.length === 0 ? (
          <Box sx={{ py: 4, textAlign: "center" }}>
            <Typography variant="body1" color="text.secondary">
              No unused images found. All images are currently in use by containers.
            </Typography>
          </Box>
        ) : (
          <Stack spacing={2}>
            <TextField
              size="small"
              placeholder="Search images..."
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
                      : `Selected ${selectedIds.size} of ${filteredImages.length} image(s)`}
                  </Typography>
                }
              />
              {selectedIds.size > 0 && (
                <Typography variant="body2" color="text.secondary">
                  Total size: {formatBytes(totalSize)}
                </Typography>
              )}
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
                    <TableCell sx={{ fontWeight: 600 }}>Repository:Tag</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>ID</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>Size</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredImages.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ py: 3 }}>
                        <Typography variant="body2" color="text.secondary">
                          No images match your search
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredImages.map((image) => (
                      <TableRow key={image.id} hover>
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={selectedIds.has(image.id)}
                            onChange={() => handleToggleImage(image.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" noWrap sx={{ maxWidth: 300 }}>
                            {image.repoTags[0] || "<none>:<none>"}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" fontFamily="monospace" noWrap sx={{ maxWidth: 200 }}>
                            {image.id.substring(0, 12)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2">{formatBytes(image.size)}</Typography>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Box>

            <Typography variant="caption" color="text.secondary">
              Selected images will be permanently deleted. This action cannot be undone.
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
          {pruning ? "Pruning..." : `Prune ${selectedIds.size} Image(s)`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ImagePruneDialog;

