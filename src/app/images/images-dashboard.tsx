"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  Stack,
  TextField,
  Tooltip,
  Typography
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import CloudDownloadIcon from "@mui/icons-material/CloudDownload";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { toast } from "sonner";
import {
  AuthGuard,
  type Column,
  DataTable,
  EmptyState,
  ErrorState,
  formatBytes,
  formatRelativeTime,
  LoadingState,
  PageShell,
  StatusChip
} from "@/components";
import { ApiError, apiFetch, type PublicUser } from "@/lib/v2/auth-client";

interface ImageSummary {
  id: string;
  shortId: string;
  repoTags: string[];
  repoDigests: string[];
  sizeBytes: number;
  createdAt: string;
  containers: number;
  dangling: boolean;
}

const REFRESH_MS = 8000;

function ImagesInner({ user }: { user: PublicUser }) {
  const [rows, setRows] = useState<ImageSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pullOpen, setPullOpen] = useState(false);
  const [pullRef, setPullRef] = useState("");
  const [pulling, setPulling] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await apiFetch<ImageSummary[]>("/api/v1/docker/images");
      setRows(list);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  async function remove(img: ImageSummary) {
    setBusyId(img.id);
    setActionError(null);
    try {
      const force = img.containers > 0;
      await apiFetch(`/api/v1/docker/images/${encodeURIComponent(img.id)}?force=${force}`, {
        method: "DELETE"
      });
      toast.success(`Removed ${img.repoTags[0] ?? img.shortId}`);
      await load();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : String(err);
      setActionError(msg);
      toast.error(msg);
    } finally {
      setBusyId(null);
    }
  }

  async function pull(e: FormEvent) {
    e.preventDefault();
    setPulling(true);
    setActionError(null);
    try {
      await apiFetch("/api/v1/docker/images/pull", {
        method: "POST",
        body: JSON.stringify({ reference: pullRef.trim() })
      });
      toast.success(`Pulled ${pullRef.trim()}`);
      setPullOpen(false);
      setPullRef("");
      await load();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : String(err);
      setActionError(msg);
      toast.error(msg);
    } finally {
      setPulling(false);
    }
  }

  const columns: Column<ImageSummary>[] = [
    {
      key: "tag",
      header: "Tag",
      render: (r) => (
        <Box>
          <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
            {r.repoTags[0] ?? <em style={{ opacity: 0.6 }}>&lt;none&gt;</em>}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {r.shortId}
          </Typography>
        </Box>
      )
    },
    {
      key: "size",
      header: "Size",
      width: 120,
      render: (r) => <Typography variant="body2">{formatBytes(r.sizeBytes)}</Typography>
    },
    {
      key: "containers",
      header: "Containers",
      width: 120,
      render: (r) =>
        r.containers > 0 ? (
          <StatusChip status="running" label={`${r.containers} in use`} variant="outlined" withIcon={false} />
        ) : (
          <Typography variant="caption" color="text.secondary">
            unused
          </Typography>
        )
    },
    {
      key: "dangling",
      header: "Status",
      width: 120,
      render: (r) =>
        r.dangling ? (
          <StatusChip status="degraded" label="dangling" variant="outlined" withIcon={false} />
        ) : (
          <StatusChip status="ok" label="tagged" variant="outlined" withIcon={false} />
        )
    },
    {
      key: "created",
      header: "Created",
      width: 140,
      render: (r) => (
        <Typography variant="caption" color="text.secondary">
          {formatRelativeTime(r.createdAt)}
        </Typography>
      )
    }
  ];

  function rowActions(r: ImageSummary) {
    const busy = busyId === r.id;
    return (
      <Tooltip title="Remove">
        <span>
          <IconButton size="small" color="error" disabled={busy} onClick={() => remove(r)}>
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
    );
  }

  if (rows === null && !loadError) {
    return (
      <PageShell title="Images" user={user}>
        <LoadingState />
      </PageShell>
    );
  }

  if (rows === null && loadError) {
    return (
      <PageShell title="Images" user={user}>
        <ErrorState title="Cannot list images" message={loadError} onRetry={load} />
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Images"
      subtitle={`${rows?.length ?? 0} image${rows?.length === 1 ? "" : "s"}`}
      user={user}
      actions={
        <>
          <Button
            startIcon={<CloudDownloadIcon />}
            variant="contained"
            size="small"
            onClick={() => setPullOpen(true)}
          >
            Pull
          </Button>
          <Button startIcon={<RefreshIcon />} variant="outlined" size="small" onClick={load}>
            Refresh
          </Button>
        </>
      }
    >
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
            title="No images"
            message="Pull one from a registry to get started."
            action={
              <Button startIcon={<CloudDownloadIcon />} variant="contained" onClick={() => setPullOpen(true)}>
                Pull image
              </Button>
            }
          />
        }
      />

      <Dialog open={pullOpen} onClose={() => !pulling && setPullOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Pull image</DialogTitle>
        <Box component="form" onSubmit={pull}>
          <DialogContent sx={{ pt: 0 }}>
            <TextField
              autoFocus
              fullWidth
              label="Image reference"
              placeholder="nginx:latest"
              value={pullRef}
              onChange={(e) => setPullRef(e.target.value)}
              disabled={pulling}
              required
              helperText="e.g. nginx:latest, ghcr.io/owner/repo:tag"
            />
            {pulling && <LinearProgress sx={{ mt: 2 }} />}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPullOpen(false)} disabled={pulling}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={pulling || !pullRef.trim()}>
              {pulling ? "Pulling…" : "Pull"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </PageShell>
  );
}

export default function ImagesDashboard() {
  return <AuthGuard>{(user) => <ImagesInner user={user} />}</AuthGuard>;
}
