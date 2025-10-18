"use client";

import { useMemo } from "react";
import AddIcon from "@mui/icons-material/Add";
import CloudDoneIcon from "@mui/icons-material/CloudDone";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import SaveIcon from "@mui/icons-material/Save";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  FormControl,
  FormControlLabel,
  FormLabel,
  InputAdornment,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Skeleton,
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
import SiteCard from "@/features/nginx/components/site-card";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  deleteSite,
  resetForm,
  selectNginxForm,
  selectNginxSelectedId,
  setSelectedSite,
  toggleSiteEnabled,
  updateForm,
  upsertSite
} from "@/store/nginx/slice";
import {
  buildNginxSite,
  generateConfigPreview,
  type NginxFormState,
  type SslMode
} from "@/features/nginx/utils/form";
import type { NginxSite, UpstreamType } from "@/types/server";

const ConfigPreview = styled("pre")(({ theme }) => ({
  margin: 0,
  whiteSpace: "pre-wrap",
  fontFamily: 'ui-monospace, SFMono-Regular, SFMono, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  backgroundColor: theme.palette.mode === "dark" ? "rgba(15,23,42,0.85)" : theme.palette.grey[50],
  borderRadius: theme.shape.borderRadius,
  border: `1px solid ${theme.palette.divider}`,
  padding: theme.spacing(2)
}));


const NginxManager = () => {
  const dispatch = useAppDispatch();
  const { data: sites, isLoading, isError, error } = useNginxSites();
  const { data: certificates } = useSslCertificates();
  const selectedId = useAppSelector(selectNginxSelectedId);
  const form = useAppSelector(selectNginxForm);
  const isInitialLoading = isLoading && sites.length === 0;

  const handleSelectSite = (site: NginxSite) => {
    dispatch(setSelectedSite(site.id));
  };

  const handleCreateNew = () => {
    dispatch(resetForm());
  };

  const handleToggleEnabled = (siteId: string) => {
    dispatch(toggleSiteEnabled(siteId));
    toast.success("Toggled site state (mock)");
  };

  const handleInputChange = <Key extends keyof NginxFormState>(key: Key, value: NginxFormState[Key]) => {
    dispatch(updateForm({ [key]: value } as Partial<NginxFormState>));
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

    const updated = buildNginxSite(form, certificates ?? []);
    dispatch(upsertSite(updated));
    toast.success("Nginx configuration saved (mock)");
  };

  const handleDelete = () => {
    if (!form.id) {
      toast.info("Nothing to delete yet");
      return;
    }
    dispatch(deleteSite(form.id));
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
          {isInitialLoading ? (
            <Stack spacing={1.5}>
              {Array.from({ length: 3 }).map((_, index) => (
                <SiteCard key={`nginx-skeleton-${index}`} site={null} />
              ))}
            </Stack>
          ) : !sites.length ? (
            <Paper sx={{ p: 4, borderRadius: 3 }}>
              <Typography variant="body2" color="text.secondary">
                No Nginx sites configured yet. Create your first mapping on the right.
              </Typography>
            </Paper>
          ) : (
            <Stack spacing={1.5}>
              {sites.map((site) => (
                <SiteCard
                  key={site.id}
                  site={site}
                  active={site.id === selectedId}
                  onSelect={handleSelectSite}
                  onDeploy={(selected) => {
                    handleSelectSite(selected);
                    handleDeploy();
                  }}
                  onToggle={(selected) => handleToggleEnabled(selected.id)}
                />
              ))}
            </Stack>
          )}
        </Stack>
      </Grid>
      <Grid size={{ xs: 12, md: 7 }}>
        <Stack spacing={2.5}>
          <Paper sx={{ p: 3, borderRadius: 3, display: "flex", flexDirection: "column", gap: 2 }}>
            {isInitialLoading ? (
              <Stack spacing={2}>
                <Skeleton variant="text" width="45%" height={32} />
                {Array.from({ length: 8 }).map((_, index) => (
                  <Skeleton key={index} variant="rounded" height={48} />
                ))}
                <Stack direction="row" spacing={1.5} justifyContent="flex-end">
                  <Skeleton variant="rounded" width={140} height={36} />
                  <Skeleton variant="rounded" width={120} height={36} />
                </Stack>
              </Stack>
            ) : (
              <>
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
              </>
            )}
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
