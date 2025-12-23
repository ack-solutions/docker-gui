"use client";

import { useState } from "react";
import {
  Box,
  Dialog,
  DialogContent,
  IconButton,
  Stack,
  Typography,
  Divider,
  Chip,
  Paper,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import CancelIcon from "@mui/icons-material/Cancel";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import PendingIcon from "@mui/icons-material/Pending";
import ErrorIcon from "@mui/icons-material/Error";
import LanguageIcon from "@mui/icons-material/Language";
import LockIcon from "@mui/icons-material/Lock";
import DnsIcon from "@mui/icons-material/Dns";
import StorageIcon from "@mui/icons-material/Storage";
import PublicIcon from "@mui/icons-material/Public";
import type { Domain as DomainModel, DomainUpsertInput } from "@/types/server";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateDomain } from "@/features/domains/api";
import { toast } from "sonner";
import { domainQueryKeys } from "@/features/domains/hooks/use-domains";
import DnsSectionEditor from "./domain-view-sections/dns-section-editor";
import RoutingSectionEditor from "./domain-view-sections/routing-section-editor";
import SslSectionEditor from "./domain-view-sections/ssl-section-editor";
import StatusSectionEditor from "./domain-view-sections/status-section-editor";
import HierarchySectionEditor from "./domain-view-sections/hierarchy-section-editor";
import AdvancedSectionEditor from "./domain-view-sections/advanced-section-editor";

interface DomainViewDialogProps {
  open: boolean;
  domain: DomainModel | null;
  allDomains: DomainModel[];
  onClose: () => void;
}

export default function DomainViewDialog({
  open,
  domain,
  allDomains,
  onClose,
}: DomainViewDialogProps) {
  const queryClient = useQueryClient();
  const [editingSection, setEditingSection] = useState<string | null>(null);

  const updateMutation = useMutation({
    mutationFn: async (updates: DomainUpsertInput) => {
      if (!domain) throw new Error("Domain not found");
      return updateDomain(domain.id, updates);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: domainQueryKeys.all });
      toast.success("Domain updated successfully!");
      setEditingSection(null);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to update domain");
    },
  });

  const handleSectionEdit = (section: string) => {
    setEditingSection(section);
  };

  const handleSectionCancel = () => {
    setEditingSection(null);
  };

  const handleSectionSave = async (section: string, updates: Partial<DomainUpsertInput>) => {
    if (!domain) return;
    
    const fullUpdates: DomainUpsertInput = {
      name: domain.name,
      aliases: domain.aliases ?? [],
      mode: domain.mode,
      status: domain.status,
      notes: domain.notes,
      parentDomainId: domain.parentDomainId ?? null,
      records: domain.records ?? [],
      target: domain.target,
      provider: domain.provider ?? null,
      dnsProvider: domain.dnsProvider ? {
        type: domain.dnsProvider.type || "",
        config: {}
      } : null,
      ...updates,
    };

    await updateMutation.mutateAsync(fullUpdates);
  };

  const getStatusConfig = () => {
    if (!domain) return { icon: null, color: "default" as const, label: "Unknown" };
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
    if (!domain?.target || domain.target.type === "none") {
      return { icon: <DnsIcon />, text: "DNS Only", subtitle: "No routing configured" };
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

  if (!domain) return null;

  const status = getStatusConfig();
  const target = getTargetInfo();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: { minHeight: "70vh" },
      }}
    >
      {/* Header */}
      <Box sx={{ px: 3, py: 2, borderBottom: 1, borderColor: "divider" }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={2} alignItems="center">
            <LanguageIcon color="primary" fontSize="large" />
            <Box>
              <Typography variant="h5" fontWeight={600}>
                {domain.name}
              </Typography>
              {domain.aliases && domain.aliases.length > 0 && (
                <Typography variant="body2" color="text.secondary">
                  Aliases: {domain.aliases.join(", ")}
                </Typography>
              )}
            </Box>
          </Stack>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Stack>
      </Box>

      <DialogContent dividers sx={{ p: 0 }}>
        <Stack spacing={0}>
          {/* Overview Section */}
          <Paper sx={{ p: 3, bgcolor: "background.default" }}>
            <Stack direction="row" spacing={2} flexWrap="wrap" alignItems="center">
              <Chip
                label={status.label}
                size="medium"
                color={status.color}
                icon={status.icon}
              />
              {domain.target?.enableHttps && (
                <Chip
                  label="HTTPS Enabled"
                  size="medium"
                  color="success"
                  icon={<LockIcon />}
                />
              )}
              <Chip
                label={domain.mode === "managed" ? "Managed DNS" : domain.mode === "provider" ? "Provider API" : "Manual DNS"}
                size="medium"
                variant="outlined"
              />
            </Stack>
            <Box sx={{ mt: 2, p: 2, bgcolor: "action.hover", borderRadius: 1 }}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                {target.icon}
                <Box>
                  <Typography variant="body1" fontWeight={500}>
                    {target.text}
                  </Typography>
                  {target.subtitle && (
                    <Typography variant="body2" color="text.secondary">
                      {target.subtitle}
                    </Typography>
                  )}
                </Box>
              </Stack>
            </Box>
          </Paper>

          <Divider />

          {/* DNS Section */}
          <DnsSectionEditor
            domain={domain}
            allDomains={allDomains}
            onEdit={() => handleSectionEdit("dns")}
            onSave={(updates) => handleSectionSave("dns", updates)}
            isSaving={updateMutation.isPending}
          />

          <Divider />

          {/* Routing Section */}
          <RoutingSectionEditor
            domain={domain}
            onEdit={() => handleSectionEdit("routing")}
          />

          <Divider />

          {/* SSL Section */}
          <SslSectionEditor
            domain={domain}
            onEdit={() => handleSectionEdit("ssl")}
          />

          <Divider />

          {/* Status Section */}
          <StatusSectionEditor
            domain={domain}
            onEdit={() => handleSectionEdit("status")}
          />

          <Divider />

          {/* Hierarchy Section */}
          <HierarchySectionEditor
            domain={domain}
            allDomains={allDomains}
            onEdit={() => handleSectionEdit("hierarchy")}
          />

          <Divider />

          {/* Advanced Section */}
          <AdvancedSectionEditor
            domain={domain}
            onEdit={() => handleSectionEdit("advanced")}
          />
        </Stack>
      </DialogContent>
    </Dialog>
  );
}

