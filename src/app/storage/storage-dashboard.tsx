"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
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
  MenuItem,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import VerifiedUserIcon from "@mui/icons-material/VerifiedUser";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { toast } from "sonner";
import {
  AuthGuard,
  type Column,
  DataTable,
  EmptyState,
  ErrorState,
  formatRelativeTime,
  LoadingState,
  PageShell
} from "@/components";
import { ApiError, apiFetch, type PublicUser } from "@/lib/v2/auth-client";

type Flavor = "auto" | "minio" | "aws" | "other";

interface S3Connection {
  id: string;
  name: string;
  endpoint: string;
  region: string;
  flavor: Flavor;
  pathStyle: boolean;
  accessKeyMask: string;
  verified: boolean;
  lastVerifiedAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ConnectionForm {
  name: string;
  endpoint: string;
  region: string;
  flavor: Flavor;
  pathStyle: boolean;
  accessKey: string;
  secretKey: string;
}

const EMPTY_FORM: ConnectionForm = {
  name: "",
  endpoint: "",
  region: "us-east-1",
  flavor: "auto",
  pathStyle: true,
  accessKey: "",
  secretKey: ""
};

const FLAVOR_LABEL: Record<Flavor, string> = {
  auto: "Auto-detect",
  minio: "MinIO",
  aws: "AWS S3",
  other: "Other S3-compatible"
};

const PRESET_ENDPOINTS: Array<{ label: string; endpoint: string; region: string; pathStyle: boolean; flavor: Flavor }> = [
  { label: "Local MinIO (host)", endpoint: "http://docker-gui-minio:9000", region: "us-east-1", pathStyle: true, flavor: "minio" },
  { label: "AWS S3 (us-east-1)", endpoint: "https://s3.us-east-1.amazonaws.com", region: "us-east-1", pathStyle: false, flavor: "aws" },
  { label: "Cloudflare R2", endpoint: "https://<account>.r2.cloudflarestorage.com", region: "auto", pathStyle: true, flavor: "other" },
  { label: "Backblaze B2", endpoint: "https://s3.us-west-002.backblazeb2.com", region: "us-west-002", pathStyle: true, flavor: "other" }
];

function StorageInner({ user }: { user: PublicUser }) {
  const router = useRouter();
  const [rows, setRows] = useState<S3Connection[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<S3Connection | null>(null);
  const [form, setForm] = useState<ConnectionForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const dialogOpen = creating || editing !== null;

  const load = useCallback(async () => {
    try {
      const list = await apiFetch<S3Connection[]>("/api/v1/storage/connections");
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

  function openEdit(c: S3Connection) {
    setForm({
      name: c.name,
      endpoint: c.endpoint,
      region: c.region,
      flavor: c.flavor,
      pathStyle: c.pathStyle,
      accessKey: "",
      secretKey: ""
    });
    setCreating(false);
    setEditing(c);
  }

  function closeDialog() {
    setCreating(false);
    setEditing(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editing) {
        const patch: Partial<ConnectionForm> = {
          name: form.name,
          endpoint: form.endpoint,
          region: form.region,
          flavor: form.flavor,
          pathStyle: form.pathStyle
        };
        if (form.accessKey) patch.accessKey = form.accessKey;
        if (form.secretKey) patch.secretKey = form.secretKey;
        await apiFetch(`/api/v1/storage/connections/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(patch)
        });
        toast.success(`Updated ${form.name}`);
      } else {
        await apiFetch("/api/v1/storage/connections", {
          method: "POST",
          body: JSON.stringify(form)
        });
        toast.success(`Added ${form.name}`);
      }
      closeDialog();
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function verify(c: S3Connection) {
    setBusyId(c.id);
    try {
      const updated = await apiFetch<S3Connection>(`/api/v1/storage/connections/${c.id}/verify`, {
        method: "POST",
        body: JSON.stringify({})
      });
      if (updated.verified) {
        toast.success(`${c.name} verified`);
      } else {
        toast.error(`${c.name} could not verify: ${updated.lastError ?? "unknown error"}`);
      }
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  }

  async function remove(c: S3Connection) {
    if (!confirm(`Remove S3 connection "${c.name}"? Buckets and objects on the server are not affected.`)) return;
    setBusyId(c.id);
    try {
      await apiFetch(`/api/v1/storage/connections/${c.id}`, { method: "DELETE" });
      toast.success(`Removed ${c.name}`);
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  }

  function applyPreset(label: string) {
    const preset = PRESET_ENDPOINTS.find((p) => p.label === label);
    if (!preset) return;
    setForm((prev) => ({
      ...prev,
      endpoint: preset.endpoint,
      region: preset.region,
      pathStyle: preset.pathStyle,
      flavor: preset.flavor
    }));
  }

  const columns: Column<S3Connection>[] = [
    {
      key: "name",
      header: "Name",
      render: (c) => (
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {c.name}
          </Typography>
          <Chip
            size="small"
            variant="outlined"
            label={FLAVOR_LABEL[c.flavor]}
            sx={{ fontSize: 10 }}
          />
        </Stack>
      )
    },
    {
      key: "endpoint",
      header: "Endpoint",
      render: (c) => (
        <Typography variant="caption" sx={{ fontFamily: "monospace" }}>
          {c.endpoint}
        </Typography>
      )
    },
    {
      key: "accessKeyMask",
      header: "Access key",
      render: (c) => (
        <Typography variant="caption" sx={{ fontFamily: "monospace" }}>
          {c.accessKeyMask}
        </Typography>
      )
    },
    {
      key: "verified",
      header: "Status",
      render: (c) =>
        c.verified ? (
          <Chip size="small" color="success" label="verified" />
        ) : c.lastError ? (
          <Tooltip title={c.lastError}>
            <Chip size="small" color="error" label="error" />
          </Tooltip>
        ) : (
          <Chip size="small" color="default" label="unverified" />
        )
    },
    {
      key: "lastVerifiedAt",
      header: "Last verified",
      render: (c) => (
        <Typography variant="caption" color="text.secondary">
          {c.lastVerifiedAt ? formatRelativeTime(c.lastVerifiedAt) : "never"}
        </Typography>
      )
    }
  ];

  function rowActions(c: S3Connection) {
    const busy = busyId === c.id;
    return (
      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
        <Tooltip title="Open buckets">
          <span>
            <IconButton
              size="small"
              onClick={() => router.push(`/storage/${c.id}`)}
              disabled={busy}
            >
              <ArrowForwardIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Verify connection">
          <span>
            <IconButton size="small" onClick={() => verify(c)} disabled={busy} color="primary">
              <VerifiedUserIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Edit">
          <span>
            <IconButton size="small" onClick={() => openEdit(c)} disabled={busy}>
              <EditIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Remove">
          <span>
            <IconButton size="small" onClick={() => remove(c)} disabled={busy} color="error">
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
    );
  }

  if (rows === null && !loadError) {
    return (
      <PageShell title="Storage" user={user}>
        <LoadingState />
      </PageShell>
    );
  }
  if (rows === null && loadError) {
    return (
      <PageShell title="Storage" user={user}>
        <ErrorState title="Cannot load connections" message={loadError} onRetry={load} />
      </PageShell>
    );
  }

  const list = rows ?? [];

  return (
    <PageShell
      title="Storage"
      subtitle={`${list.length} connection${list.length === 1 ? "" : "s"} · S3-compatible buckets, objects, and policies`}
      user={user}
      actions={
        <>
          <Button startIcon={<RefreshIcon />} onClick={load} variant="outlined" size="small">
            Refresh
          </Button>
          <Button startIcon={<AddIcon />} onClick={openCreate} variant="contained" size="small">
            Add connection
          </Button>
        </>
      }
    >
      <DataTable
        searchable
        searchPlaceholder="Search connections…"
        columns={columns}
        rows={list}
        rowKey={(c) => c.id}
        rowActions={rowActions}
        empty={
          <EmptyState
            title="No S3 connections yet"
            message={
              <>
                Add a connection to MinIO, AWS S3, Wasabi, R2, or any S3-compatible
                endpoint. Credentials are encrypted at rest with the same key as
                JWT_SECRET — rotating the JWT invalidates all stored S3 secrets.
              </>
            }
            action={
              <Button startIcon={<AddIcon />} onClick={openCreate} variant="contained">
                Add connection
              </Button>
            }
          />
        }
      />

      <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="sm" fullWidth>
        <form onSubmit={submit}>
          <DialogTitle>{editing ? `Edit ${editing.name}` : "Add S3 connection"}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              {!editing && (
                <Alert severity="info">
                  Pick a preset to fill the form, or enter your endpoint manually.
                </Alert>
              )}
              {!editing && (
                <TextField
                  select
                  label="Preset"
                  size="small"
                  value=""
                  onChange={(e) => applyPreset(e.target.value)}
                  helperText="Optional — fills endpoint, region, path-style, and flavor."
                >
                  <MenuItem value="">— none —</MenuItem>
                  {PRESET_ENDPOINTS.map((p) => (
                    <MenuItem key={p.label} value={p.label}>
                      {p.label}
                    </MenuItem>
                  ))}
                </TextField>
              )}
              <TextField
                label="Name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                size="small"
                inputProps={{ maxLength: 64 }}
                helperText="Human label shown in the UI"
              />
              <TextField
                label="Endpoint URL"
                value={form.endpoint}
                onChange={(e) => setForm({ ...form, endpoint: e.target.value })}
                required
                size="small"
                placeholder="http://docker-gui-minio:9000"
                helperText="Full URL including http(s)://"
              />
              <Stack direction="row" spacing={2}>
                <TextField
                  label="Region"
                  value={form.region}
                  onChange={(e) => setForm({ ...form, region: e.target.value })}
                  size="small"
                  sx={{ flex: 1 }}
                />
                <TextField
                  select
                  label="Flavor"
                  value={form.flavor}
                  onChange={(e) => setForm({ ...form, flavor: e.target.value as Flavor })}
                  size="small"
                  sx={{ flex: 1 }}
                >
                  {(Object.entries(FLAVOR_LABEL) as Array<[Flavor, string]>).map(([k, v]) => (
                    <MenuItem key={k} value={k}>
                      {v}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>
              <FormControlLabel
                control={
                  <Switch
                    checked={form.pathStyle}
                    onChange={(_, v) => setForm({ ...form, pathStyle: v })}
                  />
                }
                label="Use path-style addressing (required for MinIO; optional for AWS)"
              />
              <TextField
                label="Access key"
                value={form.accessKey}
                onChange={(e) => setForm({ ...form, accessKey: e.target.value })}
                required={!editing}
                size="small"
                placeholder={editing ? "(unchanged)" : ""}
                inputProps={{ maxLength: 128 }}
              />
              <TextField
                label="Secret key"
                type="password"
                value={form.secretKey}
                onChange={(e) => setForm({ ...form, secretKey: e.target.value })}
                required={!editing}
                size="small"
                placeholder={editing ? "(unchanged)" : ""}
                inputProps={{ maxLength: 256 }}
                helperText="Encrypted with AES-256-GCM derived from JWT_SECRET"
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={closeDialog}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={submitting}>
              {submitting ? "Saving…" : editing ? "Save" : "Add & verify"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <Box sx={{ mt: 3 }}>
        <Typography variant="caption" color="text.secondary">
          Need to deploy MinIO first? Open <code>/features</code> and enable MinIO.
          Once it is running you can connect to it at{" "}
          <code>http://docker-gui-minio:9000</code>.
        </Typography>
      </Box>
    </PageShell>
  );
}

export default function StorageDashboard() {
  return <AuthGuard>{(user) => <StorageInner user={user} />}</AuthGuard>;
}
