"use client";

import {
  Box,
  Button,
  Chip,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
  Stack,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import PendingIcon from "@mui/icons-material/Pending";
import DraftsIcon from "@mui/icons-material/Drafts";
import LockIcon from "@mui/icons-material/Lock";
import StorageIcon from "@mui/icons-material/Storage";
import PublicIcon from "@mui/icons-material/Public";
import moment from "moment";
import type { NginxSite } from "@/types/server";

interface NginxSitesTableProps {
  sites: NginxSite[];
  onEdit: (site: NginxSite) => void;
  onDelete: (site: NginxSite) => void;
  onDeploy: (site: NginxSite) => void;
  isDeploying?: string | null;
}

export default function NginxSitesTable({
  sites,
  onEdit,
  onDelete,
  onDeploy,
  isDeploying,
}: NginxSitesTableProps) {
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
        return <StorageIcon fontSize="small" />;
      case "external":
      case "service":
        return <PublicIcon fontSize="small" />;
      default:
        return null;
    }
  };

  const getUpstreamDisplay = (site: NginxSite) => {
    switch (site.upstreamType) {
      case "container":
        return `Container: ${site.containerId?.substring(0, 12)}${site.containerPort ? `:${site.containerPort}` : ""}`;
      case "external":
      case "service":
        return `${site.upstreamType}: ${site.upstreamTarget}`;
      default:
        return site.upstreamTarget;
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
    <TableContainer component={Paper} variant="outlined">
      <Table>
        <TableHead>
          <TableRow>
            <TableCell width="25%">
              <Typography variant="subtitle2" fontWeight={600}>
                Domain
              </Typography>
            </TableCell>
            <TableCell width="20%">
              <Typography variant="subtitle2" fontWeight={600}>
                Upstream
              </Typography>
            </TableCell>
            <TableCell width="15%">
              <Typography variant="subtitle2" fontWeight={600}>
                Status
              </Typography>
            </TableCell>
            <TableCell width="15%">
              <Typography variant="subtitle2" fontWeight={600}>
                Security
              </Typography>
            </TableCell>
            <TableCell width="15%">
              <Typography variant="subtitle2" fontWeight={600}>
                Last Updated
              </Typography>
            </TableCell>
            <TableCell width="10%" align="right">
              <Typography variant="subtitle2" fontWeight={600}>
                Actions
              </Typography>
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {sites.map((site) => {
            const status = getStatusConfig(site.status);
            return (
              <TableRow
                key={site.id}
                hover
                sx={{
                  "&:hover": {
                    bgcolor: "action.hover",
                  },
                }}
              >
                {/* Domain */}
                <TableCell>
                  <Stack spacing={0.5}>
                    <Typography variant="body2" fontWeight={500}>
                      {site.primaryDomain}
                    </Typography>
                    {site.serverNames.length > 1 && (
                      <Typography variant="caption" color="text.secondary">
                        +{site.serverNames.length - 1} alias
                        {site.serverNames.length > 2 ? "es" : ""}
                      </Typography>
                    )}
                  </Stack>
                </TableCell>

                {/* Upstream */}
                <TableCell>
                  <Stack direction="row" spacing={1} alignItems="center">
                    {getUpstreamIcon(site.upstreamType)}
                    <Typography variant="body2" fontSize="0.875rem">
                      {getUpstreamDisplay(site)}
                    </Typography>
                  </Stack>
                </TableCell>

                {/* Status */}
                <TableCell>
                  <Chip
                    label={status.label}
                    size="small"
                    color={status.color}
                    icon={status.icon}
                  />
                </TableCell>

                {/* Security */}
                <TableCell>
                  <Stack direction="row" spacing={0.5}>
                    {site.enableHttps && (
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
                </TableCell>

                {/* Last Updated */}
                <TableCell>
                  <Tooltip title={moment(site.updatedAt).format("MMM D, YYYY h:mm A")}>
                    <Typography variant="caption" color="text.secondary">
                      {moment(site.updatedAt).fromNow()}
                    </Typography>
                  </Tooltip>
                </TableCell>

                {/* Actions */}
                <TableCell align="right">
                  <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                    <Tooltip title="Open in Browser">
                      <IconButton
                        size="small"
                        onClick={() => window.open(`https://${site.primaryDomain}`, "_blank")}
                      >
                        <OpenInNewIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Deploy">
                      <span>
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => onDeploy(site)}
                          disabled={isDeploying === site.id}
                        >
                          <PlayArrowIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => onEdit(site)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => onDelete(site)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

