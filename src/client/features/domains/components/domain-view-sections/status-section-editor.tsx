"use client";

import {
  Box,
  Stack,
  Typography,
  IconButton,
  Alert,
} from "@mui/material";
import InfoIcon from "@mui/icons-material/Info";
import EditIcon from "@mui/icons-material/Edit";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import PendingIcon from "@mui/icons-material/Pending";
import ErrorIcon from "@mui/icons-material/Error";
import type { Domain as DomainModel } from "@/types/server";

interface StatusSectionEditorProps {
  domain: DomainModel;
  onEdit: () => void;
}

export default function StatusSectionEditor({
  domain,
  onEdit,
}: StatusSectionEditorProps) {

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

  const statusConfig = getStatusConfig();

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h6" fontWeight={600}>
          Domain Status
        </Typography>
        <IconButton onClick={onEdit} size="small" color="primary">
          <EditIcon />
        </IconButton>
      </Stack>

      <Stack spacing={2}>
        <Alert severity="info" icon={<InfoIcon />}>
          <Typography variant="body2" gutterBottom>
            <strong>Domain Status</strong>
          </Typography>
          <Typography variant="body2">
            Track the current state of your domain. Active means the domain is fully configured and working, Pending means setup is in progress, and Error indicates a configuration issue.
          </Typography>
        </Alert>
        <Stack direction="row" spacing={1} alignItems="center">
          {statusConfig.icon}
          <Typography variant="body1" fontWeight={500} color={`${statusConfig.color}.main`}>
            {statusConfig.label}
          </Typography>
        </Stack>
      </Stack>
    </Box>
  );
}

