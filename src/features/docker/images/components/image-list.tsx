"use client";

import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DownloadIcon from "@mui/icons-material/Download";
import { Box, Button, Card, CardActionArea, CardContent, Chip, CircularProgress, Paper, Stack, Typography } from "@mui/material";
import moment from "moment";
import EmptyState from "@/components/common/empty-state";
import { useImages } from "@/features/docker/images/hooks/use-images";
import { formatBytes } from "@/lib/utils/format";
import { useRouter } from "next/navigation";

const ImageList = () => {
  const { data, isLoading, isError, error } = useImages();
  const router = useRouter();

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

  if (isError) {
    return (
      <Paper sx={{ p: 4 }}>
        <Typography variant="subtitle1" gutterBottom>
          Unable to load images
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {error instanceof Error ? error.message : "Check your Docker connection and try again."}
        </Typography>
      </Paper>
    );
  }

  if (!data || data.length === 0) {
    return (
      <EmptyState
        title="No images available"
        description="Pull images from registries or build a new image to get started."
      />
    );
  }

  return (
    <Stack spacing={2.5}>
      {data.map((image) => (
        <Card key={image.id}>
          <CardActionArea onClick={() => router.push(`/server/docker/images/${encodeURIComponent(image.id)}`)}>
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
                      // TODO: implement export image
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
                      // TODO: implement delete image
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
                      router.push(`/server/docker/images/${encodeURIComponent(image.id)}`);
                    }}
                  >
                    Details
                  </Button>
                </Box>
              </Stack>
            </CardContent>
          </CardActionArea>
        </Card>
      ))}
    </Stack>
  );
};

export default ImageList;
