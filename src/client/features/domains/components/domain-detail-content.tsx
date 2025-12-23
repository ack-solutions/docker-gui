"use client";

import { useState } from "react";
import {
  Box,
  Paper,
  Stack,
  Typography,
  Tabs,
  Tab,
  Chip,
  Alert,
  Divider,
  CircularProgress,
  Tooltip,
  IconButton,
} from "@mui/material";
import LanguageIcon from "@mui/icons-material/Language";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import PendingIcon from "@mui/icons-material/Pending";
import ErrorIcon from "@mui/icons-material/Error";
import LockIcon from "@mui/icons-material/Lock";
import DnsIcon from "@mui/icons-material/Dns";
import StorageIcon from "@mui/icons-material/Storage";
import PublicIcon from "@mui/icons-material/Public";
import SecurityIcon from "@mui/icons-material/Security";
import SettingsIcon from "@mui/icons-material/Settings";
import EditIcon from "@mui/icons-material/Edit";
import type { Domain as DomainModel } from "@/types/server";
import DnsSectionEditor from "./domain-view-sections/dns-section-editor";
import AliasesSectionEditor from "./domain-view-sections/aliases-section-editor";
import NginxSectionEditor from "./domain-view-sections/nginx-section-editor";
import SslCertificateSectionEditor from "./domain-view-sections/ssl-certificate-section-editor";
import DnsEditDialog from "./domain-edit-dialogs/dns-edit-dialog";
import RoutingEditDialog from "./domain-edit-dialogs/routing-edit-dialog";
import SslEditDialog from "./domain-edit-dialogs/ssl-edit-dialog";
import StatusEditDialog from "./domain-edit-dialogs/status-edit-dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateDomain } from "../api";
import { toast } from "sonner";
import { domainQueryKeys } from "../hooks/use-domains";
import type { DomainUpsertInput } from "@/types/server";

interface DomainDetailContentProps {
  domain: DomainModel;
  allDomains: DomainModel[];
  activeTab: number;
  onTabChange: (tab: number) => void;
}

export default function DomainDetailContent({
  domain,
  allDomains,
  activeTab,
  onTabChange,
}: DomainDetailContentProps) {
  const queryClient = useQueryClient();
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState<string | null>(null);

  const updateMutation = useMutation({
    mutationFn: async (updates: DomainUpsertInput) => {
      return updateDomain(domain.id, updates);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: domainQueryKeys.all });
      await queryClient.invalidateQueries({ queryKey: domainQueryKeys.detail(domain.id) });
      toast.success("Domain updated successfully!");
      setEditDialogOpen(null);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to update domain");
    },
  });

  const isLoading = updateMutation.isPending;

  const handleSectionEdit = (section: string) => {
    setEditDialogOpen(section);
  };

  const handleDialogClose = () => {
    setEditDialogOpen(null);
  };

  const handleSectionSave = async (updates: Partial<DomainUpsertInput>) => {
    // Ensure target is never null - provide default if missing
    const defaultTarget = {
      type: "none" as const,
      enableHttp: true,
      enableHttps: false,
      forceHttps: false,
      sslMode: "none" as const,
    };

    // Sanitize records: remove temp IDs (set to undefined) for new records
    const recordsToSave = updates.records || domain.records || [];
    const sanitizedRecords = recordsToSave.map((record) => {
      // If ID starts with "temp-", it's a new record - omit the id field
      if (record.id && typeof record.id === "string" && record.id.startsWith("temp-")) {
        const { id, createdAt, updatedAt, ...rest } = record as any;
        return rest; // Return without id, createdAt, updatedAt
      }
      // For existing records, keep the id
      return {
        id: record.id,
        type: record.type,
        host: record.host,
        value: record.value,
        ttl: record.ttl,
        priority: record.priority ?? null,
      };
    });

    const fullUpdates: DomainUpsertInput = {
      name: domain.name,
      aliases: domain.aliases ?? [],
      mode: domain.mode,
      status: domain.status,
      notes: domain.notes,
      parentDomainId: domain.parentDomainId ?? null,
      provider: domain.provider ?? null,
      dnsProvider: domain.dnsProvider
        ? {
            type: domain.dnsProvider.type || "",
            config: {},
          }
        : null,
      ...updates,
      // Override with sanitized records and target
      records: sanitizedRecords,
      target: updates.target || domain.target || defaultTarget,
    };

    await updateMutation.mutateAsync(fullUpdates);
  };

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

  const status = getStatusConfig();
  const target = getTargetInfo();

  return (
    <Stack spacing={3}>
      {/* Header Card with Status and Quick Info */}
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Stack direction="row" spacing={2} alignItems="flex-start" justifyContent="space-between">
            <Stack direction="row" spacing={2} alignItems="center" flex={1}>
              <LanguageIcon color="primary" sx={{ fontSize: 40 }} />
              <Box flex={1}>
                <Typography variant="h4" fontWeight={600}>
                  {domain.name}
                </Typography>
                {domain.aliases && domain.aliases.length > 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    Aliases: {domain.aliases.join(", ")}
                  </Typography>
                )}
              </Box>
            </Stack>
          </Stack>

          {/* Status and Quick Info Row */}
          <Stack direction="row" spacing={2} flexWrap="wrap" alignItems="center">
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Chip
                label={status.label}
                size="medium"
                color={status.color}
                icon={status.icon}
              />
              <Tooltip title="Edit Status">
                <IconButton
                  size="small"
                  onClick={() => handleSectionEdit("status")}
                  sx={{ ml: -0.5 }}
                >
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
            {domain.target?.enableHttps && (
              <Chip
                label={
                  domain.target.sslMode === "lets-encrypt"
                    ? "HTTPS (Let's Encrypt)"
                    : domain.target.sslMode === "custom"
                      ? "HTTPS (Custom)"
                      : "HTTPS Enabled"
                }
                size="medium"
                color="success"
                icon={<LockIcon />}
              />
            )}
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Chip
                label={
                  domain.mode === "managed"
                    ? "Managed DNS"
                    : domain.mode === "provider"
                      ? "Provider API"
                      : "Manual DNS"
                }
                size="medium"
                variant="outlined"
              />
              <Tooltip title="Edit DNS Mode">
                <IconButton
                  size="small"
                  onClick={() => handleSectionEdit("dns")}
                  sx={{ ml: -0.5 }}
                >
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
            {domain.dnsProvider?.type && (
              <Chip
                label={`DNS: ${domain.dnsProvider.type}`}
                size="medium"
                variant="outlined"
              />
            )}
            {domain.records && domain.records.length > 0 && (
              <Chip
                label={`${domain.records.length} DNS Record${domain.records.length !== 1 ? "s" : ""}`}
                size="medium"
                variant="outlined"
              />
            )}
            {domain.aliases && domain.aliases.length > 0 && (
              <Chip
                label={`${domain.aliases.length} Alias${domain.aliases.length !== 1 ? "es" : ""}`}
                size="small"
                variant="outlined"
              />
            )}
          </Stack>

          {/* Routing Info */}
          <Box sx={{ p: 2, bgcolor: "action.hover", borderRadius: 1 }}>
            <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between">
              <Stack direction="row" spacing={1.5} alignItems="center" flex={1}>
                {target.icon}
                <Box flex={1}>
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
              <Tooltip title="Edit Routing">
                <IconButton size="small" onClick={() => handleSectionEdit("routing")}>
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          </Box>

          {domain.lastError && (
            <Alert severity="error">
              <Typography variant="body2" fontWeight={500}>
                Error
              </Typography>
              <Typography variant="body2">{domain.lastError}</Typography>
            </Alert>
          )}
        </Stack>
      </Paper>

      {/* Tabs - Consolidated Sections */}
      <Paper>
        <Tabs
          value={activeTab}
          onChange={(_, newValue) => onTabChange(newValue)}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab
            icon={<DnsIcon />}
            iconPosition="start"
            label="DNS"
            sx={{ minHeight: 64 }}
          />
          <Tab
            icon={<LanguageIcon />}
            iconPosition="start"
            label="Subdomains"
            sx={{ minHeight: 64 }}
          />
          <Tab
            icon={<DnsIcon />}
            iconPosition="start"
            label="Nginx"
            sx={{ minHeight: 64 }}
          />
          <Tab
            icon={<LockIcon />}
            iconPosition="start"
            label="Certificate"
            sx={{ minHeight: 64 }}
          />
        </Tabs>

        <Divider />

        <Box sx={{ p: 0, position: "relative", minHeight: 200 }}>
          {updateMutation.isPending && (
            <Box
              sx={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                bgcolor: "rgba(255, 255, 255, 0.8)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 10,
              }}
            >
              <Stack spacing={2} alignItems="center">
                <CircularProgress />
                <Typography variant="body2" color="text.secondary">
                  Saving changes...
                </Typography>
              </Stack>
            </Box>
          )}

          {activeTab === 0 && (
            <DnsSectionEditor
              domain={domain}
              allDomains={allDomains}
              onEdit={() => handleSectionEdit("dns")}
              onSave={handleSectionSave}
              isSaving={updateMutation.isPending}
            />
          )}

          {activeTab === 1 && (
            <AliasesSectionEditor
              domain={domain}
              onSave={handleSectionSave}
              isSaving={updateMutation.isPending}
            />
          )}

          {activeTab === 2 && (
            <NginxSectionEditor domain={domain} />
          )}

          {activeTab === 3 && (
            <SslCertificateSectionEditor
              domain={domain}
              onEditSsl={() => handleSectionEdit("ssl")}
            />
          )}
        </Box>
      </Paper>

      {/* Edit Dialogs */}
      <DnsEditDialog
        open={editDialogOpen === "dns"}
        domain={domain}
        allDomains={allDomains}
        onClose={handleDialogClose}
        onSave={handleSectionSave}
        isSaving={updateMutation.isPending}
      />

      <RoutingEditDialog
        open={editDialogOpen === "routing"}
        domain={domain}
        onClose={handleDialogClose}
        onSave={handleSectionSave}
        isSaving={updateMutation.isPending}
      />


      <StatusEditDialog
        open={editDialogOpen === "status"}
        domain={domain}
        onClose={handleDialogClose}
        onSave={handleSectionSave}
        isSaving={updateMutation.isPending}
      />

      <SslEditDialog
        open={editDialogOpen === "ssl"}
        domain={domain}
        onClose={handleDialogClose}
        onSave={handleSectionSave}
        isSaving={updateMutation.isPending}
      />
    </Stack>
  );
}

