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
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
  Chip,
  Autocomplete,
} from "@mui/material";
import SettingsEthernetIcon from "@mui/icons-material/SettingsEthernet";
import type { NginxSite } from "@/types/server";
import type { DockerContainer } from "@/types/docker";

interface NginxSiteFormDialogProps {
  open: boolean;
  site?: NginxSite | null;
  containers: DockerContainer[];
  onClose: () => void;
  onSubmit: (data: NginxSiteFormData) => Promise<void>;
}

export interface NginxSiteFormData {
  primaryDomain: string;
  serverNames: string[];
  upstreamType: "container" | "service" | "external";
  upstreamTarget?: string;
  containerId?: string;
  containerPort?: number;
  enableHttp: boolean;
  enableHttps: boolean;
  forceHttps: boolean;
  sslMode: "none" | "lets-encrypt" | "custom";
  letsEncryptEmail?: string;
  enabled: boolean;
  notes?: string;
}

export default function NginxSiteFormDialog({
  open,
  site,
  containers,
  onClose,
  onSubmit,
}: NginxSiteFormDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [primaryDomain, setPrimaryDomain] = useState("");
  const [aliasInput, setAliasInput] = useState("");
  const [aliases, setAliases] = useState<string[]>([]);
  const [upstreamType, setUpstreamType] = useState<"container" | "service" | "external">("container");
  const [selectedContainer, setSelectedContainer] = useState<DockerContainer | null>(null);
  const [containerPort, setContainerPort] = useState("");
  const [upstreamTarget, setUpstreamTarget] = useState("");
  const [enableHttp, setEnableHttp] = useState(true);
  const [enableHttps, setEnableHttps] = useState(true);
  const [forceHttps, setForceHttps] = useState(false);
  const [sslMode, setSslMode] = useState<"none" | "lets-encrypt" | "custom">("lets-encrypt");
  const [email, setEmail] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [notes, setNotes] = useState("");

  // Load site data if editing
  useEffect(() => {
    if (!open) return;

    if (site) {
      setPrimaryDomain(site.primaryDomain);
      setAliases(site.serverNames.filter((name) => name !== site.primaryDomain));
      setUpstreamType(site.upstreamType);
      setUpstreamTarget(site.upstreamTarget || "");
      
      if (site.upstreamType === "container" && site.containerId) {
        const container = containers.find((c) => c.id === site.containerId);
        setSelectedContainer(container || null);
        setContainerPort(site.containerPort?.toString() || "");
      }

      setEnableHttp(site.enableHttp);
      setEnableHttps(site.enableHttps);
      setForceHttps(site.forceHttps);
      setSslMode(site.sslMode);
      setEmail(site.letsEncryptEmail || "");
      setEnabled(site.enabled);
      setNotes(site.notes || "");
    } else {
      // Reset form
      setPrimaryDomain("");
      setAliases([]);
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
      setNotes("");
    }
    setError(null);
  }, [open, site, containers]);

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

  const handleAddAlias = () => {
    const value = aliasInput.trim();
    if (value && !aliases.includes(value) && value !== primaryDomain) {
      setAliases([...aliases, value]);
      setAliasInput("");
    }
  };

  const handleRemoveAlias = (alias: string) => {
    setAliases(aliases.filter((a) => a !== alias));
  };

  const validate = () => {
    if (!primaryDomain.trim()) {
      setError("Primary domain is required");
      return false;
    }

    if (upstreamType === "container") {
      if (!selectedContainer) {
        setError("Please select a container");
        return false;
      }
      if (!containerPort) {
        setError("Please enter container port");
        return false;
      }
    } else if (upstreamType === "external" || upstreamType === "service") {
      if (!upstreamTarget.trim()) {
        setError("Please enter upstream target");
        return false;
      }
    }

    if (enableHttps && sslMode === "lets-encrypt" && !email.trim()) {
      setError("Email is required for Let's Encrypt");
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

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

      await onSubmit(data);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save nginx site");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <SettingsEthernetIcon color="primary" />
          <Typography variant="h6">
            {site ? "Edit Nginx Site" : "Create Nginx Site"}
          </Typography>
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={3}>
          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {/* Domain Configuration */}
          <Box>
            <Typography variant="subtitle2" gutterBottom fontWeight={600}>
              Domain Configuration
            </Typography>
            <Stack spacing={2}>
              <TextField
                label="Primary Domain"
                placeholder="example.com"
                fullWidth
                value={primaryDomain}
                onChange={(e) => setPrimaryDomain(e.target.value)}
                required
              />

              <Box>
                <TextField
                  label="Add Alias Domain"
                  placeholder="www.example.com"
                  fullWidth
                  value={aliasInput}
                  onChange={(e) => setAliasInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddAlias();
                    }
                  }}
                  helperText="Press Enter to add"
                />
                {aliases.length > 0 && (
                  <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 1 }}>
                    {aliases.map((alias) => (
                      <Chip
                        key={alias}
                        label={alias}
                        onDelete={() => handleRemoveAlias(alias)}
                        size="small"
                      />
                    ))}
                  </Stack>
                )}
              </Box>
            </Stack>
          </Box>

          {/* Upstream Configuration */}
          <Box>
            <Typography variant="subtitle2" gutterBottom fontWeight={600}>
              Upstream Target
            </Typography>
            <Stack spacing={2}>
              <FormControl fullWidth>
                <InputLabel>Upstream Type</InputLabel>
                <Select
                  value={upstreamType}
                  label="Upstream Type"
                  onChange={(e) => setUpstreamType(e.target.value as any)}
                >
                  <MenuItem value="container">Docker Container</MenuItem>
                  <MenuItem value="service">Internal Service</MenuItem>
                  <MenuItem value="external">External URL</MenuItem>
                </Select>
              </FormControl>

              {upstreamType === "container" && (
                <>
                  <Autocomplete
                    options={containers}
                    getOptionLabel={(option) => `${option.name} (${option.image})`}
                    value={selectedContainer}
                    onChange={(_, value) => setSelectedContainer(value)}
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
                </>
              )}

              {(upstreamType === "service" || upstreamType === "external") && (
                <TextField
                  label={upstreamType === "service" ? "Service Host" : "External URL"}
                  placeholder={
                    upstreamType === "service"
                      ? "service-name:3000"
                      : "https://example.com"
                  }
                  fullWidth
                  value={upstreamTarget}
                  onChange={(e) => setUpstreamTarget(e.target.value)}
                />
              )}
            </Stack>
          </Box>

          {/* HTTP/HTTPS Configuration */}
          <Box>
            <Typography variant="subtitle2" gutterBottom fontWeight={600}>
              HTTP/HTTPS Configuration
            </Typography>
            <Stack spacing={2}>
              <Stack direction="row" spacing={2}>
                <FormControlLabel
                  control={<Switch checked={enableHttp} onChange={(e) => setEnableHttp(e.target.checked)} />}
                  label="Enable HTTP"
                />
                <FormControlLabel
                  control={<Switch checked={enableHttps} onChange={(e) => setEnableHttps(e.target.checked)} />}
                  label="Enable HTTPS"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={forceHttps}
                      onChange={(e) => setForceHttps(e.target.checked)}
                      disabled={!enableHttps}
                    />
                  }
                  label="Force HTTPS"
                />
              </Stack>

              {enableHttps && (
                <Grid container spacing={2}>
                  <Grid size={{xs: 12, sm:6}}>
                    <FormControl fullWidth>
                      <InputLabel>SSL Mode</InputLabel>
                      <Select
                        value={sslMode}
                        label="SSL Mode"
                        onChange={(e) => setSslMode(e.target.value as any)}
                      >
                        <MenuItem value="lets-encrypt">Let&apos;s Encrypt</MenuItem>
                        <MenuItem value="custom">Custom Certificate</MenuItem>
                        <MenuItem value="none">None</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  {sslMode === "lets-encrypt" && (
                    <Grid size={{xs: 12, sm:6}}>
                      <TextField
                        label="Email for Let's Encrypt"
                        type="email"
                        fullWidth
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="admin@example.com"
                      />
                    </Grid>
                  )}
                </Grid>
              )}
            </Stack>
          </Box>

          {/* Additional Options */}
          <Box>
            <Typography variant="subtitle2" gutterBottom fontWeight={600}>
              Additional Options
            </Typography>
            <Stack spacing={2}>
              <FormControlLabel
                control={<Switch checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />}
                label="Enable this site"
              />

              <TextField
                label="Notes"
                multiline
                rows={3}
                fullWidth
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Internal notes about this configuration..."
              />
            </Stack>
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleSubmit} disabled={loading}>
          {loading ? "Saving..." : site ? "Update Site" : "Create Site"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

