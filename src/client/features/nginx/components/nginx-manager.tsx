"use client";

import { useMemo, useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import CloudDoneIcon from "@mui/icons-material/CloudDone";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import SaveIcon from "@mui/icons-material/Save";
import {
  Alert,
  Autocomplete,
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
  Tooltip,
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
  fetchNginxSites,
  resetForm,
  selectNginxForm,
  selectNginxSelectedId,
  setSelectedSite,
  updateForm
} from "@/store/nginx/slice";
import { buildSitePayload, generateConfigPreview, toFormState, type NginxFormState } from "@/features/nginx/utils/form";
import {
  createNginxSite,
  deleteNginxSite,
  deployNginxSite,
  updateNginxSite
} from "@/features/nginx/api";
import { useContainers } from "@/features/docker/containers/hooks/use-containers";
import type { DockerContainer } from "@/types/docker";
import type { NginxSite } from "@/types/server";

const ConfigPreview = styled("pre")(({ theme }) => ({
  margin: 0,
  whiteSpace: "pre-wrap",
  fontFamily:
    'ui-monospace, SFMono-Regular, SFMono, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  backgroundColor: theme.palette.mode === "dark" ? "rgba(15,23,42,0.85)" : theme.palette.grey[50],
  borderRadius: theme.shape.borderRadius,
  border: `1px solid ${theme.palette.divider}`,
  padding: theme.spacing(2),
  minHeight: 220,
  overflow: "auto"
}));

interface ContainerOption {
  id: string;
  label: string;
  container: DockerContainer;
}

const parseContainerPorts = (container: DockerContainer) => {
  const unique = new Set<number>();
  container.ports.forEach((binding) => {
    const parts = binding.split("->");
    const candidate = (parts.length > 1 ? parts[1] : parts[0]).split("/")[0];
    const port = Number(candidate.split(":").pop());
    if (Number.isFinite(port)) {
      unique.add(port);
    }
  });
  return Array.from(unique).sort((a, b) => a - b);
};

const isHttpUrl = (value: string) => /^https?:\/\//i.test(value);

const NginxManager = () => {
  const dispatch = useAppDispatch();
  const { data: sites, isLoading, isError, error } = useNginxSites();
  const certificatesQuery = useSslCertificates();
  const containersQuery = useContainers({ refetchOnWindowFocus: false });

  const selectedId = useAppSelector(selectNginxSelectedId);
  const form = useAppSelector(selectNginxForm);
  const selectedSite = useMemo(
    () => sites.find((site) => site.id === selectedId) ?? null,
    [sites, selectedId]
  );

  const [isSaving, setIsSaving] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isInitialLoading = isLoading && sites.length === 0;

  const handleSelectSite = (site: NginxSite) => {
    dispatch(setSelectedSite(site.id));
  };

  const handleCreateNew = () => {
    dispatch(resetForm());
  };

  const handleInputChange = <Key extends keyof NginxFormState>(key: Key, value: NginxFormState[Key]) => {
    dispatch(updateForm({ [key]: value } as Partial<NginxFormState>));
  };

  const handleAliasChange = (_: unknown, values: string[]) => {
    handleInputChange("aliases", values);
  };

  const containerOptions: ContainerOption[] = useMemo(
    () =>
      containersQuery.data.map((container) => ({
        id: container.id,
        label: `${container.name} · ${container.id.slice(0, 12)}`,
        container
      })),
    [containersQuery.data]
  );

  const selectedContainer = useMemo(
    () => containerOptions.find((option) => option.id === form.containerId) ?? null,
    [containerOptions, form.containerId]
  );

  const containerPorts = useMemo(
    () => (selectedContainer ? parseContainerPorts(selectedContainer.container) : []),
    [selectedContainer]
  );

  const configPreview = useMemo(
    () => generateConfigPreview(form, certificatesQuery.data ?? []),
    [form, certificatesQuery.data]
  );

  const validateForm = () => {
    if (!form.primaryDomain.trim()) {
      toast.error("Primary domain is required");
      return false;
    }
    if (form.upstreamType === "container") {
      if (!form.containerId) {
        toast.error("Select a container target");
        return false;
      }
      if (!form.containerPort) {
        toast.error("Select the container port to proxy to");
        return false;
      }
    } else if (!form.upstreamTarget.trim()) {
      toast.error("Specify the upstream target");
      return false;
    } else if (form.upstreamType === "external" && !isHttpUrl(form.upstreamTarget.trim())) {
      toast.error("External upstream must start with http:// or https://");
      return false;
    }

    if (form.enableHttps) {
      if (form.sslMode === "lets-encrypt" && !form.letsEncryptEmail?.trim()) {
        toast.error("Provide an email for Let's Encrypt notifications");
        return false;
      }
      if (form.sslMode === "custom" && !form.customCertificateId) {
        toast.error("Select the certificate to use");
        return false;
      }
    }
    return true;
  };

  const refreshSites = async (highlightId: string) => {
    await dispatch(fetchNginxSites()).unwrap();
    dispatch(setSelectedSite(highlightId));
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    const payload = buildSitePayload(form);
    setIsSaving(true);
    try {
      const site = form.id
        ? await updateNginxSite(form.id, payload)
        : await createNginxSite(payload);
      toast.success(form.id ? "Configuration updated" : "Configuration created");
      await refreshSites(site.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save configuration";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!form.id) {
      toast.info("Nothing to delete yet");
      return;
    }
    setIsDeleting(true);
    try {
      await deleteNginxSite(form.id);
      toast.success("Configuration removed");
      await dispatch(fetchNginxSites()).unwrap();
      dispatch(resetForm());
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete configuration";
      toast.error(message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeploy = async (siteId?: string) => {
    const targetId = siteId ?? form.id;
    if (!targetId) {
      toast.error("Save the configuration before deploying");
      return;
    }
    setIsDeploying(true);
    try {
      const site = await deployNginxSite(targetId);
      toast.success("Provisioning started");
      await refreshSites(site.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Deployment failed";
      toast.error(message);
    } finally {
      setIsDeploying(false);
    }
  };

  const handleToggleEnabled = async (site: NginxSite) => {
    const formState = toFormState(site);
    formState.enabled = !site.enabled;
    try {
      await updateNginxSite(site.id, buildSitePayload(formState));
      toast.success(site.enabled ? "Site disabled" : "Site enabled");
      await refreshSites(site.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to toggle site state";
      toast.error(message);
    }
  };

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
                  onDeploy={(selected) => handleDeploy(selected.id)}
                  onToggle={handleToggleEnabled}
                />
              ))}
            </Stack>
          )}
        </Stack>
      </Grid>

      <Grid size={{ xs: 12, md: 7 }}>
        <Stack spacing={2.5}>
          <Paper sx={{ p: 3, borderRadius: 3, display: "flex", flexDirection: "column", gap: 2 }}>
            {selectedSite?.lastError && (
              <Alert severity="error">{selectedSite.lastError}</Alert>
            )}
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="h6">
                {form.id ? "Edit configuration" : "New configuration"}
              </Typography>
              <Stack direction="row" spacing={1}>
                {form.id && (
                  <Button
                    color="error"
                    startIcon={<DeleteOutlineIcon />}
                    size="small"
                    onClick={handleDelete}
                    disabled={isDeleting}
                  >
                    Delete
                  </Button>
                )}
                <FormControlLabel
                  control={
                    <Switch
                      checked={form.enabled}
                      onChange={(_, value) => handleInputChange("enabled", value)}
                    />
                  }
                  label="Enabled"
                />
              </Stack>
            </Stack>

            <Stack spacing={2}>
              <TextField
                label="Primary domain"
                value={form.primaryDomain}
                placeholder="example.com"
                onChange={(event) => handleInputChange("primaryDomain", event.target.value)}
                fullWidth
                required
              />

              <Autocomplete
                multiple
                freeSolo
                options={form.aliases}
                value={form.aliases}
                onChange={handleAliasChange}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip variant="outlined" label={option} {...getTagProps({ index })} key={option} />
                  ))
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Alias domains"
                    placeholder="Add alias and press enter"
                    helperText="Optional additional domains served by this site"
                  />
                )}
              />

              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Stack spacing={2}>
                  <FormControl component="fieldset">
                    <FormLabel component="legend">Upstream target</FormLabel>
                    <RadioGroup
                      row
                      value={form.upstreamType}
                      onChange={(event) => {
                        const value = event.target.value as NginxFormState["upstreamType"];
                        handleInputChange("upstreamType", value);
                        if (value === "container") {
                          handleInputChange("upstreamTarget", "");
                        } else {
                          handleInputChange("containerId", undefined);
                          handleInputChange("containerPort", undefined);
                        }
                      }}
                    >
                      <FormControlLabel value="container" control={<Radio />} label="Docker container" />
                      <FormControlLabel value="service" control={<Radio />} label="Internal service" />
                      <FormControlLabel value="external" control={<Radio />} label="External URL" />
                    </RadioGroup>
                  </FormControl>

                  {form.upstreamType === "container" ? (
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                      <Autocomplete
                        sx={{ flex: 1 }}
                        options={containerOptions}
                        value={selectedContainer}
                        onChange={(_, option) => {
                          handleInputChange("containerId", option?.id);
                          if (option) {
                            const ports = parseContainerPorts(option.container);
                            handleInputChange("containerPort", ports[0] ?? undefined);
                          } else {
                            handleInputChange("containerPort", undefined);
                          }
                        }}
                        disabled={containersQuery.isLoading}
                        getOptionLabel={(option) => option.label}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="Container"
                            placeholder="Select container"
                            helperText={
                              containersQuery.isLoading
                                ? "Loading containers..."
                                : "Choose a Docker container to proxy"
                            }
                          />
                        )}
                      />
                      <TextField
                        sx={{ width: { xs: "100%", sm: 160 } }}
                        label="Container port"
                        select={containerPorts.length > 0}
                        value={form.containerPort ?? ""}
                        onChange={(event) => {
                          const value = Number(event.target.value);
                          handleInputChange("containerPort", Number.isFinite(value) ? value : undefined);
                        }}
                        placeholder="80"
                        helperText="Internal container port"
                      >
                        {containerPorts.map((port) => (
                          <MenuItem key={port} value={port}>
                            {port}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Stack>
                  ) : form.upstreamType === "service" ? (
                    <TextField
                      label="Service host"
                      value={form.upstreamTarget}
                      onChange={(event) =>
                        handleInputChange(
                          "upstreamTarget",
                          event.target.value.replace(/^https?:\/\//i, "")
                        )
                      }
                      placeholder="internal-service:3000"
                      InputProps={{
                        startAdornment: <InputAdornment position="start">http://</InputAdornment>
                      }}
                      helperText="Hostname or IP accessible from the Nginx host, with optional port"
                    />
                  ) : (
                    <TextField
                      label="External URL"
                      value={form.upstreamTarget}
                      onChange={(event) => handleInputChange("upstreamTarget", event.target.value)}
                      placeholder="https://example.com"
                      helperText="Full URL to proxy requests to (must include http/https)"
                    />
                  )}
                </Stack>
              </Paper>

              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Stack spacing={2}>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={form.enableHttp}
                          onChange={(_, value) => handleInputChange("enableHttp", value)}
                        />
                      }
                      label="Enable HTTP (port 80)"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={form.enableHttps}
                          onChange={(_, value) => handleInputChange("enableHttps", value)}
                        />
                      }
                      label="Enable HTTPS (port 443)"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={form.forceHttps}
                          onChange={(_, value) => handleInputChange("forceHttps", value)}
                          disabled={!form.enableHttps}
                        />
                      }
                      label="Force HTTPS redirect"
                    />
                  </Stack>

                  <FormControl component="fieldset">
                    <FormLabel component="legend">TLS mode</FormLabel>
                    <RadioGroup
                      row
                      value={form.sslMode}
                      onChange={(event) =>
                        handleInputChange("sslMode", event.target.value as NginxFormState["sslMode"])
                      }
                    >
                      <FormControlLabel value="none" control={<Radio />} label="HTTP only" />
                      <FormControlLabel value="lets-encrypt" control={<Radio />} label="Let's Encrypt" />
                      <FormControlLabel value="custom" control={<Radio />} label="Custom certificate" />
                    </RadioGroup>
                  </FormControl>

                  {form.enableHttps && form.sslMode === "lets-encrypt" && (
                    <TextField
                      label="Let's Encrypt email"
                      value={form.letsEncryptEmail}
                      onChange={(event) => handleInputChange("letsEncryptEmail", event.target.value)}
                      helperText="Used for expiration notifications and recovery. Required by Let's Encrypt."
                    />
                  )}

                  {form.enableHttps && form.sslMode === "custom" && (
                    <TextField
                      label="TLS certificate"
                      select
                      value={form.customCertificateId ?? ""}
                      onChange={(event) => handleInputChange("customCertificateId", event.target.value || undefined)}
                      helperText="Certificates are managed in the SSL section"
                    >
                      {(certificatesQuery.data ?? []).map((certificate) => (
                        <MenuItem key={certificate.id} value={certificate.id}>
                          {certificate.commonName} · expires {new Date(certificate.expiresAt).toLocaleDateString()}
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
                </Stack>
              </Paper>

              <TextField
                label="Notes"
                value={form.notes}
                onChange={(event) => handleInputChange("notes", event.target.value)}
                multiline
                minRows={2}
                placeholder="Optional documentation for this site"
              />

              <TextField
                label="Extra directives"
                value={form.extraDirectives}
                onChange={(event) => handleInputChange("extraDirectives", event.target.value)}
                multiline
                minRows={3}
                placeholder="Raw Nginx directives appended inside the server block"
              />

              <Stack direction="row" spacing={1.5} justifyContent="flex-end">
                <Button
                  variant="outlined"
                  startIcon={<CloudDoneIcon />}
                  onClick={() => handleDeploy()}
                  disabled={isDeploying || !form.id}
                >
                  {isDeploying ? "Deploying..." : "Deploy"}
                </Button>
                <Button
                  variant="contained"
                  startIcon={<SaveIcon />}
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  {isSaving ? "Saving..." : "Save changes"}
                </Button>
              </Stack>
            </Stack>
          </Paper>

          <Paper sx={{ p: 3, borderRadius: 3 }}>
            <Stack spacing={1.5}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="subtitle1">Configuration preview</Typography>
                {selectedSite?.lastLog && (
                  <Tooltip title={new Date(selectedSite.lastLog.createdAt).toLocaleString()}>
                    <Chip size="small" label={selectedSite.lastLog.message} />
                  </Tooltip>
                )}
              </Stack>
              <ConfigPreview>{configPreview}</ConfigPreview>
            </Stack>
          </Paper>
        </Stack>
      </Grid>
    </Grid>
  );
};

export default NginxManager;
