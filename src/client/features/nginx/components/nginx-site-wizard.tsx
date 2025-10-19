"use client";

import { useState, useMemo } from "react";
import {
  Alert,
  Box,
  Button,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Switch,
  TextField,
  Typography,
  Chip,
  Paper,
  Autocomplete,
} from "@mui/material";
import SettingsEthernetIcon from "@mui/icons-material/SettingsEthernet";
import InfoIcon from "@mui/icons-material/Info";
import CodeIcon from "@mui/icons-material/Code";
import SecurityIcon from "@mui/icons-material/Security";
import type { DockerContainer } from "@/types/docker";
import type { NginxSiteFormData } from "./nginx-site-form-dialog";

interface NginxSiteWizardProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: NginxSiteFormData) => Promise<void>;
  containers: DockerContainer[];
}

export default function NginxSiteWizard({
  open,
  onClose,
  onSubmit,
  containers,
}: NginxSiteWizardProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Domain Configuration
  const [primaryDomain, setPrimaryDomain] = useState("");
  const [aliasInput, setAliasInput] = useState("");
  const [aliases, setAliases] = useState<string[]>([]);

  // Step 2: Upstream Configuration
  const [upstreamType, setUpstreamType] = useState<"container" | "service" | "external">("container");
  const [selectedContainer, setSelectedContainer] = useState<DockerContainer | null>(null);
  const [containerPort, setContainerPort] = useState("");
  const [upstreamTarget, setUpstreamTarget] = useState("");

  // Step 3: HTTP/HTTPS Configuration
  const [enableHttp, setEnableHttp] = useState(true);
  const [enableHttps, setEnableHttps] = useState(true);
  const [forceHttps, setForceHttps] = useState(false);
  const [sslMode, setSslMode] = useState<"lets-encrypt" | "custom" | "none">("lets-encrypt");
  const [email, setEmail] = useState("");

  // Step 4: Advanced Options
  const [enabled, setEnabled] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customDirectives, setCustomDirectives] = useState("");
  const [notes, setNotes] = useState("");

  const steps = ["Domains", "Upstream", "Security", "Advanced & Review"];

  const resetForm = () => {
    setActiveStep(0);
    setPrimaryDomain("");
    setAliases([]);
    setAliasInput("");
    setUpstreamType("container");
    setSelectedContainer(null);
    setContainerPort("");
    setUpstreamTarget("");
    setEnableHttp(true);
    setEnableHttps(true);
    setForceHttps(false);
    setSslMode("lets-encrypt");
    setEmail("");
    setEnabled(true);
    setShowAdvanced(false);
    setCustomDirectives("");
    setNotes("");
    setError(null);
  };

  const containerPorts = useMemo(() => {
    if (!selectedContainer) return [];
    const ports = new Set<number>();
    selectedContainer.ports.forEach((binding) => {
      const parts = binding.split("->");
      const candidate = (parts.length > 1 ? parts[1] : parts[0]).split("/")[0];
      const port = Number(candidate.split(":").pop());
      if (Number.isFinite(port)) {
        ports.add(port);
      }
    });
    return Array.from(ports).sort((a, b) => a - b);
  }, [selectedContainer]);

  const validateStep = () => {
    switch (activeStep) {
      case 0: // Domains
        if (!primaryDomain.trim()) {
          setError("Primary domain is required");
          return false;
        }
        if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(primaryDomain)) {
          setError("Please enter a valid domain");
          return false;
        }
        return true;

      case 1: // Upstream
        if (upstreamType === "container") {
          if (!selectedContainer) {
            setError("Please select a container");
            return false;
          }
          if (!containerPort) {
            setError("Please enter container port");
            return false;
          }
        } else if (upstreamType === "service" || upstreamType === "external") {
          if (!upstreamTarget.trim()) {
            setError("Please enter upstream target");
            return false;
          }
        }
        return true;

      case 2: // Security
        if (enableHttps && sslMode === "lets-encrypt" && email.trim() && !email.includes("@")) {
          setError("Please enter a valid email address");
          return false;
        }
        return true;

      case 3: // Advanced
        return true;

      default:
        return true;
    }
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

  const handleSubmit = async () => {
    if (!validateStep()) return;

    try {
      setLoading(true);
      setError(null);

      const serverNames = [primaryDomain, ...aliases];

      const data: NginxSiteFormData = {
        primaryDomain: primaryDomain.trim(),
        serverNames,
        upstreamType,
        upstreamTarget: upstreamType === "container" 
          ? selectedContainer?.id 
          : upstreamTarget.trim(),
        containerId: upstreamType === "container" ? selectedContainer?.id : undefined,
        containerPort: upstreamType === "container" ? parseInt(containerPort) : undefined,
        enableHttp,
        enableHttps,
        forceHttps,
        sslMode: enableHttps ? sslMode : "none",
        letsEncryptEmail: enableHttps && sslMode === "lets-encrypt" ? email.trim() : undefined,
        enabled,
        notes: notes.trim() || undefined,
      };

      // Add custom directives if provided
      if (customDirectives.trim()) {
        (data as any).extraDirectives = customDirectives.trim();
      }

      await onSubmit(data);
      resetForm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create nginx site");
    } finally {
      setLoading(false);
    }
  };

  const handleAddAlias = () => {
    const value = aliasInput.trim();
    if (value && !aliases.includes(value) && value !== primaryDomain) {
      setAliases([...aliases, value]);
      setAliasInput("");
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <SettingsEthernetIcon color="primary" />
          <Typography variant="h6">Create Nginx Site</Typography>
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

          {/* Step 0: Domain Configuration */}
          {activeStep === 0 && (
            <Stack spacing={3}>
              <Alert severity="info" icon={<InfoIcon />}>
                Enter the domain name and optional aliases for this nginx site
              </Alert>

              <TextField
                label="Primary Domain"
                placeholder="example.com"
                fullWidth
                value={primaryDomain}
                onChange={(e) => setPrimaryDomain(e.target.value.toLowerCase())}
                helperText="Main domain for this site"
                autoFocus
                required
              />

              <Box>
                <TextField
                  label="Add Alias Domain"
                  placeholder="www.example.com"
                  fullWidth
                  value={aliasInput}
                  onChange={(e) => setAliasInput(e.target.value.toLowerCase())}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddAlias();
                    }
                  }}
                  helperText="Press Enter to add alias domains (optional)"
                />
                {aliases.length > 0 && (
                  <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 1 }}>
                    {aliases.map((alias) => (
                      <Chip
                        key={alias}
                        label={alias}
                        onDelete={() => setAliases(aliases.filter((a) => a !== alias))}
                        size="small"
                      />
                    ))}
                  </Stack>
                )}
              </Box>

              <Paper sx={{ p: 2, bgcolor: "primary.50" }}>
                <Typography variant="caption">
                  💡 <strong>Tip:</strong> You can add multiple domain aliases like www.example.com, 
                  api.example.com to route them all to the same upstream
                </Typography>
              </Paper>
            </Stack>
          )}

          {/* Step 1: Upstream Configuration */}
          {activeStep === 1 && (
            <Stack spacing={3}>
              <Alert severity="info" icon={<InfoIcon />}>
                Choose where nginx should route traffic for this domain
              </Alert>

              <FormControl fullWidth>
                <InputLabel>Upstream Type</InputLabel>
                <Select
                  value={upstreamType}
                  label="Upstream Type"
                  onChange={(e) => setUpstreamType(e.target.value as any)}
                >
                  <MenuItem value="container">
                    <Box>
                      <Typography variant="body2">Docker Container</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Route to a running container
                      </Typography>
                    </Box>
                  </MenuItem>
                  <MenuItem value="service">
                    <Box>
                      <Typography variant="body2">Internal Service</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Route to service by hostname
                      </Typography>
                    </Box>
                  </MenuItem>
                  <MenuItem value="external">
                    <Box>
                      <Typography variant="body2">External URL</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Proxy to external website
                      </Typography>
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>

              {upstreamType === "container" && (
                <Stack spacing={2}>
                  <Autocomplete
                    options={containers}
                    getOptionLabel={(option) => `${option.name} (${option.image})`}
                    value={selectedContainer}
                    onChange={(_, value) => {
                      setSelectedContainer(value);
                      // Auto-select first port
                      if (value && value.ports.length > 0) {
                        const firstPort = value.ports[0];
                        const portMatch = firstPort.match(/(\d+)\/(tcp|udp)/);
                        if (portMatch) {
                          setContainerPort(portMatch[1]);
                        }
                      }
                    }}
                    renderOption={(props, option) => (
                      <li {...props}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Box
                            sx={{
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              bgcolor: option.state === "running" ? "success.main" : "error.main",
                            }}
                          />
                          <Box>
                            <Typography variant="body2">{option.name}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {option.image} • {option.state}
                            </Typography>
                          </Box>
                        </Stack>
                      </li>
                    )}
                    renderInput={(params) => (
                      <TextField {...params} label="Container" placeholder="Select container" />
                    )}
                  />

                  {selectedContainer && (
                    <FormControl fullWidth>
                      <InputLabel>Container Port</InputLabel>
                      <Select
                        value={containerPort}
                        label="Container Port"
                        onChange={(e) => setContainerPort(e.target.value)}
                      >
                        {containerPorts.map((port) => (
                          <MenuItem key={port} value={port.toString()}>
                            {port}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                </Stack>
              )}

              {upstreamType === "service" && (
                <TextField
                  label="Service Host"
                  placeholder="service-name:3000"
                  fullWidth
                  value={upstreamTarget}
                  onChange={(e) => setUpstreamTarget(e.target.value)}
                  helperText="Internal service hostname and port (e.g., backend-api:8080)"
                />
              )}

              {upstreamType === "external" && (
                <TextField
                  label="External URL"
                  placeholder="https://example.com"
                  fullWidth
                  value={upstreamTarget}
                  onChange={(e) => setUpstreamTarget(e.target.value)}
                  helperText="Full URL to proxy to (must include http:// or https://)"
                />
              )}
            </Stack>
          )}

          {/* Step 2: Security Configuration */}
          {activeStep === 2 && (
            <Stack spacing={4}>
              <Alert severity="info" icon={<SecurityIcon />}>
                Configure HTTP/HTTPS behavior and SSL certificates
              </Alert>

              <Box>
                <Typography variant="subtitle2" gutterBottom fontWeight={600}>
                  Protocol Configuration
                </Typography>
                <Stack spacing={2}>
                  <FormControlLabel
                    control={<Switch checked={enableHttp} onChange={(e) => setEnableHttp(e.target.checked)} />}
                    label={
                      <Box>
                        <Typography variant="body2">Enable HTTP (Port 80)</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Allow unencrypted traffic
                        </Typography>
                      </Box>
                    }
                  />

                  <FormControlLabel
                    control={<Switch checked={enableHttps} onChange={(e) => setEnableHttps(e.target.checked)} />}
                    label={
                      <Box>
                        <Typography variant="body2">Enable HTTPS (Port 443)</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Encrypted traffic with SSL certificate
                        </Typography>
                      </Box>
                    }
                  />

                  <FormControlLabel
                    control={
                      <Switch
                        checked={forceHttps}
                        onChange={(e) => setForceHttps(e.target.checked)}
                        disabled={!enableHttps}
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body2">Force HTTPS Redirect</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Automatically redirect HTTP to HTTPS
                        </Typography>
                      </Box>
                    }
                  />
                </Stack>
              </Box>

              {enableHttps && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom fontWeight={600}>
                    SSL Certificate
                  </Typography>
                  <Stack spacing={2}>
                    <FormControl fullWidth>
                      <InputLabel>SSL Mode</InputLabel>
                      <Select
                        value={sslMode}
                        label="SSL Mode"
                        onChange={(e) => setSslMode(e.target.value as any)}
                      >
                        <MenuItem value="lets-encrypt">
                          <Box>
                            <Typography variant="body2">Let&apos;s Encrypt</Typography>
                            <Typography variant="caption" color="text.secondary">
                              Free automated SSL certificates
                            </Typography>
                          </Box>
                        </MenuItem>
                        <MenuItem value="custom">
                          <Box>
                            <Typography variant="body2">Custom Certificate</Typography>
                            <Typography variant="caption" color="text.secondary">
                              Use your own SSL certificate
                            </Typography>
                          </Box>
                        </MenuItem>
                        <MenuItem value="none">
                          <Box>
                            <Typography variant="body2">None</Typography>
                            <Typography variant="caption" color="text.secondary">
                              SSL handled elsewhere (e.g., CloudFlare)
                            </Typography>
                          </Box>
                        </MenuItem>
                      </Select>
                    </FormControl>

                    {sslMode === "lets-encrypt" && (
                      <TextField
                        label="Email Address (Optional)"
                        type="email"
                        placeholder="admin@example.com"
                        fullWidth
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        helperText="For SSL certificate renewal notifications"
                      />
                    )}
                  </Stack>
                </Box>
              )}
            </Stack>
          )}

          {/* Step 3: Advanced & Review */}
          {activeStep === 3 && (
            <Stack spacing={3}>
              <Alert severity="success" variant="outlined">
                <Typography variant="body2" fontWeight={600} gutterBottom>
                  ✓ Configuration Ready
                </Typography>
                <Typography variant="caption" display="block">
                  Review your settings below and add custom nginx directives if needed
                </Typography>
              </Alert>

              {/* Configuration Summary */}
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                  Configuration Summary
                </Typography>
                <Stack spacing={1}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Domain
                    </Typography>
                    <Typography variant="body2">
                      {primaryDomain}
                      {aliases.length > 0 && ` (+${aliases.length} alias${aliases.length > 1 ? "es" : ""})`}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Upstream
                    </Typography>
                    <Typography variant="body2">
                      {upstreamType === "container" && selectedContainer
                        ? `${selectedContainer.name}:${containerPort}`
                        : upstreamType === "service" || upstreamType === "external"
                        ? upstreamTarget
                        : "N/A"}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Security
                    </Typography>
                    <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                      {enableHttp && <Chip label="HTTP" size="small" />}
                      {enableHttps && <Chip label="HTTPS" size="small" color="success" />}
                      {forceHttps && <Chip label="Force HTTPS" size="small" color="primary" />}
                      {enableHttps && sslMode !== "none" && (
                        <Chip
                          label={sslMode === "lets-encrypt" ? "Let's Encrypt" : "Custom SSL"}
                          size="small"
                          variant="outlined"
                        />
                      )}
                    </Stack>
                  </Box>
                </Stack>
              </Paper>

              {/* Advanced Options */}
              <Box>
                <Button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  sx={{ mb: 2 }}
                  startIcon={<CodeIcon />}
                >
                  {showAdvanced ? "Hide" : "Show"} Advanced Options
                </Button>

                <Collapse in={showAdvanced}>
                  <Stack spacing={2}>
                    <Alert severity="warning" icon={<InfoIcon />}>
                      <Typography variant="caption">
                        <strong>Advanced:</strong> Add custom nginx directives for full control. 
                        These will be inserted into the server block.
                      </Typography>
                    </Alert>

                    <TextField
                      label="Custom Nginx Directives"
                      multiline
                      rows={8}
                      fullWidth
                      value={customDirectives}
                      onChange={(e) => setCustomDirectives(e.target.value)}
                      placeholder={`# Add custom nginx directives here
# Example:
client_max_body_size 100M;
proxy_read_timeout 300;
add_header X-Custom-Header "value";

location /api {
    proxy_pass http://backend:3000;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}`}
                      helperText="Raw nginx configuration (advanced users only)"
                      sx={{
                        "& textarea": {
                          fontFamily: "monospace",
                          fontSize: "0.875rem",
                        },
                      }}
                    />

                    <TextField
                      label="Internal Notes"
                      multiline
                      rows={2}
                      fullWidth
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Internal notes about this configuration..."
                      helperText="For your reference only"
                    />

                    <FormControlLabel
                      control={<Switch checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />}
                      label="Enable this site after creation"
                    />
                  </Stack>
                </Collapse>
              </Box>

              <Paper sx={{ p: 2, bgcolor: "success.lighter", border: "1px solid", borderColor: "success.main" }}>
                <Typography variant="body2" fontWeight={500} gutterBottom>
                  ✨ Ready to Create!
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Click &quot;Create Site&quot; below. The site will be created but not deployed yet. 
                  You can review and deploy it from the sites list.
                </Typography>
              </Paper>
            </Stack>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={loading}>
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
            {loading ? "Creating..." : "Create Site"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

