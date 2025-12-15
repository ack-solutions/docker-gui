"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Box,
  Stack,
  Typography,
  Button,
  Chip,
  Paper,
  Link,
} from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import PendingIcon from "@mui/icons-material/Pending";
import ErrorIcon from "@mui/icons-material/Error";
import apiClient from "@/lib/api/client";
import type { NginxSite } from "@/types/server";
import type { Domain as DomainModel } from "@/types/server";

interface NginxSectionEditorProps {
  domain: DomainModel;
}

export default function NginxSectionEditor({
  domain,
}: NginxSectionEditorProps) {
  const { data: nginxSite, isLoading } = useQuery<NginxSite | null>({
    queryKey: ["nginx", "site", domain.nginxSiteId],
    queryFn: async () => {
      if (!domain.nginxSiteId) return null;
      const { data } = await apiClient.get<NginxSite>(`/nginx/sites/${domain.nginxSiteId}`);
      return data;
    },
    enabled: !!domain.nginxSiteId,
  });

  if (!domain.nginxSiteId) {
    return (
      <Box sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Typography variant="h6" fontWeight={600}>
            Nginx Configuration
          </Typography>
          <Paper variant="outlined" sx={{ p: 3, textAlign: "center", borderStyle: "dashed" }}>
            <Typography variant="body2" color="text.secondary">
              No nginx site configured for this domain.
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
              Configure routing to automatically create an nginx site.
            </Typography>
          </Paper>
        </Stack>
      </Box>
    );
  }

  if (isLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="body2" color="text.secondary">Loading nginx configuration...</Typography>
      </Box>
    );
  }

  if (!nginxSite) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="body2" color="error">Nginx site not found</Typography>
      </Box>
    );
  }

  const getStatusConfig = () => {
    switch (nginxSite.status) {
      case "active":
        return { icon: <CheckCircleIcon />, color: "success" as const, label: "Active" };
      case "pending":
        return { icon: <PendingIcon />, color: "warning" as const, label: "Pending" };
      case "error":
        return { icon: <ErrorIcon />, color: "error" as const, label: "Error" };
      default:
        return { icon: null, color: "default" as const, label: "Draft" };
    }
  };

  const status = getStatusConfig();

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h6" fontWeight={600}>
          Nginx Configuration
        </Typography>
        <Button
          size="small"
          variant="outlined"
          endIcon={<OpenInNewIcon />}
          href="/nginx"
          target="_blank"
        >
          Manage in Nginx
        </Button>
      </Stack>

      <Stack spacing={2}>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={2}>
            <Stack direction="row" spacing={1} alignItems="center">
              {status.icon}
              <Typography variant="body1" fontWeight={600} color={`${status.color}.main`}>
                Status: {status.label}
              </Typography>
            </Stack>

            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Primary Domain
              </Typography>
              <Typography variant="body1" fontWeight={500}>
                {nginxSite.primaryDomain}
              </Typography>
            </Box>

            {nginxSite.serverNames && nginxSite.serverNames.length > 0 && (
              <Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Server Names
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  {nginxSite.serverNames.map((name) => (
                    <Chip key={name} label={name} size="small" variant="outlined" />
                  ))}
                </Stack>
              </Box>
            )}

            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Upstream
              </Typography>
              <Typography variant="body1" fontWeight={500}>
                {nginxSite.upstreamType === "container"
                  ? `Container: ${nginxSite.containerId} (Port ${nginxSite.containerPort})`
                  : nginxSite.upstreamType === "service"
                    ? `Service: ${nginxSite.upstreamTarget}`
                    : `External: ${nginxSite.upstreamTarget}`}
              </Typography>
            </Box>

            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Chip
                label={nginxSite.enableHttp ? "HTTP Enabled" : "HTTP Disabled"}
                size="small"
                color={nginxSite.enableHttp ? "success" : "default"}
              />
              <Chip
                label={nginxSite.enableHttps ? "HTTPS Enabled" : "HTTPS Disabled"}
                size="small"
                color={nginxSite.enableHttps ? "success" : "default"}
              />
              {nginxSite.forceHttps && (
                <Chip label="Force HTTPS" size="small" color="info" />
              )}
            </Stack>

            {nginxSite.configPath && (
              <Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Config Path
                </Typography>
                <Typography variant="body2" fontFamily="monospace">
                  {nginxSite.configPath}
                </Typography>
              </Box>
            )}

            {nginxSite.lastAppliedAt && (
              <Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Last Applied
                </Typography>
                <Typography variant="body2">
                  {new Date(nginxSite.lastAppliedAt).toLocaleString()}
                </Typography>
              </Box>
            )}

            {nginxSite.lastError && (
              <Box sx={{ p: 1.5, bgcolor: "error.light", borderRadius: 1 }}>
                <Typography variant="body2" color="error.dark" fontWeight={500} gutterBottom>
                  Error
                </Typography>
                <Typography variant="body2" color="error.dark">
                  {nginxSite.lastError}
                </Typography>
              </Box>
            )}

            {nginxSite.lastLog && (
              <Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Last Log
                </Typography>
                <Typography variant="body2">
                  [{nginxSite.lastLog.level}] {nginxSite.lastLog.message}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {new Date(nginxSite.lastLog.createdAt).toLocaleString()}
                </Typography>
              </Box>
            )}
          </Stack>
        </Paper>
      </Stack>
    </Box>
  );
}




