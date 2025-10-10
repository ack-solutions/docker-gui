"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import TerminalIcon from "@mui/icons-material/Terminal";
import { Button, Paper, Stack, Typography } from "@mui/material";
import { useParams } from "next/navigation";
import CommandTerminal from "@/components/common/command-terminal";
import { useContainers } from "@/features/docker/containers/hooks/use-containers";
import { executeContainerCommand } from "@/lib/api/docker";

const ShellPage = () => {
  const params = useParams<{ id: string }>();
  const containerId = params?.id ?? "";
  const { data: containers } = useContainers();
  const container = useMemo(() => containers?.find((item) => item.id === containerId), [containers, containerId]);
  const [copyLabel, setCopyLabel] = useState("Copy last output");
  const [lastOutput, setLastOutput] = useState<string | null>(null);

  const handleCopy = useCallback(async () => {
    if (!lastOutput) {
      setCopyLabel("Nothing to copy");
      return;
    }
    try {
      await navigator.clipboard.writeText(lastOutput);
      setCopyLabel("Copied!");
    } catch (error) {
      console.error("Failed to copy output", error);
      setCopyLabel("Copy failed");
    }
  }, [lastOutput]);

  useEffect(() => {
    if (copyLabel === "Copy last output") {
      return;
    }
    const timer = window.setTimeout(() => setCopyLabel("Copy last output"), 1500);
    return () => window.clearTimeout(timer);
  }, [copyLabel]);

  if (!containerId) {
    return (
      <Paper sx={{ p: 4 }}>
        <Typography variant="h6" gutterBottom>
          Container not specified
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Provide a container id in the URL to open an interactive shell.
        </Typography>
      </Paper>
    );
  }

  return (
    <Stack spacing={3}>
      <Stack direction="row" spacing={1.5} alignItems="center">
        <TerminalIcon color="primary" />
        <Typography variant="h5">Interactive shell</Typography>
      </Stack>
      <Typography variant="body1" color="text.secondary">
        {container
          ? `Connected to ${container.name} (${container.id})`
          : "Connect to a Docker container to run commands."}
      </Typography>
      <Paper sx={{ p: 2.5 }}>
        <Stack spacing={1.5}>
          <CommandTerminal
            sessionName={container?.name ?? containerId}
            promptLabel={`root@${container?.name ?? containerId}:/app`}
            welcomeMessage={`Welcome to the container shell. Connected to ${container?.name ?? containerId}.`}
            executeCommand={(tokens) => executeContainerCommand(containerId, tokens)}
            onLastOutputChange={setLastOutput}
            minHeight={360}
          />
          <Stack
            direction={{ xs: "column", md: "row" }}
            justifyContent="space-between"
            alignItems={{ xs: "stretch", md: "center" }}
            spacing={1}
          >
            <Typography variant="caption" color="text.secondary">
              Type commands directly in the terminal. Supports history (↑ / ↓) and Ctrl+C.
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                startIcon={<OpenInNewIcon fontSize="small" />}
                href="/docker/containers"
                size="small"
              >
                Back to containers
              </Button>
              <Button
                variant="outlined"
                startIcon={<ContentCopyIcon fontSize="small" />}
                onClick={handleCopy}
                size="small"
              >
                {copyLabel}
              </Button>
            </Stack>
          </Stack>
        </Stack>
      </Paper>
    </Stack>
  );
};

export default ShellPage;
