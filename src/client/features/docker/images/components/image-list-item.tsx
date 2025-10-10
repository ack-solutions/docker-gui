"use client";

import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DownloadIcon from "@mui/icons-material/Download";
import { Box, Button, Card, CardActionArea, CardContent, Chip, Skeleton, Stack, Typography } from "@mui/material";
import moment from "moment";
import { formatBytes } from "@/lib/utils/format";
import type { DockerImage } from "@/types/docker";

interface ImageListItemProps {
  image?: DockerImage | null;
  onOpenDetails?: (imageId: string) => void;
  onExport?: (imageId: string) => void;
  onRemove?: (imageId: string) => void;
}

const ImageListItem = ({
  image,
  onOpenDetails,
  onExport,
  onRemove
}: ImageListItemProps) => {
  if (!image) {
    return (
      <Card>
        <CardContent>
          <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2}>
            <Stack flex={1} spacing={1.5}>
              <Box>
                <Skeleton variant="text" width="65%" />
                <Skeleton variant="text" width="50%" />
              </Box>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                {Array.from({ length: 3 }).map((_, index) => (
                  <Skeleton key={index} variant="rounded" width={120} height={28} />
                ))}
              </Box>
            </Stack>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} variant="rounded" width={88} height={32} />
              ))}
            </Box>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  const handleOpen = () => {
    onOpenDetails?.(image.id);
  };

  return (
    <Card>
      <CardActionArea onClick={handleOpen}>
        <CardContent>
          <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2}>
            <Stack flex={1} spacing={1.5}>
              <Box>
                <Typography variant="subtitle1">
                  {image.repoTags.join(", ")}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {image.id}
                </Typography>
              </Box>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                <Chip label={formatBytes(image.size)} variant="outlined" color="primary" size="small" />
                <Chip label={`Containers: ${image.containers}`} variant="outlined" size="small" />
                <Chip label={`Created ${moment(image.createdAt).fromNow()}`} variant="outlined" size="small" />
              </Box>
            </Stack>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                size="small"
                sx={{ minWidth: "auto" }}
                onClick={(event) => {
                  event.stopPropagation();
                  onExport?.(image.id);
                }}
              >
                Export
              </Button>
              <Button
                color="error"
                startIcon={<DeleteOutlineIcon />}
                size="small"
                sx={{ minWidth: "auto" }}
                onClick={(event) => {
                  event.stopPropagation();
                  onRemove?.(image.id);
                }}
              >
                Remove
              </Button>
              <Button
                variant="contained"
                size="small"
                sx={{ minWidth: "auto" }}
                onClick={(event) => {
                  event.stopPropagation();
                  handleOpen();
                }}
              >
                Details
              </Button>
          </Box>
        </Stack>
      </CardContent>
    </CardActionArea>
  </Card>
  );
};

export default ImageListItem;
