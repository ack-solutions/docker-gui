"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Link,
  Stack,
  TextField,
  Tooltip,
  Typography
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import AddIcon from "@mui/icons-material/Add";
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
  PageShell
} from "@/components";
import { ApiError, apiFetch, type PublicUser } from "@/lib/v2/auth-client";

interface S3Connection {
  id: string;
  name: string;
  endpoint: string;
  flavor: string;
  verified: boolean;
}

interface Bucket {
  name: string;
  createdAt: string | null;
}

function BucketsInner({ user, connectionId }: { user: PublicUser; connectionId: string }) {
  const router = useRouter();
  const [conn, setConn] = useState<S3Connection | null>(null);
  const [rows, setRows] = useState<Bucket[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyName, setBusyName] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [c, b] = await Promise.all([
        apiFetch<S3Connection>(`/api/v1/storage/connections/${connectionId}`),
        apiFetch<Bucket[]>(`/api/v1/storage/${connectionId}/buckets`)
      ]);
      setConn(c);
      setRows(b);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : String(err));
    }
  }, [connectionId]);

  useEffect(() => {
    load();
  }, [load]);

  async function createBucket(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch(`/api/v1/storage/${connectionId}/buckets`, {
        method: "POST",
        body: JSON.stringify({ name: newName.trim() })
      });
      toast.success(`Created bucket ${newName}`);
      setCreating(false);
      setNewName("");
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function removeBucket(b: Bucket) {
    if (!confirm(`Delete bucket "${b.name}"? It must be empty first.`)) return;
    setBusyName(b.name);
    try {
      await apiFetch(`/api/v1/storage/${connectionId}/buckets/${encodeURIComponent(b.name)}`, {
        method: "DELETE"
      });
      toast.success(`Deleted ${b.name}`);
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusyName(null);
    }
  }

  if ((rows === null || conn === null) && !loadError) {
    return (
      <PageShell title="Buckets" user={user}>
        <LoadingState />
      </PageShell>
    );
  }
  if (loadError && conn === null) {
    return (
      <PageShell title="Buckets" user={user}>
        <ErrorState title="Cannot load buckets" message={loadError} onRetry={load} />
      </PageShell>
    );
  }

  const columns: Column<Bucket>[] = [
    {
      key: "name",
      header: "Name",
      render: (b) => (
        <Typography variant="body2" sx={{ fontFamily: "monospace", fontWeight: 500 }}>
          {b.name}
        </Typography>
      )
    },
    {
      key: "createdAt",
      header: "Created",
      render: (b) => (
        <Typography variant="caption" color="text.secondary">
          {b.createdAt ? formatRelativeTime(b.createdAt) : "—"}
        </Typography>
      )
    }
  ];

  function rowActions(b: Bucket) {
    const busy = busyName === b.name;
    return (
      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
        <Tooltip title="Open bucket">
          <span>
            <IconButton
              size="small"
              onClick={() =>
                router.push(`/storage/${connectionId}/buckets/${encodeURIComponent(b.name)}`)
              }
              disabled={busy}
            >
              <OpenInNewIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Delete bucket">
          <span>
            <IconButton size="small" onClick={() => removeBucket(b)} disabled={busy} color="error">
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
    );
  }

  const list = rows ?? [];
  const c = conn!;

  return (
    <PageShell
      title={`Buckets · ${c.name}`}
      subtitle={
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="caption" sx={{ fontFamily: "monospace" }}>
            {c.endpoint}
          </Typography>
          <Chip size="small" variant="outlined" label={c.flavor} sx={{ fontSize: 10 }} />
          {!c.verified && <Chip size="small" color="warning" label="unverified" />}
        </Stack>
      }
      user={user}
      actions={
        <>
          <Button
            startIcon={<RefreshIcon />}
            onClick={load}
            variant="outlined"
            size="small"
          >
            Refresh
          </Button>
          <Button
            startIcon={<AddIcon />}
            onClick={() => setCreating(true)}
            variant="contained"
            size="small"
          >
            New bucket
          </Button>
        </>
      }
    >
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link onClick={() => router.push("/storage")} sx={{ cursor: "pointer" }}>
          Storage
        </Link>
        <Typography color="text.primary">{c.name}</Typography>
      </Breadcrumbs>

      {loadError && (
        <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setLoadError(null)}>
          {loadError}
        </Alert>
      )}

      <DataTable
        searchable
        searchPlaceholder="Search buckets…"
        columns={columns}
        rows={list}
        rowKey={(b) => b.name}
        rowActions={rowActions}
        empty={
          <EmptyState
            title="No buckets yet"
            message="Create one with the button above, or via your S3 client."
          />
        }
      />

      <Dialog open={creating} onClose={() => setCreating(false)} maxWidth="xs" fullWidth>
        <form onSubmit={createBucket}>
          <DialogTitle>New bucket</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                label="Bucket name"
                value={newName}
                onChange={(e) => setNewName(e.target.value.toLowerCase())}
                required
                size="small"
                helperText="3-63 chars, lowercase letters / digits / dots / hyphens"
                inputProps={{ pattern: "^[a-z0-9][a-z0-9.\\-]{1,61}[a-z0-9]$", maxLength: 63 }}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreating(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={submitting}>
              {submitting ? "Creating…" : "Create"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </PageShell>
  );
}

export default function BucketsView({ connectionId }: { connectionId: string }) {
  return <AuthGuard>{(user) => <BucketsInner user={user} connectionId={connectionId} />}</AuthGuard>;
}
