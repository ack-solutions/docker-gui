"use client";

import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import RefreshIcon from "@mui/icons-material/Refresh";
import SubdirectoryArrowRightIcon from "@mui/icons-material/SubdirectoryArrowRight";
import {
  Breadcrumbs,
  Button,
  CircularProgress,
  Link,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  Typography
} from "@mui/material";
import { styled } from "@mui/material/styles";
import { useMemo, useState } from "react";
import { useFiles } from "@/features/files/hooks/use-files";
import { ContainerFileNode } from "@/lib/api/docker";

const BrowserContainer = styled(Paper)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(2)
}));

const BreadcrumbLink = styled(Link)({
  cursor: "pointer"
});

const FileRow = styled(ListItemButton, {
  shouldForwardProp: (prop) => prop !== "$isDirectory"
})<{ $isDirectory: boolean }>(({ theme, $isDirectory }) => ({
  borderRadius: theme.shape.borderRadius,
  marginBottom: theme.spacing(1),
  backgroundColor: $isDirectory ? theme.palette.action.hover : "transparent",
  "&:hover": {
    backgroundColor: $isDirectory ? theme.palette.action.selected : theme.palette.action.hover
  }
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
  const { nodes, isLoading } = useFiles({ containerId, path, refreshToken });

  const breadcrumbs = useMemo(() => splitPath(path), [path]);

  const handleNavigate = (node: ContainerFileNode) => {
    if (node.type === "directory") {
      setPath(node.path.startsWith("/") ? node.path : `/${node.path}`);
    }
  };

  return (
    <BrowserContainer>
      <Stack direction={{ xs: "column", md: "row" }} alignItems="center" spacing={2}>
        <Typography variant="h6" flex={1}>
          File Browser
        </Typography>
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
            <FileRow
              key={node.path}
              onClick={() => handleNavigate(node)}
              $isDirectory={node.type === "directory"}
              disabled={node.type !== "directory"}
            >
              <ListItemIcon>
                <InsertDriveFileIcon color={node.type === "directory" ? "primary" : "inherit"} />
              </ListItemIcon>
              <ListItemText
                primary={node.name}
                secondary={`${node.type === "directory" ? "Directory" : "File"} • ${node.size} bytes`}
              />
            </FileRow>
          ))}
          {nodes.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              This directory is empty.
            </Typography>
          )}
        </List>
      )}
    </BrowserContainer>
  );
};

export default FileBrowser;
