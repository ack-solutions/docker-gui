"use client";

import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import { Stack, Typography } from "@mui/material";
import FileBrowser from "@/features/files/components/file-browser";

const FilesPage = () => {
  return (
    <Stack spacing={3}>
      <Stack direction="row" spacing={1.5} alignItems="center">
        <FolderOpenIcon color="primary" />
        <Typography variant="h5">
          Container File Browser
        </Typography>
      </Stack>
      <Typography variant="body1" color="text.secondary">
        Explore files inside your containers, inspect configuration, and download artifacts without leaving the dashboard.
      </Typography>
      <FileBrowser containerId="1a2b3c" />
    </Stack>
  );
};

export default FilesPage;
