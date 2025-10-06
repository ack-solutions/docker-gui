"use client";

import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import RefreshIcon from "@mui/icons-material/Refresh";
import SubdirectoryArrowRightIcon from "@mui/icons-material/SubdirectoryArrowRight";
import { Breadcrumbs, Button, CircularProgress, Link, List, ListItem, ListItemIcon, ListItemText, Paper, Stack, Typography } from "@mui/material";
import { useMemo, useState } from "react";
import { useFiles } from "@/features/files/hooks/useFiles";
import { ContainerFileNode } from "@/lib/api/docker";

interface FileBrowserProps {
  containerId: string;
}

const splitPath = (path: string) => {
  const segments = path.split("/").filter(Boolean);
  return segments.map((segment, index) => ({
    label: segment,
    path: `/${segments.slice(0, index + 1).join("/")}`
  }));
};

const FileBrowser = ({ containerId }: FileBrowserProps) => {
  const [path, setPath] = useState("/");
  const [refreshToken, setRefreshToken] = useState(0);
  const { nodes, isLoading } = useFiles({ containerId, path, refreshToken });

  const breadcrumbs = useMemo(() => splitPath(path), [path]);

  const handleNavigate = (node: ContainerFileNode) => {
    if (node.type === "directory") {
      setPath(node.path.startsWith("/") ? node.path : `/${node.path}`);
    }
  };

  return (
    <Paper sx={{ p: 3, borderRadius: 3, display: "flex", flexDirection: "column", gap: 2 }}>
      <Stack direction={{ xs: "column", md: "row" }} alignItems="center" spacing={2}>
        <Typography variant="h6" sx={{ flex: 1 }}>
          File Browser
        </Typography>
        <Breadcrumbs maxItems={4} itemsAfterCollapse={2} separator={<SubdirectoryArrowRightIcon fontSize="small" />}>
          <Link color="inherit" underline="hover" onClick={() => setPath("/")} sx={{ cursor: "pointer" }}>
            root
          </Link>
          {breadcrumbs.map((crumb) => (
            <Link
              key={crumb.path}
              color="inherit"
              underline="hover"
              onClick={() => setPath(crumb.path)}
              sx={{ cursor: "pointer" }}
            >
              {crumb.label}
            </Link>
          ))}
        </Breadcrumbs>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => setRefreshToken((value) => value + 1)}>
          Refresh
        </Button>
      </Stack>
      {isLoading ? (
        <Stack alignItems="center" py={6}>
          <CircularProgress />
          <Typography variant="body2" color="text.secondary" mt={2}>
            Retrieving directory listing...
          </Typography>
        </Stack>
      ) : (
        <List>
          {nodes.map((node) => (
            <ListItem
              key={node.path}
              onClick={() => handleNavigate(node)}
              sx={{
                borderRadius: 2,
                mb: 1,
                backgroundColor: node.type === "directory" ? "rgba(56, 189, 248, 0.08)" : "transparent",
                cursor: node.type === "directory" ? "pointer" : "default"
              }}
            >
              <ListItemIcon>
                <InsertDriveFileIcon color={node.type === "directory" ? "primary" : "inherit"} />
              </ListItemIcon>
              <ListItemText
                primary={node.name}
                secondary={`${node.type === "directory" ? "Directory" : "File"} • ${node.size} bytes`}
              />
            </ListItem>
          ))}
          {nodes.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              This directory is empty.
            </Typography>
          )}
        </List>
      )}
    </Paper>
  );
};

export default FileBrowser;
