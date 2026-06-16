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
  IconButton,
  Link,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import VerifiedUserIcon from "@mui/icons-material/VerifiedUser";
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
  StatusChip
} from "@/components";
import { ApiError, apiFetch, type PublicUser } from "@/lib/v2/auth-client";

type DnsKind = "cloudflare" | "route53";

interface DnsProvider {
  id: string;
  name: string;
  kind: DnsKind;
  tokenMask: string | null;
  verified: boolean;
  lastVerifiedAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ProviderForm {
  name: string;
  kind: DnsKind;
  apiToken: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
}

const EMPTY_FORM: ProviderForm = {
  name: "",
  kind: "cloudflare",
  apiToken: "",
  accessKeyId: "",
  secretAccessKey: "",
  region: "us-east-1"
};

const KIND_LABEL: Record<DnsKind, string> = { cloudflare: "Cloudflare", route53: "AWS Route 53" };

function DnsInner({ user }: { user: PublicUser }) {
  const [rows, setRows] = useState<DnsProvider[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<DnsProvider | null>(null);
  const [form, setForm] = useState<ProviderForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const dialogOpen = creating || editing !== null;

  const load = useCallback(async () => {
    try {
      const list = await apiFetch<DnsProvider[]>("/api/v1/dns/providers");
      setRows(list);
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

  function openEdit(p: DnsProvider) {
    setForm({ ...EMPTY_FORM, name: p.name, kind: p.kind });
    setEditing(p);
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
      if (editing) {
        const payload: Record<string, string> = {};
        if (form.name && form.name !== editing.name) payload["name"] = form.name.trim();
        if (editing.kind === "cloudflare") {
          if (form.apiToken.trim()) payload["apiToken"] = form.apiToken.trim();
        } else {
          if (form.accessKeyId.trim()) payload["accessKeyId"] = form.accessKeyId.trim();
          if (form.secretAccessKey.trim()) payload["secretAccessKey"] = form.secretAccessKey.trim();
          if (form.region.trim()) payload["region"] = form.region.trim();
        }
        if (Object.keys(payload).length === 0) {
          closeDialog();
          return;
        }
        await apiFetch(`/api/v1/dns/providers/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload)
        });
        toast.success(`Updated ${form.name || editing.name}`);
      } else {
        const payload: Record<string, string> =
          form.kind === "cloudflare"
            ? { name: form.name.trim(), kind: "cloudflare", apiToken: form.apiToken.trim() }
            : {
                name: form.name.trim(),
                kind: "route53",
                accessKeyId: form.accessKeyId.trim(),
                secretAccessKey: form.secretAccessKey.trim(),
                region: form.region.trim() || "us-east-1"
              };
        await apiFetch("/api/v1/dns/providers", {
          method: "POST",
          body: JSON.stringify(payload)
        });
        toast.success(`Added ${form.name}`);
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

  async function verify(p: DnsProvider) {
    setBusyId(p.id);
    setActionError(null);
    try {
      const updated = await apiFetch<DnsProvider>(`/api/v1/dns/providers/${p.id}/verify`, {
        method: "POST",
        body: JSON.stringify({})
      });
      if (updated.verified) {
        toast.success(`${p.name}: token is valid`);
      } else {
        toast.error(`${p.name}: ${updated.lastError ?? "verification failed"}`);
      }
      await load();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : String(err);
      setActionError(msg);
      toast.error(msg);
    } finally {
      setBusyId(null);
    }
  }

  async function remove(p: DnsProvider) {
    if (!confirm(`Remove DNS provider "${p.name}"?`)) return;
    setBusyId(p.id);
    setActionError(null);
    try {
      await apiFetch(`/api/v1/dns/providers/${p.id}`, { method: "DELETE" });
      toast.success(`Removed ${p.name}`);
      await load();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : String(err);
      setActionError(msg);
      toast.error(msg);
    } finally {
      setBusyId(null);
    }
  }

  const counts = useMemo(() => {
    const c = { total: rows?.length ?? 0, verified: 0, unverified: 0 };
    for (const r of rows ?? []) {
      if (r.verified) c.verified += 1;
      else c.unverified += 1;
    }
    return c;
  }, [rows]);

  const columns: Column<DnsProvider>[] = [
    {
      key: "name",
      header: "Name",
      render: (r) => (
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {r.name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {KIND_LABEL[r.kind] ?? r.kind}
          </Typography>
        </Box>
      )
    },
    {
      key: "token",
      header: "API token",
      render: (r) => (
        <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
          {r.tokenMask ?? "—"}
        </Typography>
      )
    },
    {
      key: "status",
      header: "Status",
      width: 180,
      render: (r) => (
        <Stack spacing={0.5}>
          <StatusChip
            status={r.verified ? "ok" : r.lastError ? "down" : "unknown"}
            label={r.verified ? "Verified" : r.lastError ? "Error" : "Unverified"}
          />
          {r.lastError && !r.verified && (
            <Typography variant="caption" color="error" sx={{ maxWidth: 240 }}>
              {r.lastError}
            </Typography>
          )}
        </Stack>
      )
    },
    {
      key: "verifiedAt",
      header: "Last checked",
      width: 140,
      render: (r) => (
        <Typography variant="caption" color="text.secondary">
          {r.lastVerifiedAt ? formatRelativeTime(r.lastVerifiedAt) : "—"}
        </Typography>
      )
    }
  ];

  function rowActions(r: DnsProvider) {
    const busy = busyId === r.id;
    return (
      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
        <Tooltip title="Re-verify">
          <span>
            <IconButton size="small" disabled={busy} onClick={() => verify(r)}>
              <VerifiedUserIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
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
      <PageShell title="DNS providers" user={user}>
        <LoadingState />
      </PageShell>
    );
  }
  if (rows === null && loadError) {
    return (
      <PageShell title="DNS providers" user={user}>
        <ErrorState title="Cannot list providers" message={loadError} onRetry={load} />
      </PageShell>
    );
  }

  return (
    <PageShell
      title="DNS providers"
      subtitle={`${counts.total} configured · ${counts.verified} verified · ${counts.unverified} unverified`}
      user={user}
      actions={
        <>
          <Button startIcon={<AddIcon />} variant="contained" size="small" onClick={openCreate}>
            Add provider
          </Button>
          <Button startIcon={<RefreshIcon />} variant="outlined" size="small" onClick={load}>
            Refresh
          </Button>
        </>
      }
    >
      <Alert severity="info" sx={{ mb: 2 }}>
        Configure a DNS provider once and the Sites wizard will offer to
        create / update the records that point your domains at this server.
        Cloudflare token scope:{" "}
        <Chip size="small" label="Zone:Read" sx={{ mr: 0.5 }} />
        <Chip size="small" label="Zone:DNS:Edit" />.{" "}
        <Link
          href="https://dash.cloudflare.com/profile/api-tokens"
          target="_blank"
          rel="noreferrer"
        >
          Create one in Cloudflare ↗
        </Link>
      </Alert>

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
        searchPlaceholder="Search providers…"
        columns={columns}
        rows={rows ?? []}
        rowKey={(r) => r.id}
        rowActions={rowActions}
        empty={
          <EmptyState
            title="No DNS providers configured"
            message="Add one to enable auto-DNS in the Sites wizard."
            action={
              <Button startIcon={<AddIcon />} variant="contained" onClick={openCreate}>
                Add provider
              </Button>
            }
          />
        }
      />

      <Dialog open={dialogOpen} onClose={closeDialog} fullWidth maxWidth="sm">
        <DialogTitle>{editing ? `Edit ${editing.name}` : "Add DNS provider"}</DialogTitle>
        <Box component="form" onSubmit={submit}>
          <DialogContent sx={{ pt: 0 }}>
            <Stack spacing={2.5}>
              <TextField
                autoFocus
                label="Display name"
                placeholder="Cloudflare — main account"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                disabled={submitting}
                required
                fullWidth
              />
              <TextField
                select
                label="Provider"
                value={form.kind}
                onChange={(e) => setForm({ ...form, kind: e.target.value as DnsKind })}
                disabled={submitting || editing !== null}
                fullWidth
                helperText={editing ? "Provider type can't be changed." : "Where your DNS is hosted."}
              >
                <MenuItem value="cloudflare">Cloudflare</MenuItem>
                <MenuItem value="route53">AWS Route 53</MenuItem>
              </TextField>

              {form.kind === "cloudflare" && (
                <TextField
                  label={editing ? "New API token (leave blank to keep existing)" : "API token"}
                  placeholder="A scoped Cloudflare API token"
                  type="password"
                  value={form.apiToken}
                  onChange={(e) => setForm({ ...form, apiToken: e.target.value })}
                  disabled={submitting}
                  required={!editing}
                  fullWidth
                  helperText={
                    editing
                      ? `Currently stored: ${editing.tokenMask ?? "—"}`
                      : "Token is verified against Cloudflare and stored encrypted at rest."
                  }
                />
              )}

              {form.kind === "route53" && (
                <>
                  <TextField
                    label="AWS Access Key ID"
                    placeholder="AKIA…"
                    value={form.accessKeyId}
                    onChange={(e) => setForm({ ...form, accessKeyId: e.target.value })}
                    disabled={submitting}
                    required={!editing}
                    fullWidth
                    helperText={
                      editing ? `Currently stored: ${editing.tokenMask ?? "—"}` : undefined
                    }
                  />
                  <TextField
                    label={
                      editing ? "AWS Secret Access Key (leave blank to keep)" : "AWS Secret Access Key"
                    }
                    type="password"
                    value={form.secretAccessKey}
                    onChange={(e) => setForm({ ...form, secretAccessKey: e.target.value })}
                    disabled={submitting}
                    required={!editing}
                    fullWidth
                    helperText="IAM user/role needs route53:ListHostedZones, ListResourceRecordSets, ChangeResourceRecordSets. Stored encrypted at rest."
                  />
                  <TextField
                    label="Region"
                    placeholder="us-east-1"
                    value={form.region}
                    onChange={(e) => setForm({ ...form, region: e.target.value })}
                    disabled={submitting}
                    fullWidth
                    helperText="Route 53 is global; any valid region works for the API endpoint."
                  />
                </>
              )}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={closeDialog} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={submitting}>
              {submitting ? "Saving…" : editing ? "Save" : "Add"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </PageShell>
  );
}

export default function DnsDashboard() {
  return <AuthGuard>{(user) => <DnsInner user={user} />}</AuthGuard>;
}
