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
import { useContainers } from "@/features/docker/containers/hooks/use-containers";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";

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
  const [status, setStatus] = useState<"active" | "pending" | "error">("pending");
  
  // Routing/Target state
  const [targetType, setTargetType] = useState<"none" | "container" | "external" | "service" | "static">("none");
  const [selectedContainer, setSelectedContainer] = useState("");
  const [containerPort, setContainerPort] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [serviceHost, setServiceHost] = useState("");
  const [staticRoot, setStaticRoot] = useState("");
  
  // SSL state
  const [enableHttps, setEnableHttps] = useState(false);
  const [sslMode, setSslMode] = useState<"none" | "lets-encrypt" | "custom">("none");
  const [letsEncryptEmail, setLetsEncryptEmail] = useState("");
  const [customCertId, setCustomCertId] = useState("");
  const [forceHttps, setForceHttps] = useState(false);

  const { data: certificates = [] } = useSslCertificates();
  const { data: containers = [] } = useContainers({ refetchOnWindowFocus: false });
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
      setStatus(domain.status || "pending");
      
      // Routing/Target settings
      setTargetType(domain.target?.type || "none");
      setSelectedContainer(domain.target?.containerId || "");
      setContainerPort(domain.target?.containerPort?.toString() || "");
      setExternalUrl(domain.target?.externalUrl || "");
      setServiceHost(domain.target?.serviceHost || "");
      setStaticRoot(domain.target?.staticRoot || "");
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

      // Build target configuration based on selected type
      let targetConfig: DomainTarget;
      
      if (targetType === "container") {
        if (!selectedContainer || !containerPort) {
          setError("Please select a container and specify a port");
          setLoading(false);
          return;
        }
        targetConfig = {
          type: "container",
          containerId: selectedContainer,
          containerPort: parseInt(containerPort),
          enableHttp: true,
          enableHttps,
          forceHttps,
          sslMode: enableHttps ? sslMode : "none",
          letsEncryptEmail: enableHttps && sslMode === "lets-encrypt" ? letsEncryptEmail : undefined,
          sslCertificateId: enableHttps && sslMode === "custom" ? customCertId || null : null,
          customNginxConfig: customNginxConfig || null
        };
      } else if (targetType === "external") {
        if (!externalUrl.trim()) {
          setError("Please enter an external URL");
          setLoading(false);
          return;
        }
        let normalizedUrl = externalUrl.trim();
        if (!normalizedUrl.match(/^https?:\/\//i)) {
          normalizedUrl = `http://${normalizedUrl}`;
        }
        targetConfig = {
          type: "external",
          externalUrl: normalizedUrl,
          enableHttp: true,
          enableHttps,
          forceHttps,
          sslMode: enableHttps ? sslMode : "none",
          letsEncryptEmail: enableHttps && sslMode === "lets-encrypt" ? letsEncryptEmail : undefined,
          sslCertificateId: enableHttps && sslMode === "custom" ? customCertId || null : null,
          customNginxConfig: customNginxConfig || null
        };
      } else if (targetType === "service") {
        if (!serviceHost.trim()) {
          setError("Please enter a service host");
          setLoading(false);
          return;
        }
        targetConfig = {
          type: "service",
          serviceHost: serviceHost.trim(),
          enableHttp: true,
          enableHttps,
          forceHttps,
          sslMode: enableHttps ? sslMode : "none",
          letsEncryptEmail: enableHttps && sslMode === "lets-encrypt" ? letsEncryptEmail : undefined,
          sslCertificateId: enableHttps && sslMode === "custom" ? customCertId || null : null,
          customNginxConfig: customNginxConfig || null
        };
      } else if (targetType === "static") {
        if (!staticRoot.trim()) {
          setError("Please enter a static root directory");
          setLoading(false);
          return;
        }
        targetConfig = {
          type: "static",
          staticRoot: staticRoot.trim(),
          enableHttp: true,
          enableHttps,
          forceHttps,
          sslMode: enableHttps ? sslMode : "none",
          letsEncryptEmail: enableHttps && sslMode === "lets-encrypt" ? letsEncryptEmail : undefined,
          sslCertificateId: enableHttps && sslMode === "custom" ? customCertId || null : null,
          customNginxConfig: customNginxConfig || null
        };
      } else {
        targetConfig = {
          type: "none",
          enableHttp: true,
          enableHttps,
          forceHttps,
          sslMode: enableHttps ? sslMode : "none",
          letsEncryptEmail: enableHttps && sslMode === "lets-encrypt" ? letsEncryptEmail : undefined,
          sslCertificateId: enableHttps && sslMode === "custom" ? customCertId || null : null,
          customNginxConfig: customNginxConfig || null
        };
      }

      const updates: DomainUpsertInput = {
        name: domain.name,
        aliases: domain.aliases ?? [],
        provider: providerPayload?.type ?? domain.provider ?? null,
        mode: mapDnsModeToDomainMode(dnsMode),
        status: status,
        notes: domain.notes,
        parentDomainId: parentDomainId ?? null,
        records: dnsMode === "proxy-only" ? [] : dnsRecords,
        target: targetConfig,
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
        <Stack spacing={3}>
          {error && (
            <Alert 
              severity="error" 
              sx={{ whiteSpace: "pre-line" }} 
              onClose={() => setError(null)}
            >
              <Typography variant="body2" component="div" sx={{ fontWeight: 500, mb: error.includes("\n") ? 1 : 0 }}>
                {error.split("\n")[0]}
              </Typography>
              {error.includes("\n") && (
                <Typography 
                  variant="body2" 
                  component="div" 
                  sx={{ 
                    mt: 1,
                    pl: 2,
                    borderLeft: "2px solid",
                    borderColor: "error.main",
                    fontFamily: "monospace",
                    fontSize: "0.875rem"
                  }}
                >
                  {error.split("\n").slice(1).join("\n")}
                </Typography>
              )}
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

          {/* Routing Configuration */}
          <Box>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
              Routing Configuration
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Configure where traffic to this domain should be routed.
            </Typography>
            
            <FormControl component="fieldset" sx={{ mb: 2 }}>
              <RadioGroup
                value={targetType}
                onChange={(e) => setTargetType(e.target.value as any)}
              >
                <FormControlLabel
                  value="none"
                  control={<Radio />}
                  label={
                    <Box>
                      <Typography variant="body2" fontWeight={500}>
                        DNS Only
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        No routing configured
                      </Typography>
                    </Box>
                  }
                />
                <FormControlLabel
                  value="container"
                  control={<Radio />}
                  label={
                    <Box>
                      <Typography variant="body2" fontWeight={500}>
                        Docker Container
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Route to a container running on this server
                      </Typography>
                    </Box>
                  }
                />
                <FormControlLabel
                  value="external"
                  control={<Radio />}
                  label={
                    <Box>
                      <Typography variant="body2" fontWeight={500}>
                        External URL
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Forward traffic to an external website
                      </Typography>
                    </Box>
                  }
                />
                <FormControlLabel
                  value="service"
                  control={<Radio />}
                  label={
                    <Box>
                      <Typography variant="body2" fontWeight={500}>
                        Internal Service
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Route to an internal service host
                      </Typography>
                    </Box>
                  }
                />
                <FormControlLabel
                  value="static"
                  control={<Radio />}
                  label={
                    <Box>
                      <Typography variant="body2" fontWeight={500}>
                        Static Files
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Serve static files from a directory
                      </Typography>
                    </Box>
                  }
                />
              </RadioGroup>
            </FormControl>

            {targetType === "container" && (
              <Stack spacing={2} sx={{ mt: 2 }}>
                <FormControl fullWidth>
                  <InputLabel>Container</InputLabel>
                  <Select
                    label="Container"
                    value={selectedContainer}
                    onChange={(e) => setSelectedContainer(e.target.value)}
                  >
                    {containers.map((container) => (
                      <MenuItem key={container.id} value={container.id}>
                        {container.name} - {container.image}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  label="Container Port"
                  type="number"
                  fullWidth
                  value={containerPort}
                  onChange={(e) => setContainerPort(e.target.value)}
                  helperText="Port number the container is listening on"
                />
              </Stack>
            )}

            {targetType === "external" && (
              <TextField
                label="External URL"
                fullWidth
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                helperText="Full URL to forward traffic to (e.g., https://example.com)"
                sx={{ mt: 2 }}
              />
            )}

            {targetType === "service" && (
              <TextField
                label="Service Host"
                fullWidth
                value={serviceHost}
                onChange={(e) => setServiceHost(e.target.value)}
                helperText="Internal service hostname (e.g., service:8080)"
                sx={{ mt: 2 }}
              />
            )}

            {targetType === "static" && (
              <TextField
                label="Static Root Directory"
                fullWidth
                value={staticRoot}
                onChange={(e) => setStaticRoot(e.target.value)}
                helperText="Path to static files directory (e.g., /var/www/html)"
                sx={{ mt: 2 }}
              />
            )}
          </Box>

          <Divider />

          {/* Domain Status */}
          <Box>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
              Domain Status
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Set the status of this domain. Active domains are fully configured and working.
            </Typography>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                label="Status"
                value={status}
                onChange={(e) => setStatus(e.target.value as "active" | "pending" | "error")}
              >
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="error">Error</MenuItem>
              </Select>
            </FormControl>
          </Box>

          <Divider />

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
              Advanced Configuration
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Custom nginx directives for advanced routing, caching, or header behaviors.
            </Typography>
            <TextField
              label="Custom Nginx Configuration"
              multiline
              minRows={4}
              fullWidth
              value={customNginxConfig}
              onChange={(event) => setCustomNginxConfig(event.target.value)}
              placeholder="location /health { return 200 'ok'; }"
            />
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
