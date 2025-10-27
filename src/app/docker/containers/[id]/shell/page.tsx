"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import TerminalIcon from "@mui/icons-material/Terminal";
import { Alert, Button, CircularProgress, Paper, Stack, Typography } from "@mui/material";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import CommandTerminal from "@/components/common/command-terminal";
import { useContainers } from "@/features/docker/containers/hooks/use-containers";
import { executeContainerCommand } from "@/lib/api/docker";

const ShellPage = () => {
  const params = useParams<{ id: string }>();
  const containerId = params?.id ?? "";
  const { data: containers, isLoading, isError } = useContainers();
  const container = useMemo(() => containers?.find((item) => item.id === containerId), [containers, containerId]);
  const [copyLabel, setCopyLabel] = useState("Copy output");
  const [lastOutput, setLastOutput] = useState<string | null>(null);

  const handleCopy = useCallback(async () => {
    if (!lastOutput) {
      toast.info("No output to copy");
      return;
    }
    try {
      await navigator.clipboard.writeText(lastOutput);
      setCopyLabel("Copied!");
      toast.success("Output copied to clipboard");
    } catch (error) {
      console.error("Failed to copy output", error);
      setCopyLabel("Copy failed");
      toast.error("Failed to copy output");
    }
  }, [lastOutput]);

  useEffect(() => {
    if (copyLabel === "Copy output") {
      return;
    }
    const timer = window.setTimeout(() => setCopyLabel("Copy output"), 2000);
    return () => window.clearTimeout(timer);
  }, [copyLabel]);

  if (!containerId) {
    return (
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2} alignItems="center">
          <Typography variant="h6" color="error.main">
            Container not specified
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Provide a container ID in the URL to open an interactive shell.
          </Typography>
          <Button
            variant="outlined"
            startIcon={<OpenInNewIcon />}
            href="/docker/containers"
          >
            View containers
          </Button>
        </Stack>
      </Paper>
    );
  }

  if (isLoading) {
    return (
      <Stack spacing={2} alignItems="center" sx={{ py: 4 }}>
        <CircularProgress />
        <Typography variant="body2" color="text.secondary">
          Loading container information...
        </Typography>
      </Stack>
    );
  }

  if (isError || !container) {
    return (
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Alert severity="error">
            Failed to load container information. The container may not exist or Docker may be unavailable.
          </Alert>
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<OpenInNewIcon />}
              href="/docker/containers"
            >
              View containers
            </Button>
            <Button
              variant="text"
              onClick={() => window.location.reload()}
            >
              Retry
            </Button>
          </Stack>
        </Stack>
      </Paper>
    );
  }

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
        <TerminalIcon color="primary" />
        <Typography variant="h5">Interactive Shell</Typography>
        <Typography variant="body2" color="text.secondary">
          {container.name} ({container.id.substring(0, 12)})
        </Typography>
      </Stack>
      
      {container.state !== "running" && (
        <Alert severity="warning">
          Container is {container.state}. Some commands may not work properly.
        </Alert>
      )}

      <Paper sx={{ p: 2, overflow: "hidden" }}>
        <Stack spacing={1.5}>
          <CommandTerminal
            sessionName={container.name}
            promptLabel={`root@${container.name}:/app`}
            welcomeMessage={`Connected to ${container.name}. Type commands and press Enter. Use 'clear' to clear the terminal.`}
            executeCommand={(tokens) => executeContainerCommand(containerId, tokens)}
            onLastOutputChange={setLastOutput}
            minHeight={400}
          />
          <Stack
            direction={{ xs: "column", sm: "row" }}
            justifyContent="space-between"
            alignItems={{ xs: "stretch", sm: "center" }}
            spacing={1}
            sx={{ pt: 1 }}
          >
            <Typography variant="caption" color="text.secondary">
              Supports command history (\u2191/\u2193), Ctrl+C to cancel, and standard shell commands
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
                disabled={!lastOutput}
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
