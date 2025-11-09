"use client";

import { useMemo, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
  Alert,
  Switch,
  Collapse,
} from "@mui/material";
import LanguageIcon from "@mui/icons-material/Language";
import InfoIcon from "@mui/icons-material/Info";
import type { DockerContainer } from "@/types/docker";
import type { Domain, DomainUpsertInput } from "@/types/server";
import DnsModeSelector, { type DnsMode } from "./dns-mode-selector";
import DnsRecordsManager from "./dns-records-manager";
import ThirdPartyDnsSetup from "./third-party-dns-setup";
import DnsSetupInstructions from "./dns-setup-instructions";
import SslConfiguration from "./ssl-configuration";

interface EnhancedDomainWizardProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (domain: DomainUpsertInput) => Promise<void>;
  containers?: DockerContainer[];
  existingDomains?: Domain[];
}

interface DnsRecord {
  type: "A" | "AAAA" | "CNAME" | "TXT" | "MX" | "SRV" | "CAA" | "NS";
  host: string;
  value: string;
  ttl: number;
  priority?: number | null;
}

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

export default function EnhancedDomainWizard({
  open,
  onClose,
  onSubmit,
  containers = [],
  existingDomains = []
}: EnhancedDomainWizardProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form data
  const [domainName, setDomainName] = useState("");
  const [dnsMode, setDnsMode] = useState<DnsMode>("proxy-only");
  const [targetType, setTargetType] = useState<"none" | "container" | "external">("none");
  const [selectedContainer, setSelectedContainer] = useState("");
  const [containerPort, setContainerPort] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [enableHttps, setEnableHttps] = useState(true);
  const [sslMode, setSslMode] = useState<"none" | "lets-encrypt" | "custom">("lets-encrypt");
  const [email, setEmail] = useState("");
  const [forceHttps, setForceHttps] = useState(true);
  const [customCertId, setCustomCertId] = useState("");
  const [dnsRecords, setDnsRecords] = useState<DnsRecord[]>([]);
  const [thirdPartyConfig, setThirdPartyConfig] = useState<any>({ provider: "none" });
  const [parentDomainId, setParentDomainId] = useState<string | null>(null);
  const [customNginxConfig, setCustomNginxConfig] = useState("");
  const parentOptions = useMemo(
    () => existingDomains.filter((domain) => !domain.parentDomainId),
    [existingDomains]
  );

  const steps =
    dnsMode === "managed"
      ? ["Domain & DNS Mode", "DNS Records", "Routing", "Security"]
      : dnsMode === "third-party"
      ? ["Domain & DNS Mode", "Provider Setup", "Routing", "Security"]
      : ["Domain & DNS Mode", "Routing", "Security"];

  const resetForm = () => {
    setActiveStep(0);
    setDomainName("");
    setDnsMode("proxy-only");
    setTargetType("none");
    setSelectedContainer("");
    setContainerPort("");
    setExternalUrl("");
    setEnableHttps(true);
    setEmail("");
    setDnsRecords([]);
    setThirdPartyConfig({ provider: "none" });
    setParentDomainId(null);
    setCustomNginxConfig("");
    setError(null);
  };

  const handleNext = () => {
    if (validateStep()) {
      setActiveStep((prev) => prev + 1);
      setError(null);
    }
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
    setError(null);
  };

  const validateStep = () => {
    switch (activeStep) {
      case 0: // Domain & DNS Mode
        if (!domainName.trim()) {
          setError("Please enter a domain name");
          return false;
        }
        if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domainName)) {
          setError("Please enter a valid domain (e.g., example.com)");
          return false;
        }
        return true;

      case 1:
        // For managed DNS: validate records
        if (dnsMode === "managed") {
          if (dnsRecords.length === 0) {
            setError("Please add at least one DNS record");
            return false;
          }
          const invalidRecords = dnsRecords.filter(r => !r.host || !r.value);
          if (invalidRecords.length > 0) {
            setError("All DNS records must have a host and value");
            return false;
          }
          return true;
        }
        // For third-party: validate provider config
        if (dnsMode === "third-party") {
          if (thirdPartyConfig.provider === "none") {
            setError("Please select a DNS provider");
            return false;
          }
          if (dnsRecords.length === 0) {
            setError("Please add at least one DNS record");
            return false;
          }
          return true;
        }
        return true;

      default:
        // Routing step
        if (targetType === "container") {
          if (!selectedContainer) {
            setError("Please select a container");
            return false;
          }
          if (!containerPort) {
            setError("Please enter a container port");
            return false;
          }
        } else if (targetType === "external") {
          if (!externalUrl) {
            setError("Please enter an external URL");
            return false;
          }
        }
        
        // Security step
        if (enableHttps && !email.trim()) {
          setError("Email is required for HTTPS certificate");
          return false;
        }
        return true;
    }
  };

  const handleSubmit = async () => {
    if (!validateStep()) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Map DNS mode to domain mode
      const domainMode =
        dnsMode === "managed"
          ? "managed"
          : dnsMode === "third-party"
            ? "provider"
            : "manual";

      const payload: DomainUpsertInput = {
        name: domainName.toLowerCase().trim(),
        mode: domainMode,
        status: "pending",
        parentDomainId
      };

      // Add DNS records if in managed mode
      if (dnsMode !== "proxy-only" && dnsRecords.length > 0) {
        payload.records = dnsRecords.map((record) => ({
          type: record.type,
          host: record.host,
          value: record.value,
          ttl: record.ttl,
          priority: record.priority,
        }));
      } else {
        payload.records = [];
      }

      // Add third-party provider info if applicable
      if (dnsMode === "third-party" && thirdPartyConfig.provider !== "none") {
        payload.dnsProvider = {
          type: thirdPartyConfig.provider,
          config: sanitizeProviderConfig(thirdPartyConfig),
        };
        payload.provider = thirdPartyConfig.provider;
      }

      // Add target configuration
      if (targetType === "none") {
        payload.target = {
          type: "none",
          enableHttp: !enableHttps,
          enableHttps: enableHttps,
          forceHttps,
          sslMode: enableHttps ? "lets-encrypt" : "none",
          letsEncryptEmail: enableHttps ? email.trim() : undefined,
          customNginxConfig: customNginxConfig || null,
        };
      } else if (targetType === "container") {
        payload.target = {
          type: "container",
          containerId: selectedContainer,
          containerPort: parseInt(containerPort),
          enableHttp: true,
          enableHttps: enableHttps,
          forceHttps,
          sslMode: enableHttps ? "lets-encrypt" : "none",
          letsEncryptEmail: enableHttps ? email.trim() : undefined,
          customNginxConfig: customNginxConfig || null,
        };
      } else if (targetType === "external") {
        payload.target = {
          type: "external",
          externalUrl: externalUrl.trim(),
          enableHttp: true,
          enableHttps: enableHttps,
          forceHttps,
          sslMode: enableHttps ? "lets-encrypt" : "none",
          letsEncryptEmail: enableHttps ? email.trim() : undefined,
          customNginxConfig: customNginxConfig || null,
        };
      }

      await onSubmit(payload);
      resetForm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create domain");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      resetForm();
      onClose();
    }
  };

  const getCurrentStepIndex = () => {
    if (dnsMode === "managed") {
      return activeStep; // 0, 1, 2, 3
    } else if (dnsMode === "third-party") {
      return activeStep; // 0, 1, 2, 3
    } else {
      // proxy-only: skip DNS records step
      return activeStep; // 0, 1, 2
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <LanguageIcon color="primary" />
          <Typography variant="h6">Add New Domain</Typography>
        </Stack>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ mt: 2 }}>
          <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {/* Step 0: Domain & DNS Mode */}
          {activeStep === 0 && (
            <Stack spacing={4}>
              <Box>
                <Typography variant="subtitle2" gutterBottom fontWeight={600} sx={{ mb: 2 }}>
                  Domain Name
                </Typography>
                <TextField
                  placeholder="example.com"
                  fullWidth
                  value={domainName}
                  onChange={(e) => setDomainName(e.target.value.toLowerCase())}
                  helperText="Enter your domain (e.g., example.com, api.example.com)"
                  autoFocus
                />
              </Box>

              <Box>
                <Typography variant="subtitle2" gutterBottom fontWeight={600}>
                  Parent Domain (optional)
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
                      <em>No parent (root entry)</em>
                    </MenuItem>
                    {parentOptions.map((domain) => (
                      <MenuItem key={domain.id} value={domain.id}>
                        {domain.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>

              <DnsModeSelector selected={dnsMode} onChange={setDnsMode} />

              {/* Show DNS instructions for managed and proxy-only modes */}
              {domainName && (dnsMode === "managed" || dnsMode === "proxy-only") && (
                <DnsSetupInstructions
                  dnsMode={dnsMode}
                  domainName={domainName}
                />
              )}
            </Stack>
          )}

          {/* Step 1: DNS Configuration (varies by mode) */}
          {activeStep === 1 && dnsMode === "managed" && (
            <Stack spacing={3}>
              <Alert severity="info" icon={<InfoIcon />} sx={{ mb: 1 }}>
                Add DNS records to route traffic to your domain. Use @ for the root domain.
              </Alert>
              <DnsRecordsManager
                records={dnsRecords}
                onChange={setDnsRecords}
                domainName={domainName}
              />
            </Stack>
          )}

          {activeStep === 1 && dnsMode === "third-party" && (
            <Stack spacing={3}>
              <Alert severity="info" icon={<InfoIcon />} sx={{ mb: 1 }}>
                Connect your external DNS provider to automatically sync records.
              </Alert>
              <ThirdPartyDnsSetup config={thirdPartyConfig} onChange={setThirdPartyConfig} />
              <DnsRecordsManager
                records={dnsRecords}
                onChange={setDnsRecords}
                domainName={domainName}
              />
            </Stack>
          )}

          {/* Routing Step */}
          {((dnsMode === "proxy-only" && activeStep === 1) ||
            (dnsMode !== "proxy-only" && activeStep === 2)) && (
            <Stack spacing={3}>
              <Alert severity="info" icon={<InfoIcon />}>
                Choose what visitors should see when they access your domain
              </Alert>

              <Box>
                <Typography variant="subtitle2" gutterBottom fontWeight={600} sx={{ mb: 2 }}>
                  Routing Target
                </Typography>
                <FormControl component="fieldset" fullWidth>
                  <RadioGroup
                    value={targetType}
                    onChange={(e) => setTargetType(e.target.value as any)}
                  >
                    <Stack spacing={1}>
                      <FormControlLabel
                        value="none"
                        control={<Radio />}
                        label={
                          <Box>
                            <Typography variant="body2" fontWeight={500}>
                              Nothing (DNS Only)
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Setup domain without routing
                            </Typography>
                          </Box>
                        }
                        sx={{
                          m: 0,
                          p: 1.5,
                          border: "1px solid",
                          borderColor: targetType === "none" ? "primary.main" : "divider",
                          borderRadius: 1,
                          bgcolor: targetType === "none" ? "primary.50" : "transparent",
                        }}
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
                              Route to a containerized application
                            </Typography>
                          </Box>
                        }
                        sx={{
                          m: 0,
                          p: 1.5,
                          border: "1px solid",
                          borderColor: targetType === "container" ? "primary.main" : "divider",
                          borderRadius: 1,
                          bgcolor: targetType === "container" ? "primary.50" : "transparent",
                        }}
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
                              Proxy to another website
                            </Typography>
                          </Box>
                        }
                        sx={{
                          m: 0,
                          p: 1.5,
                          border: "1px solid",
                          borderColor: targetType === "external" ? "primary.main" : "divider",
                          borderRadius: 1,
                          bgcolor: targetType === "external" ? "primary.50" : "transparent",
                        }}
                      />
                    </Stack>
                  </RadioGroup>
                </FormControl>
              </Box>

              {targetType === "container" && (
                <Stack spacing={2} sx={{ mt: 2 }}>
                  <FormControl fullWidth>
                    <InputLabel>Container</InputLabel>
                    <Select
                      value={selectedContainer}
                      label="Container"
                      onChange={(e) => {
                        const containerId = e.target.value;
                        setSelectedContainer(containerId);
                        
                        // Auto-select first exposed port
                        const container = containers.find(c => c.id === containerId);
                        if (container && container.ports.length > 0) {
                          const firstPort = container.ports[0];
                          const portMatch = firstPort.match(/(\d+)\/(tcp|udp)/);
                          if (portMatch) {
                            setContainerPort(portMatch[1]);
                          }
                        }
                      }}
                    >
                      {containers.map((container) => (
                        <MenuItem key={container.id} value={container.id}>
                          <Stack direction="row" spacing={1} alignItems="center" sx={{ width: '100%' }}>
                            <Box
                              sx={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                bgcolor: container.state === 'running' ? 'success.main' : 'error.main',
                              }}
                            />
                            <Box flex={1}>
                              <Typography variant="body2">{container.name}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {container.image} • {container.state}
                              </Typography>
                            </Box>
                          </Stack>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <TextField
                    label="Container Port"
                    type="number"
                    placeholder="3000"
                    fullWidth
                    value={containerPort}
                    onChange={(e) => setContainerPort(e.target.value)}
                    helperText={
                      selectedContainer 
                        ? `Auto-selected from container. Exposed ports: ${
                            containers.find(c => c.id === selectedContainer)?.ports.join(', ') || 'none'
                          }`
                        : "Port your app listens on (e.g., 3000, 8080)"
                    }
                  />
                </Stack>
              )}

              {targetType === "external" && (
                <TextField
                  label="External URL"
                  placeholder="https://example.com"
                  fullWidth
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                  helperText="Full URL to proxy to"
                  sx={{ mt: 2 }}
                />
              )}
            </Stack>
          )}

          {/* Security Step */}
          {((dnsMode === "proxy-only" && activeStep === 2) ||
            (dnsMode !== "proxy-only" && activeStep === 3)) && (
            <Stack spacing={4}>
              <SslConfiguration
                domainName={domainName}
                enableHttps={enableHttps}
                sslMode={sslMode}
                letsEncryptEmail={email}
                certificateId={customCertId}
                forceHttps={forceHttps}
                onEnableHttpsChange={setEnableHttps}
                onSslModeChange={setSslMode}
                onLetsEncryptEmailChange={setEmail}
                onCertificateIdChange={setCustomCertId}
                onForceHttpsChange={setForceHttps}
              />

              <Box>
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                  Advanced nginx directives
                </Typography>
                <TextField
                  label="Optional nginx configuration"
                  multiline
                  minRows={4}
                  value={customNginxConfig}
                  onChange={(event) => setCustomNginxConfig(event.target.value)}
                  helperText="Injected into the generated server block after proxy configuration."
                />
              </Box>

              <Alert severity="success" variant="outlined">
                <Typography variant="body2" fontWeight={600} gutterBottom>
                  ✓ Ready to create!
                </Typography>
                <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                  Your domain <strong>{domainName}</strong> will be configured with:
                </Typography>
                <Stack component="ul" spacing={0.5} sx={{ mt: 1, mb: 0, pl: 2 }}>
                  {dnsMode === "managed" && (
                    <Typography component="li" variant="caption">
                      DNS hosted on this platform ({dnsRecords.length} record{dnsRecords.length !== 1 ? 's' : ''})
                    </Typography>
                  )}
                  {dnsMode === "third-party" && (
                    <Typography component="li" variant="caption">
                      DNS synced with {thirdPartyConfig.provider || 'external provider'}
                    </Typography>
                  )}
                  {dnsMode === "proxy-only" && (
                    <Typography component="li" variant="caption">
                      DNS managed externally
                    </Typography>
                  )}
                  {targetType !== "none" && (
                    <Typography component="li" variant="caption">
                      {targetType === "container" 
                        ? `Routes to Docker container on port ${containerPort}`
                        : targetType === "external"
                        ? `Proxies to ${externalUrl}`
                        : "Routing configured"}
                    </Typography>
                  )}
                  {enableHttps && (
                    <Typography component="li" variant="caption">
                      HTTPS with automatic SSL certificate
                    </Typography>
                  )}
                </Stack>
              </Alert>
            </Stack>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        {activeStep > 0 && (
          <Button onClick={handleBack} disabled={loading}>
            Back
          </Button>
        )}
        {activeStep < steps.length - 1 ? (
          <Button variant="contained" onClick={handleNext}>
            Next
          </Button>
        ) : (
          <Button variant="contained" onClick={handleSubmit} disabled={loading}>
            {loading ? "Creating..." : "Create Domain"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
