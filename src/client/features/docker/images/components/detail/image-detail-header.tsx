"use client";

import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DownloadIcon from "@mui/icons-material/Download";
import { Button, Chip, Stack, Tooltip, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import { useMemo, useState } from "react";
import { formatBytes } from "@/lib/utils/format";
import type { DockerImageInspect } from "@/types/docker";

const HeaderShell = styled(Stack)(({ theme }) => ({
  padding: theme.spacing(3),
  borderRadius:
    typeof theme.shape.borderRadius === "number"
      ? theme.shape.borderRadius * 1.5
      : theme.shape.borderRadius,
  background: theme.palette.mode === "dark"
    ? "linear-gradient(135deg, rgba(56,189,248,0.08), rgba(59,130,246,0.12))"
    : "linear-gradient(135deg, rgba(59,130,246,0.12), rgba(37,99,235,0.08))",
  border: `1px solid ${theme.palette.divider}`
}));

interface ImageDetailHeaderProps {
  inspect: DockerImageInspect;
  onRunContainer: () => void;
  onExport?: () => void;
}

const ImageDetailHeader = ({ inspect, onRunContainer, onExport }: ImageDetailHeaderProps) => {
  const [copyLabel, setCopyLabel] = useState("Copy pull command");
  const [copyRunLabel, setCopyRunLabel] = useState("Copy run command");

  const primaryTag = useMemo(() => inspect.repoTags[0] ?? inspect.id.slice(0, 12), [inspect.id, inspect.repoTags]);
  const pullCommand = `docker pull ${primaryTag}`;
  const runCommand = `docker run -it ${primaryTag}`;

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

  return (
    <HeaderShell spacing={2}>
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
              onClick={onRunContainer}
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
          {onExport && (
            <Button variant="outlined" onClick={onExport}>
              Export
            </Button>
          )}
        </Stack>
      </Stack>
    </HeaderShell>
  );
};

export default ImageDetailHeader;
