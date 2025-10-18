"use client";

import { IconButton, Stack, Tooltip, Typography } from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { styled } from "@mui/material/styles";
import { useState } from "react";
import { toast } from "sonner";
import type { DockerContainerInspect } from "@/types/docker";

const JsonViewport = styled("pre")(({ theme }) => ({
  backgroundColor: theme.palette.mode === "dark" ? "rgba(15,23,42,0.9)" : theme.palette.grey[50],
  borderRadius: theme.shape.borderRadius,
  border: `1px solid ${theme.palette.divider}`,
  padding: theme.spacing(2),
  maxHeight: 560,
  overflow: "auto",
  fontFamily: 'ui-monospace, SFMono-Regular, SFMono, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  fontSize: 13,
  lineHeight: 1.6
}));

interface ContainerInspectViewerProps {
  inspect: DockerContainerInspect;
}

const ContainerInspectViewer = ({ inspect }: ContainerInspectViewerProps) => {
  const [copied, setCopied] = useState(false);

  const json = JSON.stringify(inspect, null, 2);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      toast.success("Inspect JSON copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy inspect output", error);
      toast.error("Unable to copy JSON");
    }
  };

  return (
    <Stack spacing={2}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Typography variant="h6" flex={1}>
          Raw inspect JSON
        </Typography>
        <Tooltip title={copied ? "Copied" : "Copy to clipboard"}>
          <IconButton onClick={handleCopy} size="small">
            <ContentCopyIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
      <JsonViewport>{json}</JsonViewport>
    </Stack>
  );
};

export default ContainerInspectViewer;
