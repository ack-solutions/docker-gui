"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, Box, Button, IconButton, Tooltip, Typography } from "@mui/material";
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
  LoadingState,
  PageShell,
  StatusChip
} from "@/components";
import { ApiError, apiFetch, type PublicUser } from "@/lib/v2/auth-client";

interface NetworkSummary {
  id: string;
  shortId: string;
  name: string;
  driver: string;
  scope: string;
  internal: boolean;
  ipam?: { driver?: string; subnets: string[] };
  containerCount: number;
}

const PREDEFINED = new Set(["bridge", "host", "none"]);
const REFRESH_MS = 8000;

function NetworksInner({ user }: { user: PublicUser }) {
  const [rows, setRows] = useState<NetworkSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pruning, setPruning] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await apiFetch<NetworkSummary[]>("/api/v1/docker/networks");
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

  async function remove(n: NetworkSummary) {
    setBusyId(n.id);
    setActionError(null);
    try {
      await apiFetch(`/api/v1/docker/networks/${encodeURIComponent(n.id)}`, {
        method: "DELETE"
      });
      toast.success(`Removed ${n.name}`);
      await load();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : String(err);
      setActionError(msg);
      toast.error(msg);
    } finally {
      setBusyId(null);
    }
  }

  async function prune() {
    setPruning(true);
    setActionError(null);
    try {
      const result = await apiFetch<{ deleted: string[] }>("/api/v1/docker/networks/prune", {
        method: "POST"
      });
      toast.success(
        `Pruned ${result.deleted.length} network${result.deleted.length === 1 ? "" : "s"}`
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

  const columns: Column<NetworkSummary>[] = [
    {
      key: "name",
      header: "Name",
      render: (r) => (
        <Box>
          <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
            {r.name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {r.shortId}
          </Typography>
        </Box>
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
      width: 90,
      render: (r) => <Typography variant="body2">{r.scope}</Typography>
    },
    {
      key: "subnets",
      header: "Subnets",
      render: (r) => (
        <Typography
          variant="caption"
          sx={{ fontFamily: "monospace" }}
          color="text.secondary"
        >
          {r.ipam?.subnets.join(", ") || "—"}
        </Typography>
      )
    },
    {
      key: "containers",
      header: "Containers",
      width: 110,
      render: (r) =>
        r.containerCount > 0 ? (
          <StatusChip
            status="running"
            label={`${r.containerCount}`}
            variant="outlined"
            withIcon={false}
          />
        ) : (
          <Typography variant="caption" color="text.secondary">
            none
          </Typography>
        )
    }
  ];

  function rowActions(r: NetworkSummary) {
    const busy = busyId === r.id;
    const isPredefined = PREDEFINED.has(r.name);
    return (
      <Tooltip title={isPredefined ? "Predefined networks cannot be removed" : "Remove"}>
        <span>
          <IconButton
            size="small"
            color="error"
            disabled={busy || isPredefined}
            onClick={() => remove(r)}
          >
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
    );
  }

  if (rows === null && !loadError) {
    return (
      <PageShell title="Networks" user={user}>
        <LoadingState />
      </PageShell>
    );
  }

  if (rows === null && loadError) {
    return (
      <PageShell title="Networks" user={user}>
        <ErrorState title="Cannot list networks" message={loadError} onRetry={load} />
      </PageShell>
    );
  }

  const removable = (rows ?? []).filter(
    (r) => !PREDEFINED.has(r.name) && r.containerCount === 0
  ).length;

  return (
    <PageShell
      title="Networks"
      subtitle={`${rows?.length ?? 0} total · ${removable} prunable`}
      user={user}
      actions={
        <>
          <Button
            startIcon={<CleaningServicesIcon />}
            variant="contained"
            size="small"
            disabled={pruning || removable === 0}
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
        searchPlaceholder="Search networks…"
        columns={columns}
        rows={rows ?? []}
        rowKey={(r) => r.id}
        rowActions={rowActions}
        empty={<EmptyState title="No networks" />}
      />
    </PageShell>
  );
}

export default function NetworksDashboard() {
  return <AuthGuard>{(user) => <NetworksInner user={user} />}</AuthGuard>;
}
