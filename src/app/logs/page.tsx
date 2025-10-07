"use client";

import { useEffect, useMemo, useState } from "react";
import TerminalIcon from "@mui/icons-material/Terminal";
import { MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import LogViewer from "@/features/logs/components/log-viewer";
import { useContainers } from "@/features/containers/hooks/use-containers";

const LogsPage = () => {
  const { data: containers } = useContainers();
  const defaultContainerId = useMemo(() => containers?.[0]?.id ?? "1a2b3c", [containers]);
  const [selectedContainer, setSelectedContainer] = useState(defaultContainerId);

  useEffect(() => {
    setSelectedContainer(defaultContainerId);
  }, [defaultContainerId]);

  const handleChange = (value: string) => {
    setSelectedContainer(value);
  };

  return (
    <Stack spacing={3}>
      <Stack direction="row" spacing={2} alignItems="center">
        <TerminalIcon color="primary" />
        <Typography variant="h5" fontWeight={700}>
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

export default LogsPage;
