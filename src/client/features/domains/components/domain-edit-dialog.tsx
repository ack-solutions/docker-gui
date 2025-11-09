"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import SaveIcon from "@mui/icons-material/Save";
import InfoIcon from "@mui/icons-material/Info";
import DnsModeSelector, { type DnsMode } from "./dns-mode-selector";
import type { Domain as DomainModel, DomainTarget, DomainUpsertInput } from "@/types/server";
import DnsSetupInstructions from "./dns-setup-instructions";
import ThirdPartyDnsSetup from "./third-party-dns-setup";
import DnsRecordsManager from "./dns-records-manager";
import SslConfiguration from "./ssl-configuration";
import { useSslCertificates } from "@/features/ssl/hooks/use-ssl-certificates";

interface DomainEditDialogProps {
  open: boolean;
  domain: DomainModel | null;
  allDomains: DomainModel[];
  onClose: () => void;
  onSubmit: (updates: DomainUpsertInput) => Promise<void>;
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
  if (!config) {
    return undefined;
  }

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

export default function DomainEditDialog({
  open,
  domain,
  allDomains,
  onClose,
  onSubmit
}: DomainEditDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [dnsMode, setDnsMode] = useState<DnsMode>("proxy-only");
  const [dnsModeChanged, setDnsModeChanged] = useState(false);
  const [thirdPartyConfig, setThirdPartyConfig] = useState<any>({ provider: "none" });
  const [dnsRecords, setDnsRecords] = useState<any[]>([]);
  const [parentDomainId, setParentDomainId] = useState<string | null>(null);
  const [customNginxConfig, setCustomNginxConfig] = useState("");
  
  // SSL state
  const [enableHttps, setEnableHttps] = useState(false);
  const [sslMode, setSslMode] = useState<"none" | "lets-encrypt" | "custom">("none");
  const [letsEncryptEmail, setLetsEncryptEmail] = useState("");
  const [customCertId, setCustomCertId] = useState("");
  const [forceHttps, setForceHttps] = useState(false);

  const { data: certificates = [] } = useSslCertificates();
  const originalDnsMode = useMemo(
    () => (domain ? mapDomainModeToDnsMode(domain.mode) : "proxy-only"),
    [domain]
  );
  const parentOptions = useMemo(
    () => allDomains.filter((candidate) => (domain ? candidate.id !== domain.id : true)),
    [allDomains, domain]
  );
  const providerConfigured = domain?.dnsProvider?.configured ?? false;

  // Initialize form when domain changes
  useEffect(() => {
    if (domain) {
      const initialMode = mapDomainModeToDnsMode(domain.mode);
      setDnsMode(initialMode);
      setDnsModeChanged(false);
      setDnsRecords(domain.records || []);
      setParentDomainId(domain.parentDomainId ?? null);
      setThirdPartyConfig(
        domain.mode === "provider" && domain.dnsProvider?.type
          ? { provider: domain.dnsProvider.type }
          : { provider: "none" }
      );
      
      // SSL settings
      setEnableHttps(domain.target?.enableHttps ?? false);
      setSslMode((domain.target?.sslMode as any) || "none");
      setLetsEncryptEmail(domain.target?.letsEncryptEmail || "");
      setCustomCertId(domain.target?.sslCertificateId || "");
      setForceHttps(domain.target?.forceHttps ?? false);
      setCustomNginxConfig(domain.target?.customNginxConfig ?? "");
    }
  }, [domain]);

  const handleDnsModeChange = (newMode: DnsMode) => {
    setDnsMode(newMode);
    setDnsModeChanged(newMode !== originalDnsMode);
  };

  const handleSave = async () => {
    if (!domain) return;

    try {
      setLoading(true);
      setError(null);

      if (dnsMode === "third-party" && (!thirdPartyConfig.provider || thirdPartyConfig.provider === "none")) {
        setError("Select a DNS provider to continue.");
        setLoading(false);
        return;
      }

      const providerPayload =
        dnsMode === "third-party" && thirdPartyConfig.provider !== "none"
          ? {
              type: thirdPartyConfig.provider,
              config: sanitizeProviderConfig(thirdPartyConfig)
            }
          : null;

      if (dnsMode === "third-party" && providerPayload && !providerPayload.config) {
        setError("Please provide the credentials required for your DNS provider.");
        setLoading(false);
        return;
      }

      const baseTarget =
        domain.target ??
        ({
          type: "none",
          enableHttp: true,
          enableHttps: false,
          forceHttps: false,
          sslMode: "none"
        } as DomainTarget);

      const updates: DomainUpsertInput = {
        name: domain.name,
        aliases: domain.aliases ?? [],
        provider: providerPayload?.type ?? domain.provider ?? null,
        mode: mapDnsModeToDomainMode(dnsMode),
        status: domain.status,
        notes: domain.notes,
        parentDomainId: parentDomainId ?? null,
        records: dnsMode === "proxy-only" ? [] : dnsRecords,
        target: {
          ...baseTarget,
          enableHttps,
          forceHttps,
          sslMode: enableHttps ? sslMode : "none",
          letsEncryptEmail: enableHttps && sslMode === "lets-encrypt" ? letsEncryptEmail : undefined,
          sslCertificateId: enableHttps && sslMode === "custom" ? customCertId || baseTarget.sslCertificateId || null : null,
          customNginxConfig: customNginxConfig || null
        },
        dnsProvider: providerPayload ?? null
      };

      await onSubmit(updates);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update domain");
    } finally {
      setLoading(false);
    }
  };

  if (!domain) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { minHeight: "60vh" },
      }}
    >
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Edit Domain: {domain.name}</Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={4}>
          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {/* DNS Management Mode */}
          <Box>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
              DNS Management
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Choose how you want to manage DNS for this domain
            </Typography>

            <DnsModeSelector selected={dnsMode} onChange={handleDnsModeChange} />

            {dnsModeChanged && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  <strong>DNS mode changed!</strong> Make sure to update your DNS configuration
                  accordingly.
                </Typography>
              </Alert>
            )}

            {/* Show instructions when DNS mode changes */}
            {dnsModeChanged && (dnsMode === "managed" || dnsMode === "proxy-only") && (
              <Box sx={{ mt: 2 }}>
                <DnsSetupInstructions dnsMode={dnsMode} domainName={domain.name} />
              </Box>
            )}

            {/* Third-party provider setup */}
            {dnsMode === "third-party" && (
              <Box sx={{ mt: 2 }}>
                {providerConfigured && !dnsModeChanged ? (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    Existing provider credentials are stored securely. Re-enter values if you need to rotate keys.
                  </Alert>
                ) : null}
                <ThirdPartyDnsSetup
                  config={thirdPartyConfig}
                  onChange={setThirdPartyConfig}
                  configured={providerConfigured && !dnsModeChanged}
                />
              </Box>
            )}

            {/* DNS Records manager */}
            {(dnsMode === "managed" || dnsMode === "third-party") && (
              <Box sx={{ mt: 2 }}>
                {dnsMode === "third-party" && (
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                    These records will be synchronized with your external DNS provider.
                  </Typography>
                )}
                <DnsRecordsManager
                  records={dnsRecords}
                  onChange={setDnsRecords}
                  domainName={domain.name}
                />
              </Box>
            )}
          </Box>

          <Divider />

          <Box>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
              Domain Hierarchy
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Optionally attach this entry to a parent zone when configuring delegated subdomains.
            </Typography>
            <FormControl fullWidth>
              <InputLabel>Parent Domain</InputLabel>
              <Select
                label="Parent Domain"
                value={parentDomainId ?? ""}
                onChange={(event) => {
                  const value = event.target.value;
                  setParentDomainId(value ? String(value) : null);
                }}
              >
                <MenuItem value="">
                  <em>No parent (root domain)</em>
                </MenuItem>
                {parentOptions.map((option) => (
                  <MenuItem key={option.id} value={option.id}>
                    {option.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          <Divider />

          <Box>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
              Advanced Proxy Configuration
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Inject custom nginx directives into the generated server block to enable complex routing,
              caching, rewrite, or header behaviors.
            </Typography>
            <TextField
              label="Additional nginx configuration"
              multiline
              minRows={4}
              value={customNginxConfig}
              onChange={(event) => setCustomNginxConfig(event.target.value)}
              placeholder="location /health { return 200 'ok'; }"
            />
          </Box>

          {/* SSL/TLS Configuration */}
          <SslConfiguration
            domainName={domain.name}
            enableHttps={enableHttps}
            sslMode={sslMode}
            letsEncryptEmail={letsEncryptEmail}
            certificateId={customCertId}
            forceHttps={forceHttps}
            onEnableHttpsChange={setEnableHttps}
            onSslModeChange={setSslMode}
            onLetsEncryptEmailChange={setLetsEncryptEmail}
            onCertificateIdChange={setCustomCertId}
            onForceHttpsChange={setForceHttps}
            availableCertificates={certificates}
          />

          {/* Current Configuration Summary */}
          <Box sx={{ p: 2, bgcolor: "action.hover", borderRadius: 1 }}>
            <Typography variant="subtitle2" fontWeight={600} gutterBottom>
              Current Configuration
            </Typography>
            <Stack spacing={1}>
              <Stack direction="row" spacing={2}>
                <Typography variant="caption" color="text.secondary" sx={{ minWidth: 120 }}>
                  Domain:
                </Typography>
                <Typography variant="caption" fontFamily="monospace">
                  {domain.name}
                </Typography>
              </Stack>
              <Stack direction="row" spacing={2}>
                <Typography variant="caption" color="text.secondary" sx={{ minWidth: 120 }}>
                  DNS Mode:
                </Typography>
                <Typography variant="caption" fontFamily="monospace">
                  {dnsMode}
                  {dnsModeChanged && (
                    <Typography component="span" variant="caption" color="warning.main">
                      {" "}
                      (changed)
                    </Typography>
                  )}
                </Typography>
              </Stack>
              <Stack direction="row" spacing={2}>
                <Typography variant="caption" color="text.secondary" sx={{ minWidth: 120 }}>
                  HTTPS:
                </Typography>
                <Typography variant="caption" fontFamily="monospace">
                  {enableHttps ? `Enabled (${sslMode})` : "Disabled"}
                </Typography>
              </Stack>
              <Stack direction="row" spacing={2}>
                <Typography variant="caption" color="text.secondary" sx={{ minWidth: 120 }}>
                  Status:
                </Typography>
                <Typography variant="caption" fontFamily="monospace">
                  {domain.status}
                </Typography>
              </Stack>
            </Stack>
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={loading}
          startIcon={loading ? null : <SaveIcon />}
        >
          {loading ? "Saving..." : "Save Changes"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
