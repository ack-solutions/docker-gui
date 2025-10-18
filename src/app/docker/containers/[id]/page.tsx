"use client";

import { useCallback, useEffect } from "react";
import { useParams } from "next/navigation";
import { Paper, Stack, Typography } from "@mui/material";
import BackButton from "@/components/layout/back-button";
import ContainerDetailContent from "@/features/docker/containers/components/container-detail-content";
import { useContainers } from "@/features/docker/containers/hooks/use-containers";
import { useContainerInspect } from "@/features/docker/containers/hooks/use-container-inspect";
import { useHeaderActions } from "@/components/layout/header-actions-context";

const ContainerDetailPageContent = ({ containerId }: { containerId: string }) => {
  const { refetch: refetchContainers } = useContainers();
  const inspectQuery = useContainerInspect(containerId);
  const { setActions, clearActions } = useHeaderActions();

  const handleRefresh = useCallback(async () => {
    await Promise.all([refetchContainers(), inspectQuery.refetch()]);
  }, [refetchContainers, inspectQuery]);

  useEffect(() => {
    setActions({ onRefresh: handleRefresh });
    return () => {
      clearActions();
    };
  }, [setActions, clearActions, handleRefresh]);

  return (
    <Stack spacing={3}>
     
      <ContainerDetailContent containerId={containerId} />
    </Stack>
  );
};

const ContainerDetailPage = () => {
  const params = useParams<{ id: string }>();
  const containerId = params?.id;

  if (!containerId) {
    return (
      <Paper sx={{ p: 4 }}>
        <Typography variant="h6" gutterBottom>
          Container not specified
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Provide a container id in the URL to view details.
        </Typography>
      </Paper>
    );
  }

  return <ContainerDetailPageContent containerId={containerId} />;
};

export default ContainerDetailPage;
