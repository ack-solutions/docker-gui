"use client";

import { useCallback, useEffect } from "react";
import { useParams } from "next/navigation";
import { Paper, Stack, Typography } from "@mui/material";
import BackButton from "@/components/layout/back-button";
import ImageDetailContent from "@/features/docker/images/components/image-detail-content";
import { useImageInspect } from "@/features/docker/images/hooks/use-image-inspect";
import { useHeaderActions } from "@/components/layout/header-actions-context";
import { useContainers } from "@/features/docker/containers/hooks/use-containers";

const ImageDetailPageContent = ({ imageId }: { imageId: string }) => {
  const inspectQuery = useImageInspect(imageId);
  const { setActions, clearActions } = useHeaderActions();
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

  return (
    <Stack spacing={3}>
      <BackButton label="Back to Images" href="/docker/images" />
      <ImageDetailContent imageId={imageId} />
    </Stack>
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

  return <ImageDetailPageContent imageId={imageId} />;
};

export default ImageDetailPage;
