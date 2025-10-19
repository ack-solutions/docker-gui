"use client";

import {
  Box,
  Card,
  CardContent,
  Chip,
  IconButton,
  Stack,
  Typography,
  Tooltip,
  Button,
} from "@mui/material";
import LanguageIcon from "@mui/icons-material/Language";
import LockIcon from "@mui/icons-material/Lock";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import PendingIcon from "@mui/icons-material/Pending";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import DnsIcon from "@mui/icons-material/Dns";
import StorageIcon from "@mui/icons-material/Storage";
import PublicIcon from "@mui/icons-material/Public";
import type { Domain } from "@/types/server";

interface DomainCardProps {
  domain: Domain;
  onEdit: () => void;
  onDelete: () => void;
  onClick?: () => void;
}

export default function DomainCard({ domain, onEdit, onDelete, onClick }: DomainCardProps) {

  const getStatusConfig = () => {
    switch (domain.status) {
      case "active":
        return { icon: <CheckCircleIcon />, color: "success" as const, label: "Active" };
      case "pending":
        return { icon: <PendingIcon />, color: "warning" as const, label: "Pending" };
      case "error":
        return { icon: <ErrorIcon />, color: "error" as const, label: "Error" };
      default:
        return { icon: null, color: "default" as const, label: "Unknown" };
    }
  };

  const getTargetInfo = () => {
    if (!domain.target || domain.target.type === "none") {
      return { icon: <DnsIcon />, text: "DNS Only", subtitle: "No proxy configured" };
    }

    switch (domain.target.type) {
      case "container":
        return {
          icon: <StorageIcon />,
          text: "Docker Container",
          subtitle: `Port ${domain.target.containerPort || "N/A"}`,
        };
      case "external":
        return {
          icon: <PublicIcon />,
          text: "External URL",
          subtitle: domain.target.externalUrl || "",
        };
      case "service":
        return {
          icon: <PublicIcon />,
          text: "Internal Service",
          subtitle: domain.target.serviceHost || "",
        };
      default:
        return { icon: <DnsIcon />, text: "Configured", subtitle: "" };
    }
  };

  const status = getStatusConfig();
  const target = getTargetInfo();
  const hasSSL = domain.target?.enableHttps || false;

  return (
    <>
      <Card
        sx={{
          height: "100%",
          transition: "all 0.2s",
          cursor: onClick ? "pointer" : "default",
          "&:hover": {
            boxShadow: 4,
            transform: onClick ? "translateY(-2px)" : "none",
          },
        }}
        onClick={onClick}
      >
        <CardContent>
          <Stack spacing={2.5}>
            {/* Header */}
            <Stack direction="row" spacing={1.5} alignItems="center">
              <LanguageIcon color="primary" fontSize="large" />
              <Box flex={1}>
                <Typography variant="h6" fontSize="1.1rem" fontWeight={600}>
                  {domain.name}
                </Typography>
                {domain.aliases && domain.aliases.length > 0 && (
                  <Typography variant="caption" color="text.secondary">
                    +{domain.aliases.length} alias{domain.aliases.length > 1 ? "es" : ""}
                  </Typography>
                )}
              </Box>
            </Stack>

            {/* Status */}
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
                  icon={<LockIcon />}
                  variant="outlined"
                />
              )}
              {domain.mode === "external-dns" && (
                <Chip
                  label="External DNS"
                  size="small"
                  variant="outlined"
                />
              )}
            </Stack>

            {/* Target Info */}
            <Box
              sx={{
                p: 2,
                bgcolor: "action.hover",
                borderRadius: 1,
              }}
            >
              <Stack direction="row" spacing={1.5} alignItems="center">
                {target.icon}
                <Box>
                  <Typography variant="body2" fontWeight={500}>
                    {target.text}
                  </Typography>
                  {target.subtitle && (
                    <Typography variant="caption" color="text.secondary">
                      {target.subtitle}
                    </Typography>
                  )}
                </Box>
              </Stack>
            </Box>

            {/* DNS Records Count */}
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="caption" color="text.secondary">
                {domain.records?.length || 0} DNS Record{domain.records?.length !== 1 ? "s" : ""}
              </Typography>
              {domain.provider && (
                <Chip label={domain.provider} size="small" variant="outlined" />
              )}
            </Stack>

            {/* Error Message */}
            {domain.lastError && (
              <Box
                sx={{
                  p: 1.5,
                  bgcolor: "error.lighter",
                  borderRadius: 1,
                  border: "1px solid",
                  borderColor: "error.main",
                }}
              >
                <Typography variant="caption" color="error.main">
                  {domain.lastError}
                </Typography>
              </Box>
            )}

            {/* Actions */}
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button
                size="small"
                startIcon={<OpenInNewIcon fontSize="small" />}
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(`https://${domain.name}`, "_blank");
                }}
                sx={{ minWidth: 80 }}
              >
                Open
              </Button>
              <Button
                size="small"
                variant="outlined"
                color="primary"
                startIcon={<EditIcon fontSize="small" />}
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                sx={{ minWidth: 80 }}
              >
                Edit
              </Button>
              <Button
                size="small"
                variant="outlined"
                color="error"
                startIcon={<DeleteIcon fontSize="small" />}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                sx={{ minWidth: 90 }}
              >
                Delete
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </>
  );
}

