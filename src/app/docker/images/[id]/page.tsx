"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Box, CircularProgress, Paper, Stack, Tab, Tabs, Typography } from "@mui/material";
import BackButton from "@/components/layout/back-button";
import ImageDetailHeader from "@/features/docker/images/components/detail/image-detail-header";
import ImageOverviewPanel from "@/features/docker/images/components/detail/image-overview-panel";
import ImageHistoryPanel from "@/features/docker/images/components/detail/image-history-panel";
import ImageLayersPanel from "@/features/docker/images/components/detail/image-layers-panel";
import ImageInspectViewer from "@/features/docker/images/components/detail/image-inspect-viewer";
import { useImageInspect } from "@/features/docker/images/hooks/use-image-inspect";
import { useHeaderActions } from "@/components/layout/header-actions-context";
import { useContainers } from "@/features/docker/containers/hooks/use-containers";
import CreateContainerDialog from "@/features/docker/containers/components/create-container-dialog";

const TabPanel = ({ value, selected, children }: { value: string; selected: string; children: React.ReactNode }) => {
  if (value !== selected) {
    return null;
  }
  return <Box sx={{ mt: 3 }}>{children}</Box>;
};

const ImageDetailContent = ({ imageId }: { imageId: string }) => {
  const inspectQuery = useImageInspect(imageId);
  const { setActions, clearActions } = useHeaderActions();
  const [tab, setTab] = useState("overview");
  const [isRunDialogOpen, setIsRunDialogOpen] = useState(false);
  const { refetch: refetchContainers } = useContainers();

  const handleRefresh = useCallback(async () => {
    await inspectQuery.refetch();
    await refetchContainers();
  }, [inspectQuery, refetchContainers]);

  useEffect(() => {
    setActions({ onRefresh: handleRefresh });
    return () => {
      clearActions();
    };
  }, [setActions, clearActions, handleRefresh]);

  const initialImageTag = useMemo(() => {
    if (!inspectQuery.data) {
      return undefined;
    }
    return inspectQuery.data.repoTags[0] ?? inspectQuery.data.id;
  }, [inspectQuery.data]);

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

  return (
    <>
      <Stack spacing={3}>
        <BackButton label="Back to Images" href="/docker/images" />
        <ImageDetailHeader
          inspect={inspectQuery.data}
          onRunContainer={() => setIsRunDialogOpen(true)}
        />
        <Paper sx={{ px: 3, pt: 2, borderRadius: 3 }}>
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
          <TabPanel value="overview" selected={tab}>
            <ImageOverviewPanel inspect={inspectQuery.data} />
          </TabPanel>
          <TabPanel value="layers" selected={tab}>
            <ImageLayersPanel inspect={inspectQuery.data} />
          </TabPanel>
          <TabPanel value="history" selected={tab}>
            <ImageHistoryPanel inspect={inspectQuery.data} />
          </TabPanel>
          <TabPanel value="inspect" selected={tab}>
            <ImageInspectViewer inspect={inspectQuery.data} />
          </TabPanel>
        </Paper>
      </Stack>
      <CreateContainerDialog
        open={isRunDialogOpen}
        onClose={() => setIsRunDialogOpen(false)}
        initialImage={initialImageTag}
      />
    </>
  );
};

const ImageDetailPage = () => {
  const params = useParams<{ id: string }>();
  const imageId = params?.id;

  if (!imageId) {
    return (
      <Paper sx={{ p: 4 }}>
        <Typography variant="h6" gutterBottom>
          Image not specified
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Provide an image id or digest in the URL to view details.
        </Typography>
      </Paper>
    );
  }

  return <ImageDetailContent imageId={imageId} />;
};

export default ImageDetailPage;
