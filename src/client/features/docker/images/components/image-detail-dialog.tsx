"use client";

import { useState } from "react";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import CloseIcon from "@mui/icons-material/Close";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DownloadIcon from "@mui/icons-material/Download";
import { 
  Dialog, 
  DialogContent, 
  IconButton, 
  Stack, 
  Tooltip,
  Chip,
  Typography,
  Tabs,
  Tab,
  Box,
  Divider,
  CircularProgress
} from "@mui/material";
import { useImageInspect } from "@/features/docker/images/hooks/use-image-inspect";
import { formatBytes } from "@/lib/utils/format";
import ImageOverviewPanel from "@/features/docker/images/components/detail/image-overview-panel";
import ImageHistoryPanel from "@/features/docker/images/components/detail/image-history-panel";
import ImageLayersPanel from "@/features/docker/images/components/detail/image-layers-panel";
import ImageInspectViewer from "@/features/docker/images/components/detail/image-inspect-viewer";
import CreateContainerDialog from "@/features/docker/containers/components/create-container-dialog";

interface ImageDetailDialogProps {
  open: boolean;
  onClose: () => void;
  imageId: string | null;
}

const ImageDetailDialog = ({ open, onClose, imageId }: ImageDetailDialogProps) => {
  const [tab, setTab] = useState("overview");
  const [isRunDialogOpen, setIsRunDialogOpen] = useState(false);
  const [copyLabel, setCopyLabel] = useState("Copy pull command");
  const [copyRunLabel, setCopyRunLabel] = useState("Copy run command");
  
  const inspectQuery = useImageInspect(imageId || "");

  const handleOpenInNewTab = () => {
    if (imageId) {
      window.open(`/docker/images/${encodeURIComponent(imageId)}`, "_blank", "noopener,noreferrer");
    }
  };

  const handleCopy = async (value: string, setter: (label: string) => void, successLabel: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setter(successLabel);
    } catch (error) {
      console.error("Failed to copy command", error);
      setter("Copy failed");
    } finally {
      setTimeout(() => setter(successLabel === "Copied pull" ? "Copy pull command" : "Copy run command"), 1500);
    }
  };

  const inspect = inspectQuery.data;
  const primaryTag = inspect ? (inspect.repoTags[0] ?? inspect.id.slice(0, 12)) : "";
  const pullCommand = `docker pull ${primaryTag}`;
  const runCommand = `docker run -it ${primaryTag}`;
  const initialImageTag = inspect ? (inspect.repoTags[0] ?? inspect.id) : undefined;

  return (
    <>
      <Dialog 
        open={open && Boolean(imageId)} 
        onClose={onClose} 
        maxWidth="lg" 
        fullWidth
        PaperProps={{
          sx: {
            height: "90vh",
            maxHeight: 900
          }
        }}
      >
        {/* Header with title and actions */}
        <Box sx={{ px: 3, pt: 2.5, pb: 0 }}>
          <Stack spacing={2}>
            {/* Title row with action buttons and close/open icons */}
            <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
              <Box flex={1}>
                {inspectQuery.isLoading ? (
                  <Typography variant="h6" color="text.secondary">
                    Loading image details...
                  </Typography>
                ) : inspectQuery.isError || !inspect ? (
                  <Typography variant="h6" color="error">
                    Image details unavailable
                  </Typography>
                ) : (
                  <Stack spacing={1}>
                    <Typography variant="h6" sx={{ wordBreak: "break-all" }}>
                      {primaryTag}
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
                      <Chip label={formatBytes(inspect.size)} size="small" color="primary" variant="outlined" />
                      {inspect.architecture && (
                        <Chip label={inspect.architecture} size="small" variant="outlined" />
                      )}
                      {inspect.os && (
                        <Chip label={inspect.os} size="small" variant="outlined" />
                      )}
                      <Typography variant="body2" color="text.secondary">
                        Created {new Date(inspect.createdAt).toLocaleString()}
                      </Typography>
                    </Stack>
                    {inspect.repoTags.length > 1 && (
                      <Stack direction="row" spacing={1} flexWrap="wrap">
                        {inspect.repoTags.slice(1).map((tag) => (
                          <Chip key={tag} label={tag} size="small" />
                        ))}
                      </Stack>
                    )}
                  </Stack>
                )}
              </Box>
              <Stack direction="row" spacing={0.5} ml={2}>
                {/* Action buttons */}
                {inspect && (
                  <>
                    <Tooltip title="Run this image in a new container">
                      <IconButton
                        color="primary"
                        size="small"
                        onClick={() => setIsRunDialogOpen(true)}
                      >
                        <PlayArrowIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={copyRunLabel}>
                      <IconButton
                        size="small"
                        onClick={() => handleCopy(runCommand, setCopyRunLabel, "Copied run")}
                      >
                        <ContentCopyIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={copyLabel}>
                      <IconButton
                        size="small"
                        onClick={() => handleCopy(pullCommand, setCopyLabel, "Copied pull")}
                      >
                        <DownloadIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </>
                )}
                <Tooltip title="Open in new tab">
                  <IconButton size="small" onClick={handleOpenInNewTab}>
                    <OpenInNewIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Close">
                  <IconButton size="small" onClick={onClose}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Stack>

            {/* Tabs */}
            {inspect && (
              <Tabs
                value={tab}
                onChange={(_event, value) => setTab(value)}
                variant="scrollable"
                scrollButtons="auto"
              >
                <Tab value="overview" label="Overview" />
                <Tab value="layers" label="Layers" />
                <Tab value="history" label="History" />
                <Tab value="inspect" label="Inspect" />
              </Tabs>
            )}
          </Stack>
        </Box>
        <Divider />

        {/* Content */}
        <DialogContent sx={{ pb: 3, pt: 3 }}>
          {inspectQuery.isLoading && (
            <Stack alignItems="center" justifyContent="center" py={6} spacing={2}>
              <CircularProgress />
              <Typography variant="body2" color="text.secondary">
                Loading image details...
              </Typography>
            </Stack>
          )}
          
          {inspectQuery.isError && (
            <Typography variant="body2" color="text.secondary">
              {inspectQuery.error instanceof Error ? inspectQuery.error.message : "Unable to inspect image. It may have been removed."}
            </Typography>
          )}

          {inspect && (
            <>
              {tab === "overview" && <ImageOverviewPanel inspect={inspect} />}
              {tab === "layers" && <ImageLayersPanel inspect={inspect} />}
              {tab === "history" && <ImageHistoryPanel inspect={inspect} />}
              {tab === "inspect" && <ImageInspectViewer inspect={inspect} />}
            </>
          )}
        </DialogContent>
      </Dialog>

      {initialImageTag && (
        <CreateContainerDialog
          open={isRunDialogOpen}
          onClose={() => setIsRunDialogOpen(false)}
          initialImage={initialImageTag}
        />
      )}
    </>
  );
};

export default ImageDetailDialog;

