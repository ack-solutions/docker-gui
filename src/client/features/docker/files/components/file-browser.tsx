"use client";

import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import FolderIcon from "@mui/icons-material/Folder";
import RefreshIcon from "@mui/icons-material/Refresh";
import SubdirectoryArrowRightIcon from "@mui/icons-material/SubdirectoryArrowRight";
import ViewListIcon from "@mui/icons-material/ViewList";
import ViewModuleIcon from "@mui/icons-material/ViewModule";
import DescriptionIcon from "@mui/icons-material/Description";
import {
  Box,
  Breadcrumbs,
  Button,
  Card,
  CardActionArea,
  CardContent,
  CircularProgress,
  IconButton,
  Link,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography
} from "@mui/material";
import Grid from "@mui/material/Grid";
import { styled } from "@mui/material/styles";
import { useMemo, useState } from "react";
import { useFiles } from "@/features/docker/files/hooks/use-files";
import { ContainerFileNode } from "@/lib/api/docker";
import { formatBytes } from "@/lib/utils/format";

const BreadcrumbLink = styled(Link)({
  cursor: "pointer"
});

const FileRow = styled(ListItemButton, {
  shouldForwardProp: (prop) => prop !== "$isDirectory"
})<{ $isDirectory: boolean }>(({ theme, $isDirectory }) => ({
  borderRadius: theme.shape.borderRadius,
  marginBottom: theme.spacing(0.5),
  backgroundColor: $isDirectory ? theme.palette.action.hover : "transparent",
  "&:hover": {
    backgroundColor: $isDirectory ? theme.palette.action.selected : theme.palette.action.hover
  }
}));

const FileCard = styled(Card, {
  shouldForwardProp: (prop) => prop !== "$isDirectory"
})<{ $isDirectory: boolean }>(({ theme, $isDirectory }) => ({
  height: "100%",
  backgroundColor: $isDirectory 
    ? (theme.palette.mode === "dark" ? "rgba(56, 189, 248, 0.08)" : theme.palette.primary.light + "20")
    : "transparent"
}));

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
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const { nodes, isLoading, error } = useFiles({ containerId, path, refreshToken });

  const breadcrumbs = useMemo(() => splitPath(path), [path]);

  const handleNavigate = (node: ContainerFileNode) => {
    if (node.type === "directory") {
      setPath(node.path.startsWith("/") ? node.path : `/${node.path}`);
    }
  };

  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Stack direction={{ xs: "column", md: "row" }} alignItems={{ xs: "stretch", md: "center" }} spacing={2}>
            <Typography variant="h6" flex={1}>
              File Browser
            </Typography>
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={(_, value) => value && setViewMode(value)}
              size="small"
            >
              <ToggleButton value="list" aria-label="list view">
                <ViewListIcon fontSize="small" />
              </ToggleButton>
              <ToggleButton value="grid" aria-label="grid view">
                <ViewModuleIcon fontSize="small" />
              </ToggleButton>
            </ToggleButtonGroup>
            <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => setRefreshToken((value) => value + 1)} size="small">
              Refresh
            </Button>
          </Stack>
          
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
            <Typography variant="body2" color="text.secondary">Path:</Typography>
            <Breadcrumbs maxItems={4} itemsAfterCollapse={2} separator={<SubdirectoryArrowRightIcon fontSize="small" />}>
              <BreadcrumbLink color="inherit" underline="hover" onClick={() => setPath("/")}>
                root
              </BreadcrumbLink>
              {breadcrumbs.map((crumb) => (
                <BreadcrumbLink
                  key={crumb.path}
                  color="inherit"
                  underline="hover"
                  onClick={() => setPath(crumb.path)}
                >
                  {crumb.label}
                </BreadcrumbLink>
              ))}
            </Breadcrumbs>
          </Box>

          {isLoading ? (
            <Stack alignItems="center" py={6}>
              <CircularProgress />
              <Typography variant="body2" color="text.secondary" mt={2}>
                Retrieving directory listing...
              </Typography>
            </Stack>
          ) : error ? (
            <Typography variant="body2" color="error">
              {error.message}
            </Typography>
          ) : viewMode === "list" ? (
            <List disablePadding>
              {nodes.map((node) => (
                <FileRow
                  key={node.path}
                  onClick={() => handleNavigate(node)}
                  $isDirectory={node.type === "directory"}
                  disabled={node.type !== "directory"}
                >
                  <ListItemIcon>
                    {node.type === "directory" ? (
                      <FolderIcon color="primary" />
                    ) : (
                      <DescriptionIcon color="action" />
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary={node.name}
                    secondary={`${node.type === "directory" ? "Directory" : "File"} • ${formatBytes(node.size)}`}
                  />
                </FileRow>
              ))}
              {nodes.length === 0 && (
                <Typography variant="body2" color="text.secondary" textAlign="center" py={4}>
                  This directory is empty.
                </Typography>
              )}
            </List>
          ) : (
            <Grid container spacing={2}>
              {nodes.map((node) => (
                <Grid key={node.path} size={{ xs: 6, sm: 4, md: 3, lg: 2 }}>
                  <FileCard $isDirectory={node.type === "directory"}>
                    <CardActionArea
                      onClick={() => handleNavigate(node)}
                      disabled={node.type !== "directory"}
                      sx={{ height: "100%", p: 2 }}
                    >
                      <Stack alignItems="center" spacing={1}>
                        {node.type === "directory" ? (
                          <FolderIcon color="primary" sx={{ fontSize: 48 }} />
                        ) : (
                          <DescriptionIcon color="action" sx={{ fontSize: 48 }} />
                        )}
                        <Typography variant="body2" textAlign="center" noWrap sx={{ width: "100%" }}>
                          {node.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatBytes(node.size)}
                        </Typography>
                      </Stack>
                    </CardActionArea>
                  </FileCard>
                </Grid>
              ))}
              {nodes.length === 0 && (
                <Grid size={{ xs: 12 }}>
                  <Typography variant="body2" color="text.secondary" textAlign="center" py={4}>
                    This directory is empty.
                  </Typography>
                </Grid>
              )}
            </Grid>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};

export default FileBrowser;
