"use client";

import { useEffect, useMemo, useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import BuildIcon from "@mui/icons-material/Build";
import CloudDoneIcon from "@mui/icons-material/CloudDone";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import LaunchIcon from "@mui/icons-material/Launch";
import SaveIcon from "@mui/icons-material/Save";
import VerifiedIcon from "@mui/icons-material/Verified";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Divider,
  FormControl,
  FormControlLabel,
  FormLabel,
  InputAdornment,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Stack,
  Switch,
  TextField,
  Typography
} from "@mui/material";
import { styled } from "@mui/material/styles";
import Grid from "@mui/material/Grid";
import { toast } from "sonner";
import { useNginxSites } from "@/features/nginx/hooks/use-nginx-sites";
import { useSslCertificates } from "@/features/ssl/hooks/use-ssl-certificates";
import type { NginxSite, SSLCertificate, UpstreamType } from "@/types/server";

const SiteCard = styled(Card)(({ theme }) => ({
  borderRadius:
    typeof theme.shape.borderRadius === "number"
      ? theme.shape.borderRadius * 1.5
      : theme.shape.borderRadius,
  border: `1px solid ${theme.palette.divider}`
}));

const ConfigPreview = styled("pre")(({ theme }) => ({
  margin: 0,
  whiteSpace: "pre-wrap",
  fontFamily: 'ui-monospace, SFMono-Regular, SFMono, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  backgroundColor: theme.palette.mode === "dark" ? "rgba(15,23,42,0.85)" : theme.palette.grey[50],
  borderRadius: theme.shape.borderRadius,
  border: `1px solid ${theme.palette.divider}`,
  padding: theme.spacing(2)
}));

type SslMode = "none" | "lets-encrypt" | "custom";

interface FormState {
  id?: string;
  serverNames: string[];
  enableHttp: boolean;
  enableHttps: boolean;
  upstreamType: UpstreamType;
  upstreamTarget: string;
  sslMode: SslMode;
  letsEncryptEmail?: string;
  customCertificateId?: string;
  notes?: string;
  extraDirectives: string;
}

const createDefaultForm = (): FormState => ({
  serverNames: [],
  enableHttp: true,
  enableHttps: true,
  upstreamType: "service",
  upstreamTarget: "",
  sslMode: "lets-encrypt",
  letsEncryptEmail: "",
  customCertificateId: undefined,
  notes: "",
  extraDirectives: ""
});

const toFormState = (site: NginxSite): FormState => ({
  id: site.id,
  serverNames: site.serverNames,
  enableHttp: site.listen.some((l) => l.protocol === "http"),
  enableHttps: site.listen.some((l) => l.protocol === "https"),
  upstreamType: site.upstreamType,
  upstreamTarget: site.upstreamTarget,
  sslMode: site.sslCertificateId ? "custom" : "lets-encrypt",
  customCertificateId: site.sslCertificateId ?? undefined,
  letsEncryptEmail: "",
  notes: site.notes ?? "",
  extraDirectives: ""
});

const toNginxSite = (form: FormState, certificates: SSLCertificate[]): NginxSite => {
  const listen: NginxSite["listen"] = [];
  if (form.enableHttp) {
    listen.push({ port: 80, protocol: "http" });
  }
  if (form.enableHttps) {
    listen.push({ port: 443, protocol: "https" });
  }

  const sslCertificateId = form.sslMode === "custom" ? form.customCertificateId ?? null : null;

  return {
    id: form.id ?? `site-${Date.now()}`,
    serverNames: form.serverNames,
    listen: listen.length ? listen : [{ port: 80, protocol: "http" }],
    upstreamType: form.upstreamType,
    upstreamTarget: form.upstreamTarget,
    sslCertificateId,
    enabled: true,
    lastDeployedAt: undefined,
    createdAt: form.id ? new Date().toISOString() : new Date().toISOString(),
    notes: form.notes
  } satisfies NginxSite;
};

const generateConfigPreview = (form: FormState, certificates: SSLCertificate[], managedDomains: string[]): string => {
  const lines: string[] = [];
  lines.push("server {");

  if (form.enableHttp) {
    lines.push("    listen 80;");
  }
  if (form.enableHttps) {
    lines.push("    listen 443 ssl;");
  }

  if (form.serverNames.length) {
    lines.push(`    server_name ${form.serverNames.join(" ")};`);
  }

  if (form.enableHttps) {
    if (form.sslMode === "lets-encrypt") {
      lines.push("    # Managed by Let's Encrypt (acme.sh / certbot)");
      lines.push("    ssl_certificate /etc/letsencrypt/live/<domain>/fullchain.pem;");
      lines.push("    ssl_certificate_key /etc/letsencrypt/live/<domain>/privkey.pem;");
    } else if (form.sslMode === "custom" && form.customCertificateId) {
      const cert = certificates.find((c) => c.id === form.customCertificateId);
      lines.push(`    # Custom certificate (${cert?.commonName ?? ""})`);
      lines.push(`    ssl_certificate /etc/nginx/certs/${form.customCertificateId}.crt;`);
      lines.push(`    ssl_certificate_key /etc/nginx/certs/${form.customCertificateId}.key;`);
    } else {
      lines.push("    # TLS enabled but no certificate selected");
    }
  }

  lines.push("    location / {");
  if (form.upstreamType === "external") {
    lines.push(`        proxy_pass ${form.upstreamTarget};`);
  } else {
    lines.push("        proxy_set_header Host $host;");
    lines.push("        proxy_set_header X-Real-IP $remote_addr;");
    lines.push(`        proxy_pass http://${form.upstreamTarget};`);
  }
  lines.push("    }");

  if (form.extraDirectives.trim()) {
    lines.push("    # Custom directives");
    form.extraDirectives
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line) => lines.push(`    ${line}`));
  }

  lines.push("}");

  if (form.enableHttps && form.sslMode === "lets-encrypt") {
    lines.push("\n# Let's Encrypt certificate request configuration");
    lines.push("certbot certonly --nginx ");
    lines.push(`  -d ${form.serverNames.join(",")}`);
    if (form.letsEncryptEmail) {
      lines.push(`  -m ${form.letsEncryptEmail}`);
    }
    lines.push("  --agree-tos --no-eff-email");
  }

  if (managedDomains.length) {
    lines.push("\n# Managed domains:");
    managedDomains.forEach((domain) => lines.push(`- ${domain}`));
  }

  return lines.join("\n");
};

const NginxManager = () => {
  const { data: sitesData, isLoading, isError, error } = useNginxSites();
  const { data: certificates } = useSslCertificates();
  const [sites, setSites] = useState<NginxSite[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(createDefaultForm());

  useEffect(() => {
    if (sitesData) {
      setSites(sitesData);
      if (!selectedId && sitesData.length) {
        const first = sitesData[0];
        setSelectedId(first.id);
        setForm(toFormState(first));
      }
    }
  }, [sitesData, selectedId]);

  const handleSelectSite = (site: NginxSite) => {
    setSelectedId(site.id);
    setForm(toFormState(site));
  };

  const handleCreateNew = () => {
    setSelectedId(null);
    setForm(createDefaultForm());
  };

  const handleToggleEnabled = (siteId: string) => {
    setSites((prev) =>
      prev.map((site) =>
        site.id === siteId
          ? { ...site, enabled: !site.enabled, lastDeployedAt: new Date().toISOString() }
          : site
      )
    );
    toast.success("Toggled site state (mock)");
  };

  const handleInputChange = <Key extends keyof FormState>(key: Key, value: FormState[Key]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    if (!form.serverNames.length) {
      toast.error("Add at least one domain name");
      return;
    }
    if (!form.upstreamTarget.trim()) {
      toast.error("Specify an upstream target");
      return;
    }
    if (form.enableHttps) {
      if (form.sslMode === "lets-encrypt" && !form.letsEncryptEmail) {
        toast.error("Provide an email for Let's Encrypt notifications");
        return;
      }
      if (form.sslMode === "custom" && !form.customCertificateId) {
        toast.error("Select the certificate to use");
        return;
      }
    }

    const updated = toNginxSite(form, certificates ?? []);

    setSites((prev) => {
      const exists = prev.some((site) => site.id === updated.id);
      if (exists) {
        return prev.map((site) => (site.id === updated.id ? { ...site, ...updated } : site));
      }
      return [...prev, updated];
    });

    setSelectedId(updated.id);
    toast.success("Nginx configuration saved (mock)");
  };

  const handleDelete = () => {
    if (!form.id) {
      toast.info("Nothing to delete yet");
      return;
    }
    setSites((prev) => prev.filter((site) => site.id !== form.id));
    setSelectedId(null);
    setForm(createDefaultForm());
    toast.success("Removed site (mock)");
  };

  const handleDeploy = () => {
    if (!form.serverNames.length) {
      toast.error("Configure the server names before deploying");
      return;
    }
    toast.promise(
      new Promise((resolve) => {
        setTimeout(resolve, 1200);
      }),
      {
        loading: "Deploying configuration...",
        success: () => "Configuration deployed (mock)",
        error: "Failed to deploy configuration"
      }
    );
  };

  const configPreview = useMemo(() => generateConfigPreview(form, certificates ?? [], form.serverNames), [form, certificates]);

  if (isLoading) {
    return (
      <Paper sx={{ p: 6, borderRadius: 3, textAlign: "center" }}>
        <Typography variant="body2" color="text.secondary">
          Loading Nginx sites...
        </Typography>
      </Paper>
    );
  }

  if (isError) {
    return (
      <Paper sx={{ p: 6, borderRadius: 3 }}>
        <Typography variant="h6" gutterBottom>
          Unable to load Nginx configuration
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {error instanceof Error ? error.message : "Check your Nginx API connection and try again."}
        </Typography>
      </Paper>
    );
  }

  return (
    <Grid container spacing={3}>
      <Grid size={{ xs: 12, md: 5 }}>
        <Stack spacing={2.5}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="h6">Configured sites</Typography>
            <Button startIcon={<AddIcon />} size="small" onClick={handleCreateNew}>
              New site
            </Button>
          </Stack>
          {!sites.length ? (
            <Paper sx={{ p: 4, borderRadius: 3 }}>
              <Typography variant="body2" color="text.secondary">
                No Nginx sites configured yet. Create your first mapping on the right.
              </Typography>
            </Paper>
          ) : (
            <Stack spacing={1.5}>
              {sites.map((site) => {
                const isActive = site.id === selectedId;
                return (
                  <SiteCard key={site.id} variant={isActive ? "outlined" : undefined}>
                    <CardActionArea onClick={() => handleSelectSite(site)}>
                      <CardContent sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between">
                          <Typography variant="subtitle1">
                            {site.serverNames.join(", ")}
                          </Typography>
                          <Chip
                            icon={site.enabled ? <CloudDoneIcon fontSize="small" /> : <WarningAmberIcon fontSize="small" />}
                            label={site.enabled ? "Enabled" : "Disabled"}
                            color={site.enabled ? "success" : "default"}
                            size="small"
                          />
                        </Stack>
                        <Typography variant="body2" color="text.secondary">
                          {site.upstreamType === "external" ? site.upstreamTarget : `${site.upstreamType} · ${site.upstreamTarget}`}
                        </Typography>
                        <Stack direction="row" spacing={1} alignItems="center">
                          {site.listen.map((listen) => (
                            <Chip key={`${listen.protocol}-${listen.port}`} size="small" label={`${listen.protocol.toUpperCase()} · ${listen.port}`} />
                          ))}
                          {site.sslCertificateId && (
                            <Chip size="small" color="primary" icon={<VerifiedIcon fontSize="small" />} label="TLS" />
                          )}
                        </Stack>
                        <Stack direction="row" spacing={1}>
                          <Button
                            size="small"
                            startIcon={<LaunchIcon fontSize="small" />}
                            onClick={(event) => {
                              event.stopPropagation();
                              handleSelectSite(site);
                              handleDeploy();
                            }}
                          >
                            Deploy
                          </Button>
                          <Button
                            size="small"
                            startIcon={<BuildIcon fontSize="small" />}
                            onClick={(event) => {
                              event.stopPropagation();
                              handleToggleEnabled(site.id);
                            }}
                          >
                            {site.enabled ? "Disable" : "Enable"}
                          </Button>
                        </Stack>
                      </CardContent>
                    </CardActionArea>
                  </SiteCard>
                );
              })}
            </Stack>
          )}
        </Stack>
      </Grid>
      <Grid size={{ xs: 12, md: 7 }}>
        <Stack spacing={2.5}>
          <Paper sx={{ p: 3, borderRadius: 3, display: "flex", flexDirection: "column", gap: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="h6">
                {selectedId ? "Edit configuration" : "New configuration"}
              </Typography>
              {form.id && (
                <Button color="error" startIcon={<DeleteOutlineIcon />} size="small" onClick={handleDelete}>
                  Delete
                </Button>
              )}
            </Stack>

            <Stack spacing={2}>
              <Autocomplete
                multiple
                freeSolo
                value={form.serverNames}
                options={form.serverNames}
                onChange={(_, value) => handleInputChange("serverNames", value)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Server names"
                    helperText="Primary domain and any aliases (press Enter to add)"
                  />
                )}
              />

              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormControlLabel
                    control={<Switch checked={form.enableHttp} onChange={(_, value) => handleInputChange("enableHttp", value)} />}
                    label="Serve HTTP"
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormControlLabel
                    control={<Switch checked={form.enableHttps} onChange={(_, value) => handleInputChange("enableHttps", value)} />}
                    label="Serve HTTPS"
                  />
                </Grid>
              </Grid>

              {form.enableHttps && (
                <Stack spacing={1.5}>
                  <FormControl>
                    <FormLabel>SSL mode</FormLabel>
                    <RadioGroup
                      row
                      value={form.sslMode}
                      onChange={(event) => handleInputChange("sslMode", event.target.value as SslMode)}
                    >
                      <FormControlLabel value="lets-encrypt" control={<Radio />} label="Let's Encrypt" />
                      <FormControlLabel value="custom" control={<Radio />} label="Custom certificate" />
                      <FormControlLabel value="none" control={<Radio />} label="No TLS" />
                    </RadioGroup>
                  </FormControl>
                  {form.sslMode === "lets-encrypt" && (
                    <TextField
                      label="Notification email"
                      value={form.letsEncryptEmail}
                      onChange={(event) => handleInputChange("letsEncryptEmail", event.target.value)}
                      helperText="Used for Let's Encrypt expiry notices"
                    />
                  )}
                  {form.sslMode === "custom" && (
                    <TextField
                      select
                      label="Certificate"
                      value={form.customCertificateId ?? ""}
                      onChange={(event) => handleInputChange("customCertificateId", event.target.value || undefined)}
                    >
                      <MenuItem value="">
                        Select certificate
                      </MenuItem>
                      {(certificates ?? []).map((cert) => (
                        <MenuItem key={cert.id} value={cert.id}>
                          {cert.commonName} · exp {new Date(cert.expiresAt).toLocaleDateString()}
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
                  {form.sslMode === "none" && (
                    <Alert severity="warning">
                      TLS is disabled. Traffic will be served via HTTP only.
                    </Alert>
                  )}
                </Stack>
              )}

              <TextField
                select
                label="Upstream type"
                value={form.upstreamType}
                onChange={(event) => handleInputChange("upstreamType", event.target.value as UpstreamType)}
              >
                <MenuItem value="service">Service (Docker DNS)</MenuItem>
                <MenuItem value="container">Container</MenuItem>
                <MenuItem value="external">External URL</MenuItem>
              </TextField>

              <TextField
                label={form.upstreamType === "external" ? "Destination URL" : "Service or container name"}
                value={form.upstreamTarget}
                onChange={(event) => handleInputChange("upstreamTarget", event.target.value)}
                InputProps={form.upstreamType === "external" ? undefined : {
                  startAdornment: <InputAdornment position="start">http://</InputAdornment>
                }}
              />

              <TextField
                label="Notes"
                value={form.notes}
                onChange={(event) => handleInputChange("notes", event.target.value)}
                multiline
                minRows={2}
              />

              <TextField
                label="Additional directives"
                value={form.extraDirectives}
                onChange={(event) => handleInputChange("extraDirectives", event.target.value)}
                helperText="Optional raw snippets to include inside the server block"
                multiline
                minRows={4}
              />
            </Stack>

            <Stack direction="row" spacing={1.5} justifyContent="flex-end">
              <Button startIcon={<SaveIcon />} variant="contained" onClick={handleSave}>
                Save configuration
              </Button>
              <Button startIcon={<CloudDoneIcon />} variant="outlined" onClick={handleDeploy}>
                Deploy
              </Button>
            </Stack>
          </Paper>

          <Paper sx={{ p: 3, borderRadius: 3 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
              <Typography variant="h6">Generated config preview</Typography>
              <Button
                size="small"
                onClick={async () => {
                  await navigator.clipboard.writeText(configPreview);
                  toast.success("Config copied to clipboard");
                }}
              >
                Copy
              </Button>
            </Stack>
            <ConfigPreview>{configPreview}</ConfigPreview>
          </Paper>
        </Stack>
      </Grid>
    </Grid>
  );
};

export default NginxManager;
