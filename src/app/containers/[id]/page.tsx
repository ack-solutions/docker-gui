"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Box, Button, CircularProgress, Paper, Stack, Tab, Tabs, Typography } from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import BackButton from "@/components/layout/back-button";
import ContainerDetailHeader from "@/features/docker/containers/components/detail/container-detail-header";
import ContainerOverviewPanel from "@/features/docker/containers/components/detail/container-overview-panel";
import ContainerExecPanel from "@/features/docker/containers/components/detail/container-exec-panel";
import ContainerInspectViewer from "@/features/docker/containers/components/detail/container-inspect-viewer";
import { ContainerProvider, useContainerStore } from "@/features/docker/containers/context/container-provider";
import { useContainerInspect } from "@/features/docker/containers/hooks/use-container-inspect";
import { useHeaderActions } from "@/components/layout/header-actions-context";
import LogViewer from "@/features/docker/logs/components/log-viewer";
import FileBrowser from "@/features/docker/files/components/file-browser";
import ContainerShellTerminal from "@/features/docker/containers/components/container-shell-terminal";

const TabPanel = ({ value, selected, children }: { value: string; selected: string; children: React.ReactNode }) => {
  if (value !== selected) {
    return null;
  }
  return <Box sx={{ mt: 3 }}>{children}</Box>;
};

const ContainerDetailContent = ({ containerId }: { containerId: string }) => {
  const { query, refresh } = useContainerStore();
  const containers = query.data;
  const container = useMemo(() => containers?.find((item) => item.id === containerId), [containers, containerId]);
  const inspectQuery = useContainerInspect(containerId);
  const { setActions, clearActions } = useHeaderActions();
  const [tab, setTab] = useState("overview");
  const [shellOutput, setShellOutput] = useState<string | null>(null);
  const [copyLabel, setCopyLabel] = useState("Copy last output");

  const handleRefresh = useCallback(async () => {
    await Promise.all([refresh(), inspectQuery.refetch()]);
  }, [refresh, inspectQuery]);

  useEffect(() => {
    setActions({ onRefresh: handleRefresh });
    return () => {
      clearActions();
    };
  }, [setActions, clearActions, handleRefresh]);

  useEffect(() => {
    if (copyLabel === "Copy last output") {
      return;
    }
    const timer = window.setTimeout(() => setCopyLabel("Copy last output"), 1500);
    return () => window.clearTimeout(timer);
  }, [copyLabel]);

  useEffect(() => {
    setShellOutput(null);
    setCopyLabel("Copy last output");
  }, [containerId]);

  const handleCopyShellOutput = useCallback(async () => {
    if (!shellOutput) {
      setCopyLabel("Nothing to copy");
      return;
    }
    try {
      await navigator.clipboard.writeText(shellOutput);
      setCopyLabel("Copied!");
    } catch (error) {
      console.error("Failed to copy shell output", error);
      setCopyLabel("Copy failed");
    }
  }, [shellOutput]);

  if (inspectQuery.isLoading) {
    return (
      <Stack alignItems="center" justifyContent="center" py={6} spacing={2}>
        <CircularProgress />
        <Typography variant="body2" color="text.secondary">
          Retrieving container details...
        </Typography>
      </Stack>
    );
  }

  if (inspectQuery.isError || !inspectQuery.data) {
    return (
      <Paper sx={{ p: 4 }}>
        <Typography variant="h6" gutterBottom>
          Container details unavailable
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {inspectQuery.error instanceof Error ? inspectQuery.error.message : "Unable to inspect container. It may have been removed."}
        </Typography>
      </Paper>
    );
  }

  return (
    <Stack spacing={3}>
      <BackButton label="Back to Containers" href="/containers" />
      <ContainerDetailHeader container={container} inspect={inspectQuery.data} />
      <Paper sx={{ px: 3, pt: 2, borderRadius: 3 }}>
        <Tabs
          value={tab}
          onChange={(_event, value) => setTab(value)}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab value="overview" label="Overview" />
          <Tab value="shell" label="Shell" />
          <Tab value="logs" label="Logs" />
          <Tab value="files" label="Files" />
          <Tab value="exec" label="Exec" />
          <Tab value="inspect" label="Inspect" />
        </Tabs>
        <TabPanel value="overview" selected={tab}>
          <ContainerOverviewPanel inspect={inspectQuery.data} />
        </TabPanel>
        <TabPanel value="shell" selected={tab}>
          <Stack spacing={1.5}>
            <Typography variant="body2" color="text.secondary">
              Interactive shell session for {container?.name ?? inspectQuery.data.name}.
            </Typography>
            <ContainerShellTerminal
              containerId={containerId}
              containerName={container?.name ?? inspectQuery.data.name}
              onLastOutputChange={setShellOutput}
              minHeight={320}
            />
            <Box display="flex" justifyContent="flex-end">
              <Button
                variant="outlined"
                size="small"
                startIcon={<ContentCopyIcon fontSize="small" />}
                onClick={handleCopyShellOutput}
              >
                {copyLabel}
              </Button>
            </Box>
          </Stack>
        </TabPanel>
        <TabPanel value="logs" selected={tab}>
          <LogViewer containerId={containerId} />
        </TabPanel>
        <TabPanel value="files" selected={tab}>
          <FileBrowser containerId={containerId} />
        </TabPanel>
        <TabPanel value="exec" selected={tab}>
          <ContainerExecPanel containerId={containerId} containerName={container?.name ?? inspectQuery.data.name} />
        </TabPanel>
        <TabPanel value="inspect" selected={tab}>
          <ContainerInspectViewer inspect={inspectQuery.data} />
        </TabPanel>
      </Paper>
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

  return (
    <ContainerProvider>
      <ContainerDetailContent containerId={containerId} />
    </ContainerProvider>
  );
};

export default ContainerDetailPage;
