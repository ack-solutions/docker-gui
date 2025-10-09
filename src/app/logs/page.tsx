"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import TerminalIcon from "@mui/icons-material/Terminal";
import { CircularProgress, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import LogViewer from "@/features/docker/logs/components/log-viewer";
import { useContainers } from "@/features/docker/containers/hooks/use-containers";
import { useRouter, useSearchParams } from "next/navigation";

const LogsPageContent = () => {
  const { data: containers } = useContainers();
  const router = useRouter();
  const searchParams = useSearchParams();

  const containerFromQuery = searchParams.get("containerId");
  const defaultContainerId = useMemo(
    () => containerFromQuery ?? containers?.[0]?.id ?? "1a2b3c",
    [containerFromQuery, containers]
  );
  const [selectedContainer, setSelectedContainer] = useState(defaultContainerId);

  useEffect(() => {
    setSelectedContainer(defaultContainerId);
  }, [defaultContainerId]);

  const handleChange = (value: string) => {
    setSelectedContainer(value);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("containerId", value);
    const query = nextParams.toString();
    router.replace(query ? `/logs?${query}` : "/logs", { scroll: false });
  };

  return (
    <Stack spacing={3}>
      <Stack direction="row" spacing={1.5} alignItems="center">
        <TerminalIcon color="primary" />
        <Typography variant="h5">
          Container Logs & Debugging
        </Typography>
      </Stack>
      <Typography variant="body1" color="text.secondary">
        Follow live logs, filter entries, and troubleshoot containerized workloads in real-time.
      </Typography>
      <Paper sx={{ p: 3, borderRadius: 3 }}>
        <Typography variant="subtitle2" gutterBottom>
          Select container
        </Typography>
        <TextField
          select
          value={selectedContainer}
          onChange={(event) => handleChange(event.target.value)}
          size="small"
          fullWidth
        >
          {containers?.map((container) => (
            <MenuItem key={container.id} value={container.id}>
              {container.name}
            </MenuItem>
          ))}
          {!containers && (
            <MenuItem value={defaultContainerId}>Example container</MenuItem>
          )}
        </TextField>
      </Paper>
      <LogViewer containerId={selectedContainer} />
    </Stack>
  );
};

const LogsPage = () => {
  return (
    <Suspense fallback={
      <Stack alignItems="center" justifyContent="center" py={6}>
        <CircularProgress />
        <Typography variant="body2" color="text.secondary" mt={2}>
          Loading logs...
        </Typography>
      </Stack>
    }>
      <LogsPageContent />
    </Suspense>
  );
};

export default LogsPage;
