"use client";

import {
  Box,
  Chip,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import PendingIcon from "@mui/icons-material/Pending";
import LockIcon from "@mui/icons-material/Lock";
import StorageIcon from "@mui/icons-material/Storage";
import PublicIcon from "@mui/icons-material/Public";
import DnsIcon from "@mui/icons-material/Dns";
import moment from "moment";
import type { Domain } from "@/types/server";

interface DomainsTableViewProps {
  domains: Domain[];
  onEdit: (domain: Domain) => void;
  onDelete: (domain: Domain) => void;
}

export default function DomainsTableView({
  domains,
  onEdit,
  onDelete,
}: DomainsTableViewProps) {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case "active":
        return { icon: <CheckCircleIcon fontSize="small" />, color: "success" as const, label: "Active" };
      case "pending":
        return { icon: <PendingIcon fontSize="small" />, color: "warning" as const, label: "Pending" };
      case "error":
        return { icon: <ErrorIcon fontSize="small" />, color: "error" as const, label: "Error" };
      default:
        return { icon: null, color: "default" as const, label: status };
    }
  };

  const getTargetDisplay = (domain: Domain) => {
    if (!domain.target || domain.target.type === "none") {
      return { icon: <DnsIcon fontSize="small" />, text: "DNS Only" };
    }

    switch (domain.target.type) {
      case "container":
        return {
          icon: <StorageIcon fontSize="small" />,
          text: `Container:${domain.target.containerPort || "?"}`,
        };
      case "external":
        return {
          icon: <PublicIcon fontSize="small" />,
          text: "External URL",
        };
      case "service":
        return {
          icon: <PublicIcon fontSize="small" />,
          text: "Service",
        };
      default:
        return { icon: <DnsIcon fontSize="small" />, text: "N/A" };
    }
  };

  if (domains.length === 0) {
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
          No domains found
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Try a different search term or add a new domain
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
            <TableCell width="15%">
              <Typography variant="subtitle2" fontWeight={600}>
                Target
              </Typography>
            </TableCell>
            <TableCell width="12%">
              <Typography variant="subtitle2" fontWeight={600}>
                Status
              </Typography>
            </TableCell>
            <TableCell width="12%">
              <Typography variant="subtitle2" fontWeight={600}>
                Security
              </Typography>
            </TableCell>
            <TableCell width="10%">
              <Typography variant="subtitle2" fontWeight={600}>
                DNS Records
              </Typography>
            </TableCell>
            <TableCell width="15%">
              <Typography variant="subtitle2" fontWeight={600}>
                Updated
              </Typography>
            </TableCell>
            <TableCell width="11%" align="right">
              <Typography variant="subtitle2" fontWeight={600}>
                Actions
              </Typography>
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {domains.map((domain) => {
            const status = getStatusConfig(domain.status);
            const target = getTargetDisplay(domain);
            const hasSSL = domain.target?.enableHttps || false;

            return (
              <TableRow
                key={domain.id}
                hover
                sx={{
                  cursor: "pointer",
                  "&:hover": {
                    bgcolor: "action.hover",
                  },
                }}
                onClick={() => onEdit(domain)}
              >
                {/* Domain */}
                <TableCell>
                  <Stack spacing={0.5}>
                    <Typography variant="body2" fontWeight={500}>
                      {domain.name}
                    </Typography>
                    {domain.aliases && domain.aliases.length > 0 && (
                      <Typography variant="caption" color="text.secondary">
                        +{domain.aliases.length} alias{domain.aliases.length > 1 ? "es" : ""}
                      </Typography>
                    )}
                  </Stack>
                </TableCell>

                {/* Target */}
                <TableCell>
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    {target.icon}
                    <Typography variant="caption">{target.text}</Typography>
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
                  {hasSSL && (
                    <Chip
                      label="HTTPS"
                      size="small"
                      color="success"
                      variant="outlined"
                      icon={<LockIcon />}
                    />
                  )}
                </TableCell>

                {/* DNS Records */}
                <TableCell>
                  <Typography variant="body2">
                    {domain.records?.length || 0}
                  </Typography>
                </TableCell>

                {/* Updated */}
                <TableCell>
                  <Tooltip title={moment(domain.updatedAt).format("MMM D, YYYY h:mm A")}>
                    <Typography variant="caption" color="text.secondary">
                      {moment(domain.updatedAt).fromNow()}
                    </Typography>
                  </Tooltip>
                </TableCell>

                {/* Actions */}
                <TableCell align="right">
                  <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                    <Tooltip title="Open in browser">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(`https://${domain.name}`, "_blank");
                        }}
                      >
                        <OpenInNewIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Edit">
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(domain);
                        }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(domain);
                        }}
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

