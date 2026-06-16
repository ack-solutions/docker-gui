"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import { toast } from "sonner";
import {
  AuthGuard,
  type Column,
  DataTable,
  EmptyState,
  ErrorState,
  formatRelativeTime,
  LoadingState,
  PageShell,
  StatusChip,
  type StatusKind
} from "@/components";
import { ApiError, apiFetch, type PublicUser } from "@/lib/v2/auth-client";

type BackendType = "container" | "static" | "external";

interface SiteSummary {
  id: string;
  primaryDomain: string;
  aliasDomains: string[];
  backendType: BackendType;
  upstreamUrl: string | null;
  containerName: string | null;
  containerPort: number | null;
  imageRef: string | null;
  env: { key: string; value: string }[];
  spaFallback: boolean;
  currentDeployId: string | null;
  enableHttps: boolean;
  forceHttps: boolean;
  letsEncryptEmail: string | null;
  enabled: boolean;
  status: "draft" | "applied" | "error";
  lastError: string | null;
  lastAppliedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SiteForm {
  primaryDomain: string;
  aliasDomains: string;
  backendType: BackendType;
  upstreamUrl: string;
  containerName: string;
  containerPort: string;
  env: { key: string; value: string }[];
  spaFallback: boolean;
  enableHttps: boolean;
  forceHttps: boolean;
  letsEncryptEmail: string;
  enabled: boolean;
  notes: string;
}

interface DnsProviderLite {
  id: string;
  name: string;
  kind: string;
  verified: boolean;
}

interface DnsRecordPreview {
  type: string;
  name: string;
  value: string;
  ttl?: number;
  proxied?: boolean;
}

interface DnsRecommendation {
  zone: { id: string; name: string };
  recommended: { zone: string; isApex: boolean; records: DnsRecordPreview[] };
}

const EMPTY_FORM: SiteForm = {
  primaryDomain: "",
  aliasDomains: "",
  backendType: "container",
  upstreamUrl: "",
  containerName: "",
  containerPort: "",
  env: [],
  spaFallback: false,
  enableHttps: true,
  forceHttps: true,
  letsEncryptEmail: "",
  enabled: true,
  notes: ""
};

function siteToForm(s: SiteSummary): SiteForm {
  return {
    primaryDomain: s.primaryDomain,
    aliasDomains: s.aliasDomains.join(", "),
    backendType: s.backendType,
    upstreamUrl: s.upstreamUrl ?? "",
    containerName: s.containerName ?? "",
    containerPort: s.containerPort != null ? String(s.containerPort) : "",
    env: s.env.map((e) => ({ ...e })),
    spaFallback: s.spaFallback,
    enableHttps: s.enableHttps,
    forceHttps: s.forceHttps,
    letsEncryptEmail: s.letsEncryptEmail ?? "",
    enabled: s.enabled,
    notes: s.notes ?? ""
  };
}

function siteStatusKind(s: SiteSummary): StatusKind {
  if (s.status === "applied") return "ok";
  if (s.status === "error") return "down";
  return "unknown";
}

function siteStatusLabel(s: SiteSummary): string {
  if (s.status === "applied") return "Applied";
  if (s.status === "error") return "Error";
  return "Draft";
}

function SitesInner({ user }: { user: PublicUser }) {
  const [rows, setRows] = useState<SiteSummary[] | null>(null);
  const [caddyConfigured, setCaddyConfigured] = useState<boolean | null>(null);
  const [caddyReachable, setCaddyReachable] = useState<boolean | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  // dialog state
  const [editing, setEditing] = useState<SiteSummary | null>(null);
  const [creating, setCreating] = useState(false);
  const [deployFor, setDeployFor] = useState<SiteSummary | null>(null);
  const openDeploy = (s: SiteSummary) => setDeployFor(s);
  const [form, setForm] = useState<SiteForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const dialogOpen = creating || editing !== null;

  // DNS state inside the dialog
  const [providers, setProviders] = useState<DnsProviderLite[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string>("");
  const [dnsLookup, setDnsLookup] = useState<DnsRecommendation | null>(null);
  const [dnsLookupError, setDnsLookupError] = useState<string | null>(null);
  const [dnsLooking, setDnsLooking] = useState(false);
  const [dnsApplying, setDnsApplying] = useState(false);

  const load = useCallback(async () => {
    try {
      const [list, status] = await Promise.all([
        apiFetch<SiteSummary[]>("/api/v1/sites"),
        apiFetch<{ caddyConfigured: boolean; caddyReachable?: boolean }>("/api/v1/sites/status")
      ]);
      setRows(list);
      setCaddyConfigured(status.caddyConfigured);
      setCaddyReachable(status.caddyReachable ?? null);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Load DNS providers when the dialog opens (deferred — most users won't
  // configure them and we shouldn't block dialog open on the network).
  useEffect(() => {
    if (!dialogOpen) return;
    let cancelled = false;
    apiFetch<DnsProviderLite[]>("/api/v1/dns/providers")
      .then((list) => {
        if (cancelled) return;
        setProviders(list);
      })
      .catch(() => {
        if (cancelled) return;
        setProviders([]);
      });
    return () => {
      cancelled = true;
    };
  }, [dialogOpen]);

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditing(null);
    setCreating(true);
    setDnsLookup(null);
    setDnsLookupError(null);
  }

  function openEdit(site: SiteSummary) {
    setForm(siteToForm(site));
    setEditing(site);
    setCreating(false);
    setDnsLookup(null);
    setDnsLookupError(null);
  }

  function closeDialog() {
    if (submitting || dnsApplying) return;
    setCreating(false);
    setEditing(null);
    setSelectedProviderId("");
    setDnsLookup(null);
    setDnsLookupError(null);
  }

  async function checkDns() {
    setDnsLookupError(null);
    setDnsLookup(null);
    if (!selectedProviderId || !form.primaryDomain.trim()) return;
    setDnsLooking(true);
    try {
      const data = await apiFetch<DnsRecommendation>(
        `/api/v1/dns/recommended?providerId=${encodeURIComponent(selectedProviderId)}&domain=${encodeURIComponent(form.primaryDomain.trim())}`
      );
      setDnsLookup(data);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : String(err);
      setDnsLookupError(msg);
    } finally {
      setDnsLooking(false);
    }
  }

  async function applyDnsRecords() {
    if (!dnsLookup || !selectedProviderId) return;
    setDnsApplying(true);
    try {
      for (const rec of dnsLookup.recommended.records) {
        await apiFetch(
          `/api/v1/dns/providers/${encodeURIComponent(selectedProviderId)}/zones/${encodeURIComponent(dnsLookup.zone.id)}/records`,
          { method: "POST", body: JSON.stringify(rec) }
        );
      }
      toast.success(
        `Created ${dnsLookup.recommended.records.length} DNS record${
          dnsLookup.recommended.records.length === 1 ? "" : "s"
        } in ${dnsLookup.zone.name}`
      );
      // Re-check so the user sees the live state (and any drift).
      await checkDns();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : String(err);
      toast.error(`DNS apply failed: ${msg}`);
    } finally {
      setDnsApplying(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setActionError(null);
    try {
      const backend =
        form.backendType === "static"
          ? { backendType: "static" as const, spaFallback: form.spaFallback }
          : form.backendType === "container"
            ? {
                backendType: "container" as const,
                containerName: form.containerName.trim(),
                containerPort: Number(form.containerPort) || undefined,
                // Drop empty rows; trim keys. Values pass through as-is.
                env: form.env
                  .filter((p) => p.key.trim())
                  .map((p) => ({ key: p.key.trim(), value: p.value }))
              }
            : { backendType: "external" as const, upstreamUrl: form.upstreamUrl.trim() };
      const payload = {
        primaryDomain: form.primaryDomain.trim(),
        aliasDomains: form.aliasDomains
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        ...backend,
        enableHttps: form.enableHttps,
        forceHttps: form.forceHttps,
        ...(form.letsEncryptEmail.trim()
          ? { letsEncryptEmail: form.letsEncryptEmail.trim() }
          : {}),
        enabled: form.enabled,
        ...(form.notes.trim() ? { notes: form.notes.trim() } : {})
      };
      if (editing) {
        await apiFetch(`/api/v1/sites/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload)
        });
        toast.success(`Updated ${payload.primaryDomain}`);
      } else {
        await apiFetch("/api/v1/sites", {
          method: "POST",
          body: JSON.stringify(payload)
        });
        toast.success(`Created ${payload.primaryDomain}`);
      }
      closeDialog();
      await load();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : String(err);
      setActionError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(site: SiteSummary) {
    if (!confirm(`Remove ${site.primaryDomain}?`)) return;
    setBusyId(site.id);
    setActionError(null);
    try {
      await apiFetch(`/api/v1/sites/${site.id}`, { method: "DELETE" });
      toast.success(`Removed ${site.primaryDomain}`);
      await load();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : String(err);
      setActionError(msg);
      toast.error(msg);
    } finally {
      setBusyId(null);
    }
  }

  async function applyAll() {
    setApplying(true);
    setActionError(null);
    try {
      const result = await apiFetch<{ ok: boolean; applied: number; error?: string }>(
        "/api/v1/sites/apply",
        { method: "POST", body: JSON.stringify({}) }
      );
      if (result.ok) {
        toast.success(`Applied ${result.applied} site${result.applied === 1 ? "" : "s"} to Caddy`);
      } else {
        toast.error(`Caddy refused config: ${result.error ?? "unknown error"}`);
      }
      await load();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : String(err);
      setActionError(msg);
      toast.error(msg);
    } finally {
      setApplying(false);
    }
  }

  const counts = useMemo(() => {
    const c = { total: rows?.length ?? 0, applied: 0, draft: 0, error: 0 };
    for (const r of rows ?? []) c[r.status] += 1;
    return c;
  }, [rows]);

  const dirty = (rows ?? []).some((r) => r.status !== "applied");

  const columns: Column<SiteSummary>[] = [
    {
      key: "domain",
      header: "Domain",
      render: (r) => (
        <Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
              {r.primaryDomain}
            </Typography>
            {r.enableHttps && (
              <Tooltip title="Open in browser">
                <IconButton
                  size="small"
                  href={`https://${r.primaryDomain}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <OpenInNewIcon fontSize="inherit" />
                </IconButton>
              </Tooltip>
            )}
          </Stack>
          {r.aliasDomains.length > 0 && (
            <Typography variant="caption" color="text.secondary">
              + {r.aliasDomains.join(", ")}
            </Typography>
          )}
        </Box>
      )
    },
    {
      key: "backend",
      header: "Backend",
      render: (r) => (
        <Stack spacing={0.25}>
          <Chip
            size="small"
            variant="outlined"
            label={
              r.backendType === "container" ? "Container" : r.backendType === "static" ? "Static" : "External"
            }
            color={r.backendType === "static" ? "secondary" : "default"}
            sx={{ width: "fit-content" }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace" }}>
            {r.backendType === "container"
              ? `${r.containerName ?? "—"}:${r.containerPort ?? "?"}`
              : r.backendType === "static"
                ? r.currentDeployId
                  ? `deployed ${r.currentDeployId}`
                  : "awaiting first deploy"
                : (r.upstreamUrl ?? "—")}
          </Typography>
        </Stack>
      )
    },
    {
      key: "tls",
      header: "TLS",
      width: 100,
      render: (r) =>
        r.enableHttps ? (
          <StatusChip
            status="ok"
            label={r.forceHttps ? "Force" : "On"}
            variant="outlined"
            withIcon={false}
          />
        ) : (
          <Typography variant="caption" color="text.secondary">
            HTTP only
          </Typography>
        )
    },
    {
      key: "status",
      header: "Status",
      width: 130,
      render: (r) => (
        <Stack spacing={0.5}>
          <StatusChip status={siteStatusKind(r)} label={siteStatusLabel(r)} />
          {!r.enabled && (
            <Chip size="small" label="disabled" variant="outlined" sx={{ width: "fit-content" }} />
          )}
        </Stack>
      )
    },
    {
      key: "applied",
      header: "Last applied",
      width: 140,
      render: (r) => (
        <Typography variant="caption" color="text.secondary">
          {r.lastAppliedAt ? formatRelativeTime(r.lastAppliedAt) : "—"}
        </Typography>
      )
    }
  ];

  function rowActions(r: SiteSummary) {
    const busy = busyId === r.id;
    return (
      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
        {(r.backendType === "static" || r.backendType === "container") && (
          <Tooltip title="Deploy tokens & CI">
            <span>
              <IconButton size="small" disabled={busy} onClick={() => openDeploy(r)}>
                <CloudUploadIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        )}
        <Tooltip title="Edit">
          <span>
            <IconButton size="small" disabled={busy} onClick={() => openEdit(r)}>
              <EditIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Remove">
          <span>
            <IconButton size="small" color="error" disabled={busy} onClick={() => remove(r)}>
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
    );
  }

  if (rows === null && !loadError) {
    return (
      <PageShell title="Sites" user={user}>
        <LoadingState />
      </PageShell>
    );
  }

  if (rows === null && loadError) {
    return (
      <PageShell title="Sites" user={user}>
        <ErrorState title="Cannot list sites" message={loadError} onRetry={load} />
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Sites"
      subtitle={`${counts.total} total · ${counts.applied} applied · ${counts.draft + counts.error} pending`}
      user={user}
      actions={
        <>
          <Button startIcon={<AddIcon />} variant="contained" size="small" onClick={openCreate}>
            New site
          </Button>
          <Button
            startIcon={<RocketLaunchIcon />}
            variant="contained"
            color="primary"
            size="small"
            disabled={applying || !dirty || caddyConfigured === false || caddyReachable === false}
            onClick={applyAll}
          >
            {applying ? "Applying…" : "Apply to Caddy"}
          </Button>
          <Button startIcon={<RefreshIcon />} variant="outlined" size="small" onClick={load}>
            Refresh
          </Button>
        </>
      }
    >
      {caddyConfigured === false && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Caddy admin URL is not configured on the API
          (<code>CADDY_ADMIN_URL</code>). You can still create sites — they
          just won&apos;t be applied until Caddy is wired up.
        </Alert>
      )}
      {caddyConfigured !== false && caddyReachable === false && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          The reverse proxy isn&apos;t running yet. Enable{" "}
          <strong>Reverse proxy + automatic HTTPS</strong> on the <strong>Features</strong> page,
          then Apply. You can create and edit sites now — they apply once it&apos;s up.
        </Alert>
      )}
      {loadError && (
        <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setLoadError(null)}>
          Latest refresh failed: {loadError}
        </Alert>
      )}
      {actionError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setActionError(null)}>
          {actionError}
        </Alert>
      )}

      <DataTable
        searchable
        searchPlaceholder="Search sites…"
        columns={columns}
        rows={rows ?? []}
        rowKey={(r) => r.id}
        rowActions={rowActions}
        empty={
          <EmptyState
            title="No sites"
            message="Create one to start serving traffic through Caddy."
            action={
              <Button startIcon={<AddIcon />} variant="contained" onClick={openCreate}>
                New site
              </Button>
            }
          />
        }
      />

      <Dialog open={dialogOpen} onClose={closeDialog} fullWidth maxWidth="sm">
        <DialogTitle>{editing ? "Edit site" : "New site"}</DialogTitle>
        <Box component="form" onSubmit={submit}>
          <DialogContent sx={{ pt: 0 }}>
            <Stack spacing={2.5}>
              <Typography variant="subtitle2" color="text.secondary">
                Domain
              </Typography>
              <TextField
                autoFocus
                label="Primary domain"
                placeholder="example.com"
                value={form.primaryDomain}
                onChange={(e) => setForm({ ...form, primaryDomain: e.target.value })}
                disabled={submitting}
                required
                fullWidth
                helperText="The main hostname Caddy will serve."
              />
              <TextField
                label="Alias domains"
                placeholder="www.example.com, alt.example.com"
                value={form.aliasDomains}
                onChange={(e) => setForm({ ...form, aliasDomains: e.target.value })}
                disabled={submitting}
                fullWidth
                helperText="Comma-separated. Optional."
              />
              <Typography variant="subtitle2" color="text.secondary" sx={{ pt: 1 }}>
                What to serve
              </Typography>
              <TextField
                select
                label="Backend"
                value={form.backendType}
                onChange={(e) => setForm({ ...form, backendType: e.target.value as BackendType })}
                disabled={submitting}
                fullWidth
              >
                <MenuItem value="container">Container app — the panel runs your Docker image</MenuItem>
                <MenuItem value="static">Static site — upload a build, no server (HTML/JS/CSS)</MenuItem>
                <MenuItem value="external">External URL — proxy a service you run elsewhere</MenuItem>
              </TextField>
              <Typography variant="caption" color="text.secondary" sx={{ mt: -1 }}>
                {form.backendType === "container"
                  ? "CI pushes an image to your registry, then triggers a deploy; the panel recreates the container and Caddy proxies it."
                  : form.backendType === "static"
                    ? "CI uploads your built files; Caddy serves them directly over HTTPS — no compute needed."
                    : "Caddy reverse-proxies to a URL or host you run elsewhere."}
              </Typography>

              {form.backendType === "container" && (
                <>
                  <Stack direction="row" spacing={2}>
                    <TextField
                      label="Container name"
                      placeholder="app-myproject"
                      value={form.containerName}
                      onChange={(e) => setForm({ ...form, containerName: e.target.value })}
                      disabled={submitting}
                      required
                      fullWidth
                      helperText="Stable name the panel runs your image under."
                    />
                    <TextField
                      label="Port"
                      placeholder="8080"
                      value={form.containerPort}
                      onChange={(e) => setForm({ ...form, containerPort: e.target.value })}
                      disabled={submitting}
                      required
                      sx={{ width: 140 }}
                      helperText="App listen port."
                    />
                  </Stack>
                  <Box>
                    <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                      Environment variables
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Stored in plaintext and applied on the next deploy — saving here does not
                      restart a running container.
                    </Typography>
                    <Stack spacing={1} sx={{ mt: 1 }}>
                      {form.env.map((pair, i) => (
                        <Stack direction="row" spacing={1} key={i} alignItems="center">
                          <TextField
                            label="Key"
                            value={pair.key}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                env: form.env.map((p, j) =>
                                  j === i ? { ...p, key: e.target.value } : p
                                )
                              })
                            }
                            disabled={submitting}
                            size="small"
                            sx={{ flex: 1 }}
                            placeholder="NODE_ENV"
                          />
                          <TextField
                            label="Value"
                            value={pair.value}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                env: form.env.map((p, j) =>
                                  j === i ? { ...p, value: e.target.value } : p
                                )
                              })
                            }
                            disabled={submitting}
                            size="small"
                            sx={{ flex: 2 }}
                            placeholder="production"
                          />
                          <Tooltip title="Remove">
                            <span>
                              <IconButton
                                size="small"
                                onClick={() =>
                                  setForm({ ...form, env: form.env.filter((_, j) => j !== i) })
                                }
                                disabled={submitting}
                              >
                                <DeleteOutlineIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </Stack>
                      ))}
                      <Box>
                        <Button
                          size="small"
                          startIcon={<AddIcon />}
                          onClick={() =>
                            setForm({ ...form, env: [...form.env, { key: "", value: "" }] })
                          }
                          disabled={submitting}
                        >
                          Add variable
                        </Button>
                      </Box>
                    </Stack>
                  </Box>
                </>
              )}

              {form.backendType === "static" && (
                <FormControlLabel
                  control={
                    <Switch
                      checked={form.spaFallback}
                      onChange={(_, v) => setForm({ ...form, spaFallback: v })}
                      disabled={submitting}
                    />
                  }
                  label="SPA fallback (serve index.html for unknown paths)"
                />
              )}

              {form.backendType === "external" && (
                <TextField
                  label="Upstream"
                  placeholder="web:80 or http://10.0.0.5:8080"
                  value={form.upstreamUrl}
                  onChange={(e) => setForm({ ...form, upstreamUrl: e.target.value })}
                  disabled={submitting}
                  required
                  fullWidth
                  helperText="Where Caddy will reverse-proxy traffic."
                />
              )}
              <Typography variant="subtitle2" color="text.secondary" sx={{ pt: 1 }}>
                HTTPS
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={form.enableHttps}
                    onChange={(_, v) => setForm({ ...form, enableHttps: v })}
                    disabled={submitting}
                  />
                }
                label="Auto-HTTPS via Let's Encrypt"
              />
              {form.enableHttps && (
                <>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={form.forceHttps}
                        onChange={(_, v) => setForm({ ...form, forceHttps: v })}
                        disabled={submitting}
                      />
                    }
                    label="Redirect HTTP → HTTPS"
                  />
                  <TextField
                    label="Let's Encrypt email"
                    type="email"
                    placeholder="ops@example.com"
                    value={form.letsEncryptEmail}
                    onChange={(e) => setForm({ ...form, letsEncryptEmail: e.target.value })}
                    disabled={submitting}
                    fullWidth
                    helperText="Optional. Falls back to CADDY_DEFAULT_LE_EMAIL if unset."
                  />
                </>
              )}
              <Typography variant="subtitle2" color="text.secondary" sx={{ pt: 1 }}>
                Options
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={form.enabled}
                    onChange={(_, v) => setForm({ ...form, enabled: v })}
                    disabled={submitting}
                  />
                }
                label="Enabled (included in next apply)"
              />
              <TextField
                label="Notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                disabled={submitting}
                fullWidth
                multiline
                minRows={2}
              />

              {!editing && providers.length > 0 && (
                <Box>
                  <Divider sx={{ mb: 2 }}>
                    <Chip size="small" label="DNS automation (optional)" />
                  </Divider>
                  <Stack spacing={1.5}>
                    <Stack direction="row" spacing={1}>
                      <TextField
                        select
                        label="DNS provider"
                        value={selectedProviderId}
                        onChange={(e) => {
                          setSelectedProviderId(e.target.value);
                          setDnsLookup(null);
                          setDnsLookupError(null);
                        }}
                        disabled={submitting || dnsApplying}
                        size="small"
                        sx={{ minWidth: 220 }}
                      >
                        <MenuItem value="">
                          <em>None — I&apos;ll set DNS manually</em>
                        </MenuItem>
                        {providers.map((p) => (
                          <MenuItem key={p.id} value={p.id} disabled={!p.verified}>
                            {p.name}
                            {!p.verified && " (unverified)"}
                          </MenuItem>
                        ))}
                      </TextField>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={checkDns}
                        disabled={
                          !selectedProviderId ||
                          !form.primaryDomain.trim() ||
                          dnsLooking ||
                          dnsApplying
                        }
                      >
                        {dnsLooking ? "Looking up…" : "Preview records"}
                      </Button>
                    </Stack>

                    {dnsLookupError && (
                      <Alert severity="warning" onClose={() => setDnsLookupError(null)}>
                        {dnsLookupError}
                      </Alert>
                    )}

                    {dnsLookup && (
                      <Box sx={{ p: 1.5, border: 1, borderColor: "divider", borderRadius: 1 }}>
                        <Typography variant="caption" color="text.secondary">
                          Zone: <strong>{dnsLookup.zone.name}</strong>
                          {dnsLookup.recommended.isApex && " · apex"}
                        </Typography>
                        {dnsLookup.recommended.records.length === 0 ? (
                          <Alert severity="info" sx={{ mt: 1 }}>
                            No records to suggest. Set <code>system.public_ip</code> in
                            <code> config.yml</code> so we know which IP to point at.
                          </Alert>
                        ) : (
                          <>
                            <Stack spacing={0.5} sx={{ mt: 1 }}>
                              {dnsLookup.recommended.records.map((r, i) => (
                                <Stack
                                  key={i}
                                  direction="row"
                                  spacing={1}
                                  sx={{ fontFamily: "monospace", fontSize: 12 }}
                                >
                                  <Chip size="small" label={r.type} />
                                  <Box component="code">{r.name}</Box>
                                  <Box component="code" sx={{ color: "text.secondary" }}>
                                    →
                                  </Box>
                                  <Box component="code">{r.value}</Box>
                                </Stack>
                              ))}
                            </Stack>
                            <Button
                              startIcon={<CloudUploadIcon />}
                              size="small"
                              variant="contained"
                              sx={{ mt: 1.5 }}
                              onClick={applyDnsRecords}
                              disabled={dnsApplying}
                            >
                              {dnsApplying ? "Applying…" : "Auto-create / update records"}
                            </Button>
                          </>
                        )}
                      </Box>
                    )}
                  </Stack>
                </Box>
              )}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={closeDialog} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={submitting}>
              {submitting ? "Saving…" : editing ? "Save" : "Create"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {deployFor && <DeployDialog site={deployFor} onClose={() => setDeployFor(null)} />}
    </PageShell>
  );
}

interface DeployTokenSummary {
  id: string;
  name: string;
  scope: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

function DeployDialog({ site, onClose }: { site: SiteSummary; onClose: () => void }) {
  const [tokens, setTokens] = useState<DeployTokenSummary[]>([]);
  const [minted, setMinted] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setTokens(await apiFetch<DeployTokenSummary[]>(`/api/v1/sites/${site.id}/deploy-tokens`));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : String(err));
    }
  }, [site.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const scope = site.backendType === "container" ? "container" : "static";

  async function mint() {
    setBusy(true);
    try {
      const res = await apiFetch<DeployTokenSummary & { token: string }>(
        `/api/v1/sites/${site.id}/deploy-tokens`,
        { method: "POST", body: JSON.stringify({ name: "ci", scope }) }
      );
      setMinted(res.token);
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    try {
      await apiFetch(`/api/v1/sites/${site.id}/deploy-tokens/${id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : String(err));
    }
  }

  const active = tokens.filter((t) => !t.revokedAt);
  const yaml =
    site.backendType === "static"
      ? staticWorkflowYaml(site.id)
      : containerWorkflowYaml(site.id, site.containerName ?? "app");

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Deploy {site.primaryDomain}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          <Box>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography variant="subtitle2">Deploy tokens</Typography>
              <Button size="small" variant="outlined" onClick={mint} disabled={busy}>
                Mint token
              </Button>
            </Stack>
            <Typography variant="caption" color="text.secondary">
              Scoped to this site ({scope}). Used by CI — never your login. Shown once.
            </Typography>
            {minted && (
              <Alert severity="success" sx={{ mt: 1 }} onClose={() => setMinted(null)}>
                Copy this token now — it won&apos;t be shown again:
                <Box component="pre" sx={{ m: "8px 0 0", p: 1, bgcolor: "action.hover", borderRadius: 1, fontSize: 12, overflowX: "auto" }}>
                  {minted}
                </Box>
              </Alert>
            )}
            <Stack spacing={0.5} sx={{ mt: 1 }}>
              {active.length === 0 && (
                <Typography variant="caption" color="text.secondary">
                  No active tokens. Mint one to wire up CI.
                </Typography>
              )}
              {active.map((t) => (
                <Stack key={t.id} direction="row" alignItems="center" spacing={1}>
                  <Chip size="small" label={t.scope} variant="outlined" />
                  <Typography variant="body2" sx={{ flex: 1 }}>
                    {t.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t.lastUsedAt ? `used ${new Date(t.lastUsedAt).toLocaleDateString()}` : "never used"}
                  </Typography>
                  <Button size="small" color="error" onClick={() => revoke(t.id)}>
                    Revoke
                  </Button>
                </Stack>
              ))}
            </Stack>
          </Box>

          <Box>
            <Typography variant="subtitle2" gutterBottom>
              GitHub Actions
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Add <code>DOCKER_GUI_URL</code> (this panel&apos;s URL) and{" "}
              <code>DOCKER_GUI_DEPLOY_TOKEN</code> (the minted token) as repo secrets, then commit{" "}
              <code>.github/workflows/deploy.yml</code>:
            </Typography>
            <Box
              component="pre"
              sx={{ mt: 1, p: 1.5, bgcolor: "#0b0e14", color: "#d6deeb", borderRadius: 1, fontSize: 11.5, overflowX: "auto", lineHeight: 1.5 }}
            >
              {yaml}
            </Box>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

function staticWorkflowYaml(siteId: string): string {
  return `name: Deploy
on: { push: { branches: [main] } }
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci && npm run build
      - name: Upload to docker-gui
        run: |
          tar -czf site.tgz -C dist .
          curl --fail -X POST "$DOCKER_GUI_URL/api/v1/sites/${siteId}/deploy" \\
            -H "Authorization: Bearer $DOCKER_GUI_DEPLOY_TOKEN" \\
            -H "Content-Type: application/gzip" \\
            --data-binary @site.tgz
        env:
          DOCKER_GUI_URL: \${{ secrets.DOCKER_GUI_URL }}
          DOCKER_GUI_DEPLOY_TOKEN: \${{ secrets.DOCKER_GUI_DEPLOY_TOKEN }}`;
}

function containerWorkflowYaml(siteId: string, app: string): string {
  return `name: Deploy
on: { push: { branches: [main] } }
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/login-action@v3
        with:
          registry: \${{ secrets.REGISTRY_HOST }}
          username: \${{ secrets.REGISTRY_USER }}
          password: \${{ secrets.REGISTRY_PASSWORD }}
      - uses: docker/build-push-action@v6
        with:
          push: true
          tags: \${{ secrets.REGISTRY_HOST }}/${app}:\${{ github.sha }}
      - name: Tell docker-gui to deploy
        run: |
          curl --fail -X POST "$DOCKER_GUI_URL/api/v1/sites/${siteId}/deploy" \\
            -H "Authorization: Bearer $DOCKER_GUI_DEPLOY_TOKEN" \\
            -H "Content-Type: application/json" \\
            -d "{\\"image\\":\\"\${{ secrets.REGISTRY_HOST }}/${app}:\${{ github.sha }}\\"}"
        env:
          DOCKER_GUI_URL: \${{ secrets.DOCKER_GUI_URL }}
          DOCKER_GUI_DEPLOY_TOKEN: \${{ secrets.DOCKER_GUI_DEPLOY_TOKEN }}`;
}

export default function SitesDashboard() {
  return <AuthGuard>{(user) => <SitesInner user={user} />}</AuthGuard>;
}
