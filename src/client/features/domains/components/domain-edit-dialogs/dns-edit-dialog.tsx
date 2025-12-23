"use client";

import { useState, useEffect } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
  CircularProgress,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import SaveIcon from "@mui/icons-material/Save";
import type { Domain as DomainModel, DomainUpsertInput, DomainDnsRecord } from "@/types/server";
import DnsModeSelector, { type DnsMode } from "../dns-mode-selector";
import DnsSetupInstructions from "../dns-setup-instructions";
import ThirdPartyDnsSetup from "../third-party-dns-setup";
import DnsRecordsManager from "../dns-records-manager";

// Type matching DnsRecordsManager's DnsRecord interface
interface DnsRecord {
  id?: string;
  type: DomainDnsRecord["type"];
  host: string;
  value: string;
  ttl: number;
  priority?: number | null;
}

interface DnsEditDialogProps {
  open: boolean;
  domain: DomainModel;
  allDomains: DomainModel[];
  onClose: () => void;
  onSave: (updates: Partial<DomainUpsertInput>) => Promise<void>;
  isSaving: boolean;
}

const mapDomainModeToDnsMode = (mode?: DomainModel["mode"]): DnsMode => {
  switch (mode) {
    case "managed":
      return "managed";
    case "provider":
      return "third-party";
    default:
      return "proxy-only";
  }
};

const mapDnsModeToDomainMode = (mode: DnsMode): DomainModel["mode"] => {
  switch (mode) {
    case "managed":
      return "managed";
    case "third-party":
      return "provider";
    default:
      return "manual";
  }
};

const sanitizeProviderConfig = (config: any) => {
  if (!config) return undefined;
  const cloned = { ...config };
  delete cloned.provider;
  Object.keys(cloned).forEach((key) => {
    const value = cloned[key];
    if (value === "" || value === undefined || value === null) {
      delete cloned[key];
    }
  });
  return Object.keys(cloned).length ? cloned : undefined;
};

// Convert DomainDnsRecord[] to DnsRecord[] (for DnsRecordsManager)
const toDnsRecords = (records: DomainDnsRecord[]): DnsRecord[] => {
  return records.map(({ id, type, host, value, ttl, priority }) => ({
    id,
    type,
    host,
    value,
    ttl,
    priority,
  }));
};

// Convert DnsRecord[] to DomainDnsRecord[] (for state)
const toDomainDnsRecords = (records: DnsRecord[]): DomainDnsRecord[] => {
  return records.map((record, index) => ({
    id: record.id || `temp-${index}`,
    type: record.type,
    host: record.host,
    value: record.value,
    ttl: record.ttl,
    priority: record.priority ?? null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));
};

export default function DnsEditDialog({
  open,
  domain,
  allDomains,
  onClose,
  onSave,
  isSaving,
}: DnsEditDialogProps) {
  const [dnsMode, setDnsMode] = useState<DnsMode>(mapDomainModeToDnsMode(domain.mode));
  const [dnsRecords, setDnsRecords] = useState(domain.records || []);
  const [thirdPartyConfig, setThirdPartyConfig] = useState<any>(
    domain.mode === "provider" && domain.dnsProvider?.type
      ? { provider: domain.dnsProvider.type }
      : { provider: "none" }
  );
  const [error, setError] = useState<string | null>(null);

  const providerConfigured = domain.dnsProvider?.configured ?? false;

  useEffect(() => {
    if (open) {
      setDnsMode(mapDomainModeToDnsMode(domain.mode));
      setDnsRecords(domain.records || []);
      setThirdPartyConfig(
        domain.mode === "provider" && domain.dnsProvider?.type
          ? { provider: domain.dnsProvider.type }
          : { provider: "none" }
      );
      setError(null);
    }
  }, [open, domain]);

  const handleSave = async () => {
    setError(null);

    if (dnsMode === "third-party" && (!thirdPartyConfig.provider || thirdPartyConfig.provider === "none")) {
      setError("Select a DNS provider to continue.");
      return;
    }

    const providerPayload =
      dnsMode === "third-party" && thirdPartyConfig.provider !== "none"
        ? {
            type: thirdPartyConfig.provider,
            config: sanitizeProviderConfig(thirdPartyConfig),
          }
        : null;

    if (dnsMode === "third-party" && providerPayload && !providerPayload.config) {
      setError("Please provide the credentials required for your DNS provider.");
      return;
    }

    const updates: Partial<DomainUpsertInput> = {
      mode: mapDnsModeToDomainMode(dnsMode),
      records: dnsMode === "proxy-only" ? [] : dnsRecords,
      dnsProvider: providerPayload ?? null,
    };

    await onSave(updates);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Edit DNS Configuration</Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3} sx={{ mt: 1, position: "relative" }}>
          {isSaving && (
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
                  Saving...
                </Typography>
              </Stack>
            </Box>
          )}

          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <DnsModeSelector selected={dnsMode} onChange={setDnsMode} />

          {dnsMode === "third-party" && (
            <ThirdPartyDnsSetup
              config={thirdPartyConfig}
              onChange={setThirdPartyConfig}
              configured={providerConfigured}
            />
          )}

          {(dnsMode === "managed" || dnsMode === "third-party") && (
            <DnsRecordsManager
              records={toDnsRecords(dnsRecords)}
              onChange={(records) => setDnsRecords(toDomainDnsRecords(records))}
              domainName={domain.name}
            />
          )}

          {dnsMode === "proxy-only" && (
            <Alert severity="info">
              <DnsSetupInstructions dnsMode={dnsMode} domainName={domain.name} />
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={isSaving}>
          Cancel
        </Button>
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? "Saving..." : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

