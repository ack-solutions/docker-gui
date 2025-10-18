"use client";

import { useCallback, useMemo, useState } from "react";
import DownloadIcon from "@mui/icons-material/Download";
import SearchIcon from "@mui/icons-material/Search";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import { 
  Button, 
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import EmptyState from "@/components/common/empty-state";
import { useConfirmationDialog } from "@/components/common/confirmation-dialog-provider";
import ImageTableRow from "@/features/docker/images/components/image-table-row";
import ImageDetailDialog from "@/features/docker/images/components/image-detail-dialog";
import { useImages } from "@/features/docker/images/hooks/use-images";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { pullImage } from "@/lib/api/docker";
import type { DockerImage } from "@/lib/api/docker";

const ImageList = () => {
  const { data, isLoading, isError, error, isFetching, refetch } = useImages();
  const { confirm } = useConfirmationDialog();
  const router = useRouter();
  const images = data as DockerImage[] | undefined;
  const [searchQuery, setSearchQuery] = useState("");
  const [pullDialogOpen, setPullDialogOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [isPulling, setIsPulling] = useState(false);
  const [detailImageId, setDetailImageId] = useState<string | null>(null);

  // Filter images based on search query
  const filteredImages = useMemo(() => {
    if (!images || !searchQuery.trim()) {
      return images;
    }
    
    const query = searchQuery.toLowerCase().trim();
    return images.filter((image) => {
      return (
        image.id.toLowerCase().includes(query) ||
        image.repoTags.some((tag) => tag.toLowerCase().includes(query))
      );
    });
  }, [images, searchQuery]);

  const totalCount = images?.length ?? 0;
  const filteredCount = filteredImages?.length ?? 0;

  const handlePruneImages = useCallback(async () => {
    const confirmed = await confirm({
      title: "Prune unused images",
      message: "Remove all unused and dangling images? This will permanently delete images not used by any containers and free up disk space.",
      confirmLabel: "Prune",
      cancelLabel: "Cancel",
      tone: "danger"
    });

    if (!confirmed) {
      return;
    }

    toast.info("Image pruning not yet implemented");
    // TODO: Implement image prune API call
  }, [confirm]);

  const handleRemoveImage = useCallback(async (imageId: string, imageName: string) => {
    const confirmed = await confirm({
      title: "Remove image",
      message: `Remove image "${imageName}"? This will permanently delete the image and cannot be undone.`,
      confirmLabel: "Remove",
      cancelLabel: "Cancel",
      tone: "danger"
    });

    if (!confirmed) {
      return;
    }

    toast.info(`Image removal for ${imageName} not yet implemented`);
    // TODO: Implement image removal API call
  }, [confirm]);

  const handleViewImage = useCallback((imageId: string) => {
    setDetailImageId(imageId);
  }, []);

  const handleOpenInNewTab = useCallback((imageId: string) => {
    window.open(`/docker/images/${encodeURIComponent(imageId)}`, "_blank", "noopener,noreferrer");
  }, []);

  const handlePullImage = async () => {
    if (!imageUrl.trim()) {
      toast.error("Please enter an image URL");
      return;
    }

    setIsPulling(true);
    try {
      await toast.promise(
        pullImage(imageUrl.trim()),
        {
          loading: `Pulling ${imageUrl}...`,
          success: `Successfully pulled ${imageUrl}`,
          error: (err) => (err instanceof Error ? err.message : `Failed to pull ${imageUrl}`)
        }
      );
      await refetch();
      setPullDialogOpen(false);
      setImageUrl("");
    } catch (error) {
      console.error("Failed to pull image:", error);
    } finally {
      setIsPulling(false);
    }
  };

  if (isError && (!images || images.length === 0)) {
    return (
      <Paper sx={{ p: 4 }}>
        <Typography variant="subtitle1" gutterBottom>
          Unable to load images
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {error instanceof Error ? error.message : "Check your Docker connection and try again."}
        </Typography>
      </Paper>
    );
  }

  if (!isLoading && (!images || images.length === 0)) {
    return (
      <>
        <Stack
          direction={{ xs: "column", lg: "row" }}
          spacing={1.5}
          alignItems={{ xs: "stretch", lg: "center" }}
          sx={{ mb: 3 }}
        >
          <TextField
            size="small"
            placeholder="Search by ID, repository tag, or digest..."
            disabled
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              )
            }}
            sx={{ flex: 1, maxWidth: { lg: 500 } }}
          />
          
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip size="small" label="0 total" variant="outlined" />
            <Button 
              startIcon={<DownloadIcon />} 
              variant="contained"
              size="small"
              onClick={() => setPullDialogOpen(true)}
            >
              Pull
            </Button>
          </Stack>
        </Stack>
        <EmptyState
          title="No images available"
          description="Pull images from Docker Hub, GitHub Container Registry, or other registries to get started."
        />
        
        <Dialog open={pullDialogOpen} onClose={() => setPullDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Pull Docker Image</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              <TextField
                autoFocus
                label="Image URL"
                placeholder="e.g., nginx:latest, postgres:15, redis:alpine"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isPulling && imageUrl.trim()) {
                    void handlePullImage();
                  }
                }}
                fullWidth
                helperText="Format: repository:tag or registry/repository:tag"
              />
              <Typography variant="caption" color="text.secondary">
                <strong>Supported Registries:</strong><br/>
                • <strong>Docker Hub:</strong> nginx:latest, postgres:15-alpine<br/>
                • <strong>GitHub:</strong> ghcr.io/owner/repo:tag<br/>
                • <strong>Google:</strong> gcr.io/project/image:version<br/>
                • <strong>Amazon ECR:</strong> aws_account_id.dkr.ecr.region.amazonaws.com/repo:tag<br/>
                • <strong>Private:</strong> registry.example.com/repo:tag
              </Typography>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPullDialogOpen(false)} disabled={isPulling}>
              Cancel
            </Button>
            <Button onClick={handlePullImage} variant="contained" disabled={isPulling || !imageUrl.trim()}>
              {isPulling ? "Pulling..." : "Pull Image"}
            </Button>
          </DialogActions>
        </Dialog>
        
        <ImageDetailDialog
          open={Boolean(detailImageId)}
          onClose={() => setDetailImageId(null)}
          imageId={detailImageId}
        />
      </>
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
          placeholder="Search by ID, repository tag, or digest..."
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
            onClick={handlePruneImages}
          >
            Prune
          </Button>
          <Button 
            startIcon={<DownloadIcon />} 
            variant="contained"
            size="small"
            onClick={() => setPullDialogOpen(true)}
          >
            Pull
          </Button>
        </Stack>
      </Stack>

      {filteredCount === 0 && searchQuery ? (
        <EmptyState
          title="No images match your search"
          description={`No images found matching "${searchQuery}". Try a different search term.`}
        />
      ) : (
        <Paper variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Repository:Tag</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>ID</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Size</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Containers</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Created</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading && (!images || images.length === 0)
                ? Array.from({ length: 5 }).map((_, index) => (
                    <ImageTableRow key={`image-skeleton-${index}`} />
                  ))
                : filteredImages?.map((image) => (
                    <ImageTableRow
                      key={image.id}
                      image={image}
                      onDelete={handleRemoveImage}
                      onView={handleViewImage}
                      onOpenInNewTab={handleOpenInNewTab}
                    />
                  ))}
            </TableBody>
          </Table>
        </Paper>
      )}
      
      <Dialog open={pullDialogOpen} onClose={() => !isPulling && setPullDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Pull Docker Image</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              autoFocus
              label="Image URL"
              placeholder="e.g., nginx:latest, postgres:15, redis:alpine"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isPulling && imageUrl.trim()) {
                  void handlePullImage();
                }
              }}
              fullWidth
              helperText="Format: repository:tag or registry/repository:tag"
              disabled={isPulling}
            />
            <Typography variant="caption" color="text.secondary">
              <strong>Supported Registries:</strong><br/>
              • <strong>Docker Hub:</strong> nginx:latest, postgres:15-alpine<br/>
              • <strong>GitHub:</strong> ghcr.io/owner/repo:tag<br/>
              • <strong>Google:</strong> gcr.io/project/image:version<br/>
              • <strong>Amazon ECR:</strong> aws_account_id.dkr.ecr.region.amazonaws.com/repo:tag<br/>
              • <strong>Private:</strong> registry.example.com/repo:tag
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPullDialogOpen(false)} disabled={isPulling}>
            Cancel
          </Button>
          <Button onClick={handlePullImage} variant="contained" disabled={isPulling || !imageUrl.trim()}>
            {isPulling ? "Pulling..." : "Pull Image"}
          </Button>
        </DialogActions>
      </Dialog>
      
      <ImageDetailDialog
        open={Boolean(detailImageId)}
        onClose={() => setDetailImageId(null)}
        imageId={detailImageId}
      />
    </Stack>
  );
};

export default ImageList;
