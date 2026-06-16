"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  IconButton,
  Stack,
  Tooltip,
  Typography
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import CleaningServicesIcon from "@mui/icons-material/CleaningServices";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { toast } from "sonner";
import {
  AuthGuard,
  type Column,
  DataTable,
  EmptyState,
  ErrorState,
  formatBytes,
  LoadingState,
  PageShell,
  StatusChip
} from "@/components";
import { ApiError, apiFetch, type PublicUser } from "@/lib/v2/auth-client";

interface VolumeSummary {
  name: string;
  driver: string;
  mountpoint: string;
  scope: string;
  createdAt?: string;
  inUseBy: number;
}

const REFRESH_MS = 8000;

function VolumesInner({ user }: { user: PublicUser }) {
  const [rows, setRows] = useState<VolumeSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyName, setBusyName] = useState<string | null>(null);
  const [pruning, setPruning] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await apiFetch<VolumeSummary[]>("/api/v1/docker/volumes");
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

  async function remove(v: VolumeSummary) {
    setBusyName(v.name);
    setActionError(null);
    try {
      const force = v.inUseBy > 0;
      await apiFetch(`/api/v1/docker/volumes/${encodeURIComponent(v.name)}?force=${force}`, {
        method: "DELETE"
      });
      toast.success(`Removed ${v.name}`);
      await load();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : String(err);
      setActionError(msg);
      toast.error(msg);
    } finally {
      setBusyName(null);
    }
  }

  async function prune() {
    setPruning(true);
    setActionError(null);
    try {
      const result = await apiFetch<{ deleted: string[]; spaceReclaimed: number }>(
        "/api/v1/docker/volumes/prune",
        { method: "POST" }
      );
      toast.success(
        `Pruned ${result.deleted.length} volume${result.deleted.length === 1 ? "" : "s"} · ${formatBytes(result.spaceReclaimed)} reclaimed`
      );
      await load();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : String(err);
      setActionError(msg);
      toast.error(msg);
    } finally {
      setPruning(false);
    }
  }

  const columns: Column<VolumeSummary>[] = [
    {
      key: "name",
      header: "Name",
      render: (r) => (
        <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
          {r.name}
        </Typography>
      )
    },
    {
      key: "driver",
      header: "Driver",
      width: 100,
      render: (r) => <Typography variant="body2">{r.driver}</Typography>
    },
    {
      key: "scope",
      header: "Scope",
      width: 100,
      render: (r) => <Typography variant="body2">{r.scope}</Typography>
    },
    {
      key: "mountpoint",
      header: "Mountpoint",
      render: (r) => (
        <Typography
          variant="caption"
          sx={{ fontFamily: "monospace", wordBreak: "break-all" }}
          color="text.secondary"
        >
          {r.mountpoint}
        </Typography>
      )
    },
    {
      key: "use",
      header: "In use",
      width: 110,
      render: (r) =>
        r.inUseBy > 0 ? (
          <StatusChip status="running" label={`${r.inUseBy}`} variant="outlined" withIcon={false} />
        ) : (
          <Typography variant="caption" color="text.secondary">
            unused
          </Typography>
        )
    }
  ];

  function rowActions(r: VolumeSummary) {
    const busy = busyName === r.name;
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
      <PageShell title="Volumes" user={user}>
        <LoadingState />
      </PageShell>
    );
  }

  if (rows === null && loadError) {
    return (
      <PageShell title="Volumes" user={user}>
        <ErrorState title="Cannot list volumes" message={loadError} onRetry={load} />
      </PageShell>
    );
  }

  const unusedCount = (rows ?? []).filter((r) => r.inUseBy === 0).length;

  return (
    <PageShell
      title="Volumes"
      subtitle={`${rows?.length ?? 0} total · ${unusedCount} unused`}
      user={user}
      actions={
        <>
          <Button
            startIcon={<CleaningServicesIcon />}
            variant="contained"
            size="small"
            disabled={pruning || unusedCount === 0}
            onClick={prune}
          >
            {pruning ? "Pruning…" : "Prune unused"}
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
        searchable
        searchPlaceholder="Search volumes…"
        columns={columns}
        rows={rows ?? []}
        rowKey={(r) => r.name}
        rowActions={rowActions}
        empty={<EmptyState title="No volumes" />}
      />
    </PageShell>
  );
}

export default function VolumesDashboard() {
  return <AuthGuard>{(user) => <VolumesInner user={user} />}</AuthGuard>;
}
