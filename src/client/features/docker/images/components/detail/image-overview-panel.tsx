"use client";

import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import LanIcon from "@mui/icons-material/Lan";
import StorageIcon from "@mui/icons-material/Storage";
import { Box, Chip, Divider, List, ListItem, ListItemIcon, ListItemText, Stack, Typography } from "@mui/material";
import moment from "moment";
import { formatBytes } from "@/lib/utils/format";
import type { DockerImageInspect } from "@/types/docker";

interface ImageOverviewPanelProps {
  inspect: DockerImageInspect;
}

const renderListItem = (icon: React.ReactNode, label: string, value?: React.ReactNode) => (
  <ListItem disableGutters>
    <ListItemIcon sx={{ minWidth: 36 }}>{icon}</ListItemIcon>
    <ListItemText
      primaryTypographyProps={{ variant: "body2", color: "text.secondary" }}
      secondaryTypographyProps={{ variant: "subtitle2" }}
      primary={label}
      secondary={value ?? "—"}
    />
  </ListItem>
);

const ImageOverviewPanel = ({ inspect }: ImageOverviewPanelProps) => {
  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={3}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" gutterBottom>
            Image metadata
          </Typography>
          <List disablePadding>
            {renderListItem(
              <InfoOutlinedIcon fontSize="small" color="primary" />,
              "Image ID",
              inspect.id
            )}
            {renderListItem(
              <StorageIcon fontSize="small" color="primary" />,
              "Size",
              `${formatBytes(inspect.size)} (${formatBytes(inspect.virtualSize)} virtual)`
            )}
            {renderListItem(
              <InfoOutlinedIcon fontSize="small" color="primary" />,
              "Created",
              `${moment(inspect.createdAt).fromNow()} (${moment(inspect.createdAt).format("LLL")})`
            )}
            {renderListItem(
              <LanIcon fontSize="small" color="primary" />,
              "Platform",
              [inspect.architecture, inspect.variant, inspect.os].filter(Boolean).join(" / ") || "—"
            )}
            {renderListItem(
              <InfoOutlinedIcon fontSize="small" color="primary" />,
              "Docker version",
              inspect.dockerVersion || "—"
            )}
          </List>
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" gutterBottom>
            Configuration
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Typography variant="caption" color="text.secondary">
                Entrypoint:
              </Typography>
              {inspect.config.entrypoint.length === 0 ? (
                <Typography variant="caption" color="text.secondary">
                  —
                </Typography>
              ) : (
                inspect.config.entrypoint.map((item) => (
                  <Chip key={item} label={item} size="small" variant="outlined" />
                ))
              )}
            </Stack>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Typography variant="caption" color="text.secondary">
                Cmd:
              </Typography>
              {inspect.config.cmd.length === 0 ? (
                <Typography variant="caption" color="text.secondary">
                  —
                </Typography>
              ) : (
                inspect.config.cmd.map((item) => (
                  <Chip key={item} label={item} size="small" variant="outlined" />
                ))
              )}
            </Stack>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Typography variant="caption" color="text.secondary">
                Environment:
              </Typography>
              {inspect.config.env.length === 0 ? (
                <Typography variant="caption" color="text.secondary">
                  —
                </Typography>
              ) : (
                inspect.config.env.map((item) => (
                  <Chip key={item} label={item} size="small" variant="outlined" />
                ))
              )}
            </Stack>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Typography variant="caption" color="text.secondary">
                Exposed ports:
              </Typography>
              {inspect.config.exposedPorts.length === 0 ? (
                <Typography variant="caption" color="text.secondary">
                  —
                </Typography>
              ) : (
                inspect.config.exposedPorts.map((port) => (
                  <Chip key={port} label={port} size="small" variant="outlined" />
                ))
              )}
            </Stack>
          </Stack>
        </Box>
      </Stack>

      <Box>
        <Typography variant="h6" gutterBottom>
          Digests
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <Stack spacing={1}>
          {inspect.repoDigests.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No digests available.
            </Typography>
          ) : (
            inspect.repoDigests.map((digest) => (
              <Typography key={digest} variant="body2" sx={{ wordBreak: "break-all" }}>
                {digest}
              </Typography>
            ))
          )}
        </Stack>
      </Box>

      <Box>
        <Typography variant="h6" gutterBottom>
          Labels
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
          {Object.keys(inspect.config.labels).length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No labels applied.
            </Typography>
          ) : (
            Object.entries(inspect.config.labels).map(([key, value]) => (
              <Chip key={key} label={`${key}=${value}`} size="small" variant="outlined" />
            ))
          )}
        </Box>
      </Box>
    </Stack>
  );
};

export default ImageOverviewPanel;
