"use client";

import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import PendingIcon from "@mui/icons-material/Pending";
import DraftsIcon from "@mui/icons-material/Drafts";
import LockIcon from "@mui/icons-material/Lock";
import StorageIcon from "@mui/icons-material/Storage";
import PublicIcon from "@mui/icons-material/Public";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import type { NginxSite } from "@/types/server";

interface NginxSitesCardsProps {
  sites: NginxSite[];
  onEdit: (site: NginxSite) => void;
  onDelete: (site: NginxSite) => void;
  onDeploy: (site: NginxSite) => void;
  isDeploying?: string | null;
}

export default function NginxSitesCards({
  sites,
  onEdit,
  onDelete,
  onDeploy,
  isDeploying,
}: NginxSitesCardsProps) {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case "active":
        return { icon: <CheckCircleIcon />, color: "success" as const, label: "Active" };
      case "pending":
        return { icon: <PendingIcon />, color: "warning" as const, label: "Pending" };
      case "error":
        return { icon: <ErrorIcon />, color: "error" as const, label: "Error" };
      case "draft":
        return { icon: <DraftsIcon />, color: "default" as const, label: "Draft" };
      default:
        return { icon: null, color: "default" as const, label: status };
    }
  };

  const getUpstreamIcon = (type: string) => {
    switch (type) {
      case "container":
        return <StorageIcon />;
      case "external":
      case "service":
        return <PublicIcon />;
      default:
        return null;
    }
  };

  const getUpstreamDisplay = (site: NginxSite) => {
    switch (site.upstreamType) {
      case "container":
        return `Port ${site.containerPort || "?"}`;
      case "external":
        return site.upstreamTarget || "External";
      case "service":
        return site.upstreamTarget || "Service";
      default:
        return site.upstreamTarget || "N/A";
    }
  };

  if (sites.length === 0) {
    return (
      <Paper
        variant="outlined"
        sx={{
          p: 6,
          textAlign: "center",
          borderStyle: "dashed",
          borderRadius: 2,
        }}
      >
        <Typography variant="h6" gutterBottom>
          No Nginx Sites Yet
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Create your first nginx site to get started
        </Typography>
      </Paper>
    );
  }

  return (
    <Grid container spacing={3}>
      {sites.map((site) => {
        const status = getStatusConfig(site.status);
        const hasSSL = site.enableHttps;

        return (
          <Grid size={{xs: 12, sm:6, md:4}} key={site.id}>
            <Card
              sx={{
                height: "100%",
                cursor: "pointer",
                transition: "all 0.2s",
                "&:hover": {
                  boxShadow: 4,
                  transform: "translateY(-2px)",
                },
              }}
              onClick={() => onEdit(site)}
            >
              <CardContent>
                <Stack spacing={2.5}>
                  {/* Domain */}
                  <Box>
                    <Typography variant="h6" fontSize="1rem" fontWeight={600}>
                      {site.primaryDomain}
                    </Typography>
                    {site.serverNames.length > 1 && (
                      <Typography variant="caption" color="text.secondary">
                        +{site.serverNames.length - 1} alias{site.serverNames.length > 2 ? "es" : ""}
                      </Typography>
                    )}
                  </Box>

                  {/* Status & Security */}
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    <Chip
                      label={status.label}
                      size="small"
                      color={status.color}
                      icon={status.icon}
                    />
                    {hasSSL && (
                      <Chip
                        label="HTTPS"
                        size="small"
                        color="success"
                        variant="outlined"
                        icon={<LockIcon />}
                      />
                    )}
                    {site.forceHttps && (
                      <Chip label="Forced" size="small" variant="outlined" />
                    )}
                  </Stack>

                  {/* Upstream */}
                  <Box
                    sx={{
                      p: 2,
                      bgcolor: "action.hover",
                      borderRadius: 1,
                    }}
                  >
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      {getUpstreamIcon(site.upstreamType)}
                      <Box>
                        <Typography variant="body2" fontWeight={500}>
                          {site.upstreamType.charAt(0).toUpperCase() + site.upstreamType.slice(1)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {getUpstreamDisplay(site)}
                        </Typography>
                      </Box>
                    </Stack>
                  </Box>

                  {/* Actions */}
                  <Stack direction="row" spacing={1} justifyContent="flex-end">
                    <Button
                      size="small"
                      startIcon={<OpenInNewIcon fontSize="small" />}
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(`https://${site.primaryDomain}`, "_blank");
                      }}
                      sx={{ minWidth: 70 }}
                    >
                      Open
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      color="primary"
                      startIcon={<PlayArrowIcon fontSize="small" />}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeploy(site);
                      }}
                      disabled={isDeploying === site.id}
                      sx={{ minWidth: 80 }}
                    >
                      Deploy
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      color="error"
                      startIcon={<DeleteIcon fontSize="small" />}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(site);
                      }}
                      sx={{ minWidth: 80 }}
                    >
                      Delete
                    </Button>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        );
      })}
    </Grid>
  );
}

