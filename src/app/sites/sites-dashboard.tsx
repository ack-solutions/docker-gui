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
  FormControlLabel,
  IconButton,
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

interface SiteSummary {
  id: string;
  primaryDomain: string;
  aliasDomains: string[];
  upstreamUrl: string;
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
  upstreamUrl: string;
  enableHttps: boolean;
  forceHttps: boolean;
  letsEncryptEmail: string;
  enabled: boolean;
  notes: string;
}

const EMPTY_FORM: SiteForm = {
  primaryDomain: "",
  aliasDomains: "",
  upstreamUrl: "",
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
    upstreamUrl: s.upstreamUrl,
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  // dialog state
  const [editing, setEditing] = useState<SiteSummary | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<SiteForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const dialogOpen = creating || editing !== null;

  const load = useCallback(async () => {
    try {
      const [list, status] = await Promise.all([
        apiFetch<SiteSummary[]>("/api/v1/sites"),
        apiFetch<{ caddyConfigured: boolean }>("/api/v1/sites/status")
      ]);
      setRows(list);
      setCaddyConfigured(status.caddyConfigured);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditing(null);
    setCreating(true);
  }

  function openEdit(site: SiteSummary) {
    setForm(siteToForm(site));
    setEditing(site);
    setCreating(false);
  }

  function closeDialog() {
    if (submitting) return;
    setCreating(false);
    setEditing(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setActionError(null);
    try {
      const payload = {
        primaryDomain: form.primaryDomain.trim(),
        aliasDomains: form.aliasDomains
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        upstreamUrl: form.upstreamUrl.trim(),
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
      key: "upstream",
      header: "Upstream",
      render: (r) => (
        <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
          {r.upstreamUrl}
        </Typography>
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
            disabled={applying || !dirty || caddyConfigured === false}
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
    </PageShell>
  );
}

export default function SitesDashboard() {
  return <AuthGuard>{(user) => <SitesInner user={user} />}</AuthGuard>;
}
