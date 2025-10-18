"use client";

import { useMemo, useState } from "react";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DownloadIcon from "@mui/icons-material/Download";
import { 
  Box, 
  Button,
  Chip,
  CircularProgress, 
  Divider,
  Paper, 
  Stack, 
  Tab, 
  Tabs, 
  Tooltip,
  Typography 
} from "@mui/material";
import ImageOverviewPanel from "@/features/docker/images/components/detail/image-overview-panel";
import ImageHistoryPanel from "@/features/docker/images/components/detail/image-history-panel";
import ImageLayersPanel from "@/features/docker/images/components/detail/image-layers-panel";
import ImageInspectViewer from "@/features/docker/images/components/detail/image-inspect-viewer";
import { useImageInspect } from "@/features/docker/images/hooks/use-image-inspect";
import CreateContainerDialog from "@/features/docker/containers/components/create-container-dialog";
import { formatBytes } from "@/lib/utils/format";

interface ImageDetailContentProps {
  imageId: string;
  showBackButton?: boolean;
}

const ImageDetailContent = ({ imageId, showBackButton = false }: ImageDetailContentProps) => {
  const inspectQuery = useImageInspect(imageId);
  const [tab, setTab] = useState("overview");
  const [isRunDialogOpen, setIsRunDialogOpen] = useState(false);
  const [copyLabel, setCopyLabel] = useState("Copy pull command");
  const [copyRunLabel, setCopyRunLabel] = useState("Copy run command");

  const initialImageTag = useMemo(() => {
    if (!inspectQuery.data) {
      return undefined;
    }
    return inspectQuery.data.repoTags[0] ?? inspectQuery.data.id;
  }, [inspectQuery.data]);

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

  if (inspectQuery.isLoading) {
    return (
      <Stack alignItems="center" justifyContent="center" py={6} spacing={2}>
        <CircularProgress />
        <Typography variant="body2" color="text.secondary">
          Loading image details...
        </Typography>
      </Stack>
    );
  }

  if (inspectQuery.isError || !inspectQuery.data) {
    return (
      <Paper sx={{ p: 4 }}>
        <Typography variant="h6" gutterBottom>
          Image details unavailable
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {inspectQuery.error instanceof Error ? inspectQuery.error.message : "Unable to inspect image. It may have been removed."}
        </Typography>
      </Paper>
    );
  }

  const inspect = inspectQuery.data;
  const primaryTag = inspect.repoTags[0] ?? inspect.id.slice(0, 12);
  const pullCommand = `docker pull ${primaryTag}`;
  const runCommand = `docker run -it ${primaryTag}`;

  return (
    <>
      <Paper sx={{ p: 3, borderRadius: 3 }}>
        <Stack spacing={3}>
          {/* Header section with image info and actions */}
          <Stack spacing={2}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ xs: "flex-start", md: "center" }}>
              <Stack spacing={1} flex={1}>
                <Typography variant="h5">
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
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Tooltip title="Run this image in a new container">
                  <Button
                    variant="contained"
                    startIcon={<PlayArrowIcon fontSize="small" />}
                    onClick={() => setIsRunDialogOpen(true)}
                  >
                    Run container
                  </Button>
                </Tooltip>
                <Tooltip title="Copy docker run command">
                  <Button
                    variant="outlined"
                    startIcon={<ContentCopyIcon fontSize="small" />}
                    onClick={() => handleCopy(runCommand, setCopyRunLabel, "Copied run")}
                  >
                    {copyRunLabel}
                  </Button>
                </Tooltip>
                <Tooltip title="Copy docker pull command">
                  <Button
                    variant="outlined"
                    startIcon={<DownloadIcon fontSize="small" />}
                    onClick={() => handleCopy(pullCommand, setCopyLabel, "Copied pull")}
                  >
                    {copyLabel}
                  </Button>
                </Tooltip>
              </Stack>
            </Stack>
          </Stack>

          <Divider />

          {/* Tabs */}
          <Box>
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
          </Box>

          {/* Tab content */}
          <Box>
            {tab === "overview" && <ImageOverviewPanel inspect={inspect} />}
            {tab === "layers" && <ImageLayersPanel inspect={inspect} />}
            {tab === "history" && <ImageHistoryPanel inspect={inspect} />}
            {tab === "inspect" && <ImageInspectViewer inspect={inspect} />}
          </Box>
        </Stack>
      </Paper>
      <CreateContainerDialog
        open={isRunDialogOpen}
        onClose={() => setIsRunDialogOpen(false)}
        initialImage={initialImageTag}
      />
    </>
  );
};

export default ImageDetailContent;

