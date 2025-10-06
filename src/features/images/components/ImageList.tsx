"use client";

import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DownloadIcon from "@mui/icons-material/Download";
import { Button, Chip, CircularProgress, Paper, Stack, Typography } from "@mui/material";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { useImages } from "@/features/images/hooks/useImages";

dayjs.extend(relativeTime);

const formatBytes = (bytes: number) => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};

const ImageList = () => {
  const { data, isLoading } = useImages();

  if (isLoading) {
    return (
      <Stack alignItems="center" justifyContent="center" py={6}>
        <CircularProgress />
        <Typography variant="body2" color="text.secondary" mt={2}>
          Fetching image catalog...
        </Typography>
      </Stack>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Paper sx={{ p: 6, textAlign: "center" }}>
        <Typography variant="h6" gutterBottom>
          No images available
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Pull images from registries or build a new image to get started.
        </Typography>
      </Paper>
    );
  }

  return (
    <Stack spacing={2}>
      {data.map((image) => (
        <Paper key={image.id} sx={{ p: 3, borderRadius: 3, display: "flex", alignItems: "center", gap: 3 }}>
          <Stack sx={{ flex: 1 }}>
            <Typography variant="subtitle1" fontWeight={600}>
              {image.repoTags.join(", ")}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {image.id}
            </Typography>
            <Stack direction="row" spacing={2} mt={1}>
              <Chip label={formatBytes(image.size)} variant="outlined" color="primary" size="small" />
              <Chip label={`Containers: ${image.containers}`} variant="outlined" size="small" />
              <Chip label={`Created ${dayjs(image.createdAt).fromNow()}`} variant="outlined" size="small" />
            </Stack>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" startIcon={<DownloadIcon />}
              sx={{ whiteSpace: "nowrap" }}
            >
              Export
            </Button>
            <Button color="error" startIcon={<DeleteOutlineIcon />}
              sx={{ whiteSpace: "nowrap" }}
            >
              Remove
            </Button>
          </Stack>
        </Paper>
      ))}
    </Stack>
  );
};

export default ImageList;
